import { beforeAll, describe, expect, it, vi } from 'vitest';
import { rankCandidates, type RankingParams } from '../../src/engine/candidateRanking';
import type { EngineData } from '../../src/engine/data';
import { battleName } from '../../src/engine/dex';
import { EMPTY_FILTERS } from '../../src/engine/filters';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { initLearnsets } from '../../src/engine/learnsets';
import { fixtureData } from '../fixtures/data';
import { rateTeam } from '../../src/engine/rating';
import { collectGainJobs, computeGains, primeGains, teamGainMisses } from '../../src/engine/teamGain';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

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

describe('dati del formato non ancora arrivati', () => {
  it('nel gioco la lista aspetta le statistiche (niente set inventati né voti provvisori)', () => {
    const empty: EngineData = { stats: null, sets: null, formatId: 'gen9ag', ignoreMeta: true, game: 'sv' };
    expect(rankCandidates(params(withGame(DEFAULT_FORMAT, 'sv')), empty).items).toEqual([]);
    expect(rankCandidates({ ...params(withGame(DEFAULT_FORMAT, 'sv')), team: [{ species: 'Garchomp', item: '', ability: '', moves: [], nature: 'Jolly', evs: {} }] }, empty).items).toEqual([]);
  });
});

describe('voto da solo a team vuoto nel gioco', () => {
  it('ogni scheda ha il voto del team col solo Pokémon (+N), come il dettaglio', () => {
    const items = rankCandidates(params(withGame(DEFAULT_FORMAT, 'sv')), data).items;
    for (const item of items) {
      const alone = rateTeam([item.set], data)!;
      expect(item.teamGain).toMatchObject({ overall: alone.overall, grade: alone.grade, gain: alone.overall });
    }
  });

  it('divisi fra calcoli in parallelo: stessi voti, nessuno ricalcolato', () => {
    const p = params(withGame(DEFAULT_FORMAT, 'sv'));
    const direct = rankCandidates(p, data).items.map(i => i.teamGain?.overall);
    const fresh = { ...data, sets: {} };
    const jobs = collectGainJobs(() => rankCandidates(p, fresh));
    expect(jobs.length).toBeGreaterThan(0);
    primeGains(jobs.map((job, i) => [job.key, computeGains(jobs, fresh, 'it', undefined)[i]]));
    const misses = teamGainMisses();
    expect(rankCandidates(p, fresh).items.map(i => i.teamGain?.overall)).toEqual(direct);
    expect(teamGainMisses()).toBe(misses);
  });
});
