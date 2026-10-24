import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { archetypeLock, coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { DEFAULT_RULES, formatRules, UBERS_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { detectRoles, legacyWall } from '../../src/engine/roles';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });
const walls = (s: TeamSet, rules = UBERS_RULES) => detectRoles(s, rules).filter(r => r === 'physicalWall' || r === 'specialWall');

const zacian = set('Zacian', 'Rusted Sword', 'Intrepid Sword', ['Swords Dance', 'Behemoth Blade', 'Close Combat', 'Wild Charge']);
const ferrothorn = set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Spikes', 'Leech Seed', 'Power Whip', 'Knock Off']);
const giratina = set('Giratina-Origin', 'Griseous Core', 'Levitate', ['Defog', 'Will-O-Wisp', 'Poltergeist', 'Shadow Sneak']);

describe('regole di Ubers', () => {
  it('solo Ubers ha regole proprie', () => {
    expect(formatRules('ubers')).toBe(UBERS_RULES);
    expect(formatRules('ou')).toBe(DEFAULT_RULES);
    expect(formatRules(undefined)).toBe(DEFAULT_RULES);
  });

  it('muro legacy (difensori): con un set offensivo deve essere robusto anche per Ubers, Zacian-Crowned no', () => {
    // 92 PS × 115 difese = 10580 < 11000; in OU resta un muro come prima
    expect(legacyWall(zacian, UBERS_RULES)).toBe(false);
    expect(legacyWall(zacian, DEFAULT_RULES)).toBe(true);
  });

  it('muro legacy: un set difensivo usa le soglie di sempre, Ferrothorn e Giratina-Origin restano muri', () => {
    expect(legacyWall(ferrothorn, UBERS_RULES)).toBe(true);
    expect(legacyWall(giratina, UBERS_RULES)).toBe(true);
  });

  it('indice di muro: Ubers ha soglie più alte (Giratina-Origin senza EV, 104k: muro in OU, non in Ubers)', () => {
    expect(walls(giratina, DEFAULT_RULES)).toEqual(['physicalWall', 'specialWall']);
    expect(walls(giratina)).toEqual([]);
    expect(walls(zacian, DEFAULT_RULES)).toEqual([]);
  });

  // HO di Ubers con un lead che piazza gli hazard
  const ho = [
    set('Deoxys-Speed', 'Focus Sash', 'Pressure', ['Stealth Rock', 'Spikes', 'Taunt', 'Psycho Boost']),
    zacian,
    set('Marshadow', 'Life Orb', 'Technician', ['Spectral Thief', 'Close Combat', 'Shadow Sneak', 'Bulk Up']),
    set('Necrozma-Dusk-Mane', 'Weakness Policy', 'Prism Armor', ['Dragon Dance', 'Sunsteel Strike', 'Earthquake', 'Morning Sun']),
    set('Kyogre', 'Blue Orb', 'Drizzle', ['Water Spout', 'Origin Pulse', 'Ice Beam', 'Thunder']),
    set('Arceus', 'Silk Scarf', 'Multitype', ['Swords Dance', 'Extreme Speed', 'Shadow Claw', 'Recover']),
  ];
  const ubers: EngineData = { ...fixtureData, formatId: 'ubers' };
  const noHazards = ho.map(s => ({ ...s, moves: s.moves.map(m => (['Stealth Rock', 'Spikes'].includes(m) ? 'Protect' : m)) }));

  it('in Ubers un team completo senza hazard perde punti; in OU no', () => {
    const penalty = (team: TeamSet[], data: EngineData = ubers) => rateTeam(team, data)!.penalty.items.find(i => i.text.startsWith('Nessun hazard'));
    expect(penalty(noHazards)?.points).toBe(UBERS_RULES.noHazardsPenalty);
    expect(penalty(ho)).toBeUndefined();
    expect(penalty(noHazards, fixtureData)).toBeUndefined();
    // Un team incompleto non viene penalizzato: gli hazard possono ancora arrivare
    expect(penalty(noHazards.slice(0, 5))).toBeUndefined();
  });

  it('in Ubers il coach non propone sostituzioni che cambiano il tipo di team (team da B in su)', () => {
    const format = { ...DEFAULT_FORMAT, formatId: 'ubers' as const, meta: false };
    // Senza meta: le minacce dei dati di prova sono di OU e abbasserebbero il voto con la penalità del meta
    const data = { ...ubers, ignoreMeta: true };
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Garchomp'].map(n => mostCommonSet(fixtureStats, n)!);
    const grade = rateTeam(team, data)!.grade;
    expect(['S', 'A', 'B']).toContain(grade);
    const before = teamArchetype(team, UBERS_RULES)?.archetype;
    // Da B in su il tipo di team è bloccato: ogni scambio proposto lo mantiene
    expect(archetypeLock(team, UBERS_RULES, grade)).toBe(before);
    const swaps = coachTeam(team, format, data).swaps;
    for (const swap of swaps) expect(teamArchetype(team.map((s, i) => (i === swap.index ? swap.set : s)), UBERS_RULES)?.archetype).toBe(before);
  });

  it('un team da C o D si può ancora ricostruire: lì i consigli possono cambiare tipo di team', () => {
    // Il voto si passa direttamente: durante la revisione del voto le medie si spostano
    for (const grade of ['C', 'D']) expect(archetypeLock(ho, UBERS_RULES, grade)).toBeUndefined();
    // Da B in su il tipo di team resta quello; fuori da Ubers non si blocca mai
    expect(archetypeLock(ho, UBERS_RULES, 'B')).toBe(teamArchetype(ho, UBERS_RULES)?.archetype);
    expect(archetypeLock(ho, DEFAULT_RULES, 'B')).toBeUndefined();
  });
});
