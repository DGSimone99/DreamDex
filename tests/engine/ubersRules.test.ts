import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { DEFAULT_RULES, formatRules, UBERS_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { detectRoles } from '../../src/engine/roles';
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

  it('con un set offensivo un muro deve essere robusto anche per Ubers: Zacian-Crowned no', () => {
    // 92 PS × 115 difese = 10580 < 11000; in OU resta un doppio muro come prima
    expect(walls(zacian)).toEqual([]);
    expect(walls(zacian, DEFAULT_RULES)).toEqual(['physicalWall', 'specialWall']);
  });

  it('un set difensivo usa le soglie di sempre: Ferrothorn e Giratina-Origin restano muri', () => {
    expect(walls(ferrothorn)).toEqual(['physicalWall', 'specialWall']);
    expect(walls(giratina)).toEqual(['physicalWall', 'specialWall']);
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
    const format = { ...DEFAULT_FORMAT, formatId: 'ubers' as const };
    const team = ['Great Tusk', 'Gholdengo', 'Rotom-Wash', 'Kingambit', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(['S', 'A', 'B']).toContain(rateTeam(team, ubers)!.grade);
    const before = teamArchetype(team, UBERS_RULES)?.archetype;
    const swaps = coachTeam(team, format, ubers).swaps;
    expect(swaps.length).toBeGreaterThan(0);
    for (const swap of swaps) expect(teamArchetype(team.map((s, i) => (i === swap.index ? swap.set : s)), UBERS_RULES)?.archetype).toBe(before);
  });

  it('un team da C o D si può ancora ricostruire: lì cambiare tipo di team è il consiglio giusto', () => {
    const format = { ...DEFAULT_FORMAT, formatId: 'ubers' as const };
    expect(['C', 'D']).toContain(rateTeam(ho, ubers)!.grade);
    const before = teamArchetype(ho, UBERS_RULES)?.archetype;
    const changes = coachTeam(ho, format, ubers).swaps.filter(swap => teamArchetype(ho.map((s, i) => (i === swap.index ? swap.set : s)), UBERS_RULES)?.archetype !== before);
    expect(changes.length).toBeGreaterThan(0);
  });
});
