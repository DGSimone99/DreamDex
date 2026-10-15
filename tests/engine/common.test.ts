import { describe, expect, it } from 'vitest';
import { commonChoices } from '../../src/engine/common';
import type { EngineData } from '../../src/engine/data';
import { emptySet } from '../../src/engine/sets';
import type { SpeciesStats, StatsData } from '../../src/engine/stats';

const entry: SpeciesStats = {
  usage: 0.2, count: 100, teraTypes: { Ground: 0.45, Steel: 0.2, Fire: 0.01 }, teammates: {}, checks: {},
  abilities: { roughskin: 0.9, sandveil: 0.1 },
  items: { rockyhelmet: 0.4, leftovers: 0.3, choicescarf: 0.02 },
  moves: { earthquake: 0.99, stealthrock: 0.7, swordsdance: 0.03 },
  spreads: { 'Jolly:0/252/0/0/4/252': 0.3, 'Jolly:4/252/0/0/0/252': 0.2, 'Impish:252/0/164/0/0/92': 0.1 },
};
const stats: StatsData = { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: { Garchomp: entry } };

describe('scelte più usate per un membro', () => {
  it('dalle statistiche del formato, in ordine di uso, sotto il 5% escluse; nature sommate dagli spread', () => {
    const common = commonChoices({ stats, sets: null }, emptySet('Garchomp'));
    expect(common.moves).toEqual([{ name: 'Earthquake', share: 0.99 }, { name: 'Stealth Rock', share: 0.7 }]);
    expect(common.items).toEqual([{ name: 'Rocky Helmet', share: 0.4 }, { name: 'Leftovers', share: 0.3 }]);
    expect(common.abilities).toEqual([{ name: 'Rough Skin', share: 0.9 }, { name: 'Sand Veil', share: 0.1 }]);
    expect(common.natures).toEqual([{ name: 'Jolly', share: 0.5 }, { name: 'Impish', share: 0.1 }]);
    expect(common.teraTypes).toEqual([{ name: 'Ground', share: 0.45 }, { name: 'Steel', share: 0.2 }]);
  });

  it('spread pronti: i più usati del formato, poi quelli dei preset non già presenti', () => {
    const preset = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } };
    const other = { ...emptySet('Garchomp'), moves: ['Earthquake'], nature: 'Adamant', evs: { hp: 252, atk: 252, spd: 4 }, teraType: 'Fire' };
    const data: EngineData = { stats, sets: null, presets: { Garchomp: [
      { name: 'A', format: 'gen9ou', set: preset }, { name: 'B', format: 'gen9ou', set: other },
    ] } };
    expect(commonChoices(data, emptySet('Garchomp')).spreads).toEqual([
      { nature: 'Jolly', evs: { atk: 252, spd: 4, spe: 252 }, share: 0.3 },
      { nature: 'Jolly', evs: { hp: 4, atk: 252, spe: 252 }, share: 0.2 },
      { nature: 'Impish', evs: { hp: 252, def: 164, spe: 92 }, share: 0.1 },
      { nature: 'Adamant', evs: { hp: 252, atk: 252, spd: 4 }, share: null },
    ]);
  });

  it('senza statistiche: le scelte dei preset Smogon, senza percentuale', () => {
    const preset = { ...emptySet('Garchomp'), item: 'Life Orb', ability: 'Rough Skin', nature: 'Jolly', moves: ['Earthquake', 'Scale Shot'] };
    const data: EngineData = { stats: null, sets: null, presets: { Garchomp: [{ name: 'SD', format: 'gen9ou', set: preset }] } };
    const common = commonChoices(data, emptySet('Garchomp'));
    expect(common.moves).toEqual([{ name: 'Earthquake', share: null }, { name: 'Scale Shot', share: null }]);
    expect(common.items).toEqual([{ name: 'Life Orb', share: null }]);
    expect(common.natures).toEqual([{ name: 'Jolly', share: null }]);
    expect(common.spreads).toEqual([{ nature: 'Jolly', evs: {}, share: null }]);
  });

  it('nessun dato: nessuna scelta', () => {
    expect(commonChoices({ stats: null, sets: null }, emptySet('Garchomp')).moves).toEqual([]);
  });
});
