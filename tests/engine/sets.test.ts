import { describe, expect, it } from 'vitest';
import {
  defaultSet, emptySet, exportShowdown, importShowdown, mostCommonSet, normalizeAnalysisSets, type TeamSet,
} from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

describe('set più comune', () => {
  it('Great Tusk dalla fixture', () => {
    expect(mostCommonSet(fixtureStats, 'Great Tusk')).toEqual({
      species: 'Great Tusk',
      item: 'Booster Energy',
      ability: 'Protosynthesis',
      moves: ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner'],
      nature: 'Jolly',
      evs: { atk: 252, def: 4, spe: 252 },
      teraType: 'Steel',
    });
  });

  it('nessun Tera se i dati dicono "nothing"', () => {
    expect(mostCommonSet(fixtureStats, 'Gholdengo')?.teraType).toBeUndefined();
  });

  it('null senza statistiche', () => {
    expect(mostCommonSet(null, 'Great Tusk')).toBeNull();
    expect(mostCommonSet(fixtureStats, 'Skarmory')).toBeNull();
  });
});

describe('set di default', () => {
  const skarmory: TeamSet = { species: 'Skarmory', item: 'Rocky Helmet', ability: 'Sturdy', moves: ['Spikes'], nature: 'Impish', evs: { hp: 252 } };

  it('statistiche → analisi → set vuoto', () => {
    expect(defaultSet(fixtureData, 'Great Tusk').item).toBe('Booster Energy');
    expect(defaultSet({ ...fixtureData, sets: { Skarmory: skarmory } }, 'Skarmory')).toEqual(skarmory);
    expect(defaultSet(fixtureData, 'Skarmory')).toEqual(emptySet('Skarmory'));
    expect(emptySet('Skarmory').ability).toBe('Keen Eye');
  });
});

describe('set delle analisi Smogon', () => {
  it('prende il primo set e la prima alternativa', () => {
    const raw = {
      Venusaur: {
        Tank: { moves: ['Giga Drain', 'Sludge Bomb', ['Earth Power', 'Leech Seed'], 'Synthesis'], ability: 'Chlorophyll', item: 'Venusaurite', nature: 'Modest', evs: { hp: 252, spa: 156, spe: 100 } },
        Other: { moves: ['Growth'], ability: 'Chlorophyll' },
      },
    };
    expect(normalizeAnalysisSets(raw)).toEqual({
      Venusaur: {
        species: 'Venusaur', item: 'Venusaurite', ability: 'Chlorophyll', nature: 'Modest',
        moves: ['Giga Drain', 'Sludge Bomb', 'Earth Power', 'Synthesis'], evs: { hp: 252, spa: 156, spe: 100 },
      },
    });
  });
});

describe('set delle analisi con più spread di EV', () => {
  it('prende il primo spread', () => {
    const raw = {
      Diancie: { Set: { moves: ['Diamond Storm'], evs: [{ atk: 28, spa: 228, spe: 252 }, { spa: 252, spd: 4, spe: 252 }] } },
    };
    expect(normalizeAnalysisSets(raw).Diancie.evs).toEqual({ atk: 28, spa: 228, spe: 252 });
  });
});

describe('Showdown', () => {
  const team: TeamSet[] = [
    { species: 'Great Tusk', item: 'Booster Energy', ability: 'Protosynthesis', moves: ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner'], nature: 'Jolly', evs: { atk: 252, def: 4, spe: 252 }, teraType: 'Steel' },
    { species: 'Corviknight', item: 'Leftovers', ability: 'Pressure', moves: ['Brave Bird', 'Defog', 'U-turn', 'Roost'], nature: 'Impish', evs: { hp: 252, def: 168, spd: 88 } },
  ];

  it('round-trip export → import', () => {
    const result = importShowdown(exportShowdown(team));
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual(team);
  });

  it('ignora le intestazioni ===, segnala blocchi illeggibili e Pokémon sconosciuti', () => {
    const text = [
      '=== [gen9nationaldex] Il mio team ===',
      '',
      'Corviknight @ Leftovers\nAbility: Pressure\n- Defog',
      '- Tackle',
      'Fakemon-Xyz\n- Tackle',
    ].join('\n\n');
    const result = importShowdown(text);
    expect(result.sets.map(s => s.species)).toEqual(['Corviknight', 'Fakemon-Xyz']);
    expect(result.errors).toEqual(['Blocco 2 non leggibile: "- Tackle"', 'Pokémon sconosciuto: Fakemon-Xyz']);
  });

  it('limita gli EV importati a 0–252', () => {
    const result = importShowdown('Great Tusk\nEVs: 999 Atk / 4 Def\n- Headlong Rush');
    expect(result.sets[0].evs).toEqual({ atk: 252, def: 4 });
  });

  it('al massimo 6 Pokémon', () => {
    const names = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex', 'Rotom-Wash'];
    const result = importShowdown(names.join('\n\n'));
    expect(result.sets).toHaveLength(6);
    expect(result.errors).toEqual(['Più di 6 Pokémon: ignorato Rotom-Wash']);
  });
});
