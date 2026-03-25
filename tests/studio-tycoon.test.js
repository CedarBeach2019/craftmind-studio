import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StudioLot, BUILDING_TYPES } from '../src/studio-lot.js';
import { Star, StarRegistry } from '../src/star-system.js';
import { Production, STAGES, STAGE_ORDER } from '../src/production-pipeline.js';
import { StudioFinance } from '../src/finance.js';
import { AwardCeremony, AWARD_CATEGORIES } from '../src/awards.js';
import { EraSystem, ERAS } from '../src/era-progression.js';
import { CrisisSystem, CRISIS_TYPES } from '../src/crisis-events.js';
import { AudienceSystem } from '../src/audience.js';

// ── Studio Lot ───────────────────────────────────────────────────────

describe('StudioLot', () => {
  it('places buildings and tracks them', () => {
    const lot = new StudioLot();
    const b = lot.placeBuilding('script_office', { x: 0, z: 0 });
    assert.equal(b.type, 'script_office');
    assert.equal(lot.getBuildings().length, 1);
  });

  it('prevents overlapping placement', () => {
    const lot = new StudioLot();
    lot.placeBuilding('sound_stage_large', { x: 0, z: 0 });
    assert.throws(() => lot.placeBuilding('script_office', { x: 1, z: 1 }));
  });

  it('detects adjacency bonuses', () => {
    const lot = new StudioLot();
    lot.placeBuilding('script_office', { x: 0, z: 0 });
    lot.placeBuilding('screening_room', { x: 3, z: 0 });
    const bonuses = lot.getActiveBonuses();
    assert.ok(bonuses.length >= 1, 'should have at least one adjacency bonus');
    assert.ok(bonuses.some(b => b.label === 'Script Feedback Loop'));
  });

  it('calculates maintenance cost', () => {
    const lot = new StudioLot();
    lot.placeBuilding('script_office', { x: 0, z: 0, tier: 2 });
    const cost = lot.getMaintenanceCost();
    assert.ok(cost > 0);
  });

  it('upgrades buildings', () => {
    const lot = new StudioLot();
    const b = lot.placeBuilding('script_office', { x: 0, z: 0, tier: 1 });
    lot.upgradeBuilding(b.id);
    assert.equal(lot.getBuildings()[0].tier, 2);
    assert.equal(lot.upgradeBuilding(b.id), true); // tier 3
    // Can't go above 5
    for (let i = 0; i < 5; i++) lot.upgradeBuilding(b.id);
    assert.equal(lot.getBuildings()[0].tier, 5);
  });

  it('serializes and deserializes', () => {
    const lot = new StudioLot({ name: 'Test' });
    lot.placeBuilding('script_office', { x: 5, z: 5 });
    const json = lot.toJSON();
    const restored = StudioLot.fromJSON(json);
    assert.equal(restored.name, 'Test');
    assert.equal(restored.getBuildings().length, 1);
  });
});

// ── Star System ──────────────────────────────────────────────────────

describe('Star', () => {
  it('creates with defaults', () => {
    const star = new Star({ name: 'Test' });
    assert.equal(star.name, 'Test');
    assert.equal(star.mood, 70);
    assert.ok(star.talent.drama >= 1);
  });

  it('genre fit considers mood, stress, career phase', () => {
    const star = new Star({ name: 'A', talent: { drama: 10 }, mood: 100, stress: 0, careerPhase: 'peak' });
    const fit = star.genreFit('drama');
    assert.ok(fit > 8, `expected high fit, got ${fit}`);
  });

  it('mood and stress clamp to 0-100', () => {
    const star = new Star({ name: 'A' });
    star.adjustMood(200);
    assert.equal(star.mood, 100);
    star.adjustStress(-200);
    assert.equal(star.stress, 0);
  });

  it('work day changes stress/mood based on personality', () => {
    const method = new Star({ name: 'M', personality: 'method', talent: { horror: 2 } });
    const result = method.workDay('horror');
    assert.ok(method.stress > 20, 'method actor should get stressed in bad fit');
  });

  it('meltdowns happen at high stress', () => {
    const star = new Star({ name: 'M', personality: 'method', stress: 96, mood: 10 });
    // Multiple attempts to trigger meltdown
    let melted = false;
    for (let i = 0; i < 50; i++) {
      const result = new Star({ name: 'X', personality: 'method', stress: 96, mood: 10 }).workDay('horror');
      if (result && result.type === 'meltdown') { melted = true; break; }
    }
    assert.ok(melted, 'should eventually meltdown');
  });

  it('chemistry bonus works', () => {
    const a = new Star({ name: 'A' });
    const b = new Star({ name: 'B' });
    a.setChemistry('b', 0.8);
    assert.ok(a.getChemistryBonus('b') > 0);
    a.setChemistry('b', -0.5);
    assert.ok(a.getChemistryBonus('b') < 0);
  });

  it('salary increases with popularity', () => {
    const star = new Star({ name: 'A', popularity: 50, salary: 100 });
    star.advanceCareer(9); // great film
    assert.ok(star.salary > 100);
  });

  it('willAccept checks fit, budget, mood', () => {
    const star = new Star({ name: 'A', mood: 10, stress: 95 });
    assert.equal(star.willAccept('drama', 10000), false);
  });
});

