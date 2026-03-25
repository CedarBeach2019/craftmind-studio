/**
 * @module dialogue-beats
 * Dialogue Beat System — syncs dialogue delivery to action beats with
 * natural timing, pauses, emphasis, and character-consistent pacing.
 */

/**
 * @typedef {object} DialogueLine
 * @property {string} characterId
 * @property {string} text
 * @property {string} emotion
 * @property {number} [startSec] — When this line starts (auto-calculated)
 * @property {number} [endSec] — When this line ends
 * @property {number} [pauseBefore=0.3] — Seconds of silence before this line
 * @property {number} [pauseAfter=0.2] — Seconds of silence after this line
 * @property {number} [emphasis=0.5] — 0-1, how emphasized/dramatic the delivery is
 * @property {string} [stageDirection] — Action happening during this line
 */

/**
 * @typedef {object} ActionBeat
 * @property {string} id — Beat identifier
 * @property {string} type — "dialogue" | "action" | "pause" | "camera_move" | "sfx"
 * @property {number} startSec
 * @property {number} durationSec
 * @property {string} description
 * @property {object} [metadata]
 */

/**
 * @typedef {object} BeatSequence
 * @property {string} sceneId
 * @property {ActionBeat[]} beats
 * @property {number} totalDurationSec
 */

// ── Pacing Profiles ───────────────────────────────────────────────────

const PACING_PROFILES = {
  /** Natural conversation pace */
  conversational: { basePauseBefore: 0.4, basePauseAfter: 0.3, emphasisBase: 0.3 },
  /** High tension — faster, sharper */
  intense: { basePauseBefore: 0.1, basePauseAfter: 0.1, emphasisBase: 0.8 },
  /** Relaxed, casual */
  relaxed: { basePauseBefore: 0.6, basePauseAfter: 0.5, emphasisBase: 0.2 },
  /** Dramatic revelation — long pauses, heavy emphasis */
  dramatic: { basePauseBefore: 1.0, basePauseAfter: 0.8, emphasisBase: 0.9 },
  /** Comedy timing — punchier pauses */
  comedic: { basePauseBefore: 0.2, basePauseAfter: 0.5, emphasisBase: 0.4 },
};

// ── Text Duration Estimation ──────────────────────────────────────────

/**
 * Estimate how long a line of dialogue takes to speak (seconds).
 * Based on average speaking rate of ~150 words/minute, adjusted for emotion.
 *
 * @param {string} text
 * @param {string} emotion
 * @param {number} [emphasis=0.5]
 * @returns {number} estimated duration in seconds
 */
export function estimateLineDuration(text, emotion, emphasis = 0.5) {
  const words = text.split(/\s+/).length;
  let wordsPerSec = 2.5; // ~150 wpm

  // Emotion adjustments
  if (emotion === 'fear' || emotion === 'panic') wordsPerSec = 3.5; // Fast
  if (emotion === 'sadness' || emotion === 'melancholy') wordsPerSec = 1.8; // Slow
  if (emotion === 'anger' || emotion === 'rage') wordsPerSec = 3.2; // Fast, clipped
  if (emotion === 'awe' || emotion === 'wonder') wordsPerSec = 1.5; // Very slow
  if (emotion === 'sarcasm') wordsPerSec = 2.2; // Slightly slow for effect

  // Emphasis makes delivery slower
  wordsPerSec *= (1 - emphasis * 0.3);

  // Add a minimum floor
  return Math.max(0.5, words / wordsPerSec);
}

// ── Beat Timing ───────────────────────────────────────────────────────

/**
 * Build a beat sequence from dialogue lines and action beats.
 * Calculates precise timing for every element.
 *
 * @param {object} opts
 * @param {DialogueLine[]} opts.dialogue — Raw dialogue lines
 * @param {object[]} [opts.actions] — Action beats (e.g., { at: 'before_line_2', type: 'sfx', description: 'door slams' })
 * @param {string} [opts.pacing='conversational'] — Pacing profile name
 * @param {string} [opts.mood] — Scene mood (used to select pacing if not specified)
 * @returns {BeatSequence}
 */
