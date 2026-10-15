import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { benefits, enables, mechanicalLinks, unmetBeneficiaries, unusedEnablers } from '../../src/engine/synergy';

const set = (species: string, ability: string, moves: string[] = [], item = ''): TeamSet =>
  ({ ...emptySet(species), ability, moves, item });

const ninetales = set('Ninetales', 'Drought', ['Flamethrower']);
const venusaur = set('Venusaur', 'Chlorophyll', ['Giga Drain', 'Sludge Bomb']);
const tusk = set('Great Tusk', 'Protosynthesis', ['Headlong Rush']);

describe('chi abilita e chi beneficia', () => {
  it('abilità e mosse che abilitano', () => {
    expect(enables(ninetales)).toEqual([{ condition: 'sun', via: 'Drought' }]);
    expect(enables(set('Hatterene', 'Magic Bounce', ['Trick Room']))).toEqual([{ condition: 'trickroom', via: 'Trick Room' }]);
    expect(enables(set('Pelipper', 'Drizzle', ['Rain Dance']))).toEqual([{ condition: 'rain', via: 'Drizzle' }]);
  });

  it('la forma Mega usa la sua abilità (Charizard Y → Drought)', () => {
    expect(enables(set('Charizard', 'Blaze', [], 'Charizardite Y'))).toEqual([{ condition: 'sun', via: 'Drought' }]);
  });

  it('abilità, mosse e velocità bassa che beneficiano', () => {
    expect(benefits(venusaur)).toEqual([{ condition: 'sun', via: 'Chlorophyll' }]);
    expect(benefits(tusk)).toEqual([{ condition: 'sun', via: 'Protosynthesis' }]);
    expect(benefits(set('Kingdra', 'Sniper', ['Hurricane']))).toEqual([{ condition: 'rain', via: 'Hurricane' }]);
    expect(benefits(set('Hatterene', 'Magic Bounce', ['Psyshock']))).toContainEqual({ condition: 'trickroom', via: 'Velocità bassa' });
    expect(benefits(set('Blissey', 'Natural Cure', ['Soft-Boiled']))).toEqual([]);
  });
});

describe('legami nel team', () => {
  it('candidato abilitato da un membro e candidato che abilita', () => {
    expect(mechanicalLinks(venusaur, [ninetales]).map(l => l.text)).toEqual(['Abilitato da Ninetales (Drought): Chlorophyll']);
    expect(mechanicalLinks(ninetales, [venusaur, tusk]).map(l => l.text))
      .toEqual(['Abilita Venusaur: Drought → Chlorophyll', 'Abilita Great Tusk: Drought → Protosynthesis']);
    expect(mechanicalLinks(venusaur, [tusk])).toEqual([]);
  });

  it('abilitatori non sfruttati e beneficiari senza condizione', () => {
    expect(unusedEnablers([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Ninetales', condition: 'sun', via: 'Drought' }]);
    expect(unusedEnablers([ninetales, venusaur])).toEqual([]);
    expect(unmetBeneficiaries([venusaur, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Venusaur', condition: 'sun', via: 'Chlorophyll' }]);
    expect(unmetBeneficiaries([ninetales, venusaur])).toEqual([]);
  });

  it('Weather Ball e Terrain Pulse non vengono segnalati come beneficiari senza condizione', () => {
    expect(unmetBeneficiaries([set('Pelipper', 'Keen Eye', ['Weather Ball'])])).toEqual([]);
  });
});

describe('effetti su suggerimenti e coaching', () => {
  const entry = (usage: number, ability: string, moves: string[]): SpeciesStats => ({
    usage, count: 100, abilities: { [ability]: 1 }, items: {}, teraTypes: {}, spreads: {},
    moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
  });
  const data: EngineData = {
    stats: {
      meta: { month: '2026-09', cutoff: 1630, battles: 1 },
      pokemon: {
        Venusaur: entry(0.05, 'chlorophyll', ['gigadrain', 'sludgebomb']),
        Torkoal: entry(0.04, 'drought', ['lavaplume', 'stealthrock']),
        Garchomp: entry(0.13, 'roughskin', ['earthquake', 'dragontail']),
      },
    },
    sets: {},
  };

  it('sinergia al massimo e tag per il candidato abilitato', () => {
    const venus = scoreCandidates([ninetales], DEFAULT_FORMAT, data).find(s => s.species === 'Venusaur')!;
    expect(venus.components.synergy).toBe(1);
    expect(venus.tags).toContain('Abilitato da Ninetales (Drought): Chlorophyll');
    expect(venus.reasons.map(r => r.text)).toContain('Abilitato da Ninetales (Drought): Chlorophyll');
  });

  it('coaching: Drought non sfruttato, con rimedi', () => {
    const team = [ninetales, mostCommonSet(data.stats, 'Garchomp')!];
    expect(coachTeam(team, DEFAULT_FORMAT, data).problems)
      .toContainEqual({ severity: 'minor', text: 'Drought di Ninetales non sfruttato: nessuno ne beneficia', fixes: ['Venusaur'] });
  });

  it('coaching: Chlorophyll senza sole, con rimedi', () => {
    const team = [venusaur, mostCommonSet(data.stats, 'Garchomp')!];
    expect(coachTeam(team, DEFAULT_FORMAT, data).problems)
      .toContainEqual({ severity: 'minor', text: 'Venusaur ha Chlorophyll ma il team non porta il sole', fixes: ['Torkoal'] });
  });
});
