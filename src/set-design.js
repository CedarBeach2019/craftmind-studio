/**
 * @module set-design
 * Scene Graph / Set Design API — set up Minecraft world state before filming.
 * Place blocks, spawn mobs, set time of day, weather, and manage scene environments.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * @typedef {object} BlockPlacement
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} blockName — Minecraft block ID (e.g. "stone", "oak_planks")
 * @property {object} [properties] — Block states (e.g. { waterlogged: true })
 */

/**
 * @typedef {object} MobSpawn
 * @property {string} entityType — Minecraft entity type (e.g. "zombie", "villager")
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} [name] — Custom name tag
 * @property {object} [nbt] — Additional NBT data
 */

/**
 * @typedef {object} SceneSetup
 * @property {string} id — Scene identifier
 * @property {string} name — Human-readable name
 * @property {BlockPlacement[]} blocks — Blocks to place
 * @property {MobSpawn[]} mobs — Mobs/entities to spawn
 * @property {object} worldState
 * @property {number} [worldState.time=6000] — World time (0-24000, 6000=noon)
 * @property {string} [worldState.weather='clear'] — "clear" | "rain" | "thunder"
 * @property {boolean} [worldState.doDaylightCycle=false] — Stop time progression
 * @property {boolean} [worldState.doWeatherCycle=false] — Stop weather changes
 * @property {number} [worldState.viewDistance=12] — Server view distance
 * @property {string[]} [worldState.gameRules] — Game rule commands
 */

// ── Set Design Commands ───────────────────────────────────────────────

/**
 * Generate a sequence of Minecraft commands to set up a scene.
 * These can be executed by an op bot or via RCON.
 *
 * @param {SceneSetup} setup
 * @returns {string[]} — Array of Minecraft commands to execute in order
 */
