import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import { attackStyle, detectRoles, legacyWall } from '../../src/engine/roles';
import { teamNeeds } from '../../src/engine/needs';

const set = (species: string, moves: string[], item = '', evs: TeamSet['evs'] = {}, nature = 'Serious'): TeamSet =>
  ({ species, ability: '', item, moves, nature, evs });

const tusk = set('Great Tusk', ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner']);
const gholdengo = set('Gholdengo', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot']);
const kingambit = set('Kingambit', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], '', { atk: 252, spe: 252 }, 'Adamant'); // set comune: 94k, sotto i 100k

describe('roles (sotto-ruoli del set)', () => {
  it('Corviknight: muro fisico, recupero, rimozione, pivot', () => {
    const corviknight = set('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost'], 'Leftovers', { hp: 252, def: 252 }, 'Impish');
    expect(detectRoles(corviknight, DEFAULT_RULES)).toEqual(['physicalWall', 'recovery', 'removal', 'pivot']);
  });

  it('Great Tusk: muro fisico e wallbreaker fisico, hazard, rimozione', () => {
    const tuskSr = set('Great Tusk', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Stealth Rock'], 'Leftovers', { atk: 252, hp: 4 }, 'Adamant');
    expect(detectRoles(tuskSr, DEFAULT_RULES)).toEqual(['physicalBreaker', 'physicalWall', 'hazards', 'removal']);
  });

  it('Kingambit non è un muro', () => {
    const roles = detectRoles(kingambit, DEFAULT_RULES);
    expect(roles).not.toContain('physicalWall');
    expect(roles).not.toContain('specialWall');
  });

  it('priorità, controllo velocità e setup non sono più ruoli', () => {
    const roles: string[] = detectRoles(kingambit, DEFAULT_RULES);
    expect(roles).not.toContain('priority');
    expect(roles).not.toContain('setup');
    expect(detectRoles(set('Clefable', ['Moonblast', 'Thunder Wave']), DEFAULT_RULES) as string[]).not.toContain('speed');
  });

  it('il muro "legacy" dei difensori resta quello di prima (statistiche di base)', () => {
    expect(legacyWall(set('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost']), DEFAULT_RULES)).toBe(true);
    expect(legacyWall(set('Dragapult', ['Dragon Darts', 'U-turn']), DEFAULT_RULES)).toBe(false);
  });

  it('hazard', () => {
    expect(detectRoles(set('Garchomp', ['Stealth Rock', 'Earthquake']), DEFAULT_RULES)).toContain('hazards');
  });

  it('mosse vuote o sconosciute non rompono nulla', () => {
    expect(() => detectRoles(set('Great Tusk', ['', 'Notamove']), DEFAULT_RULES)).not.toThrow();
    expect(detectRoles(set('Fakemon-Xyz', ['Defog']), DEFAULT_RULES)).toEqual([]);
  });

  it('stile d\'attacco', () => {
    expect(attackStyle(tusk)).toBe('physical');
    expect(attackStyle(gholdengo)).toBe('special');
    expect(attackStyle(set('Toxapex', ['Toxic', 'Recover']))).toBe('none');
  });

  it('bisogni del team', () => {
    // Team incompleto: si giudica come balance; Great Tusk e Gholdengo coprono rimozione, minaccia offensiva e wall fisico
    expect(teamNeeds([tusk, gholdengo], DEFAULT_RULES).missing.map(m => m.need)).toEqual(['hazards', 'pivot', 'speed', 'speedControl', 'priority', 'specialWall']);
    expect(teamNeeds([tusk, gholdengo], DEFAULT_RULES).needStyle).toBeNull();
    // Squilibrio solo con almeno 4 attaccanti tutti dello stesso tipo (come nel voto)
    expect(teamNeeds([tusk, kingambit], DEFAULT_RULES).needStyle).toBeNull();
    const physical = ['Great Tusk', 'Kingambit', 'Dragonite', 'Garchomp'].map(n => set(n, ['Earthquake', 'Close Combat']));
    expect(teamNeeds(physical, DEFAULT_RULES).needStyle).toBe('special');
  });
});

describe('sweeper e wallbreaker', () => {
  it('fisici e speciali', () => {
    expect(detectRoles(kingambit, DEFAULT_RULES)).toContain('physicalSweeper');
    expect(detectRoles(set('Dragapult', ['Dragon Darts', 'U-turn'], '', { atk: 252, spe: 252 }, 'Jolly'), DEFAULT_RULES)).toContain('physicalSweeper');
    expect(detectRoles(gholdengo, DEFAULT_RULES)).toEqual(['specialBreaker', 'recovery']);
  });

  it('un attaccante lento senza setup è wallbreaker, non sweeper', () => {
    const roles = detectRoles(set('Kingambit', ['Kowtow Cleave', 'Sucker Punch'], '', { atk: 252 }, 'Adamant'), DEFAULT_RULES);
    expect(roles).toContain('physicalBreaker');
    expect(roles).not.toContain('physicalSweeper');
  });

  it('lento con un setup che alza solo l\'attacco: non è sweeper (Magearna con Calm Mind, Ursaluna con Swords Dance)', () => {
    expect(detectRoles(set('Magearna', ['Fleur Cannon', 'Flash Cannon', 'Calm Mind', 'Volt Switch'], '', { spa: 252 }, 'Modest'), DEFAULT_RULES)).not.toContain('specialSweeper');
    expect(detectRoles(set('Ursaluna', ['Facade', 'Earthquake', 'Fire Punch', 'Swords Dance']), DEFAULT_RULES)).not.toContain('physicalSweeper');
  });

  it('un setup che alza la velocità basta (Dragon Dance, Quiver Dance anche senza velocità alta)', () => {
    expect(detectRoles(set('Dragonite', ['Dragon Dance', 'Outrage', 'Earthquake', 'Fire Punch']), DEFAULT_RULES)).toContain('physicalSweeper');
    const lilligant = (moves: string[]) => set('Lilligant', moves, '', { spa: 252 }, 'Modest');
    expect(detectRoles(lilligant(['Quiver Dance', 'Petal Dance', 'Giga Drain', 'Sleep Powder']), DEFAULT_RULES)).toContain('specialSweeper');
    expect(detectRoles(lilligant(['Petal Dance', 'Giga Drain', 'Sleep Powder', 'Synthesis']), DEFAULT_RULES)).not.toContain('specialSweeper');
  });
});
