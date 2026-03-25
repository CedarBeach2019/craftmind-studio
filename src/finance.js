/**
 * @module finance
 * Studio economics — revenue, costs, genre trends, investors, sequels.
 */

export class StudioFinance {
  constructor({ treasury = 10000, reputation = 30 } = {}) {
    this.treasury = treasury;
    this.reputation = clamp(reputation, 0, 100);
    this.filmHistory = [];
    this.monthlyExpenses = 0;
    this.investors = [];
    this.loanDebt = 0;
    this.genreTrends = {};
    this.franchises = new Map(); // franchiseName → { films: [], totalRevenue: 0 }
    this.totalRevenue = 0;
    this.totalProfit = 0;
    this.totalSpent = 0;
  }

  /** Pay for something. Returns false if can't afford. */
  spend(amount, category = 'misc') {
    if (amount > this.treasury) return false;
    this.treasury -= amount;
    this.totalSpent += amount;
    this.filmHistory[this.filmHistory.length - 1]?.costs[category] &&
      (this.filmHistory[this.filmHistory.length - 1].costs[category] += amount);
    return true;
  }

  /** Receive income. */
  receive(amount, source = 'unknown') {
    this.treasury += amount;
    this.totalRevenue += amount;
    return amount;
  }

  /** Take a loan. */
  takeLoan(amount, interestRate = 0.1) {
    this.loanDebt += Math.round(amount * (1 + interestRate));
    this.treasury += amount;
    this.reputation = clamp(this.reputation - 2, 0, 100);
    return { amount, owed: this.loanDebt };
  }

  /** Repay loan. */
  repayLoan(amount) {
    const paid = Math.min(amount, this.loanDebt);
    this.loanDebt -= paid;
    this.treasury -= paid;
    if (this.loanDebt <= 0) this.reputation = clamp(this.reputation + 3, 0, 100);
    return paid;
  }

  /** Pay monthly expenses. */
  payMonthly({ staffSalaries, buildingMaintenance } = {}) {
    const staff = staffSalaries ?? 0;
    const buildings = buildingMaintenance ?? 0;
    const total = staff + buildings;
    this.treasury -= total;
    this.monthlyExpenses = total;

    // Loan interest
    if (this.loanDebt > 0) {
      const interest = Math.round(this.loanDebt * 0.02);
      this.loanDebt += interest;
      this.treasury -= interest;
    }
    return total;
  }

  /** Set genre trend. */
  setGenreTrend(genre, heat) {
    this.genreTrends[genre] = clamp(heat, 0, 1);
  }

  /** Get trend multiplier for a genre. */
  getGenreTrend(genre) {
    return this.genreTrends[genre] ?? 0.5;
  }

  /** Shift all genre trends randomly (call monthly). */
  shiftTrends() {
    for (const genre of Object.keys(this.genreTrends)) {
      this.genreTrends[genre] = clamp(this.genreTrends[genre] + (Math.random() - 0.5) * 0.2, 0, 1);
    }
  }

  /** Calculate box office for a released film. */
  calculateBoxOffice(film) {
    const { quality, genre, cast = [], title } = film;

    // Base revenue from quality (0-10 score → revenue multiplier)
    const qualityMultiplier = (quality / 5); // quality 5 = 1x, quality 10 = 2x
    const baseRevenue = 2000;

    // Star power bonus
    let starPower = 0;
    for (const star of cast) {
      starPower += star.popularity * 0.01 * star.fanBase * 0.01;
    }

    // Genre trend bonus
    const trendMultiplier = 0.5 + this.getGenreTrend(genre);

    // Reputation bonus
    const repMultiplier = 0.5 + this.reputation * 0.01;

    // Franchise bonus
    let franchiseMultiplier = 1;
    const franchise = this._findFranchise(title);
    if (franchise && franchise.films.length > 1) {
      franchiseMultiplier = 1 + franchise.films.length * 0.15;
    }

    // Meme/viral potential (small chance of going viral)
    const viralMultiplier = Math.random() < 0.1 ? (1 + Math.random() * 2) : 1;

    const totalRevenue = Math.round(
      baseRevenue * qualityMultiplier * (1 + starPower) * trendMultiplier * repMultiplier * franchiseMultiplier * viralMultiplier
    );

    return {
      gross: totalRevenue,
      breakdown: { qualityMultiplier, starPower, trendMultiplier, repMultiplier, franchiseMultiplier, viralMultiplier },
    };
  }

  /** Process a film release. */
  releaseFilm(film) {
    const boxOffice = this.calculateBoxOffice(film);
    const costs = film.totalSpent ?? film.initialBudget * 0.8;
    const profit = boxOffice.gross - costs;

    this.receive(boxOffice.gross, 'box_office');
    this.totalProfit += profit;

    // Update reputation
    if (film.quality >= 8) this.reputation = clamp(this.reputation + 5, 0, 100);
    else if (film.quality >= 6) this.reputation = clamp(this.reputation + 2, 0, 100);
    else if (film.quality < 4) this.reputation = clamp(this.reputation - 3, 0, 100);

    // Track franchise
    const franchise = this._findOrCreateFranchise(film.title);
    franchise.films.push(film);
    franchise.totalRevenue += boxOffice.gross;

    // Record in history
    const record = {
      title: film.title, genre: film.genre, quality: film.quality,
      gross: boxOffice.gross, costs, profit, day: film.dayCount ?? 0,
    };
    this.filmHistory.push(record);

    return { ...boxOffice, costs, profit, record };
  }

  /** Add an investor. */
  addInvestor({ name, capital, equityShare = 0.1 }) {
    this.investors.push({ name, capital, equityShare, invested: capital });
    this.treasury += capital;
    return { capital, totalEquity: this.investors.reduce((s, i) => s + i.equityShare, 0) };
  }

  /** Get studio summary. */
  getSummary() {
    return {
      treasury: Math.round(this.treasury),
      reputation: Math.round(this.reputation),
      totalRevenue: Math.round(this.totalRevenue),
      totalProfit: Math.round(this.totalProfit),
      totalSpent: Math.round(this.totalSpent),
      loanDebt: Math.round(this.loanDebt),
      filmsReleased: this.filmHistory.length,
      monthlyExpenses: Math.round(this.monthlyExpenses),
      investors: this.investors.length,
      franchises: this.franchises.size,
    };
  }

  _findFranchise(title) {
    for (const [, f] of this.franchises) {
      if (f.films.some(fi => fi.title.includes(title.split(':')[0]?.split(' ').slice(0, 2).join(' ') ?? ''))) return f;
    }
    return null;
  }

  _findOrCreateFranchise(title) {
    const existing = this._findFranchise(title);
    if (existing) return existing;
    const key = title.split(':')[0]?.split(' ').slice(0, 2).join(' ') || title;
    const franchise = { name: key, films: [], totalRevenue: 0 };
    this.franchises.set(key, franchise);
    return franchise;
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
