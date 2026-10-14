import { describe, expect, it } from 'vitest';
import { isMega } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { improveReplacements } from '../../src/engine/replace';
import { scoreCandidates } from '../../src/engine/scoring';
import { mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { megaData } from '../fixtures/megaData';

const set = (species: string, item: string): TeamSet => ({ species, item, ability: '', moves: [], nature: 'Serious', evs: {} });
const charizardY = mostCommonSet(megaData.stats, 'Charizard-Mega-Y')!;
const tusk = mostCommonSet(megaData.stats, 'Great Tusk')!;
const names = (team: TeamSet[], format = DEFAULT_FORMAT) => scoreCandidates(team, format, megaData).map(s => s.species);

describe('isMega', () => {
  it('pietra o forma Mega, non Primal', () => {
    expect(isMega(set('Lopunny', 'Lopunnite'))).toBe(true);
    expect(isMega(set('Lopunny-Mega', ''))).toBe(true);
    expect(isMega(set('Lopunny', 'Leftovers'))).toBe(false);
    expect(isMega(set('Groudon', 'Red Orb'))).toBe(false);
    expect(isMega(set('Fakemon-Xyz', 'Lopunnite'))).toBe(false);
  });
});

describe('una sola Mega nei suggerimenti', () => {
  it('con una Mega in team i candidati Mega sono esclusi', () => {
    expect(names([charizardY])).toEqual(['Great Tusk']);
  });

  it('la Mega scritta come specie base + pietra conta allo stesso modo', () => {
    expect(names([set('Charizard', 'Charizardite Y')])).toEqual(['Great Tusk']);
  });

  it('senza Mega in team i candidati Mega restano', () => {
    expect(names([tusk]).sort()).toEqual(['Charizard-Mega-Y', 'Lopunny-Mega']);
  });

  it('con allowMultipleMegas i candidati Mega restano', () => {
    expect(names([charizardY], { ...DEFAULT_FORMAT, allowMultipleMegas: true }).sort()).toEqual(['Great Tusk', 'Lopunny-Mega']);
  });

  it('sostituendo la Mega le altre Mega tornano disponibili', () => {
    expect(improveReplacements([charizardY, tusk], 0, DEFAULT_FORMAT, megaData).map(r => r.species)).toEqual(['Lopunny-Mega']);
  });
});
