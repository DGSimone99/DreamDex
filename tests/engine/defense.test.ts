import { describe, expect, it } from 'vitest';
import { defensiveSetup, defenseReference, dummyAttacker, hazardRemover, holdCredit, typedHits, holdStep, intimidateBoost, memberDefense, sustainability, sustainParts, teamDefense } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';
import { softScore } from '../../src/engine/scale';
import { attackerPanels, panelWeights } from '../../src/engine/attackers';
import { standardHit } from '../../src/engine/damage';
import { fixtureData } from '../fixtures/data';
import { TYPES } from '../../src/engine/types';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const hit = (max: number) => ({ move: 'x', expected: max, min: max, max });

describe('holdStep: quanti colpi regge (dal tiro più alto)', () => {
  it('OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5', () => {
    expect([hit(1.2), hit(0.6), hit(0.4), hit(0.2)].map(holdStep)).toEqual([0, 0.5, 1, 1.5]);
    expect(holdStep(null)).toBe(1.5);
  });
});

describe('sustainability: recupero contro perdite per turno', () => {
  it('Boots e Magic Guard azzerano Stealth Rock; Magic Guard anche Life Orb', () => {
    const zard = set('Charizard', 'Leftovers', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    expect(sustainability(zard, 1.5)).toBeCloseTo(0.0625 - 0.5);
    expect(sustainability({ ...zard, item: 'Heavy-Duty Boots' }, 1.5)).toBeCloseTo(0);
    const clef = set('Clefable', 'Life Orb', 'Magic Guard', ['Moonblast', 'Moonlight'], 'Modest', { hp: 252, spa: 252 });
    expect(sustainability(clef, 1.5)).toBeCloseTo(0.5);
  });

  it('con chi toglie gli hazard nel team la Stealth Rock pesa metà (e lo dice), Life Orb no', () => {
    const zard = set('Charizard', 'Life Orb', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Defog', 'Roost'], 'Impish', { hp: 252, def: 252 });
    const remover = hazardRemover([zard, corv]);
    expect(remover).toBe('Defog (Corviknight)');
    expect(sustainParts(zard, 1.5, remover)).toMatchObject({ rocks: 0.25, rocksHalvedBy: 'Defog (Corviknight)', itemLoss: 0.1 });
    expect(sustainParts(zard, 1.5)).toMatchObject({ rocks: 0.5, rocksHalvedBy: null });
    expect(hazardRemover([zard])).toBeNull();
    // Chi non prende la Stealth Rock non ha niente da dimezzare
    expect(sustainParts({ ...zard, item: 'Heavy-Duty Boots' }, 1.5, remover).rocksHalvedBy).toBeNull();
  });

  it('Sheer Force toglie il costo di Life Orb solo se una mossa ha effetti secondari', () => {
    const king = set('Nidoking', 'Life Orb', 'Sheer Force', ['Earth Power', 'Sludge Wave'], 'Timid', { spa: 252, spe: 252 });
    expect(sustainParts(king, 1.5).itemLoss).toBe(0);
    expect(sustainParts({ ...king, moves: ['Earthquake', 'Stealth Rock'] }, 1.5).itemLoss).toBeCloseTo(0.1);
  });

  it('gli strumenti che tolgono PS: Flame Orb e Toxic Orb (non a chi è immune allo stato), Sticky Barb, Black Sludge fuori dai Veleno', () => {
    const ursa = set('Ursaluna', 'Flame Orb', 'Guts', ['Facade', 'Headlong Rush'], 'Adamant', { atk: 252 });
    expect(sustainParts(ursa, 1.5)).toMatchObject({ itemLoss: 0.0625, itemLossFrom: 'Flame Orb' });
    // Un Fuoco non si brucia, Magic Guard non prende danno
    expect(sustainParts({ ...ursa, species: 'Arcanine' }, 1.5).itemLoss).toBe(0);
    expect(sustainParts({ ...ursa, ability: 'Magic Guard' }, 1.5).itemLoss).toBe(0);
    const toxic = { ...ursa, item: 'Toxic Orb' };
    expect(sustainParts(toxic, 1.5).itemLoss).toBeCloseTo(0.125);
    expect(sustainParts({ ...toxic, species: 'Corviknight' }, 1.5).itemLoss).toBe(0);
    expect(sustainParts({ ...ursa, item: 'Sticky Barb' }, 1.5).itemLoss).toBeCloseTo(0.0625);
    // Black Sludge: cura un Veleno, toglie PS agli altri
    expect(sustainParts({ ...ursa, item: 'Black Sludge' }, 1.5)).toMatchObject({ itemLoss: 0.125, recovery: 0 });
    expect(sustainParts({ ...ursa, species: 'Toxapex', item: 'Black Sludge' }, 1.5)).toMatchObject({ itemLoss: 0, recovery: 0.0625 });
  });

  it('Poison Heal cura solo con Toxic Orb (senza, il Pokémon non è avvelenato)', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect'], 'Impish', { hp: 252, def: 252 });
    expect(sustainParts(gliscor, 1.5)).toMatchObject({ sources: ['Poison Heal'], recovery: 0.125 });
    expect(sustainParts({ ...gliscor, item: 'Leftovers' }, 1.5)).toMatchObject({ sources: ['Leftovers'], recovery: 0.0625 });
  });

  it('Regenerator vale 0,33; il recupero si dimezza per chi non regge almeno un 3HKO', () => {
    const slowbro = set('Slowbro', 'Heavy-Duty Boots', 'Regenerator', ['Slack Off', 'Scald'], 'Bold', { hp: 252, def: 252 });
    expect(sustainability(slowbro, 1)).toBeCloseTo(0.5 + 0.33);
    expect(sustainability(slowbro, 0.5)).toBeCloseTo((0.5 + 0.33) / 2);
  });
});

describe('memberDefense', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });

  it('Blissey regge meglio gli speciali dei fisici', () => {
    const m = memberDefense(blissey, [blissey], noStats)!;
    expect(m.special).toBeGreaterThan(m.physical);
  });

  it('Assault Vest alza solo la Robustezza speciale', () => {
    // Un Pokémon non già al massimo della scala sul lato speciale
    const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Jolly', { atk: 252, spe: 252 });
    const plain = memberDefense(chomp, [chomp], noStats)!;
    const av = memberDefense({ ...chomp, item: 'Assault Vest' }, [chomp], noStats)!;
    expect(av.special).toBeGreaterThan(plain.special);
    expect(av.physical).toBe(plain.physical);
  });

  it('valore = 40% Fisica + 40% Speciale + 20% Sostenibilità, mai 100', () => {
    const m = memberDefense(blissey, [blissey], fixtureData)!;
    expect(m.value).toBe(Math.round(0.4 * m.physical + 0.4 * m.special + 0.2 * m.sustain));
    expect(m.value).toBeLessThan(100);
  });

  it('dettaglio della Sostenibilità: recupero (con la fonte migliore), Stealth Rock e Life Orb', () => {
    const skarm = set('Skarmory', 'Leftovers', 'Sturdy', ['Roost', 'Body Press'], 'Impish', { hp: 252, def: 252 });
    const m = memberDefense(skarm, [skarm], noStats)!;
    expect(m.sustainParts.sources).toEqual(['Roost', 'Leftovers']);
    expect(m.sustainParts.rocks).toBeCloseTo(0.125);
    expect(m.sustainParts.itemLoss).toBe(0);
    expect(m.sustainParts.recovery).toBeCloseTo(m.sustainParts.halved ? (0.5 + 0.0625) / 2 : 0.5 + 0.0625);
    const zard = set('Charizard', 'Life Orb', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252, spe: 252 });
    const z = memberDefense(zard, [zard], noStats)!;
    expect(z.sustainParts).toMatchObject({ sources: [], recovery: 0, itemLoss: 0.1 });
    expect(z.sustainParts.rocks).toBeCloseTo(0.5);
  });

  it('Intimidate: −1 Atk agli attaccanti fisici, alza solo la Robustezza fisica', () => {
    const roar = set('Incineroar', 'Heavy-Duty Boots', 'Intimidate', ['Knock Off', 'Parting Shot'], 'Careful', { hp: 252, spd: 252 });
    const blaze = { ...roar, ability: 'Blaze' };
    const a = memberDefense(roar, [roar], noStats)!;
    const b = memberDefense(blaze, [blaze], noStats)!;
    expect(a.physical).toBeGreaterThan(b.physical);
    expect(a.special).toBe(b.special);
  });

  it("Intimidate non vale contro chi lo blocca e alza l'Attacco a Defiant e Guard Dog", () => {
    const attacker = (ability: string) => set('Kingambit', '', ability, [], 'Adamant', { atk: 252 });
    const roar = set('Incineroar', '', 'Intimidate', [], 'Careful', {});
    expect(intimidateBoost(roar, attacker('Supreme Overlord'))).toEqual({ atk: -1 });
    expect(intimidateBoost(roar, attacker('Clear Body'))).toBeUndefined();
    expect(intimidateBoost(roar, attacker('Defiant'))).toEqual({ atk: 1 });
    expect(intimidateBoost(roar, attacker('Guard Dog'))).toEqual({ atk: 1 });
    expect(intimidateBoost({ ...roar, ability: 'Blaze' }, attacker('Supreme Overlord'))).toBeUndefined();
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberDefense(set('Notamon', '', '', [], 'Hardy', {}), [], noStats)).toBeNull();
  });
});

