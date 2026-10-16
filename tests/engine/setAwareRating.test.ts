import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { fixtureData } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const area = (team: TeamSet[], key: string, data: EngineData = fixtureData) => rateTeam(team, data)!.areas.find(a => a.key === key)!.value!;
const penalties = (team: TeamSet[], data: EngineData = fixtureData) => rateTeam(team, data)!.penalty.items;
const entry = (usage: number): SpeciesStats => ({ usage, count: 100, abilities: {}, items: {}, teraTypes: {}, spreads: {}, moves: {}, teammates: {}, checks: {} });

describe('copertura pesata da chi colpisce', () => {
  it('un Close Combat di Alakazam copre meno di uno di Great Tusk', () => {
    expect(area([withMoves('Alakazam', ['Close Combat'])], 'coverage'))
      .toBeLessThan(area([withMoves('Great Tusk', ['Close Combat'])], 'coverage'));
  });
});

describe('membri deboli e fuori dal meta', () => {
  const data = (pokemon: Record<string, SpeciesStats>): EngineData => ({
    stats: { meta: { month: '2026-09', cutoff: 1630, battles: 1 }, pokemon }, sets: {},
  });
  const team = [withMoves('Pelipper', ['Hurricane', 'U-turn']), withMoves('Great Tusk', ['Headlong Rush'])];

  it('debole e poco usato: −3', () => {
    expect(penalties(team, data({ 'Great Tusk': entry(0.3) })))
      .toContainEqual({ text: 'Pelipper è debole e poco usato in questo formato', points: 3 });
  });

  it('debole ma usato nel formato: nessuna penalità', () => {
    expect(penalties(team, data({ Pelipper: entry(0.05), 'Great Tusk': entry(0.3) })).map(i => i.text).join(' | ')).not.toMatch(/Pelipper/);
  });

  it('senza statistiche non si penalizza', () => {
    expect(penalties(team, { stats: null, sets: null }).map(i => i.text).join(' | ')).not.toMatch(/debole e poco usato/);
  });

  it('il coaching lo segnala', () => {
    const problems = coachTeam(team, DEFAULT_FORMAT, data({ 'Great Tusk': entry(0.3) })).problems;
    expect(problems).toContainEqual(expect.objectContaining({ severity: 'minor', category: 'roles', text: 'Pelipper è debole e poco usato in questo formato' }));
  });
});

describe('team tutto fisico o tutto speciale', () => {
  const special = ['Tapu Lele', 'Hydreigon', 'Heatran', 'Volcarona'].map(s => withMoves(s, ['Draco Meteor', 'Earth Power']));
  const walls = [withMoves('Blissey', ['Soft-Boiled', 'Toxic']), withMoves('Toxapex', ['Recover', 'Haze'])];

  it('almeno 4 attaccanti e nessuno fisico: −3', () => {
    expect(penalties([...special, ...walls])).toContainEqual({ text: 'Nessun attaccante fisico', points: 3 });
  });

  it('con 3 attaccanti non si segnala', () => {
    expect(penalties([...special.slice(0, 3), ...walls]).map(i => i.text)).not.toContain('Nessun attaccante fisico');
  });

  it('un attaccante fisico basta', () => {
    expect(penalties([...special, withMoves('Great Tusk', ['Headlong Rush']), walls[0]]).map(i => i.text)).not.toContain('Nessun attaccante fisico');
  });

  it('il coaching lo segnala tra i ruoli', () => {
    expect(coachTeam([...special, ...walls], DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual(expect.objectContaining({ severity: 'minor', category: 'roles', text: 'Nessun attaccante fisico' }));
  });
});
