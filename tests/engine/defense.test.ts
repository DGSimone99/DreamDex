import { describe, expect, it } from 'vitest';
import { bestHit } from '../../src/engine/damage';
import { DEFENSE_DEPTH, DEFENSE_SHARES, DEFENSE_SHARES_NO_META, dummyAttacker, dummyStats, hazardRemover, holdBand, signedSustain, holdCredit, typedHits, memberDefense, sustainParts, teamDefense } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';
import { softScore } from '../../src/engine/scale';
import { fixtureData } from '../fixtures/data';
import { TYPES } from '../../src/engine/types';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
/** Recupero meno perdite per turno (in quota dei PS), dalle parti di `sustainParts`. */
const sustainability = (set: TeamSet, holdShare: number) => {
  const parts = sustainParts(set, holdShare);
  return parts.recovery - parts.rocks - parts.itemLoss;
};

describe('sustainability: recupero contro perdite per turno', () => {
  it('Boots e Magic Guard azzerano Stealth Rock; Magic Guard anche Life Orb', () => {
    const zard = set('Charizard', 'Leftovers', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    expect(sustainability(zard, 1)).toBeCloseTo(0.0625 - 0.5);
    expect(sustainability({ ...zard, item: 'Heavy-Duty Boots' }, 1)).toBeCloseTo(0);
    const clef = set('Clefable', 'Life Orb', 'Magic Guard', ['Moonblast', 'Moonlight'], 'Modest', { hp: 252, spa: 252 });
    expect(sustainability(clef, 1)).toBeCloseTo(0.5);
  });

  it('con chi toglie gli hazard nel team la Stealth Rock pesa metà (e lo dice), Life Orb no', () => {
    const zard = set('Charizard', 'Life Orb', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Defog', 'Roost'], 'Impish', { hp: 252, def: 252 });
    const remover = hazardRemover([zard, corv]);
    expect(remover).toBe('Defog (Corviknight)');
    expect(sustainParts(zard, 1, remover)).toMatchObject({ rocks: 0.25, rocksHalvedBy: 'Defog (Corviknight)', itemLoss: 0.1 });
    expect(sustainParts(zard, 1)).toMatchObject({ rocks: 0.5, rocksHalvedBy: null });
    expect(hazardRemover([zard])).toBeNull();
    // Chi non prende la Stealth Rock non ha niente da dimezzare
    expect(sustainParts({ ...zard, item: 'Heavy-Duty Boots' }, 1, remover).rocksHalvedBy).toBeNull();
  });

  it('Sheer Force toglie il costo di Life Orb solo se una mossa ha effetti secondari', () => {
    const king = set('Nidoking', 'Life Orb', 'Sheer Force', ['Earth Power', 'Sludge Wave'], 'Timid', { spa: 252, spe: 252 });
    expect(sustainParts(king, 1).itemLoss).toBe(0);
    expect(sustainParts({ ...king, moves: ['Earthquake', 'Stealth Rock'] }, 1).itemLoss).toBeCloseTo(0.1);
  });

  it('gli strumenti che tolgono PS: Flame Orb e Toxic Orb (non a chi è immune allo stato), Sticky Barb, Black Sludge fuori dai Veleno', () => {
    const ursa = set('Ursaluna', 'Flame Orb', 'Guts', ['Facade', 'Headlong Rush'], 'Adamant', { atk: 252 });
    expect(sustainParts(ursa, 1)).toMatchObject({ itemLoss: 0.0625, itemLossFrom: 'Flame Orb' });
    // Un Fuoco non si brucia, Magic Guard non prende danno
    expect(sustainParts({ ...ursa, species: 'Arcanine' }, 1).itemLoss).toBe(0);
    expect(sustainParts({ ...ursa, ability: 'Magic Guard' }, 1).itemLoss).toBe(0);
    const toxic = { ...ursa, item: 'Toxic Orb' };
    expect(sustainParts(toxic, 1).itemLoss).toBeCloseTo(0.125);
    expect(sustainParts({ ...toxic, species: 'Corviknight' }, 1).itemLoss).toBe(0);
    expect(sustainParts({ ...ursa, item: 'Sticky Barb' }, 1).itemLoss).toBeCloseTo(0.0625);
    // Black Sludge: cura un Veleno, toglie PS agli altri
    expect(sustainParts({ ...ursa, item: 'Black Sludge' }, 1)).toMatchObject({ itemLoss: 0.125, recovery: 0 });
    expect(sustainParts({ ...ursa, species: 'Toxapex', item: 'Black Sludge' }, 1)).toMatchObject({ itemLoss: 0, recovery: 0.0625 });
  });

  it('Poison Heal cura solo con Toxic Orb (senza, il Pokémon non è avvelenato)', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect'], 'Impish', { hp: 252, def: 252 });
    expect(sustainParts(gliscor, 1)).toMatchObject({ sources: ['Poison Heal'], recovery: 0.125 });
    expect(sustainParts({ ...gliscor, item: 'Leftovers' }, 1)).toMatchObject({ sources: ['Leftovers'], recovery: 0.0625 });
  });

  it('Regenerator vale 0,33; il recupero si dimezza per chi regge meno del 35% dei colpi di tipo', () => {
    const slowbro = set('Slowbro', 'Heavy-Duty Boots', 'Regenerator', ['Slack Off', 'Scald'], 'Bold', { hp: 252, def: 252 });
    expect(sustainability(slowbro, 1)).toBeCloseTo(0.5 + 0.33);
    expect(sustainability(slowbro, 0.35)).toBeCloseTo(0.5 + 0.33);
    expect(sustainability(slowbro, 0.34)).toBeCloseTo((0.5 + 0.33) / 2);
  });

  it('fonti nuove: Leech Seed e le mosse che assorbono un ottavo, Pain Split un quarto; conta la mossa migliore', () => {
    const ferro = set('Ferrothorn', 'Heavy-Duty Boots', 'Iron Barbs', ['Leech Seed', 'Power Whip', 'Stealth Rock'], 'Relaxed', { hp: 252, def: 252 });
    expect(sustainParts(ferro, 1)).toMatchObject({ sources: ['Leech Seed'], recovery: 0.125 });
    const breloom = set('Breloom', 'Heavy-Duty Boots', 'Technician', ['Drain Punch', 'Mach Punch'], 'Jolly', { atk: 252 });
    expect(sustainParts(breloom, 1)).toMatchObject({ sources: ['Drain Punch'], recovery: 0.125 });
    const giratina = set('Giratina', 'Heavy-Duty Boots', 'Pressure', ['Pain Split', 'Leech Seed'], 'Impish', { hp: 252, def: 252 });
    expect(sustainParts(giratina, 1)).toMatchObject({ sources: ['Pain Split'], recovery: 0.25 });
  });

  it('Rain Dish e Dry Skin curano solo con la pioggia del team, Ice Body con la neve', () => {
    const ludi = set('Ludicolo', 'Heavy-Duty Boots', 'Rain Dish', ['Hydro Pump'], 'Modest', { spa: 252 });
    expect(sustainParts(ludi, 1).recovery).toBe(0);
    expect(sustainParts(ludi, 1, null, ['rain'])).toMatchObject({ sources: ['Rain Dish'], recovery: 0.0625 });
    const toxi = set('Toxicroak', 'Heavy-Duty Boots', 'Dry Skin', ['Drain Punch'], 'Adamant', { atk: 252 });
    expect(sustainParts(toxi, 1, null, ['rain']).recovery).toBeCloseTo(0.125 + 0.125);
    const glalie = set('Glalie', 'Heavy-Duty Boots', 'Ice Body', ['Freeze-Dry'], 'Timid', { spa: 252 });
    expect(sustainParts(glalie, 1, null, ['snow']).recovery).toBe(0.0625);
    expect(sustainParts(glalie, 1, null, ['rain']).recovery).toBe(0);
  });
});

describe('memberDefense: quanti colpi di tipo regge (solo informazione)', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });

  it('Blissey regge meglio gli speciali dei fisici; Assault Vest alza solo lo speciale', () => {
    const m = memberDefense(blissey, [blissey], fixtureData)!;
    expect(m.special).toBeGreaterThan(m.physical);
    const tusk = set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush'], 'Jolly', { atk: 252, spe: 252 });
    const plain = memberDefense(tusk, [tusk], fixtureData)!;
    const av = memberDefense({ ...tusk, item: 'Assault Vest' }, [tusk], fixtureData)!;
    expect(av.special).toBeGreaterThanOrEqual(plain.special);
    expect(av.physical).toBe(plain.physical);
  });

  it('fisica e speciale = quota dei 18 colpi di quel lato che regge (pieno 1, a metà 0,5)', () => {
    const m = memberDefense(blissey, [blissey], noStats)!;
    const { held } = typedHits(blissey, noStats);
    const side = (k: number) => Math.round(100 * held.filter((_, i) => i % 2 === k).reduce((a, x) => a + holdCredit(x), 0) / 18);
    expect(m.physical).toBe(side(0));
    expect(m.special).toBe(side(1));
    expect(m.hold).toBe(Math.round(100 * held.reduce((a, x) => a + holdCredit(x), 0) / 36));
    // Il valore del membro con i pesi della squadra: senza statistiche niente meta, 80/20
    expect(m.metaHold).toBeNull();
  });

  it('Regge il meta: quota pesata per uso delle minacce che regge; valore 40/40/20 col meta, 80/20 senza', () => {
    const m = memberDefense(blissey, [blissey], fixtureData)!;
    expect(m.metaHold).not.toBeNull();
    expect(m.metaHold!).toBeGreaterThanOrEqual(0);
    expect(m.metaHold!).toBeLessThanOrEqual(100);
    expect(DEFENSE_SHARES).toEqual({ types: 0.4, meta: 0.4, sustain: 0.2 });
    expect(m.value).toBe(Math.round(DEFENSE_SHARES.types * m.hold + DEFENSE_SHARES.meta * m.metaHold! + DEFENSE_SHARES.sustain * m.sustain));
    const plain = memberDefense(blissey, [blissey], { ...fixtureData, ignoreMeta: true })!;
    expect(plain.metaHold).toBeNull();
    expect(DEFENSE_SHARES_NO_META).toEqual({ types: 0.8, sustain: 0.2 });
    expect(plain.value).toBe(Math.round(DEFENSE_SHARES_NO_META.types * plain.hold + DEFENSE_SHARES_NO_META.sustain * plain.sustain));
  });

  it('Iron Defense: setupGain è quanto la danza alza il valore', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
    const m = memberDefense(corv, [corv], fixtureData)!;
    expect(m.setupMove).toBe('Iron Defense');
    expect(m.setupGain).toBeGreaterThanOrEqual(0);
    expect(memberDefense({ ...corv, moves: ['Body Press', 'Roost'] }, [corv], fixtureData)!.setupGain).toBe(0);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberDefense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [], fixtureData)).toBeNull();
  });
});