describe('StarRegistry', () => {
  it('searches by criteria', () => {
    const reg = new StarRegistry();
    reg.register(new Star({ name: 'A', role: 'director' }));
    reg.register(new Star({ name: 'B', role: 'actor' }));
    assert.equal(reg.search({ role: 'director' }).length, 1);
  });
});

// ── Production Pipeline ──────────────────────────────────────────────

describe('Production', () => {
  it('advances through all stages', () => {
    const prod = new Production({ title: 'Test', genre: 'drama', budget: 50000 });
    prod.fastForward();
    assert.equal(prod.status, 'released');
    assert.ok(prod.dayCount > 0);
  });

  it('quality is calculated', () => {
    const prod = new Production({ title: 'Test', genre: 'drama', budget: 50000, director: new Star({ name: 'Dir', role: 'director' }), cast: [new Star({ name: 'A' })] });
    prod.fastForward();
    assert.ok(prod.totalQuality > 0);
  });

  it('stage order is correct', () => {
    assert.equal(STAGE_ORDER[0], 'script');
    assert.equal(STAGE_ORDER[STAGE_ORDER.length - 1], 'release');
  });

  it('returns results from advanceDay', () => {
    const prod = new Production({ title: 'T', genre: 'drama', budget: 50000 });
    const result = prod.advanceDay(null);
    assert.ok(result);
    assert.equal(result.stage, 'script');
  });
});

// ── Finance ──────────────────────────────────────────────────────────

describe('StudioFinance', () => {
  it('tracks spending and income', () => {
    const fin = new StudioFinance({ treasury: 1000 });
    fin.spend(200);
    fin.receive(500);
    assert.equal(fin.treasury, 1300);
  });

  it('prevents overspending', () => {
    const fin = new StudioFinance({ treasury: 50 });
    assert.equal(fin.spend(100), false);
  });

  it('loans work with interest', () => {
    const fin = new StudioFinance({ treasury: 0 });
    const loan = fin.takeLoan(1000);
    assert.ok(loan.owed > 1000);
    assert.equal(fin.treasury, 1000);
  });

  it('box office calculation works', () => {
    const fin = new StudioFinance({ treasury: 10000, reputation: 50 });
    fin.setGenreTrend('drama', 0.8);
    const star = new Star({ name: 'A', popularity: 80, fanBase: 500 });
    const box = fin.calculateBoxOffice({ quality: 8, genre: 'drama', cast: [star], title: 'Test' });
    assert.ok(box.gross > 0);
  });

  it('releaseFilm records history', () => {
    const fin = new StudioFinance({ treasury: 5000 });
    fin.releaseFilm({ quality: 7, genre: 'drama', title: 'Test Film', initialBudget: 3000 });
    assert.equal(fin.filmHistory.length, 1);
    assert.ok(fin.filmHistory[0].profit !== undefined);
  });

  it('genre trends shift', () => {
    const fin = new StudioFinance();
    fin.setGenreTrend('action', 0.5);
    fin.shiftTrends();
    // Should still be within bounds
    assert.ok(fin.getGenreTrend('action') >= 0);
    assert.ok(fin.getGenreTrend('action') <= 1);
  });
});

// ── Awards ───────────────────────────────────────────────────────────

describe('AwardCeremony', () => {
  it('auto-nominates and holds ceremony', () => {
    const ceremony = new AwardCeremony({ year: 2026 });
    const film = {
      title: 'Test Film', genre: 'drama', quality: 8,
      director: new Star({ name: 'Dir', role: 'director', talent: { drama: 9 } }),
      cast: [new Star({ name: 'Actor', role: 'actor', popularity: 60 })],
    };
    ceremony.autoNominate([film]);
    ceremony.holdShow();
    const results = ceremony.getResults();
    assert.ok(Object.keys(results).length > 0);
  });

  it('revealNext returns awards one at a time', () => {
    const ceremony = new AwardCeremony();
    ceremony.autoNominate([{ title: 'T', genre: 'drama', quality: 5, cast: [] }]);
    ceremony.holdShow();
    let count = 0;
    while (ceremony.revealNext()) count++;
    assert.ok(count > 0);
  });

  it('detects snubs', () => {
    const ceremony = new AwardCeremony();
    ceremony.autoNominate([{ title: 'T', genre: 'drama', quality: 3, cast: [] }]);
    const snubs = ceremony.checkSnubs([new Star({ name: 'Big', popularity: 80, filmsCount: 5 })]);
    assert.ok(snubs.length > 0);
  });
});

