/**
 * @module ai-director
 * AI Director — Real-time cinematic moment detection and camera direction.
 * Analyzes gameplay events to identify cinematic opportunities and suggest camera work.
 */

import { composeShot } from './composition.js';
import { orbitPath, dollyPath, cranePath } from './camera.js';

/**
 * @typedef {'action'|'dialogue'|'establishing'|'montage'|'dramatic'|'comedy'|'suspense'} SceneType
 * @typedef {'wide'|'medium'|'close-up'|'over-shoulder'|'low-angle'|'high-angle'|'crane'|'dolly'|'tracking'} ShotType
 */

/**
 * AI Director — detects cinematic moments and suggests camera work.
 */
export class AIDirector {
  /**
   * @param {object} options
   * @param {number} [options.analysisWindowMs=5000] — Time window for event analysis
   * @param {number} [options.minActionSequenceLength=3] — Min actions for sequence detection
   * @param {number} [options.dramaThreshold=2.0] — Velocity multiplier for dramatic moments
   * @param {number} [options.comedyDistance=5.0] — Max distance for comedy setups
   */
  constructor(options = {}) {
    this.analysisWindowMs = options.analysisWindowMs ?? 5000;
    this.minActionSequenceLength = options.minActionSequenceLength ?? 3;
    this.dramaThreshold = options.dramaThreshold ?? 2.0;
    this.comedyDistance = options.comedyDistance ?? 5.0;

    this.recentEvents = [];
    this.activeShotList = [];
    this.currentSceneType = null;
    this.lastCameraMove = null;
  }

  /**
   * Analyze replay events and identify cinematic moments.
   * @param {import('./replay.js').ReplayEvent[]} events
   * @returns {Promise<CinematicMoment[]>}
   */
  async analyze(events) {
    const moments = [];
    const windows = this._createAnalysisWindows(events);

    for (const window of windows) {
      const moment = await this._analyzeWindow(window);
      if (moment) {
        moments.push(moment);
      }
    }

    return this._rankMoments(moments);
  }

  /**
   * Suggest an optimal camera shot for a given moment.
   * @param {CinematicMoment} moment
   * @param {object} context — Additional context (player positions, environment)
   * @returns {SuggestedShot}
   */
  suggestShot(moment, context = {}) {
    const shotType = this._determineShotType(moment, context);
    const cameraPos = this._calculateCameraPosition(moment, context, shotType);
    const cameraMove = this._suggestCameraMovement(moment, shotType);

    return {
      type: shotType,
      cameraPosition: cameraPos,
      cameraMove: cameraMove,
      durationSec: this._estimateShotDuration(moment),
      transition: this._suggestTransition(moment),
      reasoning: this._explainShotChoice(moment, shotType, context),
    };
  }

  /**
   * Build a complete shot list from a set of moments.
   * @param {CinematicMoment[]} moments
   * @param {object} context
   * @returns {Shot[]}
   */
  buildShotList(moments, context = {}) {
    return moments.map((moment, index) => {
      const shot = this.suggestShot(moment, context);
      const prevShot = index > 0 ? this.activeShotList[index - 1] : null;

      return {
        shotNumber: index + 1,
        ...shot,
        sceneType: moment.sceneType,
        startTimeMs: moment.startTime,
        endTimeMs: moment.endTime,
        intensity: moment.intensity,
        participants: moment.participants,
        transition: prevShot ? this._optimizeTransition(prevShot, shot) : shot.transition,
      };
    });
  }

  /**
   * Detect the scene type from current events.
   * @param {import('./replay.js').ReplayEvent[]} recentEvents
   * @returns {SceneType}
   */
  detectSceneType(recentEvents) {
    const actionEvents = recentEvents.filter(e => e.type === 'action');
    const chatEvents = recentEvents.filter(e => e.type === 'chat');
    const blockEvents = recentEvents.filter(e => e.type === 'block');

    // Action scene: frequent actions, high movement
    if (actionEvents.length >= 5) {
      const avgVelocity = this._calculateAverageVelocity(recentEvents);
      if (avgVelocity > this.dramaThreshold) {
        return 'action';
      }
    }

    // Dialogue scene: multiple chat messages close together
    if (chatEvents.length >= 3) {
      return 'dialogue';
    }

    // Comedy: players close together with chat
    if (chatEvents.length > 0 && this._detectProximityComedy(recentEvents)) {
      return 'comedy';
    }

    // Suspense: slow movements with occasional actions
    if (actionEvents.length > 0 && actionEvents.length < 3) {
      return 'suspense';
    }

    // Montage: varied event types over time
    const eventTypes = new Set(recentEvents.map(e => e.type));
    if (eventTypes.size >= 3) {
      return 'montage';
    }

    // Default: establishing shot at start
    if (recentEvents.length > 0 && recentEvents[0].timestamp < 2000) {
      return 'establishing';
    }

    return 'dramatic';
  }

