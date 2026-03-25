/**
 * @file index.js
 * CraftMind Studio — Main entry point.
 *
 * Ties together the Director AI, Character system, Simulation Orchestrator,
 * Timeline Editor, Camera, Renderer, and Audio pipeline into a cohesive
 * filmmaking workflow.
 */

import { generateShotList, generateDialogue } from './director.js';
import { registerCharacter, getCharacter, getContinuitySummary, listCharacters } from './character.js';
import { spawnActor, despawnActor, positionActor, lookAt, captureFrame, recordScene, setActiveTake } from './simulation.js';
import { createTimeline, addShot, exportJSON } from './timeline.js';
import { orbitPath, dollyPath, cranePath, getStateAt } from './camera.js';
import { renderVideo, muxAudio, concatenateClips } from './renderer.js';
import { synthesizeDialogue, synthesizeScene, generateMusic } from './audio.js';
import path from 'node:path';
import fs from 'node:fs/promises';

// Re-export for convenience
export {
  generateShotList, generateDialogue,
  registerCharacter, getCharacter, getContinuitySummary, listCharacters,
  spawnActor, despawnActor, positionActor, lookAt, captureFrame, recordScene, setActiveTake,
  createTimeline, addShot, exportJSON,
  orbitPath, dollyPath, cranePath, getStateAt,
  renderVideo, muxAudio, concatenateClips,
  synthesizeDialogue, synthesizeScene, generateMusic,
};

/**
 * High-level production pipeline: brief → video.
 *
 * @param {object} opts
 * @param {object} opts.brief        — Creative brief for director.generateShotList
 * @param {import('./character.js').CharacterProfile[]} opts.cast — Character profiles
 * @param {object} opts.simConfig    — Simulation config for simulation.js
 * @param {object} opts.renderConfig — Render config for renderer.js
 * @param {string} opts.outputDir    — Base output directory
 * @returns {Promise<string>} — Path to final video file
 */
export async function produce(opts) {
  const { brief, cast, simConfig, renderConfig, outputDir } = opts;
  await fs.mkdir(outputDir, { recursive: true });

  // 1. Register characters
  for (const character of cast) {
    registerCharacter(character);
  }
  console.log(`[CraftMind] Registered ${cast.length} characters`);

  // 2. Generate shot list from brief
  console.log('[CraftMind] Generating shot list from creative brief...');
  const timeline = await generateShotList(brief);
  console.log(`[CraftMind] Generated ${timeline.shots.length} shots (${timeline.totalDurationSec}s total)`);

  // 3. Export timeline for reference
  const timelinePath = path.join(outputDir, 'timeline.json');
  await exportJSON(timeline, timelinePath);
  console.log(`[CraftMind] Timeline saved to ${timelinePath}`);

  // 4. Spawn actor bots and position for each scene
  const actors = new Map();
  try {
    for (const character of cast) {
      console.log(`[CraftMind] Spawning actor: ${character.name}`);
      const actor = await spawnActor(character.id, simConfig);
      actors.set(character.id, actor);
    }

    // 5. Record each scene
    const clipPaths = [];
    for (const shot of timeline.shots) {
      setActiveTake(`scene_${shot.sceneNumber}`);
      console.log(`[CraftMind] Recording scene ${shot.sceneNumber}: ${shot.description.slice(0, 60)}...`);

      // Position actors for this scene
      for (const charId of shot.characters) {
        const actor = actors.get(charId);
        if (actor) {
          // Simple positioning: spread actors 3 blocks apart along X
          const idx = shot.characters.indexOf(charId);
          await positionActor(actor, 100 + idx * 3, 64, 100, 90, 0);
        }
      }

      // Generate dialogue for this scene
      const sceneCast = shot.characters.map(id => getCharacter(id)).filter(Boolean);
      const dialogue = await generateDialogue(shot, sceneCast);

      // Generate audio for dialogue
      const audioDir = path.join(outputDir, `audio/scene_${shot.sceneNumber}`);
      const voiceMap = new Map(sceneCast.map(c => [
        c.id,
        {
          voiceId: c.voice?.elevenLabsVoiceId,
          stability: c.voice?.stability ?? 0.5,
          similarity: c.voice?.similarity ?? 0.75,
          modelId: 'eleven_multilingual_v2',
        },
      ]));

      let audioPaths;
      try {
        audioPaths = await synthesizeScene(dialogue, voiceMap, audioDir);
      } catch (err) {
        console.warn(`[CraftMind] Audio generation failed for scene ${shot.sceneNumber}: ${err.message}`);
        audioPaths = [];
      }

      // Generate camera path for this shot
      let cameraMove;
      switch (shot.cameraAngle) {
        case 'wide': {
          const center = { x: 101, y: 65, z: 100 };
          cameraMove = orbitPath(center, 12, 6, shot.durationSec, 45, 180, 'easeInOut');
          break;
        }
        case 'close-up': {
          cameraMove = dollyPath(
            { x: 100, y: 66, z: 95 },
            { x: 100, y: 65.5, z: 93 },
            shot.durationSec,
            { x: 100, y: 65, z: 100 },
          );
          break;
        }
        case 'crane': {
          cameraMove = cranePath(
            { x: 100, y: 64, z: 108 },
            15,
            shot.durationSec,
            { x: 100, y: 65, z: 100 },
          );
          break;
        }
        default: {
          cameraMove = dollyPath(
            { x: 100, y: 66, z: 105 },
            { x: 100, y: 66, z: 100 },
            shot.durationSec,
            { x: 100, y: 65, z: 100 },
          );
        }
      }

      // Record scene frames (requires a viewer instance in production)
      const framesDir = path.join(outputDir, `frames/scene_${shot.sceneNumber}`);
      const clipPath = path.join(outputDir, `clips/scene_${shot.sceneNumber}.mp4`);
      await fs.mkdir(path.dirname(clipPath), { recursive: true });

      // In production, this would use the viewer to capture actual frames.
      // For now, generate a placeholder clip.
      try {
        await renderVideo([], clipPath, renderConfig);
      } catch {
        console.warn(`[CraftMind] Frame rendering skipped for scene ${shot.sceneNumber} (no viewer)`);
      }
      clipPaths.push(clipPath);
    }

    // 6. Concatenate all clips into final video
    const finalPath = path.join(outputDir, 'final.mp4');
    console.log('[CraftMind] Concatenating clips into final video...');
    await concatenateClips(clipPaths.filter(p => true), finalPath);

    console.log(`[CraftMind] ✅ Production complete: ${finalPath}`);
    return finalPath;
  } finally {
    // Cleanup: despawn all actors
    for (const [, actor] of actors) {
      despawnActor(actor);
    }
  }
}

