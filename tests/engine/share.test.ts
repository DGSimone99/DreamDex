import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE, type FormatChoice } from '../../src/engine/formatChoice';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { decodeShare, encodeShare } from '../../src/share';

const team = [
  { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Earthquake', 'Stealth Rock'], nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } },
  { ...emptySet('Flabébé'), ability: 'Flower Veil', moves: ['Moonblast'], customSkillset: true },
];
const choice: FormatChoice = { ...DEFAULT_CHOICE, tier: 'Ubers' };
const json = (t: TeamSet[], c: FormatChoice) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ team: t, choice: c }))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const six: TeamSet[] = [
  { species: 'Great Tusk', item: 'Booster Energy', ability: 'Protosynthesis', moves: ['Headlong Rush', 'Ice Spinner', 'Knock Off', 'Rapid Spin'], nature: 'Jolly', evs: { atk: 252, spd: 4, spe: 252 }, teraType: 'Steel' },
  { species: 'Gholdengo', item: 'Choice Scarf', ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Trick', 'Focus Blast'], nature: 'Timid', evs: { spa: 252, spd: 4, spe: 252 }, teraType: 'Steel' },
  { species: 'Kingambit', item: 'Leftovers', ability: 'Supreme Overlord', moves: ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], nature: 'Adamant', evs: { hp: 236, atk: 252, spe: 20 }, teraType: 'Dark' },
  { species: 'Dragapult', item: 'Choice Specs', ability: 'Infiltrator', moves: ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], nature: 'Timid', evs: { spa: 252, spd: 4, spe: 252 }, teraType: 'Ghost' },
  { species: 'Toxapex', item: 'Black Sludge', ability: 'Regenerator', moves: ['Scald', 'Recover', 'Toxic Spikes', 'Haze'], nature: 'Bold', evs: { hp: 252, def: 252, spd: 4 }, ivs: { atk: 0 } },
  { species: 'Corviknight', item: 'Leftovers', ability: 'Pressure', moves: ['Brave Bird', 'Roost', 'Defog', 'U-turn'], nature: 'Impish', evs: { hp: 252, def: 168, spd: 88 } },
];

describe('team nel link', () => {
  it('andata e ritorno: team (anche con accenti) e formato', () => {
    const code = encodeShare(team, choice);
    expect(code).toMatch(/^[A-Za-z0-9_.~!%-]+$/);
    expect(decodeShare(`#t=${code}`)).toEqual({ team, choice });
  });

  it('un team da 6 sta in circa un terzo del link di prima', () => {
    const code = encodeShare(six, DEFAULT_CHOICE);
    expect(decodeShare(`#t=${code}`)).toEqual({ team: six, choice: DEFAULT_CHOICE });
    expect(code.length).toBeLessThan(json(six, DEFAULT_CHOICE).length / 2.5);
    expect(code).not.toMatch(/\.$/);
  });

  it('nomi fuori dal Pokédex, soprannome, shiny, preferito, IV vuoti, slot di mossa vuoto: tornano uguali', () => {
    const odd: TeamSet[] = [{
      species: 'Pikachu', item: 'Pietra Strana_~.!', ability: 'Static', moves: ['Thunderbolt', '', 'Mossa-Inventata 100%'], nature: 'Timid',
      evs: {}, ivs: {}, teraType: 'Stellar', favorite: true, shiny: true, name: 'Pika ~ chu_ é!',
    }];
    expect(decodeShare(`#t=${encodeShare(odd, DEFAULT_CHOICE)}`)).toEqual({ team: odd, choice: DEFAULT_CHOICE });
  });

  it('formati di ogni famiglia', () => {
    const choices: FormatChoice[] = [
      { ...DEFAULT_CHOICE, gen: 9, battle: 'doubles', tier: 'DOU', ignoreBans: true },
      { family: 'game', game: 'sv', allPokedex: true, legendaries: false },
      { family: 'free', genLimit: 4, multipleMegas: true },
    ];
    for (const c of choices) expect(decodeShare(`#t=${encodeShare(team, c)}`)?.choice).toEqual(decodeShare(`#team=${json(team, c)}`)?.choice);
  });

  it('i link lunghi di prima si leggono ancora', () => {
    expect(decodeShare(`#team=${json(team, choice)}`)).toEqual({ team, choice });
    const old = btoa(JSON.stringify({ team: [{ species: 'Garchomp', moves: [] }], format: { formatId: 'uu' } }));
    expect(decodeShare(`#team=${old}`)?.choice).toEqual(DEFAULT_CHOICE);
  });

  it('link rotto o assente: null', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#team=!!!')).toBeNull();
    expect(decodeShare('#t=~nonesiste')).toBeNull();
    expect(decodeShare('#t=~')).toBeNull();
    expect(decodeShare('#altro=abc')).toBeNull();
  });
});
