import { describe, expect, it } from 'vitest';
import {
  CREDIT_FLOOR, HOLE_HIT, memberOffense, offenseCredit, OFFENSE_DEPTH, OFFENSE_SHARES, ONE_USE_SHARE, ROLES_SETUP_SHARE, rolesMemberOffense,
  SETUP_SHARE, stepBucket, stepValue, teamOffense, type MemberOffense,
} from '../../src/engine/offense';
import { bestHit } from '../../src/engine/damage';
import { coverageTargets, teamCoverage } from '../../src/engine/coverage';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs'], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature, evs, ...extra });

const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const gen9 = { stats: null, sets: null, formatId: 'gen9ou' as const };
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Stone Edge'], 'Adamant', { atk: 252, spe: 252 });
const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Toxic', 'Seismic Toss', 'Stealth Rock'], 'Bold', { hp: 252, def: 252 });
/** Somma dei danni % sui 18 bersagli: confronta il danno anche dove il credito resta 0. */
const damage = (m: MemberOffense) => m.hits.reduce((a, h) => a + h.pct, 0);
const meanCredit = (m: MemberOffense) => m.hits.reduce((a, h) => a + h.credit, 0) / m.hits.length;

describe('stepValue (misura dei Ruoli)', () => {
  it('0 sotto il 33%, 0,5 per un 3HKO, 1 per un 2HKO, 1,5 per un OHKO sicuro; le mosse OHKO mai 1,5', () => {
    expect(stepValue({ move: 'Earthquake', expected: 0.32, min: 0.3, max: 0.3 })).toBe(0);
    expect(stepValue({ move: 'Earthquake', expected: 0.34, min: 0.3, max: 0.3 })).toBe(0.5);
    expect(stepValue({ move: 'Earthquake', expected: 0.5, min: 0.45, max: 0.45 })).toBe(1);
    expect(stepValue({ move: 'Earthquake', expected: 1.2, min: 1, max: 1 })).toBe(1.5);
    expect(stepValue({ move: 'Sheer Cold', expected: 0.3, min: 1, max: 1 })).toBe(0);
    expect(stepValue(null)).toBe(0);
  });

  it('la soglia di una casella si legge anche dai valori medi', () => {
    expect([1.5, 1.25, 1, 0.875, 0.75, 0.625, 0.5, 0.25, 0.1, 0].map(stepBucket))
      .toEqual(['ohko', 'ohko', 'two', 'two', 'two', 'three', 'three', 'three', 'none', 'none']);
  });
});

describe('il credito', () => {
  it('solo il danno sopra il 33%, pieno con l\'OHKO', () => {
    expect(CREDIT_FLOOR).toBeCloseTo(1 / 3, 10);
    expect(offenseCredit(0.3)).toBe(0);
    expect(offenseCredit(1 / 3)).toBe(0);
    expect(offenseCredit(0.5)).toBeCloseTo(0.25, 5);
    expect(offenseCredit(2 / 3)).toBeCloseTo(0.5, 5);
    expect(offenseCredit(1)).toBe(1);
    expect(offenseCredit(1.4)).toBe(1);
  });

  it('le quote: setup un terzo, Tera/Z un quarto, profondità 50/30/20, tipi 70 e meta 30; i Ruoli tengono il setup a tre quarti', () => {
    expect(SETUP_SHARE).toBeCloseTo(1 / 3, 10);
    expect(ONE_USE_SHARE).toBe(0.25);
    expect(OFFENSE_DEPTH).toEqual([0.5, 0.3, 0.2]);
    expect(OFFENSE_SHARES).toEqual({ types: 0.7, meta: 0.3 });
    expect(ROLES_SETUP_SHARE).toBe(0.75);
  });
});

