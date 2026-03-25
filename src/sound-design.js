/**
 * @module sound-design
 * Sound Design System — Minecraft sound library mapping with biome-based
 * ambient sounds, footstep sync, impact sounds, and environmental audio.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * @typedef {object} SoundEvent
 * @property {string} id — Sound identifier
 * @property {string} category — "ambient" | "footstep" | "impact" | "door" | "water" | "weather" | "music" | "ui" | "mob"
 * @property {string} file — Sound file path relative to sfx library root
 * @property {number} [volume=1.0] — Volume multiplier
 * @property {number} [pitch=1.0] — Pitch multiplier
 * @property {number} [minDist=0] — Minimum distance for attenuation
 * @property {number} [maxDist=16] — Maximum hearing distance (blocks)
 * @property {string[]} [biomes] — Which biomes this sound plays in
 * @property {string[]} [mobs] — Which mob types trigger this sound
 */

// ── Minecraft Sound Library ───────────────────────────────────────────

/**
 * Core Minecraft sound mappings.
 * In production, these point to actual sound files from the Minecraft assets.
 * For now, they serve as an API for the sound design pipeline.
 */
const SOUND_LIBRARY = {
  // Ambient by biome
  'ambient.plains':      { category: 'ambient', biomes: ['plains', 'sunflower_plains'], file: 'ambient/plains.ogg', volume: 0.4 },
  'ambient.forest':      { category: 'ambient', biomes: ['forest', 'dark_forest', 'flower_forest'], file: 'ambient/forest.ogg', volume: 0.5 },
  'ambient.desert':      { category: 'ambient', biomes: ['desert', 'desert_hills'], file: 'ambient/desert.ogg', volume: 0.3 },
  'ambient.cave':        { category: 'ambient', biomes: ['cave', 'deep_dark'], file: 'ambient/cave.ogg', volume: 0.6 },
  'ambient.ocean':       { category: 'ambient', biomes: ['ocean', 'deep_ocean', 'beach'], file: 'ambient/ocean.ogg', volume: 0.4 },
  'ambient.nether':      { category: 'ambient', biomes: ['nether_wastes', 'soul_sand_valley', 'crimson_forest'], file: 'ambient/nether.ogg', volume: 0.5 },
  'ambient.end':         { category: 'ambient', biomes: ['the_end', 'end_midlands'], file: 'ambient/end.ogg', volume: 0.3 },
  'ambient.mountains':   { category: 'ambient', biomes: ['mountains', 'snowy_mountains', 'windswept_hills'], file: 'ambient/mountains.ogg', volume: 0.3 },
  'ambient.jungle':      { category: 'ambient', biomes: ['jungle', 'sparse_jungle', 'bamboo_jungle'], file: 'ambient/jungle.ogg', volume: 0.6 },
  'ambient.swamp':       { category: 'ambient', biomes: ['swamp', 'mangrove_swamp'], file: 'ambient/swamp.ogg', volume: 0.4 },
  'ambient.village':     { category: 'ambient', biomes: [], file: 'ambient/village.ogg', volume: 0.2 },
  'ambient.mine':        { category: 'ambient', biomes: [], file: 'ambient/mine.ogg', volume: 0.5 },

  // Footsteps by material
  'step.stone':          { category: 'footstep', file: 'step/stone1.ogg', volume: 0.6, maxDist: 8 },
  'step.grass':          { category: 'footstep', file: 'step/grass1.ogg', volume: 0.5, maxDist: 8 },
  'step.wood':           { category: 'footstep', file: 'step/wood1.ogg', volume: 0.6, maxDist: 8 },
  'step.gravel':         { category: 'footstep', file: 'step/gravel1.ogg', volume: 0.7, maxDist: 10 },
  'step.sand':           { category: 'footstep', file: 'step/sand1.ogg', volume: 0.4, maxDist: 6 },
  'step.snow':           { category: 'footstep', file: 'step/snow1.ogg', volume: 0.3, maxDist: 6 },
  'step.metal':          { category: 'footstep', file: 'step/metal1.ogg', volume: 0.8, maxDist: 10 },

  // Combat
  'combat.sword_swing':  { category: 'impact', file: 'combat/sword_swing.ogg', volume: 0.8, maxDist: 16 },
  'combat.sword_hit':    { category: 'impact', file: 'combat/sword_hit.ogg', volume: 0.9, maxDist: 16 },
  'combat.arrow_shoot':  { category: 'impact', file: 'combat/arrow_shoot.ogg', volume: 0.7, maxDist: 16 },
  'combat.arrow_hit':    { category: 'impact', file: 'combat/arrow_hit.ogg', volume: 0.8, maxDist: 12 },
  'combat.explosion':    { category: 'impact', file: 'combat/explosion.ogg', volume: 1.0, maxDist: 32, pitch: 0.8 },
  'combat.creeper':      { category: 'impact', file: 'mob/creeper/primed.ogg', volume: 1.0, maxDist: 16 },
  'combat.shield_block': { category: 'impact', file: 'combat/shield_block.ogg', volume: 0.7, maxDist: 12 },
  'combat.generic_hit':  { category: 'impact', file: 'combat/generic_hit.ogg', volume: 0.8, maxDist: 12 },

  // Doors & interactive
  'door.wood_open':      { category: 'door', file: 'door/wood_open.ogg', volume: 0.7, maxDist: 10 },
  'door.wood_close':     { category: 'door', file: 'door/wood_close.ogg', volume: 0.7, maxDist: 10 },
  'door.iron_open':      { category: 'door', file: 'door/iron_open.ogg', volume: 0.8, maxDist: 12 },
  'door.iron_close':     { category: 'door', file: 'door/iron_close.ogg', volume: 0.8, maxDist: 12 },
  'door.trapdoor':       { category: 'door', file: 'door/trapdoor.ogg', volume: 0.5, maxDist: 8 },
  'door.fence_gate':     { category: 'door', file: 'door/fence_gate.ogg', volume: 0.4, maxDist: 8 },

  // Water
  'water.swim':          { category: 'water', file: 'water/swim1.ogg', volume: 0.6, maxDist: 8 },
  'water.splash':        { category: 'water', file: 'water/splash.ogg', volume: 0.8, maxDist: 12 },
  'water.flow':          { category: 'water', file: 'water/flow.ogg', volume: 0.3, maxDist: 16 },

  // Weather
  'weather.rain':        { category: 'weather', file: 'weather/rain.ogg', volume: 0.5, maxDist: 32 },
  'weather.thunder':     { category: 'weather', file: 'weather/thunder1.ogg', volume: 1.0, maxDist: 64, pitch: 0.7 },
  'weather.wind':        { category: 'weather', file: 'weather/wind.ogg', volume: 0.3, maxDist: 32 },

  // Mob sounds
  'mob.zombie.groan':    { category: 'mob', mobs: ['zombie'], file: 'mob/zombie/groan.ogg', volume: 0.8, maxDist: 16 },
  'mob.zombie.hurt':     { category: 'mob', mobs: ['zombie'], file: 'mob/zombie/hurt.ogg', volume: 0.8, maxDist: 16 },
  'mob.skeleton.bone':   { category: 'mob', mobs: ['skeleton'], file: 'mob/skeleton/bone.ogg', volume: 0.7, maxDist: 16 },
  'mob.spider.hiss':     { category: 'mob', mobs: ['spider'], file: 'mob/spider/hiss.ogg', volume: 0.6, maxDist: 16 },
  'mob.enderman.idle':   { category: 'mob', mobs: ['enderman'], file: 'mob/enderman/idle.ogg', volume: 0.5, maxDist: 16 },
  'mob.villager.idle':   { category: 'mob', mobs: ['villager'], file: 'mob/villager/idle.ogg', volume: 0.4, maxDist: 10 },
  'mob.villager.trade':  { category: 'mob', mobs: ['villager'], file: 'mob/villager/trade.ogg', volume: 0.5, maxDist: 10 },
  'mob.wolf.bark':       { category: 'mob', mobs: ['wolf'], file: 'mob/wolf/bark.ogg', volume: 0.6, maxDist: 16 },
  'mob.cat.meow':        { category: 'mob', mobs: ['cat'], file: 'mob/cat/meow.ogg', volume: 0.4, maxDist: 10 },

  // UI
  'ui.click':            { category: 'ui', file: 'ui/click.ogg', volume: 0.5 },
  'ui.success':          { category: 'ui', file: 'ui/success.ogg', volume: 0.5 },
  'ui.fail':             { category: 'ui', file: 'ui/fail.ogg', volume: 0.5 },
};

