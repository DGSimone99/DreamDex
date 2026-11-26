import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { dataSource, dexOf, formatLabel, formatOptions, isBannedIn, isLegalIn, pokedexOf, teraAllowed, tiersOf } from '../../src/engine/formats';
import { DEFAULT_CHOICE, rulesOf, sanitizeChoice } from '../../src/engine/formatChoice';
import { candidatePool } from '../../src/engine/scoring';
import { fixtureData, tusk } from '../fixtures/data';

const f = (patch: Partial<Format>): Format => ({ ...DEFAULT_FORMAT, ...patch });
const sp = (name: string) => getSpecies(name)!;

describe('formati', () => {
  it('etichette e fonti dati', () => {
    expect(formatLabel(DEFAULT_FORMAT)).toBe('National Dex OU');
    expect(formatLabel(f({ formatId: 'all' }))).toBe('No Format');
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

  it('National Dex Doubles: fonte, Pokédex, Tera, etichetta', () => {
    const dbl = f({ formatId: 'natdexdoubles' });
    expect(dataSource(dbl)).toBe('gen9nationaldexdoubles');
    expect(pokedexOf(dbl)).toBe('natdex');
    expect(teraAllowed(dbl)).toBe(true);
    expect(formatLabel(dbl)).toBe('National Dex Doubles');
    expect(dexOf('natdexdoubles')).toBe('natdex');
  });

  it('nessun divieto per tier in doppio (Dragapult, Uber in singolo, è legale)', () => {
    expect(isBannedIn(sp('Dragapult'), f({ formatId: 'natdexdoubles' }))).toBe(false);
  });

  it('menu: Doppio solo in National Dex, ripiego sul Singolo', () => {
    expect(tiersOf('natdex', 'doubles')).toEqual([{ formatId: 'natdexdoubles', tier: 'OU' }]);
    expect(tiersOf('gen9', 'doubles')).toEqual([]);
    expect(tiersOf('nolimits', 'doubles')).toEqual([]);
  });

  it('il doppio è nel menu e tra i formati, e un salvataggio in doppio resta in doppio', () => {
    expect(tiersOf('natdex', 'doubles')).toEqual([{ formatId: 'natdexdoubles', tier: 'OU' }]);
    expect(formatOptions().map(o => o.id)).toContain('natdexdoubles');
    expect(rulesOf(sanitizeChoice({ ...DEFAULT_CHOICE, battle: 'doubles' })).formatId).toBe('natdexdoubles');
  });
});
