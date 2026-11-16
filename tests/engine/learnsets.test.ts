import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { illegalParts, initLearnsets, legalAbilities, legalMoves } from '../../src/engine/learnsets';
import { defaultSet, emptySet, presetsForSet, type TeamSet } from '../../src/engine/sets';
import { bestPreset, bestPresets, coreMoves } from '../../src/engine/bestPreset';
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

describe('set delle analisi Smogon considerati legali', () => {
  it('Hidden Power di un tipo è legale se il Pokémon impara Hidden Power', () => {
    expect(illegalParts(set('Serperior', 'Contrary', ['Leaf Storm', 'Hidden Power Fire', 'Glare']), 9).moves).toEqual([]);
    expect(illegalParts(set('Serperior', 'Contrary', ['Hidden Power Fire']), 1).moves).toEqual(['Hidden Power Fire']);
  });

  it('Smeargle impara con Sketch qualsiasi mossa della generazione (tranne Chatter)', () => {
    expect(illegalParts(set('Smeargle', 'Own Tempo', ['Spore', 'Ceaseless Edge', 'Sticky Web']), 9).moves).toEqual([]);
    expect(legalMoves('Smeargle', 9)!.has('chatter')).toBe(false);
    expect(legalMoves('Smeargle', 4)!.has('stickyweb')).toBe(false);
  });

  it('abilità della Mega con la megapietra; senza pietra resta non legale', () => {
    expect(illegalParts(set('Diancie', 'Magic Bounce', [], { item: 'Diancite' }), 9).ability).toBeNull();
    expect(illegalParts(set('Diancie', 'Magic Bounce', [], { item: 'Leftovers' }), 9).ability).toBe('Magic Bounce');
  });

  it('abilità di una forma solo-battaglia senza strumento (Terapagos-Terastal)', () => {
    expect(legalAbilities('Terapagos', 9)).toContain('Tera Shell');
    expect(legalAbilities('Charizard', 9)).not.toContain('Drought');
  });

  it('defaultSet tiene Hidden Power e l\'abilità della Mega del preset', () => {
    const preset = set('Diancie', 'Magic Bounce', ['Moonblast', 'Diamond Storm'], { item: 'Diancite' });
    const hp = set('Serperior', 'Contrary', ['Leaf Storm', 'Hidden Power Fire', 'Substitute', 'Glare']);
    const data: EngineData = { stats: null, sets: null, presets: {
      Diancie: [{ name: 'Mega', format: 'gen9nationaldex', set: preset }],
      Serperior: [{ name: 'Contrary', format: 'gen9nationaldex', set: hp }],
    } };
    expect(defaultSet(data, 'Diancie-Mega')).toEqual(preset);
    expect(defaultSet(data, 'Serperior')).toEqual(hp);
  });
});

describe('preset fino al limite di generazione', () => {
  const urshifu = set('Urshifu-Rapid-Strike', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'Ice Spinner', 'U-turn'], { item: 'Choice Band' });
  const data: EngineData = { stats: null, sets: null, presets: {
    'Urshifu-Rapid-Strike': [{ name: 'Band', format: 'gen9nationaldex', set: urshifu }],
  } };

  it('con Gen 8 il preset perde Ice Spinner, e così il Preset migliore', () => {
    const member = set('Urshifu-Rapid-Strike', 'Unseen Fist', ['Close Combat']);
    expect(presetsForSet(data, member, 8)[0].set.moves).not.toContain('Ice Spinner');
    expect(presetsForSet(data, member, 9)[0].set.moves).toContain('Ice Spinner');
    expect(bestPreset([member], 0, data, 8).set.moves).not.toContain('Ice Spinner');
    expect(bestPresets([member], data, 8)[0].moves).not.toContain('Ice Spinner');
  });

  it('con Custom Skillset il preset resta com\'è', () => {
    const member = set('Urshifu-Rapid-Strike', 'Unseen Fist', ['Close Combat'], { customSkillset: true });
    expect(presetsForSet(data, member, 8)[0].set.moves).toContain('Ice Spinner');
  });
});

describe('mosse del gioco', () => {
  it('nel gioco solo le mosse imparabili in Scarlatto e Violetto', () => {
    expect(legalMoves('Meowscarada', 9, 'sv')!.has('flowertrick')).toBe(true);
    expect(legalMoves('Meowscarada', 9, 'sv')!.has('pursuit')).toBe(false);
    // Aqua Tail esiste in SV, ma Garchomp la imparava solo dai tutori delle generazioni 4–7
    expect(legalMoves('Garchomp', 9)!.has('aquatail')).toBe(true);
    expect(legalMoves('Garchomp', 9, 'sv')!.has('aquatail')).toBe(false);
    expect(legalMoves('Garchomp', 9, 'sv')!.has('earthquake')).toBe(true);
  });

  it('ereditate dalle pre-evoluzioni anche nel gioco', () => {
    expect(legalMoves('Raichu', 9, 'sv')!.has('volttackle')).toBe(true);
  });

  it('le mosse degli eventi non contano nel gioco', () => {
    expect(legalMoves('Pikachu', 9)!.has('fly')).toBe(true);
    expect(legalMoves('Pikachu', 9, 'sv')!.has('fly')).toBe(false);
  });

  it('il set proposto nel gioco ha solo mosse del gioco', () => {
    const entry: SpeciesStats = {
      usage: 0.1, count: 100, items: {}, teraTypes: {}, spreads: {}, teammates: {}, checks: {}, abilities: { roughskin: 1 },
      moves: { aquatail: 0.95, earthquake: 0.9, stealthrock: 0.8, swordsdance: 0.7, dragonclaw: 0.6 },
    };
    const stats = { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: { Garchomp: entry } };
    expect(defaultSet({ stats, sets: {}, formatId: 'gen9ag' }, 'Garchomp', 9).moves).toContain('Aqua Tail');
    expect(defaultSet({ stats, sets: {}, formatId: 'gen9ag', game: 'sv' }, 'Garchomp', 9).moves)
      .toEqual(['Earthquake', 'Stealth Rock', 'Swords Dance', 'Dragon Claw']);
  });
});

describe('Coaching intatto col gioco', () => {
  const entry: SpeciesStats = {
    usage: 0.1, count: 100, items: {}, teraTypes: {}, spreads: {}, teammates: {}, checks: {}, abilities: { roughskin: 1 },
    moves: { aquatail: 0.95, earthquake: 0.9, stealthrock: 0.8, swordsdance: 0.7 },
  };
  const stats = { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: { Garchomp: entry } };
  const member = set('Garchomp', 'Rough Skin', ['Earthquake']);

  it('le mosse quasi obbligatorie del Coaching non leggono il gioco dai dati', () => {
    const plain = coreMoves(member, { stats, sets: {}, formatId: 'gen9ag', ignoreMeta: true }, 9);
    expect(plain).toContain('Aqua Tail');
    expect(coreMoves(member, { stats, sets: {}, formatId: 'gen9ag', ignoreMeta: true, game: 'sv' }, 9)).toEqual(plain);
  });

  it('chi propone i set nel gioco le filtra col gioco', () => {
    expect(coreMoves(member, { stats, sets: {} }, 9, 'sv')).not.toContain('Aqua Tail');
  });
});
