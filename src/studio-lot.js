/**
 * @module studio-lot
 * Studio lot management — place buildings, manage adjacency bonuses, upgrade tiers.
 * Inspired by The Movies (2005) and Two Point Hospital.
 */

export const BUILDING_TYPES = {
  script_office:     { name: 'Script Office',       baseCost: 500,  footprint: [3, 3] },
  casting_office:    { name: 'Casting Office',      baseCost: 600,  footprint: [3, 3] },
  sound_stage_small: { name: 'Sound Stage (S)',     baseCost: 1000, footprint: [5, 5] },
  sound_stage_med:   { name: 'Sound Stage (M)',     baseCost: 2000, footprint: [7, 7] },
  sound_stage_large: { name: 'Sound Stage (L)',     baseCost: 4000, footprint: [9, 9] },
  set_workshop:      { name: 'Set Workshop',        baseCost: 400,  footprint: [4, 3] },
  costume_dept:      { name: 'Costume Department',  baseCost: 350,  footprint: [3, 3] },
  props_workshop:    { name: 'Props Workshop',      baseCost: 300,  footprint: [3, 2] },
  post_production:   { name: 'Post-Production Suite', baseCost: 800, footprint: [4, 4] },
  screening_room:    { name: 'Screening Room',      baseCost: 700,  footprint: [4, 4] },
  vip_lounge:        { name: 'VIP Lounge',          baseCost: 900,  footprint: [3, 3] },
  research_lab:      { name: 'Research Lab',        baseCost: 1200, footprint: [4, 3] },
  award_shelf:       { name: 'Award Shelf',         baseCost: 200,  footprint: [2, 2] },
};

// Adjacency bonuses: [typeA, typeB] → bonus description & multiplier
export const ADJACENCY_BONUSES = [
  { a: 'script_office', b: 'screening_room', label: 'Script Feedback Loop', effect: { scriptQuality: 0.1 } },
  { a: 'sound_stage_small', b: 'set_workshop', label: 'Quick Set Change', effect: { shootingSpeed: 0.15 } },
  { a: 'sound_stage_med', b: 'set_workshop', label: 'Quick Set Change', effect: { shootingSpeed: 0.15 } },
  { a: 'sound_stage_large', b: 'set_workshop', label: 'Quick Set Change', effect: { shootingSpeed: 0.15 } },
  { a: 'post_production', b: 'screening_room', label: 'Fast Iteration', effect: { editSpeed: 0.1 } },
  { a: 'casting_office', b: 'vip_lounge', label: 'Celebrity Magnet', effect: { castQuality: 0.1 } },
  { a: 'research_lab', b: 'post_production', label: 'Tech Transfer', effect: { effectQuality: 0.1 } },
  { a: 'costume_dept', b: 'props_workshop', label: 'Full Wardrobe', effect: { productionValue: 0.05 } },
  { a: 'award_shelf', b: 'vip_lounge', label: 'Prestige Display', effect: { reputation: 0.05 } },
];

export class StudioLot {
  constructor({ name = 'CraftMind Studios', width = 100, depth = 100 } = {}) {
    this.name = name;
    this.width = width;
    this.depth = depth;
    this.buildings = new Map(); // id → { type, x, z, tier, hp }
    this._nextId = 1;
  }

  placeBuilding(type, { x, z, tier = 1 } = {}) {
    if (!BUILDING_TYPES[type]) throw new Error(`Unknown building type: ${type}`);
    const def = BUILDING_TYPES[type];
    const id = `${type}_${this._nextId++}`;

    // Check overlap
    for (const [, b] of this.buildings) {
      const bDef = BUILDING_TYPES[b.type];
      if (rectsOverlap(x, z, def.footprint, b.x, b.z, bDef.footprint)) {
        throw new Error(`Building overlaps with ${b.type} at (${b.x},${b.z})`);
      }
    }

    const building = { type, x, z, tier: Math.min(tier, 5), hp: 100, id };
    this.buildings.set(id, building);
    return building;
  }

  removeBuilding(id) {
    return this.buildings.delete(id);
  }

  upgradeBuilding(id) {
    const b = this.buildings.get(id);
    if (!b) throw new Error(`Building ${id} not found`);
    if (b.tier >= 5) return false;
    b.tier++;
    return true;
  }

  getBuildings() {
    return [...this.buildings.values()];
  }

  getBuildingsOfType(type) {
    return this.getBuildings().filter(b => b.type === type);
  }

  /** Calculate all active adjacency bonuses. */
  getActiveBonuses() {
    const active = [];
    for (const bonus of ADJACENCY_BONUSES) {
      const aBuildings = this.getBuildingsOfType(bonus.a);
      const bBuildings = this.getBuildingsOfType(bonus.b);
      for (const a of aBuildings) {
        for (const b of bBuildings) {
          if (isAdjacent(a, b)) {
            active.push({ ...bonus, buildingA: a.id, buildingB: b.id });
          }
        }
      }
    }
    return active;
  }

  /** Get total bonus multiplier for a given effect key (e.g. 'scriptQuality'). */
  getBonusMultiplier(effectKey) {
    return this.getActiveBonuses().reduce((sum, b) => {
      return sum + (b.effect[effectKey] ?? 0) * Math.max(bonus.tier(a), bonus.tier(b));
    }, 0);
    function bonus() { return null; } // just for clarity above; we use building tiers
  }

  /** Get total monthly maintenance cost. */
  getMaintenanceCost() {
    let total = 0;
    for (const b of this.buildings.values()) {
      const def = BUILDING_TYPES[b.type];
      total += def.baseCost * 0.01 * b.tier; // 1% of base cost per tier per month
    }
    return Math.round(total);
  }

  /** Get capacity stats. */
  getStats() {
    const stats = { buildings: this.buildings.size, bonuses: this.getActiveBonuses().length, maintenanceCost: this.getMonthlyCost() };
    for (const type of Object.keys(BUILDING_TYPES)) {
      stats[type] = this.getBuildingsOfType(type).length;
    }
    return stats;
  }

  toJSON() {
    return { name: this.name, width: this.width, depth: this.depth, buildings: [...this.buildings.values()] };
  }

  static fromJSON(data) {
    const lot = new StudioLot({ name: data.name, width: data.width, depth: data.depth });
    for (const b of data.buildings ?? []) {
      lot.buildings.set(b.id, { ...b });
      lot._nextId = Math.max(lot._nextId, parseInt(b.id.split('_').pop()) + 1);
    }
    return lot;
  }
}

// Fix: proper bonus multiplier using building tiers
StudioLot.prototype.getBonusMultiplier = function(effectKey) {
  return this.getActiveBonuses().reduce((sum, b) => {
    const aB = this.buildings.get(b.buildingA);
    const bB = this.buildings.get(b.buildingB);
    const avgTier = ((aB?.tier ?? 1) + (bB?.tier ?? 1)) / 2;
    return sum + (b.effect[effectKey] ?? 0) * avgTier;
  }, 0);
};

function getMonthlyCost() { return this.getMaintenanceCost(); }
StudioLot.prototype.getMonthlyCost = function() { return this.getMaintenanceCost(); };

function rectsOverlap(ax, az, aFoot, bx, bz, bFoot) {
  return ax < bx + bFoot[0] && ax + aFoot[0] > bx && az < bz + bFoot[1] && az + aFoot[1] > bz;
}

function isAdjacent(a, b) {
  const dist = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
  return dist <= 3; // within 3 blocks counts as adjacent
}
