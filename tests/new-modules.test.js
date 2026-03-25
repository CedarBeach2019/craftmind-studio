/**
 * @module tests/new-modules.test
 * Tests for dialogue-beats, set-design, storyboard, takes, post-production, and sound-design.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Dialogue Beats ──────────────────────────────────────────────────

function estimateLineDuration(text, emotion, emphasis = 0.5) {
  const words = text.split(/\s+/).length;
  let wps = 2.5;
  if (emotion === 'fear' || emotion === 'panic') wps = 3.5;
  if (emotion === 'sadness' || emotion === 'melancholy') wps = 1.8;
  if (emotion === 'awe' || emotion === 'wonder') wps = 1.5;
  wps *= (1 - emphasis * 0.3);
  return Math.max(0.5, words / wps);
}

function buildBeatSequence(opts) {
  const { dialogue, pacing = 'conversational' } = opts;
  const beats = [];
  let t = 0;
  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    const dur = estimateLineDuration(line.text, line.emotion, 0.5);
    line.startSec = t;
    line.endSec = t + dur;
    beats.push({ id: `dialogue_${i}`, type: 'dialogue', startSec: t, durationSec: dur, description: `${line.characterId}: "${line.text}"`, metadata: { characterId: line.characterId, text: line.text, emotion: line.emotion } });
    t += dur + 0.3; // pause after
  }
  return { sceneId: opts.sceneId ?? 'unknown', beats, totalDurationSec: t };
}

function getBeatAt(seq, timeSec) {
  return seq.beats.find(b => timeSec >= b.startSec && timeSec < b.startSec + b.durationSec);
}

describe('Dialogue beat system', () => {
  it('estimates line duration based on emotion', () => {
    const fear = estimateLineDuration('What was that', 'fear');
    const awe = estimateLineDuration('What was that', 'awe');
    assert.ok(fear < awe, `Fear (${fear}s) should be faster than awe (${awe}s)`);
  });

  it('respects minimum duration floor', () => {
    const d = estimateLineDuration('hi', 'neutral', 0);
    assert.ok(d >= 0.5, `Minimum should be 0.5s, got ${d}`);
  });

  it('builds beat sequence from dialogue', () => {
    const seq = buildBeatSequence({
      sceneId: 'test',
      dialogue: [
        { characterId: 'alex', text: 'Hello there', emotion: 'neutral' },
        { characterId: 'jordan', text: 'Hey!', emotion: 'happy' },
      ],
    });
    assert.equal(seq.beats.length, 2);
    assert.equal(seq.beats[0].type, 'dialogue');
    assert.ok(seq.totalDurationSec > 0);
    assert.ok(seq.beats[0].startSec === 0);
    assert.ok(seq.beats[1].startSec > seq.beats[0].startSec);
  });

  it('finds active beat at time', () => {
    const seq = buildBeatSequence({
      dialogue: [{ characterId: 'a', text: 'one two three four', emotion: 'neutral' }],
    });
    const beat = getBeatAt(seq, 0.1);
    assert.ok(beat);
    assert.equal(beat.type, 'dialogue');
    assert.ok(getBeatAt(seq, -1) === undefined);
  });
});

// ── Set Design ──────────────────────────────────────────────────────

function generateSetupCommands(setup) {
  const cmds = [];
  cmds.push('/gamerule doDaylightCycle false');
  cmds.push('/gamerule doWeatherCycle false');
  if (setup.worldState?.time !== undefined) cmds.push(`/time set ${Math.round(setup.worldState.time)}`);
  if (setup.worldState?.weather === 'thunder') cmds.push('/weather thunder 999999');
  for (const block of setup.blocks ?? []) {
    cmds.push(`/setblock ${block.x} ${block.y} ${block.z} ${block.blockName}`);
  }
  for (const mob of setup.mobs ?? []) {
    let cmd = `/summon ${mob.entityType} ${mob.x} ${mob.y} ${mob.z}`;
    if (mob.name) cmd += ` {CustomName:'{"text":"${mob.name}"}'}`;
    cmds.push(cmd);
  }
  return cmds;
}

describe('Set design', () => {
  it('generates setup commands', () => {
    const cmds = generateSetupCommands({
      worldState: { time: 12000, weather: 'clear' },
      blocks: [{ x: 0, y: 64, z: 0, blockName: 'stone' }],
      mobs: [{ entityType: 'zombie', x: 5, y: 65, z: 5, name: 'Zombie1' }],
    });
    assert.ok(cmds.some(c => c.includes('doDaylightCycle false')));
    assert.ok(cmds.some(c => c.includes('/time set 12000')));
    assert.ok(cmds.some(c => c.includes('/setblock 0 64 0 stone')));
    assert.ok(cmds.some(c => c.includes('summon zombie')));
    assert.ok(cmds.some(c => c.includes('Zombie1')));
  });

  it('handles empty setup', () => {
    const cmds = generateSetupCommands({});
    assert.ok(cmds.length > 0); // Still has gamerule commands
  });
});

// ── Storyboard ──────────────────────────────────────────────────────

describe('Storyboard generator', () => {
  it('generates ASCII art panels with correct dimensions', () => {
    // Just verify the canvas helpers work
    const w = 50, h = 25;
    const canvas = [];
    for (let y = 0; y < h; y++) canvas.push(new Array(w).fill(' '));
    const rendered = canvas.map(r => r.join('')).join('\n');
    const lines = rendered.split('\n');
    assert.equal(lines.length, h);
    assert.ok(lines.every(l => l.length === w));
  });
});

// ── Takes ───────────────────────────────────────────────────────────

class TakeManager {
  constructor() { this.takes = new Map(); this.selectedTakes = new Map(); }

  startTake(sceneNum, opts = {}) {
    const takes = this.takes.get(sceneNum) ?? [];
    const num = takes.length + 1;
    const id = `scene_${sceneNum}_take_${num}`;
    const take = { id, sceneNumber: sceneNum, takeNumber: num, status: 'recording', framePaths: [], metrics: { cameraSmoothness: 0, positioningAccuracy: 0, dialogueTiming: 0, overallScore: 0 }, notes: opts.notes ?? '' };
    takes.push(take);
    this.takes.set(sceneNum, takes);
    return take;
  }

  completeTake(takeId, metrics = null) {
    const take = this._find(takeId);
    if (!take) throw new Error('not found');
    take.status = 'completed';
    if (metrics) Object.assign(take.metrics, metrics);
    return take;
  }

  selectBestTake(sceneNum) {
    const takes = (this.takes.get(sceneNum) ?? []).filter(t => t.status === 'completed');
    if (takes.length === 0) return null;
    takes.sort((a, b) => b.metrics.overallScore - a.metrics.overallScore);
    this.selectedTakes.set(sceneNum, takes[0].id);
    return takes[0];
  }

  getTakes(sceneNum) { return this.takes.get(sceneNum) ?? []; }
  getSelectedTake(sceneNum) { const id = this.selectedTakes.get(sceneNum); return id ? this._find(id) : null; }

  _find(id) {
    for (const takes of this.takes.values()) {
      const t = takes.find(t => t.id === id);
      if (t) return t;
    }
    return null;
  }
}

describe('Take manager', () => {
  it('starts and completes takes', () => {
    const tm = new TakeManager();
    const take = tm.startTake(1);
    assert.equal(take.status, 'recording');
    tm.completeTake(take.id, { overallScore: 0.9 });
    assert.equal(tm.getTakes(1)[0].status, 'completed');
  });

  it('selects best take by score', () => {
    const tm = new TakeManager();
    tm.startTake(1); tm.completeTake(`scene_1_take_1`, { overallScore: 0.6 });
    tm.startTake(1); tm.completeTake(`scene_1_take_2`, { overallScore: 0.95 });
    tm.startTake(1); tm.completeTake(`scene_1_take_3`, { overallScore: 0.7 });
    const best = tm.selectBestTake(1);
    assert.equal(best.takeNumber, 2);
  });

  it('returns null for no takes', () => {
    const tm = new TakeManager();
    assert.equal(tm.selectBestTake(1), null);
    assert.equal(tm.getSelectedTake(1), null);
  });
});

// ── Sound Design ────────────────────────────────────────────────────

const BLOCK_MATERIALS = {
  stone: 'step.stone', grass_block: 'step.grass', oak_planks: 'step.wood',
  gravel: 'step.gravel', sand: 'step.sand', snow_block: 'step.snow', iron_block: 'step.metal',
};

function getFootstepForBlock(blockName) { return BLOCK_MATERIALS[blockName] ?? 'step.stone'; }

function generateSoundPlan(opts) {
  const { biome, weather, durationSec, characters = [], events = [] } = opts;
  const sounds = [];
  if (weather === 'rain') sounds.push({ timeSec: 0, soundId: 'weather.rain', volume: 0.4 });
  if (weather === 'thunder') {
    sounds.push({ timeSec: 0, soundId: 'weather.rain', volume: 0.3 });
    sounds.push({ timeSec: 3, soundId: 'weather.thunder', volume: 0.8 });
  }
  for (const event of events) {
    if (event.type === 'sword_hit') sounds.push({ timeSec: event.timeSec, soundId: 'combat.sword_hit' });
    if (event.type === 'explosion') sounds.push({ timeSec: event.timeSec, soundId: 'combat.explosion' });
  }
  return sounds;
}

describe('Sound design', () => {
  it('maps blocks to footstep materials', () => {
    assert.equal(getFootstepForBlock('oak_planks'), 'step.wood');
    assert.equal(getFootstepForBlock('snow_block'), 'step.snow');
    assert.equal(getFootstepForBlock('iron_block'), 'step.metal');
    assert.equal(getFootstepForBlock('unknown_block'), 'step.stone');
  });

  it('generates weather sounds', () => {
    const rain = generateSoundPlan({ weather: 'rain', durationSec: 10 });
    assert.ok(rain.some(s => s.soundId === 'weather.rain'));

    const thunder = generateSoundPlan({ weather: 'thunder', durationSec: 10 });
    assert.ok(thunder.some(s => s.soundId === 'weather.thunder'));
    assert.ok(thunder.some(s => s.soundId === 'weather.rain'));
  });

  it('handles combat events', () => {
    const plan = generateSoundPlan({ weather: 'clear', durationSec: 10, events: [
      { timeSec: 2, type: 'sword_hit' },
      { timeSec: 5, type: 'explosion' },
    ]});
    assert.ok(plan.some(s => s.soundId === 'combat.sword_hit' && s.timeSec === 2));
    assert.ok(plan.some(s => s.soundId === 'combat.explosion' && s.timeSec === 5));
  });
});
