/**
 * @module tests/behavior-script.test
 * Tests for behavior script validation (dialogue format validation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Validate a behavior/dialogue script format.
 * Expected format per line: CHARACTER_ID: "Dialogue" (emotion)
 * Blank lines and [stage directions] are allowed.
 *
 * @param {string} script
 * @returns {{ valid: boolean, errors: string[], lines: { characterId: string, line: string, emotion: string, lineNumber: number }[] }}
 */
function validateBehaviorScript(script) {
  const errors = [];
  const lines = [];
  const scriptLines = script.split('\n');

  for (let i = 0; i < scriptLines.length; i++) {
    const raw = scriptLines[i].trim();
    if (!raw || raw.startsWith('[') || raw.startsWith('//')) continue;

    const regex = /^(\w+):\s*"([^"]*)"\s*\(([^)]+)\)$/;
    const match = raw.match(regex);

    if (!match) {
      errors.push(`Line ${i + 1}: invalid format — expected CHARACTER: "dialogue" (emotion)`);
      continue;
    }

    const characterId = match[1];
    const dialogue = match[2];
    const emotion = match[3];

    if (dialogue.length === 0) {
      errors.push(`Line ${i + 1}: empty dialogue`);
    }

    if (!/^[a-z_]+$/.test(characterId)) {
      errors.push(`Line ${i + 1}: character ID "${characterId}" should be lowercase alphanumeric with underscores`);
    }

    lines.push({ characterId, line: dialogue, emotion, lineNumber: i + 1 });
  }

  return { valid: errors.length === 0, errors, lines };
}

describe('Behavior script validation', () => {
  it('accepts a well-formed script', () => {
    const script = `alex: "What was that?!" (fear)
jordan: "Just the wind." (calm)
[alex looks around nervously]
alex: "I don't think so." (suspicious)`;

    const result = validateBehaviorScript(script);
    assert.equal(result.valid, true);
    assert.equal(result.lines.length, 3);
    assert.equal(result.errors.length, 0);
  });

  it('allows blank lines and stage directions', () => {
    const result = validateBehaviorScript('\n[jordan enters]\n\nalex: "Hey." (neutral)\n');
    assert.equal(result.valid, true);
    assert.equal(result.lines.length, 1);
  });

  it('rejects missing quotes', () => {
    const result = validateBehaviorScript('alex: What was that (fear)');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('invalid format'));
  });

  it('rejects missing emotion', () => {
    const result = validateBehaviorScript('alex: "Hello"');
    assert.equal(result.valid, false);
  });

  it('rejects uppercase character IDs', () => {
    const result = validateBehaviorScript('Alex: "Hello" (neutral)');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('lowercase'));
  });

  it('rejects empty dialogue', () => {
    const result = validateBehaviorScript('alex: "" (neutral)');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('empty dialogue')));
  });

  it('handles multiple errors', () => {
    const result = validateBehaviorScript('Bad Line\nAlex: "Hi"');
    assert.ok(result.errors.length >= 2);
  });

  it('returns empty lines for completely empty script', () => {
    const result = validateBehaviorScript('');
    assert.equal(result.valid, true);
    assert.equal(result.lines.length, 0);
  });
});
