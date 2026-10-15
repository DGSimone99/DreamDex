import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { illegalParts, initLearnsets, legalAbilities, legalMoves } from '../../src/engine/learnsets';
import { defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';

beforeAll(async () => { await initLearnsets(); });

const set = (species: string, ability: string, moves: string[], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ ...emptySet(species), ability, moves, ...extra });

describe('mosse imparabili', () => {
  it('dal learnset della specie', () => {
    expect(legalMoves('Dragapult', 9)!.has('dragondarts')).toBe(true);
    expect(legalMoves('Drakloak', 9)!.has('dragondarts')).toBe(false);
  });

  it('ereditate dalle pre-evoluzioni', () => {
    expect(legalMoves('Raichu', 9)!.has('volttackle')).toBe(true);
  });

  it('forme: dalla forma base (Rotom-Wash, Mega)', () => {
    expect(legalMoves('Rotom-Wash', 9)!.has('hydropump')).toBe(true);
    expect(legalMoves('Rotom-Wash', 9)!.has('thunderbolt')).toBe(true);
    expect(legalMoves('Charizard-Mega-X', 9)!.has('flareblitz')).toBe(true);
  });

  it('fino alla generazione scelta', () => {
    expect(legalMoves('Garchomp', 4)!.has('stealthrock')).toBe(true);
    expect(legalMoves('Garchomp', 4)!.has('scaleshot')).toBe(false);
    expect(legalMoves('Garchomp', 9)!.has('scaleshot')).toBe(true);
  });

  it('specie sconosciuta: nessun dato, nessun controllo', () => {
    expect(legalMoves('Fakemon-Xyz', 9)).toBeNull();
  });
});

describe('abilità legali', () => {
  it('niente abilità nascoste prima della Gen 5', () => {
    expect(legalAbilities('Ninetales', 4)).toEqual(['Flash Fire']);
    expect(legalAbilities('Ninetales', 9)).toEqual(['Flash Fire', 'Drought']);
  });

  it('prima della Gen 3 le abilità non esistono: nessun controllo', () => {
    expect(legalAbilities('Ninetales', 2)).toBeNull();
  });
});

describe('parti non legali di un set', () => {
  it('mosse e abilità non legali', () => {
    expect(illegalParts(set('Drakloak', 'Infiltrator', ['Dragon Darts', 'U-turn']), 9)).toEqual({ moves: ['Dragon Darts'], ability: null });
    expect(illegalParts(set('Ninetales', 'Drought', ['Flamethrower']), 4)).toEqual({ moves: [], ability: 'Drought' });
  });

  it('Custom Skillset: nessun controllo', () => {
    expect(illegalParts(set('Drakloak', 'Huge Power', ['Dragon Darts'], { customSkillset: true }), 9)).toEqual({ moves: [], ability: null });
  });

  it('mosse vuote o sconosciute non contano', () => {
    expect(illegalParts(set('Garchomp', 'Rough Skin', ['', 'Earthquake']), 9)).toEqual({ moves: [], ability: null });
  });
});

describe('set di riferimento resi legali', () => {
  const entry: SpeciesStats = {
    usage: 0.1, count: 100, items: {}, teraTypes: {}, spreads: {}, teammates: {}, checks: {},
    abilities: { roughskin: 0.6, sandveil: 0.4 },
    moves: { scaleshot: 0.9, earthquake: 0.8, stealthrock: 0.7, swordsdance: 0.6, dragonclaw: 0.5 },
  };
  const data: EngineData = { stats: { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: { Garchomp: entry } }, sets: {} };

  it('mosse non legali sostituite dalle successive più usate', () => {
    expect(defaultSet(data, 'Garchomp', 4).moves).toEqual(['Earthquake', 'Stealth Rock', 'Swords Dance', 'Dragon Claw']);
    expect(defaultSet(data, 'Garchomp', 9).moves).toEqual(['Scale Shot', 'Earthquake', 'Stealth Rock', 'Swords Dance']);
  });

  it('abilità non legale sostituita dalla più usata legale', () => {
    expect(defaultSet(data, 'Garchomp', 4).ability).toBe('Sand Veil');
    expect(defaultSet(data, 'Garchomp', 9).ability).toBe('Rough Skin');
  });
});