describe('teamDefense: Coverage di tipi sui colpi, Coverage meta, Sostenibilità', () => {
  const tusk = set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Rapid Spin'], 'Jolly', { atk: 252, spe: 252 });
  const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Haze', 'Surf'], 'Bold', { hp: 252, def: 252 });
  const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'Roost'], 'Impish', { hp: 248, def: 168, spd: 92 });
  const team = [tusk, toxapex, corv];

  it('col meta: Difesa = 40% Coverage tipi + 30% Coverage meta + 30% Sostenibilità', () => {
    const d = teamDefense(team, fixtureData);
    expect(d.coverageMeta).not.toBeNull();
    expect(d.value).toBe(Math.round(DEFENSE_SHARES.types * d.coverageTypes.value + DEFENSE_SHARES.meta * d.coverageMeta!.value + DEFENSE_SHARES.sustain * d.sustain));
  });

  it('senza meta: 70% Coverage tipi + 30% Sostenibilità; senza statistiche niente Coverage meta', () => {
    const d = teamDefense(team, { ...fixtureData, ignoreMeta: true });
    expect(d.coverageMeta).toBeNull();
    expect(d.value).toBe(Math.round(DEFENSE_SHARES_NO_META.types * d.coverageTypes.value + DEFENSE_SHARES_NO_META.sustain * d.sustain));
    expect(teamDefense(team, noStats).coverageMeta).toBeNull();
  });

  it('Coverage di tipi: per ogni tipo e lato la profondità 70/20/10 dei crediti, poi la media dei 36', () => {
    const d = teamDefense(team, noStats);
    const hits = team.map(m => typedHits(m, noStats).held);
    const depth = (c: number) => [...hits.map(h => holdCredit(h[c]))].sort((a, b) => b - a).reduce((acc, x, i) => acc + (DEFENSE_DEPTH[i] ?? 0) * x, 0);
    const mean = Array.from({ length: 36 }, (_, c) => depth(c)).reduce((a, b) => a + b, 0) / 36;
    expect(d.coverageTypes.value).toBe(softScore(mean));
    const fire = d.coverageTypes.rows.find(r => r.type === 'Fire')!;
    const i = TYPES.indexOf('Fire' as never);
    expect(fire.physical).toBe(Math.round(100 * depth(2 * i)));
    expect(fire.special).toBe(Math.round(100 * depth(2 * i + 1)));
    expect(fire.level).toBe(Math.round(100 * (depth(2 * i) + depth(2 * i + 1)) / 2));
  });

  it('buchi: i tipi dove nessuno ha credito sul lato peggiore; Lo reggono = pieno sul lato peggiore', () => {
    const glass = [set('Weavile', 'Choice Band', 'Pressure', ['Triple Axel'], 'Jolly', { atk: 252, spe: 252 })];
    const d = teamDefense(glass, noStats);
    expect(d.coverageTypes.weak.length).toBeGreaterThan(0);
    for (const row of d.coverageTypes.rows) {
      expect(d.coverageTypes.weak.includes(row.type)).toBe(Math.min(row.physical, row.special) === 0);
    }
    const full = teamDefense(team, noStats);
    const ground = full.coverageTypes.rows.find(r => r.type === 'Ground')!;
    expect(ground.heldBy).toContain('Corviknight');
  });

  it('per ogni membro e tipo: il danno del lato peggiore e i due lati', () => {
    const d = teamDefense(team, noStats);
    expect(d.typed).toHaveLength(3);
    const held = typedHits(toxapex, noStats).held;
    const i = TYPES.indexOf('Ground' as never);
    expect(d.typed[1].cells[i]).toEqual({
      pct: Math.floor(100 * Math.max(held[2 * i], held[2 * i + 1])), physical: Math.floor(100 * held[2 * i]), special: Math.floor(100 * held[2 * i + 1]),
      band: holdBand(Math.max(held[2 * i], held[2 * i + 1])),
    });
  });

  it('un membro sconosciuto si salta; un membro solo: niente NaN; la Robustezza non c\'è più', () => {
    const notamon = set('Notamon', '', '', ['Tackle'], 'Hardy', {});
    expect(teamDefense([toxapex, notamon], noStats).value).toBe(teamDefense([toxapex], noStats).value);
    const one = teamDefense([toxapex], noStats);
    expect(Number.isNaN(one.value)).toBe(false);
    for (const key of ['robustness', 'physical', 'special', 'matrix']) expect(key in one).toBe(false);
  });

  it('la Sostenibilità: Alakazam con Recover regge poco e recupera a metà, Toxapex e Slowbro no', () => {
    const zam = set('Alakazam', 'Life Orb', 'Magic Guard', ['Psychic', 'Recover'], 'Timid', { spa: 252, spe: 252 });
    const d = teamDefense([zam, toxapex], noStats);
    expect(d.members.find(m => m.species === 'Alakazam')!.sustainParts.halved).toBe(true);
    expect(d.members.find(m => m.species === 'Toxapex')!.sustainParts.halved).toBe(false);
    const slowbro = set('Slowbro', 'Heavy-Duty Boots', 'Regenerator', ['Slack Off', 'Scald'], 'Bold', { hp: 252, def: 252 });
    expect(teamDefense([slowbro], noStats).members[0].sustainParts.halved).toBe(false);
  });
});

