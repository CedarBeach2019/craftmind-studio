# 🎬 CraftMind Studio

> **AI-Powered Minecraft Filmmaking Studio**

CraftMind Studio transforms Minecraft into a virtual film set where AI agents serve as actors, directors, and crew. Give it a creative brief, and it generates cinematic content — shot lists, character dialogue, smart camera movements, storyboards, sound design, and rendered video.

> ⚠️ This is NOT a simple screen recorder. It's an AI director that understands storytelling structure, cinematography rules, controls Minecraft bots as actors, and produces cinematic content end-to-end.

---

## ✨ What's New

### 🎥 Shot Composition Engine
Smart camera placement using real cinematography rules:
- **Rule of thirds** — subjects automatically positioned at power points
- **180-degree rule** — enforces camera side across dialogue scenes
- **Leading lines** — uses environment geometry for dynamic framing
- **Depth of field** — aperture control per shot type (shallow for close-ups, deep for wides)
- **Mood-based DOF** — romantic scenes get shallower DOF, epic scenes get deeper

### 🎬 Set Design API
Set up Minecraft world state before filming:
- Place blocks (floors, walls, props, lighting)
- Spawn named mobs/actors
- Control time of day and weather
- Built-in presets: Dialogue Set, Dark Cave, Sunset Village, Battle Arena
- Full setup/cleanup command generation
- SceneGraph for managing multiple sets

### 🎭 Dialogue Beat System
Sync dialogue to action beats with natural pacing:
- 5 pacing profiles: conversational, intense, relaxed, dramatic, comedic
- Emotion-adjusted speaking rates (fear → fast, awe → slow)
- Automatic pause calculation before/after lines
- SRT subtitle generation
- Action beat interleaving (SFX, camera moves synced to dialogue)

### 📋 Storyboard Generator
Visual ASCII art storyboards from shot lists:
- Top-down view with rule-of-thirds grid overlay
- Side view showing camera height and depth
- Character positions with emoji markers
- Camera angle lines and director's notes
- Full storyboard export to text file

### 🎬 Takes & Retakes
Record multiple takes and pick the best:
- Start/complete/discard takes per scene
- Quality metrics: camera smoothness, positioning accuracy, dialogue timing
- Automatic best-take selection
- Per-metric best selection (smoothest camera, best timing, etc.)
- Take comparison reports

### 🎞 Post-Production Pipeline
Full post-production in ffmpeg:
- Transitions: cut, fade, dissolve, dip-to-black, whip
- Title cards with custom text and subtitles
- Scrolling credits (cast, crew, special thanks)
- Letterboxing for cinematic aspect ratios (2.39:1, 16:9, 4:3, 1:1)
- Export formats: MP4, WebM, GIF, PNG sequence
- Quality presets: draft (15fps 540p), standard (24fps 1080p), cinematic (24fps 1440p)

### 🔊 Sound Design System
Minecraft sound library with biome-aware audio:
- 60+ sound mappings across 8 categories
- Ambient sounds per biome (plains, forest, desert, cave, ocean, nether, end, jungle, swamp, mountains)
- Footstep sync per block material (stone, grass, wood, gravel, sand, snow, metal)
- Combat sounds (sword hits, explosions, creeper priming, shield blocks)
- Environmental sounds (doors, water, weather)
- Mob sounds (zombie, skeleton, spider, enderman, villager, wolf, cat)
- Automatic sound plan generation from scene description

### 🖥 Web UI
Visual timeline editor in the browser:
- Drag-and-drop shot reordering
- Mood-colored timeline blocks
- Playhead with keyboard controls (Space, arrows)
- Shot detail panel with inline editing
- Import/export timeline JSON
- Demo project built-in
- Runs at `node src/index.js serve`

---

## Table of Contents

