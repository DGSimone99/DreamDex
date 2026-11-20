import { describe, expect, it } from 'vitest';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { CONDITION_QUOTA, conditionQuota } from '../../src/engine/speedArea';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, ability: string, moves: string[]): TeamSet =>
  ({ ...emptySet(species), ability, moves, nature: 'Adamant', evs: { atk: 252, hp: 252, spd: 4 } });

describe('doppio: Tailwind nella Velocità', () => {
  it('Tailwind vale un quarto in doppio e un ottavo in singolo', () => {
    expect(conditionQuota('tailwind', DOUBLES_RULES)).toBe(0.25);
    expect(conditionQuota('tailwind', NATDEX_OU_RULES)).toBe(0.125);
    expect(conditionQuota('trickroom', DOUBLES_RULES)).toBe(0.25);
  });

  it('le altre quote sono uguali nei due formati', () => {
    for (const condition of Object.keys(CONDITION_QUOTA) as (keyof typeof CONDITION_QUOTA)[]) {
      expect(conditionQuota(condition, NATDEX_OU_RULES)).toBe(CONDITION_QUOTA[condition]);
      if (condition !== 'tailwind') expect(conditionQuota(condition, DOUBLES_RULES)).toBe(CONDITION_QUOTA[condition]);
    }
  });

  it('lo stesso team con Tailwind ha più controllo velocità in doppio che in singolo, e il doppio', () => {
    const team = [
      mk('Tornadus', 'Prankster', ['Tailwind', 'Bleakwind Storm', 'Protect']),
      mk('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Protect']),
      mk('Kingambit', 'Defiant', ['Kowtow Cleave', 'Iron Head', 'Protect']),
    ];
    const doubles = rateTeam(team, { ...fixtureData, formatId: 'natdexdoubles' })!.speed;
    const singles = rateTeam(team, { ...fixtureData, formatId: 'ou' })!.speed;
    expect(singles.control).toBeGreaterThan(0);
    expect(doubles.control).toBeGreaterThan(singles.control);
    expect(doubles.speed).toBe(singles.speed);
    const gain = (speed: typeof doubles) => speed.members[1].gains.find(g => g.condition === 'tailwind')!.gain;
    expect(gain(doubles)).toBeCloseTo(2 * gain(singles), 10);
  });

  it('senza Tailwind la Velocità è la stessa nei due formati', () => {
    const team = [mk('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Swords Dance']), mk('Kingambit', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'])];
    expect(rateTeam(team, { ...fixtureData, formatId: 'natdexdoubles' })!.speed.value).toBe(rateTeam(team, { ...fixtureData, formatId: 'ou' })!.speed.value);
  });
});
