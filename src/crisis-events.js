/**
 * @module crisis-events
 * Random crisis events during production — emergencies, opportunities, disasters.
 */

export const CRISIS_TYPES = {
  actor_quits: {
    name: 'Actor Quits',
    severity: 'high',
    resolve(production, ctx) {
      const star = ctx.actor ?? production.cast[0];
      return {
        message: `${star?.name ?? 'An actor'} quit the production! Creative differences.`,
        options: [
          { label: 'Negotiate', cost: 500, effect: { moodChange: 5 }, chance: 0.6 },
          { label: 'Recast', cost: 200, effect: { qualityPenalty: -1 }, chance: 1 },
          { label: 'Let them go', cost: 0, effect: { qualityPenalty: -2 }, chance: 1 },
        ],
      };
    },
  },
  creative_block: {
    name: 'Creative Block',
    severity: 'medium',
    resolve(production) {
      return {
        message: `Director ${production.director?.name ?? 'Rex'} is stuck on a scene!`,
        options: [
          { label: 'Take a break', cost: 100, effect: { stageDelay: 2 }, chance: 0.7 },
          { label: 'Hire consultant', cost: 400, effect: { qualityBonus: 1 }, chance: 0.8 },
          { label: 'Push through', cost: 0, effect: { qualityPenalty: -1, stressIncrease: 10 }, chance: 0.5 },
        ],
      };
    },
  },
  set_fire: {
    name: 'Set Fire',
    severity: 'high',
    resolve() {
      return {
        message: '🔥 A fire broke out on set! Creeper accident.',
        options: [
          { label: 'Emergency repair', cost: 800, effect: { stageDelay: 3 }, chance: 0.9 },
          { label: 'Relocate', cost: 600, effect: { stageDelay: 2, qualityPenalty: -0.5 }, chance: 1 },
          { label: 'Improvise', cost: 200, effect: { qualityPenalty: -1.5 }, chance: 0.6 },
        ],
      };
    },
  },
  budget_overrun: {
    name: 'Budget Overrun',
    severity: 'medium',
    resolve(production) {
      return {
        message: `Budget is running low! Only $${Math.round(production.budget)} remaining.`,
        options: [
          { label: 'Take a loan', cost: 0, effect: { loanAmount: 2000 }, chance: 1 },
          { label: 'Cut scenes', cost: 0, effect: { qualityPenalty: -2 }, chance: 1 },
          { label: 'Cut effects', cost: 0, effect: { effectsPenalty: -3 }, chance: 1 },
        ],
      };
    },
  },
  scandal: {
    name: 'Star Scandal',
    severity: 'high',
    resolve(production) {
      const star = production.cast[Math.floor(Math.random() * production.cast.length)];
      return {
        message: `💥 ${star?.name ?? 'A star'} was caught in a scandal!`,
        options: [
          { label: 'PR campaign', cost: 600, effect: { reputationSave: 3 }, chance: 0.7 },
          { label: 'Replace star', cost: 300, effect: { qualityPenalty: -1 }, chance: 1 },
          { label: 'Ignore it', cost: 0, effect: { reputationLoss: -5 }, chance: 1 },
        ],
      };
    },
  },
  weather: {
    name: 'Bad Weather',
    severity: 'low',
    resolve() {
      return {
        message: '⛈️ A storm is ruining the outdoor shoot!',
        options: [
          { label: 'Wait it out', cost: 150, effect: { stageDelay: 2 }, chance: 0.8 },
          { label: 'Build cover set', cost: 400, effect: {}, chance: 0.9 },
          { label: 'Shoot in rain', cost: 0, effect: { qualityBonus: 0.5, risk: true }, chance: 0.4 },
        ],
      };
    },
  },
  equipment_failure: {
    name: 'Equipment Failure',
    severity: 'low',
    resolve() {
      return {
        message: '📹 Camera malfunction! Lights went out.',
        options: [
          { label: 'Quick fix', cost: 100, effect: { stageDelay: 1 }, chance: 0.7 },
          { label: 'Rent replacement', cost: 300, effect: {}, chance: 1 },
          { label: 'Shoot handheld', cost: 0, effect: { qualityPenalty: -0.5 }, chance: 0.6 },
        ],
      };
    },
  },
  inspiration_strike: {
    name: 'Inspiration Strike! ✨',
    severity: 'positive',
    resolve(production) {
      return {
        message: `💡 Director ${production.director?.name ?? 'Rex'} had a breakthrough!`,
        options: [
          { label: 'Follow the vision', cost: 200, effect: { qualityBonus: 2 }, chance: 1 },
          { label: 'Save it for later', cost: 0, effect: { futureBonus: true }, chance: 1 },
        ],
      };
    },
  },
  cameo_opportunity: {
    name: 'Cameo Opportunity',
    severity: 'positive',
    resolve() {
      return {
        message: '🌟 A celebrity wants to make a cameo in your film!',
        options: [
          { label: 'Accept (big budget)', cost: 1000, effect: { popularityBonus: 10, qualityBonus: 0.5 }, chance: 0.8 },
          { label: 'Accept (small)', cost: 300, effect: { popularityBonus: 3 }, chance: 0.6 },
          { label: 'Decline', cost: 0, effect: {}, chance: 1 },
        ],
      };
    },
  },
  competition: {
    name: 'Rival Release',
    severity: 'medium',
    resolve(production) {
      return {
        message: `⚡ A rival studio just announced a similar ${production.genre} film!`,
        options: [
          { label: 'Rush release', cost: 500, effect: { stageDelay: -3, qualityPenalty: -1 }, chance: 0.5 },
          { label: 'Differentiate', cost: 400, effect: { qualityBonus: 1 }, chance: 0.7 },
          { label: 'Ignore', cost: 0, effect: { revenuePenalty: -0.2 }, chance: 1 },
        ],
      };
    },
  },
};

