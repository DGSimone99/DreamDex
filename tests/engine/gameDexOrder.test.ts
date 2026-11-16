import { beforeAll, describe, expect, it } from 'vitest';
import { rankCandidates, type RankingParams } from '../../src/engine/candidateRanking';
import type { EngineData } from '../../src/engine/data';
import { battleName } from '../../src/engine/dex';
import { EMPTY_FILTERS } from '../../src/engine/filters';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { initLearnsets } from '../../src/engine/learnsets';
import { fixtureData } from '../fixtures/data';

const data: EngineData = { ...fixtureData, formatId: 'gen9ag', ignoreMeta: true, game: 'sv' };
const params = (format: Format): RankingParams => ({
  team: [], replaceIndex: null, format, scope: 'add', applied: EMPTY_FILTERS, filtering: false, lang: 'it',
});
const names = (format: Format) => rankCandidates(params(format), data).items.map(i => battleName(i.set));

beforeAll(async () => {
  await initLearnsets();
  // In ordine regionale, come lo scrive fetch-data
  initGames({ sv: { dex: ['quaxly', 'quaxwell', 'quaquaval', 'larvitar', 'pupitar', 'tyranitar', 'sprigatito', 'floragato', 'meowscarada'] } });
});

describe('scelta del primo Pokémon nel gioco', () => {
  it('a team vuoto: solo evoluzioni finali, in ordine del Pokédex regionale', () => {
    // Le forme di Alola catturabili nel gioco (lista a mano) senza la specie nel Pokédex di prova: in coda, per numero nazionale
    expect(names(withGame(DEFAULT_FORMAT, 'sv'))).toEqual(['Quaquaval', 'Tyranitar', 'Meowscarada', 'Sandslash-Alola', 'Ninetales-Alola']);
  });

  it('con Tutto il Pokédex: prima quelli del Pokédex regionale, poi gli altri per numero nazionale, senza limite di 50', () => {
    const list = names({ ...withGame(DEFAULT_FORMAT, 'sv'), allPokedex: true });
    expect(list.slice(0, 3)).toEqual(['Quaquaval', 'Tyranitar', 'Meowscarada']);
    expect(list[3]).toBe('Venusaur');
    expect(list.length).toBeGreaterThan(50);
  });
});