// ── Block → Footstep Material Mapping ─────────────────────────────────

const BLOCK_MATERIALS = {
  // Stone-like
  stone: 'step.stone', cobblestone: 'step.stone', stone_bricks: 'step.stone',
  deepslate: 'step.stone', granite: 'step.stone', diorite: 'step.stone',
  andesite: 'step.stone', bedrock: 'step.stone', obsidian: 'step.metal',

  // Grass/dirt
  grass_block: 'step.grass', dirt: 'step.grass', podzol: 'step.grass',
  mycelium: 'step.grass', farmland: 'step.grass',

  // Wood
  oak_planks: 'step.wood', spruce_planks: 'step.wood', birch_planks: 'step.wood',
  oak_log: 'step.wood', spruce_log: 'step.wood', crafting_table: 'step.wood',
  bookshelf: 'step.wood',

  // Gravel/sand
  gravel: 'step.gravel', sand: 'step.sand', red_sand: 'step.sand',
  soul_sand: 'step.sand', concrete_powder: 'step.sand',

  // Snow
  snow_block: 'step.snow', snow: 'step.snow', powdered_snow: 'step.snow',

  // Metal
  iron_block: 'step.metal', gold_block: 'step.metal', diamond_block: 'step.metal',
  iron_door: 'step.metal', cauldron: 'step.metal', anvil: 'step.metal',
  hopper: 'step.metal', rail: 'step.metal',
};

