import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { fixtureData } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const area = (team: TeamSet[], key: string, data: EngineData = fixtureData) => rateTeam(team, data)!.areas.find(a => a.key === key)!.value!;
const penalties = (team: TeamSet[], data: EngineData = fixtureData) => rateTeam(team, data)!.penalty.items;
const entry = (usage: number): SpeciesStats => ({ usage, count: 100, abilities: {}, items: {}, teraTypes: {}, spreads: {}, moves: {}, teammates: {}, checks: {} });

describe('copertura pesata da chi colpisce', () => {
  it('un Close Combat di Alakazam copre meno di uno di Great Tusk', () => {
    // La Coverage è dentro l'Offesa: copre chi manda KO in due colpi, e il Close Combat di Alakazam non ci arriva
    const coverage = (team: TeamSet[]) => rateTeam(team, fixtureData)!.offense.coverage;
    expect(coverage([withMoves('Alakazam', ['Close Combat'])])).toBeLessThan(coverage([withMoves('Great Tusk', ['Close Combat'])]));
  });
});

describe('membri deboli senza utilità (indipendente dal meta)', () => {
  const raticate = withMoves('Raticate', ['Body Slam', 'Crunch']);
  const tusk = withMoves('Great Tusk', ['Headlong Rush']);

  it('debole e senza utilità: −2, anche senza statistiche Smogon', () => {
    expect(penalties([raticate, tusk], { stats: null, sets: null }))
      .toContainEqual(expect.objectContaining({ text: 'Raticate è debole e non porta utilità al team', points: 2 }));
  });

  it("debole ma con un'utilità chiave (meteo, hazard): nessuna penalità", () => {
    const pelipper: TeamSet = { ...withMoves('Pelipper', ['Hurricane', 'U-turn']), ability: 'Drizzle' };
    const delibird = withMoves('Delibird', ['Spikes', 'Ice Shard']);
    expect(penalties([pelipper, delibird, tusk]).map(i => i.text).join(' | ')).not.toMatch(/debole/);
  });

  it('un muro passivo si giudica dalla robustezza: Mega Sableye non è debole, Shuckle senza hazard sì', () => {
    const sableye: TeamSet = { ...withMoves('Sableye', ['Knock Off', 'Recover', 'Will-O-Wisp', 'Calm Mind']), item: 'Sablenite' };
    const shuckle = withMoves('Shuckle', ['Toxic', 'Protect', 'Rest', 'Encore']);
    const texts = penalties([sableye, shuckle, tusk]).map(i => i.text);
    expect(texts.join(' | ')).not.toMatch(/Sableye.*debole/);
    expect(texts).toContain('Shuckle è debole e non porta utilità al team');
  });

  it('il coaching lo segnala', () => {
    const problems = coachTeam([raticate, tusk], DEFAULT_FORMAT, fixtureData).problems;
    expect(problems).toContainEqual(expect.objectContaining({ severity: 'minor', category: 'roles', text: 'Raticate è debole e non porta utilità al team' }));
  });
});

describe('team tutto fisico o tutto speciale', () => {
  const special = ['Tapu Lele', 'Hydreigon', 'Heatran', 'Volcarona'].map(s => withMoves(s, ['Draco Meteor', 'Earth Power']));
  const walls = [withMoves('Blissey', ['Soft-Boiled', 'Toxic']), withMoves('Toxapex', ['Recover', 'Haze'])];

  it('almeno 4 attaccanti e nessuno fisico: −3', () => {
    expect(penalties([...special, ...walls])).toContainEqual(expect.objectContaining({ text: 'Nessun attaccante fisico', points: 3 }));
  });

  it('con 3 attaccanti non si segnala', () => {
    expect(penalties([...special.slice(0, 3), ...walls]).map(i => i.text)).not.toContain('Nessun attaccante fisico');
  });

  it('un attaccante fisico basta', () => {
    expect(penalties([...special, withMoves('Great Tusk', ['Headlong Rush']), walls[0]]).map(i => i.text)).not.toContain('Nessun attaccante fisico');
  });

  it('il coaching lo segnala tra i ruoli', () => {
    expect(coachTeam([...special, ...walls], DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual(expect.objectContaining({ severity: 'minor', category: 'roles', text: 'Nessun attaccante fisico' }));
  });
});
