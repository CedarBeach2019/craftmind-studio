#!/usr/bin/env node
/**
 * @example custom-camera.js
 * Demonstrates ALL camera movement types with visual output.
 *
 * Usage:
 *   node examples/custom-camera.js
 *
 * Shows orbit, dolly, crane, and custom interpolated paths.
 */

import { orbitPath, dollyPath, cranePath, getStateAt } from '../src/index.js';

// ── Helper: Print path summary ───────────────────────────────────────

function printPathSummary(name, move) {
  const kf = move.keyframes;
  const start = kf[0];
  const end = kf[kf.length - 1];
  const midTime = (start.timeSec + end.timeSec) / 2;
  const mid = getStateAt(move, midTime);

  console.log(`\n📷 ${name}`);
  console.log(`   Type: ${move.type}`);
  console.log(`   Duration: ${end.timeSec}s`);
  console.log(`   Keyframes: ${kf.length}`);
  console.log(`   START: pos=(${start.x}, ${start.y}, ${start.z}) look=(yaw:${start.yaw}° pitch:${start.pitch}°)`);
  console.log(`   MID:   pos=(${mid.x.toFixed(1)}, ${mid.y.toFixed(1)}, ${mid.z.toFixed(1)}) look=(yaw:${mid.yaw.toFixed(1)}° pitch:${mid.pitch.toFixed(1)}°)`);
  console.log(`   END:   pos=(${end.x}, ${end.y}, ${end.z}) look=(yaw:${end.yaw}° pitch:${end.pitch}°)`);
}

// ── Center point for our "set" ────────────────────────────────────────

const SET_CENTER = { x: 100, y: 65, z: 100 };

// ── 1. Full 360° Orbit ───────────────────────────────────────────────

printPathSummary('Full 360° Orbit (slow)', orbitPath(
  SET_CENTER,    // center
  15,            // radius
  8,             // height offset
  10,            // 10 second duration
  0,             // start at 0°
  360,           // full circle
  'linear',      // constant speed
));

// ── 2. Half Orbit with Ease-In-Out ───────────────────────────────────

printPathSummary('Half Orbit (ease-in-out)', orbitPath(
  SET_CENTER,
  12,
  6,
  6,
  90,            // start facing south
  180,           // half circle
  'easeInOut',
));

// ── 3. Low Angle Orbit ───────────────────────────────────────────────

printPathSummary('Low Angle Orbit (dramatic)', orbitPath(
  SET_CENTER,
  10,
  1,             // barely above ground
  8,
  0,
  180,
  'easeOut',     // starts fast, slows down
));

// ── 4. Dolly In (push toward subject) ────────────────────────────────

printPathSummary('Dolly In (push)', dollyPath(
  { x: 100, y: 66, z: 115 },    // far away
  { x: 100, y: 65.5, z: 102 },  // close up
  5,                             // 5 seconds
  SET_CENTER,                    // looking at center
  'easeInOut',
));

// ── 5. Dolly Out (pull back from subject) ────────────────────────────

printPathSummary('Dolly Out (pull)', dollyPath(
  { x: 100, y: 65.5, z: 102 },
  { x: 100, y: 67, z: 120 },
  5,
  SET_CENTER,
  'easeIn',        // starts slow, accelerates
));

// ── 6. Lateral Dolly (side tracking) ─────────────────────────────────

printPathSummary('Lateral Tracking Dolly', dollyPath(
  { x: 85, y: 66, z: 100 },
  { x: 115, y: 66, z: 100 },
  8,
  SET_CENTER,
  'linear',
));

// ── 7. Crane Up (ascending reveal) ───────────────────────────────────

printPathSummary('Crane Up (reveal)', cranePath(
  { x: 100, y: 63, z: 110 },     // ground level behind subject
  25,                              // rise 25 blocks
  6,
  SET_CENTER,
  'easeOut',
));

// ── 8. Crane Down (descending into scene) ────────────────────────────

printPathSummary('Crane Down (descend)', cranePath(
  { x: 100, y: 90, z: 100 },     // high up
  -25,                             // drop 25 blocks
  5,
  SET_CENTER,
  'easeIn',
));

// ── 9. Combined: Dolly + Crane ───────────────────────────────────────

printPathSummary('Dolly + Crane (complex)', dollyPath(
  { x: 85, y: 64, z: 115 },
  { x: 115, y: 80, z: 85 },
  8,
  SET_CENTER,
  'easeInOut',
));

// ── 10. High Angle Shot ──────────────────────────────────────────────

printPathSummary('High Angle (bird\'s eye descent)', cranePath(
  { x: 100, y: 95, z: 100 },     // very high
  -30,                             // drop to ground level
  7,
  SET_CENTER,
  'easeInOut',
));

console.log('\n🎬 All camera movements demonstrated!');
console.log('Each path can be attached to a Shot\'s cameraPath property');
console.log('and the renderer will follow the keyframes frame-by-frame.');