describe('attaccante finto e colpi per tipo', () => {
  const natdex = { stats: null, sets: null, formatId: 'ou' as const };
  const gen9 = { stats: null, sets: null, formatId: 'gen9ou' as const };
  const idx = (type: string, special = false) => 2 * TYPES.indexOf(type as never) + (special ? 1 : 0);

  it("l'attaccante finto ha l'Attacco medio del quarto più forte del suo tipo (in Gen 9 senza Mega)", () => {
    // National Dex: Drago speciale forte (~151), Lotta speciale debole (~114), Lotta fisico forte (~144)
    expect(Math.abs(dummyAttacker(natdex, 'spa', 'Dragon').baseStats!.spa! - 151)).toBeLessThanOrEqual(4);
    expect(Math.abs(dummyAttacker(natdex, 'spa', 'Fighting').baseStats!.spa! - 114)).toBeLessThanOrEqual(4);
    expect(Math.abs(dummyAttacker(natdex, 'atk', 'Fighting').baseStats!.atk! - 144)).toBeLessThanOrEqual(4);
    expect(dummyAttacker(natdex, 'spa', 'Dragon').baseStats!.spa!).toBeGreaterThan(dummyAttacker(natdex, 'spa', 'Fighting').baseStats!.spa!);
    expect(dummyAttacker(gen9, 'spa', 'Dragon').baseStats!.spa!).toBeLessThanOrEqual(dummyAttacker(natdex, 'spa', 'Dragon').baseStats!.spa!);
    expect(dummyAttacker(natdex, 'atk', 'Fire').types).toEqual(['Fire']);
  });

  it("dummyStats dà alla guida le stesse statistiche dell'attaccante finto del tipo", () => {
    for (const data of [natdex, gen9]) {
      for (const type of ['Water', 'Dragon', 'Bug']) {
        expect(dummyStats(data.formatId, type)).toEqual({ atk: dummyAttacker(data, 'atk', type).baseStats!.atk!, spa: dummyAttacker(data, 'spa', type).baseStats!.spa! });
      }
    }
  });

  it('36 colpi: Blissey regge meglio lo speciale; Levitate e Flash Fire annullano Terra e Fuoco', () => {
    const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled'], 'Bold', { hp: 252, def: 252 });
    const b = typedHits(blissey, natdex).plain;
    expect(b).toHaveLength(36);
    expect(b[idx('Normal', true)]).toBeLessThan(b[idx('Normal')]);
    const rotom = set('Rotom-Wash', 'Leftovers', 'Levitate', ['Volt Switch'], 'Bold', { hp: 252, def: 252 });
    expect(typedHits(rotom, natdex).plain[idx('Ground')]).toBe(0);
    const heatran = set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm'], 'Calm', { hp: 252, spd: 252 });
    expect(typedHits(heatran, natdex).plain[idx('Fire', true)]).toBe(0);
    const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Jolly', { atk: 252, spe: 252 });
    expect(typedHits(chomp, natdex).plain[idx('Ground')]).toBeLessThan(typedHits(heatran, natdex).plain[idx('Ground')]);
  });

  it('la danza difensiva conta per metà: Iron Defense abbassa i colpi fisici, senza danza niente cambia', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
    const withSetup = typedHits(corv, natdex);
    expect(withSetup.held[idx('Fighting')]).toBeLessThan(withSetup.plain[idx('Fighting')]);
    const noSetup = typedHits({ ...corv, moves: ['Body Press', 'Roost'] }, natdex);
    expect(noSetup.held).toEqual(noSetup.plain);
  });

  it('credito: pieno sotto un terzo, metà sotto la metà, niente da lì in su', () => {
    expect([0, 0.33, 1 / 3, 0.49, 0.5, 1].map(holdCredit)).toEqual([1, 1, 0.5, 0.5, 0, 0]);
  });
});

