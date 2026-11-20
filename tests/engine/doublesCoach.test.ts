import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { findProblems } from '../../src/engine/coach';
import { problemChanges } from '../../src/engine/coachFixes';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { fixtureData, fixtureStats } from '../fixtures/data';

const mk = (species: string, ability: string, moves: string[], item = ''): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } });
const entry = (moves: Record<string, number>): SpeciesStats =>
  ({ usage: 0.05, count: 100, abilities: {}, items: {}, moves, teraTypes: {}, spreads: {}, teammates: {}, checks: {} });
// Nelle statistiche Incineroar usa quasi sempre Flare Blitz
const stats = { ...fixtureStats, pokemon: { ...fixtureStats.pokemon, Incineroar: entry({ flareblitz: 0.9, fakeout: 0.95, knockoff: 0.6 }) } };
const doublesData: EngineData = { ...fixtureData, stats, formatId: 'natdexdoubles' };
const ouData: EngineData = { ...fixtureData, stats, formatId: 'ou' };
const doubles: Format = { ...DEFAULT_FORMAT, formatId: 'natdexdoubles' };

const pelipper = mk('Pelipper', 'Drizzle', ['Hurricane', 'Weather Ball', 'Protect']);
const kingdra = mk('Kingdra', 'Swift Swim', ['Muddy Water', 'Draco Meteor', 'Protect']);
const incineroar = mk('Incineroar', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']);
const dryIncineroar = mk('Incineroar', 'Intimidate', ['Fake Out', 'Darkest Lariat', 'Knock Off', 'Parting Shot']);
const torkoal = mk('Torkoal', 'Drought', ['Eruption', 'Heat Wave', 'Protect']);
const garchomp = mk('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Protect']);

const problems = (team: TeamSet[], data = doublesData, format = doubles) => findProblems(team, format, data, analyzeTeam(team, data), [], 'it');
const conditions = (team: TeamSet[], data = doublesData, format = doubles) => problems(team, data, format).filter(p => p.category === 'conditions');
const KEY = 'conditions:sabotage:Incineroar';

describe('doppio: il meteo contro nel coach', () => {
  it('la mossa non è nel set ma il Pokémon di solito la usa: il problema c\'è, col testo del malus', () => {
    const found = conditions([pelipper, kingdra, dryIncineroar]).filter(p => p.key === KEY);
    expect(found).toHaveLength(1);
    const malus = rateTeam([pelipper, kingdra, dryIncineroar], doublesData, 'it')!.penalty.items.find(i => i.catalog === 'weatherSabotage')!;
    expect(found[0].text).toBe(malus.text);
    expect(found[0].text).toContain('di solito');
    expect(found[0].size).toBe(malus.points);
  });

  it('con la mossa nel set: un solo problema per il membro, senza la nota doppia delle mosse indebolite', () => {
    const all = conditions([pelipper, kingdra, incineroar]);
    const about = all.filter(p => p.text.includes('Incineroar'));
    expect(about.map(p => p.key)).toEqual([KEY]);
    expect(about[0].text).not.toContain('di solito');
    expect(about[0].text).toBe(rateTeam([pelipper, kingdra, incineroar], doublesData, 'it')!.penalty.items.find(i => i.catalog === 'weatherSabotage')!.text);
  });

  it('chi porta l\'altro meteo non è un problema di sabotaggio: il voto non lo conta', () => {
    const team = [pelipper, torkoal, garchomp];
    expect(rateTeam(team, doublesData)!.penalty.items.filter(i => i.catalog === 'weatherSabotage')).toEqual([]);
    expect(conditions(team).filter(p => p.key.startsWith('conditions:sabotage:'))).toEqual([]);
  });

  it('i problemi di sabotaggio sono esattamente i malus del voto, uno per membro', () => {
    for (const team of [[pelipper, kingdra, incineroar], [pelipper, kingdra, dryIncineroar, garchomp], [torkoal, kingdra, incineroar]]) {
      const malus = rateTeam(team, doublesData, 'it')!.penalty.items.filter(i => i.catalog === 'weatherSabotage').map(i => `conditions:${i.key}`);
      const keys = conditions(team).map(p => p.key).filter(key => key.startsWith('conditions:sabotage:'));
      expect(keys).toEqual(malus);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('nel singolo i problemi sono quelli di sempre: la nota della mossa nel set, niente sabotaggio', () => {
    const withMove = conditions([pelipper, kingdra, incineroar], ouData, DEFAULT_FORMAT);
    expect(withMove.some(p => p.key.startsWith('conditions:sabotage:'))).toBe(false);
    expect(withMove.some(p => p.text.includes('Incineroar'))).toBe(true);
    // Senza la mossa nel set, nel singolo non c'è niente da dire
    const dry = conditions([pelipper, kingdra, dryIncineroar], ouData, DEFAULT_FORMAT);
    expect(dry.some(p => p.text.includes('Incineroar'))).toBe(false);
  });

  it('cambiare solo la mossa non risolve se il Pokémon di solito la usa; sostituire lui o chi porta il meteo sì', () => {
    const team = [pelipper, kingdra, incineroar];
    const changes = problemChanges(team, doubles, doublesData, problems(team), 'it');
    // Via Flare Blitz dal set: il malus resta (testo diverso, stesso problema)
    expect(changes([pelipper, kingdra, dryIncineroar]).solves).not.toContain(KEY);
    // Un altro al posto di Incineroar, o via la pioggia
    expect(changes([pelipper, kingdra, garchomp]).solves).toContain(KEY);
    expect(changes([garchomp, kingdra, incineroar]).solves).toContain(KEY);
  });
});
