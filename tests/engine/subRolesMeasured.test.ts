import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import { speedPool, speedStat } from '../../src/engine/speed';
import { outspeedShare } from '../../src/engine/speed';
import {
  measuredSubRoles, measureWith, statusPool, subRoleReasons, MEASURED, type StatusRival,
} from '../../src/engine/subRoles';
import { fixtureData } from '../fixtures/data';

const set = (species: string, moves: string[], item = '', ability = '', evs: TeamSet['evs'] = {}, nature = 'Serious'): TeamSet =>
  ({ species, ability, item, moves, nature, evs });
const rival = (species: string, types: string[], ability = ''): StatusRival => ({ species, types, ability, item: '', weight: 1 });
const noMeta = { ...fixtureData, ignoreMeta: true };

describe('motivi dei sotto-ruoli (per il dettaglio dei Ruoli)', () => {
  it("le fonti nominano la mossa o l'abilità; i muri portano indice e soglia", () => {
    const corv = set('Corviknight', ['Body Press', 'Iron Defense', 'Roost', 'Defog'], 'Leftovers', 'Pressure', { hp: 252, def: 252 }, 'Impish');
    const reasons = subRoleReasons(corv, [corv], fixtureData);
    expect(reasons.find(r => r.role === 'recovery')).toMatchObject({ source: 'Roost', value: 1 });
    expect(reasons.find(r => r.role === 'removal')).toMatchObject({ source: 'Defog' });
    const wall = reasons.find(r => r.role === 'physicalWall')!;
    expect(wall.source).toBe('wall');
    expect(wall.index!).toBeGreaterThanOrEqual(wall.threshold!);
    const slowbro = set('Slowbro', ['Scald', 'Rest', 'Toxic Spikes', 'Trick'], 'Choice Specs', 'Regenerator');
    const r2 = subRoleReasons(slowbro, [slowbro], fixtureData);
    expect(r2.find(r => r.role === 'recovery')!.source).toBe('Regenerator');
    expect(r2.find(r => r.role === 'hazards')!.source).toBe('Toxic Spikes');
    expect(r2.find(r => r.role === 'itemRemoval')!.source).toBe('Trick + Choice');
  });
});

describe('sotto-ruoli misurati', () => {
  it('Kingambit: wallbreaker e sweeper fisico, non muro', () => {
    const s = set('Kingambit', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Black Glasses', 'Defiant', { hp: 4, atk: 252, spe: 252 }, 'Adamant');
    const v = measuredSubRoles(s, [s], fixtureData);
    expect(v).toMatchObject({ physicalBreaker: 1, physicalSweeper: 1 });
    expect(v.physicalWall).toBeUndefined();
  });

  it('Deoxys-Speed Life Orb: wallbreaker speciale e taunt', () => {
    const s = set('Deoxys-Speed', ['Psycho Boost', 'Taunt', 'Ice Beam', 'Thunderbolt'], 'Life Orb', 'Pressure', { spa: 252, spe: 252 }, 'Timid');
    const v = measuredSubRoles(s, [s], fixtureData);
    expect(v.specialBreaker).toBe(1);
    expect(v.taunt).toBeGreaterThan(0.5);
  });

  it('Hatterene non è wallbreaker', () => {
    const s = set('Hatterene', ['Draining Kiss', 'Trick Room', 'Protect', 'Healing Wish'], 'Leftovers', 'Magic Bounce', { hp: 252, def: 252 }, 'Bold');
    expect(measuredSubRoles(s, [s], fixtureData).specialBreaker).toBeUndefined();
  });

  it('Taunt: quota del pool superato', () => {
    const s = set('Gliscor', ['Taunt', 'Earthquake'], '', '', { spe: 252 }, 'Jolly');
    const v = measuredSubRoles(s, [s], fixtureData);
    expect(v.taunt).toBeCloseTo(outspeedShare(speedStat(s).value, speedPool(fixtureData), s.species), 10);
  });

  it('RF5 Prankster: 1 meno la quota Dark del pool', () => {
    const s = set('Grimmsnarl', ['Taunt', 'Encore'], '', 'Prankster');
    const pool = [rival('A', ['Dark']), rival('B', ['Dark']), rival('C', ['Dark', 'Fairy']), rival('D', ['Water'])];
    const { values, reasons } = measureWith(s, [s], fixtureData, pool, speedPool(fixtureData));
    expect(values.taunt).toBeCloseTo(0.25, 10);
    expect(values.encore).toBeCloseTo(0.25, 10);
    expect(reasons.find(r => r.role === 'taunt')).toMatchObject({ source: 'Taunt', share: 0.25, prankster: true });
    const allDark = measureWith(s, [s], fixtureData, [rival('A', ['Dark'])], []).values;
    expect(allDark.taunt).toBeUndefined();
  });

  it('Toxic non tocca Steel e Poison', () => {
    const pool = [rival('A', ['Steel']), rival('B', ['Poison']), rival('C', ['Normal']), rival('D', ['Normal'])];
    const plain = set('Toxapex', ['Toxic']);
    expect(measureWith(plain, [plain], fixtureData, pool, []).values.dot).toBeCloseTo(0.5, 10);
    const corr = set('Salazzle', ['Toxic'], '', 'Corrosion');
    expect(measureWith(corr, [corr], fixtureData, pool, []).values.dot).toBe(1);
  });

  it('Aurora Veil solo con la neve del team', () => {
    const veil = set('Alolan Ninetales', ['Aurora Veil', 'Blizzard'], 'Light Clay', 'Snow Warning');
    const bare = set('Cresselia', ['Aurora Veil'], 'Light Clay');
    const snowy = set('Abomasnow', ['Blizzard'], '', 'Snow Warning');
    expect(measuredSubRoles(bare, [bare], fixtureData).screens).toBeCloseTo(0.6, 10);
    expect(measuredSubRoles(bare, [bare, snowy], fixtureData).screens).toBe(1);
    expect(measuredSubRoles(veil, [veil], fixtureData).screens).toBe(1);
  });

  it('RF2 meta spento: pool del tier, valori tra 0 e 1', () => {
    const s = set('Grimmsnarl', ['Taunt', 'Encore', 'Toxic', 'Spirit Break'], 'Light Clay', 'Prankster');
    const t = set('Great Tusk', ['Headlong Rush', 'Close Combat', 'Toxic', 'Taunt'], 'Choice Band', '', { atk: 252, spe: 252 }, 'Jolly');
    for (const x of [s, t]) {
      const v = measuredSubRoles(x, [x], noMeta);
      for (const value of Object.values(v)) { expect(value).toBeGreaterThan(0); expect(value).toBeLessThanOrEqual(1); }
    }
    expect(statusPool(noMeta).length).toBe(speedPool(noMeta).length);
    expect(subRoleReasons(s, [s], noMeta).length).toBeGreaterThan(0);
  });

  it('RF1 specie o mosse sconosciute: valori vuoti, nessun errore', () => {
    expect(measuredSubRoles(set('Notamon', ['Toxic', 'Taunt']), [], fixtureData)).toEqual({});
    expect(() => measuredSubRoles(set('Great Tusk', ['', 'Notamove']), [], fixtureData)).not.toThrow();
    expect(MEASURED).toContain('recovery');
  });
});
