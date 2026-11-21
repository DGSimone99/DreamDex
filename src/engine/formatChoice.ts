import { DEFAULT_FORMAT, type Format, type FormatId } from './format';
import { BATTLE_IDS, tiersOf, type BattleId } from './formats';
import { GAME_IDS, GAME_LOCK, gameReady, type GameId } from './games';

/**
 * La scelta del formato fatta dall'utente: una di tre famiglie, ognuna solo coi suoi campi.
 * Il motore non la legge: legge le regole (`Format`) che ne ricava `rulesOf`.
 */

/** Generazione Smogon: National Dex o una generazione (per ora solo la 9; poi 8…1). */
export type CompetitiveGen = 'natdex' | 9;
export type CompetitiveChoice = {
  family: 'competitive'; source: 'smogon'; gen: CompetitiveGen; battle: BattleId; tier: string;
  ignoreBans: boolean; multipleMegas: boolean;
};
export type GameChoice = { family: 'game'; game: GameId; allPokedex: boolean; legendaries: boolean };
export type FreeChoice = { family: 'free'; genLimit: number; multipleMegas: boolean };
export type FormatChoice = CompetitiveChoice | GameChoice | FreeChoice;
export type Family = FormatChoice['family'];
export const FAMILIES: Family[] = ['competitive', 'game', 'free'];

export const DEFAULT_CHOICE: CompetitiveChoice = {
  family: 'competitive', source: 'smogon', gen: 'natdex', battle: 'singles', tier: 'OU', ignoreBans: false, multipleMegas: false,
};

/** I tier di una generazione Smogon per quella lotta (vuoto se non c'è). */
export const tiersFor = (gen: CompetitiveGen, battle: BattleId): { formatId: FormatId; tier: string }[] =>
  tiersOf(gen === 'natdex' ? 'natdex' : 'gen9', battle);

/** Lotta e tier che esistono davvero: senza doppio si torna al singolo; un tier che non c'è diventa il primo. */
export function normalizeCompetitive(c: CompetitiveChoice): CompetitiveChoice {
  const battle = tiersFor(c.gen, c.battle).length ? c.battle : 'singles';
  const tiers = tiersFor(c.gen, battle);
  const tier = tiers.some(x => x.tier === c.tier) ? c.tier : tiers[0].tier;
  return battle === c.battle && tier === c.tier ? c : { ...c, battle, tier };
}

/** Le regole che il motore usa, ricavate dalla scelta. */
export function rulesOf(choice: FormatChoice): Format {
  switch (choice.family) {
    case 'competitive': {
      const c = normalizeCompetitive(choice);
      const formatId = tiersFor(c.gen, c.battle).find(x => x.tier === c.tier)!.formatId;
      return { ...DEFAULT_FORMAT, formatId, ignoreBans: c.ignoreBans, allowMultipleMegas: c.multipleMegas };
    }
    case 'game':
      return { ...DEFAULT_FORMAT, ...GAME_LOCK[choice.game], game: choice.game, allPokedex: choice.allPokedex, legendaries: choice.legendaries };
    case 'free':
      return { ...DEFAULT_FORMAT, formatId: 'all', genLimit: choice.genLimit, meta: false, allowMultipleMegas: choice.multipleMegas };
  }
}

const obj = (raw: unknown): Record<string, unknown> | null => (typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : null);

function sanitizeCompetitive(r: Record<string, unknown>): CompetitiveChoice | null {
  if (r.family !== 'competitive') return null;
  const gen: CompetitiveGen | null = r.gen === 'natdex' || r.gen === 9 ? r.gen : null;
  if (!gen) return null;
  const battle = BATTLE_IDS.find(id => id === r.battle) ?? 'singles';
  return normalizeCompetitive({
    ...DEFAULT_CHOICE, gen, battle, tier: typeof r.tier === 'string' ? r.tier : DEFAULT_CHOICE.tier,
    ignoreBans: r.ignoreBans === true, multipleMegas: r.multipleMegas === true,
  });
}

function sanitizeGame(r: Record<string, unknown>): GameChoice | null {
  const game = r.family === 'game' ? GAME_IDS.find(id => id === r.game) : undefined;
  return game ? { family: 'game', game, allPokedex: r.allPokedex === true, legendaries: r.legendaries === true } : null;
}

function sanitizeFree(r: Record<string, unknown>): FreeChoice | null {
  if (r.family !== 'free') return null;
  const n = r.genLimit;
  const genLimit = typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 9 ? n : 9;
  return { family: 'free', genLimit, multipleMegas: r.multipleMegas === true };
}

/** Una scelta salvata (sessione, team, link) resa valida; un gioco senza i suoi dati torna al formato di base. */
export function sanitizeChoice(raw: unknown): FormatChoice {
  const r = obj(raw);
  if (!r) return DEFAULT_CHOICE;
  const game = sanitizeGame(r);
  if (game) return gameReady(game.game) ? game : DEFAULT_CHOICE;
  return sanitizeCompetitive(r) ?? sanitizeFree(r) ?? DEFAULT_CHOICE;
}

/** L'ultima scelta di ogni famiglia: cambiando linguetta si ritrova quella. */
export type FormatMemory = { competitive: CompetitiveChoice; game: GameChoice; free: FreeChoice };
export const DEFAULT_MEMORY: FormatMemory = {
  competitive: DEFAULT_CHOICE,
  game: { family: 'game', game: 'sv', allPokedex: false, legendaries: false },
  free: { family: 'free', genLimit: 9, multipleMegas: false },
};

export const remember = (memory: FormatMemory, choice: FormatChoice): FormatMemory =>
  memory[choice.family] === choice ? memory : { ...memory, [choice.family]: choice };

export function sanitizeMemory(raw: unknown): FormatMemory {
  const r = obj(raw) ?? {};
  const part = <T>(value: unknown, fix: (x: Record<string, unknown>) => T | null, fallback: T): T => {
    const o = obj(value);
    return (o && fix(o)) ?? fallback;
  };
  return {
    competitive: part(r.competitive, sanitizeCompetitive, DEFAULT_MEMORY.competitive),
    game: part(r.game, sanitizeGame, DEFAULT_MEMORY.game),
    free: part(r.free, sanitizeFree, DEFAULT_MEMORY.free),
  };
}

/** "Più Mega ammesse" chiesto dall'avviso del team: i giochi non hanno l'opzione. */
export const withMultipleMegas = (choice: FormatChoice): FormatChoice =>
  choice.family === 'game' || choice.multipleMegas ? choice : { ...choice, multipleMegas: true };