- [Architecture](#architecture)
- [Core Modules](#core-modules)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Quick Start (CLI)](#quick-start-cli)
- [Programmatic Usage](#programmatic-usage)
- [Production Pipeline](#production-pipeline)
- [Storytelling Framework](#storytelling-framework)
- [Shot Types](#shot-types)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Supported Output Formats](#supported-output-formats)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CRAFTMIND STUDIO                            │
│                     Production Pipeline Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐   ┌────────────┐   ┌────────────┐                   │
│  │  CREATIVE  │──▶│  DIRECTOR   │──▶│   TIMELINE  │                  │
│  │   BRIEF    │   │    AI      │   │   EDITOR    │                  │
│  │            │   │ (LLM +     │   │            │                   │
│  │ • premise  │   │  Save the  │   │ • shots    │                   │
│  │ • mood     │   │  Cat)      │   │ • timing   │                   │
│  │ • cast     │   │            │   │ • metadata │                   │
│  └───────────┘   └─────┬──────┘   └─────┬──────┘                   │
│                        │                 │                           │
│  ┌───────────┐        │    ┌────────────┴──────────┐                │
│  │ CHARACTER  │◀──────┤    │    CAMERA SYSTEM       │                │
│  │  SYSTEM    │        │    │                        │                │
│  │            │        │    │  • orbitPath()         │                │
│  │ • profiles │        │    │  • dollyPath()         │                │
│  │ • memory   │        │    │  • cranePath()         │                │
│  │ • relation-│        │    │  • getStateAt()        │                │
│  │   ships    │        │    │  • ease()              │                │
│  └─────┬─────┘        │    └───────────────────────┘                │
│        │              │                 │                            │
│        │    ┌─────────┴──────────┐     │                            │
│        │    │   SIMULATION        │     │                            │
│        │    │   ORCHESTRATOR      │─────┘                            │
│        │    │                     │                                  │
│        │    │  • spawnActor()     │                                  │
│        │    │  • positionActor()  │                                  │
│        │    │  • lookAt()         │                                  │
│        │    │  • captureFrame()   │                                  │
│        │    │  • recordScene()    │                                  │
│        │    │                     │                                  │
│        │    │  ┌─────┐ ┌─────┐   │                                  │
│        └────│──▶│Bot 1│ │Bot N│   │                                  │
│             │   └──┬──┘ └──┬──┘   │                                  │
│             │      │       │      │                                  │
│             │      ▼       ▼      │                                  │
│             │   ┌──────────────┐   │                                  │
│             │   │   RENDERER    │◀──┘                                  │
│             │   │  (ffmpeg)     │                                      │
│             │   │               │                                      │
│             │   │  • renderVideo()                                      │
│             │   │  • muxAudio()  │                                      │
│             │   │  • concatenateClips()│                                │
│             │   └──────┬───────┘                                      │
│             │          │                                              │
│             │   ┌──────┴───────┐                                      │
│             │   │    AUDIO      │                                      │
│             │   │  (ElevenLabs) │                                      │
│             │   │               │                                      │
│             │   │  • synthesizeDialogue()                              │
│             │   │  • synthesizeScene()                                 │
│             │   │  • generateMusic()                                   │
│             │   │  • getSoundEffect()                                  │
│             │   └──────────────┘                                      │
│             │                                                         │
│             └──────▶ 🎬 Final Video (MP4/H.264)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

| Module | File | Purpose |
|--------|------|---------|
| **Director AI** | `src/director.js` | Generates shot lists from creative briefs using LLM + Save the Cat beat sheets |
| **Character System** | `src/character.js` | Persistent character profiles with personality, voice config, memory, and relationships |
| **Simulation Orchestrator** | `src/simulation.js` | Spawns Minecraft bots as actors via mineflayer, positions them, captures frames |
| **Timeline Editor** | `src/timeline.js` | Non-linear timeline — add/insert/remove/reorder shots with auto-offset calculation |
| **Camera System** | `src/camera.js` | Cinematic camera math — orbit, dolly, crane paths with easing interpolation |
| **Renderer** | `src/renderer.js` | Video pipeline — stitches frame sequences into H.264 video via ffmpeg |
| **Audio Pipeline** | `src/audio.js` | ElevenLabs TTS for dialogue, music generation stubs, SFX file lookup |
| **Main Entry** | `src/index.js` | Ties all modules into a `produce()` pipeline; includes CLI interface |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (ESM modules required)
- **Minecraft server** (PaperMC 1.20.4+ recommended) running locally
- **ffmpeg** installed and on PATH (`ffmpeg -version` to verify)
- **ElevenLabs API key** for voice synthesis
- **ZAI API key** for the Director AI (LLM)

### Installation

```bash
git clone https://github.com/CedarBeach2019/craftmind-studio.git
cd craftmind-studio
npm install
```

### Configuration

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for all available configuration variables.

```env
ZAI_API_KEY=your_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

---

## Quick Start (CLI)

```bash
node src/index.js \
  --brief "Alex discovers an abandoned village at sunset. Strange sounds come from the well." \
  --characters "Alex,Jordan" \
  --mood "mysterious" \
  --output ./my-film
```

### CLI Options

| Flag | Description | Required |
|------|-------------|----------|
| `--brief` | Creative brief / story premise | Yes |
| `--characters` | Comma-separated character names | No (defaults to empty) |
| `--mood` | Mood/tone | No (default: `neutral`) |
| `--output` | Output directory | No (default: `./output`) |

---

## Programmatic Usage

```javascript
import { produce, registerCharacter } from 'craftmind-studio';

// Define your cast
registerCharacter({
  id: 'alex',
  name: 'Alex',
  personality: ['brave', 'curious', 'impulsive'],
  speakingStyle: 'short exclamations, asks lots of questions',
  voice: { elevenLabsVoiceId: 'your-voice-id', emotionStyle: 'dramatic', stability: 0.6, similarity: 0.75 },
  catchphrases: ['What was that?!'],
  avoids: ['staying still'],
  backstory: ['Woke up in a strange world with no memories'],
  relationships: {},
  currentMood: 'curious',
});

// Run the full pipeline
const outputPath = await produce({
  brief: {
    premise: 'Alex discovers an abandoned village at sunset.',
    characters: ['alex'],
    mood: 'mysterious',
    targetDurationSec: 120,
  },
  cast: [/* character profiles */],
  simConfig: {
    host: 'localhost',
    port: 25565,
    version: '1.20.4',
    screenshotDir: './screenshots',
    width: 1920,
    height: 1080,
  },
  renderConfig: { fps: 24, width: 1920, height: 1080 },
  outputDir: './my-film',
});

console.log(`Final video: ${outputPath}`);
```

---

## Production Pipeline

Here's the complete flow from creative brief to final video:

```
1. CREATIVE BRIEF          You write: premise, characters, mood
         │
         ▼
2. DIRECTOR AI              LLM generates scene-by-scene shot list
   (Save the Cat)           using narrative beat structure
         │
         ▼
3. TIMELINE                 Shots organized with timing, transitions,
                            camera angles, and metadata
         │
         ├──▶ 4a. CHARACTERS     Bots spawn on MC server as actors
         │          │
         │          ▼
         ├──▶ 4b. DIALOGUE       LLM writes character-consistent dialogue
         │          │
         │          ▼
         ├──▶ 4c. AUDIO          ElevenLabs synthesizes voice lines
         │
         ├──▶ 4d. CAMERA PATHS   Cinematic camera movements calculated
         │
         ▼
5. SIMULATION               Actors positioned, frames captured at 24fps
                            following camera keyframes
         │
         ▼
6. RENDERER                 Frame sequences → H.264 video clips (ffmpeg)
         │
         ▼
7. CONCATENATION            All clips merged into final video
         │
         ▼
8. 🎬 FINAL VIDEO           MP4/H.264 with AAC audio
```

---

## Storytelling Framework

CraftMind uses the **Save the Cat** beat sheet system for narrative structure. The Director AI maps your creative brief onto these beats to ensure proper dramatic pacing:

| # | Beat | Weight | Purpose |
|---|------|--------|---------|
| 1 | Opening Image | 5% | Establish the world, hook the viewer |
| 2 | Theme Stated | 5% | The core question of the story |
| 3 | Setup | 10% | Meet the characters, normal world |
| 4 | Catalyst | 5% | The inciting incident — nothing is the same |
| 5 | Debate | 10% | Should they act? Hesitation and doubt |
| 6 | Break into Two | 5% | Commitment to the journey |
| 7 | Fun and Games | 15% | The promise of the premise, exploration |
| 8 | Midpoint | 10% | False victory or false defeat |
| 9 | Bad Guys Close In | 10% | Stakes escalate, pressure mounts |
| 10 | All Is Lost | 5% | The lowest point, apparent failure |
| 11 | Dark Night of Soul | 5% | Despair and reflection |
| 12 | Break into Three | 5% | The answer emerges from the darkness |
| 13 | Finale | 10% | Climax and resolution |
| 14 | Final Image | 5% | The new normal, contrast with opening |

Beat weights determine how much screen time each beat receives relative to your target duration.

---

## Shot Types

See [`docs/shot-types.md`](docs/shot-types.md) for the complete shot type reference.

**Quick reference:**

| Shot | Camera | Best For |
|------|--------|----------|
| Wide (WS) | Far, high | Establishing, action, scale |
| Medium (MS) | Moderate distance | Dialogue, interaction |
| Close-Up (CU) | Very close | Emotion, reaction, detail |
| Over-the-Shoulder (OTS) | Behind character | Two-person dialogue |
| Low Angle | Below subject | Power, menace, heroism |
| High Angle | Above subject | Vulnerability, overview |
| Crane | Vertical movement | Reveals, transitions |
| Dolly | Linear push/pull | Tension, intimacy, tracking |

---

## API Reference

### `director.js`

#### `generateShotList(brief)` → `Promise<Timeline>`

Generates a full shot list from a creative brief.

```javascript
const timeline = await generateShotList({
  premise: 'A hero enters a dark cave...',
  characters: ['alex', 'jordan'],
  mood: 'suspenseful',
  targetDurationSec: 180,  // optional, default 300
});
```

#### `generateDialogue(scene, cast, previousSceneSummary?)` → `Promise<DialogueLine[]>`

Generates character-consistent dialogue for a scene.

```javascript
const dialogue = await generateDialogue(shot, castProfiles);
// → [{ characterId: 'alex', line: 'What was that?!', emotion: 'fear' }, ...]
```

---

### `character.js`

#### `registerCharacter(profile)` → `void`

#### `getCharacter(id)` → `CharacterProfile | undefined`

#### `listCharacters()` → `CharacterProfile[]`

#### `adjustTrust(fromId, toId, delta)` → `void`

#### `recordSharedEvent(charA, charB, description, trustImpact)` → `void`

#### `addConflict(fromId, toId, conflict)` → `void`

#### `recordSceneMemory(memory)` → `void`

#### `getMemories(characterId, opts?)` → `SceneMemory[]`

#### `getContinuitySummary(characterId)` → `string`

#### `exportUniverse()` → `object`

#### `importUniverse(data)` → `void`

---

### `timeline.js`

#### `createTimeline(title)` → `Timeline`

#### `addShot(timeline, shot)` → `void`

#### `insertShot(timeline, index, shot)` → `void`

#### `removeShot(timeline, index)` → `void`

#### `moveShot(timeline, fromIndex, toIndex)` → `void`

#### `getShotAt(timeline, timeSec)` → `Shot | undefined`

#### `exportJSON(timeline, filePath)` → `Promise<void>`

#### `importJSON(filePath)` → `Promise<Timeline>`

---

### `camera.js`

#### `orbitPath(center, radius, heightOffset, durationSec, startAngle?, totalAngle?, easing?)` → `CameraMove`

#### `dollyPath(start, end, durationSec, lookAt, easing?)` → `CameraMove`

#### `cranePath(start, riseHeight, durationSec, lookAt, easing?)` → `CameraMove`

#### `getStateAt(move, timeSec)` → `CameraState | null`

#### `ease(a, b, t, easing?)` → `number`

---

### `renderer.js`

#### `renderVideo(frames, outputPath, config?, onProgress?)` → `Promise<string>`

#### `muxAudio(videoPath, audioPath, outputPath)` → `Promise<string>`

#### `concatenateClips(clipPaths, outputPath, opts?)` → `Promise<string>`

---

### `audio.js`

#### `synthesizeDialogue(text, voiceCfg, outputPath, opts?)` → `Promise<string>`

#### `synthesizeScene(dialogueLines, voiceMap, outputDir)` → `Promise<AudioResult[]>`

#### `generateMusic(mood, durationSec, outputPath)` → `Promise<string>`

#### `getSoundEffect(effectName, sfxDir)` → `Promise<string | null>`

---

### `simulation.js`

#### `spawnActor(characterId, config)` → `Promise<ActorBot>`

#### `despawnActor(actor)` → `void`

#### `positionActor(actor, x, y, z, yaw?, pitch?)` → `Promise<void>`

#### `lookAt(actor, targetX, targetY, targetZ)` → `void`

#### `captureFrame(viewerInstance, outputPath)` → `Promise<string>`

#### `recordScene(viewerInstance, config, shot, onFrame?)` → `Promise<string[]>`

#### `setActiveTake(takeId)` → `void`

---

### `index.js`

#### `produce(opts)` → `Promise<string>`

High-level pipeline that runs everything: brief → shot list → dialogue → audio → simulation → render → final video.

```javascript
const finalVideo = await produce({
  brief, cast, simConfig, renderConfig, outputDir
});
```

---

## Examples

| Example | Description |
|---------|-------------|
| [`examples/simple-production.js`](examples/simple-production.js) | 2 characters, 3 scenes, full pipeline walkthrough |
| [`examples/custom-camera.js`](examples/custom-camera.js) | Demonstrates all camera movements with path previews |

Run them with:
```bash
node examples/simple-production.js
node examples/custom-camera.js
```

---

## Supported Output Formats

| Format | Codec | Use Case |
|--------|-------|----------|
| **MP4** | H.264 + AAC | Default output, widely compatible |
| **PNG sequence** | — | Raw frames for external compositing |
| **MP3** | — | Generated dialogue audio files |
| **JSON** | — | Timeline exports, character data exports |

### Render Quality Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `fps` | 24 | Cinematic frame rate |
| `width` | 1920 | Full HD width |
| `height` | 1080 | Full HD height |
| `codec` | libx264 | H.264 encoding |
| `preset` | medium | Encoding speed/quality tradeoff (`ultrafast` → `veryslow`) |
| `crf` | 18 | Constant Rate Factor (lower = better quality, 0-51) |

---

## Troubleshooting

### `ZAI_API_KEY environment variable is required`
You need an API key for the Director AI. Set it in your `.env` file or export it:
```bash
export ZAI_API_KEY=your_key_here
```

### `ELEVENLABS_API_KEY environment variable is required`
Required for voice synthesis. Audio generation is gracefully skipped if unavailable (a warning is logged), but the final video will have no dialogue.

### `ffmpeg exited with code 1`
- Ensure ffmpeg is installed: `ffmpeg -version`
- Check the output directory is writable
- Verify frame images are valid PNGs

### `Error: Spawn timeout` (simulation)
- Ensure your Minecraft server is running and accessible
- Check that `mineflayer` can connect: test with a simple bot script first
- Verify the server version matches your `simConfig.version`

### `LLM did not return an array of scenes`
The Director AI sometimes produces malformed JSON. This usually resolves by:
- Making your brief more specific
- Reducing the complexity of the request
- Retrying (the LLM call is non-deterministic)

### Frame rendering skipped (no viewer)
The renderer requires a mineflayer-viewer instance for actual frame capture. Without it, placeholder clips are generated. To enable real rendering:
1. Install `prismarine-viewer` with headless GL support
2. Ensure a WebGL-capable environment (or use `headless-gl`)

### No audio in final video
- Check ElevenLabs API key is valid
- Check ElevenLabs voice IDs are correct
- Review the console for audio generation warnings

---

## Project Structure

```
craftmind-studio/
├── src/
│   ├── index.js          # Main entry, produce() pipeline, CLI
│   ├── director.js       # AI Director — LLM shot list generation
│   ├── character.js      # Character profiles, memory, relationships
│   ├── timeline.js       # Shot timeline editor
│   ├── camera.js         # Cinematic camera math
│   ├── renderer.js       # ffmpeg video pipeline
│   ├── simulation.js     # Minecraft bot orchestration
│   └── audio.js          # ElevenLabs TTS & audio
├── tests/
│   ├── director.test.js       # Shot list & dialogue parsing
│   ├── timeline.test.js       # Timeline CRUD operations
│   ├── camera.test.js         # Camera interpolation
│   ├── character.test.js      # Character & relationship management
│   └── behavior-script.test.js # Dialogue format validation
├── examples/
│   ├── simple-production.js   # Full 2-char, 3-scene pipeline
│   └── custom-camera.js       # All camera movements demo
├── docs/
│   ├── creative-brief-schema.json  # JSON Schema for briefs
│   ├── shot-types.md               # Shot type reference guide
│   ├── studio-research.md          # Internal research notes
│   └── ecosystem-research.md       # Ecosystem analysis
├── .env.example            # Configuration template
├── .gitignore
├── LICENSE                 # MIT
├── package.json
└── README.md               # This file
```

---

## Running Tests

```bash
npm test
```

Tests cover: shot list generation, dialogue parsing, timeline operations, camera interpolation, character creation, relationship management, and behavior script validation.

---

## License

[MIT](LICENSE) © 2024 CraftMind Studio
