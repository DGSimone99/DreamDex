import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { getMove, getSpecies, isLegal, moveNames, speciesNames, toID, withinGen } from '../../src/engine/dex';

const gen = (genLimit: number) => ({ ...DEFAULT_FORMAT, genLimit });

describe('dex', () => {
  it('toID normalizza i nomi', () => {
    expect(toID('U-turn')).toBe('uturn');
    expect(toID('Great Tusk')).toBe('greattusk');
  });

  it('trova specie esistenti e rifiuta quelle inesistenti', () => {
    expect(getSpecies('Great Tusk')?.types).toEqual(['Ground', 'Fighting']);
    expect(getSpecies('Fakemon-Xyz')).toBeNull();
    expect(getSpecies('')).toBeNull();
  });

  it('legalità National Dex OU', () => {
    expect(isLegal(getSpecies('Great Tusk')!)).toBe(true);
    expect(isLegal(getSpecies('Charizard-Mega-X')!)).toBe(true);
    expect(isLegal(getSpecies('Koraidon')!)).toBe(false); // AG
    expect(isLegal(getSpecies('Syclant')!)).toBe(false); // CAP
    expect(isLegal(getSpecies('Gengar-Gmax')!)).toBe(false); // Gigantamax: non esiste in National Dex
  });

  it('filtro per generazione di origine della specie o forma', () => {
    expect(withinGen(getSpecies('Garchomp')!, gen(4))).toBe(true);
    expect(withinGen(getSpecies('Great Tusk')!, gen(4))).toBe(false);
    expect(withinGen(getSpecies('Ninetales-Alola')!, gen(6))).toBe(false);
    expect(withinGen(getSpecies('Charizard-Mega-X')!, gen(6))).toBe(true);
    expect(isLegal(getSpecies('Rotom-Wash')!) && withinGen(getSpecies('Rotom-Wash')!, gen(4))).toBe(true);
  });

  it('mosse', () => {
    expect(getMove('Sucker Punch')?.priority).toBe(1);
    expect(getMove('Notamove')).toBeNull();
    expect(getMove('')).toBeNull();
  });

  it('elenchi per autocompletamento', () => {
    const species = speciesNames();
    expect(species).toContain('Great Tusk');
    expect(species).not.toContain('Syclant');
    expect(species).not.toContain('Charizard-Gmax');
    const moves = moveNames();
    expect(moves).toContain('Hidden Power');
    expect(moves).not.toContain('G-Max Wildfire');
  });
});
