import { describe, expect, it } from 'vitest';
import type { Archetype } from '../../src/engine/archetype';
import type { EngineData } from '../../src/engine/data';
import { battleName, isMega, toID } from '../../src/engine/dex';
import { fillProposals, matchesChoice, MAX_ATTEMPTS, PROPOSALS_PER_ROUND, type FillChoice, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { enables } from '../../src/engine/synergy';
import { fillData } from '../fixtures/fillData';

/** Le proposte di un giro (il generatore produce anche `null` come segnale di avanzamento). */
const take = (team: TeamSet[], choice: FillChoice, exclude = new Set<string>(), format: Format = DEFAULT_FORMAT, data: EngineData = fillData) =>
  [...fillProposals(team, choice, exclude, format, data)].filter((p): p is Proposal => p !== null);
const any: FillChoice = { archetype: null, style: null };
/** Un Pokémon si distingue per forma in battaglia: Charizard e Charizard-Mega-Y sono due Pokémon diversi. */
const formes = (sets: TeamSet[]) => sets.map(s => toID(battleName(s)));
const set = (name: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(name), moves, item });
const setterOf = (p: Proposal, condition: 'rain' | 'sun') => p.added.find(s => enables(s).some(e => e.condition === condition));

describe('proposte di Completa team', () => {
  it('team vuoto: proposte di 6, al massimo 5, nessun Pokémon in comune', () => {
    const list = take([], any);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.length).toBeLessThanOrEqual(PROPOSALS_PER_ROUND);
    for (const p of list) expect(p.team).toHaveLength(6);
    const added = list.flatMap(p => formes(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it('ogni tipo di team ha proposte, e ognuna è di quel tipo', () => {
    const archetypes: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
    for (const archetype of archetypes) {
      const choice = { archetype, style: null };
      const list = take([], choice);
      expect(list.length, archetype).toBeGreaterThanOrEqual(1);
      for (const p of list) {
        expect(p.archetype).toBe(archetype);
        expect(matchesChoice(p.team, choice, DEFAULT_FORMAT)).toBe(true);
      }
    }
  });

  it('pioggia, sole e Trick Room hanno proposte con quello stile', () => {
    for (const style of ['rain', 'sun', 'trickroom'] as const) {
      const list = take([], { archetype: null, style });
      expect(list.length, style).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.styles).toContain(style);
    }
  });

  it('chi porta lo stile si ripete solo se non ce n’è uno nuovo; gli altri mai', () => {
    const exclude = new Set<string>();
    const first = take([], { archetype: null, style: 'sun' }, exclude);
    expect(first.length).toBeGreaterThanOrEqual(2);
    // Due portatori del sole (Torkoal, Charizard-Mega-Y): le prime due proposte ne usano due diversi
    expect(toID(battleName(setterOf(first[0], 'sun')!))).not.toBe(toID(battleName(setterOf(first[1], 'sun')!)));
    // Pioggia: un solo portatore, che può tornare nel giro dopo; gli altri membri no
    const rainExclude = new Set<string>();
    const rain = take([], { archetype: null, style: 'rain' }, rainExclude);
    const more = take([], { archetype: null, style: 'rain' }, rainExclude);
    expect(rain.length + more.length).toBeGreaterThanOrEqual(2);
    const others = [...rain, ...more].flatMap(p => p.added.filter(s => s !== setterOf(p, 'rain')).map(s => toID(battleName(s))));
    expect(new Set(others).size).toBe(others.length);
  });

  it('i membri attuali restano primi e intatti', () => {
    const team = [set('Garchomp', ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'], 'Rocky Helmet')];
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.team[0]).toBe(team[0]);
  });

  it('esclusi: le forme in exclude non entrano, e exclude cresce con le proposte', () => {
    const exclude = new Set(['gholdengo']);
    const list = take([], any, exclude);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.flatMap(p => formes(p.added))).not.toContain('gholdengo');
    for (const p of list) for (const id of formes(p.added)) expect(exclude.has(id)).toBe(true);
  });

  it('un solo slot: un Pokémon diverso per proposta', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect']));
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const p of list) expect(p.added).toHaveLength(1);
    const added = list.flatMap(p => formes(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it("con una Mega nel team non ne aggiunge un'altra, anche con allowMultipleMegas", () => {
    const team = [set('Gardevoir', ['Hyper Voice'], 'Gardevoirite')];
    for (const allowMultipleMegas of [false, true]) {
      const list = take(team, any, new Set(), { ...DEFAULT_FORMAT, allowMultipleMegas });
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.added.some(isMega)).toBe(false);
    }
  });

  it('in National Dex la prima proposta ha esattamente una Mega', () => {
    const [first] = take([], any);
    expect(first.team.filter(isMega)).toHaveLength(1);
  });

  it('la Mega col set sulla specie base (Charizard @ Charizardite Y) si esclude per la sua forma', () => {
    const data: EngineData = { ...fillData, presets: { Charizard: [{ name: 'Mega Y', format: 'gen9nationaldex',
      set: { ...emptySet('Charizard'), item: 'Charizardite Y', ability: 'Blaze', moves: ['Flamethrower', 'Solar Beam'] } }] } };
    const exclude = new Set<string>();
    // Senza stile: chi porta il sole non ha l'eccezione di poter tornare
    const list = take([], any, exclude, DEFAULT_FORMAT, data).concat(take([], any, exclude, DEFAULT_FORMAT, data));
    const zard = list.filter(p => p.added.some(s => toID(battleName(s)) === 'charizardmegay'));
    expect(zard.length).toBeLessThanOrEqual(1);
    if (zard.length) expect(exclude.has('charizardmegay')).toBe(true);
  });

  it('voto della proposta = rateTeam del team proposto', () => {
    for (const p of take([], any)) expect(p.overall).toBe(rateTeam(p.team, fillData, 'en')!.overall);
  });

  it('senza proposte possibili produce solo segnali di avanzamento, poi si ferma', () => {
    // Nessuno porta la neve nel meta di prova
    const steps = [...fillProposals([], { archetype: null, style: 'snow' }, new Set(), DEFAULT_FORMAT, fillData)];
    expect(steps.every(step => step === null)).toBe(true);
    expect(steps.length).toBeLessThanOrEqual(MAX_ATTEMPTS);
  });

  it('senza statistiche non produce nulla', () => {
    expect(take([], any, new Set(), DEFAULT_FORMAT, { stats: null, sets: {} })).toEqual([]);
  });
});