export class CrisisSystem {
  constructor() {
    this.activeCrises = [];
    this.resolvedCrises = [];
  }

  /** Trigger a specific crisis type. */
  trigger(type, production, ctx = {}) {
    const definition = CRISIS_TYPES[type];
    if (!definition) return null;

    const crisis = {
      id: `crisis_${Date.now()}`,
      type,
      ...definition.resolve(production, ctx),
      severity: definition.severity,
    };
    this.activeCrises.push(crisis);
    return crisis;
  }

  /** Trigger a random crisis. */
  triggerRandom(production) {
    const types = Object.keys(CRISIS_TYPES);
    const weights = types.map(t => CRISIS_TYPES[t].severity === 'positive' ? 0.15 : CRISIS_TYPES[t].severity === 'low' ? 0.2 : CRISIS_TYPES[t].severity === 'medium' ? 0.25 : 0.2);
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return this.trigger(types[i], production);
    }
    return this.trigger(types[0], production);
  }

  /** Resolve a crisis by choosing an option. */
  resolve(crisisId, optionIndex) {
    const crisisIdx = this.activeCrises.findIndex(c => c.id === crisisId);
    if (crisisIdx === -1) return null;

    const crisis = this.activeCrises[crisisIdx];
    const option = crisis.options[optionIndex];
    if (!option) return null;

    // Roll for success
    const success = Math.random() < option.chance;
    const result = {
      crisis: crisis.type,
      option: option.label,
      success,
      cost: success ? option.cost : Math.round(option.cost * 1.5),
      effect: success ? option.effect : { ...option.effect, qualityPenalty: (option.effect.qualityPenalty ?? 0) - 1 },
    };

    this.activeCrises.splice(crisisIdx, 1);
    this.resolvedCrises.push(result);
    return result;
  }

  /** Auto-resolve all active crises (pick best option). */
  resolveAllAuto(production) {
    const results = [];
    for (const crisis of [...this.activeCrises]) {
      const bestOption = crisis.options.reduce((best, opt, i) =>
        (opt.effect.qualityBonus ?? 0) > (best.effect.qualityBonus ?? 0) ? opt : best, crisis.options[0]);
      const idx = crisis.options.indexOf(bestOption);
      results.push(this.resolve(crisis.id, idx));
    }
    return results;
  }

  /** Get crisis history. */
  getHistory() { return [...this.resolvedCrises]; }

  /** Count crises by severity. */
  getStats() {
    return {
      active: this.activeCrises.length,
      resolved: this.resolvedCrises.length,
      byType: this.resolvedCrises.reduce((acc, c) => { acc[c.crisis] = (acc[c.crisis] ?? 0) + 1; return acc; }, {}),
    };
  }
}
