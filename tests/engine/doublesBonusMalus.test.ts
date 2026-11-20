import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { bonusMalusCatalog, rateTeam, SABOTAGE_POINTS, weakenedMoveNotes } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { SABOTAGE_USAGE, sabotagedMembers } from '../../src/engine/synergy';
import { fixtureData, fixtureStats } from '../fixtures/data';

const mk = (species: string, ability: string, moves: string[], item = ''): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } });
const entry = (moves: Record<string, number>): SpeciesStats =>
  ({ usage: 0.05, count: 100, abilities: {}, items: {}, moves, teraTypes: {}, spreads: {}, teammates: {}, checks: {} });
/** Dati di doppio con le mosse più usate di qualche Pokémon in più. */
const withStats = (extra: Record<string, SpeciesStats>, formatId: 'natdexdoubles' | 'ou' = 'natdexdoubles'): EngineData =>
  ({ ...fixtureData, formatId, stats: { ...fixtureStats, pokemon: { ...fixtureStats.pokemon, ...extra } } });

const doublesData: EngineData = { ...fixtureData, formatId: 'natdexdoubles' };
const ouData: EngineData = { ...fixtureData, formatId: 'ou' };
const noStats: EngineData = { stats: null, sets: {}, formatId: 'natdexdoubles' };

const torkoal = mk('Torkoal', 'Drought', ['Eruption', 'Earth Power', 'Protect']);
const venusaur = mk('Venusaur', 'Chlorophyll', ['Sludge Bomb', 'Energy Ball', 'Protect']);
const lilligant = mk('Lilligant', 'Chlorophyll', ['Leaf Storm', 'Pollen Puff', 'After You']);
const basculegion = mk('Basculegion', 'Adaptability', ['Wave Crash', 'Last Respects', 'Protect']);
const dryBasculegion = mk('Basculegion', 'Adaptability', ['Last Respects', 'Psychic Fangs', 'Protect']);
const garchomp = mk('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Protect']);

const sabotage = (team: TeamSet[], data = doublesData) => rateTeam(team, data)!.penalty.items.filter(i => i.catalog === 'weatherSabotage');
const bonusKeys = (team: TeamSet[], data: EngineData) => rateTeam(team, data)!.bonus.items.map(i => i.catalog);
const weak = (team: TeamSet[], data: EngineData) => rateTeam(team, data)!.penalty.items.filter(i => i.catalog === 'weakMember').map(i => [i.parts?.member, i.points]);

