import { describe, expect, it } from 'vitest';
import { teamCoverage } from '../../src/engine/coverage';
import { teamOffense } from '../../src/engine/offense';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { WEAR_CREDIT, wearers } from '../../src/engine/wear';
import { fixtureData } from '../fixtures/data';

// I bersagli del meta di prova: Great Tusk, Gholdengo, Kingambit, Dragapult, Corviknight, Toxapex, Rotom-Wash, Garchomp
const blissey: TeamSet = {
  ...emptySet('Blissey'), ability: 'Natural Cure', item: 'Heavy-Duty Boots', nature: 'Bold', evs: { hp: 252, def: 252, spd: 4 },
  moves: ['Toxic', 'Soft-Boiled', 'Seismic Toss', 'Stealth Rock'],
};
const target = (species: string, ability: string, item = 'Leftovers'): TeamSet => ({ ...emptySet(species), ability, item, moves: ['Protect'] });
const rowOf = (team: TeamSet[], species: string) => teamCoverage(team, fixtureData, 'meta').rows.find(r => r.species === species)!;

describe('Veleno nell\'Offesa: chi nessuno manda KO in due colpi ma qualcuno avvelena e regge', () => {
  it('Toxic su chi lo regge: il bersaglio è coperto in parte, col credito al posto dei colpi', () => {
    const coverage = teamCoverage([blissey], fixtureData, 'meta');
    expect(coverage.worn).toEqual(['Dragon/Ghost', 'Electric/Water', 'Dragon/Ground']);
    const row = rowOf([blissey], 'Rotom-Wash');
    expect(row.coveredBy).toEqual([]);
    expect(row.wornBy).toEqual([{ species: 'Blissey', move: 'Toxic', status: 'tox', credit: WEAR_CREDIT.tox }]);
    // Il primo posto della profondità (70%) col credito dell'iperveleno
    expect(row.level).toBe(35);
    // Il valore: i tre bersagli avvelenati, pesati per uso
    const weight = coverage.rows.filter(r => r.wornBy.length).reduce((acc, r) => acc + r.weight, 0);
    expect(coverage.value).toBe(Math.round(100 * 0.7 * WEAR_CREDIT.tox * weight));
  });

  it('i bersagli avvelenati non sono più fra gli scoperti; gli altri sì', () => {
    const coverage = teamCoverage([blissey], fixtureData, 'meta');
    expect(coverage.holes).toEqual(['Fighting/Ground', 'Ghost/Steel', 'Dark/Steel', 'Flying/Steel', 'Poison/Water']);
    expect(coverage.holes.some(label => coverage.worn.includes(label))).toBe(false);
  });

  it('Acciaio e Veleno non si avvelenano', () => {
    for (const species of ['Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex']) expect(rowOf([blissey], species).wornBy).toEqual([]);
  });

  it('chi avvelena deve reggere il bersaglio: Blissey non regge Great Tusk', () => {
    expect(rowOf([blissey], 'Great Tusk').wornBy).toEqual([]);
  });

  it('una mossa che avvelena meno di una volta su due non conta; con Serene Grace sì, come veleno normale', () => {
    const sludge = { ...blissey, moves: ['Sludge Bomb', 'Soft-Boiled'] };
    const rotom = rowOf([blissey], 'Rotom-Wash').set;
    expect(wearers([sludge], rotom, fixtureData)).toEqual([]);
    expect(wearers([{ ...sludge, ability: 'Serene Grace' }], rotom, fixtureData))
      .toEqual([{ species: 'Blissey', move: 'Sludge Bomb', status: 'psn', credit: WEAR_CREDIT.psn }]);
  });

  it('senza una mossa che avvelena niente', () => {
    expect(teamCoverage([{ ...blissey, moves: ['Soft-Boiled', 'Seismic Toss'] }], fixtureData, 'meta').worn).toEqual([]);
  });

  it('niente contro chi non ci perde PS: Magic Guard, Poison Heal, chi ha già uno stato dal suo strumento', () => {
    expect(wearers([blissey], target('Clefable', 'Magic Guard'), fixtureData)).toEqual([]);
    expect(wearers([blissey], target('Gliscor', 'Poison Heal', 'Toxic Orb'), fixtureData)).toEqual([]);
    expect(wearers([blissey], target('Conkeldurr', 'Guts', 'Flame Orb'), fixtureData)).toEqual([]);
    // Lo stesso Pokémon senza quelle difese si avvelena
    expect(wearers([blissey], target('Clefable', 'Unaware'), fixtureData)).toHaveLength(1);
  });

  it('chi è già mandato KO in due colpi da qualcuno non prende il credito del veleno', () => {
    const tusk: TeamSet = {
      ...emptySet('Great Tusk'), ability: 'Protosynthesis', item: 'Choice Band', nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 },
      moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Knock Off'],
    };
    const rows = teamCoverage([blissey, tusk], fixtureData, 'meta').rows;
    expect(rows.some(r => r.coveredBy.length > 0)).toBe(true);
    for (const row of rows) expect(row.coveredBy.length === 0 || row.wornBy.length === 0).toBe(true);
  });

  it('in doppio non conta', () => {
    const rotom = rowOf([blissey], 'Rotom-Wash').set;
    expect(wearers([blissey], rotom, { ...fixtureData, formatId: 'natdexdoubles' })).toEqual([]);
  });

  it('i punti del veleno vanno a chi avvelena: le quote dei membri fanno ancora l\'Offesa del team', () => {
    const offense = teamOffense([blissey], fixtureData);
    expect(offense.coverageMeta!.worn).toHaveLength(3);
    expect(offense.shares.reduce((acc, s) => acc + s.points, 0)).toBe(offense.value);
    expect(offense.shares[0].points).toBeGreaterThan(0);
  });
});
