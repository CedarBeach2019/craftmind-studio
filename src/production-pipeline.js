/**
 * @module production-pipeline
 * Film production workflow — pre-production → shooting → post-production → release.
 */

export const STAGES = {
  SCRIPT: 'script', CASTING: 'casting', SET_BUILDING: 'set_building', REHEARSAL: 'rehearsal',
  SHOOTING: 'shooting', EDITING: 'editing', EFFECTS: 'effects', SOUND: 'sound',
  MUSIC: 'music', COLOR_GRADE: 'color_grade', PREMIERE: 'premiere', RELEASE: 'release',
};

export const STAGE_ORDER = Object.values(STAGES);

export class Production {
  constructor({ title, genre, budget, director, cast = [], studioLot } = {}) {
    this.id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.title = title;
    this.genre = genre;
    this.budget = budget;
    this.initialBudget = budget;
    this.director = director; // Star instance or null
    this.cast = cast; // Star instances
    this.studioLot = studioLot; // StudioLot instance

    this.currentStage = STAGES.SCRIPT;
    this.stageProgress = 0; // 0-1 within current stage
    this.dayCount = 0;
    this.stageLog = [];

    // Quality accumulators
    this.quality = {
      script: 0, casting: 0, rehearsal: 0, shooting: 0,
      editing: 0, effects: 0, sound: 0, music: 0, colorGrade: 0,
    };
    this.totalQuality = 0;

    // Events
    this.events = [];
    this.activeCrises = [];

    this.status = 'planning'; // planning | in_production | post_production | released | cancelled
    this.costs = { cast: 0, sets: 0, postProduction: 0, marketing: 0, misc: 0 };
  }

  /** Get current stage display name. */
  get stageName() {
    const names = {
      script: '📝 Script Writing', casting: '🎭 Casting', set_building: '🏗️ Set Building',
      rehearsal: '🎤 Rehearsal', shooting: '🎬 Shooting', editing: '✂️ Editing',
      effects: '💥 Effects', sound: '🔊 Sound', music: '🎵 Music',
      color_grade: '🎨 Color Grading', premiere: '🌟 Premiere', release: '🚀 Release',
    };
    return names[this.currentStage] ?? this.currentStage;
  }

  /** Advance production by one day. */
  advanceDay(crisisSystem) {
    if (this.status === 'released' || this.status === 'cancelled') return null;

    this.dayCount++;
    const results = { day: this.dayCount, stage: this.currentStage, events: [], qualityGain: 0 };

    // Check for crisis
    if (crisisSystem && Math.random() < 0.15) {
      const crisis = crisisSystem.triggerRandom(this);
      if (crisis) {
        this.activeCrises.push(crisis);
        results.events.push(crisis);
      }
    }

    // Advance current stage
    const speed = this._getStageSpeed();
    this.stageProgress += speed;

    // Quality gain for the day
    const qualityGain = this._calculateQualityGain();
    this.quality[this.currentStage] = Math.min(10, this.quality[this.currentStage] + qualityGain);
    results.qualityGain = qualityGain;

    // Cost for the day
    const dailyCost = this._getDailyCost();
    this.budget -= dailyCost;

    // Check if stage complete
    if (this.stageProgress >= 1) {
      this._completeStage(results);
    }

    // Budget crisis check
    if (this.budget < 0) {
      results.events.push({ type: 'budget_crisis', message: `${this.title}: BUDGET OVERFLOW! -$${Math.abs(Math.round(this.budget))}` });
    }

    // Update overall quality
    this.totalQuality = this._calculateTotalQuality();

    results.budget = this.budget;
    results.status = this.status;
    return results;
  }

  _getStageSpeed() {
    // Base speed per stage
    const baseSpeeds = {
      script: 0.25, casting: 0.2, set_building: 0.15, rehearsal: 0.2,
      shooting: 0.1, editing: 0.15, effects: 0.12, sound: 0.2,
      music: 0.2, color_grade: 0.25, premiere: 1.0, release: 1.0,
    };
    let speed = baseSpeeds[this.currentStage] ?? 0.15;

    // Director bonus
    if (this.director) speed *= 1 + (this.director.genreFit(this.genre) - 5) * 0.05;

    // Cast chemistry bonus during shooting/rehearsal
    if (this.currentStage === 'shooting' || this.currentStage === 'rehearsal') {
      const avgChemistry = this._getAverageChemistry();
      speed *= 1 + avgChemistry * 0.05;
    }

    // Stress penalty
    const avgStress = this._getAverageStress();
    if (avgStress > 60) speed *= 0.8;
    if (avgStress > 80) speed *= 0.5;

    // Crisis penalty
    if (this.activeCrises.length > 0) speed *= 0.7;

    return speed;
  }

