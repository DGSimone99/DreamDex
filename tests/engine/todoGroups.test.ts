import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { findProblems, type CoachProblem } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { mostCommonSet } from '../../src/engine/sets';
import { groupProblems } from '../../src/engine/todoGroups';
import { fixtureData, fixtureStats } from '../fixtures/data';

const p = (category: CoachProblem['category'], key: string, text: string, severity: CoachProblem['severity'] = 'minor', subjects?: string[]): CoachProblem =>
  ({ severity, category, text, fixes: [], key, ...(subjects ? { subjects } : {}) });

const weak = (type: string, severity: CoachProblem['severity'] = 'minor') => p('defense', `defense:${type}`, `Debole a ${type}: 3 Deboli – 1 Resistono`, severity, [type]);
const threat = (species: string) => p('meta', `meta:${species}`, `Nessun check per ${species} dal meta`, 'minor', [species]);
const roles = (key: 'essential' | 'important', needs: string[], severity: CoachProblem['severity'] = 'minor') =>
  p('roles', `roles:${key}`, `Ruoli mancanti: ${needs.join(', ')}`, severity, needs);
const rule = (member: string, text: string) => p('rules', `rules:${text}`, text, 'serious', [member]);

describe('groupProblems', () => {
  it('debolezze: un gruppo coi tipi, prima i gravi; il testo intero resta nei dettagli', () => {
    const [group] = groupProblems([weak('Fire'), weak('Ground', 'serious'), weak('Ghost')]);
    expect(group).toMatchObject({ kind: 'weak', severity: 'serious', category: 'defense', count: 3 });
    expect(group.items).toEqual([
      { subject: 'Ground', serious: true },
      { subject: 'Fire', serious: false },
      { subject: 'Ghost', serious: false },
    ]);
    expect(group.details).toEqual(['Ground', 'Fire', 'Ghost'].map(x => `Debole a ${x}: 3 Deboli – 1 Resistono`));
    // Le chiavi dei problemi, nello stesso ordine dei testi
    expect(group.keys).toEqual(['defense:Ground', 'defense:Fire', 'defense:Ghost']);
  });

  it('minacce del meta: le specie', () => {
    const [group] = groupProblems([threat('Kingambit'), threat('Great Tusk')]);
    expect(group).toMatchObject({ kind: 'threats', severity: 'minor', category: 'meta', count: 2 });
    expect(group.items.map(i => i.subject)).toEqual(['Kingambit', 'Great Tusk']);
  });

  it('regole: i problemi di un membro in "Non legali", un membro una volta; i Mega restano una riga', () => {
    const megas = p('rules', 'rules:megas', 'Più Mega nel team (A, B)', 'serious', ['A', 'B']);
    const groups = groupProblems([
      rule('Mewtwo-Mega-Y', 'Mewtwo-Mega-Y non è legale'),
      rule('Garchomp', 'Garchomp: Mosse non legali: Volt Tackle'),
      rule('Garchomp', "Garchomp: Strumento vietato: King's Rock"),
      rule('Iron Valiant', 'Iron Valiant è oltre la Gen 8'),
      megas,
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: 'illegal', severity: 'serious', category: 'rules', count: 4 });
    expect(groups[0].items.map(i => i.subject)).toEqual(['Mewtwo-Mega-Y', 'Garchomp', 'Iron Valiant']);
    expect(groups[1]).toEqual({ kind: 'single', severity: 'serious', category: 'rules', text: megas.text, items: [], count: 1, details: [megas.text], keys: ['rules:megas'] });
  });

  it('ruoli mancanti: essenziali e importanti insieme; gravi solo se il problema lo è', () => {
    const [group] = groupProblems([roles('essential', ['hazards', 'pivot']), roles('important', ['removal'])]);
    expect(group).toMatchObject({ kind: 'roles', severity: 'minor', category: 'roles', count: 2 });
    expect(group.items).toEqual([
      { subject: 'hazards', serious: false },
      { subject: 'pivot', serious: false },
      { subject: 'removal', serious: false },
    ]);
    const [serious] = groupProblems([roles('important', ['pivot']), roles('essential', ['hazards'], 'serious')]);
    expect(serious.severity).toBe('serious');
    expect(serious.items).toEqual([{ subject: 'hazards', serious: true }, { subject: 'pivot', serious: false }]);
  });

  it('il resto resta una riga singola col suo testo', () => {
    const others = [
      p('coverage', 'coverage', 'Nessuno colpisce Acqua'),
      p('redundancy', 'redundancy:x', '2 setter di Stealth Rock'),
      p('conditions', 'conditions:x', 'Venusaur ha Chlorophyll ma il team non porta il sole'),
      p('roles', 'roles:member:x', 'Raticate è debole e non porta utilità al team'),
      p('roles', 'roles:style', 'Nessun attaccante fisico'),
    ];
    expect(groupProblems(others)).toEqual(others.map(o => ({ kind: 'single', severity: 'minor', category: o.category, text: o.text, items: [], count: 1, details: [o.text], keys: [o.key] })));
  });

  it('gruppi gravi prima dei minori; a parità l\'ordine dei problemi', () => {
    const groups = groupProblems([
      threat('Kingambit'),
      p('coverage', 'coverage', 'Nessuno colpisce Acqua'),
      weak('Fire'),
      roles('essential', ['hazards']),
      weak('Ground', 'serious'),
      threat('Great Tusk'),
    ]);
    expect(groups.map(g => g.kind)).toEqual(['weak', 'threats', 'single', 'roles']);
    expect(groups.map(g => g.count)).toEqual([2, 2, 1, 1]);
  });

  it('non legge i testi: con testi cambiati i gruppi e gli elementi restano gli stessi', () => {
    const problems = [weak('Ground', 'serious'), threat('Kingambit'), rule('Garchomp', 'Garchomp: x'), roles('essential', ['hazards', 'pivot'])];
    const scrambled = problems.map((x, i) => ({ ...x, text: `testo qualsiasi ${i}: a, b` }));
    const strip = (groups: ReturnType<typeof groupProblems>) => groups.map(({ details: _d, text: _t, keys: _k, ...g }) => g);
    expect(strip(groupProblems(scrambled))).toEqual(strip(groupProblems(problems)));
  });

  it('findProblems dà i dati a ogni problema da raggruppare', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    const analysis = analyzeTeam(team, fixtureData);
    const problems = findProblems(team, DEFAULT_FORMAT, analysis, [], 'it');
    for (const problem of problems) {
      if (problem.category === 'defense') expect(problem.subjects).toEqual([problem.key.slice('defense:'.length)]);
      if (problem.category === 'meta') expect(problem.subjects).toEqual([problem.key.slice('meta:'.length)]);
    }
    const essential = problems.find(x => x.key === 'roles:essential');
    if (essential) expect(essential.subjects).toEqual(analysis.needs.essentialMissing);
    const important = problems.find(x => x.key === 'roles:important');
    if (important) expect(important.subjects).toEqual(analysis.needs.importantMissing);
    // Un membro non legale: il suo nome in battaglia
    const illegal = findProblems([...team.slice(0, 5), { ...team[5], moves: ['Volt Tackle'] }], DEFAULT_FORMAT, analyzeTeam(team, fixtureData), [], 'it')
      .filter(x => x.category === 'rules');
    expect(illegal.length).toBeGreaterThan(0);
    for (const x of illegal) expect(x.subjects).toEqual(['Rotom-Wash']);
  });
});