describe('teamDefense', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });
  const skarm = set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Roost', 'Body Press', 'Spikes'], 'Impish', { hp: 252, def: 252 });
  const sweeper = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball'], 'Timid', { spa: 252, spe: 252 });

  it('robustezza del team: media pesata per posizione della robustezza dei membri, poi 80/20 con la Sostenibilità', () => {
    const team = teamDefense([blissey, skarm], noStats);
    const rw = (vals: number[]) => { const s = [...vals].sort((a, b) => b - a); return Math.round((0.30 * s[0] + 0.22 * s[1]) / 0.52); };
    expect(team.physical).toBe(rw(team.members.map(m => m.physical)));
    expect(team.special).toBe(rw(team.members.map(m => m.special)));
    // La robustezza di ogni membro (media di Fisica e Speciale) pesata per posizione, poi 80% e 20% Sostenibilità
    const robust = rw(team.members.map(m => (m.physical + m.special) / 2));
    expect(team.robustness).toBe(Math.round(0.8 * robust + 0.2 * team.sustain));
    // Un muro fisico e uno speciale non valgono come due muri completi: Skarmory (99/50) e Chansey senza Eviolite (5/99)
    const chansey = set('Chansey', 'Heavy-Duty Boots', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled'], 'Calm', { hp: 252, spd: 252 });
    const split = teamDefense([skarm, chansey], noStats);
    const means = rw(split.members.map(m => (m.physical + m.special) / 2));
    expect(Math.abs(split.robustness - Math.round(0.8 * means + 0.2 * split.sustain))).toBeLessThanOrEqual(1);
    expect(split.robustness).toBeLessThan(Math.round(0.4 * split.physical + 0.4 * split.special + 0.2 * split.sustain) - 1);
  });

  it('senza meta: Coverage solo di tipi; Difesa = 50% robustezza + 50% coverage, mai 100', () => {
    const team = teamDefense([blissey, skarm], noStats);
    expect(team.coverageMeta).toBeNull();
    expect(team.coverage).toBe(team.coverageTypes.value);
    expect(team.value).toBe(Math.round(0.5 * team.robustness + 0.5 * team.coverage));
    expect(team.value).toBeLessThan(100);
  });

  it('col meta: Coverage meta con chi regge ogni minaccia (meno del 50% pieno, 2HKO a metà)', () => {
    const team = teamDefense([blissey, skarm], fixtureData);
    expect(team.coverageMeta).not.toBeNull();
    expect(team.coverage).toBe(Math.round((team.coverageTypes.value + team.coverageMeta!.value) / 2));
    for (const row of team.coverageMeta!.rows) {
      for (const h of row.heldBy) expect(h.partial ? h.pct >= 50 && h.pct < 100 : h.pct < 50).toBe(true);
      if (!row.heldBy.some(h => !h.partial)) expect(team.coverageMeta!.unanswered).toContain(row.species);
    }
  });

  it('un team di sweeper fragili ha meno Difesa di uno di muri', () => {
    expect(teamDefense([sweeper, { ...sweeper }], noStats).value).toBeLessThan(teamDefense([blissey, skarm], noStats).value);
  });

  it('righe dei 18 tipi per il dettaglio: sicurezza 0–100 e chi è debole o resiste', () => {
    const team = teamDefense([blissey, skarm], noStats);
    expect(team.coverageTypes.rows).toHaveLength(18);
    const fighting = team.coverageTypes.rows.find(r => r.type === 'Fighting')!;
    expect(fighting.weak).toEqual(['Blissey']);
    expect(fighting.resist).toEqual([]);
    const ground = team.coverageTypes.rows.find(r => r.type === 'Ground')!;
    expect(ground.resist).toEqual(['Skarmory']);
    for (const row of team.coverageTypes.rows) {
      expect(row.safety).toBeGreaterThanOrEqual(0);
      expect(row.safety).toBeLessThanOrEqual(100);
      expect(team.coverageTypes.weak.includes(row.type)).toBe(row.weak.length > row.resist.length);
    }
  });

  it('i deboli di tipo: più membri deboli che resistenti', () => {
    const team = teamDefense([sweeper, { ...sweeper }], noStats);
    expect(team.coverageTypes.weak).toEqual(expect.arrayContaining(['Dragon', 'Ghost', 'Ice', 'Fairy', 'Dark']));
  });

  it('un membro sconosciuto si salta', () => {
    const notamon = set('Notamon', '', '', [], 'Hardy', {});
    expect(teamDefense([blissey, notamon], noStats).value).toBe(teamDefense([blissey], noStats).value);
  });
});

