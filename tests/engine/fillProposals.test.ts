import { describe, expect, it } from 'vitest';
import type { Archetype } from '../../src/engine/archetype';
import type { EngineData } from '../../src/engine/data';
import { isMega, toID } from '../../src/engine/dex';
import { fillProposals, matchesChoice, PROPOSALS_PER_ROUND, type FillChoice, type FillStyle } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const take = (team: TeamSet[], choice: FillChoice, exclude = new Set<string>(), format: Format = DEFAULT_FORMAT, data: EngineData = fixtureData) =>
  [...fillProposals(team, choice, exclude, format, data)];
const any: FillChoice = { archetype: null, style: null };
const species = (sets: TeamSet[]) => sets.map(s => toID(s.species));
const set = (name: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(name), moves, item });
// Il fixture base più quello delle Mega: 13 specie, due Mega
const withMegas: EngineData = {
  stats: { meta: fixtureData.stats!.meta, pokemon: { ...fixtureData.stats!.pokemon, ...megaData.stats!.pokemon } },
  sets: {},
};

describe('proposte di Completa team', () => {
  it('team vuoto: proposte di 6, al massimo 5, nessuna specie in comune', () => {
    const list = take([], any);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.length).toBeLessThanOrEqual(PROPOSALS_PER_ROUND);
    for (const p of list) expect(p.team).toHaveLength(6);
    const added = list.flatMap(p => species(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it('ogni proposta corrisponde alla scelta', () => {
    const archetypes: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
    const styles: (FillStyle | null)[] = [null, 'sun', 'trickroom'];
    for (const archetype of archetypes) for (const style of styles) {
      const choice = { archetype, style };
      for (const p of take([], choice)) {
        expect(matchesChoice(p.team, choice, DEFAULT_FORMAT)).toBe(true);
        expect(p.archetype).toBe(archetype);
        if (style) expect(p.styles).toContain(style);
      }
    }
  });

  it('i membri attuali restano primi e intatti', () => {
    const team = [set('Garchomp', ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'], 'Rocky Helmet')];
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.team[0]).toBe(team[0]);
  });

  it('esclusi: le specie in exclude non entrano, e exclude cresce con le proposte', () => {
    const exclude = new Set(['gholdengo']);
    const list = take([], any, exclude);
    expect(list.flatMap(p => species(p.added))).not.toContain('gholdengo');
    for (const p of list) for (const id of species(p.added)) expect(exclude.has(id)).toBe(true);
  });

  it('un solo slot: Pokémon tutti diversi, uno per proposta', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect']));
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const p of list) expect(p.added).toHaveLength(1);
    const added = list.flatMap(p => species(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it("con una Mega nel team non ne aggiunge un'altra, anche con allowMultipleMegas", () => {
    const team = [set('Gardevoir', ['Hyper Voice'], 'Gardevoirite')];
    for (const allowMultipleMegas of [false, true]) {
      const list = take(team, any, new Set(), { ...DEFAULT_FORMAT, allowMultipleMegas }, withMegas);
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.added.some(isMega)).toBe(false);
    }
  });

  it('in National Dex ogni proposta ha esattamente una Mega, se il pool ne ha', () => {
    const list = take([], any, new Set(), DEFAULT_FORMAT, withMegas);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.team.filter(isMega)).toHaveLength(1);
  });

  it('voto della proposta = rateTeam del team proposto', () => {
    for (const p of take([], any)) expect(p.overall).toBe(rateTeam(p.team, fixtureData, 'en')!.overall);
  });

  it('senza statistiche non produce nulla', () => {
    expect(take([], any, new Set(), DEFAULT_FORMAT, { stats: null, sets: {} })).toEqual([]);
  });
});
