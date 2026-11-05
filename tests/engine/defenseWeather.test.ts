import { describe, expect, it } from 'vitest';
import { typedHits } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';
import { TYPES } from '../../src/engine/types';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });

const noStats = { stats: null, sets: null, formatId: 'ou' as const };
/** Il colpo di tipo `type` sul lato `category` (ordine di typedHits: per tipo il fisico, poi lo speciale). */
const cell = (hits: number[], type: string, category: 'Physical' | 'Special') => hits[2 * TYPES.indexOf(type as never) + (category === 'Special' ? 1 : 0)];

const garganacl = set('Garganacl', 'Leftovers', 'Purifying Salt', ['Salt Cure', 'Recover'], 'Careful', { hp: 252, spd: 252 });
const ferrothorn = set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Spikes', 'Power Whip'], 'Relaxed', { hp: 252, def: 252 });
const hippowdon = set('Hippowdon', 'Leftovers', 'Sand Stream', ['Slack Off', 'Earthquake'], 'Impish', { hp: 252, def: 252 });
const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume', 'Rapid Spin'], 'Bold', { hp: 252, def: 252 });
const tyranitar = set('Tyranitar', 'Leftovers', 'Sand Stream', ['Stone Edge'], 'Careful', { hp: 252, spd: 252 });

describe('Difesa col meteo del team', () => {
  it('sabbia di un compagno: Dif. Speciale ×1,5 alle Roccia, a metà', () => {
    const alone = cell(typedHits(garganacl, noStats).plain, 'Water', 'Special');
    const withSand = cell(typedHits(garganacl, noStats, [garganacl, hippowdon]).plain, 'Water', 'Special');
    expect(withSand).toBeLessThan(alone);
    // A metà: fra il danno pieno e quello con la sabbia sempre (×2/3)
    expect(withSand).toBeGreaterThan(alone * (2 / 3));
    // Il fisico non cambia
    expect(cell(typedHits(garganacl, noStats, [garganacl, hippowdon]).plain, 'Water', 'Physical')).toBe(cell(typedHits(garganacl, noStats).plain, 'Water', 'Physical'));
  });

  it('la sabbia che il membro porta da solo vale piena', () => {
    const own = cell(typedHits(tyranitar, noStats).plain, 'Water', 'Special');
    const mate = cell(typedHits({ ...tyranitar, ability: 'Unnerve' }, noStats, [{ ...tyranitar, ability: 'Unnerve' }, hippowdon]).plain, 'Water', 'Special');
    expect(own).toBeLessThan(mate);
  });

  it('il sole di un compagno conta anche quando fa male: Acqua più debole, Fuoco più forte', () => {
    const alone = typedHits(ferrothorn, noStats).plain;
    const sun = typedHits(ferrothorn, noStats, [ferrothorn, torkoal]).plain;
    expect(cell(sun, 'Water', 'Special')).toBeLessThan(cell(alone, 'Water', 'Special'));
    // Su Ferrothorn il Fuoco manda già KO (tetto 1): il Fuoco più forte si vede su Clefable
    const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast'], 'Calm', { hp: 252, spd: 252 });
    expect(cell(typedHits(clefable, noStats, [clefable, torkoal]).plain, 'Fire', 'Special')).toBeGreaterThan(cell(typedHits(clefable, noStats).plain, 'Fire', 'Special'));
    // Chi porta il suo meteo (Hippowdon con la sabbia) non prende il sole del compagno
    expect(typedHits(hippowdon, noStats, [hippowdon, torkoal]).plain).toEqual(typedHits(hippowdon, noStats).plain);
  });

  it('senza meteo nel team non cambia niente', () => {
    expect(typedHits(ferrothorn, noStats, [ferrothorn, garganacl]).plain).toEqual(typedHits(ferrothorn, noStats).plain);
  });
});