// ── Sound Design Engine ───────────────────────────────────────────────

/**
 * Get the footstep sound for a block type.
 * @param {string} blockName — Minecraft block ID
 * @returns {string} Sound ID
 */
export function getFootstepForBlock(blockName) {
  return BLOCK_MATERIALS[blockName] ?? 'step.stone';
}

/**
 * Get all ambient sounds for a biome.
 * @param {string} biome
 * @returns {object[]}
 */
export function getAmbientForBiome(biome) {
  return Object.entries(SOUND_LIBRARY)
    .filter(([, s]) => s.category === 'ambient' && (!s.biomes || s.biomes.length === 0 || s.biomes.includes(biome)))
    .map(([id, s]) => ({ id, ...s }));
}

/**
 * Get sound events for a mob type.
 * @param {string} mobType
 * @returns {object[]}
 */
export function getSoundsForMob(mobType) {
  return Object.entries(SOUND_LIBRARY)
    .filter(([, s]) => s.mobs?.includes(mobType))
    .map(([id, s]) => ({ id, ...s }));
}

/**
 * Look up a sound by ID.
 * @param {string} soundId
 * @returns {object | undefined}
 */
export function getSound(soundId) {
  return SOUND_LIBRARY[soundId] ? { id: soundId, ...SOUND_LIBRARY[soundId] } : undefined;
}

/**
 * Search sounds by category.
 * @param {string} category
 * @returns {object[]}
 */
export function searchSounds(category) {
  return Object.entries(SOUND_LIBRARY)
    .filter(([, s]) => s.category === category)
    .map(([id, s]) => ({ id, ...s }));
}

