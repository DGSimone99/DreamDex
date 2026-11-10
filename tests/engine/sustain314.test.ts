import { describe, expect, it } from 'vitest';
import { sustainParts, weatherRecovery } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ species, item, ability, moves, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } });

describe('controllo 2 punto 3.14', () => {
  it('il contraccolpo costa come Life Orb, per la quota degli attacchi', () => {
    const p = sustainParts(set('Talonflame', 'Heavy-Duty Boots', 'Gale Wings', ['Brave Bird', 'Flare Blitz', 'Roost', 'Swords Dance']), 1);
    expect(p.itemLoss).toBeCloseTo(0.1, 2);
    expect(p.itemLossFrom).toBe('Brave Bird');
    const half = sustainParts(set('Talonflame', 'Heavy-Duty Boots', 'Gale Wings', ['Brave Bird', 'U-turn', 'Roost', 'Swords Dance']), 1);
    expect(half.itemLoss).toBeCloseTo(0.05, 2);
  });

  it('Rock Head toglie il contraccolpo, non Steel Beam; Magic Guard tutto', () => {
    expect(sustainParts(set('Aerodactyl', '', 'Rock Head', ['Head Smash', 'Double-Edge']), 1).itemLoss).toBe(0);
    expect(sustainParts(set('Aggron', '', 'Rock Head', ['Steel Beam', 'Head Smash']), 1).itemLoss).toBeCloseTo(0.25, 3);
    expect(sustainParts(set('Clefable', '', 'Magic Guard', ['Steel Beam']), 1).itemLoss).toBe(0);
  });

  it('Moonlight & co. e Shore Up seguono il meteo del team', () => {
    expect(weatherRecovery('moonlight', [])).toBe(0.5);
    expect(weatherRecovery('synthesis', ['sun'])).toBeCloseTo(2 / 3);
    expect(weatherRecovery('morningsun', ['rain'])).toBe(0.25);
    expect(weatherRecovery('shoreup', ['sand'])).toBeCloseTo(2 / 3);
    expect(weatherRecovery('recover', ['sun'])).toBeNull();
  });

  it('Heal Order e Life Dew recuperano', () => {
    expect(sustainParts(set('Vespiquen', 'Leftovers', 'Pressure', ['Heal Order']), 1).recovery).toBeCloseTo(0.5625, 3);
    expect(sustainParts(set('Mew', '', 'Synchronize', ['Life Dew']), 1).recovery).toBeCloseTo(0.25, 3);
  });
});
