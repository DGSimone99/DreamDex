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

describe('preset ritoccato tra le mosse più usate', () => {
  it('il ritocco usa solo mosse e abilità più usate, al massimo 2 modifiche, e non abbassa il voto', async () => {
    const { tuneSet, MAX_TUNES } = await import('../../src/engine/bestPreset');
    const { commonChoices } = await import('../../src/engine/common');
    const { fillData } = await import('../fixtures/fillData');
    // Preset di Garchomp senza Stealth Rock, in un team senza hazard: tra le più usate c'è Stealth Rock
    const preset = { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Fire Fang'] };
    const team = [preset, ...['Dragapult', 'Weavile', 'Kingambit', 'Gholdengo', 'Iron Valiant'].map(name => set(name, ['Protect']))];
    const tuned = tuneSet(team, 0, fillData, 9);
    const common = commonChoices(fillData, preset);
    const commonMoves = new Set(common.moves.map(c => c.name));
    const added = tuned.moves.filter(m => !preset.moves.includes(m));
    for (const move of added) expect(commonMoves.has(move), move).toBe(true);
    const changes = added.length + (tuned.ability !== preset.ability ? 1 : 0);
    expect(changes).toBeLessThanOrEqual(MAX_TUNES);
    expect(tuned.moves).toContain('Stealth Rock');
    const grade = (s: TeamSet) => rateTeam([s, ...team.slice(1)], fillData, 'en')!.overall;
    expect(grade(tuned)).toBeGreaterThan(grade(preset));
  });

  it('senza statistiche il preset resta com’è', async () => {
    const { tuneSet } = await import('../../src/engine/bestPreset');
    const team = [set('Garchomp', ['Earthquake'])];
    expect(tuneSet(team, 0, { stats: null, sets: {} }, 9)).toBe(team[0]);
  });

  it('con Custom Skillset le mosse più usate valgono anche se non imparabili', async () => {
    const { tuneSet } = await import('../../src/engine/bestPreset');
    const { fillData } = await import('../fixtures/fillData');
    // Le mosse più usate di Garchomp prese da un Pokémon che non le impara: con Custom Skillset si possono usare
    const member = { ...emptySet('Garchomp'), customSkillset: true, moves: ['Splash', 'Splash', 'Splash', 'Splash'] };
    const team = [member, ...['Dragapult', 'Weavile', 'Kingambit'].map(name => set(name, ['Protect']))];
    const tuned = tuneSet(team, 0, fillData, 9);
    expect(tuned.moves.filter(m => m !== 'Splash').length).toBeGreaterThan(0);
  });
});
