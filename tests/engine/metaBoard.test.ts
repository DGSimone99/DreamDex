import { describe, expect, it } from 'vitest';
import { metaBoard, metaProfile } from '../../src/engine/metaBoard';
import { fixtureStats } from '../fixtures/data';

describe('metaBoard', () => {
  it('classifica: in ordine di uso, al massimo size, con tipi', () => {
    const board = metaBoard(fixtureStats, [], 3);
    expect(board.top.map(e => [e.rank, e.name])).toEqual([[1, 'Great Tusk'], [2, 'Gholdengo'], [3, 'Kingambit']]);
    expect(board.top[0].types).toEqual(['Ground', 'Fighting']);
  });

  it('meno Pokémon di size: tutti quelli che ci sono, senza i nomi che non esistono', () => {
    const top = metaBoard(fixtureStats, []).top;
    expect(top).toHaveLength(Object.keys(fixtureStats.pokemon).length - 1);
    expect(top.map(e => e.name)).not.toContain('Fakemon-Xyz');
  });

  it('team: posizione e uso; fuori dai N rank null; assente usage null; media sui presenti', () => {
    const board = metaBoard(fixtureStats, [{ species: 'Great Tusk', item: '' }, { species: 'Toxapex', item: '' }, { species: 'Magikarp', item: '' }], 3);
    expect(board.team).toEqual([
      { name: 'Great Tusk', rank: 1, usage: 0.3 },
      { name: 'Toxapex', rank: null, usage: 0.1 },
      { name: 'Magikarp', rank: null, usage: null },
    ]);
    expect(board.average).toBeCloseTo(0.2);
  });

  it('mega da strumento: cerca il nome in battaglia', () => {
    const stats = { ...fixtureStats, pokemon: { ...fixtureStats.pokemon, 'Scizor-Mega': { ...fixtureStats.pokemon['Toxapex'], usage: 0.05 } } };
    const board = metaBoard(stats, [{ species: 'Scizor', item: 'Scizorite' }]);
    expect(board.team[0]).toMatchObject({ name: 'Scizor-Mega', usage: 0.05 });
  });

  it('senza statistiche: niente classifica, team con usage null', () => {
    expect(metaBoard(null, [{ species: 'Great Tusk', item: '' }])).toEqual({ top: [], team: [{ name: 'Great Tusk', rank: null, usage: null }], average: null });
  });
});

describe('metaProfile', () => {
  it('strumento, abilità, 4 mosse col tipo, 5 compagni', () => {
    const entry = fixtureStats.pokemon['Great Tusk'];
    const p = metaProfile(fixtureStats, 'Great Tusk')!;
    expect(p).toMatchObject({ name: 'Great Tusk', rank: 1, usage: 0.3, item: { name: 'Booster Energy', pct: entry.items.boosterenergy }, ability: { name: 'Protosynthesis', pct: 1 } });
    expect(p.moves.map(m => m.name)).toEqual(['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner']);
    expect(p.moves[0]).toEqual({ name: 'Headlong Rush', type: 'Ground', pct: entry.moves.headlongrush });
    expect(p.mates.slice(0, 2)).toEqual(['Gholdengo', 'Kingambit']);
    expect(p.mates.length).toBeLessThanOrEqual(5);
  });

  it('assente dalle statistiche: null', () => {
    expect(metaProfile(fixtureStats, 'Magikarp')).toBeNull();
    expect(metaProfile(null, 'Great Tusk')).toBeNull();
  });
});
