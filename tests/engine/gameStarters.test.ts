import { beforeAll, describe, expect, it } from 'vitest';
import { rankCandidates, type RankingParams } from '../../src/engine/candidateRanking';
import { battleName } from '../../src/engine/dex';
import { EMPTY_FILTERS } from '../../src/engine/filters';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { initLearnsets } from '../../src/engine/learnsets';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { EngineData } from '../../src/engine/data';
import { fixtureData } from '../fixtures/data';

const team = (...names: string[]): TeamSet[] => names.map(name => ({ ...emptySet(name) }));
const sv = withGame(DEFAULT_FORMAT, 'sv');
const params = (members: TeamSet[], format = sv): RankingParams => ({
  team: members, replaceIndex: null, format, scope: 'add', applied: EMPTY_FILTERS, filtering: false, lang: 'it',
});
const names = (p: RankingParams, data: EngineData = { ...fixtureData, formatId: 'gen9ag', ignoreMeta: true, game: 'sv' }) =>
  rankCandidates(p, data).items.map(i => battleName(i.set));

beforeAll(async () => {
  await initLearnsets();
  initGames({ sv: { dex: ['sprigatito', 'fuecoco', 'quaxly', 'garchomp', 'tinglu', 'kingambit', 'corviknight', 'toxapex', 'glimmora'] } });
});

describe('starter del gioco', () => {
  it('nel gioco i tre starter evoluti vengono prima', () => {
    expect(names(params(team('Garchomp'))).slice(0, 3)).toEqual(['Meowscarada', 'Skeledirge', 'Quaquaval']);
  });

  it('lo starter già nel team o bannato non torna in cima', () => {
    const bans = { favorites: new Set<string>(), bans: new Set(['Quaquaval']), overridden: new Map(), universal: new Set<string>() };
    const list = names(params(team('Skeledirge')), { ...fixtureData, formatId: 'gen9ag', ignoreMeta: true, game: 'sv', userLists: bans });
    expect(list[0]).toBe('Meowscarada');
    expect(list).not.toContain('Quaquaval');
    expect(list).not.toContain('Skeledirge');
  });

  it('senza gioco nessuno starter forzato', () => {
    expect(names(params(team('Garchomp'), DEFAULT_FORMAT), fixtureData).slice(0, 3)).not.toEqual(['Meowscarada', 'Skeledirge', 'Quaquaval']);
  });
});
