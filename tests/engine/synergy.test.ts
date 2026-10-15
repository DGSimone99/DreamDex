import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { benefits, conditionConflicts, enables, mechanicalLinks, teamSynergies, unmetBeneficiaries, unusedEnablers, weakenedMoves, weatherMitigations } from '../../src/engine/synergy';

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
    expect(unusedEnablers([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Ninetales', condition: 'sun', via: 'Drought', selfBoost: true }]);
    expect(unusedEnablers([ninetales, venusaur])).toEqual([]);
    expect(unmetBeneficiaries([venusaur, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Venusaur', condition: 'sun', via: 'Chlorophyll' }]);
    expect(unmetBeneficiaries([ninetales, venusaur])).toEqual([]);
  });

  it('Weather Ball e Terrain Pulse non creano legami (meteo rivali non sono sinergia)', () => {
    const charizardY = set('Charizard', 'Blaze', ['Weather Ball'], 'Charizardite Y');
    expect(mechanicalLinks(set('Tyranitar', 'Sand Stream'), [charizardY])).toEqual([]);
    expect(mechanicalLinks(set('Pelipper', 'Drizzle'), [set('Ninetales', 'Drought', ['Weather Ball'])])).toEqual([]);
  });

  it('i Paradox non vengono segnalati senza meteo o campo', () => {
    expect(unmetBeneficiaries([set('Great Tusk', 'Protosynthesis', ['Headlong Rush'], 'Leftovers')])).toEqual([]);
    expect(unmetBeneficiaries([set('Iron Valiant', 'Quark Drive', ['Moonblast'])])).toEqual([]);
  });

  it('abilitatore che non potenzia nemmeno sé stesso', () => {
    const pelipper = set('Pelipper', 'Drizzle', ['U-turn', 'Roost']);
    expect(unusedEnablers([pelipper, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Pelipper', condition: 'rain', via: 'Drizzle', selfBoost: false }]);
  });

  it("il Weather Ball dell'abilitatore non conta come uso da parte del team", () => {
    const nineWB = set('Ninetales', 'Drought', ['Weather Ball']);
    expect(unusedEnablers([nineWB, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([{ member: 'Ninetales', condition: 'sun', via: 'Drought', selfBoost: true }]);
  });

  it('Weather Ball e Terrain Pulse non vengono segnalati come beneficiari senza condizione', () => {
    expect(unmetBeneficiaries([set('Pelipper', 'Keen Eye', ['Weather Ball'])])).toEqual([]);
  });
});

describe('sinergie già presenti nel team', () => {
  const leafeon = set('Leafeon', 'Chlorophyll', ['Swords Dance', 'Solar Blade', 'Knock Off', 'Weather Ball']);

  it('elenca abilitatore → beneficiari, senza Weather Ball', () => {
    expect(teamSynergies([ninetales, leafeon])).toEqual(['Ninetales (Drought) → Leafeon (Chlorophyll)']);
    expect(teamSynergies([ninetales, leafeon, tusk]))
      .toEqual(['Ninetales (Drought) → Leafeon (Chlorophyll), Great Tusk (Protosynthesis)']);
  });

  it('nessuna sinergia: lista vuota', () => {
    expect(teamSynergies([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])])).toEqual([]);
  });

  it('il coaching la mostra tra i punti di forza', () => {
    const strengths = coachTeam([ninetales, leafeon], DEFAULT_FORMAT, { stats: null, sets: null }).strengths;
    expect(strengths).toContain('Sinergie: Ninetales (Drought) → Leafeon (Chlorophyll)');
  });
});

describe('debolezze smorzate dal meteo', () => {
  it('il sole dimezza Water: chi era ×2 torna neutro', () => {
    expect(weatherMitigations([ninetales, tusk])).toEqual([{
      condition: 'sun', source: 'Ninetales (Drought)', type: 'Water',
      members: [{ species: 'Ninetales', from: 2, to: 1 }, { species: 'Great Tusk', from: 2, to: 1 }],
    }]);
  });

  it('la pioggia dimezza Fire, anche quando resta una debolezza', () => {
    const team = [set('Pelipper', 'Drizzle', ['Hurricane']), set('Scizor', 'Technician', ['Bullet Punch'])];
    expect(weatherMitigations(team)).toEqual([{
      condition: 'rain', source: 'Pelipper (Drizzle)', type: 'Fire', members: [{ species: 'Scizor', from: 4, to: 2 }],
    }]);
  });

  it('nessun meteo, nessuna nota', () => {
    expect(weatherMitigations([tusk, venusaur])).toEqual([]);
  });
});

describe('meteo e campi in conflitto', () => {
  const pelipper = set('Pelipper', 'Drizzle', ['Hurricane']);

  it('due meteo diversi sono in conflitto', () => {
    expect(conditionConflicts([ninetales, pelipper])).toEqual([{ kind: 'meteo', setters: ['Ninetales (Drought)', 'Pelipper (Drizzle)'] }]);
  });

  it('due campi diversi sono in conflitto', () => {
    const koko = set('Tapu Koko', 'Electric Surge', ['Thunderbolt']);
    const lele = set('Tapu Lele', 'Psychic Surge', ['Psychic']);
    expect(conditionConflicts([koko, lele])).toEqual([{ kind: 'campi', setters: ['Tapu Koko (Electric Surge)', 'Tapu Lele (Psychic Surge)'] }]);
  });

  it('due setter dello stesso meteo non sono in conflitto', () => {
    expect(conditionConflicts([ninetales, set('Torkoal', 'Drought', ['Lava Plume'])])).toEqual([]);
  });
});

describe('mosse indebolite dal meteo del team', () => {
  it('il sole indebolisce le mosse Water: STAB o solo coverage', () => {
    const kingdra = set('Kingdra', 'Sniper', ['Hydro Pump', 'Draco Meteor']);
    const kyurem = set('Kyurem', 'Pressure', ['Ice Beam', 'Surf']);
    expect(weakenedMoves([ninetales, kingdra, kyurem])).toEqual([
      { condition: 'sun', setter: 'Ninetales', member: 'Kingdra', type: 'Water', stab: true },
      { condition: 'sun', setter: 'Ninetales', member: 'Kyurem', type: 'Water', stab: false },
    ]);
  });

  it('la pioggia indebolisce le mosse Fire, anche del setter di un altro meteo', () => {
    expect(weakenedMoves([set('Pelipper', 'Drizzle', ['Hurricane']), ninetales])).toEqual([
      { condition: 'rain', setter: 'Pelipper', member: 'Ninetales', type: 'Fire', stab: true },
    ]);
  });

  it('Hydro Steam non è indebolito dal sole', () => {
    expect(weakenedMoves([ninetales, set('Volcanion', 'Water Absorb', ['Hydro Steam'])])).toEqual([]);
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
      .toContainEqual({ severity: 'minor', category: 'conditions', text: 'Drought di Ninetales potenzia solo le sue mosse: nessun altro ne beneficia', fixes: ['Venusaur'] });
  });

  it('coaching: Chlorophyll senza sole, con rimedi', () => {
    const team = [venusaur, mostCommonSet(data.stats, 'Garchomp')!];
    expect(coachTeam(team, DEFAULT_FORMAT, data).problems)
      .toContainEqual({ severity: 'minor', category: 'conditions', text: 'Venusaur ha Chlorophyll ma il team non porta il sole', fixes: ['Torkoal'] });
  });
});