// ── Era Progression ──────────────────────────────────────────────────

describe('EraSystem', () => {
  it('starts in correct era for year', () => {
    const era = new EraSystem({ startYear: 2026 });
    assert.equal(era.era.id, 'streaming');
  });

  it('advances through eras', () => {
    const era = new EraSystem({ startYear: 1920 });
    const result = era.advance(15); // 1920 → 1935 → golden age
    assert.ok(result !== null);
    assert.equal(era.era.id, 'golden_age');
  });

  it('hasTech checks work', () => {
    const silent = new EraSystem({ startYear: 1920 });
    assert.equal(silent.hasTech('sound'), false);
    assert.equal(silent.hasTech('color'), false);

    const modern = new EraSystem({ startYear: 2026 });
    assert.equal(modern.hasTech('sound'), true);
    assert.equal(modern.hasTech('cgi'), true);
  });

  it('genre availability varies by era', () => {
    const silent = new EraSystem({ startYear: 1920 });
    assert.equal(silent.hasGenre('action'), true);
    assert.equal(silent.hasGenre('sci_fi'), false);

    const modern = new EraSystem({ startYear: 2026 });
    assert.equal(modern.hasGenre('sci_fi'), true);
  });
});

// ── Crisis Events ────────────────────────────────────────────────────

describe('CrisisSystem', () => {
  it('triggers specific crises', () => {
    const sys = new CrisisSystem();
    const prod = new Production({ title: 'T', genre: 'drama', budget: 10000 });
    const crisis = sys.trigger('set_fire', prod);
    assert.ok(crisis);
    assert.equal(crisis.severity, 'high');
    assert.ok(crisis.options.length > 0);
  });

  it('resolves crises with options', () => {
    const sys = new CrisisSystem();
    const prod = new Production({ title: 'T', genre: 'drama', budget: 10000, cast: [new Star({ name: 'A' })] });
    const crisis = sys.trigger('actor_quits', prod, { actor: { name: 'A' } });
    const result = sys.resolve(crisis.id, 0);
    assert.ok(result);
    assert.ok('success' in result);
  });

  it('triggerRandom produces valid crises', () => {
    const sys = new CrisisSystem();
    const prod = new Production({ title: 'T', genre: 'drama', budget: 10000, cast: [new Star({ name: 'A' })], director: new Star({ name: 'D', role: 'director' }) });
    // Try multiple times to ensure at least some fire
    let triggered = false;
    for (let i = 0; i < 20; i++) {
      const c = sys.triggerRandom(prod);
      if (c) { triggered = true; sys.resolve(c.id, 0); }
    }
    assert.ok(triggered, 'should trigger at least one crisis in 20 tries');
  });

  it('all crisis types have options', () => {
    for (const [type, def] of Object.entries(CRISIS_TYPES)) {
      assert.ok(def.name, `${type} should have a name`);
      assert.ok(def.severity, `${type} should have severity`);
      const ctx = type === 'actor_quits' ? { actor: { name: 'A' } } : {};
      const result = def.resolve({ title: 'T', genre: 'drama', budget: 10000, cast: [new Star({ name: 'A' })], director: new Star({ name: 'D', role: 'director' }) }, ctx);
      assert.ok(result.options.length > 0, `${type} should have options`);
    }
  });
});

// ── Audience Reviews ─────────────────────────────────────────────────

describe('AudienceSystem', () => {
  it('generates reviews with scores', () => {
    const aud = new AudienceSystem();
    const review = aud.review({ title: 'Test', genre: 'drama', quality: 8, cast: [] });
    assert.ok(review.score >= 1 && review.score <= 10);
    assert.ok(review.criticReview.length > 0);
    assert.ok(review.audienceReview.length > 0);
    assert.ok(['excellent', 'mixed', 'negative', 'terrible'].includes(review.wordOfMouth));
  });

  it('high quality produces better scores', () => {
    const aud = new AudienceSystem();
    const good = aud.review({ title: 'A', genre: 'drama', quality: 9, cast: [] });
    const bad = aud.review({ title: 'B', genre: 'drama', quality: 2, cast: [] });
    // Not guaranteed due to randomness, but likely
    assert.ok(good.criticScore > bad.criticScore, `good=${good.criticScore} should beat bad=${bad.criticScore}`);
  });

  it('word of mouth multiplier changes over time', () => {
    const aud = new AudienceSystem();
    aud.review({ title: 'Test', genre: 'drama', quality: 9, cast: [] });
    const mul30 = aud.getWordOfMouthMultiplier('Test', 30);
    const mul0 = aud.getWordOfMouthMultiplier('Test', 0);
    assert.ok(mul30 > mul0, 'good film should grow over time');
  });
});

console.log('All tests registered. Run: node --test tests/studio-tycoon.test.js');
