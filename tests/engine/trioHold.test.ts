import { describe, expect, it } from 'vitest';
import { heldByOf, teamCores } from '../../src/engine/cores';
import { emptySet } from '../../src/engine/sets';

// Il classico Fuoco / Acqua / Erba: sulla tabella dei tipi si parano a giro
const team = ['Heatran', 'Toxapex', 'Rillaboom'].map(emptySet);

describe('trio: chi para deve reggere davvero', () => {
  it('senza dati di Difesa resta la tabella dei tipi', () => {
    expect(teamCores(team).some(core => core.members.length === 3)).toBe(true);
  });
  it('se nessuno regge davvero i tipi parati, niente trio', () => {
    expect(teamCores(team, 2, heldByOf([])).some(core => core.members.length === 3)).toBe(false);
  });
  it('se chi para regge, il trio resta', () => {
    const all = (types: string[]) => types.map(type => ({ type, heldBy: ['Heatran', 'Toxapex', 'Rillaboom'] }));
    const rows = all(['Fire', 'Water', 'Grass', 'Ice', 'Bug', 'Steel', 'Fairy', 'Poison', 'Electric', 'Ground', 'Psychic', 'Flying', 'Fighting', 'Rock', 'Dragon', 'Dark', 'Ghost', 'Normal']);
    expect(teamCores(team, 2, heldByOf(rows)).some(core => core.members.length === 3)).toBe(true);
  });
});
