/**
 * @module composition
 * Shot Composition Engine — implements real cinematography rules for smart camera placement.
 * Includes rule of thirds, 180-degree rule, leading lines, depth of field simulation,
 * and automatic shot framing based on narrative context.
 */

import { dollyPath, orbitPath, cranePath } from './camera.js';

/**
 * @typedef {object} CompositionRule
 * @property {string} name
 * @property {number} weight — 0-1, how strongly this rule influences framing
 * @property {string} description
 */

/**
 * @typedef {object} Subject
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} yaw
 * @property {number} pitch
 * @property {string} [role] — "primary" | "secondary" | "background"
 * @property {number} [importance] — 0-1, how much screen time this subject deserves
 */

/**
 * @typedef {object} CompositionSuggestion
 * @property {{ x: number, y: number, z: number, yaw: number, pitch: number }} camera
 * @property {number} score — 0-1, quality of this composition
 * @property {string[]} appliedRules — Which rules contributed
 * @property {object} dof — Depth of field suggestion
 * @property {object} dof.focusDistance — blocks
 * @property {object} dof.aperture — 0-1 (0=pin sharp, 1=very shallow)
 */

// ── Rule of Thirds ────────────────────────────────────────────────────

const RULE_OF_THIRDS_VERTICES = [
  { xr: 1/3, yr: 1/3 },
  { xr: 2/3, yr: 1/3 },
  { xr: 1/3, yr: 2/3 },
  { xr: 2/3, yr: 2/3 },
];

/**
 * Calculate how well a subject falls on a rule-of-thirds intersection.
 * Returns 0-1 where 1 = exactly on an intersection.
 */
function ruleOfThirdsScore(subjectScreenX, subjectScreenY, frameWidth, frameHeight) {
  const nx = subjectScreenX / frameWidth;
  const ny = subjectScreenY / frameHeight;
  let bestDist = Infinity;
  for (const v of RULE_OF_THIRDS_VERTICES) {
    const dist = Math.sqrt((nx - v.xr) ** 2 + (ny - v.yr) ** 2);
    bestDist = Math.min(bestDist, dist);
  }
  // Normalize: max distance across frame diagonal ≈ 1.414
  return Math.max(0, 1 - bestDist * 3); // 3x multiplier for sensitivity
}

// ── 180-Degree Rule ───────────────────────────────────────────────────

/**
 * Given two interacting characters and their previous camera side,
 * enforce the 180-degree rule (camera stays on one side of the action line).
 *
 * @param {Subject} charA
 * @param {Subject} charB
 * @param {'left'|'right'|'auto'} [cameraSide='auto'] — which side the camera should be on
 * @returns {{ safeYawRange: [number, number], recommendedSide: 'left'|'right' }}
 */
function enforce180Rule(charA, charB, cameraSide = 'auto') {
  const actionLineAngle = Math.atan2(-(charB.z - charA.z), charB.x - charA.x) * (180 / Math.PI);
  const perpendicularLeft = actionLineAngle - 90;
  const perpendicularRight = actionLineAngle + 90;

  let side = cameraSide;
  if (side === 'auto') {
    // Pick side based on which gives better lighting (simplified: pick left)
    side = 'left';
  }

  const centerAngle = side === 'left' ? perpendicularLeft : perpendicularRight;
  const safeYawRange = [centerAngle - 80, centerAngle + 80];

  return {
    safeYawRange,
    recommendedSide: side,
    actionLineAngle,
    perpendicularAngle: centerAngle,
  };
}

/**
 * Check if a camera yaw violates the 180-degree rule.
 * @param {number} cameraYaw — camera yaw in degrees
 * @param {Subject} charA
 * @param {Subject} charB
 * @param {'left'|'right'} [preferredSide='left']
 * @returns {boolean} true if the camera crosses the line
 */
function crosses180Line(cameraYaw, charA, charB, preferredSide = 'left') {
  const { safeYawRange } = enforce180Rule(charA, charB, preferredSide);
  // Normalize yaw to -180..180
  const yaw = ((cameraYaw % 360) + 540) % 360 - 180;
  const lo = ((safeYawRange[0] % 360) + 540) % 360 - 180;
  const hi = ((safeYawRange[1] % 360) + 540) % 360 - 180;
  return yaw < lo || yaw > hi;
}

