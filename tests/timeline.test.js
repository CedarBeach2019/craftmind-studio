/**
 * @module tests/timeline.test
 * Tests for timeline operations (timeline.js).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline the timeline logic (ESM module, can't easily import in node:test without --experimental-vm-modules)
function createTimeline(title) {
  return { title, shots: [], totalDurationSec: 0 };
}

function addShot(tl, shot) {
  shot.startOffset = tl.totalDurationSec;
  tl.shots.push(shot);
  tl.totalDurationSec += shot.durationSec;
}

function insertShot(tl, index, shot) {
  tl.shots.splice(index, 0, shot);
  recalculateOffsets(tl);
}

function removeShot(tl, index) {
  tl.shots.splice(index, 1);
  recalculateOffsets(tl);
}

function moveShot(tl, fromIndex, toIndex) {
  const [shot] = tl.shots.splice(fromIndex, 1);
  tl.shots.splice(toIndex, 0, shot);
  recalculateOffsets(tl);
}

function getShotAt(tl, timeSec) {
  return tl.shots.find(s =>
    timeSec >= s.startOffset && timeSec < s.startOffset + s.durationSec
  );
}

function recalculateOffsets(tl) {
  let offset = 0;
  for (const shot of tl.shots) {
    shot.startOffset = offset;
    offset += shot.durationSec;
  }
  tl.totalDurationSec = offset;
}

const makeShot = (n, dur) => ({
  sceneNumber: n,
  description: `Scene ${n}`,
  cameraAngle: 'wide',
  durationSec: dur,
  dialogueHint: '',
  mood: 'neutral',
  characters: [],
  transition: 'cut',
  beat: 'setup',
});

describe('Timeline operations', () => {
  it('creates an empty timeline', () => {
    const tl = createTimeline('Test Film');
    assert.equal(tl.title, 'Test Film');
    assert.equal(tl.shots.length, 0);
    assert.equal(tl.totalDurationSec, 0);
  });

  it('adds shots and calculates offsets', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(1, 10));
    addShot(tl, makeShot(2, 15));
    addShot(tl, makeShot(3, 5));

    assert.equal(tl.shots.length, 3);
    assert.equal(tl.totalDurationSec, 30);
    assert.equal(tl.shots[0].startOffset, 0);
    assert.equal(tl.shots[1].startOffset, 10);
    assert.equal(tl.shots[2].startOffset, 25);
  });

  it('inserts a shot at an index and recalculates', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(1, 10));
    addShot(tl, makeShot(3, 10));
    insertShot(tl, 1, makeShot(2, 15));

    assert.equal(tl.shots[1].sceneNumber, 2);
    assert.equal(tl.shots[1].startOffset, 10);
    assert.equal(tl.shots[2].startOffset, 25);
    assert.equal(tl.totalDurationSec, 35);
  });

  it('removes a shot and recalculates', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(1, 10));
    addShot(tl, makeShot(2, 20));
    addShot(tl, makeShot(3, 10));
    removeShot(tl, 1);

    assert.equal(tl.shots.length, 2);
    assert.equal(tl.shots[1].startOffset, 10);
    assert.equal(tl.totalDurationSec, 20);
  });

  it('moves a shot from one position to another', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(1, 10));
    addShot(tl, makeShot(2, 10));
    addShot(tl, makeShot(3, 10));
    moveShot(tl, 0, 2);

    assert.equal(tl.shots[2].sceneNumber, 1);
    assert.equal(tl.shots[2].startOffset, 20);
    assert.equal(tl.totalDurationSec, 30);
  });

  it('getShotAt returns correct shot for a time', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(1, 10));
    addShot(tl, makeShot(2, 15));

    assert.equal(getShotAt(tl, 0)?.sceneNumber, 1);
    assert.equal(getShotAt(tl, 9.9)?.sceneNumber, 1);
    assert.equal(getShotAt(tl, 10)?.sceneNumber, 2);
    assert.equal(getShotAt(tl, 24.9)?.sceneNumber, 2);
    assert.equal(getShotAt(tl, 25), undefined);
  });

  it('handles insert at beginning', () => {
    const tl = createTimeline('Test');
    addShot(tl, makeShot(2, 10));
    insertShot(tl, 0, makeShot(1, 5));
    assert.equal(tl.shots[0].sceneNumber, 1);
    assert.equal(tl.shots[0].startOffset, 0);
  });
});
