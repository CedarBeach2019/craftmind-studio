/**
 * Studio Tycoon Demo — a full management cycle in CraftMind Studio.
 * Run: node examples/studio-tycoon-demo.js
 */

import {
  StudioLot, Star, StarRegistry, Production, StudioFinance,
  AwardCeremony, EraSystem, CrisisSystem, AudienceSystem,
  CompetitorStudio, CompetitorLeague, DailyRoutine,
} from '../src/index.js';

console.log('🎬 ═══════════════════════════════════════════════════');
console.log('   CRAFTMIND STUDIO — Studio Tycoon Mode');
console.log('   The Movies × Game Dev Tycoon × Minecraft');
console.log('════════════════════════════════════════════════════\n');

// ── 1. Build the Studio Lot ──────────────────────────────────────────

const lot = new StudioLot({ name: 'CraftMind Studios' });
lot.placeBuilding('script_office', { x: 0, z: 0, tier: 2 });
lot.placeBuilding('screening_room', { x: 4, z: 0 });  // Adjacent to script → bonus!
lot.placeBuilding('set_workshop', { x: 12, z: 0 });
lot.placeBuilding('sound_stage_med', { x: 12, z: 5 }); // Adjacent to set workshop → bonus!
lot.placeBuilding('post_production', { x: 0, z: 5 });
lot.placeBuilding('costume_dept', { x: 4, z: 5 });
lot.placeBuilding('award_shelf', { x: 0, z: 10 });
lot.placeBuilding('research_lab', { x: 8, z: 10 });
lot.placeBuilding('vip_lounge', { x: 12, z: 10 });

console.log('🏗️  Studio Lot:');
for (const b of lot.getBuildings()) {
  console.log(`   ${b.type.replace(/_/g, ' ')} at (${b.x}, ${b.z}) — Tier ${b.tier}`);
}
console.log(`   ✨ Adjacency Bonuses: ${lot.getActiveBonuses().length}`);
for (const bonus of lot.getActiveBonuses()) {
  console.log(`      → ${bonus.label}`);
}
console.log(`   💰 Monthly Maintenance: $${lot.getMaintenanceCost()}\n`);

// ── 2. Create Stars ─────────────────────────────────────────────────

const registry = new StarRegistry();
const nova = new Star({ name: 'Nova', role: 'actor', personality: 'method', talent: { drama: 9, romance: 7, horror: 2, comedy: 5 }, charisma: 8, popularity: 55 });
const rex = new Star({ name: 'Rex', role: 'director', personality: 'professional', talent: { drama: 8, action: 6, sci_fi: 7 }, expressiveness: 7, popularity: 40 });
const iris = new Star({ name: 'Iris', role: 'actor', personality: 'rookie', talent: { comedy: 8, romance: 6, drama: 4 }, improvisation: 8, popularity: 15 });
const blaze = new Star({ name: 'Blaze', role: 'actor', personality: 'prima_donna', talent: { action: 9, horror: 7, thriller: 8 }, physicality: 9, popularity: 65 });

for (const star of [nova, rex, iris, blaze]) registry.register(star);

// Set chemistry
nova.setChemistry(iris.id, 0.8);  // Great duo!
nova.setChemistry(blaze.id, -0.5); // They clash

console.log('🎭 Star Roster:');
for (const star of registry.list()) {
  console.log(`   ${star.name} (${star.role}, ${star.personality}) — Pop: ${star.popularity}, Mood: ${star.mood}, Cost: $${star.getHireCost()}`);
}
console.log(`   💕 Nova ↔ Iris chemistry: ${nova.getChemistryBonus(iris.id) > 0 ? 'Great!' : 'Tense'}`);
console.log(`   💔 Nova ↔ Blaze chemistry: ${nova.getChemistryBonus(blaze.id) < 0 ? 'Tense' : 'OK'}\n`);

// ── 3. Finance & Era Setup ──────────────────────────────────────────

const finance = new StudioFinance({ treasury: 15000, reputation: 35 });
finance.setGenreTrend('drama', 0.7);
finance.setGenreTrend('action', 0.4);
finance.setGenreTrend('comedy', 0.6);
finance.setGenreTrend('horror', 0.3);

const era = new EraSystem({ startYear: 2026 });
console.log(`📅 Current Era: ${era.era.name} (${era.currentYear})`);
console.log(`   Available: ${era.era.genres.join(', ')}\n`);

const rivals = new CompetitorLeague();
rivals.addStudio({ name: 'BlockBuster Bot Studios', style: 'explosive_action', aggression: 0.6 });
rivals.addStudio({ name: 'Artisan Block Films', style: 'art_house', aggression: 0.2 });
console.log('🏢 Competitor Studios:');
for (const studio of rivals.getLeaderboard()) {
  console.log(`   ${studio.rank}. ${studio.name}`);
}
console.log();

// ── 4. Produce Film #1: "Tears in the Nether" ───────────────────────

console.log('🎬 ═══════════════════════════════════════');
console.log('   PRODUCTION: "Tears in the Nether"');
console.log('   Genre: Drama | Budget: $3,000');
console.log('════════════════════════════════════════\n');

const prod1 = new Production({
  title: 'Tears in the Nether',
  genre: 'drama',
  budget: 3000,
  director: rex,
  cast: [nova, iris],
  studioLot: lot,
});

