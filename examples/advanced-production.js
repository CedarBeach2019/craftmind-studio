#!/usr/bin/env node

/**
 * @example advanced-production.js
 * Demonstrates the full CraftMind Studio pipeline with all new features.
 *
 * Usage: node examples/advanced-production.js
 */

import { composeShot, calculateDOF } from '../src/composition.js';
import { SceneGraph, PRESETS, generateSetupCommands } from '../src/set-design.js';
import { buildBeatSequence, generateSRT } from '../src/dialogue-beats.js';
import { generateStoryboard, renderPanel } from '../src/storyboard.js';
import { TakeManager } from '../src/takes.js';
import { generateSoundPlan } from '../src/sound-design.js';
import { QUALITY_PRESETS, ASPECT_RATIOS, calculateLetterbox } from '../src/post-production.js';

console.log('🎬 CraftMind Studio — Advanced Production Demo\n');

// ── 1. Set Design ─────────────────────────────────────────────────
console.log('═══ SET DESIGN ═══');
const sceneGraph = new SceneGraph();

const villageSet = PRESETS.villageSet({ x: 100, y: 64, z: 100 });
sceneGraph.addScene(villageSet);

const setupCmds = generateSetupCommands(villageSet);
console.log(`Village set: ${setupCmds.length} setup commands`);
console.log(`First few: ${setupCmds.slice(0, 3).join(', ')}`);

// ── 2. Shot Composition ───────────────────────────────────────────
console.log('\n═══ SHOT COMPOSITION ═══');

const subjects = [
  { id: 'alex', name: 'Alex', x: 100, y: 65, z: 100, importance: 0.8, role: 'primary' },
  { id: 'jordan', name: 'Jordan', x: 103, y: 65, z: 100, importance: 0.6, role: 'secondary' },
];

for (const [shotType, mood, label] of [
  ['wide', 'wonder', 'Establishing shot'],
  ['medium', 'anticipation', 'Dialogue setup'],
  ['close-up', 'suspenseful', 'Reaction shot'],
  ['low-angle', 'triumphant', 'Hero moment'],
]) {
  const comp = composeShot({ subjects, shotType, mood, durationSec: 5 });
  console.log(`\n${label} (${shotType}):`);
  console.log(`  Camera: (${comp.camera.x}, ${comp.camera.y}, ${comp.camera.z}) yaw=${comp.camera.yaw}° pitch=${comp.camera.pitch}°`);
  console.log(`  Score: ${comp.score.toFixed(2)} | Rules: ${comp.appliedRules.join(', ')}`);
  console.log(`  DOF: aperture=${comp.dof.aperture} — ${comp.dof.description}`);
}

// ── 3. Dialogue Beat System ───────────────────────────────────────
console.log('\n═══ DIALOGUE BEATS ═══');

const dialogue = [
  { characterId: 'alex', text: 'We should check the village before nightfall.', emotion: 'concern' },
  { characterId: 'jordan', text: "I don't know...", emotion: 'fear' },
  { characterId: 'alex', text: "Trust me. I've done this a hundred times.", emotion: 'confidence' },
  { characterId: 'jordan', text: "That's what worries me.", emotion: 'sarcasm' },
  { characterId: 'alex', text: 'Just stay close and watch my back.', emotion: 'serious' },
];

const beatSeq = buildBeatSequence({
  sceneId: 'village_approach',
  dialogue,
  mood: 'suspenseful',
  actions: [
    { at: 'before_line_1', type: 'sfx', description: 'distant wolf howl', durationSec: 2 },
    { at: 'after_dialogue', type: 'action', description: 'They enter the village', durationSec: 3 },
  ],
});

console.log(`Beat sequence: ${beatSeq.beats.length} beats, ${beatSeq.totalDurationSec.toFixed(1)}s`);
for (const beat of beatSeq.beats) {
  const time = `${beat.startSec.toFixed(1)}s-${(beat.startSec + beat.durationSec).toFixed(1)}s`;
  console.log(`  [${time}] ${beat.type.toUpperCase()}: ${beat.description.slice(0, 50)}`);
}