export function generateSetupCommands(setup) {
  const commands = [];

  // World state first
  commands.push(`/gamerule doDaylightCycle ${setup.worldState?.doDaylightCycle ?? false}`);
  commands.push(`/gamerule doWeatherCycle ${setup.worldState?.doWeatherCycle ?? false}`);

  if (setup.worldState?.time !== undefined) {
    commands.push(`/time set ${Math.round(setup.worldState.time)}`);
  }

  if (setup.worldState?.weather === 'rain') {
    commands.push('/weather rain 999999');
  } else if (setup.worldState?.weather === 'thunder') {
    commands.push('/weather thunder 999999');
  } else {
    commands.push('/weather clear 999999');
  }

  if (setup.worldState?.viewDistance) {
    commands.push(`/forceload add 0 0 0 0`); // Keep spawn chunks loaded
  }

  // Game rules
  for (const rule of setup.worldState?.gameRules ?? []) {
    commands.push(`/gamerule ${rule}`);
  }

  // Block placements
  for (const block of setup.blocks ?? []) {
    const props = block.properties
      ? Object.entries(block.properties).map(([k, v]) => `${k}=${v}`).join(',')
      : '';
    commands.push(`/setblock ${block.x} ${block.y} ${block.z} ${block.blockName}${props ? `[${props}]` : ''}`);
  }

  // Mob spawns
  for (const mob of setup.mobs ?? []) {
    const nbt = mob.nbt ? JSON.stringify(mob.nbt).replace(/"/g, '') : '';
    let cmd = `/summon ${mob.entityType} ${mob.x} ${mob.y} ${mob.z}`;
    if (mob.name) cmd += ` {CustomName:'{"text":"${mob.name}"}'}`;
    if (nbt) cmd += ` ${nbt}`;
    commands.push(cmd);
  }

  return commands;
}

/**
 * Generate cleanup commands to restore world state after filming.
 *
 * @param {SceneSetup} setup
 * @param {object} [originalState]
 * @param {number} [originalState.time=6000]
 * @param {string} [originalState.weather='clear']
 * @returns {string[]}
 */
export function generateCleanupCommands(setup, originalState = {}) {
  const commands = [];

  commands.push('/gamerule doDaylightCycle true');
  commands.push('/gamerule doWeatherCycle true');

  if (originalState.time !== undefined) {
    commands.push(`/time set ${Math.round(originalState.time)}`);
  }

  if (originalState.weather === 'rain') {
    commands.push('/weather rain');
  } else if (originalState.weather === 'thunder') {
    commands.push('/weather thunder');
  } else {
    commands.push('/weather clear');
  }

  // Kill spawned mobs (by name tag if possible)
  const namedMobs = (setup.mobs ?? []).filter(m => m.name);
  for (const mob of namedMobs) {
    commands.push(`/kill @e[type=${mob.entityType},name="${mob.name}"]`);
  }

  // Remove placed blocks (replace with air)
  for (const block of setup.blocks ?? []) {
    commands.push(`/setblock ${block.x} ${block.y} ${block.z} air`);
  }

  return commands;
}

// ── Preset Sets ───────────────────────────────────────────────────────

/**
 * Pre-built set designs for common filming scenarios.
 */

const PRESETS = {
  /**
   * A simple dialogue set — two characters face each other.
   */
  dialogueSet(origin = { x: 100, y: 64, z: 100 }) {
    return {
      id: 'dialogue_set',
      name: 'Dialogue Set',
      blocks: [
        // Floor platform
        ...Array.from({ length: 10 }, (_, i) => ({ x: origin.x - 5 + i, y: origin.y - 1, z: origin.z, blockName: 'oak_planks' })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: origin.x - 5 + i, y: origin.y - 1, z: origin.z + 1, blockName: 'oak_planks' })),
        // Back wall
        ...Array.from({ length: 5 }, (_, i) => ({ x: origin.x + 3, y: origin.y + i, z: origin.z, blockName: 'stone_bricks' })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: origin.x + 3, y: origin.y + i, z: origin.z + 1, blockName: 'stone_bricks' })),
        // Lighting (glowstone)
        { x: origin.x, y: origin.y + 4, z: origin.z, blockName: 'glowstone' },
      ],
      mobs: [],
      worldState: { time: 6000, weather: 'clear', doDaylightCycle: false, doWeatherCycle: false },
    };
  },

  /**
   * A dark cave set for horror/mystery scenes.
   */
  caveSet(origin = { x: 100, y: 50, z: 100 }) {
    const blocks = [];
    // Enclose a small cave
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        // Floor
        blocks.push({ x: origin.x + x, y: origin.y - 1, z: origin.z + z, blockName: 'stone' });
        // Ceiling
        if (Math.abs(x) > 2 || Math.abs(z) > 2) {
          blocks.push({ x: origin.x + x, y: origin.y + 4, z: origin.z + z, blockName: 'stone' });
        }
        // Walls
        if (Math.abs(x) === 5 || Math.abs(z) === 5) {
          for (let y = 0; y < 5; y++) {
            blocks.push({ x: origin.x + x, y: origin.y + y, z: origin.z + z, blockName: 'stone' });
          }
        }
      }
    }
    // Scattered glowstone for dim lighting
    blocks.push({ x: origin.x, y: origin.y + 4, z: origin.z, blockName: 'glowstone' });
    blocks.push({ x: origin.x - 3, y: origin.y + 3, z: origin.z + 2, blockName: 'glowstone' });

    return {
      id: 'cave_set',
      name: 'Dark Cave',
      blocks,
      mobs: [],
      worldState: { time: 18000, weather: 'clear', doDaylightCycle: false, doWeatherCycle: false },
    };
  },

  /**
   * Outdoor village at sunset — wide establishing shot ready.
   */
  villageSet(origin = { x: 100, y: 64, z: 100 }) {
    const blocks = [];
    // A few simple houses
    for (const [dx, dz] of [[0, 0], [8, 0], [-8, 5], [5, -7]]) {
      const bx = origin.x + dx, bz = origin.z + dz;
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          blocks.push({ x: bx + x, y: origin.y, z: bz + z, blockName: 'oak_planks' });
        }
      }
      // Walls
      for (let x = 0; x < 4; x++) {
        blocks.push({ x: bx + x, y: origin.y + 1, z: bz, blockName: 'oak_log' });
        blocks.push({ x: bx + x, y: origin.y + 2, z: bz, blockName: 'oak_log' });
        blocks.push({ x: bx + x, y: origin.y + 1, z: bz + 3, blockName: 'oak_log' });
        blocks.push({ x: bx + x, y: origin.y + 2, z: bz + 3, blockName: 'oak_log' });
      }
      for (let z = 0; z < 4; z++) {
        blocks.push({ x: bx, y: origin.y + 1, z: bz + z, blockName: 'oak_log' });
        blocks.push({ x: bx, y: origin.y + 2, z: bz + z, blockName: 'oak_log' });
        blocks.push({ x: bx + 3, y: origin.y + 1, z: bz + z, blockName: 'oak_log' });
        blocks.push({ x: bx + 3, y: origin.y + 2, z: bz + z, blockName: 'oak_log' });
      }
      // Roof
      for (let x = -1; x <= 4; x++) {
        for (let z = -1; z <= 4; z++) {
          blocks.push({ x: bx + x, y: origin.y + 3, z: bz + z, blockName: 'oak_planks' });
        }
      }
    }

    // Paths
    for (let i = -12; i <= 12; i++) {
      blocks.push({ x: origin.x + i, y: origin.y - 1, z: origin.z - 3, blockName: 'gravel' });
    }

    // Torches
    blocks.push({ x: origin.x, y: origin.y + 1, z: origin.z - 2, blockName: 'torch', properties: { facing: 'north' } });
    blocks.push({ x: origin.x + 6, y: origin.y + 1, z: origin.z - 2, blockName: 'torch', properties: { facing: 'north' } });

    return {
      id: 'village_set',
      name: 'Sunset Village',
      blocks,
      mobs: [
        { entityType: 'villager', x: origin.x + 1, y: origin.y + 1, z: origin.z + 1, name: 'Villager1' },
        { entityType: 'villager', x: origin.x + 9, y: origin.y + 1, z: origin.z + 1, name: 'Villager2' },
      ],
      worldState: { time: 12000, weather: 'clear', doDaylightCycle: false, doWeatherCycle: false },
    };
  },

  /**
   * Battle arena with spectator vantage points.
   */
  arenaSet(origin = { x: 100, y: 64, z: 100 }) {
    const blocks = [];
    // Flat arena floor
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        blocks.push({ x: origin.x + x, y: origin.y - 1, z: origin.z + z, blockName: 'stone_bricks' });
      }
    }
    // Raised border walls
    for (let i = -11; i <= 11; i++) {
      blocks.push({ x: origin.x + i, y: origin.y, z: origin.z - 11, blockName: 'stone' });
      blocks.push({ x: origin.x + i, y: origin.y, z: origin.z + 11, blockName: 'stone' });
      blocks.push({ x: origin.x - 11, y: origin.y, z: origin.z + i, blockName: 'stone' });
      blocks.push({ x: origin.x + 11, y: origin.y, z: origin.z + i, blockName: 'stone' });
    }
    // Center feature
    blocks.push({ x: origin.x, y: origin.y, z: origin.z, blockName: 'diamond_block' });

    return {
      id: 'arena_set',
      name: 'Battle Arena',
      blocks,
      mobs: [],
      worldState: { time: 6000, weather: 'clear', doDaylightCycle: false, doWeatherCycle: false, gameRules: ['keepInventory true', 'mobGriefing false'] },
    };
  },
};

