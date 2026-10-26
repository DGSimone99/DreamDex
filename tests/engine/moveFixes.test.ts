import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coreMoves } from '../../src/engine/bestPreset';
import { findProblems } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { moveFixes, MOVE_FIXES_PER_MEMBER } from '../../src/engine/moveFixes';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain } from '../../src/engine/teamGain';
import { fixtureData, fixtureStats } from '../fixtures/data';

const format = DEFAULT_FORMAT;
const data = { ...fixtureData, formatId: format.formatId };
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const problemsOf = (team: TeamSet[], d = data) => findProblems(team, format, analyzeTeam(team, d), [], 'it');
const fixesOf = (team: TeamSet[], d = data) => moveFixes(team, format, d, problemsOf(team, d), 'it');

describe('cambi di mossa del Coaching', () => {
  const fixes = fixesOf(six);

  it('solo cambi che alzano il voto, con una sola mossa diversa', () => {
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) {
      expect(f.gain).toBeGreaterThan(0);
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

  it('al massimo tre per membro, dal voto più alto', () => {
    six.forEach((_, index) => {
      const own = fixes.filter(f => f.index === index);
      expect(own.length).toBeLessThanOrEqual(MOVE_FIXES_PER_MEMBER);
      own.forEach((f, i) => { if (i) expect(own[i - 1].gain).toBeGreaterThanOrEqual(f.gain); });
    });
  });

  it('stesso +N di Migliora team', () => {
    for (const f of fixes) {
      expect(rankByTeamGain([{ set: f.set, score: 0 }], six, f.index, data, 'it')[0].teamGain!.gain).toBe(f.gain);
    }
  });

  // Statistiche di prova: Sunkern usa le mosse di Great Tusk, che non impara
  const stats = { ...fixtureStats, pokemon: { ...fixtureStats.pokemon, Sunkern: fixtureStats.pokemon['Great Tusk'] } };
  const local = { ...data, stats };
  const tuskMoves = ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner', 'Stealth Rock'];
  const sunkernTo = (team: TeamSet[]) => fixesOf(team, local).filter(f => f.index === 5);
  const custom = six.map((s, i) => (i === 5 ? { ...s, customSkillset: true } : s));

  it('un membro con una sola mossa riempie uno slot vuoto', () => {
    expect(sunkernTo(custom).some(f => f.slot >= 1 && f.from === '')).toBe(true);
  });

  it('mosse non legali solo con Custom Skillset', () => {
    expect(sunkernTo(six).filter(f => tuskMoves.includes(f.to))).toEqual([]);
    expect(sunkernTo(custom).filter(f => tuskMoves.includes(f.to)).length).toBeGreaterThan(0);
  });

  it('senza statistiche o con un solo membro, niente', () => {
    expect(moveFixes(six, format, { ...data, stats: null }, [], 'it')).toEqual([]);
    expect(moveFixes(six.slice(0, 1), format, data, [], 'it')).toEqual([]);
  });
});
