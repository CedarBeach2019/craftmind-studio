#!/usr/bin/env node
/**
 * @example simple-production.js
 * A complete 2-character, 3-scene production that auto-renders.
 *
 * Usage:
 *   node examples/simple-production.js
 *
 * This creates a short film about two explorers discovering a hidden temple.
 * No Minecraft server needed — runs in "dry-run" mode showing the pipeline.
 */

import {
  registerCharacter,
  createTimeline,
  addShot,
  exportJSON,
  orbitPath,
  dollyPath,
  cranePath,
  synthesizeScene,
  generateMusic,
  concatenateClips,
} from '../src/index.js';

// ── 1. Define Characters ─────────────────────────────────────────────

const ALEX = {
  id: 'alex',
  name: 'Alex',
  personality: ['brave', 'curious', 'impulsive'],
  speakingStyle: 'short exclamations, asks lots of questions',
  voice: { elevenLabsVoiceId: 'default', emotionStyle: 'dramatic', stability: 0.5, similarity: 0.75 },
  catchphrases: ['What was that?!', 'I have a bad feeling about this.'],
  avoids: ['waiting around', 'silence'],
  backstory: ['Woke up in a strange world with no memories', 'Found a mysterious map fragment'],
  relationships: {},
  currentMood: 'adventurous',
};

const JORDAN = {
  id: 'jordan',
  name: 'Jordan',
  personality: ['cautious', 'wise', 'sarcastic'],
  speakingStyle: 'dry humor, long pauses before important lines',
  voice: { elevenLabsVoiceId: 'default', emotionStyle: 'deadpan', stability: 0.6, similarity: 0.7 },
  catchphrases: ['We should probably not do that.', 'I told you so.'],
  avoids: ['unnecessary risks'],
  backstory: ['Veteran explorer who lost their last expedition team'],
  relationships: {},
  currentMood: 'wary',
};

// ── 2. Build the Timeline ────────────────────────────────────────────

const timeline = createTimeline('The Hidden Temple');

addShot(timeline, {
  sceneNumber: 1,
  description: 'Wide establishing shot of a dense jungle biome at golden hour',
  cameraAngle: 'wide',
  durationSec: 8,
  dialogueHint: 'Ambient jungle sounds only',
  mood: 'wonder',
  characters: [],
  transition: 'fade',
  beat: 'opening_image',
  cameraPath: orbitPath({ x: 0, y: 64, z: 0 }, 20, 8, 8, 30, 180, 'easeInOut'),
});

addShot(timeline, {
  sceneNumber: 2,
  description: 'Alex and Jordan push through vines to discover a moss-covered stone doorway',
  cameraAngle: 'dolly',
  durationSec: 12,
  dialogueHint: 'Alex notices something; Jordan is skeptical',
  mood: 'anticipation',
  characters: ['alex', 'jordan'],
  transition: 'cut',
  beat: 'catalyst',
  cameraPath: dollyPath(
    { x: -10, y: 66, z: 15 },
    { x: -3, y: 65, z: 5 },
    12,
    { x: 0, y: 65, z: 0 },
    'easeOut',
  ),
});

addShot(timeline, {
  sceneNumber: 3,
  description: 'The massive temple doors slowly open, revealing a glowing interior',
  cameraAngle: 'crane',
  durationSec: 10,
  dialogueHint: 'Both react with awe',
  mood: 'awe',
  characters: ['alex', 'jordan'],
  transition: 'fade',
  beat: 'break_into_two',
  cameraPath: cranePath(
    { x: 0, y: 64, z: 10 },
    20,
    10,
    { x: 0, y: 65, z: 0 },
    'easeInOut',
  ),
});

// ── 3. Display the Shot List ─────────────────────────────────────────

console.log('🎬 CraftMind Studio — Simple Production Pipeline\n');
console.log(`Title: ${timeline.title}`);
console.log(`Total Duration: ${timeline.totalDurationSec}s\n`);
console.log('Shots:');

for (const shot of timeline.shots) {
  console.log(`  Scene ${shot.sceneNumber}: [${shot.beat}] ${shot.description}`);
  console.log(`    Camera: ${shot.cameraAngle} | Mood: ${shot.mood} | Duration: ${shot.durationSec}s`);
  console.log(`    Transition: ${shot.transition}`);
  if (shot.cameraPath) {
    console.log(`    Camera keyframes: ${shot.cameraPath.keyframes.length}`);
  }
  console.log();
}

// ── 4. Show Camera Paths ─────────────────────────────────────────────

console.log('Camera Paths:');
for (const shot of timeline.shots) {
  if (shot.cameraPath) {
    const start = shot.cameraPath.keyframes[0];
    const mid = shot.cameraPath.keyframes[Math.floor(shot.cameraPath.keyframes.length / 2)];
    const end = shot.cameraPath.keyframes[shot.cameraPath.keyframes.length - 1];
    console.log(`  Scene ${shot.sceneNumber}:`);
    console.log(`    START: (${start.x}, ${start.y}, ${start.z}) yaw=${start.yaw}° pitch=${start.pitch}°`);
    console.log(`    MID:   (${mid.x}, ${mid.y}, ${mid.z}) yaw=${mid.yaw}° pitch=${mid.pitch}°`);
    console.log(`    END:   (${end.x}, ${end.y}, ${end.z}) yaw=${end.yaw}° pitch=${end.pitch}°`);
  }
}

// ── 5. Dry-Run Summary ───────────────────────────────────────────────

console.log('\n✅ Pipeline preview complete!');
console.log('In production with a running Minecraft server and API keys, this would:');
console.log('  1. Spawn Alex and Jordan as bots on the server');
console.log('  2. Position them at each scene location');
console.log('  3. Generate dialogue via LLM');
console.log('  4. Synthesize voices via ElevenLabs');
console.log('  5. Capture frames following camera paths');
console.log('  6. Render clips via ffmpeg');
console.log('  7. Concatenate into final video');
