import { describe, expect, it } from 'vitest';
import { bestHit, FIRST_HIT_SHARE, FIRST_HIT_SHARE_RECOVERY } from '../../src/engine/damage';
import { firstHitShare, typedHits } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const nite = (ability: string, moves = ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch']) =>
  set('Dragonite', 'Heavy-Duty Boots', ability, moves, 'Impish', { hp: 252, def: 252 });
const chomp = set('Garchomp', 'Choice Band', 'Rough Skin', ['Stone Edge'], 'Jolly', { atk: 252, spe: 252 });

describe('effetti del primo colpo (Multiscale, Shadow Shield, Tera Shell, Air Balloon)', () => {
  it('la quota: 1/4, 1/2 con Sostenibilità almeno 50 (Roost)', () => {
    expect(firstHitShare(nite('Multiscale'))).toBe(FIRST_HIT_SHARE);
    expect(firstHitShare(nite('Multiscale', ['Roost', 'Dragon Dance', 'Extreme Speed', 'Earthquake']))).toBe(FIRST_HIT_SHARE_RECOVERY);
  });

  it('Multiscale conta un quarto del suo dimezzamento', () => {
    const on = bestHit(chomp, nite('Multiscale'))!.expected;
    const off = bestHit(chomp, nite('Inner Focus'))!.expected;
    // Pieno sarebbe off / 2: un quarto del guadagno
    expect(on).toBeCloseTo(off - FIRST_HIT_SHARE * (off - off / 2), 1);
    // Nella Difesa del membro: fra senza abilità e pieno
    expect(sum(typedHits(nite('Multiscale'), noStats).plain)).toBeLessThan(sum(typedHits(nite('Inner Focus'), noStats).plain));
  });

  it('Air Balloon: un quarto anche con il recupero (scoppiato non torna)', () => {
    const heatran = (item: string) => set('Heatran', item, 'Flash Fire', ['Magma Storm', 'Taunt', 'Stealth Rock', 'Earth Power'], 'Calm', { hp: 252, spd: 252 });
    const eq = set('Garchomp', 'Choice Band', 'Rough Skin', ['Earthquake'], 'Jolly', { atk: 252, spe: 252 });
    const plain = bestHit(eq, heatran('Leftovers'))!.expected;
    expect(bestHit(eq, heatran('Air Balloon'))!.expected).toBeCloseTo((1 - FIRST_HIT_SHARE) * plain, 2);
    expect(bestHit(eq, heatran('Air Balloon'), { firstHitShare: FIRST_HIT_SHARE_RECOVERY })!.expected).toBeCloseTo((1 - FIRST_HIT_SHARE) * plain, 2);
  });
});
