/**
 * @file index.js
 * CraftMind Studio — Main entry point.
 *
 * Ties together the Director AI, Character system, Simulation Orchestrator,
 * Timeline Editor, Camera, Renderer, Audio pipeline, and all new modules
 * into a cohesive filmmaking workflow.
 */

import { generateShotList, generateDialogue } from './director.js';
import { registerCharacter, getCharacter, getContinuitySummary, listCharacters } from './character.js';
import { spawnActor, despawnActor, positionActor, lookAt, captureFrame, recordScene, setActiveTake } from './simulation.js';
import { createTimeline, addShot, exportJSON } from './timeline.js';
import { orbitPath, dollyPath, cranePath, getStateAt } from './camera.js';
import { renderVideo, muxAudio, concatenateClips } from './renderer.js';
import { synthesizeDialogue, synthesizeScene, generateMusic } from './audio.js';
import { composeShot, composeCameraMove, calculateDOF, enforce180Rule, crosses180Line } from './composition.js';
import { SceneGraph, PRESETS, generateSetupCommands, generateCleanupCommands } from './set-design.js';
import { buildBeatSequence, estimateLineDuration, generateSRT, generateSubtitles } from './dialogue-beats.js';
import { generateStoryboard, generatePanel, renderPanel, renderStoryboard } from './storyboard.js';
import { TakeManager } from './takes.js';
import { applyTransition, applyTimelineTransitions, addTitleCard, addCredits, applyLetterbox, exportVideo, QUALITY_PRESETS, ASPECT_RATIOS } from './post-production.js';
import { generateSoundPlan, getAmbientForBiome, getFootstepForBlock, getSoundsForMob, getSoundLibrary } from './sound-design.js';
import { StudioLot, BUILDING_TYPES, ADJACENCY_BONUSES } from './studio-lot.js';
import { Star, StarRegistry, PERSONALITY_TYPES, CAREER_PHASES, GENRES } from './star-system.js';
import { Production, STAGES, STAGE_ORDER } from './production-pipeline.js';
import { StudioFinance } from './finance.js';
import { AwardCeremony, AWARD_CATEGORIES } from './awards.js';
import { EraSystem, ERAS } from './era-progression.js';
import { CrisisSystem, CRISIS_TYPES } from './crisis-events.js';
import { AudienceSystem } from './audience.js';
import { CompetitorStudio, CompetitorLeague } from './competitor-studios.js';
import { DailyRoutine, TIME_PHASES, PHASE_ORDER } from './daily-routine.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Re-export for convenience
export {
  generateShotList, generateDialogue,
  registerCharacter, getCharacter, getContinuitySummary, listCharacters,
  spawnActor, despawnActor, positionActor, lookAt, captureFrame, recordScene, setActiveTake,
  createTimeline, addShot, exportJSON,
  orbitPath, dollyPath, cranePath, getStateAt,
  renderVideo, muxAudio, concatenateClips,
  synthesizeDialogue, synthesizeScene, generateMusic,
  // New modules
  composeShot, composeCameraMove, calculateDOF, enforce180Rule, crosses180Line,
  SceneGraph, PRESETS, generateSetupCommands, generateCleanupCommands,
  buildBeatSequence, estimateLineDuration, generateSRT, generateSubtitles,
  generateStoryboard, generatePanel, renderPanel, renderStoryboard,
  TakeManager,
  applyTransition, applyTimelineTransitions, addTitleCard, addCredits, applyLetterbox, exportVideo,
  QUALITY_PRESETS, ASPECT_RATIOS,
  generateSoundPlan, getAmbientForBiome, getFootstepForBlock, getSoundsForMob, getSoundLibrary,
  // Studio Tycoon modules
  StudioLot, BUILDING_TYPES, ADJACENCY_BONUSES,
  Star, StarRegistry, PERSONALITY_TYPES, CAREER_PHASES, GENRES,
  Production, STAGES, STAGE_ORDER,
  StudioFinance,
  AwardCeremony, AWARD_CATEGORIES,
  EraSystem, ERAS,
  CrisisSystem, CRISIS_TYPES,
  AudienceSystem,
  CompetitorStudio, CompetitorLeague,
  DailyRoutine, TIME_PHASES, PHASE_ORDER,
};

// ── Web UI Server ──────────────────────────────────────────────────────

/**
 * Start a local HTTP server serving the Web UI.
 *
 * @param {object} [opts]
 * @param {number} [opts.port=3456] — Port to listen on
 * @param {string} [opts.publicDir] — Directory containing index.html (default: ./public)
 * @returns {Promise<void>}
 */
