import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { memberIssues } from '../../src/engine/rating';
import { unmetBeneficiaries } from '../../src/engine/synergy';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature: 'Serious', evs: {}, ...extra });

describe('Membro debole, condizioni', () => {
  it('Teleport da solo non salva un membro debole', () => {
    const raticate = set('Raticate', '', 'Guts', ['Teleport']);
    const team = [raticate];
    const issues = memberIssues(team, 'it', analyzeTeam(team, fixtureData).needs);
    expect(issues.some(i => i.catalog === 'weakMember')).toBe(true);
  });

  it('Solar Beam con Power Herb e Dry Skin non "hanno bisogno" del meteo', () => {
    expect(unmetBeneficiaries([set('Venusaur', 'Power Herb', 'Overgrow', ['Solar Beam'])])).toEqual([]);
    expect(unmetBeneficiaries([set('Toxicroak', 'Life Orb', 'Dry Skin', ['Gunk Shot'])])).toEqual([]);
    // Senza Power Herb Solar Beam vuole il sole
    expect(unmetBeneficiaries([set('Venusaur', 'Leftovers', 'Overgrow', ['Solar Beam'])])).not.toEqual([]);
  });
});
