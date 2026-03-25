/**
 * @module era-progression
 * Technology & era system — unlock features across eras of filmmaking.
 */

export const ERAS = [
  {
    id: 'silent', name: 'Silent Era', year: 1920, description: 'Pure visuals and action. No dialogue.',
    unlocks: { color: false, sound: false, dialogue: false, effects: false, cgi: false, motionCapture: false, advancedEditing: false },
    sets: ['western_town', 'city_street', 'forest'],
    genres: ['action', 'comedy', 'romance'],
  },
  {
    id: 'golden_age', name: 'Golden Age', year: 1930, description: 'Sound arrives. Color becomes available.',
    unlocks: { color: true, sound: true, dialogue: true, effects: false, cgi: false, motionCapture: false, advancedEditing: false },
    sets: ['western_town', 'city_street', 'forest', 'haunted_mansion', 'courtroom'],
    genres: ['action', 'comedy', 'romance', 'drama', 'horror'],
  },
  {
    id: 'blockbuster', name: 'Blockbuster Era', year: 1970, description: 'Bigger budgets, stunts, explosions.',
    unlocks: { color: true, sound: true, dialogue: true, effects: true, cgi: false, motionCapture: false, advancedEditing: true },
    sets: ['western_town', 'city_street', 'forest', 'haunted_mansion', 'courtroom', 'space_station', 'medieval_castle', 'underwater_temple'],
    genres: ['action', 'comedy', 'romance', 'drama', 'horror', 'sci_fi', 'thriller'],
  },
  {
    id: 'digital', name: 'Digital Era', year: 2000, description: 'CGI, motion capture, complex editing.',
    unlocks: { color: true, sound: true, dialogue: true, effects: true, cgi: true, motionCapture: true, advancedEditing: true },
    sets: ['western_town', 'city_street', 'forest', 'haunted_mansion', 'courtroom', 'space_station', 'medieval_castle', 'underwater_temple', 'virtual_realm'],
    genres: ['action', 'comedy', 'romance', 'drama', 'horror', 'sci_fi', 'thriller', 'documentary'],
  },
  {
    id: 'streaming', name: 'Streaming Era', year: 2020, description: 'Short-form, social media, viral moments.',
    unlocks: { color: true, sound: true, dialogue: true, effects: true, cgi: true, motionCapture: true, advancedEditing: true },
    sets: ['western_town', 'city_street', 'forest', 'haunted_mansion', 'courtroom', 'space_station', 'medieval_castle', 'underwater_temple', 'virtual_realm', 'apartment', 'rooftop'],
    genres: ['action', 'comedy', 'romance', 'drama', 'horror', 'sci_fi', 'thriller', 'documentary'],
    bonus: 'viral_potential',
  },
];

export class EraSystem {
  constructor({ startYear = 2026 } = {}) {
    this.currentYear = startYear;
    this.currentEraIndex = ERAS.findIndex(e => e.year <= startYear).toString() !== '-1'
      ? ERAS.reduce((best, e, i) => e.year <= startYear ? i : best, 0)
      : 0;
    this.discoveredTechnologies = new Set();
    this.researchedUpgrades = new Map(); // techId → level
    this._initTech();
  }

  _initTech() {
    const era = ERAS[this.currentEraIndex];
    for (const [tech, unlocked] of Object.entries(era.unlocks)) {
      if (unlocked) this.discoveredTechnologies.add(tech);
    }
  }

  /** Get current era. */
  get era() { return ERAS[this.currentEraIndex]; }

  /** Get current era unlocks. */
  get unlocks() { return this.era.unlocks; }

  /** Advance time by years. */
  advance(years = 1) {
    this.currentYear += years;
    for (let i = ERAS.length - 1; i >= 0; i--) {
      if (ERAS[i].year <= this.currentYear && i > this.currentEraIndex) {
        this.currentEraIndex = i;
        const newEra = ERAS[i];
        for (const [tech, unlocked] of Object.entries(newEra.unlocks)) {
          if (unlocked) this.discoveredTechnologies.add(tech);
        }
        return { newEra: newEra.name, unlocked: Object.entries(newEra.unlocks).filter(([, v]) => v).map(([k]) => k) };
      }
    }
    return null;
  }

  /** Check if a technology is available. */
  hasTech(tech) { return this.discoveredTechnologies.has(tech); }

  /** Check if a genre is available in current era. */
  hasGenre(genre) { return this.era.genres.includes(genre); }

  /** Check if a set type is available. */
  hasSet(setType) { return this.era.sets.includes(setType); }

  /** Research an upgrade (costs in-game time/resources). */
  research(techId, cost = 500) {
    if (!this.discoveredTechnologies.has(techId)) return false;
    const currentLevel = this.researchedUpgrades.get(techId) ?? 1;
    this.researchedUpgrades.set(techId, currentLevel + 1);
    return true;
  }

  /** Get tech level. */
  getTechLevel(techId) { return this.researchedUpgrades.get(techId) ?? 1; }

  /** Apply era modifiers to film quality. */
  getQualityModifiers(genre) {
    const mods = { colorBonus: 0, soundBonus: 0, effectsBonus: 0 };

    if (this.hasTech('color')) mods.colorBonus = this.getTechLevel('color') * 0.5;
    if (this.hasTech('sound')) mods.soundBonus = this.getTechLevel('sound') * 0.5;
    if (this.hasTech('effects')) mods.effectsBonus = this.getTechLevel('effects') * 0.3;
    if (this.hasTech('cgi')) mods.effectsBonus += this.getTechLevel('cgi') * 0.4;

    // Era bonus for matching genre
    if (!this.hasGenre(genre)) {
      return { ...mods, genrePenalty: -2 }; // genre not available = penalty
    }

    return mods;
  }

  toJSON() {
    return {
      currentYear: this.currentYear, currentEraIndex: this.currentEraIndex,
      discoveredTechnologies: [...this.discoveredTechnologies],
      researchedUpgrades: Object.fromEntries(this.researchedUpgrades),
    };
  }
}
