import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { initLearnsets } from '../../src/engine/learnsets';
import { stylePool } from '../../src/engine/styleSets';
import { fixtureData } from '../fixtures/data';

beforeAll(async () => {
  await initLearnsets();
  initGames({ sv: { dex: ['pelipper', 'wingull'] } });
});

describe('Completa team nel gioco', () => {
  it('cambiando le opzioni del gioco la lista per stile si aggiorna (stessi dati)', () => {
    const data: EngineData = { ...fixtureData, formatId: 'gen9ag', ignoreMeta: true, game: 'sv' };
    const names = (all: boolean) => stylePool([], 'rain', { ...withGame(DEFAULT_FORMAT, 'sv'), allPokedex: all }, data).map(s => s.species);
    expect(names(false)).not.toContain('Politoed');
    expect(names(true)).toContain('Politoed');
  });
});