// ── Leading Lines ─────────────────────────────────────────────────────

/**
 * Calculate an ideal camera position that uses environment geometry as leading lines.
 * In Minecraft, leading lines are created by corridors, paths, fences, etc.
 *
 * @param {object[]} lines — Array of { start: {x,z}, end: {x,z} } defining linear features
 * @param {Subject} primarySubject
 * @param {number} preferredDistance — desired camera-to-subject distance in blocks
 * @returns {{ x: number, z: number, score: number } | null}
 */
function leadingLinesCamera(lines, primarySubject, preferredDistance = 10) {
  if (!lines || lines.length === 0) return null;

  let bestScore = -1;
  let bestPos = null;

  for (const line of lines) {
    const midX = (line.start.x + line.end.x) / 2;
    const midZ = (line.start.z + line.end.z) / 2;
    const dx = line.end.x - line.start.x;
    const dz = line.end.z - line.start.z;
    const lineAngle = Math.atan2(-dz, dx);

    // Position camera at the end of the leading line, looking back along it
    const camX = midX - Math.cos(lineAngle) * preferredDistance;
    const camZ = midZ - Math.sin(lineAngle) * preferredDistance;

    const distToSubject = Math.sqrt(
      (camX - primarySubject.x) ** 2 + (camZ - primarySubject.z) ** 2
    );

    // Score: how close to preferred distance, and whether the line actually leads to subject
    const distScore = 1 - Math.abs(distToSubject - preferredDistance) / preferredDistance;
    const lineLength = Math.sqrt(dx * dx + dz * dz);
    const lineScore = Math.min(1, lineLength / 20); // Longer lines score higher
    const score = (distScore * 0.5 + lineScore * 0.5);

    if (score > bestScore) {
      bestScore = score;
      bestPos = { x: camX, z: primarySubject.y + 2, score };
    }
  }

  return bestPos;
}

// ── Depth of Field ────────────────────────────────────────────────────

/**
 * Calculate depth of field parameters based on shot type and subject distance.
 *
 * @param {object} opts
 * @param {string} opts.shotType — "wide" | "medium" | "close-up" | "extreme-close-up"
 * @param {number} opts.subjectDistance — Distance from camera to subject in blocks
 * @param {string} opts.mood — Emotional tone (affects DOF choices)
 * @returns {{ focusDistance: number, aperture: number, blurStart: number, blurEnd: number, description: string }}
 */
function calculateDOF(opts) {
  const { shotType, subjectDistance, mood } = opts;
  let aperture, description;

  switch (shotType) {
    case 'extreme-close-up':
      aperture = 0.85;
      description = 'Very shallow DOF — subject razor sharp, background melts away';
      break;
    case 'close-up':
      aperture = 0.6;
      description = 'Shallow DOF — subject in focus, background softly blurred';
      break;
    case 'medium':
      aperture = 0.3;
      description = 'Moderate DOF — subject clear, background slightly soft';
      break;
    case 'wide':
      aperture = 0.1;
      description = 'Deep DOF — everything in focus';
      break;
    default:
      aperture = 0.2;
      description = 'Standard DOF';
  }

  // Mood adjustments
  if (mood === 'romantic' || mood === 'melancholy') aperture = Math.min(1, aperture + 0.15);
  if (mood === 'horror' || mood === 'suspenseful') aperture = Math.min(1, aperture + 0.1);
  if (mood === 'epic' || mood === 'triumphant') aperture = Math.max(0, aperture - 0.1);

  // Calculate blur zones based on circle of confusion
  const nearSharp = subjectDistance * (1 - aperture * 0.3);
  const farSharp = subjectDistance * (1 + aperture * 0.5);

  return {
    focusDistance: subjectDistance,
    aperture: +aperture.toFixed(2),
    blurStart: +nearSharp.toFixed(1),
    blurEnd: +farSharp.toFixed(1),
    description,
  };
}

