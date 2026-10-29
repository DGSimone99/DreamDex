import { describe, expect, it } from 'vitest';
import { teamLinks } from '../../src/engine/teamLinks';
import { emptySet } from '../../src/engine/sets';
import type { TeamSet } from '../../src/engine/sets';

const mk = (species: string, moves: string[] = []): TeamSet => ({ ...emptySet(species), moves });

describe('teamLinks', () => {
  it('pivot: due pivot e un attaccante senza pivot', () => {
    const team = [mk('Scizor', ['U-turn']), mk('Landorus-Therian', ['U-turn']), mk('Garchomp', ['Earthquake'])];
    expect(teamLinks(team, ['Garchomp'])).toEqual([
      { kind: 'pivot', from: ['Scizor', 'Landorus-Therian'], to: ['Garchomp'], move: 'U-turn' },
    ]);
  });
  it('pivot: la mossa più usata, a pari merito la prima del team', () => {
    const team = [mk('Rotom-Wash', ['Volt Switch']), mk('Scizor', ['U-turn']), mk('Garchomp')];
    expect(teamLinks(team, ['Garchomp'])[0].move).toBe('Volt Switch');
    const team2 = [mk('Rotom-Wash', ['Volt Switch']), mk('Scizor', ['U-turn']), mk('Landorus-Therian', ['U-turn'])];
    expect(teamLinks(team2, [])[0].move).toBe('U-turn');
  });
  it('pivot: un solo pivot, nessun link', () => {
    expect(teamLinks([mk('Scizor', ['U-turn']), mk('Garchomp')], ['Garchomp'])).toEqual([]);
  });
  it('pivot senza attaccanti non-pivot: to vuoto', () => {
    const team = [mk('Scizor', ['U-turn']), mk('Landorus-Therian', ['U-turn'])];
    expect(teamLinks(team, ['Scizor'])).toEqual([
      { kind: 'pivot', from: ['Scizor', 'Landorus-Therian'], to: [], move: 'U-turn' },
    ]);
  });
  it('baton pass e shed tail', () => {
    const team = [mk('Ninjask', ['Baton Pass']), mk('Garchomp')];
    expect(teamLinks(team, ['Ninjask', 'Garchomp'])).toEqual([
      { kind: 'batonpass', from: ['Ninjask'], to: ['Garchomp'], move: 'Baton Pass' },
    ]);
    expect(teamLinks([mk('Ninjask', ['Baton Pass'])], ['Ninjask'])[0].to).toEqual([]);
    expect(teamLinks([mk('Orthworm', ['Shed Tail'])], [])[0]).toMatchObject({ kind: 'batonpass', move: 'Shed Tail' });
  });
  it('wish', () => {
    expect(teamLinks([mk('Blissey', ['Wish'])], [])).toEqual([
      { kind: 'wish', from: ['Blissey'], to: [], move: 'Wish' },
    ]);
  });
  it('phazer dopo gli hazard', () => {
    const team = [mk('Garchomp', ['Stealth Rock']), mk('Hippowdon', ['Whirlwind'])];
    expect(teamLinks(team, [])).toEqual([
      { kind: 'phazer', from: ['Garchomp'], to: ['Hippowdon'], move: 'Whirlwind' },
    ]);
  });
  it('phazer: stesso membro con entrambi, nessun link', () => {
    expect(teamLinks([mk('Skarmory', ['Stealth Rock', 'Whirlwind']), mk('Garchomp')], [])).toEqual([]);
  });
  it('set vuoti ignorati, team senza link', () => {
    expect(teamLinks([mk(''), mk('Garchomp', ['Earthquake'])], ['Garchomp'])).toEqual([]);
    expect(teamLinks([], [])).toEqual([]);
  });
  it('ordine: pivot, batonpass, wish, phazer', () => {
    const team = [mk('Scizor', ['U-turn', 'Stealth Rock']), mk('Landorus-Therian', ['U-turn', 'Roar']), mk('Ninjask', ['Baton Pass']), mk('Blissey', ['Wish'])];
    expect(teamLinks(team, []).map(l => l.kind)).toEqual(['pivot', 'batonpass', 'wish', 'phazer']);
  });
  it('pivot: to è solo il primo attaccante non pivot', () => {
    const team = [mk('Scizor', ['U-turn']), mk('Landorus-Therian', ['U-turn']), mk('Garchomp'), mk('Dragapult')];
    expect(teamLinks(team, ['Garchomp', 'Dragapult'])[0].to).toEqual(['Garchomp']);
  });
  it('pivot: conta ogni mossa pivot di ogni membro', () => {
    const team = [mk('Rotom-Wash', ['U-turn', 'Volt Switch']), mk('Scizor', ['Volt Switch']), mk('Landorus-Therian', ['Volt Switch'])];
    expect(teamLinks(team, [])[0].move).toBe('Volt Switch');
  });
  it('Haze non è un phazer', () => {
    expect(teamLinks([mk('Toxapex', ['Haze']), mk('Garchomp', ['Stealth Rock'])], [])).toEqual([]);
  });
  it('Shed Tail dà pivot e batonpass insieme', () => {
    const team = [mk('Orthworm', ['Shed Tail']), mk('Scizor', ['U-turn'])];
    expect(teamLinks(team, []).map(l => l.kind)).toEqual(['pivot', 'batonpass']);
  });
  it('due Wish, due link', () => {
    expect(teamLinks([mk('Blissey', ['Wish']), mk('Clefable', ['Wish'])], []).map(l => l.kind)).toEqual(['wish', 'wish']);
  });
});
