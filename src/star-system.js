/**
 * @module star-system
 * Star management — actors, directors, mood, stress, relationships, career arcs.
 * Stars extend CharacterProfile with management-layer stats.
 */

export const PERSONALITY_TYPES = ['method', 'improv', 'professional', 'rookie', 'prima_donna'];

export const CAREER_PHASES = ['breakout', 'peak', 'decline', 'comeback', 'legend'];

export const GENRES = ['action', 'comedy', 'drama', 'horror', 'romance', 'sci_fi', 'thriller', 'documentary'];

/** @typedef {{action:number,comedy:number,drama:number,horror:number,romance:number,sci_fi:number,thriller:number,documentary:number}} TalentMap */

export class Star {
  constructor({
    id, name, role = 'actor', personality = 'professional',
    talent = {}, mood = 70, stress = 20, popularity = 30,
    salary = 100, charisma = 5, expressiveness = 5, voice = 5, physicality = 5, improvisation = 5,
    careerPhase = 'breakout', fanBase = 100, filmsCount = 0,
  } = {}) {
    this.id = id ?? name.toLowerCase().replace(/\s+/g, '_');
    this.name = name;
    this.role = role; // 'actor' | 'director'
    this.personality = personality;
    // Fill missing genre talents
    this.talent = {};
    for (const g of GENRES) {
      this.talent[g] = talent[g] ?? Math.floor(Math.random() * 6) + 3;
    }
    this.mood = clamp(mood, 0, 100);
    this.stress = clamp(stress, 0, 100);
    this.popularity = clamp(popularity, 0, 100);
    this.salary = salary;
    this.charisma = clamp(charisma, 1, 10);
    this.expressiveness = clamp(expressiveness, 1, 10);
    this.voice = clamp(voice, 1, 10);
    this.physicality = clamp(physicality, 1, 10);
    this.improvisation = clamp(improvisation, 1, 10);
    this.careerPhase = careerPhase;
    this.fanBase = fanBase;
    this.filmsCount = filmsCount;
    this.relationships = new Map(); // starId → { chemistry: number(-1..1), history: string[] }
    this.scandals = 0;
    this.awards = [];
  }

  /** How well this star performs in a given genre. */
  genreFit(genre) {
    const base = this.talent[genre] ?? 5;
    const moodBonus = (this.mood - 50) * 0.02;
    const stressPenalty = -(this.stress - 30) * 0.03;
    const phaseBonus = { breakout: 0.3, peak: 0.5, decline: -0.3, comeback: 0.4, legend: 0.2 }[this.careerPhase] ?? 0;
    return clamp(base + moodBonus + stressPenalty + phaseBonus, 1, 10);
  }

  /** Mood change from an event. */
  adjustMood(delta, reason = '') {
    this.mood = clamp(this.mood + delta, 0, 100);
    if (reason) this.relationships.get('__log__')?.history?.push(reason);
    return this.mood;
  }

  /** Stress change. */
  adjustStress(delta) {
    this.stress = clamp(this.stress + delta, 0, 100);
    return this.stress;
  }

  /** Work a day — affects mood and stress based on personality. */
  workDay(genre, difficulty = 5) {
    const fit = this.genreFit(genre);
    const isGoodFit = fit >= 6;

    switch (this.personality) {
      case 'method':
        this.adjustStress(isGoodFit ? -2 : 5);
        this.adjustMood(isGoodFit ? 3 : -8, isGoodFit ? 'Great performance' : 'Struggled with role');
        break;
      case 'improv':
        this.adjustStress(1);
        this.adjustMood(Math.random() > 0.3 ? 2 : -3, 'Improv swing');
        break;
      case 'professional':
        this.adjustStress(-1);
        this.adjustMood(1, 'Steady work');
        break;
      case 'rookie':
        this.adjustStress(3);
        this.adjustMood(isGoodFit ? 5 : -5, isGoodFit ? 'Nailed it!' : 'Out of depth');
        break;
      case 'prima_donna':
        this.adjustStress(2);
        this.adjustMood(fit >= 8 ? 4 : -6, fit >= 8 ? 'Felt appreciated' : 'Not getting enough attention');
        break;
    }

    // Overwork check
    if (this.stress > 80) {
      this.adjustMood(-5, 'Burnout warning');
    }

    // Meltdown check
    if (this.stress > 95 && Math.random() < 0.3) {
      return this._meltdown();
    }

    return null;
  }

