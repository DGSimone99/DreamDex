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
    expect((await readSource(files, 'b'))).toEqual({ stats: null, sets: null });
  });

  it('un file corrotto non blocca: statistiche nulle', async () => {
    const files = { '/data/a/stats.json': async () => { throw new SyntaxError('troncato'); } };
    expect(await readSource(files, 'a')).toEqual({ stats: null, sets: null });
  });
});
