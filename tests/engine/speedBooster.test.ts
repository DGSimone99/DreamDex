import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { outspeedShare, paradoxSpeedBoost, speedPool, speedStat } from '../../src/engine/speed';
import { CONDITION_QUOTA, memberSpeed, PARADOX_SPEED } from '../../src/engine/speedArea';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { spe: 252 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const noMeta: EngineData = { stats: null, sets: null };
const pool = speedPool(noMeta);
const share = (speed: number, species: string) => outspeedShare(speed, pool, species);
const boosterGains = (m: ReturnType<typeof memberSpeed>) => m!.gains.filter(g => g.condition === 'booster');

const valiant = (item: string, evs: TeamSet['evs'] = { spa: 252, spe: 252 }) =>
  set('Iron Valiant', item, 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid', evs);
const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume', 'Stealth Rock', 'Rapid Spin', 'Yawn'], 'Bold', { hp: 252, def: 252 });
const pincurchin = set('Pincurchin', 'Terrain Extender', 'Electric Surge', ['Discharge', 'Spikes', 'Recover', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252 });

describe('boost dei Paradox: quando la Velocità è la statistica più alta', () => {
  it('Protosynthesis o Quark Drive con la Velocità più alta di tutte le altre', () => {
    expect(paradoxSpeedBoost(valiant('Booster Energy'))).toBe(true);
    // Great Tusk: l'Attacco batte la Velocità anche con 252 EV in Velocità
    expect(paradoxSpeedBoost(set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush'], 'Jolly', { atk: 252, spe: 252 }))).toBe(false);
    // Roaring Moon: 252 Atk Jolly fa 377 contro 370 di Velocità; con 4 Atk la Velocità vince
    expect(paradoxSpeedBoost(set('Roaring Moon', 'Booster Energy', 'Protosynthesis', ['Dragon Dance'], 'Jolly', { atk: 252, spe: 252 }))).toBe(false);
    expect(paradoxSpeedBoost(set('Roaring Moon', 'Booster Energy', 'Protosynthesis', ['Dragon Dance'], 'Jolly', { atk: 4, spe: 252 }))).toBe(true);
    // Flutter Mane con natura neutra: Attacco Speciale e Velocità pari, il pareggio non sceglie la Velocità
    expect(paradoxSpeedBoost(set('Flutter Mane', 'Booster Energy', 'Protosynthesis', ['Moonblast'], 'Hardy', { spa: 252, spe: 252 }))).toBe(false);
    // Non Paradox
    expect(paradoxSpeedBoost(set('Garchomp', 'Booster Energy', 'Rough Skin', ['Earthquake'], 'Jolly'))).toBe(false);
  });
});

describe('Velocità del membro: Booster Energy, sole e campo elettrico', () => {
  it('la Booster Energy aggiunge metà dei Pokémon superati in più con la Velocità ×1,5; la velocità reale non cambia', () => {
    const v = valiant('Booster Energy');
    const m = memberSpeed(v, [v], noMeta)!;
    const gains = boosterGains(m);
    expect(gains).toHaveLength(1);
    expect(gains[0].source).toBe('Booster Energy');
    expect(gains[0].gain).toBeCloseTo(CONDITION_QUOTA.booster * (share(Math.floor(m.speed * PARADOX_SPEED), 'Iron Valiant') - m.raw));
    expect(gains[0].gain).toBeGreaterThan(0);
    expect(m.own).toBeCloseTo(m.raw + gains[0].gain);
    expect(m.speed).toBe(speedStat(v).value);
    expect(PARADOX_SPEED).toBe(1.5);
    expect(CONDITION_QUOTA.booster).toBe(0.5);
  });

  it('Protosynthesis conta solo col sole del team, Quark Drive solo col campo elettrico', () => {
    // Con 252 EV in Attacco Speciale quello batterebbe la Velocità (349 contro 343): qui investe solo in Velocità
    const wake = set('Walking Wake', 'Heavy-Duty Boots', 'Protosynthesis', ['Hydro Steam', 'Draco Meteor', 'Flamethrower', 'Knock Off'], 'Timid', { hp: 252, spe: 252 });
    expect(boosterGains(memberSpeed(wake, [wake], noMeta))).toEqual([]);
    const sunny = boosterGains(memberSpeed(wake, [wake, torkoal], noMeta));
    expect(sunny).toHaveLength(1);
    expect(sunny[0].source).toBe('Protosynthesis');
    const specs = valiant('Choice Specs');
    expect(boosterGains(memberSpeed(specs, [specs, torkoal], noMeta))).toEqual([]);
    const charged = boosterGains(memberSpeed(specs, [specs, pincurchin], noMeta));
    expect(charged).toHaveLength(1);
    expect(charged[0].source).toBe('Quark Drive');
  });

  it('strumento e campo insieme: un solo guadagno, dalla Booster Energy', () => {
    const v = valiant('Booster Energy');
    const gains = boosterGains(memberSpeed(v, [v, pincurchin], noMeta));
    expect(gains).toHaveLength(1);
    expect(gains[0].source).toBe('Booster Energy');
  });

  it('niente boost se la Velocità non è la statistica più alta', () => {
    const tusk = set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], 'Jolly', { atk: 252, spe: 252 });
    expect(boosterGains(memberSpeed(tusk, [tusk, torkoal], noMeta))).toEqual([]);
  });
});
