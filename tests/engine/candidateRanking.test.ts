import { rankCandidates, type RankingParams } from '../../src/engine/candidateRanking';
import { EMPTY_FILTERS } from '../../src/engine/filters';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { collectGainJobs, computeGains, primeGains, teamGainMisses } from '../../src/engine/teamGain';
import { fixtureData } from '../fixtures/data';

/** Un team nuovo (oggetti nuovi): le cache che guardano l'identità ripartono da zero. */
const team = (...names: string[]): TeamSet[] => names.map(name => ({ ...emptySet(name) }));
const params = (members: TeamSet[], extra: Partial<RankingParams> = {}): RankingParams => ({
  team: members, replaceIndex: null, format: DEFAULT_FORMAT, scope: 'add', applied: EMPTY_FILTERS, filtering: false, lang: 'it', ...extra,
});

/** La lista calcolata come nel browser con più calcoli in parallelo: voti raccolti, calcolati a parte, messi in cache. */
function inParts(p: RankingParams) {
  const jobs = collectGainJobs(() => rankCandidates(p, fixtureData));
  // I voti si calcolano su copie (come in un altro worker), metà per volta
  const copies = JSON.parse(JSON.stringify(jobs)) as typeof jobs;
  const half = Math.ceil(copies.length / 2);
  const values = [...computeGains(copies.slice(0, half), fixtureData, p.lang, p.archetype), ...computeGains(copies.slice(half), fixtureData, p.lang, p.archetype)];
  primeGains(jobs.map((job, i) => [job.key, values[i]]));
  const misses = teamGainMisses();
  const result = rankCandidates(p, fixtureData);
  // La lista trova tutti i voti già pronti: nessuno calcolato di nuovo
  expect(teamGainMisses()).toBe(misses);
  return { jobs: jobs.length, result };
}

describe('lista dei candidati in parti (calcolo in parallelo)', () => {
  const cases: [string, () => RankingParams][] = [
    ['aggiunte', () => params(team('Great Tusk', 'Kingambit'))],
    ['scambi liberi a team completo', () => params(team('Great Tusk', 'Kingambit', 'Toxapex', 'Dragapult', 'Corviknight', 'Gholdengo'))],
    ['sostituti di un membro', () => params(team('Great Tusk', 'Kingambit', 'Toxapex'), { replaceIndex: 1 })],
    ['ricerca', () => params(team('Great Tusk', 'Kingambit'), { applied: { ...EMPTY_FILTERS, query: 'a' }, filtering: true })],
    ['ricerca a team completo', () => params(team('Great Tusk', 'Kingambit', 'Toxapex', 'Dragapult', 'Corviknight', 'Gholdengo'), { applied: { ...EMPTY_FILTERS, query: 'o' }, filtering: true })],
  ];
  it.each(cases)('%s: stessa lista del calcolo diretto', (_, make) => {
    const direct = rankCandidates(make(), fixtureData);
    const parts = inParts(make());
    expect(parts.jobs).toBeGreaterThan(0);
    expect(parts.result).toEqual(direct);
  });
});