  _calculateQualityGain() {
    let gain = 0.3 + Math.random() * 0.4;

    // Director genre fit
    if (this.director) gain += (this.director.genreFit(this.genre) - 5) * 0.05;

    // Star talent for genre
    if (['shooting', 'rehearsal'].includes(this.currentStage)) {
      const avgFit = this.cast.reduce((s, star) => s + star.genreFit(this.genre), 0) / Math.max(this.cast.length, 1);
      gain += (avgFit - 5) * 0.04;
    }

    // Mood bonus
    const avgMood = this._getAverageMood();
    gain += (avgMood - 50) * 0.005;

    return Math.max(0, gain);
  }

  _getDailyCost() {
    const baseCosts = {
      script: 50, casting: 80, set_building: 200, rehearsal: 100,
      shooting: 300, editing: 100, effects: 250, sound: 80,
      music: 120, color_grade: 60, premiere: 500, release: 200,
    };
    let cost = baseCosts[this.currentStage] ?? 100;

    // Cast salaries
    if (['shooting', 'rehearsal', 'premiere'].includes(this.currentStage)) {
      for (const star of this.cast) {
        cost += star.salary * 0.1; // daily rate = 10% of salary
      }
    }
    // Director salary
    if (this.director && ['shooting', 'premiere', 'release'].includes(this.currentStage)) {
      cost += this.director.salary * 0.15;
    }

    return Math.round(cost);
  }

  _completeStage(results) {
    const stageName = this.currentStage;
    this.stageLog.push({ stage: stageName, quality: this.quality[stageName], day: this.dayCount });

    // Stars work during their stages
    if (['rehearsal', 'shooting'].includes(stageName)) {
      for (const star of this.cast) {
        star.adjustStress(stageName === 'shooting' ? 3 : 1);
        const meltdown = star.workDay(this.genre);
        if (meltdown) {
          results.events.push(meltdown);
          this.activeCrises.push(meltdown);
        }
      }
    }

    const idx = STAGE_ORDER.indexOf(this.currentStage);
    if (idx < STAGE_ORDER.length - 1) {
      this.currentStage = STAGE_ORDER[idx + 1];
      this.stageProgress = 0;

      // Update status
      if (['shooting'].includes(this.currentStage)) this.status = 'in_production';
      if (['editing', 'effects', 'sound', 'music', 'color_grade'].includes(this.currentStage)) this.status = 'post_production';
    } else {
      this.status = 'released';
    }

    results.stageCompleted = stageName;
  }

  _calculateTotalQuality() {
    const weights = {
      script: 0.15, casting: 0.1, rehearsal: 0.05, shooting: 0.25,
      editing: 0.15, effects: 0.1, sound: 0.08, music: 0.07, colorGrade: 0.05,
    };
    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += (this.quality[key] ?? 0) * weight;
    }
    return Math.round(total * 10) / 10;
  }

  _getAverageChemistry() {
    if (this.cast.length < 2) return 0;
    let sum = 0, count = 0;
    for (let i = 0; i < this.cast.length; i++) {
      for (let j = i + 1; j < this.cast.length; j++) {
        sum += this.cast[i].getChemistryBonus(this.cast[j].id);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  _getAverageStress() {
    const all = [this.director, ...this.cast].filter(Boolean);
    return all.length > 0 ? all.reduce((s, star) => s + star.stress, 0) / all.length : 50;
  }

  _getAverageMood() {
    const all = [this.director, ...this.cast].filter(Boolean);
    return all.length > 0 ? all.reduce((s, star) => s + star.mood, 0) / all.length : 50;
  }

  /** Skip to release (for testing/demos). */
  fastForward() {
    while (this.status !== 'released' && this.status !== 'cancelled' && this.dayCount < 200) {
      this.advanceDay(null);
    }
    return this;
  }

  /** Get summary. */
  getSummary() {
    return {
      id: this.id, title: this.title, genre: this.genre, status: this.status,
      day: this.dayCount, stage: this.stageName, budget: Math.round(this.budget),
      totalSpent: Math.round(this.initialBudget - this.budget),
      quality: this.totalQuality,
    };
  }
}
