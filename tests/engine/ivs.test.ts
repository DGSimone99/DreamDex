import { describe, expect, it } from 'vitest';
import { presetSet } from '../../src/engine/bestPreset';
import { emptySet, exportShowdown, importShowdown, sameSet, type TeamSet } from '../../src/engine/sets';
import { speedStat } from '../../src/engine/speed';
import { statLines } from '../../src/engine/statCalc';

const chomp: TeamSet = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } };
const value = (set: TeamSet, stat: string, level?: number) => statLines(set, level).find(l => l.stat === stat)!.value;

describe('IV', () => {
  it('di norma 31; con 0 IV la statistica scende', () => {
    expect(value(chomp, 'spe')).toBe(333);
    expect(value({ ...chomp, ivs: { spe: 0 } }, 'spe')).toBe(299);
    expect(speedStat({ ...chomp, ivs: { spe: 0 } }).value).toBe(299);
  });

  it('al livello 50 i valori sono quelli del livello 50', () => {
    expect(value(chomp, 'spe', 50)).toBe(169);
    expect(value(chomp, 'hp', 50)).toBe(184);
    expect(value(chomp, 'hp')).toBe(358);
  });

  it('import ed export Showdown tengono gli IV', () => {
    const { sets } = importShowdown('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 HP / 252 Def\nIVs: 0 Atk / 0 Spe\nRelaxed Nature\n- Earthquake');
    expect(sets[0].ivs).toEqual({ atk: 0, spe: 0 });
    expect(exportShowdown(sets)).toContain('IVs: 0 Atk / 0 Spe');
    // Senza IV diversi da 31 la riga non c'è
    expect(exportShowdown([chomp])).not.toContain('IVs:');
  });

  it('applicare un preset tiene gli IV del membro; il preset si riconosce lo stesso', () => {
    const member = { ...chomp, ivs: { atk: 0 } };
    const applied = presetSet(member, chomp);
    expect(applied.ivs).toEqual({ atk: 0 });
    expect(sameSet(applied, chomp)).toBe(true);
  });
});
