import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { teamArchetype } from '../../src/engine/archetype';
import { coachTeam, findProblems, type CoachProblem } from '../../src/engine/coach';
import { coachFixes, firstMove, fixesForProblem, type CoachFix } from '../../src/engine/coachFixes';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rulesOf } from '../../src/engine/formatRules';
import { improveReplacements } from '../../src/engine/replace';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain, withCandidate } from '../../src/engine/teamGain';
import { fixtureData, fixtureStats } from '../fixtures/data';

const format = DEFAULT_FORMAT;
const data = { ...fixtureData, formatId: format.formatId };
// Due membri deboli lasciano spazio ai sostituti delle statistiche di prova
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const three = six.slice(0, 3);
const problemsOf = (team: TeamSet[]) => findProblems(team, format, analyzeTeam(team, data), [], 'it');
const fixesOf = (team: TeamSet[]) => coachFixes(team, format, data, problemsOf(team), 'it');

describe('candidati del Coaching dalla classifica di Migliora team', () => {
  const fixesSix = fixesOf(six);
  const fixesThree = fixesOf(three);

  it('stesso voto in più di Migliora team per membro', () => {
    for (const team of [six, three]) {
      const archetype = team.length === 6 ? teamArchetype(team, rulesOf(data))?.archetype : undefined;
      const swaps = (team === six ? fixesSix : fixesThree).filter(f => f.kind === 'swap');
      expect(swaps.length).toBeGreaterThan(0);
      for (const fix of swaps) {
        const ranked = rankByTeamGain(improveReplacements(team, fix.index!, format, data, 100, undefined, 'it', archetype), team, fix.index!, data, 'it', true, archetype);
        expect(ranked.find(r => r.species === fix.species)!.teamGain!.gain).toBe(fix.gain);
        expect(fix.member).not.toBeNull();
      }
    }
  });

  it('solo cambi che alzano il voto', () => {
    for (const fix of [...fixesSix, ...fixesThree]) expect(fix.gain).toBeGreaterThan(0);
  });

  it('risolve = il problema sparisce nel team col cambio', () => {
    for (const [team, fixes] of [[six, fixesSix], [three, fixesThree]] as const) {
      const now = problemsOf(team).map(p => p.key);
      for (const fix of fixes) {
        const after = new Set(problemsOf(withCandidate(team, fix.set, fix.index)).map(p => p.key));
        for (const key of fix.solves) expect(after.has(key)).toBe(false);
        for (const key of now) if (!after.has(key)) expect(fix.solves).toContain(key);
      }
    }
  });

  it('team incompleto: anche aggiunte', () => {
    const adds = fixesThree.filter(f => f.kind === 'add');
    expect(adds.length).toBeGreaterThan(0);
    for (const fix of adds) expect(fix).toMatchObject({ index: null, member: null });
    expect(fixesSix.some(f => f.kind === 'add')).toBe(false);
  });

  it('i preferiti non escono', () => {
    // Magikarp ha sostituti che alzano il voto: da preferito non esce
    expect(fixesSix.some(f => f.index === 4)).toBe(true);
    const team = six.map((m, i) => (i === 4 ? { ...m, favorite: true } : m));
    expect(fixesOf(team).some(f => f.index === 4)).toBe(false);
  });

  it('meta spento o senza statistiche: nessun candidato', () => {
    const noStats = { ...data, stats: null };
    expect(coachFixes(six, format, noStats, problemsOf(six), 'it')).toEqual([]);
    expect(coachTeam(six, format, noStats).fixes).toEqual([]);
    expect(coachTeam(six, format, noStats).first).toBeNull();
  });

  it('per problema: al massimo 3, dal voto più alto, una specie una volta', () => {
    // Team incompleto: aggiunte e sostituzioni insieme
    const keys = [...new Set(fixesThree.flatMap(f => f.solves))];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const list = fixesForProblem(fixesThree, key);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(list.every(f => f.solves.includes(key))).toBe(true);
      expect(list.map(f => f.gain)).toEqual([...list.map(f => f.gain)].sort((a, b) => b - a));
      expect(new Set(list.map(f => f.species)).size).toBe(list.length);
    }
    // A mano: la stessa specie come aggiunta e come sostituzione compare una volta, quella col voto più alto
    const fix = (species: string, gain: number, kind: CoachFix['kind'] = 'swap'): CoachFix =>
      ({ kind, species, set: emptySet(species), index: kind === 'add' ? null : 0, member: kind === 'add' ? null : 'X', gain, solves: ['k'] });
    const list = fixesForProblem([fix('A', 3), fix('A', 5, 'add'), fix('B', 4), fix('C', 2), fix('D', 1)], 'k');
    expect(list.map(f => [f.species, f.gain])).toEqual([['A', 5], ['B', 4], ['C', 2]]);
    expect(fixesForProblem([fix('A', 3)], 'altro')).toEqual([]);
  });

  it('tempo ragionevole', () => {
    coachTeam(six, format, fixtureData);
    const start = performance.now();
    coachTeam(six, format, fixtureData);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});

describe('Prima di tutto', () => {
  const problem = (key: string, severity: CoachProblem['severity']): CoachProblem => ({ severity, category: 'defense', text: key, fixes: [], key });
  const problems = [problem('A', 'serious'), problem('B', 'minor'), problem('C', 'minor')];
  const fix = (species: string, gain: number, solves: string[]): CoachFix =>
    ({ kind: 'swap', species, set: emptySet(species), index: 0, member: 'X', gain, solves });

  it('prima i gravi risolti, poi i minori, poi il voto', () => {
    expect(firstMove([fix('BC', 20, ['B', 'C']), fix('A', 1, ['A'])], problems)?.species).toBe('A');
    expect(firstMove([fix('B', 20, ['B']), fix('BC', 1, ['B', 'C'])], problems)?.species).toBe('BC');
    expect(firstMove([fix('B1', 2, ['B']), fix('B2', 6, ['B'])], problems)?.species).toBe('B2');
    expect(firstMove([fix('none', 30, [])], problems)).toBeNull();
    expect(firstMove([], problems)).toBeNull();
  });

  it('coachTeam porta i candidati e la prima mossa', () => {
    const coaching = coachTeam(three, format, fixtureData);
    expect(coaching.fixes).toEqual(fixesOf(three));
    expect(coaching.first).toEqual(firstMove(coaching.fixes, coaching.problems));
  });
});

describe('chiavi senza conteggi', () => {
  const set = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
  const keys = (team: TeamSet[]) => problemsOf(team).map(p => p.key);

  it('lo stesso problema tiene la stessa chiave su team diversi', () => {
    const base = [set('Great Tusk', ['Stealth Rock', 'Rapid Spin']), set('Garchomp', ['Stealth Rock', 'Earthquake']), set('Ting-Lu', ['Stealth Rock', 'Ruination'])];
    const redundancy = (team: TeamSet[]) => problemsOf(team).filter(p => p.category === 'redundancy' && /Stealth Rock/.test(p.text));
    const before = redundancy(base);
    expect(before).toHaveLength(1);
    // Un membro estraneo cambiato: stessa chiave
    const other = redundancy([...base, set('Gholdengo', ['Make It Rain'])]);
    const swapped = redundancy([...base, set('Kingambit', ['Kowtow Cleave'])]);
    expect(other[0].key).toBe(swapped[0].key);
    // Cambia solo il conteggio (3 → 2 setter): resta lo stesso problema, non è risolto
    const fewer = redundancy([...base.slice(0, 2), set('Kingambit', ['Kowtow Cleave'])]);
    expect(fewer[0].text).not.toBe(before[0].text);
    expect(fewer[0].key).toBe(before[0].key);
    expect(keys(base).every(k => !/\d/.test(k))).toBe(true);
  });
});

describe('conflitto di meteo: chiave senza i setter', () => {
  const set = (species: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), ability, moves });
  const ninetales = set('Ninetales', 'Drought', ['Flamethrower']);
  const pelipper = set('Pelipper', 'Drizzle', ['Hurricane']);
  const torkoal = set('Torkoal', 'Drought', ['Lava Plume']);
  const team = [ninetales, pelipper, junk('Magikarp')];
  const sunData = {
    formatId: format.formatId,
    stats: {
      meta: { month: '2026-09', cutoff: 1630, battles: 1 },
      pokemon: { Torkoal: { usage: 0.04, count: 100, abilities: { drought: 1 }, items: {}, teraTypes: {}, spreads: {}, moves: { lavaplume: 1, stealthrock: 1 }, teammates: {}, checks: {} } },
    },
    sets: {},
  };
  const key = 'conditions:conflict:meteo';

  it('un setter cambiato con un altro della stessa condizione: stessa chiave, non risolto', () => {
    expect(problemsOf(team).map(p => p.key)).toContain(key);
    const swapped = [torkoal, pelipper, junk('Magikarp')];
    expect(problemsOf(swapped).find(p => p.key === key)!.text).not.toBe(problemsOf(team).find(p => p.key === key)!.text);
    const fixes = coachFixes(team, { ...format, minUsage: 0 }, sunData, problemsOf(team), 'it').filter(f => f.member !== 'Pelipper');
    expect(fixes.some(f => f.member === 'Ninetales' || f.member === 'Magikarp')).toBe(true);
    for (const fix of fixes) expect(fix.solves).not.toContain(key);
  });
});

