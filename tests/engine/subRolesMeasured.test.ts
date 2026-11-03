import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import { speedPool, speedStat } from '../../src/engine/speed';
import { outspeedShare } from '../../src/engine/speed';
import {
  measuredSubRoles, measureWith, rolesList, setSubRoles, statusPool, subRoleReasons, MEASURED, type StatusRival,
} from '../../src/engine/subRoles';
import { teamNeeds } from '../../src/engine/needs';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { rulesOf } from '../../src/engine/formatRules';
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
    // Senza neve nel team la mossa fallisce: niente schermi (il rilevatore del set la tiene a 0,6)
    expect(measuredSubRoles(bare, [bare], fixtureData).screens).toBeUndefined();
    expect(subRoleReasons(bare, [bare], fixtureData).find(r => r.role === 'screens')).toBeUndefined();
    expect(setSubRoles(bare, rulesOf(fixtureData)).screens).toBeCloseTo(0.6, 10);
    expect(measuredSubRoles(bare, [bare, snowy], fixtureData).screens).toBe(1);
    expect(measuredSubRoles(veil, [veil], fixtureData).screens).toBe(1);
    // Con Reflect accanto, senza neve conta solo Reflect (0,6 con Light Clay)
    const reflectVeil = set('Cresselia', ['Aurora Veil', 'Reflect'], 'Light Clay');
    expect(measuredSubRoles(reflectVeil, [reflectVeil], fixtureData).screens).toBeCloseTo(0.6, 10);
    expect(subRoleReasons(reflectVeil, [reflectVeil], fixtureData).find(r => r.role === 'screens')!.source).toBe('Reflect');
  });

  it('voci della cache congelate: valori, motivi e liste non si modificano', () => {
    const s = set('Corviknight', ['Body Press', 'Iron Defense', 'Roost', 'Defog'], 'Leftovers', 'Pressure', { hp: 252, def: 252 }, 'Impish');
    const values = measuredSubRoles(s, [s], fixtureData);
    const reasons = subRoleReasons(s, [s], fixtureData);
    expect(Object.isFrozen(values)).toBe(true);
    expect(Object.isFrozen(reasons)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.every(r => Object.isFrozen(r))).toBe(true);
    expect(() => { (values as Record<string, number>).recovery = 0; }).toThrow();
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

describe('Attaccante fisico e speciale: chi attacca seriamente da un lato', () => {
  const zapdos = set('Zapdos', ['Hurricane', 'Heat Wave', 'Volt Switch', 'Roost'], 'Heavy-Duty Boots', 'Static', { hp: 248, def: 244, spe: 16 }, 'Bold');
  const team = [zapdos,
    set('Great Tusk', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], 'Booster Energy', 'Protosynthesis', { atk: 252, spe: 252 }, 'Jolly'),
    set('Kingambit', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Black Glasses', 'Defiant', { hp: 4, atk: 252, spe: 252 }, 'Adamant'),
    set('Garchomp', ['Stealth Rock', 'Earthquake', 'Dragon Tail', 'Spikes'], 'Rocky Helmet', 'Rough Skin', { hp: 252, def: 252 }, 'Impish'),
    set('Corviknight', ['Body Press', 'Iron Defense', 'Roost', 'Defog'], 'Leftovers', 'Pressure', { hp: 252, def: 252 }, 'Impish'),
    set('Dragonite', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Heavy-Duty Boots', 'Multiscale', { atk: 252, spe: 252 }, 'Adamant'),
  ];

  it('Zapdos muro con Hurricane e Heat Wave: attaccante speciale (non sweeper né breaker), copre la voce nel Bulky Offense', () => {
    const v = measuredSubRoles(zapdos, team, fixtureData);
    expect(v.specialAttacker).toBe(1);
    expect(v.specialSweeper).toBeUndefined();
    expect(v.specialBreaker).toBeUndefined();
    expect(subRoleReasons(zapdos, team, fixtureData).find(r => r.role === 'specialAttacker')!.source).toBe('Hurricane');
    const needs = teamNeeds(team, fixtureData, undefined, 'bulkyOffense');
    expect(needs.values.anySpecial).toBe(1);
    expect(needs.essentialMissing).not.toContain('anySpecial');
    // Non è una riga propria né un ruolo delle carte o delle liste
    expect(LEVEL_KEYS).not.toContain('specialAttacker');
    expect(rolesList(v)).not.toContain('specialAttacker');
  });

  it('i pivot non contano fra i due attacchi: Hurricane + Volt Switch non basta', () => {
    const pivot = set('Zapdos', ['Hurricane', 'Volt Switch', 'Roost', 'Defog'], 'Heavy-Duty Boots', 'Static', { hp: 248, def: 244, spe: 16 }, 'Bold');
    expect(measuredSubRoles(pivot, [pivot, ...team.slice(1)], fixtureData).specialAttacker).toBeUndefined();
  });

  it('serve Offesa almeno 40: Toxapex con Scald e Sludge Bomb non è un attaccante', () => {
    const pex = set('Toxapex', ['Scald', 'Sludge Bomb', 'Recover', 'Haze'], 'Black Sludge', 'Regenerator', { hp: 252, def: 252 }, 'Bold');
    expect(measuredSubRoles(pex, [pex], fixtureData).specialAttacker).toBeUndefined();
  });
});

describe('Sticky Web è un hazard', () => {
  it('Ribombee con Sticky Web: Hazard 1 con fonte Sticky Web, e resta Controllo velocità', () => {
    const web = set('Ribombee', ['Sticky Web', 'Moonblast', 'Stun Spore', 'Skill Swap'], 'Focus Sash', 'Shield Dust', { spa: 252, spe: 252 }, 'Timid');
    const v = measuredSubRoles(web, [web], fixtureData);
    expect(v).toMatchObject({ hazards: 1, speedControl: 1 });
    expect(subRoleReasons(web, [web], fixtureData).find(r => r.role === 'hazards')!.source).toBe('Sticky Web');
    expect(setSubRoles(web, rulesOf(fixtureData)).hazards).toBe(1);
    // Un team con Ribombee come solo setter non è più "senza Hazard"
    const team = [web, set('Kingambit', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Black Glasses', 'Defiant', { atk: 252, spe: 252 }, 'Adamant')];
    const needs = teamNeeds(team, fixtureData, undefined, 'balance');
    expect(needs.values.hazards).toBe(1);
    expect(needs.essentialMissing).not.toContain('hazards');
  });
});
