import { describe, expect, it } from 'vitest';
import { holdStep, memberDefense, sustainability, teamDefense } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const hit = (max: number) => ({ move: 'x', expected: max, min: max, max });

describe('holdStep: quanti colpi regge (dal tiro più alto)', () => {
  it('OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5', () => {
    expect([hit(1.2), hit(0.6), hit(0.4), hit(0.2)].map(holdStep)).toEqual([0, 0.5, 1, 1.5]);
    expect(holdStep(null)).toBe(1.5);
  });
});

describe('sustainability: recupero contro perdite per turno', () => {
  it('Boots e Magic Guard azzerano Stealth Rock; Magic Guard anche Life Orb', () => {
    const zard = set('Charizard', 'Leftovers', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    expect(sustainability(zard, 1.5)).toBeCloseTo(0.0625 - 0.5);
    expect(sustainability({ ...zard, item: 'Heavy-Duty Boots' }, 1.5)).toBeCloseTo(0);
    const clef = set('Clefable', 'Life Orb', 'Magic Guard', ['Moonblast', 'Moonlight'], 'Modest', { hp: 252, spa: 252 });
    expect(sustainability(clef, 1.5)).toBeCloseTo(0.5);
  });

  it('Regenerator vale 0,33; il recupero si dimezza per chi non regge almeno un 3HKO', () => {
    const slowbro = set('Slowbro', 'Heavy-Duty Boots', 'Regenerator', ['Slack Off', 'Scald'], 'Bold', { hp: 252, def: 252 });
    expect(sustainability(slowbro, 1)).toBeCloseTo(0.5 + 0.33);
    expect(sustainability(slowbro, 0.5)).toBeCloseTo((0.5 + 0.33) / 2);
  });
});

describe('memberDefense', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });

  it('Blissey regge meglio gli speciali dei fisici', () => {
    const m = memberDefense(blissey, [blissey], noStats)!;
    expect(m.special).toBeGreaterThan(m.physical);
  });

  it('Assault Vest alza solo la Robustezza speciale', () => {
    // Un Pokémon non già al massimo della scala sul lato speciale
    const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Jolly', { atk: 252, spe: 252 });
    const plain = memberDefense(chomp, [chomp], noStats)!;
    const av = memberDefense({ ...chomp, item: 'Assault Vest' }, [chomp], noStats)!;
    expect(av.special).toBeGreaterThan(plain.special);
    expect(av.physical).toBe(plain.physical);
  });

  it('valore = 40% Fisica + 40% Speciale + 20% Sostenibilità, mai 100', () => {
    const m = memberDefense(blissey, [blissey], fixtureData)!;
    expect(m.value).toBe(Math.round(0.4 * m.physical + 0.4 * m.special + 0.2 * m.sustain));
    expect(m.value).toBeLessThan(100);
  });

  it('dettaglio della Sostenibilità: recupero (con la fonte migliore), Stealth Rock e Life Orb', () => {
    const skarm = set('Skarmory', 'Leftovers', 'Sturdy', ['Roost', 'Body Press'], 'Impish', { hp: 252, def: 252 });
    const m = memberDefense(skarm, [skarm], noStats)!;
    expect(m.sustainParts.sources).toEqual(['Roost', 'Leftovers']);
    expect(m.sustainParts.rocks).toBeCloseTo(0.125);
    expect(m.sustainParts.lifeOrb).toBe(0);
    expect(m.sustainParts.recovery).toBeCloseTo(m.sustainParts.halved ? (0.5 + 0.0625) / 2 : 0.5 + 0.0625);
    const zard = set('Charizard', 'Life Orb', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252, spe: 252 });
    const z = memberDefense(zard, [zard], noStats)!;
    expect(z.sustainParts).toMatchObject({ sources: [], recovery: 0, lifeOrb: 0.1 });
    expect(z.sustainParts.rocks).toBeCloseTo(0.5);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberDefense(set('Notamon', '', '', [], 'Hardy', {}), [], noStats)).toBeNull();
  });
});

describe('teamDefense', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });
  const skarm = set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Roost', 'Body Press', 'Spikes'], 'Impish', { hp: 252, def: 252 });
  const sweeper = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball'], 'Timid', { spa: 252, spe: 252 });

  it('robustezza del team: media pesata per posizione, poi 40/40/20', () => {
    const team = teamDefense([blissey, skarm], noStats);
    const rw = (vals: number[]) => { const s = [...vals].sort((a, b) => b - a); return Math.round((0.30 * s[0] + 0.22 * s[1]) / 0.52); };
    expect(team.physical).toBe(rw(team.members.map(m => m.physical)));
    expect(team.special).toBe(rw(team.members.map(m => m.special)));
    expect(team.robustness).toBe(Math.round(0.4 * team.physical + 0.4 * team.special + 0.2 * team.sustain));
  });

  it('senza meta: Coverage solo di tipi; Difesa = 50% robustezza + 50% coverage, mai 100', () => {
    const team = teamDefense([blissey, skarm], noStats);
    expect(team.coverageMeta).toBeNull();
    expect(team.coverage).toBe(team.coverageTypes.value);
    expect(team.value).toBe(Math.round(0.5 * team.robustness + 0.5 * team.coverage));
    expect(team.value).toBeLessThan(100);
  });

  it('col meta: Coverage meta con chi regge ogni minaccia (meno del 50% pieno, 2HKO a metà)', () => {
    const team = teamDefense([blissey, skarm], fixtureData);
    expect(team.coverageMeta).not.toBeNull();
    expect(team.coverage).toBe(Math.round((team.coverageTypes.value + team.coverageMeta!.value) / 2));
    for (const row of team.coverageMeta!.rows) {
      for (const h of row.heldBy) expect(h.partial ? h.pct >= 50 && h.pct < 100 : h.pct < 50).toBe(true);
      if (!row.heldBy.some(h => !h.partial)) expect(team.coverageMeta!.unanswered).toContain(row.species);
    }
  });

  it('un team di sweeper fragili ha meno Difesa di uno di muri', () => {
    expect(teamDefense([sweeper, { ...sweeper }], noStats).value).toBeLessThan(teamDefense([blissey, skarm], noStats).value);
  });

  it('righe dei 18 tipi per il dettaglio: sicurezza 0–100 e chi è debole o resiste', () => {
    const team = teamDefense([blissey, skarm], noStats);
    expect(team.coverageTypes.rows).toHaveLength(18);
    const fighting = team.coverageTypes.rows.find(r => r.type === 'Fighting')!;
    expect(fighting.weak).toEqual(['Blissey']);
    expect(fighting.resist).toEqual([]);
    const ground = team.coverageTypes.rows.find(r => r.type === 'Ground')!;
    expect(ground.resist).toEqual(['Skarmory']);
    for (const row of team.coverageTypes.rows) {
      expect(row.safety).toBeGreaterThanOrEqual(0);
      expect(row.safety).toBeLessThanOrEqual(100);
      expect(team.coverageTypes.weak.includes(row.type)).toBe(row.weak.length > row.resist.length);
    }
  });

  it('i deboli di tipo: più membri deboli che resistenti', () => {
    const team = teamDefense([sweeper, { ...sweeper }], noStats);
    expect(team.coverageTypes.weak).toEqual(expect.arrayContaining(['Dragon', 'Ghost', 'Ice', 'Fairy', 'Dark']));
  });

  it('un membro sconosciuto si salta', () => {
    const notamon = set('Notamon', '', '', [], 'Hardy', {});
    expect(teamDefense([blissey, notamon], noStats).value).toBe(teamDefense([blissey], noStats).value);
  });
});
