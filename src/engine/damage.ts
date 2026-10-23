import { calculate, Field, Generations, Move as CalcMove, Pokemon } from '@smogon/calc';
import { battleAbility, battleSpecies, dex, getMove } from './dex';
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

const WEATHER: Partial<Record<FieldCondition, 'Sun' | 'Rain' | 'Sand' | 'Snow'>> = { sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' };
const TERRAIN: Partial<Record<FieldCondition, 'Electric' | 'Psychic' | 'Grassy' | 'Misty'>> = {
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grassy', mistyterrain: 'Misty',
};

/** Il Pokémon della libreria dal set: forma in battaglia (la Mega), abilità, strumento, natura, EV e IV. */
function toPokemon(set: TeamSet, options: HitOptions = {}): Pokemon | null {
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
  const weather = conditions.map(c => WEATHER[c]).find(Boolean);
  const terrain = conditions.map(c => TERRAIN[c]).find(Boolean);
  return new Field({ weather, terrain });
}

/** Il colpo migliore del set contro il difensore (mai terastallizzato); null senza mosse d'attacco o se la libreria non conosce i Pokémon. */
export function bestHit(attacker: TeamSet, defender: TeamSet, options: HitOptions = {}): Hit | null {
  const own = toPokemon(attacker, options);
  const target = toPokemon(defender);
  if (!own || !target) return null;
  const field = toField(options.conditions);
  const zType = options.z ? dex.items.get(attacker.item).zMoveType : undefined;
  const hp = target.maxHP();
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
    try {
      const move = new CalcMove(gen, data.name, { useZ: !!zType && zType === data.type });
      const result = calculate(gen, own, target, move, field);
      const rolls = (Array.isArray(result.damage) ? result.damage.flat() : [result.damage]) as number[];
      if (!rolls.length) continue;
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const hit = { move: data.name, expected: (avg / hp) * accuracy, min: Math.min(...rolls) / hp };
      if (!best || hit.expected > best.expected) best = hit;
    } catch {
      // Una mossa che la libreria non sa calcolare non conta
    }
  }
  return best;
}
