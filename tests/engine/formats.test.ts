import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { dataSource, formatLabel, isBannedIn, isLegalIn } from '../../src/engine/formats';
import { candidatePool } from '../../src/engine/scoring';
import { fixtureData, tusk } from '../fixtures/data';

const f = (patch: Partial<Format>): Format => ({ ...DEFAULT_FORMAT, ...patch });
const sp = (name: string) => getSpecies(name)!;

describe('formati', () => {
  it('etichette e fonti dati', () => {
    expect(formatLabel(DEFAULT_FORMAT)).toBe('National Dex OU');
    expect(formatLabel(f({ formatId: 'all' }))).toBe('Tutti i Pokémon');
    expect(dataSource(f({}))).toBe('gen9nationaldex');
    expect(dataSource(f({ formatId: 'uu' }))).toBe('gen9nationaldexuu');
    expect(dataSource(f({ formatId: 'all' }))).toBe('gen9nationaldexubers');
  });

  it('ban per formato', () => {
    expect(isBannedIn(sp('Dragapult'), f({}))).toBe(true);
    expect(isBannedIn(sp('Dragapult'), f({ formatId: 'ubers' }))).toBe(false);
    expect(isBannedIn(sp('Rayquaza-Mega'), f({ formatId: 'ubers' }))).toBe(true); // AG
    expect(isBannedIn(sp('Great Tusk'), f({ formatId: 'uu' }))).toBe(true);
    expect(isBannedIn(sp('Rotom-Wash'), f({ formatId: 'uu' }))).toBe(false);
    expect(isBannedIn(sp('Rayquaza-Mega'), f({ formatId: 'all' }))).toBe(false);
    expect(isBannedIn(sp('Dragapult'), f({ ignoreBans: true }))).toBe(false);
  });

  it('CAP sempre escluso', () => {
    expect(isLegalIn(sp('Syclant'), f({ formatId: 'all' }))).toBe(false); // CAP sempre escluso
  });

  it('il pool dei suggerimenti segue il formato', () => {
    const open = { minUsage: 0 };
    expect(candidatePool([tusk], f(open), fixtureData)).not.toContain('Dragapult');
    expect(candidatePool([tusk], f({ ...open, formatId: 'ubers' }), fixtureData)).toContain('Dragapult');
    expect(candidatePool([tusk], f({ ...open, formatId: 'uu' }), fixtureData)).toEqual(['Rotom-Wash']);
  });
});
