import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { fitsArchetype, fitsTeamType } from '../../src/engine/archetype';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { activeFilterCount, EMPTY_FILTERS, searchCandidates } from '../../src/engine/filters';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Toxic', 'Recover', 'Haze']);
const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Heal Bell']);
const sableye = set('Sableye', 'Sablenite', 'Prankster', ['Knock Off', 'Recover', 'Will-O-Wisp', 'Calm Mind']);
const kyurem = set('Kyurem', 'Heavy-Duty Boots', 'Pressure', ['Freeze-Dry', 'Earth Power', 'Substitute', 'Roost']);
const koko = set('Tapu Koko', 'Heavy-Duty Boots', 'Electric Surge', ['Volt Switch', 'Thunderbolt', 'Dazzling Gleam', 'Roost']);
const glimmora = set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Stealth Rock', 'Earth Power']);
const volcarona = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Fiery Dance', 'Giga Drain', 'Roost']);
const greatTusk = set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin']);
const corviknight = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost']);

describe('adatto a un archetipo', () => {
  it('stall: muri passivi, anche senza statistiche da muro (Mega Sableye)', () => {
    for (const s of [toxapex, blissey, sableye, corviknight]) expect(fitsArchetype(s, 'stall', DEFAULT_RULES)).toBe(true);
    expect(fitsArchetype(koko, 'stall', DEFAULT_RULES)).toBe(false);
  });

  it('un attaccante con pochi attacchi e Roost non è da stall (Kyurem): è Bulky Offense', () => {
    expect(fitsArchetype(kyurem, 'stall', DEFAULT_RULES)).toBe(false);
    expect(fitsArchetype(kyurem, 'bulkyOffense', DEFAULT_RULES)).toBe(true);
  });

  it('hyper offense: attaccanti veloci, sweeper con setup, lead con hazard e Focus Sash', () => {
    for (const s of [koko, volcarona, glimmora]) expect(fitsArchetype(s, 'hyperOffense', DEFAULT_RULES)).toBe(true);
    expect(fitsArchetype(toxapex, 'hyperOffense', DEFAULT_RULES)).toBe(false);
  });

  it('bulky offense: offesa e robustezza buone', () => {
    expect(fitsArchetype(greatTusk, 'bulkyOffense', DEFAULT_RULES)).toBe(true);
    expect(fitsArchetype(koko, 'bulkyOffense', DEFAULT_RULES)).toBe(false);
    expect(fitsArchetype(blissey, 'bulkyOffense', DEFAULT_RULES)).toBe(false);
  });

  it('un muro da stall non è mai anche offensivo', () => {
    for (const s of [toxapex, blissey, sableye, corviknight]) {
      expect(fitsArchetype(s, 'hyperOffense', DEFAULT_RULES)).toBe(false);
      expect(fitsArchetype(s, 'bulkyOffense', DEFAULT_RULES)).toBe(false);
    }
  });
});

describe('adatto a ogni tipo di team', () => {
  const all = [toxapex, blissey, sableye, kyurem, koko, glimmora, volcarona, greatTusk, corviknight];
  it('semi-stall: solo muri passivi', () => {
    expect(fitsTeamType(toxapex, 'semiStall', DEFAULT_RULES)).toBe(true);
    expect(fitsTeamType(volcarona, 'semiStall', DEFAULT_RULES)).toBe(false);
  });
  it('balance accetta tutti', () => {
    expect(all.every(s => fitsTeamType(s, 'balance', DEFAULT_RULES))).toBe(true);
  });
  it('gli altri tre coincidono con fitsArchetype', () => {
    for (const type of ['stall', 'hyperOffense', 'bulkyOffense'] as const) {
      expect(all.map(s => fitsTeamType(s, type, DEFAULT_RULES))).toEqual(all.map(s => fitsArchetype(s, type, DEFAULT_RULES)));
    }
  });
});