describe('classifiche condivise con Migliora team', () => {
  it('una seconda chiamata sullo stesso team riusa le classifiche', async () => {
    const { rankingMisses } = await import('../../src/engine/coachFixes');
    const team = [...three];
    coachTeam(team, format, fixtureData);
    const after = rankingMisses();
    coachTeam(team, format, fixtureData);
    expect(rankingMisses()).toBe(after);
    // Un team nuovo invece si calcola
    coachTeam([...three], format, fixtureData);
    expect(rankingMisses()).toBeGreaterThan(after);
  });

  it('stesso risultato con e senza cache, e il conteggio degli esclusi si ripete', async () => {
    const { rankedReplacements } = await import('../../src/engine/coachFixes');
    const archetype = 'stall' as const;
    const direct = { excluded: 0 };
    const expected = rankByTeamGain(improveReplacements(six, 4, format, data, 100, undefined, 'it', archetype), six, 4, data, 'it', true, archetype, direct);
    const first = { excluded: 0 };
    const second = { excluded: 0 };
    expect(rankedReplacements(six, 4, format, data, 100, 'it', archetype, first).map(c => [c.species, c.teamGain?.gain]))
      .toEqual(expected.map(c => [c.species, c.teamGain?.gain]));
    rankedReplacements(six, 4, format, data, 100, 'it', archetype, second);
    expect(first.excluded).toBe(direct.excluded);
    expect(second.excluded).toBe(direct.excluded);
  });
});