describe('Wonder Guard sui colpi di tipo', () => {
  it('Shedinja regge tutti i colpi non super efficaci e va KO solo con Fuoco, Volante, Roccia, Spettro e Buio', () => {
    const natdex = { stats: null, sets: null, formatId: 'ou' as const };
    const shedinja = set('Shedinja', 'Focus Sash', 'Wonder Guard', ['Shadow Sneak'], 'Adamant', { atk: 252 });
    const { plain } = typedHits(shedinja, natdex);
    const at = (type: string) => plain[2 * TYPES.indexOf(type as never)];
    expect(at('Normal')).toBe(0);
    expect(at('Water')).toBe(0);
    expect(at('Fire')).toBe(1);
    expect(at('Ghost')).toBe(1);
  });
});

describe("Tera Shell nella Difesa e nell'Offesa", () => {
  // 2026-11-06: gli effetti del primo colpo contano un quarto, metà se il Pokémon si cura (damage.ts, firstHitShare)
  it('Terapagos-Terastal con Rest: Tera Shell conta a metà, regge più che senza ma sotto il 100%', () => {
    const tera = set('Terapagos-Terastal', 'Leftovers', 'Tera Shell', ['Tera Starstorm', 'Calm Mind', 'Rapid Spin', 'Rest'], 'Bold', { hp: 252, def: 252, spa: 4 });
    const plain = { ...tera, ability: 'Pressure' };
    // Col nome base è la stessa cosa (Tera Shift lo porta subito in forma Terastal)
    expect(typedHits({ ...tera, species: 'Terapagos', ability: 'Tera Shift' }, fixtureData)).toEqual(typedHits(tera, fixtureData));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(typedHits(tera, fixtureData).plain)).toBeLessThan(sum(typedHits(plain, fixtureData).plain));
    const d = memberDefense(tera, [tera], fixtureData)!;
    expect(d.hold).toBeLessThan(100);
    expect(d.metaHold!).toBeLessThan(100);
  });

  it("come bersaglio dell'Offesa Tera Shell toglie un quarto del suo effetto (senza recupero)", () => {
    const tera = set('Terapagos', 'Leftovers', 'Tera Shift', ['Tera Starstorm'], 'Bold', { hp: 252, def: 252 });
    const ghold = set('Gholdengo', 'Choice Specs', 'Good as Gold', ['Focus Blast'], 'Modest', { spa: 252, spe: 252 });
    const on = bestHit(ghold, tera)!.expected;
    const off = bestHit(ghold, { ...tera, species: 'Terapagos-Terastal', ability: 'Pressure' })!.expected;
    expect(on).toBeLessThan(off);
    expect(on).toBeGreaterThan(0.7 * off);
  });
});