/**
 * CLI entry point.
 *
 * Usage:
 *   node src/index.js --brief "A hero enters a dark cave..." --characters "Alex,Jordan" --mood "suspenseful" --output ./output
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  };

  const briefText = getArg('--brief');
  const characters = getArg('--characters')?.split(',') ?? [];
  const mood = getArg('--mood') ?? 'neutral';
  const outputDir = getArg('--output') ?? './output';

  if (!briefText) {
    console.log('CraftMind Studio — AI-Powered Minecraft Filmmaking');
    console.log('');
    console.log('Usage: node src/index.js --brief "story premise" --characters "Alex,Jordan" --mood "dramatic" --output ./output');
    console.log('');
    console.log('Options:');
    console.log('  --brief       Creative brief / story premise');
    console.log('  --characters  Comma-separated character names');
    console.log('  --mood        Mood/tone (dramatic, comedic, suspenseful, melancholy)');
    console.log('  --output      Output directory (default: ./output)');
    process.exit(1);
  }

  try {
    const result = await produce({
      brief: {
        premise: briefText,
        characters,
        mood,
        targetDurationSec: 120,
      },
      cast: characters.map((name, i) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        personality: ['brave', 'curious'],
        speakingStyle: 'casual',
        voice: { elevenLabsVoiceId: 'default', emotionStyle: 'dramatic', stability: 0.5 },
        catchphrases: [],
        avoids: [],
        backstory: [],
        relationships: {},
        currentMood: mood,
      })),
      simConfig: {
        host: 'localhost',
        port: 25565,
        version: '1.20.4',
        screenshotDir: path.join(outputDir, 'screenshots'),
        width: 1920,
        height: 1080,
      },
      renderConfig: { fps: 24, width: 1920, height: 1080 },
      outputDir,
    });
    console.log(`Done! Output: ${result}`);
  } catch (err) {
    console.error('Production failed:', err);
    process.exit(1);
  }
}

// Run CLI if executed directly
const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) main();