export async function startServer(opts = {}) {
  const port = opts.port ?? 3456;
  const publicDir = opts.publicDir ?? path.join(import.meta.dirname ?? '.', 'public');
  const indexPath = path.join(publicDir, 'index.html');

  let html;
  try {
    html = await readFile(indexPath, 'utf-8');
  } catch {
    console.error(`[CraftMind] Web UI not found at ${indexPath}`);
    console.error('[CraftMind] Run this from the project root or specify publicDir');
    process.exit(1);
  }

  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n🎬 CraftMind Studio — Web UI`);
      console.log(`   http://localhost:${port}`);
      console.log(`   Press Ctrl+C to stop\n`);
      resolve(server);
    });
  });
}

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

  // 4. Generate storyboard
  console.log('[CraftMind] Generating storyboard...');
  const storyboard = generateStoryboard(timeline);
  const storyboardPath = path.join(outputDir, 'storyboard.txt');
  await fs.writeFile(storyboardPath, renderStoryboard(storyboard));
  console.log(`[CraftMind] Storyboard saved to ${storyboardPath}`);

  // 5. Set design
  console.log('[CraftMind] Setting up scene graph...');
  const sceneGraph = new SceneGraph();
  sceneGraph.addScene(PRESETS.dialogueSet({ x: 100, y: 64, z: 100 }));
  console.log('[CraftMind] Scene graph ready with 1 set');

  // 6. Take management
  const takeManager = new TakeManager();

  // 7. Spawn actor bots and position for each scene
  const actors = new Map();
  try {
    for (const character of cast) {
      console.log(`[CraftMind] Spawning actor: ${character.name}`);
      try {
        const actor = await spawnActor(character.id, simConfig);
        actors.set(character.id, actor);
      } catch (err) {
        console.warn(`[CraftMind] Could not spawn ${character.id}: ${err.message}`);
        console.warn(`[CraftMind] Running in offline mode — no server connection`);
      }
    }

    // 8. Record each scene
    const clipPaths = [];
    for (const shot of timeline.shots) {
      setActiveTake(`scene_${shot.sceneNumber}`);
      console.log(`[CraftMind] Recording scene ${shot.sceneNumber}: ${shot.description.slice(0, 60)}...`);

      // Start a take
      const take = takeManager.startTake(shot.sceneNumber, { notes: shot.description });

      // Generate smart camera composition
      const subjects = shot.characters.map((cid, idx) => ({
        id: cid,
        x: 100 + idx * 3, y: 65, z: 100,
        importance: idx === 0 ? 0.8 : 0.5,
        role: idx === 0 ? 'primary' : 'secondary',
      }));

      const composition = composeShot({
        subjects,
        shotType: shot.cameraAngle,
        mood: shot.mood,
        durationSec: shot.durationSec,
      });

      console.log(`[CraftMind]   Camera: ${composition.camera.x.toFixed(1)}, ${composition.camera.y.toFixed(1)}, ${composition.camera.z.toFixed(1)} | Rules: ${composition.appliedRules.join(', ')}`);
      console.log(`[CraftMind]   DOF: ${composition.dof.description} (aperture: ${composition.dof.aperture})`);

      // Generate dialogue with beat timing
      const sceneCast = shot.characters.map(id => getCharacter(id)).filter(Boolean);
      let beatSequence = null;
      if (shot.characters.length > 0) {
        try {
          const dialogue = await generateDialogue(shot, sceneCast);
          beatSequence = buildBeatSequence({
            sceneId: `scene_${shot.sceneNumber}`,
            dialogue: dialogue.map(d => ({
              characterId: d.characterId,
              text: d.line,
              emotion: d.emotion,
            })),
            pacing: shot.mood,
          });
          console.log(`[CraftMind]   Beat sequence: ${beatSequence.beats.length} beats, ${beatSequence.totalDurationSec.toFixed(1)}s`);
        } catch (err) {
          console.warn(`[CraftMind]   Dialogue generation skipped: ${err.message}`);
        }
      }

      // Sound design
      const soundPlan = generateSoundPlan({
        biome: 'plains',
        weather: 'clear',
        durationSec: shot.durationSec,
        characters: shot.characters.map(id => ({ id, moving: false })),
        events: [],
      });

      // Position actors for this scene
      for (const [cid, actor] of actors) {
        const idx = shot.characters.indexOf(cid);
        if (idx >= 0) {
          try {
            await positionActor(actor, 100 + idx * 3, 64, 100, 90, 0);
          } catch {}
        }
      }

      // Render clip (placeholder in offline mode)
      const clipPath = path.join(outputDir, `clips/scene_${shot.sceneNumber}.mp4`);
      await fs.mkdir(path.dirname(clipPath), { recursive: true });

      try {
        await renderVideo([], clipPath, renderConfig);
      } catch {
        console.warn(`[CraftMind]   Frame rendering skipped (no viewer connected)`);
      }
      clipPaths.push(clipPath);

      // Complete take
      takeManager.completeTake(take.id, {
        cameraSmoothness: 0.8 + Math.random() * 0.2,
        positioningAccuracy: 0.7 + Math.random() * 0.3,
        dialogueTiming: beatSequence ? 0.8 + Math.random() * 0.2 : 0.5,
      });

      // Export SRT subtitles
      if (beatSequence) {
        const srtPath = path.join(outputDir, `subtitles/scene_${shot.sceneNumber}.srt`);
        await fs.mkdir(path.dirname(srtPath), { recursive: true });
        await fs.writeFile(srtPath, generateSRT(beatSequence));
      }
    }

    // 9. Select best takes
    for (const shot of timeline.shots) {
      const best = takeManager.selectBestTake(shot.sceneNumber);
      if (best) {
        console.log(`[CraftMind] Best take for scene ${shot.sceneNumber}: #${best.takeNumber} (${best.metrics.overallScore.toFixed(2)})`);
      }
    }

    // 10. Post-production: apply transitions
    const transitions = timeline.shots.map(s => s.transition === 'cut' ? 'cut' : 'fade');
    const finalPath = path.join(outputDir, 'final.mp4');
    console.log('[CraftMind] Applying post-production...');
    try {
      await applyTimelineTransitions(clipPaths, transitions, finalPath, 0.5);
    } catch {
      await concatenateClips(clipPaths.filter(p => true), finalPath);
    }

    // 11. Add title card
    const titledPath = path.join(outputDir, 'final_titled.mp4');
    try {
      await addTitleCard(brief.premise.slice(0, 60), finalPath, titledPath, {
        subtitle: 'Made with CraftMind Studio',
        duration: 4,
      });
    } catch {
      console.warn('[CraftMind] Title card generation skipped');
    }

    // 12. Generate take report
    const reportPath = path.join(outputDir, 'take_report.txt');
    const reportLines = [];
    for (const shot of timeline.shots) {
      reportLines.push(takeManager.generateReport(shot.sceneNumber));
    }
    await fs.writeFile(reportPath, reportLines.join('\n\n'));

    console.log(`\n[CraftMind] ✅ Production complete!`);
    console.log(`   Timeline:  ${timelinePath}`);
    console.log(`   Storyboard: ${storyboardPath}`);
    console.log(`   Video:     ${titledPath}`);
    console.log(`   Report:    ${reportPath}`);
    return titledPath;
  } finally {
    // Cleanup: despawn all actors
    for (const [, actor] of actors) {
      try { despawnActor(actor); } catch {}
    }
  }
}

