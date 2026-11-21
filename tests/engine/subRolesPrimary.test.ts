import { describe, expect, it } from 'vitest';
import { cardRoles } from '../../src/engine/archetype';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { teamNeeds } from '../../src/engine/needs';
import { ESSENTIAL_POINTS, teamRolesArea } from '../../src/engine/rolesArea';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { creditedValues, measuredSubRoles, primaryFamily, SECONDARY_CREDIT, type SubRoleValues } from '../../src/engine/subRoles';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, ...extra });

// Great Tusk offensivo: Jolly 252 Atk / 252 Spe, quattro attacchi
const offensiveTusk = set('Great Tusk', 'Heavy-Duty Boots', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'],
  { nature: 'Jolly', evs: { atk: 252, def: 4, spe: 252 } });
// Corviknight difensivo: Impish 248 HP / 252 Def, Roost
const defensiveCorv = set('Corviknight', 'Rocky Helmet', 'Pressure', ['Roost', 'Brave Bird', 'Defog', 'U-turn'],
  { nature: 'Impish', evs: { hp: 248, def: 252, spd: 8 } });

// "Tank offensivo" passivo (due attacchi, senza recupero) che resta muro fisico per bulk naturale
const tankTusk = set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Rapid Spin', 'Stealth Rock', 'Taunt'],
  { nature: 'Jolly', evs: { atk: 252, def: 4, spe: 252 } });
const passive = [
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish']),
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Toxic', 'Haze', 'Surf']),
  set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Thunder Wave']),
  set('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Heal Bell']),
  set('Alomomola', 'Heavy-Duty Boots', 'Regenerator', ['Wish', 'Protect', 'Scald', 'Flip Turn']),
];
const attackers = [
  set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head']),
  set('Tapu Lele', 'Choice Specs', 'Psychic Surge', ['Psychic', 'Moonblast', 'Focus Blast', 'Psyshock']),
  set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn']),
];

/** Valori dei membri passati a mano: solo il Great Tusk tank ha il muro fisico (gli altri ne sono privati). */
const membersOf = (team: TeamSet[]): SubRoleValues[] => team.map(s => {
  if (s === tankTusk) return { physicalBreaker: 1, physicalWall: 1, removal: 1, hazards: 1, taunt: 0.5 };
  const { physicalWall: _drop, ...rest } = measuredSubRoles(s, team, fixtureData);
  return rest;
});

describe('ruolo principale e secondario', () => {
  it('Great Tusk offensivo: principale attacco, muro fisico secondario', () => {
    const v = measuredSubRoles(offensiveTusk, [offensiveTusk], fixtureData);
    expect(v.physicalWall).toBe(1);
    expect(primaryFamily(offensiveTusk, v)).toBe('attack');
    // Nello stall il secondario non conta, in semi-stall a metà; Campo e Recupero restano
    expect(creditedValues(v, 'attack', 'stall').physicalWall ?? 0).toBe(0);
    expect(creditedValues(v, 'attack', 'semiStall').physicalWall).toBe(0.5);
    expect(creditedValues(v, 'attack', 'semiStall').removal).toBe(v.removal);
    expect(creditedValues(v, 'attack', 'stall').physicalBreaker).toBe(v.physicalBreaker);
    // I valori in cache restano quelli grezzi
    expect(v.physicalWall).toBe(1);
  });

  it('Corviknight difensivo: principale muro', () => {
    const v = measuredSubRoles(defensiveCorv, [defensiveCorv], fixtureData);
    expect(primaryFamily(defensiveCorv, v)).toBe('wall');
    // Un attacco secondario di un muro, in stall, non conta
    expect(creditedValues({ physicalWall: 1, physicalBreaker: 1, recovery: 1 }, 'wall', 'stall')).toEqual({ physicalWall: 1, recovery: 1 });
  });

  it('con entrambe le famiglie decide il verdetto degli EV, uguale su scheda e bisogni', () => {
    const both = { physicalWall: 1, physicalBreaker: 1, recovery: 1, removal: 1 };
    expect(primaryFamily(defensiveCorv, both)).toBe('wall');
    expect(primaryFamily(offensiveTusk, both)).toBe('attack');
    expect(cardRoles(defensiveCorv, DEFAULT_RULES, both)[0]).toBe('physicalWall');
    expect(cardRoles(offensiveTusk, DEFAULT_RULES, both)[0]).toBe('physicalBreaker');
  });

  it('un muro da stall senza EV: scheda e bisogni scelgono lo stesso principale (il valore migliore)', () => {
    const tingLu = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Earthquake', 'Ruination', 'Stealth Rock', 'Whirlwind']);
    const values = { physicalWall: 0.6, physicalBreaker: 1, hazards: 1 };
    const primary = primaryFamily(tingLu, values);
    expect(primary).toBe('attack');
    // La scheda parte dal principale degli stessi valori, senza il vecchio passaggio da muro da stall
    expect(cardRoles(tingLu, DEFAULT_RULES, values)[0]).toBe('physicalBreaker');
    const needs = teamNeeds([tingLu], fixtureData, [values]);
    expect(needs.members[0]).toEqual(values);
  });

  it('senza attacco né muro: nessun principale; senza EV decide il valore (pari: attacco)', () => {
    expect(primaryFamily(emptySet('Clefable'), { hazards: 1, recovery: 1 })).toBeNull();
    expect(primaryFamily(emptySet('Ting-Lu'), { physicalWall: 1, physicalBreaker: 1 })).toBe('attack');
    expect(primaryFamily(emptySet('Ting-Lu'), { physicalWall: 1, physicalBreaker: 0.4 })).toBe('wall');
  });

  it('crediti approvati per archetipo', () => {
    expect(SECONDARY_CREDIT).toEqual({ hyperOffense: 1, bulkyOffense: 1, balance: 1, semiStall: 0.5, stall: 0, doubles: 1 });
  });

  it('semi-stall col solo Great Tusk offensivo: muro fisico 0.5', () => {
    const team = [tankTusk, ...passive.slice(0, 4), attackers[0]];
    const needs = teamNeeds(team, fixtureData, membersOf(team));
    expect(needs.archetype).toBe('semiStall');
    expect(needs.values.physicalWall).toBe(0.5);
    expect(needs.essentialMissing).not.toContain('physicalWall');
    // I valori grezzi restano per la scheda
    expect(needs.members[0].physicalWall).toBe(1);
  });

  it('stall di tank offensivi: muro fisico 0 → malus Stall senza muro fisico', () => {
    const team = [tankTusk, ...passive];
    const needs = teamNeeds(team, fixtureData, membersOf(team));
    expect(needs.archetype).toBe('stall');
    expect(needs.values.physicalWall).toBe(0);
    expect(needs.essentialMissing).toContain('physicalWall');
    const area = teamRolesArea(team, fixtureData, 'it', needs);
    expect(area.failures.map(f => `${f.text} (−${f.points})`)).toContain(`Stall senza Muro Fisico (−${ESSENTIAL_POINTS})`);
    expect(area.members[0].primary).toBe('attack');
  });

  it('balance: il secondario conta pieno', () => {
    const team = [tankTusk, ...passive.slice(0, 2), ...attackers];
    const needs = teamNeeds(team, fixtureData, membersOf(team));
    expect(needs.archetype).toBe('balance');
    expect(needs.values.physicalWall).toBe(1);
    const row = teamRolesArea(team, fixtureData, 'it', needs).rows.find(r => r.key === 'physicalWall')!;
    expect(row.by[0]).toMatchObject({ species: 'Great Tusk', value: 1, secondary: true });
  });
});