describe('memberOffense', () => {
  it('il valore del membro è la media dei crediti sui 18 Pokémon medi', () => {
    const m = memberOffense(chomp, [chomp], noStats)!;
    expect(m.hits).toHaveLength(18);
    expect(m.hits.map(h => h.label)).toEqual(coverageTargets(noStats, 'types').map(t => t.label));
    expect(m.value).toBe(Math.round(100 * meanCredit(m)));
    for (const h of m.hits) expect(h.credit).toBeCloseTo(offenseCredit(h.pct / 100), 1);
  });

  it('il danno di un bersaglio è il colpo migliore con qualunque mossa, al massimo il 100%', () => {
    const m = memberOffense(chomp, [chomp], noStats)!;
    const targets = coverageTargets(noStats, 'types');
    targets.forEach((t, i) => expect(m.hits[i].pct).toBe(Math.floor(100 * Math.min(1, bestHit(chomp, t.set)?.expected ?? 0))));
    const ninetales = set('Ninetales', 'Life Orb', 'Drought', ['Weather Ball', 'Encore'], 'Modest', { spa: 252, spe: 252 });
    for (const h of memberOffense(ninetales, [ninetales], noStats)!.hits) { expect(h.pct).toBeLessThanOrEqual(100); expect(h.credit).toBeLessThanOrEqual(1); }
  });

  it('una mossa speciale debole su un attaccante fisico non conta', () => {
    const plain = memberOffense(chomp, [chomp], fixtureData)!;
    const withWeak = memberOffense({ ...chomp, moves: [...chomp.moves, 'Earth Power'] }, [chomp], fixtureData)!;
    expect(withWeak.value).toBe(plain.value);
  });

  it('Body Press con Iron Defense è un setup, senza no', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
    expect(memberOffense(corv, [corv], fixtureData)!.setupMove).toBe('Iron Defense');
    const noSetup = { ...corv, moves: ['Body Press', 'Roost', 'U-turn'] };
    expect(memberOffense(noSetup, [noSetup], fixtureData)!.setupMove).toBeNull();
  });

  it('setup a un terzo del guadagno dopo una danza; setupGain è quanto alza il valore', () => {
    const sd = { ...chomp, moves: ['Swords Dance', 'Earthquake', 'Stone Edge'] };
    const m = memberOffense(sd, [sd], noStats)!;
    expect(m.setupMove).toBe('Swords Dance');
    expect(m.setupGain).toBeGreaterThan(0);
    expect(m.value - m.setupGain).toBe(memberOffense(chomp, [chomp], noStats)!.value);
    expect(memberOffense(chomp, [chomp], noStats)!.setupGain).toBe(0);
  });

  it('la pioggia del team alza il danno di chi ne gode; chi la porta con l\'abilità la ha piena', () => {
    const swim = set('Vaporeon', 'Leftovers', 'Water Absorb', ['Scald', 'Wish'], 'Bold', { hp: 252, def: 252 });
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Hydro Pump', 'U-turn', 'Roost'], 'Modest', { hp: 248, spa: 252 });
    expect(damage(memberOffense(swim, [swim, pelipper], noStats)!)).toBeGreaterThan(damage(memberOffense(swim, [swim], noStats)!));
    const politoed = set('Politoed', 'Damp Rock', 'Drizzle', ['Scald'], 'Calm', { hp: 252, spd: 252 });
    const keenEye = { ...pelipper, ability: 'Keen Eye' };
    expect(damage(memberOffense(pelipper, [pelipper], fixtureData)!)).toBeGreaterThanOrEqual(damage(memberOffense(keenEye, [keenEye, politoed], fixtureData)!));
  });

  it('il sole che arriva solo da una mossa vale un quarto: meno di Drought, più di niente', () => {
    const fire = set('Arcanine', 'Leftovers', 'Intimidate', ['Flamethrower'], 'Bold', { hp: 252, def: 252 });
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', { hp: 252, def: 252 });
    const sunnyDay = set('Torkoal', 'Heat Rock', 'White Smoke', ['Lava Plume', 'Sunny Day'], 'Bold', { hp: 252, def: 252 });
    const none = damage(memberOffense(fire, [fire], noStats)!);
    const byMove = damage(memberOffense(fire, [fire, sunnyDay], noStats)!);
    const byAbility = damage(memberOffense(fire, [fire, torkoal], noStats)!);
    expect(byMove).toBeGreaterThan(none);
    expect(byAbility).toBeGreaterThan(byMove);
    // Se il sole c'è anche da abilità, la mossa non lo dimezza
    expect(damage(memberOffense(fire, [fire, sunnyDay, torkoal], noStats)!)).toBe(byAbility);
  });

  it('il sole non abbassa mai il danno', () => {
    const water = set('Kingdra', 'Choice Specs', 'Sniper', ['Hydro Pump', 'Draco Meteor'], 'Modest', { spa: 252, spe: 252 });
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', { hp: 252, def: 252 });
    expect(memberOffense(water, [water, torkoal], fixtureData)!.value).toBe(memberOffense(water, [water], fixtureData)!.value);
  });

  it('ogni membro usa il meteo del team che gli conviene: un Fuoco col sole anche se c\'è anche la pioggia', () => {
    const fire = set('Arcanine', 'Leftovers', 'Intimidate', ['Flamethrower'], 'Bold', { hp: 252, def: 252 });
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane'], 'Modest', { hp: 248, spa: 252 });
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', { hp: 252, def: 252 });
    const sunOnly = damage(memberOffense(fire, [fire, torkoal], noStats)!);
    expect(sunOnly).toBeGreaterThan(damage(memberOffense(fire, [fire], noStats)!));
    expect(damage(memberOffense(fire, [fire, pelipper, torkoal], noStats)!)).toBe(sunOnly);
  });

  it('il Tera conta solo dove il formato lo permette, un quarto del guadagno, mostrato a parte', () => {
    const gambit = set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 252, atk: 252 });
    const tera = memberOffense({ ...gambit, teraType: 'Dark' }, [gambit], gen9)!;
    const plain = memberOffense(gambit, [gambit], gen9)!;
    expect(tera.oneUse).toEqual({ kind: 'tera', name: 'Dark' });
    expect(tera.oneUseGain).toBeGreaterThan(0);
    expect(tera.value - tera.oneUseGain).toBe(plain.value);
    expect(memberOffense({ ...gambit, teraType: 'Dark' }, [gambit], noStats)!.value).toBe(memberOffense(gambit, [gambit], noStats)!.value);
  });

  it('la mossa Z conta allo stesso modo (National Dex)', () => {
    const kyurem = set('Kyurem', 'Groundium Z', 'Pressure', ['Earth Power', 'Ice Beam'], 'Timid', { spa: 252, spe: 252 });
    const m = memberOffense(kyurem, [kyurem], noStats)!;
    expect(m.oneUse).toEqual({ kind: 'z', name: 'Groundium Z' });
    expect(m.oneUseGain).toBeGreaterThanOrEqual(0);
    expect(memberOffense(chomp, [chomp], noStats)!.oneUse).toBeNull();
  });

  it('Belly Drum e Curse sono setup', () => {
    const azu = set('Azumarill', 'Sitrus Berry', 'Huge Power', ['Belly Drum', 'Aqua Jet', 'Play Rough', 'Knock Off'], 'Adamant', { hp: 252, atk: 252 });
    const snorlax = set('Snorlax', 'Leftovers', 'Thick Fat', ['Curse', 'Body Slam', 'Rest', 'Sleep Talk'], 'Careful', { hp: 252, spd: 252 });
    expect(memberOffense(azu, [azu], fixtureData)!.setupMove).toBe('Belly Drum');
    expect(memberOffense(snorlax, [snorlax], fixtureData)!.setupMove).toBe('Curse');
  });

  it('col meta il totale del membro è 70% il suo valore + 30% la sua Coverage meta; senza meta è il valore', () => {
    const m = memberOffense(chomp, [chomp], fixtureData)!;
    expect(m.coverMeta).toBe(teamCoverage([chomp], fixtureData, 'meta').perMember[0]);
    expect(m.total).toBe(Math.round(0.7 * m.value + 0.3 * m.coverMeta!));
    const plain = memberOffense(chomp, [chomp], { ...fixtureData, ignoreMeta: true })!;
    expect(plain.coverMeta).toBeNull();
    expect(plain.total).toBe(plain.value);
  });

  it('il valore è lo stesso con e senza meta', () => {
    expect(memberOffense(chomp, [chomp], { ...fixtureData, ignoreMeta: true })!.value).toBe(memberOffense(chomp, [chomp], fixtureData)!.value);
  });

  it('una specie sconosciuta non conta; lo stesso set dà lo stesso risultato', () => {
    expect(memberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
    expect(memberOffense(chomp, [chomp], fixtureData)).toEqual(memberOffense({ ...chomp }, [chomp], fixtureData));
  });

  it('il colpo migliore di ogni membro è una delle sue mosse d\'attacco', () => {
    const team = teamOffense([chomp, blissey], noStats);
    expect(team.members[0].bestMove).toBe('Earthquake');
    expect(team.members[1].bestMove).toBe('Seismic Toss');
  });
});

