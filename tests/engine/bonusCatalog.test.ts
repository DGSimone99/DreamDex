import { describe, expect, it } from 'vitest';
import { TRICK_ROOM_FAST_POINTS, UNUSED_ENABLER_POINTS, WEATHER_CLASH_POINTS, bonusMalusCatalog, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const ninetales = { ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' };
const pelipper = { ...withMoves('Pelipper', ['Hurricane']), ability: 'Drizzle' };

describe('catalogo bonus e malus', () => {
  const teams: Record<string, TeamSet[]> = {
    hazard: [withMoves('Great Tusk', ['Stealth Rock', 'Rapid Spin']), withMoves('Garchomp', ['Stealth Rock']), withMoves('Corviknight', ['Defog'])],
    meteo: [ninetales, pelipper, withMoves('Kingdra', ['Hydro Pump'])],
    inutilizzato: [{ ...withMoves('Pelipper', ['U-turn', 'Roost']), ability: 'Drizzle' }, withMoves('Garchomp', ['Earthquake'])],
    bonus: [ninetales, withMoves('Great Tusk', ['Headlong Rush'])],
    trickRoom: [withMoves('Dragapult', ['Trick Room']), withMoves('Garchomp', ['Earthquake']), withMoves('Kingambit', ['Sucker Punch'])],
    sei: ['Great Tusk', 'Kingambit', 'Garchomp', 'Dragapult', 'Corviknight', 'Skarmory'].map(n => withMoves(n, ['Earthquake'])),
  };

  it('ogni voce di penalità e bonus porta una chiave di catalogo', () => {
    for (const [name, team] of Object.entries(teams)) {
      const r = rateTeam(team, fixtureData)!;
      for (const i of [...r.penalty.items, ...r.bonus.items]) expect(i.catalog, `${name}: ${i.text}`).toBeDefined();
    }
  });

  it('le chiavi attese compaiono sulle voci giuste', () => {
    const keys = (team: TeamSet[]) => rateTeam(team, fixtureData)!.penalty.items.map(i => i.catalog);
    expect(keys(teams.hazard)).toEqual(expect.arrayContaining(['hazardDuplicate']));
    expect(keys(teams.meteo)).toEqual(expect.arrayContaining(['weatherClash']));
    expect(keys(teams.inutilizzato)).toContain('unusedEnabler');
    expect(keys([withMoves('Great Tusk', []), withMoves('Landorus-Therian', []), withMoves('Hippowdon', [])])).toContain('sharedWeak');
    expect(keys([{ ...withMoves('Leafeon', ['Leaf Blade']), ability: 'Chlorophyll' }, withMoves('Garchomp', ['Earthquake'])])).toContain('unmetCondition');
    expect(rateTeam(teams.bonus, fixtureData)!.bonus.items.map(i => i.catalog)).toEqual(['weatherHelp']);
  });

  it('catalogo IT: 18 voci, 12 malus prima, niente Tera né "Vicino a un altro tipo"', () => {
    const none = bonusMalusCatalog('it');
    expect(none).toHaveLength(18);
    expect(none.slice(0, 12).every(e => e.kind === 'malus')).toBe(true);
    expect(none.slice(12).every(e => e.kind === 'bonus')).toBe(true);
    expect(none.map(e => e.key as string)).not.toContain('typeBlend');
    expect(none.map(e => e.key)).toEqual(expect.arrayContaining(['sameType', 'coreTrio', 'weakCovered', 'typeVariety', 'conditionUsed', 'importantRole', 'minorRole']));
    expect(none.map(e => e.key as string)).not.toContain('tera');
    expect(none.map(e => e.key as string)).not.toContain('removers');
  });

  it('il testo dei punti usa le costanti', () => {
    const c = bonusMalusCatalog('it');
    expect(c.find(e => e.key === 'hazardDuplicate')!.points).toContain('1');
    const weak = c.find(e => e.key === 'weakMember')!.points;
    expect(weak).toContain('4');
    expect(weak).toContain('12');
    expect(c.find(e => e.key === 'sharedWeak')!.points).toContain('1');
    expect(c.find(e => e.key === 'unmetCondition')!.points).toContain('3');
    expect(c.find(e => e.key === 'weatherClash')!.points).toBe(`−${WEATHER_CLASH_POINTS}`);
    expect(c.find(e => e.key === 'unusedEnabler')!.points).toBe(`−${UNUSED_ENABLER_POINTS}`);
    expect(c.find(e => e.key === 'trickRoomFast')!.points).toContain(`−${TRICK_ROOM_FAST_POINTS} per membro`);
    expect(c.find(e => e.key === 'coreTrio')!.points).toContain('2');
  });

  it('catalogo EN: stesse chiavi, testi non vuoti', () => {
    const it = bonusMalusCatalog('it');
    const en = bonusMalusCatalog('en');
    expect(en.map(e => e.key)).toEqual(it.map(e => e.key));
    for (const e of en) for (const s of [e.name, e.when, e.points]) expect(s.length).toBeGreaterThan(0);
  });
});
