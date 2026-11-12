import { describe, expect, it } from 'vitest';
import { normalizeTeams, rankTournamentTeams, type TournamentTeam } from '../../src/engine/tournamentTeams';
import { emptySet } from '../../src/engine/sets';

const raw = (species: string, extra: object = {}) => ({
  species, gender: 'M', item: 'Leftovers', ability: 'Pressure', shiny: true,
  evs: { hp: 116, atk: 252, spe: 140 }, nature: 'Adamant', moves: ['Play Rough', 'Sucker Punch', 'Swords Dance', 'Thunder Punch'], ...extra,
});

describe('normalizeTeams', () => {
  it('tiene le squadre valide e scarta quelle rotte', () => {
    const teams = normalizeTeams([
      { name: 'NDWC VI WEEK 3', author: 'Lameflame', data: ['Mawile', 'Kingambit', 'Toxapex', 'Dragapult', 'Garchomp', 'Gholdengo'].map((s, i) => raw(i === 0 ? 'Mawile' : s, i === 0 ? { item: 'Mawilite' } : {})) },
      { name: 'rotta', author: 'x', data: 'x' },
    ]);
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('NDWC VI WEEK 3');
    expect(teams[0].author).toBe('Lameflame');
    expect(teams[0].team).toHaveLength(6);
    expect(teams[0].team[0].species).toBe('Mawile');
    expect(teams[0].team[0].moves).toHaveLength(4);
    expect(teams[0].team[0].evs).toEqual({ hp: 116, atk: 252, spe: 140 });
  });

  it('senza autore resta vuoto; set senza campi si riempie come emptySet', () => {
    const [t] = normalizeTeams([{ name: 'A', data: [{ species: 'Kingambit' }] }]);
    expect(t.author).toBe('');
    expect(t.team[0]).toMatchObject({ species: 'Kingambit', moves: [], nature: 'Serious', evs: {} });
    expect(t.team[0].ability).toBe(emptySet('Kingambit').ability);
  });

  it('rilegge il file salvato da fetch-data (campo team al posto di data)', () => {
    const [t] = normalizeTeams([{ name: 'A', author: 'b', team: [raw('Kingambit'), raw('Toxapex')] }]);
    expect(t.team.map(s => s.species)).toEqual(['Kingambit', 'Toxapex']);
  });

  it('non un array → []', () => {
    expect(normalizeTeams(null)).toEqual([]);
    expect(normalizeTeams({})).toEqual([]);
  });

  it('scarta squadre vuote o con più di 6 Pokémon', () => {
    expect(normalizeTeams([{ name: 'v', data: [] }, { name: 'g', data: Array.from({ length: 7 }, () => raw('Kingambit')) }])).toEqual([]);
  });
});

describe('rankTournamentTeams', () => {
  const team = (name: string, species: string[]): TournamentTeam => ({ name, author: '', team: species.map(emptySet) });
  const A = team('A', ['Garchomp', 'Great Tusk', 'Kingambit']);
  const B = team('B', ['Kingambit', 'Dragapult']);
  const C = team('C', ['Dragapult']);
  const D = team('D', ['Gholdengo']);

  it('ordina per Pokémon in comune, poi per ordine della fonte', () => {
    const ranked = rankTournamentTeams([C, B, A, D], ['Great Tusk', 'Kingambit', 'Toxapex'].map(emptySet));
    expect(ranked.map(r => r.entry.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(ranked[0].shared).toEqual([1, 2]);
    expect(ranked[1].shared).toEqual([0]);
    expect(ranked[2].shared).toEqual([]);
  });

  it('Charizard combacia con Charizard-Mega-Y', () => {
    const T = team('T', ['Charizard']);
    const mega = { ...emptySet('Charizard'), item: 'Charizardite Y' };
    expect(rankTournamentTeams([T], [mega])[0].shared).toEqual([0]);
    // E al contrario: la Mega scritta come specie combacia con la base
    expect(rankTournamentTeams([team('M', ['Charizard-Mega-Y'])], [emptySet('Charizard')])[0].shared).toEqual([0]);
  });

  it('forme diverse non combaciano: Rotom-Wash e Rotom-Heat, Ninetales e Ninetales-Alola, Landorus e Landorus-Therian', () => {
    for (const [theirs, mine] of [['Rotom-Wash', 'Rotom-Heat'], ['Ninetales', 'Ninetales-Alola'], ['Landorus', 'Landorus-Therian']]) {
      expect(rankTournamentTeams([team('T', [theirs])], [emptySet(mine)])[0].shared, `${theirs} / ${mine}`).toEqual([]);
      expect(rankTournamentTeams([team('T', [theirs])], [emptySet(theirs)])[0].shared, theirs).toEqual([0]);
    }
  });
});
