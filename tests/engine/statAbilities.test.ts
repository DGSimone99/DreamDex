import { describe, expect, it } from 'vitest';
import { effectiveStats } from '../../src/engine/dex';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { detectRoles } from '../../src/engine/roles';
import { memberPower } from '../../src/engine/power';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

describe('abilità che cambiano le statistiche', () => {
  it('Huge Power e Pure Power raddoppiano l\'Attacco (anche quella della Mega)', () => {
    expect(effectiveStats(set('Azumarill', 'Choice Band', 'Huge Power', ['Liquidation'])).atk).toBe(100);
    expect(effectiveStats(set('Azumarill', 'Choice Band', 'Thick Fat', ['Liquidation'])).atk).toBe(50);
    // Mega Medicham: Pure Power arriva con la Mega anche se il set ha Telepathy
    expect(effectiveStats(set('Medicham', 'Medichamite', 'Telepathy', ['Close Combat'])).atk).toBe(200);
  });

  it("Gorilla Tactics ×1,5 sull'Attacco (Hustle ×1,2: mira all'80%), Fur Coat ×2 Difesa, Ice Scales ×2 Difesa Speciale", () => {
    expect(effectiveStats(set('Darmanitan-Galar', 'Choice Scarf', 'Gorilla Tactics', ['Icicle Crash'])).atk).toBe(210);
    expect(effectiveStats(set('Durant', 'Choice Scarf', 'Hustle', ['Iron Head'])).atk).toBe(131);
    expect(effectiveStats(set('Persian-Alola', 'Leftovers', 'Fur Coat', ['Foul Play'])).def).toBe(120);
    expect(effectiveStats(set('Frosmoth', 'Heavy-Duty Boots', 'Ice Scales', ['Quiver Dance'])).spd).toBe(180);
  });

  it('la forza e i ruoli usano le statistiche effettive', () => {
    const pure = memberPower(set('Medicham', 'Medichamite', 'Pure Power', ['Close Combat', 'Zen Headbutt']))!;
    const plain = memberPower(set('Medicham', '', 'Pure Power', ['Close Combat', 'Zen Headbutt']))!;
    expect(pure.offense).toBeGreaterThan(90);
    expect(pure.power).toBeGreaterThan(plain.power);
    // Huge Power raddoppia l'Attacco reale anche per i ruoli del set: 218 → 436 (soglia 300)
    const azumarill = (ability: string): TeamSet => ({ ...set('Azumarill', 'Choice Band', ability, ['Liquidation', 'Aqua Jet']), evs: { atk: 252 }, nature: 'Adamant' });
    expect(detectRoles(azumarill('Huge Power'), DEFAULT_RULES)).toContain('physicalBreaker');
    expect(detectRoles(azumarill('Thick Fat'), DEFAULT_RULES)).not.toContain('physicalBreaker');
  });
});
