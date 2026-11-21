import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import {
  DEFAULT_CHOICE, DEFAULT_MEMORY, normalizeCompetitive, remember, rulesOf, sanitizeChoice, sanitizeMemory, withMultipleMegas,
  type CompetitiveChoice, type FormatChoice,
} from '../../src/engine/formatChoice';
import { initGames } from '../../src/engine/games';

const comp = (patch: Partial<CompetitiveChoice> = {}): CompetitiveChoice => ({ ...DEFAULT_CHOICE, ...patch });

describe('rulesOf dà le regole di oggi', () => {
  const table: [FormatChoice, Format][] = [
    [comp(), { ...DEFAULT_FORMAT, formatId: 'ou' }],
    [comp({ tier: 'Ubers' }), { ...DEFAULT_FORMAT, formatId: 'ubers' }],
    [comp({ tier: 'UU' }), { ...DEFAULT_FORMAT, formatId: 'uu' }],
    [comp({ battle: 'doubles' }), { ...DEFAULT_FORMAT, formatId: 'natdexdoubles' }],
    [comp({ gen: 9 }), { ...DEFAULT_FORMAT, formatId: 'gen9ou' }],
    [comp({ gen: 9, tier: 'Ubers' }), { ...DEFAULT_FORMAT, formatId: 'gen9ubers' }],
    [comp({ gen: 9, tier: 'UU' }), { ...DEFAULT_FORMAT, formatId: 'gen9uu' }],
    [comp({ gen: 9, tier: 'Anything Goes' }), { ...DEFAULT_FORMAT, formatId: 'gen9ag' }],
    [comp({ ignoreBans: true, multipleMegas: true }), { ...DEFAULT_FORMAT, formatId: 'ou', ignoreBans: true, allowMultipleMegas: true }],
    [{ family: 'game', game: 'sv', allPokedex: true, legendaries: false },
      { ...DEFAULT_FORMAT, formatId: 'gen9ag', meta: false, genLimit: 9, game: 'sv', allPokedex: true, legendaries: false }],
    [{ family: 'free', genLimit: 7, multipleMegas: true },
      { ...DEFAULT_FORMAT, formatId: 'all', genLimit: 7, meta: false, allowMultipleMegas: true }],
  ];
  it.each(table)('%o', (choice, expected) => {
    expect(rulesOf(choice)).toEqual(expected);
  });

  it('il competitivo ha sempre genLimit 9 e meta acceso', () => {
    for (const [choice] of table.filter(([c]) => c.family === 'competitive')) {
      expect(rulesOf(choice).genLimit).toBe(9);
      expect(rulesOf(choice).meta).toBe(true);
    }
  });
});

describe('normalizeCompetitive', () => {
  it('Gen 9 col Doppio torna Singolo e primo tier', () => {
    expect(normalizeCompetitive(comp({ gen: 9, battle: 'doubles', tier: 'OU' }))).toMatchObject({ battle: 'singles', tier: 'OU' });
  });
  it('un tier che non esiste nella generazione diventa il primo', () => {
    expect(normalizeCompetitive(comp({ gen: 'natdex', tier: 'Anything Goes' })).tier).toBe('OU');
  });
});

describe('sanitizeChoice', () => {
  afterEach(() => initGames(null));
  it.each([null, 'x', {}, { formatId: 'ou', genLimit: 9 }, { family: 'game', game: 'zz' }])('%o → formato di base', raw => {
    expect(sanitizeChoice(raw)).toEqual(DEFAULT_CHOICE);
  });
  it('generazione fuori scala torna 9', () => {
    expect(sanitizeChoice({ family: 'free', genLimit: 12 })).toEqual({ family: 'free', genLimit: 9, multipleMegas: false });
  });
  it('una scelta valida esce identica', () => {
    const free: FormatChoice = { family: 'free', genLimit: 6, multipleMegas: true };
    expect(sanitizeChoice(free)).toEqual(free);
    const ubers = comp({ gen: 9, tier: 'Ubers', ignoreBans: true });
    expect(sanitizeChoice(ubers)).toEqual(ubers);
  });
  it('un gioco senza dati torna al formato di base, con i dati resta', () => {
    const game: FormatChoice = { family: 'game', game: 'sv', allPokedex: false, legendaries: true };
    expect(sanitizeChoice(game)).toEqual(DEFAULT_CHOICE);
    initGames({ sv: { dex: ['pikachu'] } });
    expect(sanitizeChoice(game)).toEqual(game);
  });
});

describe('memoria per famiglia', () => {
  it('remember sostituisce solo la propria famiglia', () => {
    const free: FormatChoice = { family: 'free', genLimit: 4, multipleMegas: false };
    const next = remember(DEFAULT_MEMORY, free);
    expect(next.free).toEqual(free);
    expect(next.competitive).toEqual(DEFAULT_MEMORY.competitive);
    expect(next.game).toEqual(DEFAULT_MEMORY.game);
  });
  it('sanitizeMemory: assente → default, voce rotta → default di quella voce', () => {
    expect(sanitizeMemory(null)).toEqual(DEFAULT_MEMORY);
    const uu = comp({ tier: 'UU' });
    expect(sanitizeMemory({ competitive: uu, free: 'rotto' })).toEqual({ ...DEFAULT_MEMORY, competitive: uu });
  });
  it('la memoria di Giochi resta anche senza dati dei giochi', () => {
    expect(sanitizeMemory({ game: { family: 'game', game: 'sv', allPokedex: true, legendaries: false } }).game.allPokedex).toBe(true);
  });
});

describe('withMultipleMegas', () => {
  it('accende Più Mega in competitivo e No Format, non tocca i giochi', () => {
    expect(withMultipleMegas(comp())).toMatchObject({ multipleMegas: true });
    expect(withMultipleMegas({ family: 'free', genLimit: 9, multipleMegas: false })).toMatchObject({ multipleMegas: true });
    const game: FormatChoice = { family: 'game', game: 'sv', allPokedex: false, legendaries: false };
    expect(withMultipleMegas(game)).toBe(game);
  });
});