export function buildBeatSequence(opts) {
  const { dialogue, actions = [], pacing: pacingName, mood } = opts;

  const pacing = PACING_PROFILES[pacingName ?? selectPacing(mood)] ?? PACING_PROFILES.conversational;
  const beats = [];
  let currentTime = 0;

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];

    // Insert action beats scheduled before this line
    const preActions = actions.filter(a => a.at === `before_line_${i}`);
    for (const action of preActions) {
      const actionDur = action.durationSec ?? 1;
      beats.push({
        id: `action_${i}_${beats.length}`,
        type: action.type ?? 'action',
        startSec: currentTime,
        durationSec: actionDur,
        description: action.description ?? '',
        metadata: action.metadata,
      });
      currentTime += actionDur;
    }

    // Pause before dialogue
    const pauseBefore = line.pauseBefore ?? pacing.basePauseBefore;
    if (pauseBefore > 0 && beats.length > 0) {
      beats.push({
        id: `pause_${i}`,
        type: 'pause',
        startSec: currentTime,
        durationSec: pauseBefore,
        description: 'silence',
      });
      currentTime += pauseBefore;
    }

    // The dialogue line itself
    const emphasis = line.emphasis ?? pacing.emphasisBase;
    const duration = estimateLineDuration(line.text, line.emotion, emphasis);

    line.startSec = currentTime;
    line.endSec = currentTime + duration;

    beats.push({
      id: `dialogue_${i}`,
      type: 'dialogue',
      startSec: currentTime,
      durationSec: duration,
      description: `${line.characterId}: "${line.text}"`,
      metadata: {
        characterId: line.characterId,
        text: line.text,
        emotion: line.emotion,
        emphasis,
        stageDirection: line.stageDirection,
      },
    });
    currentTime += duration;

    // Pause after dialogue
    const pauseAfter = line.pauseAfter ?? pacing.basePauseAfter;
    if (pauseAfter > 0 && i < dialogue.length - 1) {
      beats.push({
        id: `pause_after_${i}`,
        type: 'pause',
        startSec: currentTime,
        durationSec: pauseAfter,
        description: 'silence',
      });
      currentTime += pauseAfter;
    }
  }

  // Remaining actions (after all dialogue)
  const postActions = actions.filter(a => a.at === 'after_dialogue');
  for (const action of postActions) {
    beats.push({
      id: `post_action_${beats.length}`,
      type: action.type ?? 'action',
      startSec: currentTime,
      durationSec: action.durationSec ?? 2,
      description: action.description ?? '',
      metadata: action.metadata,
    });
    currentTime += (action.durationSec ?? 2);
  }

  return {
    sceneId: opts.sceneId ?? 'unknown',
    beats,
    totalDurationSec: currentTime,
  };
}

/**
 * Select a pacing profile based on scene mood.
 */
function selectPacing(mood) {
  if (!mood) return 'conversational';
  const moodLower = mood.toLowerCase();
  if (moodLower.includes('tension') || moodLower.includes('suspense') || moodLower.includes('horror')) return 'intense';
  if (moodLower.includes('calm') || moodLower.includes('peaceful') || moodLower.includes('relaxed')) return 'relaxed';
  if (moodLower.includes('drama') || moodLower.includes('reveal') || moodLower.includes('emotional')) return 'dramatic';
  if (moodLower.includes('comedy') || moodLower.includes('humor') || moodLower.includes('funny')) return 'comedic';
  return 'conversational';
}

/**
 * Get the active beat at a given time.
 * @param {BeatSequence} sequence
 * @param {number} timeSec
 * @returns {ActionBeat | undefined}
 */
export function getBeatAt(sequence, timeSec) {
  return sequence.beats.find(b => timeSec >= b.startSec && timeSec < b.startSec + b.durationSec);
}

/**
 * Generate subtitle timing data (SRT-like format).
 * @param {BeatSequence} sequence
 * @returns {Array<{ index: number, start: string, end: string, text: string, character: string }>}
 */
export function generateSubtitles(sequence) {
  const subtitles = [];
  let index = 1;

  for (const beat of sequence.beats) {
    if (beat.type === 'dialogue' && beat.metadata) {
      subtitles.push({
        index: index++,
        start: formatTimestamp(beat.startSec),
        end: formatTimestamp(beat.startSec + beat.durationSec),
        text: beat.metadata.text,
        character: beat.metadata.characterId,
      });
    }
  }

  return subtitles;
}

/**
 * Generate SRT subtitle file content.
 * @param {BeatSequence} sequence
 * @returns {string}
 */
export function generateSRT(sequence) {
  const subs = generateSubtitles(sequence);
  return subs.map(s =>
    `${s.index}\n${s.start} --> ${s.end}\n${s.character.toUpperCase()}: ${s.text}\n`
  ).join('\n');
}

function formatTimestamp(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export { PACING_PROFILES };
