import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coreMoves } from '../../src/engine/bestPreset';
import { findProblems } from '../../src/engine/coach';
import { getMove } from '../../src/engine/dex';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { initBans } from '../../src/engine/formats';
import { keepMoveFixes, moveFixes, MOVE_FIXES_PER_MEMBER, ZERO_GAIN_TRIES, type MoveFix } from '../../src/engine/moveFixes';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain } from '../../src/engine/teamGain';
import { fixtureData, fixtureStats } from '../fixtures/data';

const format = DEFAULT_FORMAT;
const data = { ...fixtureData, formatId: format.formatId };
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const problemsOf = (team: TeamSet[], d = data, f: Format = format) => findProblems(team, f, analyzeTeam(team, d), [], 'it');
const fixesOf = (team: TeamSet[], d = data, f: Format = format) => moveFixes(team, f, d, problemsOf(team, d, f), 'it');

describe('cambi di mossa del Coaching', () => {
  let fixes: MoveFix[] = [];
  beforeAll(() => { fixes = fixesOf(six); });
  afterEach(() => initBans(null));

  it('solo cambi che alzano il voto (o a pari voto che risolvono), con una sola mossa diversa', () => {
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) {
      expect(f.gain > 0 || (f.gain === 0 && f.solves.length > 0)).toBe(true);
      expect(f.set.moves[f.slot]).toBe(f.to);
      expect(f.from).toBe(six[f.index].moves[f.slot] ?? '');
      six[f.index].moves.forEach((m, i) => { if (i !== f.slot) expect(f.set.moves[i]).toBe(m); });
    }
  });

  it('niente mosse core tolte, niente doppioni', () => {
    for (const f of fixes) {
      expect(coreMoves(six[f.index], data, 9)).not.toContain(f.from);
      expect(six[f.index].moves).not.toContain(f.to);
    }
  });

  it('al massimo tre per membro', () => {
    six.forEach((_, index) => expect(fixes.filter(f => f.index === index).length).toBeLessThanOrEqual(MOVE_FIXES_PER_MEMBER));
  });

  it('stesso +N di Migliora team', () => {
    for (const f of fixes) {
      expect(rankByTeamGain([{ set: f.set, score: 0 }], six, f.index, data, 'it')[0].teamGain!.gain).toBe(f.gain);
    }
  });

  it('mosse oltre la generazione del formato o vietate dal formato: mai proposte', () => {
    // Body Press (Gen 8) si propone a Corviknight in Gen 9…
    expect(fixes.some(f => f.to === 'Body Press')).toBe(true);
    // …non con un limite di generazione più basso
    const gen7 = { ...format, genLimit: 7 };
    for (const f of fixesOf(six, data, gen7)) expect(getMove(f.to)!.gen).toBeLessThanOrEqual(7);
    // …né se il formato la vieta, anche con Custom Skillset
    initBans({ ou: { moves: ['Body Press'], abilities: [], items: [], species: [] } });
    expect(fixesOf(six).filter(f => f.to === 'Body Press')).toEqual([]);
    expect(fixesOf(six.map(s => ({ ...s, customSkillset: true }))).filter(f => f.to === 'Body Press')).toEqual([]);
  });

  describe('Sunkern con le mosse di Great Tusk', () => {
    // Statistiche di prova: Sunkern usa le mosse di Great Tusk, che non impara
    const tuskMoves = ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner', 'Stealth Rock'];
    const local = () => ({ ...data, stats: { ...fixtureStats, pokemon: { ...fixtureStats.pokemon, Sunkern: fixtureStats.pokemon['Great Tusk'] } } });
    const sunkernTo = (team: TeamSet[]) => fixesOf(team, local()).filter(f => f.index === 5);
    const custom = six.map((s, i) => (i === 5 ? { ...s, customSkillset: true } : s));

    it('un membro con una sola mossa riempie uno slot vuoto', () => {
      expect(sunkernTo(custom).some(f => f.slot >= 1 && f.from === '')).toBe(true);
    });

    it('mosse non legali solo con Custom Skillset', () => {
      expect(sunkernTo(six).filter(f => tuskMoves.includes(f.to))).toEqual([]);
      expect(sunkernTo(custom).filter(f => tuskMoves.includes(f.to)).length).toBeGreaterThan(0);
    });
  });

  it('senza statistiche o con un solo membro, niente', () => {
    expect(moveFixes(six, format, { ...data, stats: null }, [], 'it')).toEqual([]);
    expect(moveFixes(six.slice(0, 1), format, data, [], 'it')).toEqual([]);
  });
});

describe('keepMoveFixes', () => {
  type Delta = { solves: string[]; reduces: string[]; introduces: string[] };
  const delta = (solves: string[] = [], introduces: string[] = []): Delta => ({ solves, reduces: [], introduces });
  const keep = (items: { to: string; gain: number; d: Delta }[]) => {
    const asked: string[] = [];
    const kept = keepMoveFixes(items, c => { asked.push(c.to); return c.d; }, MOVE_FIXES_PER_MEMBER).map(c => c.to);
    return { kept, asked };
  };

  it('voto in più: sempre; a pari voto solo se risolve e non porta problemi nuovi; voto in meno: mai', () => {
    const { kept } = keep([
      { to: 'up', gain: 2, d: delta() },
      { to: 'zeroSolves', gain: 0, d: delta(['a']) },
      { to: 'zeroNothing', gain: 0, d: delta() },
      { to: 'zeroNew', gain: 0, d: delta(['a'], ['b']) },
      { to: 'down', gain: -1, d: delta(['a']) },
    ]);
    expect(kept).toEqual(['zeroSolves', 'up']);
  });

  it('il limite per membro dopo il filtro: chi risolve prima di chi no, poi dal voto più alto', () => {
    const { kept } = keep([
      { to: 'p3', gain: 3, d: delta() }, { to: 'p2', gain: 2, d: delta() }, { to: 'p1', gain: 1, d: delta() },
      { to: 'zero', gain: 0, d: delta(['a']) },
    ]);
    expect(kept).toEqual(['zero', 'p3', 'p2']);
  });

  it(`a pari voto se ne provano al massimo ${ZERO_GAIN_TRIES}; ci si ferma quando ce ne sono abbastanza che risolvono`, () => {
    const zeros = Array.from({ length: 6 }, (_, i) => ({ to: `z${i}`, gain: 0, d: delta() }));
    expect(keep(zeros).asked).toHaveLength(ZERO_GAIN_TRIES);
    const solving = ['a', 'b', 'c', 'd'].map((to, i) => ({ to, gain: 5 - i, d: delta([to]) }));
    const { kept, asked } = keep([...solving, { to: 'z', gain: 0, d: delta(['x']) }]);
    expect(kept).toEqual(['a', 'b', 'c']);
    expect(asked).toEqual(['a', 'b', 'c']);
  });
});
