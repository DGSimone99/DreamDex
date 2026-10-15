import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import { attackStyle, detectRoles, teamNeeds } from '../../src/engine/roles';

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

  it('Gholdengo: setup e wallbreaker', () => {
    expect(detectRoles(gholdengo)).toEqual(['setup', 'wallbreaker', 'specialSweeper']);
  });

  it('Kingambit: priorità', () => {
    expect(detectRoles(kingambit)).toContain('priority');
  });

  it('hazard e velocità', () => {
    expect(detectRoles(set('Garchomp', ['Stealth Rock', 'Earthquake']))).toEqual(
      expect.arrayContaining(['hazards', 'speed']),
    );
    expect(detectRoles(set('Gholdengo', ['Make It Rain'], 'Choice Scarf'))).toContain('speed');
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
    expect(teamNeeds([tusk, gholdengo])).toEqual({
      missingRoles: ['hazards', 'pivot', 'priority', 'speed', 'physicalSweeper', 'specialWall'],
      needStyle: null,
    });
    expect(teamNeeds([tusk, kingambit]).needStyle).toBe('special');
  });
});

describe('sweeper', () => {
  it('fisici e speciali', () => {
    expect(detectRoles(kingambit)).toContain('physicalSweeper');
    expect(detectRoles(set('Dragapult', ['Dragon Darts', 'U-turn']))).toContain('physicalSweeper');
    expect(detectRoles(gholdengo)).toContain('specialSweeper');
    expect(detectRoles(tusk)).not.toContain('physicalSweeper');
    expect(detectRoles(corviknight).some(r => r.endsWith('Sweeper'))).toBe(false);
  });

  it('un attaccante lento senza setup non è sweeper', () => {
    expect(detectRoles(set('Kingambit', ['Kowtow Cleave', 'Sucker Punch']))).not.toContain('physicalSweeper');
  });
});