describe('doppio: il sabotaggio del meteo', () => {
  it('sole del team e un compagno con una mossa Acqua: −2, col suo nome', () => {
    const items = sabotage([torkoal, basculegion, garchomp]);
    expect(items.map(i => [i.points, i.parts?.member])).toEqual([[2, 'Basculegion']]);
    expect(SABOTAGE_POINTS).toBe(2);
    expect(items[0].text).toBe('Il sole di Torkoal dimezza le mosse Water di Basculegion');
    expect(rateTeam([torkoal, basculegion, garchomp], doublesData, 'en')!.penalty.items.find(i => i.catalog === 'weatherSabotage')!.text)
      .toBe("Torkoal's sun halves Basculegion's Water moves");
  });

  it('entra nel voto: due punti in meno dello stesso team senza il malus', () => {
    const r = rateTeam([torkoal, basculegion, garchomp], doublesData)!;
    expect(r.penalty.total).toBe(r.penalty.items.reduce((n, i) => n + i.points, 0));
    expect(r.overall).toBe(Math.min(100, Math.max(0, r.base - r.penalty.total + r.bonus.total)));
  });

  it("vale anche senza la mossa nel set, se è fra le più usate di quel Pokémon", () => {
    const data = withStats({ Basculegion: entry({ wavecrash: 0.8, lastrespects: 0.9 }) });
    expect(sabotage([torkoal, dryBasculegion, garchomp], data).map(i => i.parts?.member)).toEqual(['Basculegion']);
    // Il testo non dice che il set ha mosse Acqua (non le ha): dice che di solito le usa
    expect(sabotage([torkoal, dryBasculegion, garchomp], data)[0].text).toBe('Basculegion di solito usa mosse Water, che il sole di Torkoal dimezza');
    expect(rateTeam([torkoal, dryBasculegion, garchomp], { ...data }, 'en')!.penalty.items.find(i => i.catalog === 'weatherSabotage')!.text)
      .toBe("Basculegion usually runs Water moves, which Torkoal's sun halves");
    // Con la mossa nel set resta il testo di sempre, anche se è pure fra le più usate
    expect(sabotage([torkoal, basculegion, garchomp], data)[0].text).toBe('Il sole di Torkoal dimezza le mosse Water di Basculegion');
    expect(sabotagedMembers([torkoal, dryBasculegion, garchomp], data).map(w => w.member)).toEqual(['Basculegion']);
    // Le statistiche coi nomi per esteso (data.pkmn.cc) valgono uguale
    const named = withStats({ Basculegion: entry({ 'Wave Crash': 0.8 }) });
    expect(sabotage([torkoal, dryBasculegion, garchomp], named)).toHaveLength(1);
  });

  it('sotto la soglia non vale; una mossa di stato Acqua non conta', () => {
    expect(SABOTAGE_USAGE).toBe(0.3);
    expect(sabotage([torkoal, dryBasculegion, garchomp], withStats({ Basculegion: entry({ wavecrash: 0.29 }) }))).toEqual([]);
    expect(sabotage([torkoal, dryBasculegion, garchomp], withStats({ Basculegion: entry({ wavecrash: 0.3 }) }))).toHaveLength(1);
    expect(sabotage([torkoal, dryBasculegion, garchomp], withStats({ Basculegion: entry({ raindance: 0.9, lifedew: 0.9 }) }))).toEqual([]);
  });

  it('un membro una volta sola, anche con la mossa nel set e fra le più usate', () => {
    const data = withStats({ Basculegion: entry({ wavecrash: 0.8, aquajet: 0.6 }) });
    expect(sabotage([torkoal, basculegion, garchomp], data)).toHaveLength(1);
  });

  it('chi porta un altro meteo non è sabotato; Hydro Steam non conta', () => {
    const pelipper = mk('Pelipper', 'Drizzle', ['Surf', 'Hurricane', 'Protect']);
    expect(sabotage([torkoal, pelipper, garchomp]).map(i => i.parts?.member)).toEqual([]);
    const wake = mk('Walking Wake', 'Protosynthesis', ['Hydro Steam', 'Draco Meteor', 'Protect']);
    expect(sabotage([torkoal, wake, garchomp])).toEqual([]);
    expect(sabotage([torkoal, wake, garchomp], withStats({ 'Walking Wake': entry({ hydrosteam: 0.95 }) }))).toEqual([]);
    // La pioggia dimezza il Fuoco
    const rain = mk('Politoed', 'Drizzle', ['Scald', 'Ice Beam', 'Protect']);
    const incineroar = mk('Incineroar', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off']);
    expect(sabotage([rain, incineroar, garchomp]).map(i => i.parts?.member)).toEqual(['Incineroar']);
  });

  it('senza statistiche vale solo la mossa nel set, senza errori', () => {
    expect(sabotage([torkoal, dryBasculegion, garchomp], noStats)).toEqual([]);
    expect(sabotage([torkoal, basculegion, garchomp], noStats)).toHaveLength(1);
    // Col meta spento le statistiche non contano
    const off = { ...withStats({ Basculegion: entry({ wavecrash: 0.8 }) }), ignoreMeta: true };
    expect(sabotage([torkoal, dryBasculegion, garchomp], off)).toEqual([]);
  });

  it("in singolo il sabotaggio non è un malus (resta l'avviso del coach, anche in doppio)", () => {
    expect(sabotage([torkoal, basculegion, garchomp], ouData)).toEqual([]);
    expect(weakenedMoveNotes([torkoal, basculegion, garchomp])).toHaveLength(1);
  });

  it('il catalogo: in doppio c\'è il sabotaggio e non "condizione usata"; in singolo il contrario', () => {
    const keys = (rules?: typeof DOUBLES_RULES) => bonusMalusCatalog('it', rules).map(e => e.key);
    expect(keys(DOUBLES_RULES)).toContain('weatherSabotage');
    expect(keys(DOUBLES_RULES)).not.toContain('conditionUsed');
    expect(keys(NATDEX_OU_RULES)).not.toContain('weatherSabotage');
    expect(keys(NATDEX_OU_RULES)).toContain('conditionUsed');
    expect(keys()).toEqual(keys(NATDEX_OU_RULES));
    const item = bonusMalusCatalog('it', DOUBLES_RULES).find(e => e.key === 'weatherSabotage')!;
    expect([item.kind, item.points]).toEqual(['malus', '−2 per membro']);
    expect(bonusMalusCatalog('en', DOUBLES_RULES).find(e => e.key === 'weatherSabotage')!.name.length).toBeGreaterThan(0);
  });
});

describe('doppio: condizione usata e membro debole', () => {
  it('in doppio niente bonus "condizione usata"', () => {
    const sun = [torkoal, venusaur, lilligant, garchomp];
    expect(bonusKeys(sun, ouData)).toContain('conditionUsed');
    expect(bonusKeys(sun, doublesData)).not.toContain('conditionUsed');
  });

  const clefairy = mk('Clefairy', 'Friend Guard', ['Follow Me', 'Helping Hand', 'Protect', 'Moonblast'], 'Eviolite');
  const hitmontop = mk('Hitmontop', 'Intimidate', ['Fake Out', 'Wide Guard', 'Close Combat', 'Feint']);
  const raticate = mk('Raticate', 'Guts', ['Tackle', 'Protect']);
  const amoonguss = mk('Amoonguss', 'Regenerator', ['Rage Powder', 'Spore', 'Pollen Puff', 'Protect']);

  it('Clefairy con Follow Me non è un membro debole in doppio; un debole senza niente sì (−4)', () => {
    expect(weak([clefairy, raticate, garchomp], doublesData)).toEqual([['Raticate', 4]]);
    // Anche Rage Powder e Fake Out salvano: lo stesso Pokémon debole con e senza la mossa
    expect(weak([{ ...raticate, moves: ['Fake Out', 'Tackle'] }, garchomp], doublesData)).toEqual([]);
    expect(weak([{ ...clefairy, moves: ['Rage Powder', 'Moonblast'] }, garchomp], doublesData)).toEqual([]);
    expect(weak([{ ...clefairy, moves: ['Helping Hand', 'Moonblast'] }, garchomp], doublesData)).toEqual([['Clefairy', 4]]);
    expect(weak([hitmontop, amoonguss, garchomp], doublesData)).toEqual([]);
  });

  it('in singolo Clefairy con Follow Me resta un membro debole', () => {
    expect(weak([clefairy, garchomp], ouData)).toEqual([['Clefairy', 4]]);
    expect(weak([{ ...raticate, moves: ['Fake Out', 'Tackle'] }, garchomp], ouData)).toEqual([['Raticate', 4]]);
  });
});
