import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { archetypeLock, coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_RULES, formatRules, NATDEX_OU_RULES, UBERS_RULES } from '../../src/engine/formatRules';
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
  it('Ubers ha regole proprie; National Dex OU solo la regola dei tipi di team', () => {
    expect(formatRules('ubers')).toBe(UBERS_RULES);
    expect(formatRules('ou')).toBe(NATDEX_OU_RULES);
    expect(NATDEX_OU_RULES).toEqual({ ...DEFAULT_RULES, typeRule: 'recoverySpeed' });
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

  it('in Ubers un team senza hazard non ha più un malus del formato: lo pagano i Ruoli (setup del campo importante in HO)', () => {
    const penalty = (team: TeamSet[], data: EngineData = ubers) => rateTeam(team, data)!.penalty.items.find(i => i.text.startsWith('Nessun hazard'));
    expect(penalty(noHazards)).toBeUndefined();
    expect(penalty(ho)).toBeUndefined();
    const roles = (team: TeamSet[]) => rateTeam(team, ubers)!.roles.covered;
    expect(roles(noHazards)).toBeLessThan(roles(ho));
  });

  it('in Ubers il tipo di team da mantenere è quello del team (team da B in su)', () => {
    // Senza meta: le minacce dei dati di prova sono di OU e abbasserebbero il voto con la penalità del meta
    const data = { ...ubers, ignoreMeta: true };
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Garchomp'].map(n => mostCommonSet(fixtureStats, n)!);
    const grade = rateTeam(team, data)!.grade;
    expect(['S', 'A', 'B']).toContain(grade);
    const before = teamArchetype(team, UBERS_RULES)?.archetype;
    expect(archetypeLock(team, UBERS_RULES, grade)).toBe(before);
    // I consigli del Coaching usano il tipo di team Qualunque (7e8f88c): il blocco non filtra più gli scambi
  });

  it('un team da C o D si può ancora ricostruire: lì i consigli possono cambiare tipo di team', () => {
    // Il voto si passa direttamente: durante la revisione del voto le medie si spostano
    for (const grade of ['C', 'D']) expect(archetypeLock(ho, UBERS_RULES, grade)).toBeUndefined();
    // Da B in su il tipo di team resta quello; fuori da Ubers non si blocca mai
    expect(archetypeLock(ho, UBERS_RULES, 'B')).toBe(teamArchetype(ho, UBERS_RULES)?.archetype);
    expect(archetypeLock(ho, DEFAULT_RULES, 'B')).toBeUndefined();
  });
});
