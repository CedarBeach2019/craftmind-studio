/**
 * @module director
 * Director AI Engine — the creative brain of CraftMind Studio.
 *
 * Receives a creative brief (story, characters, mood) and generates
 * a scene-by-scene shot list using established beat-sheet templates
 * (3-Act Structure, Save the Cat).
 */

const LLM_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const LLM_MODEL = 'glm-4.7-flash';

// ── Beat-sheet templates ──────────────────────────────────────────────

const SAVE_THE_CAT_BEATS = [
  { beat: 'opening_image',   label: 'Opening Image',   weight: 0.05 },
  { beat: 'theme_stated',    label: 'Theme Stated',    weight: 0.05 },
  { beat: 'setup',           label: 'Setup',           weight: 0.10 },
  { beat: 'catalyst',        label: 'Catalyst',        weight: 0.05 },
  { beat: 'debate',          label: 'Debate',          weight: 0.10 },
  { beat: 'break_into_two',  label: 'Break into Two',  weight: 0.05 },
  { beat: 'fun_and_games',   label: 'Fun and Games',   weight: 0.15 },
  { beat: 'midpoint',        label: 'Midpoint',        weight: 0.10 },
  { beat: 'bad_guys_close',  label: 'Bad Guys Close In', weight: 0.10 },
  { beat: 'all_is_lost',     label: 'All Is Lost',     weight: 0.05 },
  { beat: 'dark_night',      label: 'Dark Night of Soul', weight: 0.05 },
  { beat: 'break_into_three', label: 'Break into Three', weight: 0.05 },
  { beat: 'finale',          label: 'Finale',          weight: 0.10 },
  { beat: 'final_image',     label: 'Final Image',     weight: 0.05 },
];

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Generate a full scene-by-scene shot list from a creative brief.
 *
 * @param {object} brief
 * @param {string} brief.premise       — Core story idea
 * @param {string[]} brief.characters  — Character names involved
 * @param {string}  brief.mood         — Emotional tone (e.g. "dark comedy", "epic", "melancholy")
 * @param {number}  [brief.targetDurationSec=300] — Desired total runtime in seconds
 * @returns {Promise<import('./timeline.js').Timeline>} Resolves with a populated Timeline
 */
export async function generateShotList(brief) {
  const targetDuration = brief.targetDurationSec ?? 300;
  const systemPrompt = buildSystemPrompt(brief);
  const userPrompt = buildUserPrompt(brief, targetDuration);

  const raw = await callLLM(systemPrompt, userPrompt);
  const scenes = parseScenes(raw, targetDuration);
  return buildTimeline(scenes, brief);
}

/**
 * Generate dialogue for a single scene given character profiles.
 *
 * @param {object} scene         — Scene metadata (description, characters, mood)
 * @param {import('./character.js').CharacterProfile[]} cast — Characters in the scene
 * @param {string} [previousSceneSummary] — Summary of what happened before (for continuity)
 * @returns {Promise<{characterId: string, line: string, emotion: string}[]>}
 */
export async function generateDialogue(scene, cast, previousSceneSummary) {
  const systemPrompt = `You are a dialogue writer for Minecraft machinima.
Write natural, character-consistent dialogue. Keep lines short (1-2 sentences).
Include stage directions in [brackets]. Format each line as:
CHARACTER_ID: "Dialogue" (emotion)
`;

  const castDescriptions = cast.map(c =>
    `${c.id}: ${c.personality.join(', ')}. Speaking style: ${c.speakingStyle}`
  ).join('\n');

  const userPrompt = `Scene: ${scene.description}
Characters:\n${castDescriptions}
${previousSceneSummary ? `Previous context: ${previousSceneSummary}` : ''}

Write the dialogue for this scene.`;

  const raw = await callLLM(systemPrompt, userPrompt);
  return parseDialogue(raw);
}

// ── LLM call ──────────────────────────────────────────────────────────

/**
 * Call the LLM and return the assistant's text content.
 * @param {string} system
 * @param {string} user
 * @returns {Promise<string>}
 */
async function callLLM(system, user) {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error('ZAI_API_KEY environment variable is required');

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.75,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Prompt builders ───────────────────────────────────────────────────

function buildSystemPrompt(brief) {
  return `You are an AI film director for Minecraft machinima content.
You specialize in the Save the Cat beat sheet and three-act structure.
Given a creative brief, produce a scene-by-scene shot list in JSON format.

Each scene object must have:
- scene: number
- beat: one of ${SAVE_THE_CAT_BEATS.map(b => `"${b.beat}"`).join(', ')}
- description: narrative description of what happens
- characters: array of character IDs present
- cameraAngle: one of "wide", "medium", "close-up", "over-shoulder", "low-angle", "high-angle", "crane", "dolly"
- durationSec: estimated duration in seconds
- dialogueHint: brief note on what dialogue occurs
- mood: emotional tone of this specific scene
- transition: how this scene connects to the next ("cut", "fade", "dissolve", "match-cut")

Return ONLY valid JSON — an array of scene objects.`;
}

function buildUserPrompt(brief, targetDuration) {
  return `CREATIVE BRIEF:
Premise: ${brief.premise}
Characters: ${brief.characters.join(', ')}
Mood: ${brief.mood}
Target duration: ${targetDuration} seconds

Generate the shot list as a JSON array.`;
}

// ── Parsers ───────────────────────────────────────────────────────────

function parseScenes(rawJson, targetDuration) {
  let text = rawJson.trim();
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const scenes = JSON.parse(text);
  if (!Array.isArray(scenes)) throw new Error('LLM did not return an array of scenes');

  // Distribute remaining time proportionally
  const totalEst = scenes.reduce((s, c) => s + (c.durationSec || 10), 0);
  const scale = targetDuration / totalEst;
  for (const scene of scenes) {
    scene.durationSec = Math.round((scene.durationSec || 10) * scale);
  }

  return scenes;
}

function parseDialogue(raw) {
  const lines = [];
  const regex = /^(\w+):\s*"([^"]+)"\s*\(([^)]+)\)/gm;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    lines.push({ characterId: match[1], line: match[2], emotion: match[3] });
  }
  return lines;
}

// ── Timeline builder ──────────────────────────────────────────────────

async function buildTimeline(scenes, brief) {
  const { createTimeline } = await import('./timeline.js');
  const tl = createTimeline(brief.premise);
  for (const s of scenes) {
    tl.addShot({
      sceneNumber: s.scene,
      description: s.description,
      cameraAngle: s.cameraAngle,
      durationSec: s.durationSec,
      dialogueHint: s.dialogueHint,
      mood: s.mood,
      characters: s.characters,
      transition: s.transition,
      beat: s.beat,
    });
  }
  return tl;
}

// ── Crisis & Era Extensions ──────────────────────────────────────────

/**
 * Check if the director is experiencing a creative block.
 */
export function checkDirectorBlock(genre, eraSystem) {
  if (Math.random() < 0.1) {
    return {
      blocked: true,
      suggestion: eraSystem
        ? `Consider using ${eraSystem.era.sets.slice(-2).join(' or ')} sets from the ${eraSystem.era.name}.`
        : 'Try a different genre or take a break.',
    };
  }
  return { blocked: false, suggestion: '' };
}

/**
 * Get era-appropriate suggestions for the director.
 */
export function getEraSuggestions(eraSystem) {
  if (!eraSystem) return [];
  const era = eraSystem.era;
  return [`🎬 ${era.name} — ${era.description}`];
}
