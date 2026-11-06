import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { teraBonus, memberIssues } from '../../src/engine/rating';
import { unmetBeneficiaries } from '../../src/engine/synergy';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature: 'Serious', evs: {}, ...extra });
const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };

describe('Tera, membro debole, condizioni', () => {
  it('il bonus Tera non conta se il tipo del membro resiste già', () => {
    // Tre deboli allo Spettro; Kingambit (Buio/Acciaio) resiste già: Tera Dark non cambia niente
    const ghostWeak = ['Gholdengo', 'Dragapult', 'Iron Valiant'].map(n => set(n, '', '', ['Protect']));
    const gambit = set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave'], { teraType: 'Dark' });
    const team = [...ghostWeak, gambit];
    const texts = teraBonus(team, analyzeTeam(team, gen9), 3, 'it').map(i => i.text);
    expect(texts.some(t => t.includes('Kingambit') && t.includes('Spettro'))).toBe(false);
    // Lo stesso Tera su chi è debole allo Spettro conta
    const ghold = { ...ghostWeak[0], teraType: 'Dark' };
    const team2 = [ghold, ...ghostWeak.slice(1), gambit];
    expect(teraBonus(team2, analyzeTeam(team2, gen9), 3, 'it').some(i => i.text.includes('Gholdengo'))).toBe(true);
  });

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
