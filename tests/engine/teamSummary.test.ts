import { describe, expect, it } from 'vitest';
import { cardRoles } from '../../src/engine/archetype';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, type Coaching } from '../../src/engine/coach';
import { battleName, toID } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rulesOf } from '../../src/engine/formatRules';
import { dashboardData } from '../../src/engine/overviewDashboard';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { measuredSubRoles } from '../../src/engine/subRoles';
import { FIELD_MOVES, TOP_ATTACKER, teamSummary } from '../../src/engine/teamSummary';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const base = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const build = (team: TeamSet[] = base, data = fixtureData, tweak?: (c: Coaching) => Coaching) => {
  const analysis = analyzeTeam(team, data);
  const rating = rateTeam(team, data)!;
  const coaching = tweak ? tweak(coachTeam(team, DEFAULT_FORMAT, data)) : coachTeam(team, DEFAULT_FORMAT, data);
  const dash = dashboardData(team, analysis, rating, coaching.problems, data, 'it');
  return { rating, coaching, dash, summary: teamSummary(team, rating, coaching, dash, data), data };
};

describe('teamSummary', () => {
  it('costanti', () => {
    expect(TOP_ATTACKER).toBe(85);
    expect(FIELD_MOVES).toEqual(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'reflect', 'lightscreen', 'auroraveil', 'trickroom']);
  });

  it('attaccanti: Offesa del membro come in tabella (value, setup e Tera/Z compresi) >= 85, in ordine di team', () => {
    const { rating, coaching, dash, data } = build();
    const members = rating.offense.members.map((m, i) => ({ ...m, setupGain: 0, oneUseGain: 0, value: [90, 84.9, 85, 50, 100, 20][i] }));
    members[4] = { ...members[4], setupGain: 30, oneUseGain: 5, value: 100 }; // 65 senza setup e Tera: conta il numero mostrato
    members[1] = { ...members[1], value: 84.9 };
    const fake = { ...rating, offense: { ...rating.offense, members } };
    const s = teamSummary(base, fake, coaching, dash, data);
    expect(s.attackers).toEqual([battleName(base[0]), battleName(base[2]), battleName(base[4])]);
  });

  it('attaccanti: il membro si trova per nome, non per posizione (membri senza Offesa tolti dalla lista)', () => {
    const { rating, coaching, dash, data } = build();
    // Gholdengo (indice 1) senza Offesa: la lista dei membri ha un elemento in meno e gli indici scorrono
    const members = rating.offense.members
      .filter(m => m.species !== battleName(base[1]))
      .map(m => ({ ...m, value: m.species === battleName(base[2]) ? 99 : 50 }));
    const fake = { ...rating, offense: { ...rating.offense, members } };
    expect(teamSummary(base, fake, coaching, dash, data).attackers).toEqual([battleName(base[2])]);
  });

  it('muri: physicalWall/specialWall nelle carte del team', () => {
    const { summary } = build();
    const rules = rulesOf(fixtureData);
    const expected = base.filter(set => cardRoles(set, rules, measuredSubRoles(set, base, fixtureData)).some(r => r === 'physicalWall' || r === 'specialWall')).map(battleName);
    expect(summary.walls).toEqual(expected);
  });

  it('campo: mosse di un membro raggruppate, meteo, nessuno', () => {
    expect(build().summary.field.every(f => f.items.length > 0 || f.weather)).toBe(true);
    const setter = { ...base[3], moves: ['Stealth Rock', 'Spikes', 'Roost', 'Defog'] };
    const team = [base[0], base[1], base[2], setter, base[4], base[5]];
    const field = build(team).summary.field;
    const entry = field.find(f => f.member === battleName(setter))!;
    expect(entry.items).toEqual(['Stealth Rock', 'Spikes']);
    const plain = base.map(s => ({ ...s, ability: 'Pressure', moves: s.moves.filter(m => !FIELD_MOVES.includes(toID(m))) }));
    expect(build(plain).summary.field).toEqual([]);
    const rain = [{ ...base[0], ability: 'Drizzle' }, ...base.slice(1)];
    const w = build(rain).summary.field.find(f => f.member === battleName(rain[0]))!;
    expect(w.weather).toBe('Pioggia');
    expect(w.items).not.toContain('Pioggia');
  });

  it('colpisce: lo stesso numero della card Copertura', () => {
    const { summary, dash } = build();
    expect(summary.hits).toEqual({ covered: dash.coverage.cells.filter(c => c.offense === 'ok').length, total: 18 });
    expect(dash.coverage.offense).toBe(`${summary.hits.covered}/18`);
  });

  it('debole a: tipi dei problemi defense:*, gravi prima', () => {
    const { summary, coaching } = build();
    const defense = coaching.problems.filter(p => p.key.startsWith('defense:'));
    expect(summary.weak.map(w => w.type).sort()).toEqual(defense.map(p => p.key.slice('defense:'.length)).sort());
    const flags = summary.weak.map(w => w.serious);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    for (const w of summary.weak) expect(w.serious).toBe(defense.find(p => p.key === `defense:${w.type}`)!.severity === 'serious');
  });

  it('ruoli mancanti: essenziali e importanti scoperti', () => {
    const { summary, dash } = build();
    expect(summary.missingRoles).toEqual(dash.roles.chips.filter(c => c.level !== 'minor' && !c.covered).map(c => c.need));
  });

  it('vista ampia: Offesa e Difesa di ogni membro per nome, i tipi non colpiti, i ruoli chiave coperti o no, chi resiste alle debolezze', () => {
    const { summary, rating, dash } = build();
    for (const m of rating.offense.members) expect(summary.offenseOf[m.species]).toBe(m.value);
    for (const m of rating.defense.members) expect(summary.defenseOf[m.species]).toBe(m.value);
    expect(summary.hitsMissing).toEqual(dash.coverage.cells.filter(c => c.offense !== 'ok').map(c => c.type));
    expect(summary.keyRoles).toEqual(dash.roles.chips.filter(c => c.level !== 'minor').map(c => ({ need: c.need, covered: c.covered })));
    for (const w of summary.weak) expect(w.resist).toBe(dash.coverage.cells.find(c => c.type === w.type)!.resist);
  });

  it('minacce: pods col meta, null a meta spento', () => {
    const on = build();
    expect(on.summary.threats).toEqual(on.dash.threats.pods);
    expect(build(base, { ...fixtureData, ignoreMeta: true }).summary.threats).toBeNull();
  });

  it('tipo del team da coaching.teamType, null senza', () => {
    const { summary, coaching } = build();
    expect(summary.archetype).toBe(coaching.teamType?.archetype ?? null);
    expect(summary.styles).toEqual(coaching.teamType?.styles ?? []);
    const none = build(base, fixtureData, c => ({ ...c, teamType: null })).summary;
    expect(none.archetype).toBeNull();
    expect(none.styles).toEqual([]);
  });

  it('Mega: nomi in battaglia', () => {
    const lopunny = { ...emptySet('Lopunny'), item: 'Lopunnite' };
    const tusk = mostCommonSet(megaData.stats, 'Great Tusk')!;
    const team = [lopunny, tusk];
    const { rating, coaching, dash, data } = build(team, megaData);
    const members = rating.offense.members.map(m => ({ ...m, setupGain: 0, oneUseGain: 0, value: 99 }));
    const s = teamSummary(team, { ...rating, offense: { ...rating.offense, members } }, coaching, dash, data);
    expect(s.attackers).toEqual(['Lopunny-Mega', 'Great Tusk']);
  });
});
