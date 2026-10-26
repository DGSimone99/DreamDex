import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CoachProblem } from '../../src/engine/coach';
import { groupProblems } from '../../src/engine/todoGroups';
import { t } from '../../src/i18n';
import { initGameNames } from '../../src/i18n/game';

// I nomi italiani dei tipi usati qui
beforeAll(() => initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { fire: 'Fuoco', ground: 'Terra', ghost: 'Spettro' } }));
afterAll(() => initGameNames(null));

const p = (category: CoachProblem['category'], key: string, text: string, severity: CoachProblem['severity'] = 'minor'): CoachProblem =>
  ({ severity, category, text, fixes: [], key });

const weak = (type: string, severity: CoachProblem['severity'] = 'minor') => p('defense', `defense:${type}`, `Debole a ${type}: 3 Deboli – 1 Resistono`, severity);
const threat = (species: string) => p('meta', `meta:${species}`, t('it', 'coach.problem.threat', { species }));
const roles = (key: 'essential' | 'important', list: string, severity: CoachProblem['severity'] = 'minor') =>
  p('roles', `roles:${key}`, t('it', key === 'essential' ? 'coach.problem.missingRoles' : 'coach.problem.missingImportantRoles', { roles: list }), severity);

describe('groupProblems', () => {
  it('debolezze: un gruppo "Debole a" coi tipi tradotti, prima i gravi; il dettaglio resta fuori dagli elementi', () => {
    const [group] = groupProblems([weak('Fire'), weak('Ground', 'serious'), weak('Ghost')], 'it');
    expect(group).toMatchObject({ kind: 'weak', severity: 'serious', title: 'Debole a', category: 'defense', count: 3 });
    expect(group.items).toEqual([
      { label: 'Terra', serious: true },
      { label: 'Fuoco', serious: false },
      { label: 'Spettro', serious: false },
    ]);
    // Il dettaglio di ogni tipo resta nei testi interi, per il tooltip
    expect(group.details).toEqual(['Debole a Ground: 3 Deboli – 1 Resistono', 'Debole a Fire: 3 Deboli – 1 Resistono', 'Debole a Ghost: 3 Deboli – 1 Resistono']);
    expect(groupProblems([weak('Fire')], 'en')[0]).toMatchObject({ title: 'Weak to', items: [{ label: 'Fire', serious: false }] });
  });

  it('minacce del meta: "Senza check" con le specie', () => {
    const [group] = groupProblems([threat('Kingambit'), threat('Great Tusk')], 'it');
    expect(group).toMatchObject({ kind: 'threats', severity: 'minor', title: 'Senza check', category: 'meta', count: 2 });
    expect(group.items.map(i => i.label)).toEqual(['Kingambit', 'Great Tusk']);
    expect(groupProblems([threat('Kingambit')], 'en')[0].title).toBe('No check');
  });

  it('regole: i problemi di legalità per membro in "Non legali", un membro una volta; i Mega restano una riga', () => {
    const megas = p('rules', 'rules:megas', t('it', 'coach.problem.megas', { list: 'A, B' }), 'serious');
    const problems = [
      p('rules', 'rules:a', t('it', 'coach.problem.illegal', { species: 'Mewtwo-Mega-Y', format: 'National Dex OU' }), 'serious'),
      p('rules', 'rules:b', `Garchomp: ${t('it', 'team.illegalMoves', { list: 'Volt Tackle' })}`, 'serious'),
      p('rules', 'rules:c', `Garchomp: ${t('it', 'team.bannedItem', { name: "King's Rock", format: 'National Dex OU' })}`, 'serious'),
      p('rules', 'rules:d', t('it', 'coach.problem.gen', { species: 'Iron Valiant', gen: 8 }), 'serious'),
      megas,
    ];
    const groups = groupProblems(problems, 'it');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: 'illegal', severity: 'serious', title: 'Non legali', category: 'rules', count: 4 });
    expect(groups[0].items.map(i => i.label)).toEqual(['Mewtwo-Mega-Y', 'Garchomp', 'Iron Valiant']);
    expect(groups[1]).toEqual({ kind: 'single', severity: 'serious', category: 'rules', text: megas.text, items: [], count: 1, details: [megas.text] });
    const en = groupProblems([p('rules', 'rules:a', t('en', 'coach.problem.illegal', { species: 'Mewtwo-Mega-Y', format: 'National Dex OU' }), 'serious')], 'en');
    expect(en[0]).toMatchObject({ title: 'Not legal', items: [{ label: 'Mewtwo-Mega-Y', serious: true }] });
  });

  it('ruoli mancanti: essenziali e importanti in un gruppo; gravi solo se il problema lo è', () => {
    const [group] = groupProblems([roles('essential', 'Hazard, Pivot'), roles('important', 'Rimozione Hazard')], 'it');
    expect(group).toMatchObject({ kind: 'roles', severity: 'minor', title: 'Ruoli mancanti', category: 'roles', count: 2 });
    expect(group.items).toEqual([
      { label: 'Hazard', serious: false },
      { label: 'Pivot', serious: false },
      { label: 'Rimozione Hazard', serious: false },
    ]);
    const [serious] = groupProblems([roles('important', 'Pivot'), roles('essential', 'Hazard', 'serious')], 'it');
    expect(serious.severity).toBe('serious');
    expect(serious.items).toEqual([{ label: 'Hazard', serious: true }, { label: 'Pivot', serious: false }]);
    expect(groupProblems([roles('essential', 'Hazard')], 'en')[0].title).toBe('Missing roles');
  });

  it('il resto resta una riga singola col suo testo', () => {
    const others = [
      p('coverage', 'coverage', 'Nessuno colpisce Acqua'),
      p('redundancy', 'redundancy:x', '2 setter di Stealth Rock'),
      p('conditions', 'conditions:x', 'Venusaur ha Chlorophyll ma il team non porta il sole'),
      p('roles', 'roles:member:x', 'Raticate è debole e non porta utilità al team'),
      p('roles', 'roles:style', 'Nessun attaccante fisico'),
    ];
    expect(groupProblems(others, 'it')).toEqual(others.map(o => ({ kind: 'single', severity: 'minor', category: o.category, text: o.text, items: [], count: 1, details: [o.text] })));
  });

  it('gruppi gravi prima dei minori; a parità l\'ordine dei problemi', () => {
    const groups = groupProblems([
      threat('Kingambit'),
      p('coverage', 'coverage', 'Nessuno colpisce Acqua'),
      weak('Fire'),
      roles('essential', 'Hazard'),
      weak('Ground', 'serious'),
      threat('Great Tusk'),
    ], 'it');
    expect(groups.map(g => g.kind)).toEqual(['weak', 'threats', 'single', 'roles']);
    expect(groups.map(g => g.count)).toEqual([2, 2, 1, 1]);
  });
});
