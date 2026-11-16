import { beforeAll, describe, expect, it } from 'vitest';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { exclusiveOf, gameOf, gameReady, initGames, isLegendary, obtainableIn, withGame } from '../../src/engine/games';
import { candidatePool } from '../../src/engine/scoring';
import { EMPTY_FILTERS, searchPool } from '../../src/engine/filters';
import { fixtureData } from '../fixtures/data';
import { sanitizeFormat } from '../../src/storage';

describe('gioco nel formato', () => {
  it('il gioco blocca il formato su Gen 9 senza meta', () => {
    const f = withGame({ ...DEFAULT_FORMAT, formatId: 'ou', meta: true, genLimit: 7, allowMultipleMegas: true }, 'sv');
    expect(f).toMatchObject({ game: 'sv', formatId: 'gen9ag', meta: false, genLimit: 9, allowMultipleMegas: false, ignoreBans: false });
    expect(gameOf(f)).toBe('sv');
    expect(gameOf(DEFAULT_FORMAT)).toBeNull();
    expect(withGame({ ...f, allPokedex: true, legendaries: true }, null)).toMatchObject({ game: null, allPokedex: false, legendaries: false });
  });

  it('un gioco salvato rimette il suo blocco', () => {
    expect(sanitizeFormat({ formatId: 'ou', meta: true, game: 'sv', allPokedex: true, legendaries: 'x' }))
      .toMatchObject({ game: 'sv', formatId: 'gen9ag', meta: false, allPokedex: true, legendaries: false });
    expect(sanitizeFormat({ formatId: 'ou', game: 'pippo' })).toMatchObject({ game: null, formatId: 'ou', allPokedex: false, legendaries: false });
  });
});

describe('ottenibili nel gioco', () => {
  beforeAll(() => initGames({ sv: { dex: ['sprigatito', 'floragato', 'meowscarada', 'larvitar', 'pupitar', 'tyranitar', 'koraidon', 'tauros', 'vulpix', 'rotom'] } }));
  const sv = (patch: Partial<Format> = {}): Format => ({ ...withGame(DEFAULT_FORMAT, 'sv'), ...patch });
  const sp = (name: string) => getSpecies(name)!;

  it('nella coppia di versioni, evoluzioni comprese', () => {
    expect(gameReady('sv')).toBe(true);
    expect(obtainableIn(sp('Meowscarada'), sv())).toBe(true);
    expect(obtainableIn(sp('Tyranitar'), sv())).toBe(true);
    expect(obtainableIn(sp('Venusaur'), sv())).toBe(false);
    expect(obtainableIn(sp('Venusaur'), sv({ allPokedex: true }))).toBe(true);
    expect(obtainableIn(sp('Charizard-Mega-X'), sv({ allPokedex: true }))).toBe(false);
    expect(obtainableIn(sp('Venusaur'), DEFAULT_FORMAT)).toBe(true);
  });

  it('leggendari e misteriosi solo con l\'opzione', () => {
    expect(isLegendary(sp('Koraidon'))).toBe(true);
    expect(obtainableIn(sp('Koraidon'), sv())).toBe(false);
    expect(obtainableIn(sp('Koraidon'), sv({ legendaries: true }))).toBe(true);
    expect(obtainableIn(sp('Mew'), sv({ allPokedex: true }))).toBe(false);
    expect(obtainableIn(sp('Mew'), sv({ allPokedex: true, legendaries: true }))).toBe(true);
  });

  it('forme: Paldea e le altre forme seguono la specie, le regionali di altre regioni solo se catturabili', () => {
    expect(obtainableIn(sp('Tauros-Paldea-Combat'), sv())).toBe(true);
    expect(obtainableIn(sp('Rotom-Wash'), sv())).toBe(true);
    expect(obtainableIn(sp('Ninetales-Alola'), sv())).toBe(true);
    expect(obtainableIn(sp('Tyranitar'), sv())).toBe(true);
    expect(obtainableIn(sp('Typhlosion-Hisui'), sv())).toBe(false);
  });

  it('esclusive di una versione', () => {
    expect(exclusiveOf(sp('Tyranitar'), sv())).toBe('scarlet');
    expect(exclusiveOf(sp('Salamence'), sv())).toBe('violet');
    expect(exclusiveOf(sp('Tauros-Paldea-Aqua'), sv())).toBe('violet');
    expect(exclusiveOf(sp('Meowscarada'), sv())).toBeNull();
    expect(exclusiveOf(sp('Tyranitar'), DEFAULT_FORMAT)).toBeNull();
  });

  it('candidati e ricerca seguono il gioco e le opzioni', () => {
    const pool = candidatePool([], sv(), fixtureData);
    expect(pool).toContain('Meowscarada');
    expect(pool).not.toContain('Floragato');
    expect(pool).not.toContain('Venusaur');
    expect(candidatePool([], sv({ allPokedex: true }), fixtureData)).toContain('Venusaur');
    expect(searchPool([], sv(), fixtureData, EMPTY_FILTERS).map(s => s.species)).not.toContain('Venusaur');
    expect(searchPool([], sv({ allPokedex: true }), fixtureData, EMPTY_FILTERS).map(s => s.species)).toContain('Venusaur');
  });

  it('senza gioco i candidati restano quelli delle statistiche', () => {
    const plain = { ...DEFAULT_FORMAT, formatId: 'gen9ag' as const, meta: false };
    expect(candidatePool([], plain, fixtureData)).not.toContain('Meowscarada');
  });
});
