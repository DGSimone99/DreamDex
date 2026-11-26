import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { describeDiff } from '../../src/engine/coach';
import { diffContribution } from '../../src/engine/replace';
import { initGameNames } from '../../src/i18n/game';
import { teamNeeds } from '../../src/engine/needs';
import { levelOf } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rateTeam } from '../../src/engine/rating';
import { rankedChanges } from '../../src/engine/coach';
import { HELPER_PENALTY, lostHelpers, lostResistances, lostRoles } from '../../src/engine/swapGuard';
import { netGain, rankByTeamGain } from '../../src/engine/teamGain';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const fast = { atk: 252, spe: 252, hp: 4 };

// Balance con un solo hazard setter (Garchomp con Stealth Rock)
const balance: TeamSet[] = [
  set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off'], 'Jolly', fast),
  set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', fast),
  set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'], 'Jolly', fast),
  set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', { hp: 252, spd: 252, def: 4 }),
];
const attacker = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Close Combat', 'Knock Off', 'Spirit Break', 'Swords Dance'], 'Jolly', fast);
const swapped = balance.map((m, i) => (i === 2 ? attacker : m));
const needs = (team: TeamSet[]) => teamNeeds(team, fixtureData, undefined, 'balance');

describe('swapGuard', () => {
  it('perde l\'unico hazard setter: voce persa col livello del tipo scelto', () => {
    // Gli hazard sono la voce di campo (2026-11-01), essenziale nel Balance: perdere l'unico hazard setter è perdere quella
    const level = levelOf('balance', 'hazards');
    expect(level).toBe('essential');
    const lost = lostRoles(needs(balance), needs(swapped));
    expect(lost).toEqual([{ key: 'hazards', level }]);
  });

  it('nel bulky offense la stessa perdita sono gli hazard', () => {
    const bo = (team: TeamSet[]) => teamNeeds(team, fixtureData, undefined, 'bulkyOffense');
    expect(lostRoles(bo(balance), bo(swapped)).map(r => r.key)).toContain('hazards');
  });

  it('una voce che mancava già non conta, una riempita neppure', () => {
    // Al contrario: gli hazard si riempiono, niente di perso
    expect(lostRoles(needs(swapped), needs(balance))).toEqual([]);
  });

  it('resistenze uniche perse: Clodsire era l\'unico immune a Elettro', () => {
    const before = [
      set('Clodsire', 'Leftovers', 'Unaware', ['Spikes', 'Recover', 'Earthquake', 'Toxic'], 'Careful', bulky),
      set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', bulky),
      set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Defog'], 'Impish', bulky),
    ];
    const after = [set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Body Press', 'Iron Defense', 'Crunch', 'Roar'], 'Impish', bulky), before[1], before[2]];
    expect(lostResistances(before, after)).toContain('Electric');
    expect(lostResistances(before, before)).toEqual([]);
  });
});

describe('ruoli d\'aiuto protetti nel Coaching', () => {
  // Il Balance di sopra: Toxapex è l'unico col danno nel tempo (Toxic) e con l'anti-setup (Haze); i pivot sono due
  // (Dragapult e Corviknight con U-turn); Great Tusk è l'unico con Knock Off
  const rate = (team: TeamSet[]) => rateTeam(team, fixtureData, 'it')!;
  const withMoves = (index: number, moves: string[]) => balance.map((m, i) => (i === index ? { ...m, moves } : m));
  const noToxic = withMoves(5, ['Surf', 'Recover', 'Haze', 'Ice Beam']);
  const before = rate(balance);

  it('il danno nel tempo qui è un ruolo minore: il voto non lo paga', () => {
    expect(before.roles.rows.find(r => r.key === 'dot')).toMatchObject({ level: 'minor' });
    expect(before.roles.rows.find(r => r.key === 'dot')!.value).toBeGreaterThanOrEqual(0.5);
  });

  it('togliere l\'unico Toxic: il team perde il danno nel tempo; rimetterlo non dà niente', () => {
    expect(lostHelpers(before, rate(noToxic))).toEqual(['dot']);
    expect(lostHelpers(rate(noToxic), before)).toEqual([]);
    expect(lostHelpers(before, before)).toEqual([]);
  });

  it('se un altro membro lo porta ancora, niente è perso', () => {
    // Un pivot su due resta: togliere U-turn a Dragapult non perde il ruolo
    expect(lostHelpers(before, rate(withMoves(3, ['Draco Meteor', 'Shadow Ball', 'Thunderbolt', 'Flamethrower'])))).toEqual([]);
    // Con Toxic anche su Corviknight, Toxapex può lasciarlo
    const twoToxic = withMoves(4, ['Brave Bird', 'Roost', 'U-turn', 'Toxic']);
    const twoBefore = rate(twoToxic);
    expect(lostHelpers(twoBefore, rate(twoToxic.map((m, i) => (i === 5 ? noToxic[5] : m))))).toEqual([]);
  });

  it('attaccanti, muri e recupero non sono protetti: li misurano Attacco e Difesa', () => {
    // Via Toxapex per un attaccante: si perdono solo gli aiuti (danno nel tempo, anti-setup), non "muro" o "recupero"
    const lost = lostHelpers(before, rate(balance.map((m, i) => (i === 5 ? attacker : m))));
    expect(lost).toContain('dot');
    for (const key of lost) expect(['dot', 'disruptor', 'itemRemoval', 'pivot', 'phazer', 'support']).toContain(key);
  });

  it('il cambio di mossa che toglie l\'unico Toxic scende di un punto in classifica; il voto mostrato resta quello vero', () => {
    const [ranked] = rankByTeamGain([{ set: noToxic[5], score: 0 }], balance, 5, fixtureData, 'it');
    const gain = ranked.teamGain!;
    expect(gain.lostHelpers).toEqual(['dot']);
    expect(gain.penalty).toBe(HELPER_PENALTY);
    expect(gain.gain).toBe(rate(noToxic).overall - before.overall);
    expect(netGain(gain)).toBe(gain.gain - HELPER_PENALTY);
  });

  it('fra i contro del cambio: "Il team resta senza Danno nel Tempo", senza punti', () => {
    const [ranked] = rankByTeamGain([{ set: noToxic[5], score: 0 }], balance, 5, fixtureData, 'it');
    const empty = { roles: [], covers: [], resists: [] };
    const { cons } = rankedChanges({ gains: empty, losses: empty, lostResists: [] }, ranked.teamGain, 'it');
    expect(cons).toContainEqual(expect.objectContaining({ text: 'Il team resta senza Danno nel Tempo', points: 0 }));
  });
});

describe('cosa perdi: resistenze uniche', () => {
  const clodsire = set('Clodsire', 'Leftovers', 'Unaware', ['Spikes', 'Recover', 'Earthquake', 'Toxic'], 'Careful', bulky);
  const zamazenta = set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Body Press', 'Iron Defense', 'Crunch', 'Roar'], 'Impish', bulky);
  const rest = [
    set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', bulky),
    set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Defog'], 'Impish', bulky),
  ];

  it('il diff segna i tipi a cui nessuno resiste più, e non li ripete fra le resistenze perse', () => {
    const diff = diffContribution(clodsire, zamazenta, analyzeTeam(rest, fixtureData), rest);
    expect(diff.lostResists).toContain('Electric');
    expect(diff.losses.resists).not.toContain('Electric');
  });

  it('describeDiff: una sola riga "nessuno resiste più" per tutti i tipi, in italiano e in inglese', () => {
    const diff = { ...diffContribution(clodsire, zamazenta, analyzeTeam(rest, fixtureData), rest), lostResists: ['Electric' as const, 'Rock' as const] };
    expect(describeDiff(diff, 'en').cons).toContain('Nobody resists Electric, Rock anymore');
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { electric: 'Elettro', rock: 'Roccia' } });
    try {
      expect(describeDiff(diff, 'it').cons.filter(c => c.startsWith('Nessuno resiste'))).toEqual(['Nessuno resiste più ad Elettro, Roccia']);
    } finally {
      initGameNames(null);
    }
  });

  it('in italiano "ad" davanti a vocale: ad Acqua, ad Acciaio, ma a Fuoco', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { water: 'Acqua', steel: 'Acciaio', fire: 'Fuoco' } });
    try {
      const diff = { gains: { roles: [], covers: [], resists: ['Water' as const] }, losses: { roles: [], covers: [], resists: ['Steel' as const] }, lostResists: ['Fire' as const] };
      const text = describeDiff(diff, 'it');
      expect(text.pros).toContain('Resistente ad Acqua');
      expect(text.cons).toContain('Non più resistente ad Acciaio');
      expect(text.cons).toContain('Nessuno resiste più a Fuoco');
    } finally {
      initGameNames(null);
    }
  });
});
