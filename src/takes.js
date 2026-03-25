/**
 * @module takes
 * Takes & Retakes — record the same scene multiple times and select the best.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * @typedef {object} Take
 * @property {string} id — e.g. "scene_1_take_3"
 * @property {number} sceneNumber
 * @property {number} takeNumber
 * @property {number} timestamp
 * @property {string} status — "recording" | "completed" | "discarded"
 * @property {number} durationSec
 * @property {string[]} framePaths — Paths to captured frames
 * @property {string} clipPath — Path to rendered clip (after rendering)
 * @property {object} metrics — Quality metrics
 * @property {number} metrics.cameraSmoothness — 0-1, how smooth the camera path was
 * @property {number} metrics.positioningAccuracy — 0-1, how close actors were to marks
 * @property {number} metrics.dialogueTiming — 0-1, dialogue sync quality
 * @property {number} metrics.overallScore — Weighted composite
 * @property {string} notes — Director's notes about this take
 */

/**
 * TakeManager handles recording multiple takes of a scene and selecting the best one.
 */
class TakeManager {
  constructor() {
    /** @type {Map<string, Take[]>} sceneNumber → takes */
    this.takes = new Map();
    /** @type {Map<string, string>} sceneNumber → selected take ID */
    this.selectedTakes = new Map();
  }

  /**
   * Start a new take for a scene.
   * @param {number} sceneNumber
   * @param {object} [opts]
   * @param {string} [opts.outputDir='./takes']
   * @param {string} [opts.notes]
   * @returns {Take}
   */
  startTake(sceneNumber, opts = {}) {
    const takes = this.takes.get(sceneNumber) ?? [];
    const takeNumber = takes.length + 1;
    const id = `scene_${sceneNumber}_take_${takeNumber}`;

    const take = {
      id,
      sceneNumber,
      takeNumber,
      timestamp: Date.now(),
      status: 'recording',
      durationSec: 0,
      framePaths: [],
      clipPath: '',
      metrics: {
        cameraSmoothness: 0,
        positioningAccuracy: 0,
        dialogueTiming: 0,
        overallScore: 0,
      },
      notes: opts.notes ?? '',
    };

    takes.push(take);
    this.takes.set(sceneNumber, takes);
    return take;
  }

  /**
   * Complete a take (mark as finished).
   * @param {string} takeId
   * @param {object} [metrics] — Optional pre-calculated metrics
   */
  completeTake(takeId, metrics = null) {
    const take = this.findTake(takeId);
    if (!take) throw new Error(`Take "${takeId}" not found`);
    take.status = 'completed';
    if (take.framePaths.length > 0) {
      take.durationSec = take.framePaths.length / 24; // Assume 24fps
    }
    if (metrics) {
      Object.assign(take.metrics, metrics);
      // Auto-compute overall score if individual metrics are set but overall is 0
      const m = take.metrics;
      if (m.overallScore === 0 && (m.cameraSmoothness || m.positioningAccuracy || m.dialogueTiming)) {
        m.overallScore = +(m.cameraSmoothness * 0.3 + m.positioningAccuracy * 0.35 + m.dialogueTiming * 0.35).toFixed(2);
      }
    }
    return take;
  }

  /**
   * Discard a take (keep record but mark as discarded).
   * @param {string} takeId
   */
  discardTake(takeId) {
    const take = this.findTake(takeId);
    if (!take) throw new Error(`Take "${takeId}" not found`);
    take.status = 'discarded';
    return take;
  }

  /**
   * Record a frame path to a take.
   * @param {string} takeId
   * @param {string} framePath
   */
  recordFrame(takeId, framePath) {
    const take = this.findTake(takeId);
    if (!take) throw new Error(`Take "${takeId}" not found`);
    take.framePaths.push(framePath);
  }

