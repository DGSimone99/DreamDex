import { describe, expect, it } from 'vitest';
import { coverageTargets, teamCoverage, typeAverage } from '../../src/engine/coverage';
import { bestHit } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';
import { usageOf } from '../../src/engine/stats';
import { fixtureData, fixtureStats } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noMeta = { ...fixtureData, ignoreMeta: true, formatId: 'ou' as const };
const teamOffenseRows = (team: TeamSet[]) => teamCoverage(team, noMeta).rows;
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake'], 'Adamant', { atk: 252, spe: 252 });

describe('coverageTargets', () => {
  it('col meta: le combinazioni di tipi dei più usati, pesate per uso, col Pokémon più usato di ognuna', () => {
    const targets = coverageTargets(fixtureData);
    expect(targets.reduce((a, t) => a + t.weight, 0)).toBeCloseTo(1);
    const labels = targets.map(t => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const target of targets) {
      const sameTypes = targets.filter(t => t.label === target.label);
      expect(sameTypes).toHaveLength(1);
      expect(usageOf(fixtureStats, target.set.species)).toBeGreaterThan(0);
    }
  });

  it('senza meta: i 18 tipi con lo stesso peso, contro un bersaglio neutro', () => {
    const targets = coverageTargets(noMeta);
    expect(targets).toHaveLength(18);
    for (const target of targets) {
      expect(target.weight).toBeCloseTo(1 / 18);
      expect(target.set.species).toBe('Mew');
      expect(target.set.types).toEqual([target.label]);
      expect(target.set.baseStats).toEqual(typeAverage(target.label, noMeta));
    }
    // Il bersaglio neutro prende il tipo: Earthquake è super efficace sull'Elettro, nullo sul Volante
    const electric = targets.find(t => t.label === 'Electric')!.set;
    const flying = targets.find(t => t.label === 'Flying')!.set;
    expect(bestHit(chomp, electric)!.expected).toBeGreaterThan(bestHit(chomp, targets.find(t => t.label === 'Water')!.set)!.expected);
    expect(bestHit(chomp, flying)!.expected).toBe(0);
  });
});

describe('manichini per tipo', () => {
  it("l'Acciaio medio del National Dex ha le difese di Bulbapedia (Mega comprese)", () => {
    const steel = typeAverage('Steel', { stats: null, sets: null, formatId: 'ou' });
    expect(Math.abs(steel.hp - 79)).toBeLessThanOrEqual(3);
    expect(Math.abs(steel.def - 116)).toBeLessThanOrEqual(3);
    expect(Math.abs(steel.spd - 90)).toBeLessThanOrEqual(3);
  });

  it('il manichino ha il peso tipico del tipo: Low Kick e Heavy Slam non sono più 20 e 120 fissi', () => {
    const targets = coverageTargets(noMeta);
    const of = (type: string) => targets.find(t => t.label === type)!.set;
    expect(of('Steel').weightkg).toBeGreaterThan(100);
    expect(of('Fairy').weightkg).toBeLessThan(25);
    // Grass Knot su un Acqua medio (55 kg: 80 di potenza; con Mew da 4 kg era 20)
    const gholdengo = set('Gholdengo', '', 'Good as Gold', ['Grass Knot'], 'Modest', { spa: 252 });
    const water = bestHit(gholdengo, of('Water'))!.expected;
    expect(water).toBeGreaterThan(0.5);
  });

  it("in Gen 9 niente Mega: l'Acciaio medio ha meno Difesa", () => {
    const natdex = typeAverage('Steel', { stats: null, sets: null, formatId: 'ou' });
    const gen9 = typeAverage('Steel', { stats: null, sets: null, formatId: 'gen9ou' });
    expect(gen9.def).toBeLessThan(natdex.def);
  });

  it('il Coleottero medio è più fragile della Roccia media, e lo stesso colpo neutro gli fa più male del Drago medio', () => {
    const data = { stats: null, sets: null, formatId: 'ou' as const };
    expect(typeAverage('Bug', data).def).toBeLessThan(typeAverage('Rock', data).def);
    const targets = coverageTargets(noMeta);
    const slam = set('Garchomp', '', 'Rough Skin', ['Body Slam'], 'Adamant', { atk: 252 });
    const bug = targets.find(t => t.label === 'Bug')!.set;
    const dragon = targets.find(t => t.label === 'Dragon')!.set;
    expect(bestHit(slam, bug)!.expected).toBeGreaterThan(bestHit(slam, dragon)!.expected);
  });
});

