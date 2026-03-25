/**
 * @module awards
 * Award ceremony system — nominations, voting, dramatic reveals.
 */

export const AWARD_CATEGORIES = [
  'Best Picture', 'Best Director', 'Best Actor', 'Best Actress',
  'Best Script', 'Best Cinematography', 'Best Effects', 'Best Soundtrack',
  'Best Breakthrough Star', 'Fan Favorite',
];

export class AwardCeremony {
  constructor({ year = 2026 } = {}) {
    this.year = year;
    this.nominees = new Map(); // category → [{ film, star?, score }]
    this.winners = new Map(); // category → { film, star?, score, acceptanceSpeech }
    this.isHeld = false;
    this.revealIndex = 0;
  }

  /** Submit nominations for a category. */
  nominate(category, entries) {
    if (!AWARD_CATEGORIES.includes(category)) throw new Error(`Unknown award category: ${category}`);
    const current = this.nominees.get(category) ?? [];
    for (const entry of entries) {
      current.push(entry);
    }
    // Keep top 5
    current.sort((a, b) => b.score - a.score);
    this.nominees.set(category, current.slice(0, 5));
  }

  /** Auto-nominate from a list of films. */
  autoNominate(films) {
    if (films.length === 0) return;

    // Best Picture
    this.nominate('Best Picture', films.map(f => ({ film: f, score: f.quality ?? 5 })));

    // Best Director
    const directors = films.filter(f => f.director).map(f => ({ film: f, star: f.director, score: f.director?.genreFit(f.genre) ?? 5 }));
    if (directors.length > 0) this.nominate('Best Director', directors);

    // Best Actor/Actress (use first cast member)
    for (const film of films) {
      for (const star of film.cast ?? []) {
        const category = star.role === 'actor' ? 'Best Actor' : 'Best Actress';
        this.nominate(category, [{ film, star, score: star.genreFit(film.genre) * (star.popularity / 100 + 0.5) }]);
      }
    }

    // Best Script
    this.nominate('Best Script', films.map(f => ({ film: f, score: (f.quality?.script ?? 5) * 2 })));

    // Best Effects
    this.nominate('Best Effects', films.map(f => ({ film: f, score: (f.quality?.effects ?? 3) * 2 })));

    // Best Soundtrack
    this.nominate('Best Soundtrack', films.map(f => ({ film: f, score: (f.quality?.music ?? 3) + (f.quality?.sound ?? 3) })));

    // Best Breakthrough Star
    const rookies = films.flatMap(f => (f.cast ?? []).filter(s => s.careerPhase === 'breakout').map(s => ({ film: f, star: s, score: s.genreFit(f.genre) })));
    if (rookies.length > 0) this.nominate('Best Breakthrough Star', rookies);

    // Fan Favorite
    this.nominate('Fan Favorite', films.map(f => ({
      film: f, score: (f.cast ?? []).reduce((s, star) => s + star.popularity, 0) / Math.max(f.cast?.length, 1),
    })));
  }

  /** Hold the ceremony — select winners. */
  holdShow() {
    this.isHeld = true;
    this.winners.clear();

    for (const [category, nominees] of this.nominees) {
      if (nominees.length === 0) continue;

      // Weighted random selection (higher score = more likely)
      const totalWeight = nominees.reduce((s, n) => s + Math.max(n.score, 0.1), 0);
      let roll = Math.random() * totalWeight;
      let winner = nominees[0];

      for (const nominee of nominees) {
        roll -= Math.max(nominee.score, 0.1);
        if (roll <= 0) { winner = nominee; break; }
      }

      this.winners.set(category, {
        ...winner,
        acceptanceSpeech: generateAcceptanceSpeech(winner, category),
      });
    }

    return this.getResults();
  }

  /** Reveal next award (for dramatic presentation). */
  revealNext() {
    const categories = [...this.winners.keys()];
    if (this.revealIndex >= categories.length) return null;

    const category = categories[this.revealIndex];
    const winner = this.winners.get(category);
    this.revealIndex++;
    return { category, ...winner };
  }

  /** Get all results. */
  getResults() {
    return Object.fromEntries([...this.winners.entries()].map(([cat, w]) => [cat, {
      film: w.film?.title ?? 'N/A',
      star: w.star?.name ?? null,
      score: w.score,
      acceptanceSpeech: w.acceptanceSpeech,
    }]));
  }

  /** Check if a film/star won. */
  getAwardsFor(filmTitle) {
    const awards = [];
    for (const [cat, w] of this.winners) {
      if (w.film?.title === filmTitle) awards.push(cat);
    }
    return awards;
  }

  /** Check if a star was snubbed (expected nom but didn't get one). */
  checkSnubs(stars) {
    const snubs = [];
    for (const star of stars) {
      const wasNominated = [...this.nominees.values()].some(noms => noms.some(n => n.star?.id === star.id));
      if (!wasNominated && star.popularity > 60 && star.filmsCount > 0) {
        snubs.push({ star: star.name, reason: 'Expected nomination but not nominated' });
      }
    }
    return snubs;
  }
}

function generateAcceptanceSpeech(winner, category) {
  const filmName = winner.film?.title ?? 'this film';
  const starName = winner.star?.name ?? null;
  const templates = [
    `"I'm honored beyond words. ${filmName} was a labor of love."`,
    `"This belongs to everyone who believed in ${filmName}. Thank you."`,
    `"I didn't expect this. I want to thank every block, every pixel."`,
    `"To the fans — you made this possible. ${filmName} is YOUR award."`,
    starName ? `"As ${starName}, I've waited my whole career for this moment."` : null,
    `"The craft is everything. ${filmName} pushed us to our limits."`,
  ].filter(Boolean);

  return templates[Math.floor(Math.random() * templates.length)];
}
