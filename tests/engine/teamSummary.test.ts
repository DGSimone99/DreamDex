import { describe, expect, it } from 'vitest';
import { cardRoles } from '../../src/engine/archetype';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, type Coaching } from '../../src/engine/coach';
import { teamCores } from '../../src/engine/cores';
import { battleName, toID } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rulesOf } from '../../src/engine/formatRules';
import { dashboardData } from '../../src/engine/overviewDashboard';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { measuredSubRoles } from '../../src/engine/subRoles';
import { hasSetup } from '../../src/engine/roles';
import { viaName } from '../../src/engine/synergy';
import { teamLinks } from '../../src/engine/teamLinks';
import { t } from '../../src/i18n';
import { TOP_ATTACKER, teamSummary } from '../../src/engine/teamSummary';
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

// Team senza mosse di campo né abilità di condizione: punto di partenza per i test di condizioni e hazard
const FIELD_IDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'reflect', 'lightscreen', 'auroraveil', 'tailwind', 'trickroom'];
const plain = base.map(s => ({ ...s, ability: 'Pressure', moves: s.moves.filter(m => !FIELD_IDS.includes(toID(m))) }));
const swap = (i: number, set: TeamSet) => plain.map((s, j) => (j === i ? set : s));

describe('teamSummary', () => {
  it('costanti', () => {
    expect(TOP_ATTACKER).toBe(85);
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

  it('condizioni: Drizzle + Swift Swim, il setter non è tra gli utenti', () => {
    const team = swap(1, { ...emptySet('Barraskewda'), ability: 'Swift Swim', moves: ['Liquidation'] });
    team[0] = { ...emptySet('Pelipper'), ability: 'Drizzle', moves: ['Surf'] };
    const rain = build(team).summary.conditions.filter(c => c.key === 'rain');
    expect(rain).toEqual([{ member: 'Pelipper', key: 'rain', label: 'Pioggia', users: [{ name: 'Barraskewda', via: 'Swift Swim' }] }]);
  });

  it('condizioni: Trick Room con un membro lento tra gli utenti', () => {
    const team = swap(1, { ...emptySet('Torkoal'), ability: 'Drought', moves: ['Eruption'] });
    team[0] = { ...emptySet('Hatterene'), ability: 'Magic Bounce', moves: ['Trick Room', 'Psychic'] };
    const row = build(team).summary.conditions.find(c => c.key === 'trickroom')!;
    expect(row.member).toBe('Hatterene');
    expect(row.users.map(u => u.name)).toEqual(['Torkoal', 'Kingambit', 'Toxapex']);
    // Il lento ne approfitta per la velocità bassa (viaName la traduce)
    expect(viaName(row.users[0].via!, 'it')).toBe(t('it', 'synergy.slow'));
  });

  it('condizioni: Reflect e Light Screen, una riga per chiave con gli stessi utenti (mossa di potenziamento, anche gli sweeper)', () => {
    const wall = { ...mostCommonSet(fixtureStats, 'Toxapex')!, moves: ['Calm Mind', 'Recover', 'Scald', 'Toxic'] };
    const sweeper = { ...mostCommonSet(fixtureStats, 'Kingambit')!, moves: ['Swords Dance', 'Sucker Punch', 'Iron Head', 'Kowtow Cleave'] };
    const team = swap(1, wall);
    team[2] = sweeper;
    team[0] = { ...emptySet('Grimmsnarl'), ability: 'Prankster', moves: ['Reflect', 'Light Screen'] };
    const { summary } = build(team);
    const setups = team.filter(s => s.species !== 'Grimmsnarl' && hasSetup(s)).map(battleName);
    expect(setups).toEqual(expect.arrayContaining(['Toxapex', 'Kingambit']));
    const rows = summary.conditions.filter(c => c.member === 'Grimmsnarl');
    expect(rows.map(r => r.key)).toEqual(['reflect', 'lightscreen']);
    expect(rows.map(r => r.users.map(u => u.name))).toEqual([setups, setups]);
  });

  it('condizioni: Tailwind senza utenti', () => {
    const team = swap(3, { ...plain[3], moves: ['Tailwind', 'Roost', 'Brave Bird', 'Defog'] });
    const row = build(team).summary.conditions.find(c => c.key === 'tailwind')!;
    expect(row.member).toBe(battleName(plain[3]));
    expect(row.users).toEqual([]);
  });

  it('hazard: mosse di un membro raggruppate, nessuna', () => {
    const setter = { ...plain[3], moves: ['Stealth Rock', 'Spikes', 'Roost', 'Defog'] };
    expect(build(swap(3, setter)).summary.hazards).toEqual([{ member: battleName(setter), moves: ['Stealth Rock', 'Spikes'] }]);
    expect(build(plain).summary.hazards).toEqual([]);
  });

  it('cores e legami: esattamente teamCores e teamLinks', () => {
    const { summary } = build();
    expect(summary.cores).toEqual(teamCores(base));
    expect(summary.links).toEqual(teamLinks(base, summary.attackers));
  });

  it('Offesa e Difesa di ogni membro per nome', () => {
    const { summary, rating } = build();
    for (const m of rating.offense.members) expect(summary.offenseOf[m.species]).toBe(m.value);
    for (const m of rating.defense.members) expect(summary.defenseOf[m.species]).toBe(m.value);
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
