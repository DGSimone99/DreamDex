import type { Species } from '@pkmn/dex';
import { dex, getMove, getSpecies, toID } from './dex';
import type { TeamSet } from './sets';

/** Per ogni specie: mossa → prima generazione in cui è imparabile (senza ereditarietà). */
let raw: Map<string, Map<string, number>> | null = null;
const resolved = new Map<string, Map<string, number>>();

/** Carica una volta i learnset di tutte le specie (circa 0,2 s). */
export async function initLearnsets(): Promise<void> {
  if (raw) return;
  const species = dex.species.all().filter(s => s.exists);
  const entries = await Promise.all(species.map(async s => [s.id, await dex.learnsets.get(s.id)] as const));
  const map = new Map<string, Map<string, number>>();
  for (const [id, data] of entries) {
    if (!data?.learnset) continue;
    const moves = new Map<string, number>();
    for (const [move, sources] of Object.entries(data.learnset)) {
      // Le fonti iniziano con la generazione: "9M", "8L50", "7S0"…
      const gens = (sources as string[]).map(source => Number(source[0])).filter(Number.isFinite);
      if (gens.length) moves.set(move, Math.min(...gens));
    }
    map.set(id, moves);
  }
  raw = map;
  resolved.clear();
}

export const learnsetsReady = (): boolean => raw !== null;

/** Mosse con la generazione minima, ereditando da forma base e pre-evoluzioni. */
function inherited(species: Species): Map<string, number> | null {
  if (!raw) return null;
  const cached = resolved.get(species.id);
  if (cached) return cached;
  const result = new Map<string, number>();
  const visit = (s: Species | null, seen: Set<string>) => {
    if (!s || seen.has(s.id)) return;
    seen.add(s.id);
    for (const [move, gen] of raw!.get(s.id) ?? []) result.set(move, Math.min(gen, result.get(move) ?? Infinity));
    if (s.changesFrom) visit(getSpecies(String(s.changesFrom)), seen);
    else if (s.baseSpecies !== s.name && !raw!.has(s.id)) visit(getSpecies(s.baseSpecies), seen);
    if (s.prevo) visit(getSpecies(s.prevo), seen);
  };
  visit(species, new Set());
  if (result.size === 0) return null;
  resolved.set(species.id, result);
  return result;
}

/** Mosse imparabili fino alla generazione indicata (id), o null se mancano i dati. */
export function legalMoves(speciesName: string, genLimit: number): Set<string> | null {
  const species = getSpecies(speciesName);
  const moves = species ? inherited(species) : null;
  if (!moves) return null;
  const legal = new Set<string>();
  for (const [id, gen] of moves) {
    const move = getMove(id);
    if (gen <= genLimit && (!move || move.gen <= genLimit)) legal.add(id);
  }
  return legal;
}

/** Abilità della specie esistenti fino alla generazione indicata; null prima della Gen 3 (niente abilità). */
export function legalAbilities(speciesName: string, genLimit: number): string[] | null {
  const species = getSpecies(speciesName);
  if (!species || genLimit < 3) return null;
  return Object.entries(species.abilities)
    .filter(([slot, name]) => name && (slot !== 'H' || genLimit >= 5) && dex.abilities.get(name).gen <= genLimit)
    .map(([, name]) => name as string);
}

/** Mosse e abilità non legali del set (vuoto con Custom Skillset o senza dati). */
export function illegalParts(set: TeamSet, genLimit: number): { moves: string[]; ability: string | null } {
  if (set.customSkillset) return { moves: [], ability: null };
  const moves = legalMoves(set.species, genLimit);
  const abilities = legalAbilities(set.species, genLimit);
  return {
    moves: moves ? set.moves.filter(m => m && getMove(m) && !moves.has(toID(m))) : [],
    ability: abilities && set.ability && !abilities.includes(set.ability) ? set.ability : null,
  };
}
