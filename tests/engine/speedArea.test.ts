import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SPEED_SHARES, teamSpeedArea } from '../../src/engine/speedArea';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly'): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe: 252 } });
const noMeta: EngineData = { stats: null, sets: null };
const dragapult = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid');
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid');
const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic', 'Haze'], 'Bold');

describe('area Velocità', () => {
  it('80% velocità (coi guadagni) e 20% priorità; il 100 non si raggiunge', () => {
    expect(SPEED_SHARES).toEqual({ speed: 0.8, priority: 0.2 });
    const area = teamSpeedArea([dragapult, valiant, toxapex], noMeta);
    expect(area.value).toBe(Math.round(0.8 * area.speed + 0.2 * area.priority));
    expect(area.value).toBeLessThan(100);
    expect(area.members.map(m => m.species)).toEqual(['Dragapult', 'Iron Valiant', 'Toxapex']);
  });

  it("nel voto: il valore dell'area è quello di teamSpeedArea", () => {
    const rating = rateTeam([dragapult, valiant, toxapex], fixtureData)!;
    expect(rating.areas.find(a => a.key === 'speed')!.value).toBe(teamSpeedArea([dragapult, valiant, toxapex], fixtureData).value);
    expect(rating.speed.members).toHaveLength(3);
  });

  it('anche chi non attacca conta (Toxapex lento abbassa la Velocità del team)', () => {
    expect(teamSpeedArea([dragapult, valiant, toxapex], noMeta).speed).toBeLessThan(teamSpeedArea([dragapult, valiant], noMeta).speed);
  });

  it('col meta e senza: due gruppi di confronto diversi', () => {
    const team = [dragapult, valiant, toxapex];
    const on = teamSpeedArea(team, fixtureData);
    const off = teamSpeedArea(team, { ...fixtureData, ignoreMeta: true });
    expect(on.members[2].raw).not.toBeCloseTo(off.members[2].raw, 5);
  });

  it('Trick Room è una condizione: la Velocità resta, e guadagna chi è adatto (i lenti), non chi è veloce', () => {
    const hatt = set('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psychic', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet');
    const slowpex = { ...toxapex, evs: {}, nature: 'Relaxed' };
    const tr = [hatt, slowpex, dragapult];
    expect(rateTeam(tr, noMeta)!.areas.map(a => a.key)).toContain('speed');
    const area = teamSpeedArea(tr, noMeta);
    const room = (name: string) => area.members.find(m => m.species === name)!.gains.find(g => g.condition === 'trickroom');
    expect(room('Toxapex')!.source).toBe('Trick Room');
    expect(room('Toxapex')!.gain).toBeGreaterThan(0.3);
    expect(room('Dragapult')).toBeUndefined();
    // Senza Trick Room la condizione non c'è
    expect(teamSpeedArea([slowpex, dragapult], noMeta).members.some(m => m.gains.some(g => g.condition === 'trickroom'))).toBe(false);
  });

  it('team vuoto o di sconosciuti: 0, niente NaN', () => {
    expect(teamSpeedArea([], noMeta).value).toBe(0);
    expect(teamSpeedArea([set('Fakemon', '', '', [])], noMeta).value).toBe(0);
  });
});

describe('riferimento della velocità', () => {
  it('i Pokémon del tier del formato, evoluti, alla velocità massima', async () => {
    const { referenceSpeeds } = await import('../../src/engine/speed');
    const ou = referenceSpeeds('ou');
    const ubers = referenceSpeeds('ubers');
    expect(ou.length).toBeGreaterThan(0);
    // In Ubers giocano anche gli OU: il riferimento è più ampio
    expect(ubers.length).toBeGreaterThan(ou.length);
    expect([...ou].sort((a, b) => a - b)).toEqual(ou);
  });
});
