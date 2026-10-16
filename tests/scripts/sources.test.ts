import { describe, expect, it } from 'vitest';
import { SOURCES } from '../../scripts/sources';
import { readSource } from '../../src/data/load';

describe('fonti dati', () => {
  it('lo script scarica le 4 fonti', () => {
    expect(SOURCES).toEqual(['gen9nationaldex', 'gen9nationaldexubers', 'gen9nationaldexuu', 'gen9nationaldexmonotype']);
  });

  it('una fonte assente dà statistiche nulle', async () => {
    const files = {
      '/data/a/stats.json': async () => ({ X: { usage: 1 } }),
      '/data/a/meta.json': async () => ({ month: 'm', cutoff: 1, battles: 1 }),
    };
    expect((await readSource(files, 'a')).stats).not.toBeNull();
    expect((await readSource(files, 'b'))).toEqual({ stats: null, sets: null, fallback: null, presets: null, fallbackPresets: null, fallbackStats: null });
  });

  it('aggiunge i set di riserva a ogni fonte', async () => {
    const set = { species: 'Dragapult', item: '', ability: '', moves: ['U-turn'], nature: 'Jolly', evs: {} };
    const files = {
      '/data/a/stats.json': async () => ({ X: { usage: 1 } }),
      '/data/a/meta.json': async () => ({ month: 'm', cutoff: 1, battles: 1 }),
      '/data/_fallback/sets.json': async () => ({ Dragapult: set }),
    };
    expect((await readSource(files, 'a')).fallback).toEqual({ Dragapult: set });
    expect((await readSource(files, 'b')).fallback).toEqual({ Dragapult: set });
  });

  it('un file corrotto non blocca: statistiche nulle', async () => {
    const files = { '/data/a/stats.json': async () => { throw new SyntaxError('troncato'); } };
    expect(await readSource(files, 'a')).toEqual({ stats: null, sets: null, fallback: null, presets: null, fallbackPresets: null, fallbackStats: null });
  });
});
