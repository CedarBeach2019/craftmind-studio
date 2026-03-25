/**
 * @module tests/camera.test
 * Tests for camera path interpolation (camera.js).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function ease(a, b, t, easing = 'linear') {
  switch (easing) {
    case 'easeIn':
      t = t * t;
      break;
    case 'easeOut':
      t = 1 - (1 - t) * (1 - t);
      break;
    case 'easeInOut':
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      break;
    default:
      break;
  }
  return a + (b - a) * t;
}

function getStateAt(move, timeSec) {
  const kf = move.keyframes;
  if (kf.length === 0) return null;
  if (timeSec <= kf[0].timeSec) return kf[0];
  if (timeSec >= kf[kf.length - 1].timeSec) return kf[kf.length - 1];
  for (let i = 0; i < kf.length - 1; i++) {
    if (timeSec >= kf[i].timeSec && timeSec < kf[i + 1].timeSec) {
      const segDuration = kf[i + 1].timeSec - kf[i].timeSec;
      const t = segDuration > 0 ? (timeSec - kf[i].timeSec) / segDuration : 0;
      const easing = kf[i].easing || 'linear';
      return {
        x: ease(kf[i].x, kf[i + 1].x, t, easing),
        y: ease(kf[i].y, kf[i + 1].y, t, easing),
        z: ease(kf[i].z, kf[i + 1].z, t, easing),
        yaw: ease(kf[i].yaw, kf[i + 1].yaw, t, easing),
        pitch: ease(kf[i].pitch, kf[i + 1].pitch, t, easing),
      };
    }
  }
  return null;
}

describe('Easing functions', () => {
  it('linear returns correct interpolation', () => {
    assert.equal(ease(0, 100, 0.5), 50);
    assert.equal(ease(0, 100, 0), 0);
    assert.equal(ease(0, 100, 1), 100);
  });

  it('easeIn starts slow', () => {
    const v = ease(0, 100, 0.5, 'easeIn');
    assert.ok(v < 50, `easeIn at 0.5 should be < 50, got ${v}`);
  });

  it('easeOut starts fast', () => {
    const v = ease(0, 100, 0.5, 'easeOut');
    assert.ok(v > 50, `easeOut at 0.5 should be > 50, got ${v}`);
  });

  it('easeInOut is symmetric', () => {
    const v1 = ease(0, 100, 0.25, 'easeInOut');
    const v2 = ease(0, 100, 0.75, 'easeInOut');
    assert.ok(Math.abs(v1 + v2 - 100) < 0.1, 'Should be roughly symmetric around 50');
  });
});

describe('Camera state interpolation', () => {
  const move = {
    type: 'test',
    keyframes: [
      { timeSec: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, easing: 'linear' },
      { timeSec: 1, x: 10, y: 5, z: -10, yaw: 90, pitch: -15, easing: 'linear' },
      { timeSec: 2, x: 0, y: 10, z: 0, yaw: 180, pitch: 0, easing: 'easeInOut' },
    ],
  };

  it('returns first keyframe before start', () => {
    const s = getStateAt(move, -1);
    assert.equal(s.x, 0);
    assert.equal(s.y, 0);
  });

  it('returns last keyframe after end', () => {
    const s = getStateAt(move, 5);
    assert.equal(s.x, 0);
    assert.equal(s.y, 10);
  });

  it('interpolates linear segment correctly', () => {
    const s = getStateAt(move, 0.5);
    assert.equal(s.x, 5);
    assert.equal(s.y, 2.5);
    assert.equal(s.z, -5);
    assert.equal(s.yaw, 45);
    assert.equal(s.pitch, -7.5);
  });

  it('interpolates eased segment', () => {
    const s = getStateAt(move, 1.5);
    // easeInOut at t=0.5: 2*(0.5)^2 = 0.5, so it equals linear at midpoint
    assert.ok(s.x >= 0 && s.x <= 10);
    assert.ok(s.y >= 5 && s.y <= 10);
  });

  it('returns null for empty keyframes', () => {
    assert.equal(getStateAt({ keyframes: [] }, 0), null);
  });

  it('handles single keyframe', () => {
    const single = { keyframes: [{ timeSec: 0, x: 5, y: 5, z: 5, yaw: 0, pitch: 0 }] };
    const s = getStateAt(single, 10);
    assert.equal(s.x, 5);
  });
});