  /**
   * Check if an auto-triggered camera movement is warranted.
   * @param {import('./replay.js').ReplayEvent} event
   * @returns {boolean}
   */
  shouldAutoTriggerCamera(event) {
    // Auto-trigger on high-intensity actions
    if (event.type === 'action') {
      const intenseActions = ['jump', 'attack', 'fall_damage', 'explosion'];
      if (intenseActions.includes(event.data.action)) {
        return true;
      }
    }

    // Auto-trigger on rapid position changes
    if (event.type === 'position') {
      const velocity = event.data.velocity;
      if (velocity && this._calculateSpeed(velocity) > this.dramaThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate an auto-triggered camera move for an event.
   * @param {import('./replay.js').ReplayEvent} event
   * @param {object} context
   * @returns {import('./camera.js').CameraMove}
   */
  generateAutoCameraMove(event, context = {}) {
    const position = event.data;
    const center = { x: position.x, y: position.y, z: position.z };

    // Choose movement based on event intensity
    const intensity = this._calculateEventIntensity(event);

    if (intensity > 0.8) {
      // High intensity: dramatic crane or fast orbit
      return cranePath(
        { ...center, y: center.y + 5 },
        3,
        2,
        center,
        'easeInOut'
      );
    } else if (intensity > 0.5) {
      // Medium intensity: smooth dolly
      return dollyPath(
        { ...center, x: center.x - 10, z: center.z - 10 },
        center,
        1.5,
        center,
        'easeOut'
      );
    } else {
      // Low intensity: gentle orbit
      return orbitPath(center, 8, 2, 3, 0, 90, 'linear');
    }
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  /**
   * Create sliding time windows for analysis.
   * @private
   */
  _createAnalysisWindows(events) {
    if (events.length === 0) return [];

    const windows = [];
    const windowSize = this.analysisWindowMs;
    const slideSize = Math.floor(windowSize / 2);

    let startIdx = 0;
    while (startIdx < events.length) {
      const startTime = events[startIdx].timestamp;
      const windowEvents = events.filter(e =>
        e.timestamp >= startTime && e.timestamp < startTime + windowSize
      );

      if (windowEvents.length > 0) {
        windows.push({
          startTime,
          endTime: startTime + windowSize,
          events: windowEvents,
        });
      }

      startIdx = events.findIndex(e =>
        e.timestamp >= startTime + slideSize
      );
      if (startIdx === -1) break;
    }

    return windows;
  }

  /**
   * Analyze a single time window for cinematic potential.
   * @private
   */
  async _analyzeWindow(window) {
    const events = window.events;
    if (events.length === 0) return null;

    const sceneType = this.detectSceneType(events);
    const intensity = this._calculateWindowIntensity(events);
    const participants = this._extractParticipants(events);

    // Skip low-intensity windows unless they have dialogue
    if (intensity < 0.3 && sceneType !== 'dialogue') {
      return null;
    }

    return {
      startTime: window.startTime,
      endTime: window.endTime,
      sceneType,
      intensity,
      participants,
      keyEvents: this._identifyKeyEvents(events),
      description: this._describeMoment(events, sceneType, intensity),
    };
  }

  /**
   * Calculate the cinematic intensity of a window.
   * @private
   */
  _calculateWindowIntensity(events) {
    let score = 0;

    for (const event of events) {
      score += this._calculateEventIntensity(event);
    }

    // Normalize by event count
    return Math.min(score / Math.max(events.length, 1), 1.0);
  }

  /**
   * Calculate intensity of a single event.
   * @private
   */
  _calculateEventIntensity(event) {
    switch (event.type) {
      case 'action':
        const intenseActions = {
          attack: 0.8,
          explosion: 1.0,
          death: 0.9,
          jump: 0.3,
          fall_damage: 0.7,
        };
        return intenseActions[event.data.action] ?? 0.4;

      case 'position':
        if (event.data.velocity) {
          const speed = this._calculateSpeed(event.data.velocity);
          return Math.min(speed / this.dramaThreshold, 1.0);
        }
        return 0.1;

      case 'chat':
        // Detect emotional keywords
        const message = event.data.message?.toLowerCase() ?? '';
        const emotionalWords = ['!', '?', 'wow', 'omg', 'no', 'yes', 'help'];
        const hasEmotion = emotionalWords.some(word => message.includes(word));
        return hasEmotion ? 0.5 : 0.2;

      case 'block':
        // Building is moderately interesting
        return 0.3;

      default:
        return 0.1;
    }
  }

  /**
   * Extract unique participant IDs from events.
   * @private
   */
  _extractParticipants(events) {
    const participants = new Set();

    for (const event of events) {
      if (event.data.playerId) {
        participants.add(event.data.playerId);
      }
      if (event.data.playerName) {
        participants.add(event.data.playerName);
      }
    }

    return Array.from(participants);
  }

  /**
   * Identify key events that define the moment.
   * @private
   */
  _identifyKeyEvents(events) {
    // Sort by intensity and return top events
    return events
      .map(e => ({ event: e, intensity: this._calculateEventIntensity(e) }))
      .filter(item => item.intensity > 0.5)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3)
      .map(item => item.event);
  }

  /**
   * Generate a human-readable description of the moment.
   * @private
   */
  _describeMoment(events, sceneType, intensity) {
    const actionCount = events.filter(e => e.type === 'action').length;
    const chatCount = events.filter(e => e.type === 'chat').length;
    const participants = this._extractParticipants(events).length;

    const intensityLabel = intensity > 0.7 ? 'intense' :
                          intensity > 0.4 ? 'moderate' : 'subtle';

    const descriptors = {
      action: `${intensityLabel} action sequence`,
      dialogue: `${participants} players in conversation`,
      establishing: 'establishing shot',
      montage: 'montage sequence',
      dramatic: `${intensityLabel} dramatic moment`,
      comedy: 'comedy setup',
      suspense: 'suspenseful moment',
    };

    return descriptors[sceneType] ?? 'cinematic moment';
  }

  /**
   * Calculate average velocity from position events.
   * @private
   */
  _calculateAverageVelocity(events) {
    const posEvents = events.filter(e => e.type === 'position' && e.data.velocity);
    if (posEvents.length === 0) return 0;

    const totalSpeed = posEvents.reduce((sum, e) =>
      sum + this._calculateSpeed(e.data.velocity), 0
    );

    return totalSpeed / posEvents.length;
  }

  /**
   * Calculate speed from velocity vector.
   * @private
   */
  _calculateSpeed(velocity) {
    if (!velocity) return 0;
    return Math.sqrt(
      (velocity.x ?? 0) ** 2 +
      (velocity.y ?? 0) ** 2 +
      (velocity.z ?? 0) ** 2
    );
  }

  /**
   * Detect comedy based on player proximity.
   * @private
   */
  _detectProximityComedy(events) {
    const positions = events.filter(e => e.type === 'position');

    for (let i = 0; i < positions.length - 1; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i].data;
        const p2 = positions[j].data;

        const dist = Math.sqrt(
          (p1.x - p2.x) ** 2 +
          (p1.y - p2.y) ** 2 +
          (p1.z - p2.z) ** 2
        );

        if (dist < this.comedyDistance) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Rank moments by cinematic potential.
   * @private
   */
  _rankMoments(moments) {
    // Score by intensity, participant count, and key events
    return moments
      .map(m => ({
        ...m,
        score: m.intensity * 0.6 +
               Math.min(m.participants.length * 0.2, 0.3) +
               Math.min(m.keyEvents.length * 0.1, 0.1),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Determine optimal shot type for a moment.
   * @private
   */
  _determineShotType(moment, context) {
    const shotMap = {
      action: ['close-up', 'tracking', 'low-angle'],
      dialogue: ['over-shoulder', 'medium', 'close-up'],
      establishing: ['wide', 'crane'],
      montage: ['medium', 'wide'],
      dramatic: ['close-up', 'dolly', 'crane'],
      comedy: ['wide', 'medium'],
      suspense: ['close-up', 'high-angle'],
    };

    const candidates = shotMap[moment.sceneType] ?? ['medium'];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Calculate camera position using composition engine.
   * @private
   */
  _calculateCameraPosition(moment, context, shotType) {
    // Use composition engine if we have subject positions
    if (context.subjectPosition) {
      const composition = composeShot({
        subjectPosition: context.subjectPosition,
        subjectSize: context.subjectSize ?? 1.8,
        shotType: shotType,
        environment: context.environment ?? 'outdoor',
        mood: moment.sceneType,
      });

      return composition.camera;
    }

    // Fallback: default positioning based on shot type
    const defaults = {
      'wide': { distance: 15, height: 5 },
      'medium': { distance: 8, height: 2 },
      'close-up': { distance: 4, height: 1.5 },
      'over-shoulder': { distance: 3, height: 1.7 },
      'low-angle': { distance: 6, height: 0.5 },
      'high-angle': { distance: 10, height: 10 },
      'crane': { distance: 12, height: 8 },
      'dolly': { distance: 10, height: 3 },
      'tracking': { distance: 5, height: 2 },
    };

    const config = defaults[shotType] ?? defaults['medium'];
    return {
      x: (context.center?.x ?? 0) + config.distance,
      y: (context.center?.y ?? 0) + config.height,
      z: (context.center?.z ?? 0),
    };
  }

  /**
   * Suggest camera movement for the shot.
   * @private
   */
  _suggestCameraMovement(moment, shotType) {
    const movementMap = {
      'wide': 'static',
      'medium': 'static',
      'close-up': 'static',
      'over-shoulder': 'slow_follow',
      'low-angle': 'orbit',
      'high-angle': 'crane_drop',
      'crane': 'crane_rise',
      'dolly': 'dolly_in',
      'tracking': 'tracking',
    };

    return movementMap[shotType] ?? 'static';
  }

  /**
   * Estimate how long this shot should last.
   * @private
   */
  _estimateShotDuration(moment) {
    const baseDuration = 3; // seconds

    const multipliers = {
      action: 0.8,
      dialogue: 1.5,
      establishing: 2.0,
      montage: 1.0,
      dramatic: 1.2,
      comedy: 1.3,
      suspense: 1.4,
    };

    const multiplier = multipliers[moment.sceneType] ?? 1.0;
    return baseDuration * multiplier;
  }

  /**
   * Suggest transition to next shot.
   * @private
   */
  _suggestTransition(moment) {
    const transitions = {
      action: 'cut',
      dialogue: 'cut',
      establishing: 'fade',
      montage: 'dissolve',
      dramatic: 'fade',
      comedy: 'cut',
      suspense: 'dissolve',
    };

    return transitions[moment.sceneType] ?? 'cut';
  }

  /**
   * Explain why this shot was chosen.
   * @private
   */
  _explainShotChoice(moment, shotType, context) {
    return `${shotType} shot chosen for ${moment.sceneType} scene with ${moment.participants.length} participant(s). Intensity: ${(moment.intensity * 100).toFixed(0)}%.`;
  }

  /**
   * Optimize transition between consecutive shots.
   * @private
   */
  _optimizeTransition(prevShot, currentShot) {
    // Don't use same transition twice
    if (prevShot.transition === currentShot.transition) {
      const alternatives = {
        cut: ['fade', 'dissolve'],
        fade: ['cut', 'dissolve'],
        dissolve: ['cut', 'fade'],
      };
      const alts = alternatives[currentShot.transition] ?? ['cut'];
      return alts[Math.floor(Math.random() * alts.length)];
    }

    return currentShot.transition;
  }
}

/**
 * @typedef {object} CinematicMoment
 * @property {number} startTime
 * @property {number} endTime
 * @property {SceneType} sceneType
 * @property {number} intensity — [0, 1]
 * @property {string[]} participants
 * @property {import('./replay.js').ReplayEvent[]} keyEvents
 * @property {string} description
 * @property {number} [score] — Cinematic potential score
 */

/**
 * @typedef {object} SuggestedShot
 * @property {ShotType} type
 * @property {object} cameraPosition — { x, y, z }
 * @property {string} cameraMove — Movement type
 * @property {number} durationSec
 * @property {string} transition
 * @property {string} reasoning
 */

/**
 * @typedef {object} Shot
 * @property {number} shotNumber
 * @property {ShotType} type
 * @property {object} cameraPosition
 * @property {string} cameraMove
 * @property {number} durationSec
 * @property {string} transition
 * @property {SceneType} sceneType
 * @property {number} startTimeMs
 * @property {number} endTimeMs
 * @property {number} intensity
 * @property {string[]} participants
 * @property {string} reasoning
 */

/**
 * Create a new AI Director instance.
 * @param {object} [options]
 * @returns {AIDirector}
 */
export function createAIDirector(options) {
  return new AIDirector(options);
}
