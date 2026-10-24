import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { candidatePool, rolesComponent, scoreCandidates, suggest, type Suggestion } from '../../src/engine/scoring';
import { analyzeTeam } from '../../src/engine/analysis';
import { LEVEL_KEYS, levelOf } from '../../src/engine/roleLevels';
import { teamNeeds } from '../../src/engine/needs';
import type { ComponentKey } from '../../src/engine/weights';
import { emptySet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const byName = (list: Suggestion[], name: string) => list.find(s => s.species === name)!;

function factBehind(s: Suggestion, component: ComponentKey): boolean {
  const f = s.facts;
  return {
    defense: f.defense.immune.length + f.defense.covered.length > 0,
    threats: f.threats.checked.length > 0,
    coverage: f.coverage.types.length > 0,
    roles: f.roles.filled.length > 0 || f.roles.style !== null,
    synergy: (!!f.synergy && f.synergy.pct >= 0.05) || f.mechanical.length > 0 || f.clashes.length > 0,
    strength: f.strength.usage > 0,
  }[component];
}

describe('candidatePool', () => {
  it('esclude team, poco usati, sconosciuti', () => {
    expect(candidatePool([tusk, gholdengo], DEFAULT_FORMAT, fixtureData).sort())
      .toEqual(['Corviknight', 'Kingambit', 'Rotom-Wash', 'Toxapex']); // Dragapult è Uber in National Dex
  });

  it('soglia d\'uso 0 include i poco usati', () => {
    expect(candidatePool([tusk], { ...DEFAULT_FORMAT, minUsage: 0 }, fixtureData)).toContain('Garchomp');
  });

  it('rispetta il limite di generazione', () => {
    expect(candidatePool([tusk], { ...DEFAULT_FORMAT, genLimit: 4, minUsage: 0 }, fixtureData).sort())
      .toEqual(['Garchomp', 'Rotom-Wash']);
  });

  it('vuoto senza statistiche', () => {
    expect(candidatePool([tusk], DEFAULT_FORMAT, { stats: null, sets: null })).toEqual([]);
  });
});

describe('scoreCandidates', () => {
  const results = scoreCandidates([tusk, gholdengo], DEFAULT_FORMAT, fixtureData);

  it('ordinati per punteggio decrescente, punteggi 0–100', () => {
    const scores = results.map(s => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const s of results) expect(s.score).toBeGreaterThanOrEqual(0);
    for (const s of results) expect(s.score).toBeLessThanOrEqual(100);
  });

  it('chi copre le debolezze batte chi le condivide', () => {
    expect(byName(results, 'Rotom-Wash').components.defense)
      .toBeGreaterThan(byName(results, 'Kingambit').components.defense);
  });

  it('fatti difensivi di Rotom-Wash', () => {
    expect(byName(results, 'Rotom-Wash').facts.defense).toEqual({
      immune: ['Ground'], covered: ['Fire', 'Water'], sharedWeak: ['Grass'],
    });
  });

  it('coverage: tipi scoperti colpiti', () => {
    expect(byName(results, 'Rotom-Wash').facts.coverage.types).toEqual(['Water']);
    expect(byName(results, 'Corviknight').facts.coverage.types).toEqual(['Fighting', 'Bug']);
    expect(byName(results, 'Corviknight').components.coverage)
      .toBeGreaterThan(byName(results, 'Rotom-Wash').components.coverage);
  });

  it('minacce non gestite fermate', () => {
    expect(byName(results, 'Kingambit').facts.threats.checked).toContain('Dragapult');
    expect(byName(results, 'Rotom-Wash').facts.threats.checked).toContain('Corviknight');
  });

  it('ruoli mancanti', () => {
    // Nell'ordine dei bisogni: prima gli essenziali (muro speciale), poi gli importanti (hazard)
    expect(byName(results, 'Toxapex').facts.roles.filled).toEqual(['specialWall', 'hazards']);
  });

  it('sinergia normalizzata: Kingambit è il compagno più frequente', () => {
    expect(byName(results, 'Kingambit').components.synergy).toBe(1);
  });

  it('ogni motivazione corrisponde a un fatto', () => {
    for (const s of results) {
      for (const r of s.reasons) expect(factBehind(s, r.component)).toBe(true);
    }
  });

  it('tag "Spesso usati insieme" dal 15% di coppia in su', () => {
    expect(byName(results, 'Kingambit').tags).toContain('Spesso usati insieme: Great Tusk (25%)');
    expect(byName(results, 'Rotom-Wash').tags.some(t => t.startsWith('Spesso usati insieme'))).toBe(false);
  });

  it('testo della motivazione difensiva', () => {
    const texts = byName(results, 'Rotom-Wash').reasons.map(r => r.text);
    expect(texts).toContain('Immune a Ground e resiste a Fire, Water: debolezze del team');
  });
});

describe('ruoli del candidato pesati per livello', () => {
  it('un candidato che porta un essenziale mancante vale più di uno che porta un minore', () => {
    // Team incompleto (balance) senza muro fisico: il muro è essenziale, Encore minore
    const team = [gholdengo];
    const needs = teamNeeds(team, fixtureData, [{ specialBreaker: 1, specialWall: 1, recovery: 1, hazards: 1, removal: 1, pivot: 1, phazer: 1, itemRemoval: 1 }]);
    expect(needs.essentialMissing).toEqual(['physicalWall']);
    const analysis = { ...analyzeTeam(team, fixtureData), needs };
    const wall = { ...emptySet('Corviknight'), item: 'Leftovers', ability: 'Pressure', moves: ['Body Press', 'Iron Defense'], nature: 'Impish', evs: { hp: 252, def: 252 } };
    const encore = { ...emptySet('Whimsicott'), moves: ['Encore'] };
    const a = rolesComponent(wall, analysis);
    const b = rolesComponent(encore, analysis);
    expect(a.facts.filled).toEqual(['physicalWall']);
    expect(b.facts.filled).toEqual([]);
    expect(b.value).toBeGreaterThan(0);
    expect(a.value).toBeGreaterThan(b.value);
  });
});

describe('ruoli del candidato col credito del secondario', () => {
  it('nello stall un attaccante con muro secondario non riempie il muro fisico, un muro sì', () => {
    const team = [gholdengo];
    const base = teamNeeds(team, fixtureData, [{ specialBreaker: 1, specialWall: 1, recovery: 1, hazards: 1, removal: 1, pivot: 1, phazer: 1, itemRemoval: 1 }]);
    const levels = Object.fromEntries(LEVEL_KEYS.map(k => [k, levelOf('stall', k)])) as typeof base.levels;
    const needs = { ...base, archetype: 'stall' as const, levels, missingRoles: ['physicalWall' as const] };
    const analysis = { ...analyzeTeam(team, fixtureData), needs };
    const offensiveTusk = { ...emptySet('Great Tusk'), item: 'Heavy-Duty Boots', ability: 'Protosynthesis', nature: 'Jolly', evs: { atk: 252, def: 4, spe: 252 }, moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'] };
    const wall = { ...emptySet('Corviknight'), item: 'Leftovers', ability: 'Pressure', moves: ['Body Press', 'Iron Defense'], nature: 'Impish', evs: { hp: 252, def: 252 } };
    expect(rolesComponent(offensiveTusk, analysis).facts.filled).not.toContain('physicalWall');
    expect(rolesComponent(wall, analysis).facts.filled).toContain('physicalWall');
  });
});

describe('suggest', () => {
  it('team vuoto: ordine per forza (uso)', () => {
    const list = suggest([], DEFAULT_FORMAT, fixtureData);
    expect(list[0].species).toBe('Great Tusk');
    expect(list[0].reasons.map(r => r.component)).toEqual(['strength']);
  });

  it('team completo: nessun suggerimento', () => {
    expect(suggest(Array(6).fill(tusk), DEFAULT_FORMAT, fixtureData)).toEqual([]);
  });

  it('limite', () => {
    expect(suggest([tusk], DEFAULT_FORMAT, fixtureData, 2)).toHaveLength(2);
  });

  it('team con un Pokémon sconosciuto non va in errore', () => {
    expect(() => suggest([emptySet('Fakemon-Xyz'), tusk], DEFAULT_FORMAT, fixtureData)).not.toThrow();
    expect(suggest([emptySet('Fakemon-Xyz'), tusk], DEFAULT_FORMAT, fixtureData).length).toBeGreaterThan(0);
  });
});
