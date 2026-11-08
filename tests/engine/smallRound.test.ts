import { describe, expect, it } from 'vitest';
import { getMove, hasPriorityAttack, movePriority } from '../../src/engine/dex';
import { speedOptions } from '../../src/engine/speedArea';
import { defensiveSetup } from '../../src/engine/defense';
import { setupBoosts } from '../../src/engine/setupBoosts';
import { rateTeam } from '../../src/engine/rating';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ species, item, ability, moves, nature: 'Serious', evs: {} });

describe('giro dei punti piccoli', () => {
  it('1.22: la priorità dalle abilità (Gale Wings, Triage)', () => {
    const talon = set('Talonflame', 'Heavy-Duty Boots', 'Gale Wings', ['Brave Bird', 'Flare Blitz']);
    expect(movePriority(talon, getMove('Brave Bird')!)).toBe(1);
    expect(movePriority(talon, getMove('Flare Blitz')!)).toBe(0);
    expect(hasPriorityAttack(talon)).toBe(true);
    expect(hasPriorityAttack(set('Comfey', 'Leftovers', 'Triage', ['Draining Kiss']))).toBe(true);
    expect(hasPriorityAttack(set('Comfey', 'Leftovers', 'Natural Cure', ['Draining Kiss']))).toBe(false);
  });

  it('1.23: setup mancanti, Geomancy solo con Power Herb, Stored Power con tutti gli aumenti', () => {
    const kommo = set('Kommo-o', 'Throat Spray', 'Bulletproof', ['Clangorous Soul', 'Clanging Scales']);
    expect(speedOptions(kommo, [kommo]).some(o => o.condition === 'setup')).toBe(true);
    expect(defensiveSetup(kommo)?.move).toBe('Clangorous Soul');
    const xern = (item: string) => set('Xerneas', item, 'Fairy Aura', ['Geomancy', 'Moonblast']);
    expect(speedOptions(xern('Power Herb'), [xern('Power Herb')]).some(o => o.condition === 'setup')).toBe(true);
    expect(speedOptions(xern('Leftovers'), [xern('Leftovers')]).some(o => o.condition === 'setup')).toBe(false);
    expect(setupBoosts(set('Espeon', 'Leftovers', 'Magic Bounce', ['Calm Mind', 'Stored Power']))?.boosts).toMatchObject({ spa: 1, spd: 1 });
    // Calm Mind (+1 +1) batte Iron Defense (+2): fa salire anche le altre mosse speciali
    expect(setupBoosts(set('Iron Crown', 'Leftovers', 'Quark Drive', ['Calm Mind', 'Stored Power', 'Tachyon Cutter', 'Iron Defense']))?.move).toBe('Calm Mind');
  });

  it('1.25: un team di 6 con una specie sconosciuta è provvisorio', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Toxapex'].map(n => set(n, '', '', ['Protect']));
    expect(rateTeam([...team, set('Pokémon Inventato', '', '', ['Tackle'])], fixtureData)!.provisional).toBe(true);
  });
});

import { measuredSubRoles } from '../../src/engine/subRoles';
import { areaPointsOf } from '../../src/engine/teamGain';

describe('giro dei punti piccoli (2)', () => {
  it('1.24: le mosse di stato con Prankster non toccano i tipi Buio', () => {
    const klefki = (ability: string) => set('Klefki', 'Leftovers', ability, ['Thunder Wave', 'Spikes', 'Play Rough', 'Foul Play']);
    const value = (ability: string) => Object.values(measuredSubRoles(klefki(ability), [klefki(ability)], fixtureData)).reduce((a, b) => a + (b ?? 0), 0);
    expect(value('Prankster')).toBeLessThan(value('Magician'));
  });

  it('1.26: negli scambi i Ruoli hanno i loro punti (malus e bonus dei ruoli)', () => {
    const base = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Toxapex'].map(n => set(n, '', '', ['Protect']));
    const before = rateTeam([...base, set('Corviknight', '', '', ['Brave Bird'])], fixtureData)!;
    const after = rateTeam([...base, set('Corviknight', '', '', ['Brave Bird', 'Stealth Rock'])], fixtureData)!;
    const net = (r: typeof before) => r.roles.bonuses.reduce((a, i) => a + i.points, 0) - r.roles.failures.reduce((a, i) => a + i.points, 0);
    expect(areaPointsOf(before, after).roles).toBe(net(after) - net(before));
    expect(net(after) - net(before)).toBeGreaterThan(0);
  });
});
