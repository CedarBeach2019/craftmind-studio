/**
 * @module highlights
 * Highlight Reel Generator — scans replays for the best moments and creates condensed reels.
 * Categories: funny, impressive, dramatic, scenic
 */

import { createReplayRecorder } from './replay.js';
import { createAIDirector } from './ai-director.js';

/**
 * @typedef {'funny'|'impressive'|'dramatic'|'scenic'|'action'|'heartwarming'} HighlightCategory
 * @typedef {import('./replay.js').ReplayEvent} ReplayEvent
 */

/**
 * Highlight Reel Generator — finds and compiles best moments.
 */
export class HighlightReel {
  /**
   * @param {object} options
   * @param {number} [options.minIntensity=0.5] — Minimum intensity for highlights
   * @param {number} [options.maxClipDuration=15000] — Max duration per highlight (ms)
   * @param {number} [options.minClipDuration=3000] — Min duration per highlight (ms)
   * @param {number} [options.maxClips=20] — Maximum clips in a reel
   * @param {boolean} [options.removeDuplicates=true] — Detect and remove similar clips
   * @param {number} [options.duplicateThreshold=0.8] — Similarity threshold for duplicates
   */
  constructor(options = {}) {
    this.minIntensity = options.minIntensity ?? 0.5;
    this.maxClipDuration = options.maxClipDuration ?? 15000;
    this.minClipDuration = options.minClipDuration ?? 3000;
    this.maxClips = options.maxClips ?? 20;
    this.removeDuplicates = options.removeDuplicates ?? true;
    this.duplicateThreshold = options.duplicateThreshold ?? 0.8;

    this.director = createAIDirector();
    this.recorder = createReplayRecorder();
  }

  /**
   * Scan a replay for highlight moments.
   * @param {string} replayId
   * @param {HighlightCategory[]} [categories] — Filter by categories (default: all)
   * @returns {Promise<HighlightClip[]>}
   */
  async scan(replayId, categories) {
    const events = await this.recorder.loadReplay(replayId);
    const moments = await this.director.analyze(events);

    const categoryFilters = categories ?? Object.keys(this._getCategoryMatchers());

    return moments
      .filter(moment => moment.intensity >= this.minIntensity)
      .filter(moment => this._matchesCategories(moment, categoryFilters))
      .map(moment => this._createClip(moment))
      .filter(clip => clip.durationMs <= this.maxClipDuration)
      .filter(clip => clip.durationMs >= this.minClipDuration);
  }

  /**
   * Generate a highlight reel from scanned clips.
   * @param {HighlightClip[]} clips
   * @param {object} options
   * @param {number} [options.targetDurationMs=60000] — Target total duration (default: 1min)
   * @param {string} [options.sortBy='intensity'] — Sort clips by 'intensity', 'duration', 'category'
   * @param {boolean} [options.shuffle=false] — Shuffle clip order
   * @returns {HighlightReel}
   */
  generate(clips, options = {}) {
    const targetDuration = options.targetDurationMs ?? 60000;
    const sortBy = options.sortBy ?? 'intensity';
    const shuffle = options.shuffle ?? false;

    let sortedClips = [...clips];

    // Remove duplicates if enabled
    if (this.removeDuplicates) {
      sortedClips = this._deduplicateClips(sortedClips);
    }

    // Sort clips
    if (!shuffle) {
      sortedClips.sort((a, b) => {
        switch (sortBy) {
          case 'duration':
            return b.durationMs - a.durationMs;
          case 'category':
            return a.category.localeCompare(b.category);
          case 'intensity':
          default:
            return b.intensity - a.intensity;
        }
      });
    } else {
      // Fisher-Yates shuffle
      for (let i = sortedClips.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortedClips[i], sortedClips[j]] = [sortedClips[j], sortedClips[i]];
      }
    }