describe('teamCoverage', () => {
  it('un tipo che nessuno scalfisce è un buco', () => {
    const coverage = teamCoverage([chomp], noMeta);
    expect(coverage.holes).toContain('Flying');
    expect(coverage.value).toBeGreaterThan(0);
    expect(coverage.value).toBeLessThan(100);
    expect(coverage.perMember).toHaveLength(1);
  });

  it('copre solo un colpo super efficace: un colpo neutro forte non basta', () => {
    // Headlong Rush con Choice Band: sul Normale è neutro ma oltre il 50%, sull'Elettro super efficace
    const tusk = set('Great Tusk', 'Choice Band', 'Protosynthesis', ['Headlong Rush'], 'Adamant', { atk: 252, spe: 252 });
    const normal = coverageTargets(noMeta).find(t => t.label === 'Normal')!.set;
    expect(bestHit(tusk, normal)!.expected).toBeGreaterThanOrEqual(0.5);
    const rows = teamOffenseRows([tusk]);
    expect(rows.find(r => r.label === 'Normal')!.coveredBy).toEqual([]);
    expect(rows.find(r => r.label === 'Electric')!.coveredBy.map(c => c.move)).toEqual(['Headlong Rush']);
  });

  it('un superefficace da 3HKO (fra il 33% e il 50%) copre a metà', () => {
    // Urshifu-RS con Choice Scarf: Ice Spinner (80, non STAB) fa circa il 43% al Drago medio
    const urshifu = set('Urshifu-Rapid-Strike', 'Choice Scarf', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'U-turn', 'Ice Spinner'], 'Jolly', { atk: 252, spe: 252 });
    const flying = teamOffenseRows([urshifu]).find(r => r.label === 'Dragon')!;
    expect(flying.coveredBy).toEqual([expect.objectContaining({ move: 'Ice Spinner', partial: true })]);
    // Metà del 70% del primo membro
    expect(flying.level).toBe(35);
    expect(flying.coveredBy[0].pct).toBeGreaterThanOrEqual(33);
    expect(flying.coveredBy[0].pct).toBeLessThan(50);
    // Due membri da 3HKO: 35 + 10
    const two = teamCoverage([urshifu, { ...urshifu }], noMeta).rows.find(r => r.label === 'Dragon')!;
    expect(two.level).toBe(45);
  });

  it('il meteo che il membro porta con la sua abilità vale anche nella Coverage (Drought e Solar Beam)', () => {
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Solar Beam', 'Lava Plume'], 'Modest', { hp: 252, spa: 252 });
    const water = coverageTargets(noMeta).find(t => t.label === 'Water')!.set;
    const sun = bestHit(torkoal, water, { conditions: ['sun'], superEffectiveOnly: true })!;
    const row = teamOffenseRows([torkoal]).find(r => r.label === 'Water')!;
    expect(row.coveredBy[0].move).toBe('Solar Beam');
    expect(row.coveredBy[0].pct).toBe(Math.floor(100 * Math.min(1, sun.expected)));
  });

  it('anche coprendo tutto tre volte la Coverage non arriva a 100', () => {
    const all = set('Mew', 'Life Orb', 'Synchronize', ['Psystrike', 'Fusion Bolt', 'Fusion Flare', 'Precipice Blades'], 'Modest', { spa: 252, atk: 252 });
    expect(teamCoverage([all, { ...all }, { ...all }, { ...all }], noMeta).value).toBeLessThan(100);
  });

  it('profondità: due membri che coprono gli stessi tipi valgono più di uno', () => {
    expect(teamCoverage([chomp, { ...chomp }], noMeta).value).toBeGreaterThan(teamCoverage([chomp], noMeta).value);
  });

  it('una mossa speciale debole su un attaccante fisico non copre niente', () => {
    // Senza Life Orb: Ice Beam da Garchomp fa al massimo il 32% (al Volante medio), sotto il 3HKO
    const plain = { ...chomp, item: '' };
    const weak = { ...plain, moves: ['Earthquake', 'Ice Beam'] };
    expect(teamCoverage([weak], noMeta).value).toBe(teamCoverage([plain], noMeta).value);
  });
});

