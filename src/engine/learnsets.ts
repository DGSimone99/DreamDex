import type { Species } from '@pkmn/dex';
import { battleSpecies, dex, getMove, getSpecies, toID } from './dex';
import type { TeamSet } from './sets';
import type { GameId } from './games';

/**
 * Valore della tabella: prima generazione in cui la mossa si impara (4 bit bassi) + 16 × maschera delle generazioni in cui
 * si impara giocando (livello, MT, tutore, uovo; bit g-1). Gli eventi contano solo per la prima generazione.
 */
const firstGen = (value: number) => value & 15;
const playMask = (value: number) => value >> 4;
const merge = (a: number | undefined, b: number) => (a === undefined ? b : Math.min(firstGen(a), firstGen(b)) + 16 * (playMask(a) | playMask(b)));

/** Generazione di ogni gioco (per le mosse imparabili nel gioco). */
const GAME_GEN: Record<GameId, number> = { sv: 9 };

/** Per ogni specie: mossa → valore codificato (vedi sopra), senza ereditarietà. */
let raw: Map<string, Map<string, number>> | null = null;
const resolved = new Map<string, Map<string, number>>();

/** Carica una volta i learnset di tutte le specie: una tabella compatta preparata da Vite (vite.config.ts). */
export async function initLearnsets(): Promise<void> {
  if (raw) return;
  const { default: table } = await import('virtual:learnsets');
  raw = new Map(Object.entries(table).map(([id, moves]) => [id, new Map(Object.entries(moves))]));
  resolved.clear();
}

export const learnsetsReady = (): boolean => raw !== null;

/** Mosse col valore codificato, ereditando da forma base e pre-evoluzioni. */
function inherited(species: Species): Map<string, number> | null {
  if (!raw) return null;
  const cached = resolved.get(species.id);
  if (cached) return cached;
  const result = new Map<string, number>();
  const visit = (s: Species | null, seen: Set<string>) => {
    if (!s || seen.has(s.id)) return;
    seen.add(s.id);
    for (const [move, value] of raw!.get(s.id) ?? []) result.set(move, merge(result.get(move), value));
    if (s.changesFrom) visit(getSpecies(String(s.changesFrom)), seen);
    else if (s.baseSpecies !== s.name && !raw!.has(s.id)) visit(getSpecies(s.baseSpecies), seen);
    if (s.prevo) visit(getSpecies(s.prevo), seen);
  };
  visit(species, new Set());
  if (result.size === 0) return null;
  resolved.set(species.id, result);
  return result;
}

/** Smeargle impara con Sketch ogni mossa normale della generazione, tranne Chatter e Struggle. */
function sketchable(genLimit: number): Set<string> | null {
  if (!raw) return null;
  return new Set(dex.moves.all()
    .filter(m => m.exists && m.gen <= genLimit && !m.isZ && !m.isMax && (!m.isNonstandard || m.isNonstandard === 'Past')
      && m.id !== 'chatter' && m.id !== 'struggle')
    .map(m => m.id));
}

/**
 * Mosse imparabili fino alla generazione indicata (id), o null se mancano i dati. Con un gioco: solo quelle che nel gioco
 * si imparano giocando (livello, MT, tutore, uovo, anche dalle pre-evoluzioni) e che lì esistono.
 */
export function legalMoves(speciesName: string, genLimit: number, game: GameId | null = null): Set<string> | null {
  const species = getSpecies(speciesName);
  if (species?.id === 'smeargle') {
    const all = sketchable(genLimit);
    return all && game ? new Set([...all].filter(id => !getMove(id)?.isNonstandard)) : all;
  }
  const moves = species ? inherited(species) : null;
  if (!moves) return null;
  const bit = game ? 1 << (GAME_GEN[game] - 1) : 0;
  const legal = new Set<string>();
  for (const [id, value] of moves) {
    const move = getMove(id);
    if (game ? playMask(value) & bit && !move?.isNonstandard : firstGen(value) <= genLimit && (!move || move.gen <= genLimit)) legal.add(id);
  }
  return legal;
}

/** Mossa imparabile: Hidden Power di un tipo ("Hidden Power Fire") conta come Hidden Power. */
export function isLearnable(legal: Set<string>, move: string): boolean {
  const id = toID(move);
  return legal.has(id) || (id.startsWith('hiddenpower') && legal.has('hiddenpower'));
}

/**
 * Abilità della specie esistenti fino alla generazione indicata; null prima della Gen 3 (niente abilità).
 * Comprende quelle delle forme solo-battaglia raggiunte senza strumento (Terapagos-Terastal: Tera Shell).
 */
export function legalAbilities(speciesName: string, genLimit: number): string[] | null {
  const species = getSpecies(speciesName);
  if (!species || genLimit < 3) return null;
  const own = Object.entries(species.abilities)
    .filter(([slot, name]) => name && (slot !== 'H' || genLimit >= 5) && dex.abilities.get(name).gen <= genLimit)
    .map(([, name]) => name as string);
  const battleOnly = (species.otherFormes ?? []).map(getSpecies)
    .filter(forme => forme && forme.battleOnly === species.name && !forme.requiredItem && forme.gen <= genLimit)
    .flatMap(forme => Object.values(forme!.abilities).filter(Boolean) as string[]);
  return [...new Set([...own, ...battleOnly])];
}

/** Abilità legale per il set: della specie, o della forma in cui combatte (con la megapietra: quella della Mega). */
export function isLegalAbility(set: TeamSet, abilities: string[]): boolean {
  const forme = battleSpecies(set);
  const mega = forme && forme.name !== getSpecies(set.species)?.name ? forme : null;
  return abilities.includes(set.ability) || (!!mega && Object.values(mega.abilities).includes(set.ability));
}

/**
 * Mosse e abilità non legali del set (vuoto con Custom Skillset o senza dati).
 * Con il Pokédex di Scarlatto/Violetto ('sv') sono illegali anche le mosse che lì non esistono (Pursuit, Hidden Power).
 */
export function illegalParts(set: TeamSet, genLimit: number, pokedex: 'natdex' | 'sv' = 'natdex'): { moves: string[]; ability: string | null } {
  if (set.customSkillset) return { moves: [], ability: null };
  const moves = legalMoves(set.species, genLimit);
  const abilities = legalAbilities(set.species, genLimit);
  const outside = (m: string) => pokedex === 'sv' && !!getMove(m)?.isNonstandard;
  return {
    moves: moves ? set.moves.filter(m => m && getMove(m) && (!isLearnable(moves, m) || outside(m))) : [],
    ability: abilities && set.ability && !isLegalAbility(set, abilities) ? set.ability : null,
  };
}