/**
 * Generate a sound design plan for a scene.
 * Maps scene elements to appropriate sound events.
 *
 * @param {object} opts
 * @param {string} opts.biome — Current biome
 * @param {string} opts.weather — "clear" | "rain" | "thunder"
 * @param {object[]} [opts.characters] — Characters with positions and movement
 * @param {object[]} [opts.events] — Timed events: { timeSec, type, ... }
 * @param {number} opts.durationSec — Scene duration
 * @returns {Array<{ timeSec: number, soundId: string, volume: number, duration: number }>}
 */
export function generateSoundPlan(opts) {
  const { biome, weather, durationSec } = opts;
  const sounds = [];

  // Ambient loop for the biome
  const ambient = getAmbientForBiome(biome);
  if (ambient.length > 0) {
    sounds.push({
      timeSec: 0,
      soundId: ambient[0].id,
      volume: ambient[0].volume * 0.5,
      duration: durationSec,
      loop: true,
    });
  }

  // Weather sounds
  if (weather === 'rain') {
    sounds.push({ timeSec: 0, soundId: 'weather.rain', volume: 0.4, duration: durationSec, loop: true });
  }
  if (weather === 'thunder') {
    sounds.push({ timeSec: 0, soundId: 'weather.rain', volume: 0.3, duration: durationSec, loop: true });
    // Random thunder claps
    for (let t = 3; t < durationSec; t += 5 + Math.random() * 10) {
      sounds.push({ timeSec: t, soundId: 'weather.thunder', volume: 0.8, duration: 2, loop: false });
    }
  }

  // Character footstep sync
  for (const char of opts.characters ?? []) {
    if (!char.moving) continue;
    const stepInterval = char.running ? 0.35 : 0.5; // seconds between steps
    for (let t = char.startMovingAt ?? 0; t < (char.stopMovingAt ?? durationSec); t += stepInterval) {
      const blockSound = getFootstepForBlock(char.standingOn ?? 'grass_block');
      sounds.push({
        timeSec: t,
        soundId: blockSound,
        volume: char.volume ?? 0.6,
        duration: 0.15,
        loop: false,
      });
    }
  }

  // Event-based sounds (combat, doors, etc.)
  for (const event of opts.events ?? []) {
    switch (event.type) {
      case 'sword_hit':
        sounds.push({ timeSec: event.timeSec, soundId: 'combat.sword_hit', volume: 0.9, duration: 0.3 });
        break;
      case 'explosion':
        sounds.push({ timeSec: event.timeSec, soundId: 'combat.explosion', volume: 1.0, duration: 1.5 });
        break;
      case 'door_open':
        sounds.push({ timeSec: event.timeSec, soundId: event.doorType === 'iron' ? 'door.iron_open' : 'door.wood_open', volume: 0.7, duration: 0.5 });
        break;
      case 'door_close':
        sounds.push({ timeSec: event.timeSec, soundId: event.doorType === 'iron' ? 'door.iron_close' : 'door.wood_close', volume: 0.7, duration: 0.5 });
        break;
      case 'mob_hurt':
        sounds.push({ timeSec: event.timeSec, soundId: `mob.${event.mobType}.hurt`, volume: 0.8, duration: 0.3 });
        break;
      case 'splash':
        sounds.push({ timeSec: event.timeSec, soundId: 'water.splash', volume: 0.8, duration: 0.5 });
        break;
      default:
        if (event.soundId) {
          sounds.push({ timeSec: event.timeSec, soundId: event.soundId, volume: event.volume ?? 0.7, duration: event.duration ?? 0.5 });
        }
    }
  }

  // Sort by time
  sounds.sort((a, b) => a.timeSec - b.timeSec);
  return sounds;
}

/**
 * Get the full sound library as a mapping.
 * @returns {typeof SOUND_LIBRARY}
 */
export function getSoundLibrary() {
  return { ...SOUND_LIBRARY };
}
