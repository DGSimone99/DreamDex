import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachAdvice, coachTeam, findProblems, MIN_COVERAGE_WEIGHT } from '../../src/engine/coach';
import { coachFixes } from '../../src/engine/coachFixes';
import { buildSteps } from '../../src/engine/coachSteps';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { improveReplacements } from '../../src/engine/replace';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain, withCandidate } from '../../src/engine/teamGain';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';

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
      const archetype = undefined;
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

  it('senza statistiche: nessun candidato', () => {
    const noStats = { ...data, stats: null };
    expect(coachFixes(six, format, noStats, problemsOf(six), 'it')).toEqual([]);
    expect(adviceOf(six, format, noStats).fixes).toEqual([]);
    expect(adviceOf(six, format, noStats).steps).toEqual([]);
    expect(adviceOf(six, format, noStats).moves).toEqual([]);
  });

  it('meta spento con le statistiche: candidati sì, problemi del meta no', () => {
    const noMeta = { ...data, ignoreMeta: true };
    const off = { ...format, meta: false };
    expect(coachTeam(six, off, noMeta).problems.some(p => p.key.startsWith('meta:'))).toBe(false);
    const { fixes } = adviceOf(six, off, noMeta);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes.flatMap(f => [...f.solves, ...f.reduces]).some(key => key.startsWith('meta:'))).toBe(false);
  });

  it('riduce = il problema resta ma più piccolo, o da grave diventa minore', () => {
    for (const [team, fixes] of [[six, fixesSix], [three, fixesThree]] as const) {
      const now = new Map(problemsOf(team).map(p => [p.key, p]));
      for (const fix of fixes) {
        const after = new Map(problemsOf(withCandidate(team, fix.set, fix.index)).map(p => [p.key, p]));
        for (const key of fix.reduces) {
          expect(fix.solves).not.toContain(key);
          const was = now.get(key)!;
          const is = after.get(key)!;
          expect(is).toBeTruthy();
          expect((was.severity === 'serious' && is.severity === 'minor') || is.size! < was.size!).toBe(true);
        }
      }
    }
  });

  it('copertura: il problema raggruppato ha candidati che coprono uno dei tipi', () => {
    const gaps = (team: TeamSet[]) => {
      const analysis = analyzeTeam(team, data);
      return analysis.coverage.filter(r => r.hitters.length === 0 && analysis.typeWeights[r.type] >= MIN_COVERAGE_WEIGHT).map(r => r.type);
    };
    expect(problemsOf(three).some(p => p.key === 'coverage')).toBe(true);
    const list = fixesThree.filter(f => f.solves.includes('coverage') || f.reduces.includes('coverage'));
    expect(list.length).toBeGreaterThan(0);
    for (const fix of list) {
      const left = gaps(withCandidate(three, fix.set, fix.index));
      expect(gaps(three).some(type => !left.includes(type))).toBe(true);
    }
  });

  it('debolezza da grave a minore: il candidato è sotto il problema ma non fra quelli che lo risolvono', () => {
    const key = 'defense:Ground';
    expect(problemsOf(three).find(p => p.key === key)?.severity).toBe('serious');
    const fix = fixesThree.find(f => f.reduces.includes(key) && !f.solves.includes(key))!;
    expect(fix).toBeTruthy();
    expect(fix.reduces).toContain(key);
    expect(problemsOf(withCandidate(three, fix.set, fix.index)).find(p => p.key === key)?.severity).toBe('minor');
  });

  it('tempo ragionevole', () => {
    adviceOf(six, format, fixtureData);
    const start = performance.now();
    adviceOf(six, format, fixtureData);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});

describe('coachAdvice', () => {
  it('porta i candidati, i cambi di mossa e le tappe per i problemi di coachTeam', () => {
    const coaching = coachTeam(three, format, fixtureData);
    const advice = coachAdvice(three, format, fixtureData, coaching.problems, 'it');
    expect(advice.fixes).toEqual(fixesOf(three));
    expect(advice.steps).toEqual(buildSteps(coaching.problems, advice.fixes, advice.moves));
    expect(advice.steps.length).toBeGreaterThan(0);
    expect(coachAdvice([three[0]], format, fixtureData, [], 'it')).toEqual({ fixes: [], moves: [], steps: [] });
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
    adviceOf(team, format, fixtureData);
    const after = rankingMisses();
    adviceOf(team, format, fixtureData);
    expect(rankingMisses()).toBe(after);
    // Un team nuovo invece si calcola
    adviceOf([...three], format, fixtureData);
    expect(rankingMisses()).toBeGreaterThan(after);
  });

  it('la vista per membro dopo il Coaching riusa i voti dei candidati già valutati, con lo stesso risultato', async () => {
    const { rankedReplacements } = await import('../../src/engine/coachFixes');
    const { teamGainMisses } = await import('../../src/engine/teamGain');
    const team = [...six];
    const archetype = undefined;
    adviceOf(team, format, data);
    const before = teamGainMisses();
    // Le statistiche di prova hanno pochi Pokémon: i 15 del Coaching sono già tutti i candidati
    const ranked = rankedReplacements(team, 4, format, data, 100, 'it', archetype);
    expect(teamGainMisses()).toBe(before);
    // Stesso ordine e stesso +N di un calcolo da zero (un altro team, quindi niente memoria)
    const fresh = [...six];
    const expected = rankByTeamGain(improveReplacements(fresh, 4, format, data, 100, undefined, 'it', archetype), fresh, 4, data, 'it', true, archetype);
    expect(teamGainMisses()).toBeGreaterThan(before);
    expect(ranked.map(c => [c.species, c.teamGain?.gain, c.teamGain?.penalty])).toEqual(expected.map(c => [c.species, c.teamGain?.gain, c.teamGain?.penalty]));
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
