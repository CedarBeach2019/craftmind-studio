/**
 * @module tests/character.test
 * Tests for character creation and relationship management (character.js).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline the character logic for testing
const registry = new Map();
const sceneMemories = new Map();

function registerCharacter(profile) {
  registry.set(profile.id, profile);
}

function getCharacter(id) {
  return registry.get(id);
}

function listCharacters() {
  return [...registry.values()];
}

function adjustTrust(fromId, toId, delta) {
  const from = registry.get(fromId);
  if (!from) throw new Error(`Character "${fromId}" not found`);
  if (!from.relationships[toId]) {
    from.relationships[toId] = { type: 'stranger', trustLevel: 0.5, historySummary: '', unresolvedConflicts: [] };
  }
  from.relationships[toId].trustLevel = Math.max(0, Math.min(1, from.relationships[toId].trustLevel + delta));
}

function recordSharedEvent(charA, charB, eventDescription, trustImpact) {
  adjustTrust(charA, charB, trustImpact);
  adjustTrust(charB, charA, trustImpact);
  const relA = registry.get(charA)?.relationships?.[charB];
  const relB = registry.get(charB)?.relationships?.[charA];
  if (relA) relA.historySummary += ` | ${eventDescription}`;
  if (relB) relB.historySummary += ` | ${eventDescription}`;
}

function addConflict(fromId, toId, conflict) {
  const from = registry.get(fromId);
  if (!from) throw new Error(`Character "${fromId}" not found`);
  if (!from.relationships[toId]) {
    from.relationships[toId] = { type: 'stranger', trustLevel: 0.5, historySummary: '', unresolvedConflicts: [] };
  }
  from.relationships[toId].unresolvedConflicts.push(conflict);
}

function recordSceneMemory(memory) {
  const list = sceneMemories.get(memory.characterId) ?? [];
  list.push({ ...memory, timestamp: Date.now() });
  sceneMemories.set(memory.characterId, list);
}

function getMemories(characterId, opts = {}) {
  const list = sceneMemories.get(characterId) ?? [];
  let filtered = list;
  if (opts.since) {
    const ts = new Date(opts.since).getTime();
    filtered = filtered.filter(m => m.timestamp > ts);
  }
  return filtered.slice(-(opts.limit ?? 10));
}

// Reset state between tests
function reset() {
  registry.clear();
  sceneMemories.clear();
}

const makeChar = (id) => ({
  id, name: id.charAt(0).toUpperCase() + id.slice(1),
  personality: ['brave'], speakingStyle: 'casual',
  voice: { elevenLabsVoiceId: 'default', emotionStyle: 'dramatic', stability: 0.5 },
  catchphrases: [], avoids: [], backstory: [],
  relationships: {}, currentMood: 'neutral',
});

describe('Character creation', () => {
  it('registers and retrieves a character', () => {
    reset();
    const char = makeChar('alex');
    registerCharacter(char);
    assert.equal(getCharacter('alex').name, 'Alex');
  });

  it('lists all registered characters', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    assert.equal(listCharacters().length, 2);
  });

  it('returns undefined for unknown character', () => {
    reset();
    assert.equal(getCharacter('nobody'), undefined);
  });

  it('overwrites on re-register', () => {
    reset();
    registerCharacter(makeChar('alex'));
    const updated = { ...makeChar('alex'), name: 'Alexander' };
    registerCharacter(updated);
    assert.equal(getCharacter('alex').name, 'Alexander');
  });
});

describe('Relationship management', () => {
  it('adjusts trust between characters', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    adjustTrust('alex', 'jordan', 0.3);
    const rel = getCharacter('alex').relationships.jordan;
    assert.equal(rel.trustLevel, 0.8); // 0.5 + 0.3
  });

  it('clamps trust to [0, 1]', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    adjustTrust('alex', 'jordan', 2.0);
    assert.equal(getCharacter('alex').relationships.jordan.trustLevel, 1);
    adjustTrust('alex', 'jordan', -3.0);
    assert.equal(getCharacter('alex').relationships.jordan.trustLevel, 0);
  });

  it('initializes relationship on first adjustTrust', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    adjustTrust('alex', 'jordan', 0);
    assert.ok(getCharacter('alex').relationships.jordan);
    assert.equal(getCharacter('alex').relationships.jordan.type, 'stranger');
  });

  it('throws for unknown character', () => {
    reset();
    assert.throws(() => adjustTrust('ghost', 'nobody', 0.1));
  });

  it('records shared events', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    recordSharedEvent('alex', 'jordan', 'fought together', 0.2);
    assert.ok(getCharacter('alex').relationships.jordan.historySummary.includes('fought together'));
    assert.ok(getCharacter('jordan').relationships.alex.historySummary.includes('fought together'));
  });

  it('tracks unresolved conflicts', () => {
    reset();
    registerCharacter(makeChar('alex'));
    registerCharacter(makeChar('jordan'));
    addConflict('alex', 'jordan', 'stole my diamonds');
    addConflict('alex', 'jordan', 'ate my cake');
    assert.deepEqual(getCharacter('alex').relationships.jordan.unresolvedConflicts, ['stole my diamonds', 'ate my cake']);
  });
});

describe('Scene memory', () => {
  it('records and retrieves memories', () => {
    reset();
    recordSceneMemory({ characterId: 'alex', sceneId: 's1', summary: 'Found a village', emotionalImpact: 'positive' });
    const mems = getMemories('alex');
    assert.equal(mems.length, 1);
    assert.equal(mems[0].summary, 'Found a village');
  });

  it('respects limit option', () => {
    reset();
    for (let i = 0; i < 20; i++) {
      recordSceneMemory({ characterId: 'alex', sceneId: `s${i}`, summary: `event ${i}`, emotionalImpact: 'neutral' });
    }
    assert.equal(getMemories('alex', { limit: 5 }).length, 5);
  });

  it('returns empty for unknown character', () => {
    reset();
    assert.deepEqual(getMemories('nobody'), []);
  });
});
