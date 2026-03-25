/**
 * @module audience
 * Audience & critic system — reviews, scores, word of mouth, viral potential.
 */

export class AudienceSystem {
  constructor() {
    this.reviewHistory = [];
  }

  /**
   * Generate a review for a film.
   * @param {object} film — { title, genre, quality, cast, director }
   * @param {object} [opts] — { genreTrend, reputation, rivalScore }
   * @returns {{ score: number, criticReview: string, audienceReview: string, wordOfMouth: string, memePotential: number }}
   */
  review(film, opts = {}) {
    const { quality = 5, genre, title, cast = [], director } = film;
    const { genreTrend = 0.5, reputation = 50, rivalScore = null } = opts;

    // Base critic score (slightly harsh)
    let criticScore = quality * 0.9 + (Math.random() - 0.3) * 1.5;

    // Genre trend affects critics
    criticScore += (genreTrend - 0.5) * 1;

    // Star power bonus
    const starPower = cast.reduce((s, star) => s + (star.popularity ?? 30) * 0.005, 0);
    criticScore += Math.min(starPower, 1.5);

    // Director bonus
    if (director) criticScore += (director.genreFit(genre) - 5) * 0.1;

    // Competition effect
    if (rivalScore !== null && rivalScore > criticScore) criticScore -= 0.5;

    criticScore = clamp(criticScore, 1, 10);

    // Audience score (slightly more generous)
    let audienceScore = quality * 0.95 + (Math.random() - 0.2) * 2;
    audienceScore += starPower * 0.8;
    audienceScore += reputation * 0.01;
    audienceScore = clamp(audienceScore, 1, 10);

    // Meme potential
    const memePotential = Math.random() < 0.08 ? (0.5 + Math.random() * 0.5) : 0;

    // Word of mouth
    const wordOfMouth = criticScore >= 7 ? 'excellent' : criticScore >= 5 ? 'mixed' : criticScore >= 3 ? 'negative' : 'terrible';

    const result = {
      score: Math.round((criticScore + audienceScore) / 2 * 10) / 10,
      criticScore: Math.round(criticScore * 10) / 10,
      audienceScore: Math.round(audienceScore * 10) / 10,
      criticReview: generateCriticReview(film, criticScore),
      audienceReview: generateAudienceReview(film, audienceScore),
      wordOfMouth,
      memePotential,
    };

    this.reviewHistory.push({ title: film.title, ...result, timestamp: Date.now() });
    return result;
  }

  /** Get reviews for a specific film. */
  getReviewsFor(title) {
    return this.reviewHistory.filter(r => r.title === title);
  }

  /** Get all review history. */
  getHistory() { return [...this.reviewHistory]; }

  /** Calculate word-of-mouth multiplier over time. */
  getWordOfMouthMultiplier(title, daysSinceRelease = 0) {
    const review = this.reviewHistory.find(r => r.title === title);
    if (!review) return 1;

    let multiplier = 1;
    if (review.wordOfMouth === 'excellent') multiplier = 1 + daysSinceRelease * 0.05;
    else if (review.wordOfMouth === 'mixed') multiplier = 1 - daysSinceRelease * 0.02;
    else multiplier = Math.max(0.3, 1 - daysSinceRelease * 0.08);

    // Meme boost
    if (review.memePotential > 0) multiplier *= 1 + review.memePotential;

    return Math.max(0.1, multiplier);
  }
}

function generateCriticReview(film, score) {
  const { title, genre } = film;
  const templates = {
    high: [
      `${title} is a triumph of ${genre} filmmaking. Breathtaking Minecraft cinematography.`,
      `A masterpiece. ${title} redefines what's possible in ${genre}.`,
      `Stunning. Every frame of ${title} is meticulously crafted.`,
      `${title} is the kind of ${genre} film that comes along once in a generation.`,
    ],
    mid: [
      `${title} is a solid ${genre} entry with some memorable moments.`,
      `Competent ${genre} filmmaking, though ${title} doesn't break new ground.`,
      `${title} has charm but struggles to maintain momentum in the third act.`,
      `A decent ${genre} film. ${title} will satisfy fans of the genre.`,
    ],
    low: [
      `${title} is a missed opportunity. The ${genre} elements feel forced.`,
      `Unfortunately, ${title} fails to deliver on its promising premise.`,
      `${title} needed more time in the Script Office. The ${genre} beats fall flat.`,
      `A disappointing ${genre} effort. ${title}'s potential is wasted.`,
    ],
  };

  const tier = score >= 7 ? 'high' : score >= 4.5 ? 'mid' : 'low';
  const options = templates[tier];
  return options[Math.floor(Math.random() * options.length)];
}

function generateAudienceReview(film, score) {
  const { title } = film;
  const templates = {
    high: [
      `Loved ${title}! Already rewatching it.`,
      `${title} is INCREDIBLE. Block Steve everything.`,
      `Can't stop thinking about ${title}. 😭`,
    ],
    mid: [
      `${title} was okay. Worth a watch.`,
      `Decent film. ${title} had some good parts.`,
      `${title} — 6/10, would watch the sequel.`,
    ],
    low: [
      `${title} was boring tbh`,
      `Fell asleep during ${title}. Skip it.`,
      `Not worth the hype. ${title} was a letdown.`,
    ],
  };

  const tier = score >= 7 ? 'high' : score >= 4.5 ? 'mid' : 'low';
  const options = templates[tier];
  return options[Math.floor(Math.random() * options.length)];
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
