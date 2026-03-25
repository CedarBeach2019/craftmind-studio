/**
 * @module competitor-studios
 * AI-controlled rival studios — they make films, compete for talent, poach stars.
 */

export class CompetitorStudio {
  constructor({ name, style, aggression = 0.5, skill = 5 } = {}) {
    this.name = name;
    this.style = style; // 'explosive_action', 'art_house', 'comedy_factory', 'horror_masters', 'romantic_factory'
    this.aggression = clamp(aggression, 0, 1);
    this.skill = clamp(skill, 1, 10);
    this.reputation = 20 + Math.random() * 30;
    this.films = [];
    this.awards = 0;
    this.totalRevenue = 0;
  }

  /** Generate a film to compete. */
  produceFilm(genre = null) {
    const styleGenres = {
      explosive_action: ['action', 'sci_fi', 'thriller'],
      art_house: ['drama', 'documentary', 'romance'],
      comedy_factory: ['comedy', 'romance'],
      horror_masters: ['horror', 'thriller'],
      romantic_factory: ['romance', 'drama', 'comedy'],
    };
    const genrePool = styleGenres[this.style] ?? ['drama'];
    const chosenGenre = genre ?? genrePool[Math.floor(Math.random() * genrePool.length)];

    const quality = clamp(this.skill * 0.8 + (Math.random() - 0.3) * 3, 2, 9);
    const film = {
      title: `${this.name} presents: ${generateTitle(chosenGenre)}`,
      genre: chosenGenre,
      quality: Math.round(quality * 10) / 10,
      studio: this.name,
      rival: true,
    };

    this.films.push(film);
    this.totalRevenue += Math.round(film.quality * 1500 * (0.5 + Math.random()));
    this.reputation = clamp(this.reputation + (quality - 5) * 0.5, 0, 100);
    return film;
  }

  /** Try to poach an unhappy star. */
  tryPoach(star) {
    if (star.mood < 30 && Math.random() < this.aggression * 0.3) {
      const offer = Math.round(star.salary * 1.5);
      return { star: star.name, offered: offer, studio: this.name };
    }
    return null;
  }

  /** Get studio ranking score. */
  getRankingScore() {
    return Math.round(this.totalRevenue * 0.01 + this.awards * 100 + this.reputation * 10);
  }
}

export class CompetitorLeague {
  constructor() {
    this.studios = [];
  }

  /** Add a competitor. */
  addStudio(studio) {
    this.studios.push(studio instanceof CompetitorStudio ? studio : new CompetitorStudio(studio));
  }

  /** All competitors produce films for a season. */
  runSeason() {
    const releases = [];
    for (const studio of this.studios) {
      const film = studio.produceFilm();
      releases.push(film);
    }
    return releases;
  }

  /** Check if any competitor is poaching stars. */
  checkPoaching(stars) {
    const attempts = [];
    for (const studio of this.studios) {
      for (const star of stars) {
        const attempt = studio.tryPoach(star);
        if (attempt) attempts.push(attempt);
      }
    }
    return attempts;
  }

  /** Get leaderboard rankings. */
  getLeaderboard() {
    return [...this.studios]
      .sort((a, b) => b.getRankingScore() - a.getRankingScore())
      .map((s, i) => ({ rank: i + 1, name: s.name, score: s.getRankingScore(), films: s.films.length, awards: s.awards }));
  }
}

function generateTitle(genre) {
  const titles = {
    action: ['Explosive Dawn', 'Block Breaker', 'The Last Standing', 'Creeper Strike'],
    comedy: ['Steve\'s Bad Day', 'The Diamond Heist', 'Mob Mischief', 'Village Idiots'],
    drama: ['Tears in the Nether', 'The Long Portal Home', 'Bedrock Dreams', 'Silent Biomes'],
    horror: ['The Herobrine Tapes', 'Night of 100 Creepers', 'The End Dimension', 'Soul Sand'],
    romance: ['Love at First Respawn', 'The Enderman\'s Kiss', 'Two Players, One Heart', 'Crafted with Love'],
    sci_fi: ['Quantum Portal', 'The Redstone Machine', 'Beyond the End', 'Stardew Station'],
    thriller: ['The Missing Diamonds', 'Dark Tower', 'Underground', 'The Witness'],
    documentary: ['Life in the Nether', 'The Art of Building', 'Minecraft: A History', 'Block by Block'],
  };
  const options = titles[genre] ?? titles['drama'];
  return options[Math.floor(Math.random() * options.length)];
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