    // Select clips to fit target duration (with max limit)
    let totalDuration = 0;
    const selectedClips = [];
    for (const clip of sortedClips) {
      if (selectedClips.length >= this.maxClips) break;
      if (totalDuration + clip.durationMs > targetDuration) break;

      selectedClips.push(clip);
      totalDuration += clip.durationMs;
    }

    return {
      clips: selectedClips,
      totalDurationMs: totalDuration,
      clipCount: selectedClips.length,
      categoryBreakdown: this._calculateCategoryBreakdown(selectedClips),
      averageIntensity: this._calculateAverageIntensity(selectedClips),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export a highlight reel as a shareable replay file.
   * @param {HighlightReel} reel
   * @param {string} [outputPath] — Optional custom output path
   * @returns {Promise<string>} Path to exported file
   */
  async export(reel, outputPath) {
    const filename = outputPath ?? `highlight-reel-${Date.now()}.json`;
    const { promises: fs } = await import('fs');
    const { join } = await import('path');

    await fs.mkdir('highlights', { recursive: true });
    const filepath = join('highlights', filename);

    const exportData = {
      metadata: {
        version: '1.0',
        generatedAt: reel.generatedAt,
        totalDurationMs: reel.totalDurationMs,
        clipCount: reel.clipCount,
        categoryBreakdown: reel.categoryBreakdown,
        averageIntensity: reel.averageIntensity,
      },
      clips: reel.clips.map(clip => ({
        category: clip.category,
        startTime: clip.startTime,
        endTime: clip.endTime,
        durationMs: clip.durationMs,
        intensity: clip.intensity,
        sceneType: clip.sceneType,
        description: clip.description,
        participants: clip.participants,
        tags: clip.tags,
        suggestedShot: clip.suggestedShot,
      })),
    };

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf8');
    return filepath;
  }

  /**
   * Import a highlight reel from a file.
   * @param {string} filepath
   * @returns {Promise<HighlightReel>}
   */
  async import(filepath) {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(content);

    // Reconstruct clips from export format
    const clips = data.clips.map(clip => ({
      ...clip,
      replayId: null, // Not preserved in export
    }));

    return {
      clips,
      totalDurationMs: data.metadata.totalDurationMs,
      clipCount: data.metadata.clipCount,
      categoryBreakdown: data.metadata.categoryBreakdown,
      averageIntensity: data.metadata.averageIntensity,
      generatedAt: data.metadata.generatedAt,
    };
  }

  /**
   * Categorize a clip into highlight categories.
   * @param {import('./ai-director.js').CinematicMoment} moment
   * @returns {HighlightCategory}
   */
  categorizeMoment(moment) {
    const matchers = this._getCategoryMatchers();

    for (const [category, matcher] of Object.entries(matchers)) {
      if (matcher(moment)) {
        return category;
      }
    }

    return 'impressive'; // Default fallback
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  /**
   * Get category matcher functions.
   * @private
   */
  _getCategoryMatchers() {
    return {
      funny: (moment) =>
        moment.sceneType === 'comedy' ||
        moment.description.includes('comedy') ||
        this._hasFunnyKeywords(moment),

      impressive: (moment) =>
        moment.intensity > 0.7 &&
        (moment.sceneType === 'action' || moment.keyEvents.length >= 2),

      dramatic: (moment) =>
        moment.sceneType === 'dramatic' ||
        moment.sceneType === 'suspense' ||
        moment.description.includes('dramatic'),

      scenic: (moment) =>
        moment.sceneType === 'establishing' ||
        moment.description.includes('establishing'),

      action: (moment) =>
        moment.sceneType === 'action' &&
        moment.intensity > 0.6,

      heartwarming: (moment) =>
        this._hasHeartwarmingKeywords(moment),
    };
  }

  /**
   * Check if moment matches specified categories.
   * @private
   */
  _matchesCategories(moment, categories) {
    const clipCategory = this.categorizeMoment(moment);
    return categories.includes(clipCategory);
  }

  /**
   * Create a highlight clip from a moment.
   * @private
   */
  _createClip(moment) {
    const category = this.categorizeMoment(moment);
    const duration = moment.endTime - moment.startTime;

    return {
      replayId: null, // Will be set by caller
      startTime: moment.startTime,
      endTime: moment.endTime,
      durationMs: duration,
      intensity: moment.intensity,
      category,
      sceneType: moment.sceneType,
      description: moment.description,
      participants: moment.participants,
      keyEvents: moment.keyEvents,
      tags: this._generateTags(moment, category),
      suggestedShot: this._generateSuggestedShot(moment, category),
    };
  }

  /**
   * Generate tags for a clip.
   * @private
   */
  _generateTags(moment, category) {
    const tags = [category, moment.sceneType];

    // Add intensity-based tags
    if (moment.intensity > 0.8) tags.push('epic');
    else if (moment.intensity > 0.6) tags.push('intense');
    else if (moment.intensity > 0.4) tags.push('moderate');
    else tags.push('subtle');

    // Add participant count tags
    if (moment.participants.length >= 3) tags.push('multiplayer');
    else if (moment.participants.length === 2) tags.push('duo');
    else tags.push('solo');

    // Add scene-specific tags
    if (moment.keyEvents.length >= 3) tags.push('event-heavy');
    if (moment.description.includes('comedy')) tags.push('comedy');

    return tags;
  }

  /**
   * Generate a suggested shot configuration.
   * @private
   */
  _generateSuggestedShot(moment, category) {
    const shotMap = {
      funny: { type: 'wide', transition: 'cut', durationSec: 4 },
      impressive: { type: 'close-up', transition: 'dissolve', durationSec: 3 },
      dramatic: { type: 'dolly', transition: 'fade', durationSec: 5 },
      scenic: { type: 'crane', transition: 'fade', durationSec: 6 },
      action: { type: 'tracking', transition: 'cut', durationSec: 2 },
      heartwarming: { type: 'medium', transition: 'dissolve', durationSec: 4 },
    };

    return shotMap[category] ?? shotMap['impressive'];
  }

  /**
   * Remove duplicate or very similar clips.
   * @private
   */
  _deduplicateClips(clips) {
    const deduplicated = [];
    const signatures = new Set();

    for (const clip of clips) {
      const signature = this._createClipSignature(clip);

      // Check for similar signatures
      let isDuplicate = false;
      for (const existing of signatures) {
        if (this._signatureSimilarity(signature, existing) > this.duplicateThreshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(clip);
        signatures.add(signature);
      }
    }

    return deduplicated;
  }

  /**
   * Create a signature for similarity detection.
   * @private
   */
  _createClipSignature(clip) {
    return {
      category: clip.category,
      sceneType: clip.sceneType,
      participantCount: clip.participants.length,
      intensityRange: Math.floor(clip.intensity * 10) / 10,
      keyEventTypes: clip.keyEvents.map(e => e.type).sort().join(','),
    };
  }

  /**
   * Calculate similarity between two clip signatures.
   * @private
   */
  _signatureSimilarity(sig1, sig2) {
    let matches = 0;
    let total = 0;

    if (sig1.category === sig2.category) { matches++; }
    total++;

    if (sig1.sceneType === sig2.sceneType) { matches++; }
    total++;

    if (sig1.participantCount === sig2.participantCount) { matches++; }
    total++;

    if (Math.abs(sig1.intensityRange - sig2.intensityRange) < 0.1) { matches++; }
    total++;

    if (sig1.keyEventTypes === sig2.keyEventTypes) { matches++; }
    total++;

    return matches / total;
  }

  /**
   * Calculate category breakdown for a reel.
   * @private
   */
  _calculateCategoryBreakdown(clips) {
    const breakdown = {};
    for (const clip of clips) {
      breakdown[clip.category] = (breakdown[clip.category] ?? 0) + 1;
    }
    return breakdown;
  }

  /**
   * Calculate average intensity of clips.
   * @private
   */
  _calculateAverageIntensity(clips) {
    if (clips.length === 0) return 0;
    const sum = clips.reduce((s, c) => s + c.intensity, 0);
    return sum / clips.length;
  }

  /**
   * Check for funny keywords in moment events.
   * @private
   */
  _hasFunnyKeywords(moment) {
    const funnyWords = ['lol', 'lmao', 'haha', 'funny', 'joke', 'lol'];

    for (const event of moment.keyEvents) {
      if (event.type === 'chat') {
        const message = event.data.message?.toLowerCase() ?? '';
        if (funnyWords.some(word => message.includes(word))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check for heartwarming keywords.
   * @private
   */
  _hasHeartwarmingKeywords(moment) {
    const warmWords = ['love', 'thank', 'friend', 'help', 'together', 'nice'];

    for (const event of moment.keyEvents) {
      if (event.type === 'chat') {
        const message = event.data.message?.toLowerCase() ?? '';
        if (warmWords.some(word => message.includes(word))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Merge multiple highlight reels into one.
   * @param {HighlightReel[]} reels
   * @param {object} options
   * @returns {HighlightReel}
   */
  mergeReels(reels, options = {}) {
    const allClips = reels.flatMap(r => r.clips);
    const merged = this.generate(allClips, options);

    // Update metadata
    merged.sourceReels = reels.length;
    merged.mergedAt = new Date().toISOString();

    return merged;
  }

  /**
   * Get statistics about a replay's highlight potential.
   * @param {string} replayId
   * @returns {Promise<HighlightStats>}
   */
  async getStats(replayId) {
    const clips = await this.scan(replayId);

    const categoryCounts = {};
    for (const clip of clips) {
      categoryCounts[clip.category] = (categoryCounts[clip.category] ?? 0) + 1;
    }

    const totalDuration = clips.reduce((sum, c) => sum + c.durationMs, 0);
    const highlightDensity = totalDuration / await this._getReplayDuration(replayId);

    return {
      totalHighlights: clips.length,
      categoryBreakdown: categoryCounts,
      totalHighlightDurationMs: totalDuration,
      averageIntensity: this._calculateAverageIntensity(clips),
      highlightDensity: Math.min(highlightDensity, 1.0),
      topCategories: Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, count]) => ({ category: cat, count })),
    };
  }

  /**
   * Get total duration of a replay.
   * @private
   */
  async _getReplayDuration(replayId) {
    const metadata = await this.recorder.getReplayMetadata(replayId);
    return metadata.duration;
  }
}

/**
 * @typedef {object} HighlightClip
 * @property {string|null} replayId
 * @property {number} startTime
 * @property {number} endTime
 * @property {number} durationMs
 * @property {number} intensity
 * @property {HighlightCategory} category
 * @property {import('./ai-director.js').SceneType} sceneType
 * @property {string} description
 * @property {string[]} participants
 * @property {ReplayEvent[]} keyEvents
 * @property {string[]} tags
 * @property {object} suggestedShot — { type, transition, durationSec }
 */

/**
 * @typedef {object} HighlightReel
 * @property {HighlightClip[]} clips
 * @property {number} totalDurationMs
 * @property {number} clipCount
 * @property {object} categoryBreakdown — { [category]: count }
 * @property {number} averageIntensity
 * @property {string} generatedAt
 * @property {number} [sourceReels] — Number of source reels if merged
 * @property {string} [mergedAt] — Merge timestamp if applicable
 */

/**
 * @typedef {object} HighlightStats
 * @property {number} totalHighlights
 * @property {object} categoryBreakdown
 * @property {number} totalHighlightDurationMs
 * @property {number} averageIntensity
 * @property {number} highlightDensity — [0, 1]
 * @property {Array<{category: HighlightCategory, count: number}>} topCategories
 */

/**
 * Create a new Highlight Reel Generator instance.
 * @param {object} [options]
 * @returns {HighlightReel}
 */
export function createHighlightReel(options) {
  return new HighlightReel(options);
}
