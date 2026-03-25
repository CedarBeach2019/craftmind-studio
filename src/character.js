/**
 * @module character
 * Character system — persistent profiles with personality, voice, memory, and relationships.
 */

/**
 * @typedef {object} CharacterProfile
 * @property {string} id            — Unique identifier (e.g. "alex_minecraft")
 * @property {string} name          — Display name
 * @property {string[]} personality — Core trait descriptors
 * @property {string} speakingStyle — How they talk (short sentences, formal, sarcastic…)
 * @property {object}  voice        — Voice configuration
 * @property {string}  voice.elevenLabsVoiceId  — ElevenLabs voice ID
 * @property {string}  voice.emotionStyle        — "dramatic" | "deadpan" | "warm" | "intense"
 * @property {number}  voice.stability           — Voice stability (0-1)
 * @property {number}  [voice.similarity]        — Similarity boost (0-1, default 0.75)
 * @property {string[]} catchphrases  — Recurring lines or verbal tics
 * @property {string[]} avoids       — Topics they avoid
 * @property {string[]} backstory    — Key past events
 * @property {object<string, Relationship>} relationships — Map of character ID → relationship
 * @property {string}  currentMood   — Emotional state at start of scene
 */

/**
 * @typedef {object} Relationship
 * @property {string}  type         — "partner" | "rival" | "mentor" | "stranger" | "family"
 * @property {number}  trustLevel   — 0.0 (no trust) to 1.0 (full trust)
 * @property {string}  historySummary
 * @property {string[]} unresolvedConflicts
 */

// ── Character Registry ────────────────────────────────────────────────

const registry = new Map();

/**
 * Register a new character or update an existing one.
 * @param {CharacterProfile} profile
 */
export function registerCharacter(profile) {
  registry.set(profile.id, profile);
}

/**
 * Retrieve a character profile by ID.
 * @param {string} id
 * @returns {CharacterProfile | undefined}
 */
export function getCharacter(id) {
  return registry.get(id);
}

/**
 * List all registered characters.
 * @returns {CharacterProfile[]}
 */
export function listCharacters() {
  return [...registry.values()];
}

// ── Relationship Management ───────────────────────────────────────────

/**
 * Update the trust level between two characters.
 * @param {string} fromId — The character whose trust changes
 * @param {string} toId   — The character being trusted/distrusted
 * @param {number} delta  — Amount to shift trust (positive or negative), clamped to [0,1]
 */
export function adjustTrust(fromId, toId, delta) {
  const from = registry.get(fromId);
  if (!from) throw new Error(`Character "${fromId}" not found`);

  if (!from.relationships[toId]) {
    from.relationships[toId] = {
      type: 'stranger',
      trustLevel: 0.5,
      historySummary: '',
      unresolvedConflicts: [],
    };
  }

  const rel = from.relationships[toId];
  rel.trustLevel = Math.max(0, Math.min(1, rel.trustLevel + delta));
}

/**
 * Record a shared event in the relationship between two characters.
 * @param {string} charA
 * @param {string} charB
 * @param {string} eventDescription
 * @param {number} trustImpact
 */
export function recordSharedEvent(charA, charB, eventDescription, trustImpact) {
  adjustTrust(charA, charB, trustImpact);
  adjustTrust(charB, charA, trustImpact);

  const relA = registry.get(charA)?.relationships?.[charB];
  const relB = registry.get(charB)?.relationships?.[charA];
  if (relA) relA.historySummary += ` | ${eventDescription}`;
  if (relB) relB.historySummary += ` | ${eventDescription}`;
}

/**
 * Add an unresolved conflict to a relationship.
 * @param {string} fromId
 * @param {string} toId
 * @param {string} conflict
 */
export function addConflict(fromId, toId, conflict) {
  const from = registry.get(fromId);
  if (!from) throw new Error(`Character "${fromId}" not found`);
  if (!from.relationships[toId]) {
    from.relationships[toId] = { type: 'stranger', trustLevel: 0.5, historySummary: '', unresolvedConflicts: [] };
  }
  from.relationships[toId].unresolvedConflicts.push(conflict);
}

// ── Scene Memory ──────────────────────────────────────────────────────

/**
 * @typedef {object} SceneMemory
 * @property {string} characterId
 * @property {string} sceneId
 * @property {string} summary
 * @property {string} emotionalImpact — "positive" | "negative" | "neutral" | "intense"
 * @property {number} timestamp
 */

const sceneMemories = new Map(); // characterId → SceneMemory[]

/**
 * Record what a character experienced in a scene.
 * @param {SceneMemory} memory
 */
export function recordSceneMemory(memory) {
  const list = sceneMemories.get(memory.characterId) ?? [];
  list.push({ ...memory, timestamp: Date.now() });
  sceneMemories.set(memory.characterId, list);
}

/**
 * Get a character's scene memories, optionally filtered.
 * @param {string} characterId
 * @param {object} [opts]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.since] — ISO timestamp; only memories after this
 * @returns {SceneMemory[]}
 */
export function getMemories(characterId, opts = {}) {
  const list = sceneMemories.get(characterId) ?? [];
  let filtered = list;
  if (opts.since) {
    const ts = new Date(opts.since).getTime();
    filtered = filtered.filter(m => m.timestamp > ts);
  }
  return filtered.slice(-(opts.limit ?? 10));
}

/**
 * Generate a continuity summary for a character (useful as LLM context).
 * @param {string} characterId
 * @returns {string}
 */
export function getContinuitySummary(characterId) {
  const profile = registry.get(characterId);
  if (!profile) return `Character "${characterId}" not found.`;

  const mems = getMemories(characterId, { limit: 5 });
  const rels = Object.entries(profile.relationships)
    .map(([id, r]) => `${id}: trust=${r.trustLevel.toFixed(2)}, ${r.type}`)
    .join('; ');

  return `${profile.name} (${profile.currentMood}). Relationships: ${rels}. Recent: ${mems.map(m => m.summary).join(' → ')}`;
}

// ── Serialization ─────────────────────────────────────────────────────

/**
 * Export all character data as JSON (for persistence).
 * @returns {object}
 */
export function exportUniverse() {
  return {
    characters: [...registry.values()],
    sceneMemories: Object.fromEntries(sceneMemories),
  };
}

/**
 * Import previously exported universe data.
 * @param {object} data — Output of exportUniverse()
 */
export function importUniverse(data) {
  for (const profile of data.characters ?? []) {
    registry.set(profile.id, profile);
  }
  for (const [id, mems] of Object.entries(data.sceneMemories ?? {})) {
    sceneMemories.set(id, mems);
  }
}