console.log('\nGenerated SRT (first 12 lines):');
console.log(generateSRT(beatSeq).split('\n').slice(0, 12).join('\n'));

// ── 4. Storyboard ─────────────────────────────────────────────────
console.log('\n═══ STORYBOARD ═══');

const timeline = {
  title: 'The Village',
  shots: [
    { sceneNumber: 1, description: 'Wide shot of village at sunset', cameraAngle: 'wide', durationSec: 8, mood: 'wonder', transition: 'fade', beat: 'opening_image', characters: [] },
    { sceneNumber: 2, description: 'Alex and Jordan approach cautiously', cameraAngle: 'dolly', durationSec: 6, mood: 'anticipation', transition: 'cut', beat: 'setup', characters: ['alex', 'jordan'] },
    { sceneNumber: 3, description: 'They spot something in the darkness', cameraAngle: 'close-up', durationSec: 4, mood: 'suspenseful', transition: 'cut', beat: 'catalyst', characters: ['jordan'] },
  ],
};

const storyboard = generateStoryboard(timeline, {
  subjectsByScene: {
    2: [{ id: 'alex', name: 'Alex', x: 100, y: 65, z: 100 }, { id: 'jordan', name: 'Jordan', x: 103, y: 65, z: 100 }],
    3: [{ id: 'jordan', name: 'Jordan', x: 103, y: 65, z: 100 }],
  },
});

console.log(renderPanel(storyboard[0]));

// ── 5. Takes & Retakes ────────────────────────────────────────────
console.log('═══ TAKES & RETAKES ═══\n');

const takeManager = new TakeManager();
for (let i = 0; i < 3; i++) {
  const take = takeManager.startTake(2, { notes: `Take ${i + 1}: ${['rough', 'better', 'best'][i]} performance` });
  takeManager.completeTake(take.id, {
    cameraSmoothness: 0.6 + i * 0.15,
    positioningAccuracy: 0.65 + i * 0.1,
    dialogueTiming: 0.7 + i * 0.1,
  });
}

console.log(takeManager.generateReport(2));
const best = takeManager.selectBestTake(2);
console.log(`Best take: #${best.takeNumber} (score: ${best.metrics.overallScore.toFixed(2)})`);

// ── 6. Sound Design ───────────────────────────────────────────────
console.log('\n═══ SOUND DESIGN ═══\n');

const soundPlan = generateSoundPlan({
  biome: 'plains',
  weather: 'clear',
  durationSec: 24,
  characters: [
    { id: 'alex', moving: true, startMovingAt: 2, stopMovingAt: 10, standingOn: 'grass_block' },
    { id: 'jordan', moving: true, startMovingAt: 2, stopMovingAt: 10, standingOn: 'gravel' },
  ],
  events: [
    { timeSec: 8, type: 'sword_hit' },
    { timeSec: 15, type: 'explosion' },
    { timeSec: 18, type: 'door_open' },
  ],
});

console.log(`Sound plan: ${soundPlan.length} sound events`);
for (const s of soundPlan.slice(0, 10)) {
  console.log(`  ${s.timeSec.toFixed(1)}s | ${s.soundId} (vol: ${s.volume})`);
}
if (soundPlan.length > 10) console.log(`  ... and ${soundPlan.length - 10} more`);

// ── 7. Export Configs ─────────────────────────────────────────────
console.log('\n═══ EXPORT CONFIGS ═══');
for (const [name, preset] of Object.entries(QUALITY_PRESETS)) {
  console.log(`  ${name}: ${preset.width}x${preset.height} @ ${preset.fps}fps (CRF ${preset.crf}, ${preset.preset})`);
}
console.log('\nLetterbox (1920x1080):');
for (const ratio of Object.keys(ASPECT_RATIOS)) {
  const { cropW, cropH } = calculateLetterbox(1920, 1080, ratio);
  console.log(`  ${ratio}: crop to ${cropW}x${cropH}`);
}

console.log('\n✅ Demo complete!');