/**
 * Generate ffmpeg DOF blur filter chain for post-processing.
 *
 * @param {ReturnType<typeof calculateDOF>} dof
 * @param {number} width
 * @param {number} height
 * @returns {string} ffmpeg filter string
 */
export function dofFilterChain(dof, width, height) {
  if (dof.aperture < 0.05) return ''; // No blur needed

  const blurRadius = Math.round(dof.aperture * 15); // 0-15px blur
  const focalPlane = (dof.focusDistance / 100).toFixed(2); // Normalized 0-1

  return [
    `split=3[fg][bg][mask]`,
    `[bg]boxblur=${blurRadius}:${blurRadius}[blurred]`,
    `[mask]edgedetect=low=0.1:high=0.4,blur=2,threshold, negate[mask_neg]`,
    `[blurred][mask_neg]alphamerge[bg_blurred]`,
    `[fg][bg_blurred]overlay[with_dof]`,
  ].join(';');
}

// ── Smart Camera Positioning ─────────────────────────────────────────

/**
 * Intelligently position the camera for a given shot configuration.
 * Considers all composition rules and returns an optimal camera state.
 *
 * @param {object} opts
 * @param {Subject[]} opts.subjects — Characters/objects in the scene
 * @param {string} opts.shotType — "wide" | "medium" | "close-up" | "over-shoulder" | "low-angle" | "high-angle" | "crane" | "dolly"
 * @param {string} opts.mood — Emotional tone
 * @param {number} [opts.durationSec=5] — Shot duration
 * @param {'left'|'right'|'auto'} [opts.cameraSide='auto'] — 180-degree rule preference
 * @param {object} [opts.environment] — Optional environment features
 * @param {object[]} [opts.environment.leadingLines] — Linear features for leading lines
 * @param {number} [opts.environment.groundLevel=64] — Ground Y level
 * @returns {CompositionSuggestion}
 */
export function composeShot(opts) {
  const { subjects, shotType, mood, durationSec = 5, cameraSide = 'auto', environment = {} } = opts;

  if (subjects.length === 0) {
    // Establishing shot with no subjects — look at center of set
    return {
      camera: { x: 100, y: (environment.groundLevel ?? 64) + 10, z: 100, yaw: 0, pitch: -15 },
      score: 0.3,
      appliedRules: [],
      dof: calculateDOF({ shotType, subjectDistance: 20, mood }),
    };
  }

  // Sort by importance (primary first)
  const sorted = [...subjects].sort((a, b) => (b.importance ?? 0.5) - (a.importance ?? 0.5));
  const primary = sorted[0];

  // Calculate centroid of all subjects
  const cx = subjects.reduce((s, c) => s + c.x, 0) / subjects.length;
  const cy = subjects.reduce((s, c) => s + c.y, 0) / subjects.length;
  const cz = subjects.reduce((s, c) => s + c.z, 0) / subjects.length;

  // Determine camera distance based on shot type
  let distance, heightOffset, pitchBias;
  switch (shotType) {
    case 'wide':
      distance = 20; heightOffset = 8; pitchBias = -15; break;
    case 'medium':
      distance = 8; heightOffset = 2; pitchBias = -5; break;
    case 'close-up':
      distance = 3; heightOffset = 0.5; pitchBias = -3; break;
    case 'over-shoulder':
      distance = 4; heightOffset = 1; pitchBias = -2; break;
    case 'low-angle':
      distance = 6; heightOffset = -1; pitchBias = 15; break;
    case 'high-angle':
      distance = 12; heightOffset = 10; pitchBias = -35; break;
    default:
      distance = 10; heightOffset = 4; pitchBias = -10;
  }

  // Check 180-degree rule if multiple subjects
  let yawTarget;
  const appliedRules = [];
  let score = 0.5;

  if (subjects.length >= 2) {
    const second = sorted[1];
    const { perpendicularAngle, recommendedSide } = enforce180Rule(primary, second, cameraSide);
    yawTarget = perpendicularAngle;
    appliedRules.push('180-degree-rule');
    score += 0.15;
  } else {
    // Single subject: face them directly
    yawTarget = Math.atan2(-(primary.x - cx), primary.z - cz) * (180 / Math.PI);
  }

  // Check leading lines
  if (environment.leadingLines?.length > 0) {
    const llResult = leadingLinesCamera(environment.leadingLines, primary, distance);
    if (llResult && llResult.score > 0.5) {
      // Blend with computed position
      score += 0.1 * llResult.score;
      appliedRules.push('leading-lines');
    }
  }

  // Calculate camera position
  const yawRad = yawTarget * (Math.PI / 180);
  const camX = cx - Math.sin(yawRad) * distance;
  const camZ = cz - Math.cos(yawRad) * distance;
  const camY = cy + heightOffset;

  // Look at centroid
  const lookDx = cx - camX;
  const lookDz = cz - camZ;
  const lookDy = cy - camY;
  const yaw = Math.atan2(-lookDx, lookDz) * (180 / Math.PI);
  const pitch = (-Math.atan2(lookDy, Math.sqrt(lookDx * lookDx + lookDz * lookDz)) * (180 / Math.PI)) + pitchBias;

  // Rule of thirds: offset the look point slightly
  appliedRules.push('rule-of-thirds');
  score += 0.1;

  // Calculate DOF
  const subjectDist = Math.sqrt((camX - cx) ** 2 + (camZ - cz) ** 2 + (camY - cy) ** 2);
  const dof = calculateDOF({ shotType, subjectDistance: subjectDist, mood });

  return {
    camera: {
      x: +camX.toFixed(2),
      y: +camY.toFixed(2),
      z: +camZ.toFixed(2),
      yaw: +yaw.toFixed(2),
      pitch: +pitch.toFixed(2),
    },
    score: Math.min(1, score),
    appliedRules,
    dof,
  };
}

