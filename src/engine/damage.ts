import { calculate, Field, Generations, Move as CalcMove, Pokemon } from '@smogon/calc';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import type { TeamSet } from './sets';
import type { Condition } from './synergy';

/** Tutti i formati dell'app sono di Scarlatto/Violetto: i dati di gen 9 della libreria hanno anche Mega e mosse Z. */
const gen = Generations.get(9);

/** Meteo e campi che entrano nel calcolo (Trick Room non cambia il danno). */
export type FieldCondition = Exclude<Condition, 'trickroom'>;

export interface HitOptions {
  conditions?: FieldCondition[];
  /** L'attaccante usa il Tera dichiarato nel set. */
  tera?: boolean;
  /** L'attaccante usa la mossa Z del suo cristallo (se è del tipo della mossa). */
  z?: boolean;
  boosts?: Partial<Record<'atk' | 'spa' | 'def', number>>;
}

export interface Hit {
  move: string;
  /** Danno medio in quota dei PS del difensore, per la precisione della mossa (può superare 1). */
  expected: number;
  /** Danno minimo in quota dei PS, senza la precisione: ≥ 1 è un KO sicuro se colpisce. */
  min: number;
}

/** Band e Specs bloccano su una mossa: il loro ×1,5 conta come ×1,35 (un decimo in meno di danno). */
export const CHOICE_LOCK = 0.9;
const LOCKING = new Set(['choiceband', 'choicespecs']);

const WEATHER: Partial<Record<FieldCondition, 'Sun' | 'Rain' | 'Sand' | 'Snow'>> = { sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' };
const TERRAIN: Partial<Record<FieldCondition, 'Electric' | 'Psychic' | 'Grassy' | 'Misty'>> = {
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grassy', mistyterrain: 'Misty',
};

/** Chiave del set per il contenuto: le proposte creano set sempre nuovi, uguali a quelli già calcolati. */
export const setKey = (set: TeamSet): string =>
  JSON.stringify([set.species, set.item, set.ability, set.moves, set.nature, set.evs, set.ivs ?? null, set.teraType ?? null]);

/** Cache limitate: oltre il limite si svuotano (i Pokémon e le mosse della libreria si riusano, il calcolo li copia). */
const LIMIT = 20000;
function cached<V>(cache: Map<string, V>, key: string, make: () => V): V {
  if (cache.has(key)) return cache.get(key)!;
  if (cache.size >= LIMIT) cache.clear();
  const value = make();
  cache.set(key, value);
  return value;
}
const pokemon = new Map<string, Pokemon | null>();
const moves = new Map<string, CalcMove | null>();
const fields = new Map<string, Field>();

/** Il Pokémon della libreria dal set: forma in battaglia (la Mega), abilità, strumento, natura, EV e IV. */
function toPokemon(set: TeamSet, options: HitOptions = {}): Pokemon | null {
  return cached(pokemon, `${setKey(set)}|${JSON.stringify(options.boosts ?? null)}|${!!options.tera}`, () => buildPokemon(set, options));
}

function buildPokemon(set: TeamSet, options: HitOptions): Pokemon | null {
  const species = battleSpecies(set);
  if (!species) return null;
  try {
    return new Pokemon(gen, species.name, {
      ability: battleAbility(set) || undefined,
      item: set.item || undefined,
      nature: set.nature || undefined,
      evs: set.evs,
      ivs: set.ivs,
      boosts: options.boosts,
      teraType: options.tera && set.teraType ? set.teraType as Pokemon['teraType'] : undefined,
    });
  } catch {
    return null;
  }
}

function toField(conditions: FieldCondition[] = []): Field {
  return cached(fields, conditions.join(','), () => {
    const weather = conditions.map(c => WEATHER[c]).find(Boolean);
    const terrain = conditions.map(c => TERRAIN[c]).find(Boolean);
    return new Field({ weather, terrain });
  });
}

/** Abilità e strumento dell'attaccante decidono quanti colpi fa una mossa multicolpo (Skill Link 5, Loaded Dice 4). */
function toMove(name: string, useZ: boolean, ability: string, item: string): CalcMove | null {
  return cached(moves, `${name}|${useZ}|${ability}|${item}`, () => {
    try {
      return new CalcMove(gen, name, { useZ, ability: (ability || undefined) as CalcMove['ability'], item: (item || undefined) as CalcMove['item'] });
    } catch {
      return null;
    }
  });
}

/** Il colpo migliore del set contro il difensore (mai terastallizzato); null senza mosse d'attacco o se la libreria non conosce i Pokémon. */
export function bestHit(attacker: TeamSet, defender: TeamSet, options: HitOptions = {}): Hit | null {
  const own = toPokemon(attacker, options);
  const target = toPokemon(defender);
  if (!own || !target) return null;
  const field = toField(options.conditions);
  const zType = options.z ? dex.items.get(attacker.item).zMoveType : undefined;
  // Lo sconto di Band e Specs si applica come PS del difensore più alti di un nono: danno ×0,9 su tutte le misure
  const hp = target.maxHP() / (LOCKING.has(toID(attacker.item)) ? CHOICE_LOCK : 1);
  let best: Hit | null = null;
  for (const name of attacker.moves) {
    const data = getMove(name);
    if (!data || data.category === 'Status') continue;
    const accuracy = data.accuracy === true ? 1 : data.accuracy / 100;
    // Mosse OHKO (Sheer Cold, Fissure): la libreria non le calcola; KO se colpiscono, salvo immunità
    if (data.ohko) {
      const types = target.types as string[];
      const immune = !dex.getImmunity(data.type, types) || (data.ohko === 'Ice' && types.includes('Ice'));
      const hit = { move: data.name, expected: immune ? 0 : accuracy, min: immune ? 0 : 1 };
      if (!best || hit.expected > best.expected) best = hit;
      continue;
    }
    const move = toMove(data.name, !!zType && zType === data.type, battleAbility(attacker), attacker.item);
    if (!move) continue;
    try {
      const result = calculate(gen, own, target, move, field);
      // Mosse multicolpo e Parental Bond: un elenco di tiri per ogni colpo, da sommare
      const damage = result.damage as number | number[] | number[][];
      const hits = (Array.isArray(damage) ? (Array.isArray(damage[0]) ? damage : [damage]) : [[damage]]) as number[][];
      if (!hits.length || !hits[0].length) continue;
      const avg = hits.reduce((acc, rolls) => acc + rolls.reduce((a, b) => a + b, 0) / rolls.length, 0);
      const low = hits.reduce((acc, rolls) => acc + Math.min(...rolls), 0);
      const hit = { move: data.name, expected: (avg / hp) * accuracy, min: low / hp };
      if (!best || hit.expected > best.expected) best = hit;
    } catch {
      // Una mossa che la libreria non sa calcolare non conta
    }
  }
  return best;
}