  _meltdown() {
    this.adjustMood(-20, 'ON-SET MELTDOWN');
    this.adjustStress(-15);
    this.scandals++;
    return {
      type: 'meltdown',
      star: this.name,
      severity: 'high',
      message: `${this.name} had a meltdown on set! Stress was at ${this.stress}.`,
    };
  }

  /** Set relationship chemistry with another star (-1 to 1). */
  setChemistry(otherId, value) {
    this.relationships.set(otherId, {
      chemistry: clamp(value, -1, 1),
      history: this.relationships.get(otherId)?.history ?? [],
    });
  }

  /** Get chemistry bonus with another star for a scene. */
  getChemistryBonus(otherId) {
    const rel = this.relationships.get(otherId);
    if (!rel) return 0;
    return rel.chemistry * 2; // -2 to +2
  }

  /** Record a shared event. */
  recordEvent(otherId, event) {
    if (!this.relationships.has(otherId)) {
      this.relationships.set(otherId, { chemistry: 0, history: [] });
    }
    this.relationships.get(otherId).history.push(event);
  }

  /** Advance career after a film release. */
  advanceCareer(filmScore) {
    this.filmsCount++;
    if (filmScore >= 8) {
      this.popularity = clamp(this.popularity + 8, 0, 100);
      this.adjustMood(5, 'Film well-received');
      if (this.careerPhase === 'breakout') this.careerPhase = 'peak';
      else if (this.careerPhase === 'comeback') this.careerPhase = 'legend';
    } else if (filmScore >= 5) {
      this.popularity = clamp(this.popularity + 2, 0, 100);
    } else {
      this.popularity = clamp(this.popularity - 5, 0, 100);
      this.adjustMood(-5, 'Film panned');
      if (this.careerPhase === 'peak') this.careerPhase = 'decline';
    }

    // Salary increase demand
    this.salary = Math.round(this.salary * (1 + this.popularity * 0.005));
    return this.careerPhase;
  }

  /** Get hire cost per film. */
  getHireCost() {
    const phaseMultiplier = { breakout: 1, peak: 2, decline: 0.7, comeback: 1.5, legend: 3 }[this.careerPhase];
    return Math.round(this.salary * phaseMultiplier * (this.popularity / 50));
  }

  /** Will this star accept a role? */
  willAccept(genre, budget) {
    const fit = this.genreFit(genre);
    if (fit < 3 && this.popularity > 50) return false; // big star won't do bad fit
    if (budget < this.getHireCost() * 0.5) return false; // too cheap
    if (this.mood < 20) return false; // too unhappy
    if (this.stress > 90) return false; // too stressed
    return true;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, role: this.role, personality: this.personality,
      talent: { ...this.talent }, mood: this.mood, stress: this.stress,
      popularity: this.popularity, salary: this.salary, careerPhase: this.careerPhase,
      fanBase: this.fanBase, filmsCount: this.filmsCount, scandals: this.scandals,
      awards: [...this.awards],
      relationships: Object.fromEntries([...this.relationships.entries()].map(([k, v]) => [k, { ...v }])),
    };
  }

  static fromJSON(data) {
    const star = new Star(data);
    star.relationships = new Map(Object.entries(data.relationships ?? {}));
    return star;
  }
}

/** Registry of all known stars. */
export class StarRegistry {
  constructor() { this.stars = new Map(); }

  register(star) {
    this.stars.set(star.id, star instanceof Star ? star : new Star(star));
  }

  get(id) { return this.stars.get(id); }

  list() { return [...this.stars.values()]; }

  /** Find stars matching criteria. */
  search({ role, genre, maxSalary, minPopularity, personality } = {}) {
    return this.list().filter(s => {
      if (role && s.role !== role) return false;
      if (genre && s.genreFit(genre) < 5) return false;
      if (maxSalary && s.getHireCost() > maxSalary) return false;
      if (minPopularity && s.popularity < minPopularity) return false;
      if (personality && s.personality !== personality) return false;
      return true;
    });
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
