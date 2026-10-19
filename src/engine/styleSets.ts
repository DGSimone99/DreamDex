import type { EngineData } from './data';
import { battleSpecies, dex, getMove, getSpecies, isDefined, toID } from './dex';
import { EMPTY_FILTERS, searchPool } from './filters';
import type { FillStyle } from './fillProposals';
import type { Format } from './format';
import { isLegalIn } from './formats';
import { isLearnable, legalAbilities, legalMoves } from './learnsets';
import type { TeamSet } from './sets';
import { benefits, conditionTools, enables } from './synergy';

/** Mosse e abilità che non contano come stile (come in teamArchetype): Chilly Reception porta la neve di passaggio, Weather Ball la sfrutta poco. */
const NOT_A_SETTER = 'chillyreception';
const NOT_A_USER = 'weatherball';

const setsUp = (set: TeamSet, style: FillStyle) => enables(set).some(e => e.condition === style && toID(e.via) !== NOT_A_SETTER);
const uses = (set: TeamSet, style: FillStyle) => benefits(set).some(b => b.condition === style && toID(b.via) !== NOT_A_USER);
/** Con la megapietra combatte la Mega: l'abilità è la sua e non si cambia. */
const abilityLocked = (set: TeamSet) => {
  const forme = battleSpecies(set);
  return !!forme && forme.name !== getSpecies(set.species)?.name;
};

// Le tabelle delle condizioni usano gli id: nel set vanno i nomi
const moveName = (id: string) => getMove(id)?.name ?? id;
const abilityName = (id: string) => dex.abilities.get(id).name || id;

/** La prima abilità della lista che la specie può avere (con Custom Skillset: qualunque). */
function pickAbility(set: TeamSet, wanted: string[], genLimit: number): string | null {
  if (abilityLocked(set) || !wanted.length) return null;
  if (set.customSkillset) return abilityName(wanted[0]);
  const own = legalAbilities(set.species, genLimit) ?? [];
  return own.find(name => wanted.includes(toID(name))) ?? null;
}

/** La prima mossa della lista che la specie può imparare (con Custom Skillset: qualunque, se esiste). */
function pickMove(set: TeamSet, wanted: string[], genLimit: number): string | null {
  const legal = set.customSkillset ? null : legalMoves(set.species, genLimit);
  if (!set.customSkillset && !legal) return null;
  return wanted.find(id => !legal || isLearnable(legal, id)) ?? null;
}

/** Il set con la mossa nuova al posto dell'ultima (o in uno slot libero); le altre restano. */
function withMove(set: TeamSet, name: string): TeamSet {
  const moves = set.moves.filter(Boolean);
  const next = moves.length < 4 ? [...moves, name] : [...moves.slice(0, 3), name];
  return { ...set, moves: next };
}

/** Il set che porta lo stile: già lo porta, o con l'abilità che lo attiva, o con la mossa. Null se non può. */
export function asSetter(set: TeamSet, style: FillStyle, genLimit: number): TeamSet | null {
  if (setsUp(set, style)) return set;
  const tools = conditionTools(style);
  const ability = pickAbility(set, tools.enablerAbilities, genLimit);
  if (ability) return { ...set, ability };
  const move = pickMove(set, tools.enablerMoves.filter(id => id !== NOT_A_SETTER), genLimit);
  if (!move) return null;
  const adapted = withMove(set, moveName(move));
  return setsUp(adapted, style) ? adapted : null;
}

/** Il set che sfrutta lo stile: già lo sfrutta, o con l'abilità, o con la mossa (mai Weather Ball). Trick Room: solo i lenti. */
export function asUser(set: TeamSet, style: FillStyle, genLimit: number): TeamSet | null {
  if (uses(set, style)) return set;
  if (style === 'trickroom') return null;
  const tools = conditionTools(style);
  const ability = pickAbility(set, tools.benefitAbilities, genLimit);
  if (ability) return { ...set, ability };
  const move = pickMove(set, tools.benefitMoves.filter(id => id !== NOT_A_USER), genLimit);
  if (!move) return null;
  const adapted = withMove(set, moveName(move));
  return uses(adapted, style) ? adapted : null;
}


const poolCache = new WeakMap<EngineData, Map<string, TeamSet[]>>();

/**
 * Pokémon di tutto il Pokédex legale nel formato che possono portare o sfruttare lo stile, coi set già adattati.
 * Comprende chi non ha statistiche (set di riferimento della ricerca). Il team esclude le sue specie.
 */
export function stylePool(team: TeamSet[], style: FillStyle, format: Format, data: EngineData): TeamSet[] {
  let cache = poolCache.get(data);
  if (!cache) poolCache.set(data, (cache = new Map()));
  const numbers = team.map(set => getSpecies(set.species)?.num).filter(isDefined).sort((a, b) => a - b).join(',');
  const key = `${format.formatId}:${format.genLimit}:${format.ignoreBans}:${style}:${numbers}`;
  let pool = cache.get(key);
  if (!pool) {
    // Solo Pokémon completamente evoluti; i più forti per statistiche base prima (ne serve una manciata)
    pool = searchPool(team, format, data, EMPTY_FILTERS)
      .filter(set => { const forme = battleSpecies(set); return !!forme && isLegalIn(forme, format) && !getSpecies(set.species)?.nfe; })
      .map(set => asSetter(set, style, format.genLimit) ?? asUser(set, style, format.genLimit))
      .filter(isDefined)
      .sort((a, b) => (battleSpecies(b)?.bst ?? 0) - (battleSpecies(a)?.bst ?? 0));
    cache.set(key, pool);
  }
  return pool;
}
