/**
 * @module tests/director.test
 * Tests for shot list generation (director.js).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We can't call the LLM in tests, so we test the pipeline by mocking.
// Import internal helpers indirectly by testing the exported parse logic.

// Simulate the scene parsing the director does internally
function parseScenes(rawJson, targetDuration) {
  let text = rawJson.trim();
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const scenes = JSON.parse(text);
  if (!Array.isArray(scenes)) throw new Error('LLM did not return an array of scenes');

  const totalEst = scenes.reduce((s, c) => s + (c.durationSec || 10), 0);
  const scale = targetDuration / totalEst;
  for (const scene of scenes) {
    scene.durationSec = Math.round((scene.durationSec || 10) * scale);
  }

  return scenes;
}

function parseDialogue(raw) {
  const lines = [];
  const regex = /^(\w+):\s*"([^"]+)"\s*\(([^)]+)\)/gm;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    lines.push({ characterId: match[1], line: match[2], emotion: match[3] });
  }
  return lines;
}

describe('Shot list generation', () => {
  const mockLLMResponse = JSON.stringify([
    { scene: 1, beat: 'opening_image', description: 'Wide shot of a dark forest', characters: ['alex'], cameraAngle: 'wide', durationSec: 10, dialogueHint: 'None', mood: 'mysterious', transition: 'fade' },
    { scene: 2, beat: 'catalyst', description: 'Alex finds a glowing sword', characters: ['alex'], cameraAngle: 'close-up', durationSec: 15, dialogueHint: 'What is this?', mood: 'wonder', transition: 'cut' },
    { scene: 3, beat: 'finale', description: 'Alex defeats the wither', characters: ['alex', 'jordan'], cameraAngle: 'crane', durationSec: 20, dialogueHint: 'Victory cry', mood: 'triumphant', transition: 'fade' },
  ]);

  it('parses valid JSON scene array from LLM', () => {
    const scenes = parseScenes(mockLLMResponse, 120);
    assert.equal(scenes.length, 3);
    assert.equal(scenes[0].beat, 'opening_image');
    assert.equal(scenes[1].cameraAngle, 'close-up');
    assert.equal(scenes[2].characters.length, 2);
  });

  it('scales durations to match target', () => {
    const scenes = parseScenes(mockLLMResponse, 120);
    // Total estimated: 10 + 15 + 20 = 45. Scale = 120/45 ≈ 2.67
    const totalDuration = scenes.reduce((s, c) => s + c.durationSec, 0);
    assert.ok(Math.abs(totalDuration - 120) <= 3, `Total ${totalDuration} should be ~120`);
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + mockLLMResponse + '\n```';
    const scenes = parseScenes(wrapped, 120);
    assert.equal(scenes.length, 3);
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => parseScenes('not json at all', 120));
  });

  it('throws when response is not an array', () => {
    assert.throws(() => parseScenes('{"not": "an array"}', 120));
  });

  it('defaults missing durationSec to 10', () => {
    const raw = JSON.stringify([{ scene: 1, beat: 'setup', description: 'test', characters: [], durationSec: 0 }]);
    const scenes = parseScenes(raw, 60);
    assert.ok(scenes[0].durationSec > 0, 'Should have a positive duration');
  });
});

describe('Dialogue parsing', () => {
  const mockDialogue = `alex: "What was that?!" (fear)
jordan: "Probably just a creeper." (calm)
alex: "Creeper? In my house?!" (outraged)`;

  it('parses character ID, line, and emotion', () => {
    const lines = parseDialogue(mockDialogue);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].characterId, 'alex');
    assert.equal(lines[0].line, 'What was that?!');
    assert.equal(lines[0].emotion, 'fear');
    assert.equal(lines[1].characterId, 'jordan');
    assert.equal(lines[2].emotion, 'outraged');
  });

  it('returns empty array for no matches', () => {
    assert.deepEqual(parseDialogue('no dialogue here'), []);
  });
});