describe('teamOffense: il pacchetto dei tipi', () => {
  it('profondità 50/30/20 per bersaglio, poi la media: un solo membro vale metà dei suoi crediti', () => {
    const team = teamOffense([chomp], noStats);
    expect(team.types.value).toBe(Math.round(100 * 0.5 * meanCredit(team.members[0])));
  });

  it('con tre membri contano tutti e tre, il migliore per primo', () => {
    const team = teamOffense([chomp, tusk, blissey], noStats);
    const credits = team.members.map(m => m.hits.map(h => h.credit));
    const expected = credits[0].map((_, i) => credits.map(c => c[i]).sort((a, b) => b - a).reduce((a, c, k) => a + OFFENSE_DEPTH[k] * c, 0));
    expect(team.types.value).toBe(Math.round(100 * expected.reduce((a, b) => a + b, 0) / 18));
  });

  it('un supporto senza attacchi aggiunge 0 ma non abbassa il team', () => {
    const support = { ...blissey, moves: ['Soft-Boiled', 'Toxic', 'Stealth Rock', 'Heal Bell'] };
    expect(teamOffense([chomp, tusk, support], noStats).types.value).toBe(teamOffense([chomp, tusk], noStats).types.value);
  });

  it('senza meta: Offesa = pacchetto', () => {
    const team = teamOffense([chomp, tusk], noStats);
    expect(team.coverageMeta).toBeNull();
    expect(team.value).toBe(team.types.value);
  });

  it('col meta: Offesa = pacchetto 70% + Coverage meta 30%', () => {
    const team = teamOffense([chomp, tusk], fixtureData);
    expect(team.value).toBe(Math.round(0.7 * team.types.value + 0.3 * team.coverageMeta!.value));
  });

  it('per ogni tipo: il livello del team e i migliori tre con credito; buchi dove nessuno lo manda KO in due colpi', () => {
    const team = teamOffense([chomp], noStats);
    expect(team.types.rows).toHaveLength(18);
    const electric = team.types.rows.find(r => r.label === 'Electric')!;
    expect(electric.best.map(b => [b.species, b.move])).toEqual([['Garchomp', 'Earthquake']]);
    expect(electric.level).toBe(Math.round(100 * 0.5 * electric.best[0].credit));
    // Il Volante, immune a Earthquake: lo colpisce Stone Edge
    expect(team.members[0].hits.find(h => h.label === 'Flying')!.move).toBe('Stone Edge');
    team.types.rows.forEach((row, i) => expect(team.types.holes.includes(row.label)).toBe(!team.members.some(m => m.hits[i].pct >= 100 * HOLE_HIT)));
  });

  it('il setup alza l\'Offesa del team; setupGain e setters', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const team = teamOffense([gliscor, chomp], noStats);
    expect(team.setupGain).toBeGreaterThan(0);
    expect(team.setters).toEqual([{ species: 'Gliscor', move: 'Swords Dance' }]);
    expect(teamOffense([chomp], noStats).setupGain).toBe(0);
  });

  it('un team senza mosse d\'attacco vale 0, senza NaN; un team incompleto dà un numero', () => {
    const wall = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Toxic', 'Haze', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252 });
    const team = teamOffense([wall], fixtureData);
    expect([team.types.value, team.setupGain]).toEqual([0, 0]);
    expect(Number.isNaN(team.value)).toBe(false);
    expect(team.setters).toEqual([]);
    expect(Number.isFinite(teamOffense([chomp], fixtureData).value)).toBe(true);
    expect(teamOffense([], noStats).value).toBe(0);
  });

  it('un membro sconosciuto si salta; senza statistiche si usa il tier', () => {
    const notamon = set('Notamon', '', '', ['Tackle'], 'Hardy', {});
    expect(teamOffense([tusk, notamon], fixtureData).value).toBe(teamOffense([tusk], fixtureData).value);
    expect(teamOffense([tusk], noStats).value).toBeGreaterThan(0);
  });

  it('Potenza, Coverage tipi e Wallbreaking non sono più nel team', () => {
    const team = teamOffense([chomp], fixtureData);
    for (const key of ['power', 'coverage', 'coverageTypes', 'referenceAttackers', 'wallbreaking', 'walls']) expect(key in team).toBe(false);
    for (const key of ['power', 'powerInGrade', 'coverTypes']) expect(key in team.members[0]).toBe(false);
  });
});