// ── Scene Graph ───────────────────────────────────────────────────────

/**
 * SceneGraph manages the full world state across multiple scenes.
 * Tracks what was placed/spawned so it can be cleaned up.
 */
class SceneGraph {
  constructor() {
    /** @type {Map<string, SceneSetup>} */
    this.scenes = new Map();
    /** @type {Map<string, string[]>} sceneId → executed command IDs for cleanup */
    this.executedCommands = new Map();
  }

  /**
   * Register a scene setup.
   * @param {SceneSetup} setup
   */
  addScene(setup) {
    this.scenes.set(setup.id, setup);
  }

  /**
   * Get setup commands for a scene.
   * @param {string} sceneId
   * @returns {string[]}
   */
  getSetupCommands(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene "${sceneId}" not found`);
    return generateSetupCommands(scene);
  }

  /**
   * Get cleanup commands for a scene.
   * @param {string} sceneId
   * @returns {string[]}
   */
  getCleanupCommands(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene "${sceneId}" not found`);
    return generateCleanupCommands(scene);
  }

  /**
   * Generate a full production sequence: set up each scene, then tear down in reverse.
   * @returns {{ setup: { sceneId: string, commands: string[] }[], cleanup: { sceneId: string, commands: string[] }[] }}
   */
  getProductionSequence() {
    const sceneIds = [...this.scenes.keys()];
    return {
      setup: sceneIds.map(id => ({ sceneId: id, commands: this.getSetupCommands(id) })),
      cleanup: [...sceneIds].reverse().map(id => ({ sceneId: id, commands: this.getCleanupCommands(id) })),
    };
  }

  /**
   * Export all scene setups as JSON for persistence.
   * @returns {SceneSetup[]}
   */
  exportAll() {
    return [...this.scenes.values()];
  }

  /**
   * Import scene setups from JSON.
   * @param {SceneSetup[]} setups
   */
  importAll(setups) {
    for (const setup of setups) {
      this.addScene(setup);
    }
  }
}

export { SceneGraph, PRESETS };
