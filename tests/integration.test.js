import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerCharacter, getCharacter, listCharacters } from '../src/character.js';
import { composeShot, calculateDOF } from '../src/composition.js';
import { generateSoundPlan, getAmbientForBiome, getFootstepForBlock } from '../src/sound-design.js';
import { buildBeatSequence, generateSRT } from '../src/dialogue-beats.js';
import { StudioLot } from '../src/studio-lot.js';
import { Star, StarRegistry } from '../src/star-system.js';
import { StudioFinance } from '../src/finance.js';
import { EraSystem } from '../src/era-progression.js';
import { AudienceSystem } from '../src/audience.js';
import { CrisisSystem } from '../src/crisis-events.js';
import { TakeManager } from '../src/takes.js';
import { QUALITY_PRESETS, ASPECT_RATIOS } from '../src/post-production.js';
import { Production } from '../src/production-pipeline.js';
import { AwardCeremony } from '../src/awards.js';

// Note: Director, renderer, audio modules require API keys or mineflayer.
// Those are tested separately in existing test files.

describe('Character System', () => {
  it('registers and retrieves characters', () => {
    registerCharacter({
      id: 'hero', name: 'Hero', personality: ['brave'],
      speakingStyle: 'casual', voice: {}, catchphrases: [], avoids: [], backstory: [], relationships: {}, currentMood: 'determined',
    });
    const c = getCharacter('hero');
    assert.equal(c.name, 'Hero');
    assert.ok(listCharacters().length >= 1);
  });

  it('tracks continuity across characters', () => {
    registerCharacter({
      id: 'sidekick', name: 'Robin', personality: ['loyal'],
      speakingStyle: 'casual', voice: {}, catchphrases: [], avoids: [], backstory: [], relationships: { hero: 'friend' }, currentMood: 'cheerful',
    });
    const c = getCharacter('sidekick');
    assert.ok(c.relationships.hero, 'should track relationships');
  });
});

describe('Composition & Camera', () => {
  it('composes a shot with primary subject', () => {
    const comp = composeShot({
      subjects: [{ id: 'a', x: 0, y: 64, z: 0, importance: 0.9, role: 'primary' }],
      shotType: 'medium', mood: 'dramatic', durationSec: 5,
    });
    assert.ok(comp.camera, 'should have camera position');
    assert.ok(comp.appliedRules.length >= 1, 'should apply composition rules');
  });

  it('composes a shot with multiple subjects', () => {
    const comp = composeShot({
      subjects: [
        { id: 'a', x: 0, y: 64, z: 0, importance: 0.9, role: 'primary' },
        { id: 'b', x: 3, y: 64, z: 0, importance: 0.5, role: 'secondary' },
      ],
      shotType: 'wide', mood: 'neutral', durationSec: 10,
    });
    assert.ok(comp.camera);
  });

  it('calculates depth of field', () => {
    const dof = calculateDOF({ focalLength: 50, aperture: 2.8, subjectDistance: 10 });
    assert.ok(dof.description);
    assert.ok(typeof dof.aperture === 'number');
  });
});

describe('Sound Design', () => {
  it('gets ambient sounds for biome', () => {
    const ambient = getAmbientForBiome('desert');
    assert.ok(Array.isArray(ambient));
    assert.ok(ambient.length >= 1);
  });

  it('gets footstep sounds for block type', () => {
    const steps = getFootstepForBlock('stone');
    assert.ok(steps, 'should return footstep sound');
  });

  it('generates a comprehensive sound plan', () => {
    const plan = generateSoundPlan({ biome: 'forest', weather: 'rain', durationSec: 30, characters: [{ id: 'a', moving: true }], events: [] });
    assert.ok(plan);
  });
});

describe('Beat Sequence & Subtitles', () => {
  it('builds beat sequence from dialogue', () => {
    const beats = buildBeatSequence({
      sceneId: 'test',
      dialogue: [{ characterId: 'a', text: 'Hello world', emotion: 'neutral' }],
      pacing: 'normal',
    });
    assert.ok(beats.beats.length >= 1);
    assert.ok(beats.totalDurationSec > 0);
  });

  it('generates SRT format subtitles', () => {
    const beats = buildBeatSequence({
      sceneId: 'test',
      dialogue: [{ characterId: 'a', text: 'Hello world', emotion: 'neutral' }],
      pacing: 'normal',
    });
    const srt = generateSRT(beats);
    assert.ok(srt.includes('1\n'), 'should have subtitle index');
    assert.ok(srt.includes('-->'), 'should have timestamp separator');
  });
});

describe('Studio Tycoon', () => {
  it('StudioLot places buildings', () => {
    const lot = new StudioLot();
    lot.placeBuilding('script_office', { x: 0, z: 0 });
    assert.equal(lot.getBuildings().length, 1);
  });

  it('StudioLot detects adjacency bonuses', () => {
    const lot = new StudioLot();
    lot.placeBuilding('script_office', { x: 0, z: 0 });
    lot.placeBuilding('screening_room', { x: 3, z: 0 });
    assert.ok(lot.getActiveBonuses().length >= 1);
  });

  it('StarRegistry registers stars', () => {
    const registry = new StarRegistry();
    const star = new Star({ name: 'Test Actor', genre: 'drama' });
    registry.register(star);
    assert.ok(registry.get(star.id), 'should retrieve registered star');
  });

  it('StudioFinance tracks budget', () => {
    const finance = new StudioFinance(100000);
    finance.spend(10000, 'set construction');
    const summary = finance.getSummary();
    assert.ok(typeof summary === 'object');
  });

  it('EraSystem has starting era', () => {
    const era = new EraSystem();
    assert.ok(era.era, 'should have era property');
  });

  it('AudienceSystem supports reviews', () => {
    const audience = new AudienceSystem();
    const result = audience.review({ genre: 'drama', quality: 0.8 });
    assert.ok(typeof result === 'object', 'review should return an object');
  });

  it('CrisisSystem can be instantiated', () => {
    const crisis = new CrisisSystem();
    assert.ok(crisis);
  });
});

describe('TakeManager', () => {
  it('starts and completes takes', () => {
    const tm = new TakeManager();
    const take = tm.startTake(1, { notes: 'test' });
    tm.completeTake(take.id, { cameraSmoothness: 0.9 });
    const best = tm.selectBestTake(1);
    assert.ok(best, 'should have a best take');
    assert.ok(best.metrics.overallScore > 0);
  });
});

describe('Production Pipeline', () => {
  it('creates a production with stages', () => {
    const p = new Production({ title: 'Test Movie' });
    assert.ok(p);
  });
});

describe('AwardCeremony', () => {
  it('can be instantiated', () => {
    const awards = new AwardCeremony();
    assert.ok(awards);
  });
});

describe('Presets', () => {
  it('has quality presets', () => {
    assert.ok(typeof QUALITY_PRESETS === 'object', 'presets should be an object');
  });

  it('has aspect ratios', () => {
    assert.ok(ASPECT_RATIOS['16:9']);
  });
});