describe('i Ruoli', () => {
  it('usano ancora la vecchia misura del membro, setup compreso', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const old = rolesMemberOffense(gliscor, [gliscor], fixtureData)!;
    expect(old.wallbreakingGain).toBeGreaterThan(0);
    expect(old.setupMove).toBe('Swords Dance');
    expect(rolesMemberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
  });
});

describe('correzioni della revisione finale', () => {
  it('scoperto: nessuno lo manda KO in due colpi (sotto il 50%), anche se qualcuno conta', () => {
    expect(HOLE_HIT).toBe(0.5);
    // Toxapex con Surf fa il 33,5% al Terra medio: conta poco, ma il Terra resta scoperto
    const pex = set('Toxapex', '', 'Regenerator', ['Surf'], 'Bold', { hp: 252, def: 252 });
    const team = teamOffense([pex], noStats);
    expect(team.types.rows.find(r => r.label === 'Ground')!.best.length).toBeGreaterThan(0);
    expect(team.types.holes).toContain('Ground');
    // Garchomp con Earthquake manda KO in due colpi l'Elettro medio: non è scoperto
    expect(teamOffense([pex, chomp], noStats).types.holes).not.toContain('Electric');
  });
});

describe('quanto porta ogni membro (la Generale)', () => {
  const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover'], 'Bold', { hp: 252, def: 252 });

  it('tipi del membro: quanti ne manda KO, quanti colpisce forte (oltre 66%) e quanti contano (oltre 33%), senza doppioni', () => {
    const team = teamOffense([chomp, tusk], noStats);
    team.members.forEach((m, i) => {
      const share = team.shares[i];
      expect(share.species).toBe(m.species);
      expect(share.types.ohko).toBe(m.hits.filter(h => h.credit >= 1).length);
      expect(share.types.strong).toBe(m.hits.filter(h => h.credit >= 0.5 && h.credit < 1).length);
      expect(share.types.counts).toBe(m.hits.filter(h => h.credit > 0 && h.credit < 0.5).length);
    });
  });

  it('i punti dei membri sommati danno il voto del team, col meta e senza', () => {
    for (const data of [fixtureData, noStats]) {
      const team = teamOffense([chomp, tusk, pex], data);
      expect(team.shares.reduce((a, s) => a + s.points, 0)).toBe(team.value);
    }
  });

  it('chi non porta crediti porta 0; il migliore porta di più', () => {
    const support = { ...blissey, moves: ['Soft-Boiled', 'Toxic', 'Stealth Rock', 'Heal Bell'] };
    const team = teamOffense([chomp, support], noStats);
    expect(team.shares[1].points).toBe(0);
    expect(team.shares[0].points).toBe(team.value);
  });

  it('a pari merito su un bersaglio due membri si dividono il peso: due set uguali portano uguale', () => {
    const team = teamOffense([chomp, { ...chomp }], noStats);
    expect(Math.abs(team.shares[0].points - team.shares[1].points)).toBeLessThanOrEqual(1);
  });

  it('meta del membro: quanti bersagli del meta manda KO in due colpi, sul totale; null senza meta', () => {
    const team = teamOffense([chomp, tusk], fixtureData);
    const rows = team.coverageMeta!.rows;
    team.members.forEach((m, i) => expect(team.shares[i].meta).toEqual({ covered: rows.filter(r => r.coveredBy.some(c => c.species === m.species)).length, total: rows.length }));
    expect(teamOffense([chomp], noStats).shares[0].meta).toBeNull();
  });
});
