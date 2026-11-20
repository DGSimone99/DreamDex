import { describe, expect, it, vi } from 'vitest';
import { doublesStyles, teamArchetype } from '../../src/engine/archetype';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { defaultChoice, DOUBLES_FILL_STYLES, FILL_STYLES, fillProposals, fillStylesFor, matchesChoice, type FillChoice, type FillStyle } from '../../src/engine/fillProposals';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { asSetter, asUser, setsUp, uses } from '../../src/engine/styleSets';
import { fillData } from '../fixtures/fillData';

// Calcola proposte intere: sotto il carico della suite completa supera il tempo di default
vi.setConfig({ testTimeout: 120000 });

const mk = (species: string, ability: string, moves: string[], item = ''): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } });
const doubles: Format = { ...DEFAULT_FORMAT, formatId: 'natdexdoubles' };
const data = { ...fillData, formatId: 'natdexdoubles' as const };

const pelipper = mk('Pelipper', 'Drizzle', ['Hurricane', 'Scald', 'Protect']);
const kingdra = mk('Kingdra', 'Swift Swim', ['Muddy Water', 'Draco Meteor', 'Protect']);
const rillaboom = mk('Rillaboom', 'Grassy Surge', ['Fake Out', 'Wood Hammer', 'U-turn']);
const ogerpon = mk('Ogerpon', 'Defiant', ['Ivy Cudgel', 'Horn Leech', 'Follow Me', 'Spiky Shield']);
const tornadus = mk('Tornadus', 'Prankster', ['Tailwind', 'Bleakwind Storm', 'Protect']);
const incineroar = mk('Incineroar', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']);
const garchomp = mk('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect']);
const kingambit = mk('Kingambit', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect']);
const mixed = [pelipper, kingdra, rillaboom, ogerpon, tornadus, incineroar];
const choose = (team: TeamSet[], style: FillStyle | null): FillChoice => ({ ...defaultChoice(team), style });

describe('doppio: tutti gli stili del team', () => {
  it('pioggia, Campo Erboso e Tailwind insieme: tutti e tre, ma l\'etichetta mostrata resta una', () => {
    expect(doublesStyles(mixed)).toEqual(expect.arrayContaining(['rain', 'grassyterrain', 'tailwind']));
    expect(teamArchetype(mixed, DOUBLES_RULES)!.styles).toHaveLength(1);
  });

  it('uno stile senza chi lo sfrutta non c\'è; Tailwind c\'è appena un membro lo porta', () => {
    expect(doublesStyles([pelipper, garchomp, incineroar])).toEqual([]);
    expect(doublesStyles([tornadus, garchomp, incineroar])).toEqual(['tailwind']);
    expect(doublesStyles([])).toEqual([]);
  });
});

describe('doppio: il team ha lo stile chiesto', () => {
  it('Campo Erboso chiesto a un team la cui etichetta è un altro stile: va bene lo stesso', () => {
    const label = teamArchetype(mixed, DOUBLES_RULES)!.styles[0];
    expect(label).not.toBe('grassyterrain');
    expect(matchesChoice(mixed, choose(mixed, 'grassyterrain'), doubles)).toBe(true);
    expect(matchesChoice(mixed, choose(mixed, 'rain'), doubles)).toBe(true);
    expect(matchesChoice(mixed, choose(mixed, 'psychicterrain'), doubles)).toBe(false);
  });

  it('Tailwind: vero appena un membro ha la mossa, falso senza', () => {
    const without = [pelipper, kingdra, rillaboom, ogerpon, garchomp, incineroar];
    expect(matchesChoice(mixed, choose(mixed, 'tailwind'), doubles)).toBe(true);
    expect(matchesChoice(without, choose(without, 'tailwind'), doubles)).toBe(false);
  });

  it('Campo Nebbioso: basta chi lo porta, anche se nessuno lo sfrutta', () => {
    const fini = mk('Tapu Fini', 'Misty Surge', ['Moonblast', 'Muddy Water', 'Protect']);
    const withFini = [fini, garchomp, incineroar, kingambit, kingdra, tornadus];
    expect(matchesChoice(withFini, choose(withFini, 'mistyterrain'), doubles)).toBe(true);
    expect(matchesChoice(mixed, choose(mixed, 'mistyterrain'), doubles)).toBe(false);
    // Gli altri campi vogliono ancora chi li sfrutta
    const lonely = [rillaboom, tornadus, pelipper];
    expect(matchesChoice(lonely, choose(lonely, 'grassyterrain'), doubles)).toBe(false);
  });

  it('nessuno stile chiesto: sempre vero', () => {
    expect(matchesChoice(mixed, choose(mixed, null), doubles)).toBe(true);
  });
});

describe('gli stili che Completa team offre', () => {
  it('nel singolo i cinque di sempre, in doppio anche campi e Tailwind', () => {
    expect(fillStylesFor(NATDEX_OU_RULES)).toBe(FILL_STYLES);
    expect(FILL_STYLES).toEqual(['rain', 'sun', 'sand', 'snow', 'trickroom']);
    expect(fillStylesFor(DOUBLES_RULES)).toBe(DOUBLES_FILL_STYLES);
    expect(DOUBLES_FILL_STYLES).toEqual(['rain', 'sun', 'sand', 'snow', 'grassyterrain', 'psychicterrain', 'electricterrain', 'mistyterrain', 'trickroom', 'tailwind']);
  });
});

describe('doppio: chi porta e chi sfrutta campi e Tailwind', () => {
  it('Tailwind: lo porta chi ha la mossa o la può imparare; nessuno "lo sfrutta"', () => {
    const noWind = mk('Tornadus', 'Prankster', ['Bleakwind Storm', 'Heat Wave', 'Taunt']);
    expect(setsUp(tornadus, 'tailwind')).toBe(true);
    expect(asSetter(tornadus, 'tailwind', 9)).toBe(tornadus);
    expect(asSetter(noWind, 'tailwind', 9)!.moves).toContain('Tailwind');
    // Garchomp non la impara
    expect(asSetter(garchomp, 'tailwind', 9)).toBeNull();
    expect(asUser(tornadus, 'tailwind', 9)).toBeNull();
    expect(uses(garchomp, 'tailwind')).toBe(false);
  });

  it('un campo lo sfrutta anche chi attacca a terra col tipo che potenzia', () => {
    const hatterene = mk('Hatterene', 'Magic Bounce', ['Psychic', 'Dazzling Gleam', 'Protect']);
    expect(asUser(hatterene, 'psychicterrain', 9)).toBe(hatterene);
    expect(uses(ogerpon, 'grassyterrain')).toBe(true);
    // In volo il campo non lo tocca
    expect(uses(tornadus, 'grassyterrain')).toBe(false);
    // Chi lo porta: con l'abilità
    expect(setsUp(rillaboom, 'grassyterrain')).toBe(true);
  });

  it('meteo e Trick Room come sempre', () => {
    expect(setsUp(pelipper, 'rain')).toBe(true);
    expect(uses(kingdra, 'rain')).toBe(true);
    expect(uses(garchomp, 'rain')).toBe(false);
  });
});

describe('doppio: le proposte di Completa team con Tailwind', () => {
  const run = (team: TeamSet[], style: FillStyle, format = doubles) => {
    const generator = fillProposals(team, choose(team, style), [], format, data);
    const proposals = [];
    let step = generator.next();
    let steps = 0;
    while (!step.done) {
      if (step.value) proposals.push(step.value);
      // Il generatore deve finire da solo: mai più passi dei tentativi che si concede
      expect(++steps).toBeLessThan(200);
      step = generator.next();
    }
    return { proposals, end: step.value };
  };

  it('team di 3 senza Tailwind: le proposte lo portano', () => {
    const team = [incineroar, garchomp, kingambit];
    const { proposals } = run(team, 'tailwind');
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      expect(matchesChoice(proposal.team, choose(team, 'tailwind'), doubles)).toBe(true);
      expect(proposal.added.some(set => set.moves.includes('Tailwind'))).toBe(true);
    }
  });

  it('team che ha già Tailwind: le proposte arrivano e lo tengono', () => {
    const team = [tornadus, incineroar, garchomp];
    const { proposals } = run(team, 'tailwind');
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) expect(doublesStyles(proposal.team)).toContain('tailwind');
  });

  it('nessun candidato può portarlo: il giro finisce, senza girare all\'infinito', () => {
    // Fino alla terza generazione Tailwind non esiste
    const old: Format = { ...doubles, genLimit: 3 };
    const team = [mk('Blissey', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss']), mk('Skarmory', 'Sturdy', ['Brave Bird', 'Spikes', 'Protect']), mk('Tyranitar', 'Sand Stream', ['Rock Slide', 'Crunch', 'Protect'])];
    const { proposals, end } = run(team, 'tailwind', old);
    expect(proposals).toEqual([]);
    expect(end).toBe('exhausted');
  });

  it('Campo Nebbioso da un team di 3: le proposte arrivano e hanno chi lo porta', () => {
    const team = [incineroar, garchomp, kingambit];
    const { proposals } = run(team, 'mistyterrain');
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) expect(matchesChoice(proposal.team, choose(team, 'mistyterrain'), doubles)).toBe(true);
  });

  it('Campo Erboso da un team di 4: le proposte lo hanno fra i loro stili', () => {
    const team = [incineroar, garchomp, kingambit, tornadus];
    const { proposals } = run(team, 'grassyterrain');
    for (const proposal of proposals) expect(doublesStyles(proposal.team)).toContain('grassyterrain');
  });
});