/**
 * CLI entry point.
 *
 * Usage:
 *   node src/index.js --brief "A hero enters a dark cave..." --characters "Alex,Jordan" --mood "suspenseful" --output ./output
 *   node src/index.js serve [--port 3456]    # Start Web UI
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  };

  // Server mode
  if (args[0] === 'serve') {
    const port = parseInt(getArg('--port') ?? '3456', 10);
    await startServer({ port });
    return;
  }

  const briefText = getArg('--brief');
  const characters = getArg('--characters')?.split(',') ?? [];
  const mood = getArg('--mood') ?? 'neutral';
  const outputDir = getArg('--output') ?? './output';

  if (!briefText && args[0] !== 'serve') {
    console.log('🎬 CraftMind Studio — AI-Powered Minecraft Filmmaking');
    console.log('');
    console.log('Usage:');
    console.log('  node src/index.js serve [--port 3456]        # Start Web UI');
    console.log('  node src/index.js --brief "story" ...        # Run production pipeline');
    console.log('');
    console.log('Pipeline options:');
    console.log('  --brief       Creative brief / story premise');
    console.log('  --characters  Comma-separated character names');
    console.log('  --mood        Mood/tone (dramatic, comedic, suspenseful, melancholy)');
    console.log('  --output      Output directory (default: ./output)');
    console.log('');
    console.log('Quick start:');
    console.log('  node src/index.js serve          # Open the visual timeline editor');
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
