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
  /** Solo le mosse super efficaci sul bersaglio (la Coverage: il vantaggio di tipo, non il danno neutro). */
  superEffectiveOnly?: boolean;
}

export interface Hit {
  move: string;
  /** Danno medio in quota dei PS del difensore, per la precisione della mossa (può superare 1). */
  expected: number;
  /** Danno minimo in quota dei PS, senza la precisione: ≥ 1 è un KO sicuro se colpisce. */
  min: number;
  /** Danno massimo in quota dei PS, senza la precisione: ≥ 1 è un KO possibile (la Difesa conta il caso peggiore). */
  max: number;
}

/** Band e Specs bloccano su una mossa: il loro ×1,5 conta come ×1,35 (un decimo in meno di danno). */
export const CHOICE_LOCK = 0.9;
const LOCKING = new Set(['choiceband', 'choicespecs']);

const WEATHER: Partial<Record<FieldCondition, 'Sun' | 'Rain' | 'Sand' | 'Snow'>> = { sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' };
const TERRAIN: Partial<Record<FieldCondition, 'Electric' | 'Psychic' | 'Grassy' | 'Misty'>> = {
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grassy', mistyterrain: 'Misty',
};

/** Il colpo è super efficace sui tipi del bersaglio; Freeze-Dry lo è sempre sull'Acqua. */
function superEffective(type: string, moveId: string, types: string[]): boolean {
  if (!dex.getImmunity(type, types)) return false;
  const water = moveId === 'freezedry' && types.includes('Water');
  return water || dex.getEffectiveness(type, types) > 0;
}

/** La mossa a due turni parte subito: Solar Beam/Blade al sole, Electro Shot con la pioggia, o con la Power Herb. */
function instantCharge(id: string, conditions: FieldCondition[], item: string): boolean {
  if (toID(item) === 'powerherb') return true;
  if ((id === 'solarbeam' || id === 'solarblade') && conditions.includes('sun')) return true;
  return id === 'electroshot' && conditions.includes('rain');
}

/** Un bersaglio può avere i tipi sovrascritti (il bersaglio neutro della Coverage senza meta: Mew di un solo tipo). */
export type Target = TeamSet & { types?: string[] };

/** Chiave del set per il contenuto: le proposte creano set sempre nuovi, uguali a quelli già calcolati. */
export const setKey = (set: Target): string =>
  JSON.stringify([set.species, set.item, set.ability, set.moves, set.nature, set.evs, set.ivs ?? null, set.teraType ?? null, set.types ?? null]);

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
function toPokemon(set: Target, options: HitOptions = {}, role: 'attacker' | 'defender' = 'attacker'): Pokemon | null {
  return cached(pokemon, `${setKey(set)}|${JSON.stringify(options.boosts ?? null)}|${!!options.tera}|${role}`, () => buildPokemon(set, options, role));
}

/**
 * Nomi che la libreria conosce: Aegislash attacca in forma Blade e difende in Shield;
 * le forme solo estetiche (Gastrodon-East, Vivillon-Polar…) sono la specie base.
 */
function calcNames(name: string, baseSpecies: string, role: 'attacker' | 'defender'): string[] {
  if (baseSpecies === 'Aegislash') return [role === 'attacker' ? 'Aegislash-Blade' : 'Aegislash-Shield'];
  return name === baseSpecies ? [name] : [name, baseSpecies];
}

function buildPokemon(set: Target, options: HitOptions, role: 'attacker' | 'defender'): Pokemon | null {
  const species = battleSpecies(set);
  if (!species) return null;
  for (const name of calcNames(species.name, species.baseSpecies, role)) {
    const built = tryPokemon(name, set, options);
    if (built) return built;
  }
  return null;
}

function tryPokemon(name: string, set: Target, options: HitOptions): Pokemon | null {
  try {
    return new Pokemon(gen, name, {
      ability: battleAbility(set) || undefined,
      item: set.item || undefined,
      nature: set.nature || undefined,
      evs: set.evs,
      ivs: set.ivs,
      boosts: options.boosts,
      teraType: options.tera && set.teraType ? set.teraType as Pokemon['teraType'] : undefined,
      overrides: set.types ? { types: set.types as [Pokemon['types'][0]] } : undefined,
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
export function bestHit(attacker: TeamSet, defender: Target, options: HitOptions = {}): Hit | null {
  const own = toPokemon(attacker, options);
  const target = toPokemon(defender, {}, 'defender');
  if (!own || !target) return null;
  const field = toField(options.conditions);
  const zType = options.z ? dex.items.get(attacker.item).zMoveType : undefined;
  // Lo sconto di Band e Specs si applica come PS del difensore più alti di un nono: danno ×0,9 su tutte le misure
  const hp = target.maxHP() / (LOCKING.has(toID(attacker.item)) ? CHOICE_LOCK : 1);
  const types = target.types as string[];
  let best: Hit | null = null;
  for (const name of attacker.moves) {
    const data = getMove(name);
    if (!data || data.category === 'Status') continue;
    const accuracy = data.accuracy === true ? 1 : data.accuracy / 100;
    // Mosse OHKO (Sheer Cold, Fissure): la libreria non le calcola; KO se colpiscono, salvo immunità
    if (data.ohko) {
      if (options.superEffectiveOnly && !superEffective(data.type, data.id, types)) continue;
      const immune = !dex.getImmunity(data.type, types) || (data.ohko === 'Ice' && types.includes('Ice'));
      const hit = { move: data.name, expected: immune ? 0 : accuracy, min: immune ? 0 : 1, max: immune ? 0 : 1 };
      if (!best || hit.expected > best.expected) best = hit;
      continue;
    }
    const move = toMove(data.name, !!zType && zType === data.type, battleAbility(attacker), attacker.item);
    if (!move) continue;
    try {
      const result = calculate(gen, own, target, move, field);
      // La Coverage vuole il vantaggio di tipo: si guarda il tipo con cui la mossa colpisce davvero (Pixilate, Ivy Cudgel, Tera Blast…)
      if (options.superEffectiveOnly && !superEffective(result.move.type, data.id, types)) continue;
      const sums = rollSums(result.damage);
      if (!sums) continue;
      const { avg, low, high } = sums;
      // Mosse a due turni (Solar Blade, Meteor Beam…): un colpo ogni due turni, salvo sole/pioggia giusti o Power Herb
      const charge = data.flags.charge && !instantCharge(data.id, options.conditions ?? [], attacker.item) ? 0.5 : 1;
      const hit = { move: data.name, expected: (avg / hp) * accuracy * charge, min: (low / hp) * charge, max: (high / hp) * charge };
      if (!best || hit.expected > best.expected) best = hit;
    } catch {
      // Una mossa che la libreria non sa calcolare non conta
    }
  }
  return best;
}

/**
 * Colpo standard per la Difesa: potenza 100, senza tipo (niente debolezze, resistenze, immunità né STAB),
 * con statistiche, EV, natura, strumento e abilità veri dell'attaccante contro il set vero del difensore.
 * Misura solo quanto il difensore regge, indipendentemente dalle mosse che l'attaccante porta.
 */
/** Mosse multicolpo e Parental Bond: la libreria dà un elenco di tiri per ogni colpo, da sommare. */
function rollSums(result: unknown): { avg: number; low: number; high: number } | null {
  const damage = result as number | number[] | number[][];
  const hits = (Array.isArray(damage) ? (Array.isArray(damage[0]) ? damage : [damage]) : [[damage]]) as number[][];
  if (!hits.length || !hits[0].length) return null;
  return {
    avg: hits.reduce((acc, rolls) => acc + rolls.reduce((a, b) => a + b, 0) / rolls.length, 0),
    low: hits.reduce((acc, rolls) => acc + Math.min(...rolls), 0),
    high: hits.reduce((acc, rolls) => acc + Math.max(...rolls), 0),
  };
}

export function standardHit(attacker: TeamSet, defender: Target, category: 'Physical' | 'Special', options: HitOptions = {}): Hit | null {
  const own = toPokemon(attacker, options);
  const target = toPokemon(defender, {}, 'defender');
  if (!own || !target) return null;
  // Wonder Guard ferma un colpo senza tipo, ma i colpi veri lo prendono super efficace: vale un OHKO
  if (toID(battleAbility(defender as TeamSet)) === 'wonderguard') return { move: category, expected: 1, min: 1, max: 1 };
  // Il colpo fisico è di contatto (come quasi tutte le mosse fisiche: Fluffy, Tough Claws), lo speciale no
  const move = cached(moves, `standard|${category}`, () => new CalcMove(gen, 'Tackle', {
    overrides: { type: '???', basePower: 100, category, flags: { contact: category === 'Physical' ? 1 : 0 } },
  }));
  if (!move) return null;
  const hp = target.maxHP() / (LOCKING.has(toID(attacker.item)) ? CHOICE_LOCK : 1);
  try {
    const result = calculate(gen, own, target, move, toField(options.conditions));
    const sums = rollSums(result.damage);
    if (!sums) return null;
    return { move: category, expected: sums.avg / hp, min: sums.low / hp, max: sums.high / hp };
  } catch {
    return null;
  }
}