describe('Coverage meta: colpo migliore di qualunque tipo, solo 2HKO', () => {
  const tusk = set('Great Tusk', 'Choice Band', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner'], 'Adamant', { atk: 252, spe: 252 });
  const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Knock Off'], 'Jolly', { atk: 252, spe: 252 });
  const targets = coverageTargets(fixtureData, 'meta');
  const any = (attacker: TeamSet, i: number) => Math.min(1, bestHit(attacker, targets[i].set)?.expected ?? 0);
  const superOnly = (attacker: TeamSet, i: number) => Math.min(1, bestHit(attacker, targets[i].set, { superEffectiveOnly: true })?.expected ?? 0);

  it('un colpo neutro da 2HKO copre il bersaglio del meta', () => {
    const i = targets.findIndex((_, k) => any(tusk, k) >= 0.5 && superOnly(tusk, k) < 0.5);
    expect(i).toBeGreaterThanOrEqual(0);
    const row = teamCoverage([tusk], fixtureData, 'meta').rows[i];
    expect(row.level).toBe(50);
    expect(row.coveredBy).toEqual([expect.objectContaining({ species: 'Great Tusk', partial: false })]);
  });

  it('un 3HKO non vale niente nel meta (nei tipi resta a metà)', () => {
    const i = targets.findIndex((_, k) => any(gliscor, k) >= 1 / 3 && any(gliscor, k) < 0.5);
    expect(i).toBeGreaterThanOrEqual(0);
    const row = teamCoverage([gliscor], fixtureData, 'meta').rows[i];
    expect(row.level).toBe(0);
    expect(row.coveredBy).toEqual([]);
  });

  it('per ogni bersaglio una casella per membro: danno del colpo semplice e, con il setup, dopo una danza', () => {
    const notamon = set('Notamon', '', '', ['Tackle'], 'Hardy', {});
    const rows = teamCoverage([tusk, gliscor, notamon], fixtureData, 'meta').rows;
    for (const row of rows) {
      expect(row.cells).toHaveLength(3);
      expect(row.cells![0].setupPct).toBeNull();
      expect(row.cells![2].pct).toBe(-1);
      expect(row.cells![1].setupPct).toBeGreaterThanOrEqual(row.cells![1].pct);
    }
    expect(rows.some(row => row.cells![1].setupPct! > row.cells![1].pct)).toBe(true);
    const i = targets.findIndex((_, k) => any(tusk, k) > 0);
    expect(rows[i].cells![0].pct).toBe(Math.floor(100 * any(tusk, i)));
  });

  it('chiedere la Coverage meta senza meta non sporca la Coverage di tipi dello stesso set', () => {
    const noMetaData = { ...fixtureData, ignoreMeta: true };
    const before = teamCoverage([tusk], noMetaData, 'types').value;
    teamCoverage([{ ...tusk }], noMetaData, 'meta');
    expect(teamCoverage([{ ...tusk }], noMetaData, 'types').value).toBe(before);
    // Senza meta la Coverage "meta" è quella di tipi: solo colpi super efficaci, nessuna casella
    expect(teamCoverage([{ ...tusk }], noMetaData, 'meta').rows.every(r => r.cells === null)).toBe(true);
  });

  it('la Coverage di tipi non ha caselle', () => {
    expect(teamCoverage([tusk], noMeta, 'types').rows.every(row => row.cells === null)).toBe(true);
  });
});