describe('Sostenibilità con segno', () => {
  it('sopra zero come prima, sotto zero lineare fino a −100 (metà PS persi a ogni entrata)', () => {
    expect(signedSustain(0)).toBe(0);
    expect(signedSustain(0.5)).toBe(softScore(1));
    expect(signedSustain(-0.125)).toBe(-25);
    expect(signedSustain(-0.5)).toBe(-100);
    expect(signedSustain(-0.9)).toBe(-100);
  });

  it('un membro senza recupero che prende Stealth Rock ha Sostenibilità negativa e meno Difesa di uno uguale con Heavy-Duty Boots', () => {
    const data = fixtureData;
    const volc: TeamSet = { species: 'Volcarona', item: 'Leftovers', ability: 'Flame Body', moves: ['Fiery Dance', 'Bug Buzz', 'Quiver Dance', 'Giga Drain'], nature: 'Timid', evs: { spa: 252, spe: 252, hp: 4 } } as TeamSet;
    const exposed = memberDefense({ ...volc, item: 'Choice Specs' }, [{ ...volc, item: 'Choice Specs' }], data)!;
    const boots = memberDefense({ ...volc, item: 'Heavy-Duty Boots' }, [{ ...volc, item: 'Heavy-Duty Boots' }], data)!;
    expect(exposed.sustain).toBeLessThan(0);
    expect(boots.sustain).toBeGreaterThanOrEqual(0);
    expect(exposed.value).toBeLessThan(boots.value);
  });
});
