import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import { attackStyle, detectRoles, teamRoles } from '../../src/engine/roles';
import { teamNeeds } from '../../src/engine/needs';

const set = (species: string, moves: string[], item = ''): TeamSet =>
  ({ species, ability: '', item, moves, nature: 'Serious', evs: {} });

const tusk = set('Great Tusk', ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner']);
const gholdengo = set('Gholdengo', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot']);
const corviknight = set('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost']);
const kingambit = set('Kingambit', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance']);

describe('roles', () => {
  it('Corviknight: rimozione, pivot, wall fisico', () => {
    expect(detectRoles(corviknight)).toEqual(['removal', 'pivot', 'physicalWall']);
  });

  it('Great Tusk: rimozione, wallbreaker, wall fisico', () => {
    expect(detectRoles(tusk)).toEqual(['removal', 'wallbreaker', 'physicalWall']);
  });

  it('Gholdengo: setup e wallbreaker (lento: Nasty Plot non basta per essere sweeper)', () => {
    expect(detectRoles(gholdengo)).toEqual(['setup', 'wallbreaker']);
  });

  it('Kingambit: priorità', () => {
    expect(detectRoles(kingambit)).toContain('priority');
  });

  it('hazard; essere veloci o avere lo Scarf non è controllo velocità, ma per il team conta come velocità', () => {
    expect(detectRoles(set('Garchomp', ['Stealth Rock', 'Earthquake']))).toContain('hazards');
    expect(detectRoles(set('Garchomp', ['Stealth Rock', 'Earthquake']))).not.toContain('speed');
    expect(detectRoles(set('Gholdengo', ['Make It Rain'], 'Choice Scarf'))).not.toContain('speed');
    expect(teamRoles(set('Gholdengo', ['Make It Rain'], 'Choice Scarf'))).toContain('speed');
  });

  it('mosse vuote o sconosciute non rompono nulla', () => {
    expect(() => detectRoles(set('Great Tusk', ['', 'Notamove']))).not.toThrow();
    expect(detectRoles(set('Fakemon-Xyz', ['Defog']))).toEqual([]);
  });

  it('stile d\'attacco', () => {
    expect(attackStyle(tusk)).toBe('physical');
    expect(attackStyle(gholdengo)).toBe('special');
    expect(attackStyle(set('Toxapex', ['Toxic', 'Recover']))).toBe('none');
  });

  it('bisogni del team', () => {
    // Team incompleto: si giudica come balance; Great Tusk e Gholdengo coprono rimozione, minaccia offensiva e wall fisico
    expect(teamNeeds([tusk, gholdengo]).missing.map(m => m.need)).toEqual(['hazards', 'pivot', 'speed', 'priority', 'specialWall']);
    expect(teamNeeds([tusk, gholdengo]).needStyle).toBeNull();
    // Squilibrio solo con almeno 4 attaccanti tutti dello stesso tipo (come nel voto)
    expect(teamNeeds([tusk, kingambit]).needStyle).toBeNull();
    const physical = ['Great Tusk', 'Kingambit', 'Dragonite', 'Garchomp'].map(n => set(n, ['Earthquake', 'Close Combat']));
    expect(teamNeeds(physical).needStyle).toBe('special');
  });
});

describe('sweeper', () => {
  it('fisici e speciali', () => {
    expect(detectRoles(kingambit)).toContain('physicalSweeper');
    expect(detectRoles(set('Dragapult', ['Dragon Darts', 'U-turn']))).toContain('physicalSweeper');
    expect(detectRoles(tusk)).not.toContain('physicalSweeper');
    expect(detectRoles(corviknight).some(r => r.endsWith('Sweeper'))).toBe(false);
  });

  it('un attaccante lento senza setup non è sweeper', () => {
    expect(detectRoles(set('Kingambit', ['Kowtow Cleave', 'Sucker Punch']))).not.toContain('physicalSweeper');
  });

  it('lento con un setup che alza solo l\'attacco: non è sweeper (Magearna con Calm Mind, Ursaluna con Swords Dance)', () => {
    expect(detectRoles(set('Magearna', ['Fleur Cannon', 'Flash Cannon', 'Calm Mind', 'Volt Switch']))).not.toContain('specialSweeper');
    expect(detectRoles(set('Ursaluna', ['Facade', 'Earthquake', 'Fire Punch', 'Swords Dance']))).not.toContain('physicalSweeper');
  });

  it('un setup che alza la velocità basta (Dragon Dance, Quiver Dance anche senza velocità alta)', () => {
    expect(detectRoles(set('Dragonite', ['Dragon Dance', 'Outrage', 'Earthquake', 'Fire Punch']))).toContain('physicalSweeper');
    expect(detectRoles(set('Lilligant', ['Quiver Dance', 'Petal Dance', 'Giga Drain', 'Sleep Powder']))).toContain('specialSweeper');
    expect(detectRoles(set('Lilligant', ['Petal Dance', 'Giga Drain', 'Sleep Powder', 'Synthesis']))).not.toContain('specialSweeper');
  });

  it('setup più una mossa con priorità basta (Kingambit con Swords Dance e Sucker Punch)', () => {
    expect(detectRoles(kingambit)).toContain('physicalSweeper');
  });

  it("un'abilità che raddoppia la velocità basta (Excadrill con Sand Rush)", () => {
    const excadrill: TeamSet = { ...set('Excadrill', ['Earthquake', 'Iron Head', 'Rapid Spin', 'Swords Dance']), ability: 'Sand Rush' };
    expect(detectRoles(excadrill)).toContain('physicalSweeper');
    expect(detectRoles({ ...excadrill, ability: 'Mold Breaker' })).not.toContain('physicalSweeper');
  });
});
