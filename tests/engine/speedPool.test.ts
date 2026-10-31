import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { outspeedShare, poolMedian, poolSpecies, SPEED_ITEM_ONLY, SPEED_ITEM_SPLIT, speedPool, speedTier } from '../../src/engine/speed';
import { memberSpeed } from '../../src/engine/speedArea';
import { statusPool } from '../../src/engine/subRoles';
import type { SpeciesStats, StatsData } from '../../src/engine/stats';

const entry = (usage: number, spread: string, items: Record<string, number>, abilities: Record<string, number> = {}): SpeciesStats => ({
  usage, count: 100, abilities, items, moves: {}, teraTypes: {}, spreads: { [spread]: 0.5 }, teammates: {}, checks: {},
});
const statsOf = (pokemon: StatsData['pokemon']): StatsData => ({ meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon });
const dataOf = (pokemon: StatsData['pokemon']): EngineData => ({ stats: statsOf(pokemon), sets: {} });

const data = dataOf({
  'Landorus-Therian': entry(0.4, 'Jolly:0/252/4/0/0/252', { rockyhelmet: 0.5, choicescarf: 0.3 }), // 91 base → 309, Sciarpa 463
  'Iron Valiant': entry(0.3, 'Timid:0/0/0/252/4/252', { boosterenergy: 0.6, choicespecs: 0.3 }, { quarkdrive: 0.9 }), // 364, Booster 546
  'Great Tusk': entry(0.25, 'Jolly:0/252/4/0/0/252', { boosterenergy: 0.5 }, { protosynthesis: 1 }), // l'Attacco è più alto: niente boost
  Rillaboom: entry(0.2, 'Adamant:0/252/0/0/4/252', { choicescarf: 0.85 }), // 85 → 269, Sciarpa 403
  Gholdengo: entry(0.15, 'Timid:0/0/0/252/4/252', { choicescarf: 0.1, airballoon: 0.6 }), // 84 → 293
  Kingambit: entry(0.1, 'Adamant:252/252/0/0/4/0', {}), // senza strumenti nelle statistiche
});
const byName = (name: string) => speedPool(data).filter(r => r.species === name);

describe('gruppo della velocità: Sciarpa e Booster come due versioni della stessa specie', () => {
  it('soglie: da 20% due versioni, da 80% solo quella con lo strumento', () => {
    expect(SPEED_ITEM_SPLIT).toBe(0.2);
    expect(SPEED_ITEM_ONLY).toBe(0.8);
  });

  it('Landorus-T con la Sciarpa al 30%: senza (peso 0,7) e con (peso 0,3)', () => {
    const lando = byName('Landorus-Therian');
    expect(lando.map(r => ({ scarf: r.scarf, weight: r.weight, value: r.value }))).toEqual([
      { scarf: false, weight: 0.7, value: 309 },
      { scarf: true, weight: 0.3, value: 463 },
    ]);
  });

  it('Iron Valiant con la Booster Energy al 60%: senza (0,4) e col boost ×1,5 (0,6)', () => {
    const valiant = byName('Iron Valiant');
    expect(valiant.map(r => ({ booster: !!r.booster, weight: r.weight, value: r.value }))).toEqual([
      { booster: false, weight: 0.4, value: 364 },
      { booster: true, weight: 0.6, value: 546 },
    ]);
    expect(valiant.every(r => !r.scarf)).toBe(true);
  });

  it('Great Tusk con la Booster: una sola versione, perché l\'Attacco è la statistica più alta', () => {
    const tusk = byName('Great Tusk');
    expect(tusk).toHaveLength(1);
    expect(tusk[0].booster).toBeFalsy();
    expect(tusk[0].weight).toBe(1);
  });

  it('Sciarpa all\'85%: solo con la Sciarpa; al 10%: solo senza; senza strumenti: una versione', () => {
    expect(byName('Rillaboom').map(r => ({ scarf: r.scarf, weight: r.weight, value: r.value }))).toEqual([{ scarf: true, weight: 1, value: 403 }]);
    expect(byName('Gholdengo').map(r => ({ scarf: r.scarf, weight: r.weight, value: r.value }))).toEqual([{ scarf: false, weight: 1, value: 293 }]);
    expect(byName('Kingambit').map(r => ({ scarf: r.scarf, weight: r.weight }))).toEqual([{ scarf: false, weight: 1 }]);
  });

  it('la quota superata pesa le versioni: tra 309 e 463 si supera il 70% di Landorus', () => {
    expect(outspeedShare(400, byName('Landorus-Therian'), 'Garchomp')).toBeCloseTo(0.7);
    expect(outspeedShare(500, byName('Landorus-Therian'), 'Garchomp')).toBeCloseTo(1);
    expect(outspeedShare(463, byName('Landorus-Therian'), 'Garchomp')).toBeCloseTo(0.7 + 0.15);
  });

  it('il totale dei rivali e le specie del gruppo contano le specie, non le versioni', () => {
    const garchomp: TeamSet = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { spe: 252 } };
    expect(speedPool(data).length).toBe(8);
    expect(speedTier(garchomp, data)!.total).toBe(6);
    expect(poolSpecies(data)).toEqual(['Landorus-Therian', 'Iron Valiant', 'Great Tusk', 'Rillaboom', 'Gholdengo', 'Kingambit']);
    const status = statusPool(data);
    expect(status.map(r => r.species)).toEqual(poolSpecies(data));
  });

  it('la mediana del gruppo pesa le versioni', () => {
    // Gholdengo da solo con la Sciarpa al 30%: 293 (peso 0,7) e 439 (0,3): la mediana è 293, non la più veloce delle due
    const single = dataOf({ Gholdengo: entry(0.5, 'Timid:0/0/0/252/4/252', { choicescarf: 0.3, airballoon: 0.5 }) });
    expect(speedPool(single).map(r => r.value)).toEqual([293, 439]);
    expect(poolMedian(single)).toBe(293);
  });

  it('la priorità pesa le versioni: tra tutti senza Sciarpa e tutti con, il guadagno sta in mezzo', () => {
    // Dragapult 421 sta tra Landorus (309) e Landorus con la Sciarpa (463): Sucker Punch serve solo contro il secondo
    const pult: TeamSet = { ...emptySet('Dragapult'), item: 'Choice Band', ability: 'Infiltrator', nature: 'Jolly', evs: { atk: 252, spe: 252 }, moves: ['Sucker Punch', 'Dragon Darts', 'Phantom Force', 'U-turn'] };
    const lando = (scarf: number) => dataOf({ 'Landorus-Therian': entry(0.4, 'Jolly:0/252/4/0/0/252', { rockyhelmet: 1 - scarf, choicescarf: scarf }) });
    const gain = (d: EngineData) => memberSpeed(pult, [pult], d)!.gains.find(g => g.condition === 'priority')?.gain ?? 0;
    const none = gain(lando(0));
    const all = gain(lando(1));
    const split = gain(lando(0.3));
    expect(none).toBe(0);
    expect(all).toBeGreaterThan(0);
    expect(split).toBeGreaterThan(none);
    expect(split).toBeLessThan(all);
    expect(split).toBeCloseTo(0.3 * all);
  });

  it('senza meta: una versione per specie, peso 1, nessun Booster', () => {
    const pool = speedPool({ stats: null, sets: null });
    expect(pool.length).toBeGreaterThan(20);
    expect(pool.every(r => r.weight === 1 && !r.booster && !r.scarf)).toBe(true);
  });
});
