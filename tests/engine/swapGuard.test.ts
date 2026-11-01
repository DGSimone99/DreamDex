import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { describeDiff } from '../../src/engine/coach';
import { diffContribution } from '../../src/engine/replace';
import { initGameNames } from '../../src/i18n/game';
import { teamNeeds } from '../../src/engine/needs';
import { levelOf } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { lostResistances, lostRoles, rolePenalty, ROLE_PENALTY } from '../../src/engine/swapGuard';
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
    expect(rolePenalty(lost)).toBe(ROLE_PENALTY.essential);
  });

  it('nel bulky offense la stessa perdita sono gli hazard', () => {
    const bo = (team: TeamSet[]) => teamNeeds(team, fixtureData, undefined, 'bulkyOffense');
    expect(lostRoles(bo(balance), bo(swapped)).map(r => r.key)).toContain('hazards');
  });

  it('una voce che mancava già non conta, una riempita neppure', () => {
    // Al contrario: gli hazard si riempiono, niente di perso
    expect(lostRoles(needs(swapped), needs(balance))).toEqual([]);
  });

  it('penalità: 3 per essenziale, 2 per importante', () => {
    expect(rolePenalty([{ key: 'hazards', level: 'important' }, { key: 'specialWall', level: 'essential' }])).toBe(5);
    expect(rolePenalty([])).toBe(0);
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
