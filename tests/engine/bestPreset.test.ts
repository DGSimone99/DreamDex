import { describe, expect, it } from 'vitest';
import { bestPreset, bestPresets } from '../../src/engine/bestPreset';
import type { EngineData } from '../../src/engine/data';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(species), moves, item });

describe('preset migliore', () => {
  const weak = set('Garchomp', ['Splash']);
  const strong = set('Garchomp', ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'], 'Rocky Helmet');
  const team = [set('Garchomp', ['Tackle']), set('Corviknight', ['Roost', 'Brave Bird', 'U-turn', 'Body Press'], 'Leftovers')];

  it('sceglie il preset con il voto del team più alto, tenendo preferito e Custom Skillset', () => {
    const data: EngineData = { stats: null, sets: {}, presets: { Garchomp: [
      { name: 'Debole', format: 'gen9nationaldex', set: weak },
      { name: 'Forte', format: 'gen9nationaldex', set: strong },
    ] } };
    const member = { ...team[0], favorite: true, customSkillset: true };
    const best = bestPreset([member, team[1]], 0, data);
    expect(best.index).toBe(1);
    expect(best.set).toMatchObject({ moves: strong.moves, favorite: true, customSkillset: true });
    expect(best.overall).toBe(rateTeam([best.set, team[1]], data, 'en')!.overall);
  });

  it('a pari voto vince il primo in ordine', () => {
    const data: EngineData = { stats: null, sets: {}, presets: { Garchomp: [
      { name: 'Primo', format: 'gen9nationaldex', set: strong },
      { name: 'Copia', format: 'gen9nationaldex', set: { ...strong } },
    ] } };
    expect(bestPreset(team, 0, data).index).toBe(0);
  });

  it('senza preset non cambia niente; per tutto il team tocca solo chi ne ha', () => {
    const data: EngineData = { stats: null, sets: {}, presets: { Garchomp: [{ name: 'Forte', format: 'gen9nationaldex', set: strong }] } };
    expect(bestPreset(team, 1, data).index).toBeNull();
    const next = bestPresets(team, data);
    expect(next[0].moves).toEqual(strong.moves);
    expect(next[1]).toBe(team[1]);
  });
});
