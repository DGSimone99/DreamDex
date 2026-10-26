import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { battleName } from '../../src/engine/dex';
import { fillProposals, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { effectiveLists, EMPTY_LISTS, type EffectiveLists } from '../../src/engine/lists';
import { rateTeam } from '../../src/engine/rating';
import { improveReplacements, similarReplacements } from '../../src/engine/replace';
import { bannedInPool, scoreSets, suggest } from '../../src/engine/scoring';
import { defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { fillData } from '../fixtures/fillData';
import { adviceOf } from '../helpers/coach';

/** Liste effettive con un solo Pokémon bannato nel formato. */
const banning = (species: string, allow?: string[]): EffectiveLists => ({
  ...effectiveLists({ ...EMPTY_LISTS, byFormat: { ou: { favorites: [], bans: [species] } } }, 'ou'),
  ...(allow ? { allow: new Set(allow) } : {}),
});
const names = (items: { set: TeamSet }[]) => items.map(i => battleName(i.set));

describe('bannati dall\'utente: mai suggeriti', () => {
  const team = [tusk];
  const first = battleName(suggest(team, DEFAULT_FORMAT, fixtureData, 20, 'it')[0].set);
  const data: EngineData = { ...fixtureData, userLists: banning(first) };

  it('suggest e conteggio dei nascosti', () => {
    expect(names(suggest(team, DEFAULT_FORMAT, data, 50, 'it'))).not.toContain(first);
    expect(bannedInPool(team, DEFAULT_FORMAT, data)).toBe(1);
    expect(bannedInPool(team, DEFAULT_FORMAT, fixtureData)).toBe(0);
  });

  it('sostituti: miglioramento e simili', () => {
    const pair = [tusk, gholdengo];
    expect(names(improveReplacements(pair, 1, DEFAULT_FORMAT, data, 50, undefined, 'it'))).not.toContain(first);
    expect(names(similarReplacements(pair, 1, DEFAULT_FORMAT, data, 50, undefined, 'it'))).not.toContain(first);
  });

  it('set indicati (ricerca): bannato fuori, a meno che sia ammesso', () => {
    const set = defaultSet(fixtureData, first);
    expect(scoreSets(team, DEFAULT_FORMAT, data, [set], 'it')).toEqual([]);
    const allowed = { ...fixtureData, userLists: banning(first, [first]) };
    expect(names(scoreSets(team, DEFAULT_FORMAT, allowed, [set], 'it'))).toEqual([first]);
    expect(bannedInPool(team, DEFAULT_FORMAT, allowed)).toBe(0);
  });

  it('coach: nessuno scambio verso un bannato', () => {
    const weak = [tusk, gholdengo, { ...emptySet('Magikarp'), moves: ['Splash'] }];
    const before = adviceOf(weak, DEFAULT_FORMAT, fixtureData, 'it').fixes.map(f => f.species);
    expect(before.length).toBeGreaterThan(0);
    for (const species of before) {
      const after = adviceOf(weak, DEFAULT_FORMAT, { ...fixtureData, userLists: banning(species) }, 'it').fixes;
      expect(after.map(f => f.species)).not.toContain(species);
    }
  });

  it('Completa team: il bannato non entra in nessuna proposta', () => {
    const take = (d: EngineData) => [...fillProposals([], { archetype: null, style: null }, new Set(), DEFAULT_FORMAT, d, 0)]
      .filter((p): p is Proposal => p !== null);
    const target = battleName(take(fillData)[0].added[0]);
    const proposals = take({ ...fillData, userLists: banning(target) });
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) expect(p.team.map(battleName)).not.toContain(target);
  });

  it('il voto non cambia', () => {
    expect(rateTeam([tusk, gholdengo], data, 'it')).toEqual(rateTeam([tusk, gholdengo], fixtureData, 'it'));
  });
});