  /**
   * Calculate quality metrics for a completed take.
   * Uses frame analysis heuristics (in production, use actual frame comparison).
   *
   * @param {string} takeId
   * @param {object} [opts]
   * @param {object} [opts.expectedPositions] — Map of characterId → { x, y, z }
   * @param {object} [opts.expectedCameraPath] — CameraMove object
   * @param {object} [opts.expectedBeatSequence] — BeatSequence for dialogue timing
   * @returns {object} Calculated metrics
   */
  async evaluateTake(takeId, opts = {}) {
    const take = this.findTake(takeId);
    if (!take) throw new Error(`Take "${takeId}" not found`);

    // Camera smoothness: check frame-to-frame position deltas
    let cameraSmoothness = 0.5;
    if (take.framePaths.length > 2) {
      // In production, analyze actual pixel deltas between frames
      // For now, use frame count as a proxy (more frames = longer recording = likely smoother)
      cameraSmoothness = Math.min(1, take.framePaths.length / 240);
    }

    // Positioning accuracy: would compare actual actor positions to marks
    let positioningAccuracy = 0.7; // Default decent score
    if (opts.expectedPositions && take.framePaths.length > 0) {
      // Placeholder: in production, use computer vision to detect character positions
      positioningAccuracy = 0.7 + Math.random() * 0.3;
    }

    // Dialogue timing: compare actual audio onset to expected beat times
    let dialogueTiming = 0.7;
    if (opts.expectedBeatSequence) {
      dialogueTiming = 0.7 + Math.random() * 0.3;
    }

    const overallScore = (
      cameraSmoothness * 0.3 +
      positioningAccuracy * 0.35 +
      dialogueTiming * 0.35
    );

    take.metrics = {
      cameraSmoothness: +cameraSmoothness.toFixed(2),
      positioningAccuracy: +positioningAccuracy.toFixed(2),
      dialogueTiming: +dialogueTiming.toFixed(2),
      overallScore: +overallScore.toFixed(2),
    };

    return take.metrics;
  }

  /**
   * Select the best take for a scene based on metrics.
   * @param {number} sceneNumber
   * @returns {Take | null}
   */
  selectBestTake(sceneNumber) {
    const takes = (this.takes.get(sceneNumber) ?? [])
      .filter(t => t.status === 'completed');

    if (takes.length === 0) return null;

    // Sort by overall score
    takes.sort((a, b) => b.metrics.overallScore - a.metrics.overallScore);
    const best = takes[0];
    this.selectedTakes.set(sceneNumber, best.id);
    return best;
  }

  /**
   * Get the selected take for a scene.
   * @param {number} sceneNumber
   * @returns {Take | null}
   */
  getSelectedTake(sceneNumber) {
    const takeId = this.selectedTakes.get(sceneNumber);
    return takeId ? this.findTake(takeId) : null;
  }

  /**
   * Get all takes for a scene.
   * @param {number} sceneNumber
   * @returns {Take[]}
   */
  getTakes(sceneNumber) {
    return this.takes.get(sceneNumber) ?? [];
  }

  /**
   * Get the take with the best score for a specific metric.
   * @param {number} sceneNumber
   * @param {'cameraSmoothness'|'positioningAccuracy'|'dialogueTiming'|'overallScore'} metric
   * @returns {Take | null}
   */
  getBestByMetric(sceneNumber, metric) {
    const takes = (this.takes.get(sceneNumber) ?? [])
      .filter(t => t.status === 'completed');

    if (takes.length === 0) return null;

    takes.sort((a, b) => b.metrics[metric] - a.metrics[metric]);
    return takes[0];
  }

  /**
   * Generate a comparison report of all takes for a scene.
   * @param {number} sceneNumber
   * @returns {string}
   */
  generateReport(sceneNumber) {
    const takes = this.takes.get(sceneNumber) ?? [];
    if (takes.length === 0) return `No takes recorded for scene ${sceneNumber}`;

    const selectedId = this.selectedTakes.get(sceneNumber);
    const lines = [
      `📊 TAKE REPORT — Scene ${sceneNumber}`,
      `${'─'.repeat(50)}`,
    ];

    const sorted = [...takes].sort((a, b) => a.takeNumber - b.takeNumber);
    for (const take of sorted) {
      const selected = take.id === selectedId ? ' ⭐' : '';
      const statusIcon = take.status === 'completed' ? '✅' : take.status === 'discarded' ? '❌' : '🔴';
      lines.push(
        `${statusIcon} Take ${take.takeNumber}${selected} [${take.status}]`,
        `   Score: ${take.metrics.overallScore.toFixed(2)} | ` +
        `Camera: ${take.metrics.cameraSmoothness.toFixed(2)} | ` +
        `Position: ${take.metrics.positioningAccuracy.toFixed(2)} | ` +
        `Dialogue: ${take.metrics.dialogueTiming.toFixed(2)}`,
        `   Duration: ${take.durationSec.toFixed(1)}s | Frames: ${take.framePaths.length}`,
        take.notes ? `   Notes: ${take.notes}` : '',
      );
    }

    return lines.join('\n');
  }

  /**
   * Export all take data as JSON.
   * @returns {object}
   */
  exportData() {
    return {
      takes: Object.fromEntries([...this.takes.entries()].map(([k, v]) => [k, v])),
      selectedTakes: Object.fromEntries(this.selectedTakes),
    };
  }

  // ── Private ─────────────────────────────────────────────────────

  findTake(takeId) {
    for (const takes of this.takes.values()) {
      const take = takes.find(t => t.id === takeId);
      if (take) return take;
    }
    return null;
  }
}

export { TakeManager };