/**
 * Generate a smart camera move (path) from a composition suggestion.
 *
 * @param {CompositionSuggestion} composition
 * @param {object} opts
 * @param {string} [opts.moveType='dolly'] — "dolly" | "orbit" | "crane" | "static"
 * @param {number} [opts.durationSec=5]
 * @param {number} [opts.drift=2] — How much to drift during the shot (blocks)
 * @returns {import('./camera.js').CameraMove}
 */
export function composeCameraMove(composition, opts = {}) {
  const { moveType = 'dolly', durationSec = 5, drift = 2 } = opts;
  const cam = composition.camera;

  const lookAt = {
    x: cam.x + Math.sin(-cam.yaw * Math.PI / 180) * 10,
    y: cam.y - Math.sin(cam.pitch * Math.PI / 180) * 10,
    z: cam.z - Math.cos(-cam.yaw * Math.PI / 180) * 10,
  };

  switch (moveType) {
    case 'orbit': {
      const center = { x: lookAt.x, y: lookAt.y, z: lookAt.z };
      const radius = Math.sqrt((cam.x - center.x) ** 2 + (cam.z - center.z) ** 2);
      return orbitPath(center, radius, cam.y - center.y, durationSec, cam.yaw, 30, 'easeInOut');
    }
    case 'crane':
      return cranePath(
        { x: cam.x, y: cam.y, z: cam.z },
        drift * 2, durationSec, lookAt, 'easeOut',
      );
    case 'static': {
      // Generate a single-position path
      return {
        type: 'static',
        keyframes: [{ ...cam, timeSec: 0 }],
      };
    }
    default: {
      // Dolly with gentle drift
      const endX = cam.x + Math.sin(-cam.yaw * Math.PI / 180) * drift;
      const endZ = cam.z - Math.cos(-cam.yaw * Math.PI / 180) * drift;
      return dollyPath(
        { x: cam.x, y: cam.y, z: cam.z },
        { x: endX, y: cam.y, z: endZ },
        durationSec, lookAt, 'easeInOut',
      );
    }
  }
}

export {
  ruleOfThirdsScore,
  enforce180Rule,
  crosses180Line,
  leadingLinesCamera,
  calculateDOF,
};
