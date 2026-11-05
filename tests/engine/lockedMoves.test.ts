import { describe, expect, it } from 'vitest';
import { lockedStatusMoves, withUsableMoves } from '../../src/engine/lockedMoves';
import { bestHit, CHOICE_LOCK } from '../../src/engine/damage';
import { sustainParts } from '../../src/engine/defense';
import { measuredSubRoles } from '../../src/engine/subRoles';
import { LOCKED_STATUS_POINTS, rateTeam } from '../../src/engine/rating';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };

const vestClef = set('Clefable', 'Assault Vest', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower'], 'Calm', { hp: 252, spd: 252 });
const scarfCorv = set('Corviknight', 'Choice Scarf', 'Pressure', ['Brave Bird', 'Defog', 'U-turn', 'Roost'], 'Jolly', { hp: 252, spe: 252 });
const bandNite = set('Dragonite', 'Choice Band', 'Multiscale', ['Extreme Speed', 'Earthquake', 'Dragon Dance', 'Protect'], 'Adamant', { atk: 252, spe: 252 });

describe('mosse di stato con Choice e Assault Vest', () => {
  it("Assault Vest: tutte le mosse di stato; Choice: potenziamenti e Protect/Detect, niente se c'è Trick o Switcheroo", () => {
    expect(lockedStatusMoves(vestClef)).toEqual(['Soft-Boiled', 'Calm Mind']);
    expect(lockedStatusMoves(bandNite)).toEqual(['Dragon Dance', 'Protect']);
    // Defog e Roost con la Scarf si usano una volta e poi si cambia: contano
    expect(lockedStatusMoves(scarfCorv)).toEqual([]);
    const trickSpecs = set('Gholdengo', 'Choice Specs', 'Good as Gold', ['Make It Rain', 'Nasty Plot', 'Trick', 'Recover'], 'Modest', { spa: 252, spe: 252 });
    expect(lockedStatusMoves(trickSpecs)).toEqual([]);
    expect(lockedStatusMoves({ ...vestClef, item: 'Leftovers' })).toEqual([]);
  });

  it('il set senza quelle mosse è sempre lo stesso oggetto; senza mosse bloccate è il set stesso', () => {
    expect(withUsableMoves(vestClef)).toBe(withUsableMoves(vestClef));
    expect(withUsableMoves(vestClef).moves).toEqual(['Moonblast', 'Flamethrower']);
    const plain = { ...vestClef, item: 'Leftovers' };
    expect(withUsableMoves(plain)).toBe(plain);
  });

  it('non danno ruoli: Clefable Vest non si cura; Corviknight Scarf con Defog toglie gli hazard', () => {
    expect(sustainParts(withUsableMoves(vestClef), 1).sources).not.toContain('Soft-Boiled');
    expect(measuredSubRoles(vestClef, [vestClef], noStats).recovery ?? 0).toBe(0);
    expect(measuredSubRoles(scarfCorv, [scarfCorv], noStats).removal ?? 0).toBeGreaterThan(0);
  });

  it('nel voto: −2 per membro, con il nome e le mosse', () => {
    const rating = rateTeam([vestClef, bandNite], fixtureData)!;
    const items = rating.penalty.items.filter(i => i.catalog === 'lockedStatus');
    expect(items.map(i => i.points)).toEqual([LOCKED_STATUS_POINTS, LOCKED_STATUS_POINTS]);
    expect(items[0].text).toContain('Soft-Boiled');
    // Togliere le mosse di stato toglie il malus e non cambia le aree (contavano già come assenti)
    const clean = rateTeam([withUsableMoves(vestClef), withUsableMoves(bandNite)], fixtureData)!;
    expect(clean.base).toBe(rating.base);
    expect(clean.penalty.total).toBe(rating.penalty.total - 2 * LOCKED_STATUS_POINTS);
  });
});

describe('sconto della Choice solo per chi attacca dal team', () => {
  it('il colpo che il team riceve è pieno', () => {
    const bolt = set('Raging Bolt', 'Choice Specs', 'Protosynthesis', ['Draco Meteor'], 'Modest', { hp: 252, spa: 252 });
    const zapdos = set('Zapdos', 'Heavy-Duty Boots', 'Static', ['Roost'], 'Bold', { hp: 252, def: 252 });
    const ours = bestHit(bolt, zapdos)!.expected;
    const incoming = bestHit(bolt, zapdos, { incoming: true })!.expected;
    expect(ours / incoming).toBeCloseTo(CHOICE_LOCK, 5);
  });
});