describe('setup difensivo', () => {
  const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Iron Defense', 'Roost', 'Brave Bird'], 'Hardy', {});
  const plainCorv = { ...corv, moves: ['Roost', 'Brave Bird'] };
  const clef = set('Clefable', 'Leftovers', 'Magic Guard', ['Calm Mind', 'Moonblast', 'Soft-Boiled'], 'Hardy', {});

  it('Iron Defense alza la robustezza fisica di metà del guadagno', () => {
    const withSetup = memberDefense(corv, [corv], noStats)!;
    const plain = memberDefense(plainCorv, [plainCorv], noStats)!;
    expect(withSetup.setupMove).toBe('Iron Defense');
    expect(withSetup.physical).toBeGreaterThan(plain.physical);
    expect(withSetup.special).toBe(plain.special);
    expect(withSetup.setupGain).toBe(withSetup.value - plain.value);
    expect(withSetup.setupGain).toBeGreaterThan(0);
  });

  it('metà del guadagno: fisica = semplice + round(0,5 × (con Difesa +2 − semplice))', () => {
    const panels = attackerPanels(noStats);
    const w = panelWeights(noStats).physical;
    const ref = defenseReference(noStats).physical;
    const score = (boost: number) => {
      const step = panels.physical.reduce((acc, a, i) => acc + w[i] * holdStep(standardHit(a, plainCorv, 'Physical', { targetBoosts: boost ? { def: boost } : undefined })), 0);
      return softScore(step / ref);
    };
    const plain = memberDefense(plainCorv, [plainCorv], noStats)!.physical;
    expect(plain).toBe(score(0));
    // Corviknight senza Intimidate: il colpo a Difesa +2 è quello del setup
    expect(memberDefense(corv, [corv], noStats)!.physical).toBe(Math.round(plain + 0.5 * (score(2) - plain)));
  });

  it('Calm Mind alza la speciale', () => {
    const withSetup = memberDefense(clef, [clef], noStats)!;
    const plain = memberDefense({ ...clef, moves: ['Moonblast', 'Soft-Boiled'] }, [clef], noStats)!;
    expect(withSetup.setupMove).toBe('Calm Mind');
    expect(withSetup.special).toBeGreaterThan(plain.special);
    expect(withSetup.physical).toBe(plain.physical);
  });

  it('contro un attaccante Unaware il setup non conta', () => {
    const quag = set('Quagsire', 'Leftovers', 'Unaware', ['Earthquake'], 'Careful', { hp: 252 });
    const plain = standardHit(quag, plainCorv, 'Physical');
    const boosted = standardHit(quag, plainCorv, 'Physical', { targetBoosts: { def: 2 } });
    expect(boosted).toEqual(plain);
    const other = standardHit({ ...quag, ability: 'Water Absorb' }, plainCorv, 'Physical', { targetBoosts: { def: 2 } })!;
    expect(other.max).toBeLessThan(plain!.max);
  });

  it('senza mosse di setup: setupGain 0; Curse solo se non Spettro', () => {
    const m = memberDefense(plainCorv, [plainCorv], noStats)!;
    expect(m).toMatchObject({ setupMove: null, setupGain: 0 });
    expect(defensiveSetup(set('Gengar', '', '', ['Curse', 'Shadow Ball'], 'Timid', {}))).toBeNull();
    expect(defensiveSetup(set('Snorlax', '', '', ['Curse', 'Rest'], 'Careful', {}))?.boosts).toEqual({ def: 1, spd: 0 });
    // La più forte per Dif. + Dif. Speciale
    expect(defensiveSetup(set('Clefable', '', '', ['Calm Mind', 'Cosmic Power', 'Iron Defense'], 'Calm', {}))?.move).toBe('Cosmic Power');
    expect(defensiveSetup(set('Notamon', '', '', ['Iron Defense'], 'Hardy', {}))?.move).toBe('Iron Defense');
  });
});

describe('attaccante finto e colpi per tipo', () => {
  const natdex = { stats: null, sets: null, formatId: 'ou' as const };
  const gen9 = { stats: null, sets: null, formatId: 'gen9ou' as const };
  const idx = (type: string, special = false) => 2 * TYPES.indexOf(type as never) + (special ? 1 : 0);

  it("l'attaccante finto ha l'Attacco medio del quarto più forte del Pokédex (in Gen 9 senza Mega)", () => {
    expect(Math.abs(dummyAttacker(natdex, 'atk', 'Normal').baseStats!.atk! - 133)).toBeLessThanOrEqual(4);
    expect(Math.abs(dummyAttacker(natdex, 'spa', 'Normal').baseStats!.spa! - 129)).toBeLessThanOrEqual(4);
    expect(dummyAttacker(gen9, 'atk', 'Normal').baseStats!.atk!).toBeLessThanOrEqual(dummyAttacker(natdex, 'atk', 'Normal').baseStats!.atk!);
    expect(dummyAttacker(natdex, 'atk', 'Fire').types).toEqual(['Fire']);
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
