import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { suggest } from '../../src/engine/scoring';
import { emptySet } from '../../src/engine/sets';
import { rankByTeamGain, withCandidate } from '../../src/engine/teamGain';
import { fixtureData } from '../fixtures/data';

describe('voto del team col candidato', () => {
  const team = [{ ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Rapid Spin'] }];

  it('aggiunge in fondo o sostituisce il membro', () => {
    const set = emptySet('Gholdengo');
    expect(withCandidate(team, set, null).map(s => s.species)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(withCandidate(team, set, 0).map(s => s.species)).toEqual(['Gholdengo']);
  });

  it('ordina per voto del team, con quanto sale rispetto a ora', () => {
    const items = suggest(team, DEFAULT_FORMAT, fixtureData, 20);
    const ranked = rankByTeamGain(items, team, null, fixtureData, 'it');
    const before = rateTeam(team, fixtureData)!.overall;
    expect(ranked.map(r => r.teamGain!.overall)).toEqual([...ranked.map(r => r.teamGain!.overall)].sort((a, b) => b - a));
    for (const r of ranked) {
      expect(r.teamGain!.overall).toBe(rateTeam([...team, r.set], fixtureData)!.overall);
      expect(r.teamGain!.gain).toBe(r.teamGain!.overall - before);
    }
  });

  it('primo Pokémon o unico membro sostituito: nessun voto, ordine invariato', () => {
    const items = suggest([], DEFAULT_FORMAT, fixtureData, 5);
    expect(rankByTeamGain(items, [], null, fixtureData, 'it')).toEqual(items);
    expect(rankByTeamGain(items, team, 0, fixtureData, 'it')).toEqual(items);
  });

  it('senza ordinare (Sostituto simile) mantiene l\'ordine ma porta il voto', () => {
    const items = suggest(team, DEFAULT_FORMAT, fixtureData, 20);
    const kept = rankByTeamGain(items, team, null, fixtureData, 'it', false);
    expect(kept.map(r => r.species)).toEqual(items.map(r => r.species));
    expect(kept.every(r => r.teamGain)).toBe(true);
  });
});
