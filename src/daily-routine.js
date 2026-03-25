/**
 * @module daily-routine
 * Day cycle structure — morning/afternoon/evening/night phases.
 */

export const TIME_PHASES = {
  MORNING: { name: '☀️ Morning', hours: '6:00-12:00', focus: 'management' },
  AFTERNOON: { name: '🎬 Afternoon', hours: '12:00-18:00', focus: 'production' },
  EVENING: { name: '🌆 Evening', hours: '18:00-22:00', focus: 'post_production' },
  NIGHT: { name: '🌙 Night', hours: '22:00-6:00', focus: 'optional' },
};

export const PHASE_ORDER = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];

export class DailyRoutine {
  constructor() {
    this.day = 1;
    this.currentPhase = 'MORNING';
    this.phaseActions = [];
    this.dayLog = [];
    this.currentActions = [];
  }

  /** Get current phase info. */
  get phase() { return TIME_PHASES[this.currentPhase]; }

  /** Get current phase focus area. */
  get focus() { return this.phase.focus; }

  /** Advance to next phase. Returns false if day is complete. */
  advancePhase() {
    const idx = PHASE_ORDER.indexOf(this.currentPhase);
    if (idx < PHASE_ORDER.length - 1) {
      this.currentPhase = PHASE_ORDER[idx + 1];
      return true;
    }
    // Day complete
    this.dayLog.push({ day: this.day, actions: [...this.dayLog] });
    this.day++;
    this.currentPhase = 'MORNING';
    return false;
  }

  /** Record an action in the current phase. */
  addAction(action) {
    this.currentActions.push({ phase: this.currentPhase, ...action });
  }

  /** Get recommended actions for current phase. */
  getRecommendations(context = {}) {
    switch (this.currentPhase) {
      case 'MORNING':
        return [
          { type: 'hire_star', label: '🎤 Hire new talent', available: true },
          { type: 'build', label: '🏗️ Build/upgrade studio lot', available: true },
          { type: 'research', label: '🔬 Research technology', available: true },
          { type: 'review_scripts', label: '📝 Review scripts', available: context.hasScriptOffice },
          { type: 'check_trends', label: '📊 Check genre trends', available: true },
        ];
      case 'AFTERNOON':
        return [
          { type: 'direct_scenes', label: '🎬 Direct scenes', available: context.activeProduction !== undefined },
          { type: 'manage_cast', label: '🎭 Manage cast mood', available: context.cast?.length > 0 },
          { type: 'handle_crisis', label: '⚠️ Handle crisis', available: context.activeCrisis !== undefined },
        ];
      case 'EVENING':
        return [
          { type: 'edit_footage', label: '✂️ Edit footage', available: true },
          { type: 'add_effects', label: '💥 Add effects', available: true },
          { type: 'screening', label: '📽️ Hold screening', available: context.hasScreeningRoom },
          { type: 'cast_party', label: '🎉 Cast party', available: context.cast?.length > 0 },
          { type: 'check_finances', label: '💰 Review finances', available: true },
        ];
      case 'NIGHT':
        return [
          { type: 'secret_screening', label: '🔮 Secret screening (risk/reward)', available: true },
          { type: 'late_night_edit', label: '🌙 Late night editing', available: true },
          { type: 'rest', label: '💤 Rest (reduce stress)', available: true },
        ];
      default:
        return [];
    }
  }

  /** Skip to end of day. */
  endDay() {
    this.currentPhase = 'NIGHT';
    this.day++;
    this.currentPhase = 'MORNING';
    return this.day;
  }

  /** Get full day summary. */
  getDaySummary() {
    return { day: this.day, phase: this.phase.name, focus: this.focus, actions: this.currentActions };
  }

  /** Get day log. */
  getLog() { return [...this.dayLog]; }
}
