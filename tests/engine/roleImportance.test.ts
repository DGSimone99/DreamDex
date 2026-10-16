import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { DESIRABLE_ROLES, ESSENTIAL_ROLES, roleCoverage, teamNeeds, type Role } from '../../src/engine/roles';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(species), moves, item });

describe('importanza dei ruoli', () => {
  it('essenziali: hazard, rimozione, pivot, velocità; la priorità è solo utile', () => {
    expect(ESSENTIAL_ROLES).toEqual(['hazards', 'removal', 'pivot', 'speed']);
    expect(DESIRABLE_ROLES).toContain('priority');
  });

  it('copertura: essenziali 1, utili 0,5; uno sweeper qualunque basta', () => {
    const all = new Set<Role>(['hazards', 'removal', 'pivot', 'speed', 'wallbreaker', 'priority', 'physicalSweeper', 'physicalWall', 'specialWall']);
    expect(roleCoverage(all)).toBe(1);
    const noPriority = new Set([...all].filter(r => r !== 'priority'));
    expect(roleCoverage(noPriority)).toBeCloseTo(6 / 6.5);
    const noPivot = new Set([...all].filter(r => r !== 'pivot'));
    expect(roleCoverage(noPivot)).toBeCloseTo(5.5 / 6.5);
  });

  it('uno sweeper fisico basta: lo speciale non risulta mancante', () => {
    const needs = teamNeeds([set('Dragonite', ['Dragon Dance', 'Outrage', 'Earthquake'])]);
    expect(needs.missingRoles).not.toContain('specialSweeper');
    expect(teamNeeds([set('Toxapex', ['Scald', 'Recover'])]).missingRoles).toEqual(expect.arrayContaining(['physicalSweeper', 'specialSweeper']));
  });

  it('il coaching non chiede la priorità', () => {
    const team = [set('Toxapex', ['Scald', 'Recover', 'Toxic Spikes']), set('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost'])];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti/);
    expect(texts).not.toMatch(/Priorità/);
  });
});