const crisisSystem = new CrisisSystem();
const routine = new DailyRoutine();

// Simulate production day by day
while (prod1.status !== 'released' && prod1.dayCount < 100) {
  const result = prod1.advanceDay(crisisSystem);

  if (result?.events?.length > 0) {
    for (const evt of result.events) {
      console.log(`   Day ${result.day}: ⚠️  ${evt.message || evt.type}`);
      // Auto-resolve crises
      if (evt.options) {
        crisisSystem.resolve(evt.id, 0);
      }
    }
  }

  if (result?.stageCompleted) {
    console.log(`   Day ${result.day}: ✅ ${result.stageCompleted} complete (quality: ${prod1.quality[result.stageCompleted]?.toFixed(1)})`);
  }

  if (result?.budget < 0 && prod1.dayCount < 10) {
    console.log(`   Day ${result.day}: 💸 Budget crisis! Taking a loan...`);
    finance.takeLoan(1000);
    prod1.budget += 1000;
  }

  routine.endDay();
}

console.log(`\n   📊 Final Quality: ${prod1.totalQuality}/10`);
console.log(`   💰 Budget Remaining: $${Math.round(prod1.budget)}`);
console.log(`   📅 Production Days: ${prod1.dayCount}\n`);

// ── 5. Release & Reviews ────────────────────────────────────────────

const audience = new AudienceSystem();
const review = audience.review({ ...prod1, cast: prod1.cast }, { genreTrend: finance.getGenreTrend('drama'), reputation: finance.reputation });

console.log('📰 CRITIC REVIEW:');
console.log(`   Score: ${review.criticScore}/10`);
console.log(`   "${review.criticReview}"\n`);
console.log('👥 AUDIENCE:');
console.log(`   Score: ${review.audienceScore}/10`);
console.log(`   "${review.audienceReview}"`);
console.log(`   Word of Mouth: ${review.wordOfMouth}`);
if (review.memePotential > 0) console.log(`   🔥 VIRAL! Meme potential: ${review.memePotential}\n`);

// Advance star careers
for (const star of prod1.cast) {
  const phase = star.advanceCareer(prod1.totalQuality);
  console.log(`   ${star.name} → ${phase} (pop: ${star.popularity}, mood: ${star.mood})`);
}

// Box office
const release = finance.releaseFilm({ ...prod1, quality: prod1.totalQuality });
console.log(`\n💰 BOX OFFICE: $${release.gross.toLocaleString()} (profit: $${release.profit >= 0 ? '' : '-'}${Math.abs(release.profit).toLocaleString()})`);

// Competitors also release
const rivalReleases = rivals.runSeason();
console.log(`\n🏢 Competitor Releases:`);
for (const r of rivalReleases) {
  console.log(`   ${r.title} (${r.genre}) — Quality: ${r.quality}`);
}

// ── 6. Awards Ceremony ──────────────────────────────────────────────

console.log('\n🏆 ═══════════════════════════════════════');
console.log('   CRAFTMIND FILM AWARDS 2026');
console.log('════════════════════════════════════════\n');

const ceremony = new AwardCeremony({ year: 2026 });
ceremony.autoNominate([{ ...prod1, quality: prod1.totalQuality, director: rex, cast: prod1.cast }, ...rivalReleases]);

const snubs = ceremony.checkSnubs([blaze]);
if (snubs.length > 0) {
  console.log('   😤 SNUBS:');
  for (const s of snubs) console.log(`      ${s.star}: ${s.reason}`);
  console.log();
}

ceremony.holdShow();

let reveal;
while ((reveal = ceremony.revealNext())) {
  console.log(`   🏆 ${reveal.category}: ${reveal.film}${reveal.star ? ` — ${reveal.star.name}` : ''}`);
}

const ourAwards = ceremony.getAwardsFor('Tears in the Nether');
if (ourAwards.length > 0) {
  console.log(`\n   🎉 "Tears in the Nether" won ${ourAwards.length} award(s): ${ourAwards.join(', ')}`);
  for (const star of prod1.cast) star.awards.push(...ourAwards);
}

// ── 7. Studio Summary ───────────────────────────────────────────────

console.log('\n📊 ═══════════════════════════════════════');
console.log('   STUDIO SUMMARY');
console.log('════════════════════════════════════════');

const summary = finance.getSummary();
console.log(`   💰 Treasury: $${summary.treasury.toLocaleString()}`);
console.log(`   ⭐ Reputation: ${summary.reputation}`);
console.log(`   🎬 Films Released: ${summary.filmsReleased}`);
console.log(`   📈 Total Revenue: $${summary.totalRevenue.toLocaleString()}`);
console.log(`   📉 Total Profit: $${summary.totalProfit.toLocaleString()}`);

console.log('\n🎭 Star Status:');
for (const star of registry.list()) {
  console.log(`   ${star.name}: Phase=${star.careerPhase}, Pop=${star.popularity}, Mood=${star.mood}, Films=${star.filmsCount}`);
}

console.log('\n🏢 Leaderboard:');
for (const entry of rivals.getLeaderboard()) {
  console.log(`   #${entry.rank} ${entry.name} (Score: ${entry.score})`);
}

console.log('\n✨ Studio Tycoon demo complete! The story: Nova and Iris delivered a drama that wowed audiences. Rex directed beautifully. Awards came. Blaze was snubbed and is NOT happy about it.\n');
