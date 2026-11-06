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
  boosts?: Partial<Record<'atk' | 'spa' | 'def' | 'spd', number>>;
  /** Aumenti di Difesa e Dif. Speciale del bersaglio (setup difensivo); un attaccante Unaware li ignora. */
  targetBoosts?: Partial<Record<'def' | 'spd', number>>;
  /** Tipo del colpo standard (`standardHit`); senza, un colpo senza tipo. */
  moveType?: string;
  /** Solo le mosse super efficaci sul bersaglio (la Coverage: il vantaggio di tipo, non il danno neutro). */
  superEffectiveOnly?: boolean;
  /** Solo le mosse prioritarie (Grassy Glide col Grassy Terrain); Fake Out e First Impression valgono metà (solo al primo turno). */
  priorityOnly?: boolean;
  /**
   * Il colpo lo riceve il team (le minacce del meta): niente sconto della Choice. Il blocco su una mossa è un costo per
   * chi attacca, non toglie danno a chi lo prende.
   */
  incoming?: boolean;
  /**
   * Quanto conta l'effetto del primo colpo del difensore (Multiscale, Shadow Shield, Tera Shell): FIRST_HIT_SHARE,
   * o FIRST_HIT_SHARE_RECOVERY se il difensore torna a PS pieni (`firstHitShare` in defense.ts). Air Balloon sempre un quarto.
   */
  firstHitShare?: number;
}

/**
 * Effetti che valgono solo a PS pieni o fino al primo colpo: Multiscale e Shadow Shield dimezzano il danno, Tera Shell lo
 * rende poco efficace, Air Balloon dà l'immunità alla Terra finché non scoppia. Il voto misura colpi ripetuti: contano un
 * quarto del loro effetto, metà se il Pokémon si cura (torna a PS pieni e l'abilità si riaccende); Air Balloon non torna.
 * Scelta dell'utente 2026-11-06.
 */
export const FIRST_HIT_SHARE = 0.25;
export const FIRST_HIT_SHARE_RECOVERY = 0.5;
const FIRST_HIT_ABILITIES = new Set(['multiscale', 'shadowshield', 'terashell']);

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

/**
 * Un bersaglio può avere tipi e difese base sovrascritti: il manichino della Coverage di tipi e della Potenza è un
 * Pokémon di un solo tipo con le difese medie di quel tipo.
 */
export type Target = TeamSet & {
  types?: string[]; baseStats?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd', number>>;
  /** Il difensore senza gli effetti del primo colpo (abilità neutra, niente Air Balloon): per la quota di `firstHitShare`. */
  noFirstHit?: boolean;
};

/** Chiave del set per il contenuto: le proposte creano set sempre nuovi, uguali a quelli già calcolati. */
export const setKey = (set: Target): string =>
  JSON.stringify([set.species, set.item, set.ability, set.moves, set.nature, set.evs, set.ivs ?? null, set.teraType ?? null, set.types ?? null, set.baseStats ?? null, !!set.noFirstHit]);

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

/** Abilità che impediscono lo stato dello strumento: bruciore (Water Veil, Water Bubble, Thermal Exchange) o tutti e due. */
const NO_BURN = new Set(['waterveil', 'waterbubble', 'thermalexchange']);
const NO_POISON = new Set(['immunity', 'pastelveil']);
const NO_STATUS = new Set(['comatose', 'purifyingsalt']);

/**
 * Lo stato che il membro si dà da solo con lo strumento: Flame Orb scotta, Toxic Orb avvelena gravemente. Null se non ha
 * l'Orb o ne è immune (Fuoco col bruciore, Veleno e Acciaio col veleno, o l'abilità). Vale per il danno (Guts, Facade,
 * Toxic Boost, Marvel Scale, il bruciore che dimezza l'Attacco) e per la Sostenibilità (la perdita, Poison Heal).
 */
export function orbStatus(set: Target): 'brn' | 'tox' | null {
  const item = toID(set.item);
  if (item !== 'flameorb' && item !== 'toxicorb') return null;
  const ability = toID(battleAbility(set));
  const types: string[] = set.types ?? battleSpecies(set)?.types ?? [];
  if (NO_STATUS.has(ability)) return null;
  if (item === 'flameorb') return types.includes('Fire') || NO_BURN.has(ability) ? null : 'brn';
  return types.includes('Poison') || types.includes('Steel') || NO_POISON.has(ability) ? null : 'tox';
}

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

/** L'abilità per la libreria; senza gli effetti del primo colpo (`noFirstHit`) una neutra al posto di Multiscale & co. */
function calcAbility(set: Target): string | undefined {
  const ability = battleAbility(set);
  return set.noFirstHit && FIRST_HIT_ABILITIES.has(toID(ability)) ? 'Pressure' : ability || undefined;
}

/** La quota dell'effetto del primo colpo del difensore, o null se non ne ha. Air Balloon sempre un quarto. */
function firstHitOf(defender: Target, options: HitOptions): number | null {
  if (defender.noFirstHit) return null;
  if (toID(defender.item) === 'airballoon') return FIRST_HIT_SHARE;
  return FIRST_HIT_ABILITIES.has(toID(battleAbility(defender))) ? options.firstHitShare ?? FIRST_HIT_SHARE : null;
}

/** Il colpo col difensore con e senza l'effetto del primo colpo, mescolati secondo la quota. */
function withFirstHit(defender: Target, options: HitOptions, hit: (target: Target) => Hit | null): Hit | null {
  const share = firstHitOf(defender, options);
  if (share === null) return hit(defender);
  const on = hit(defender);
  const off = hit({ ...defender, noFirstHit: true });
  if (!on || !off) return on ?? off;
  const mix = (a: number, b: number) => b + share * (a - b);
  return { move: off.move, expected: mix(on.expected, off.expected), min: mix(on.min, off.min), max: mix(on.max, off.max) };
}

/** Il nome dello strumento come lo vuole la libreria ("choice band" → "Choice Band"); niente se sconosciuto. */
function knownItem(item: string): string | undefined {
  const found = item ? dex.items.get(item) : null;
  return found?.exists ? found.name : undefined;
}

function tryPokemon(name: string, set: Target, options: HitOptions): Pokemon | null {
  try {
    return new Pokemon(gen, name, {
      ability: calcAbility(set),
      // Strumento e natura sconosciuti non fanno fallire il calcolo (il Pokémon sparirebbe): niente strumento, natura neutra
      item: set.noFirstHit && toID(set.item) === 'airballoon' ? undefined : knownItem(set.item),
      nature: set.nature && dex.natures.get(set.nature).exists ? dex.natures.get(set.nature).name : undefined,
      evs: set.evs,
      ivs: set.ivs,
      boosts: options.boosts,
      // Protosynthesis / Quark Drive: la libreria li accende solo con questo campo. Statistica più alta ×1,3 (×1,5 la Velocità) con la
      // Booster Energy o col sole / campo elettrico del calcolo (il campo dei compagni vale metà: vedi offense.ts)
      boostedStat: 'auto',
      status: orbStatus(set) ?? undefined,
      teraType: options.tera && set.teraType ? set.teraType as Pokemon['teraType'] : undefined,
      overrides: set.types || set.baseStats ? {
        ...(set.types ? { types: set.types as [Pokemon['types'][0]] } : {}),
        // Il manichino: le difese medie del tipo, il resto 100 (non conta per chi riceve il colpo)
        ...(set.baseStats ? { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100, ...set.baseStats } } : {}),
      } : undefined,
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

/**
 * La mossa per la libreria. L'abilità decide quanti colpi fa una multicolpo (Skill Link 5); `hits` li fissa a mano
 * (Loaded Dice, che la libreria ignora: vedi `diceHits`).
 */
function toMove(name: string, useZ: boolean, ability: string, item: string, hits?: number): CalcMove | null {
  return cached(moves, `${name}|${useZ}|${ability}|${item}|${hits ?? ''}`, () => {
    try {
      return new CalcMove(gen, name, { useZ, ability: (ability || undefined) as CalcMove['ability'], item: (item || undefined) as CalcMove['item'], ...(hits ? { hits } : {}) });
    } catch {
      return null;
    }
  });
}

/**
 * Quanti colpi fa una multicolpo con Loaded Dice: 4 o 5 per quelle da 2-5 colpi. Population Bomb resta ai 10 colpi
 * della libreria (che conta già tutti i colpi a segno: Loaded Dice non deve valere meno di nessuno strumento).
 * Senza Loaded Dice, con Skill Link (già 5 colpi) o per le altre mosse, quelli che decide la libreria (un solo calcolo).
 */
function diceHits(move: NonNullable<ReturnType<typeof getMove>>, item: string, ability: string): (number | undefined)[] {
  if (toID(item) !== 'loadeddice' || toID(ability) === 'skilllink') return [undefined];
  const range = move.multihit;
  if (Array.isArray(range) && range[0] === 2 && range[1] === 5) return [4, 5];
  return [undefined];
}

/** Il colpo migliore del set contro il difensore (mai terastallizzato); null senza mosse d'attacco o se la libreria non conosce i Pokémon. */
export function bestHit(attacker: TeamSet, defender: Target, options: HitOptions = {}): Hit | null {
  return withFirstHit(defender, options, target => bestHitOn(attacker, target, options));
}

function bestHitOn(attacker: TeamSet, defender: Target, options: HitOptions): Hit | null {
  const own = toPokemon(attacker, options);
  const target = toPokemon(defender, {}, 'defender');
  if (!own || !target) return null;
  const field = toField(options.conditions);
  const zType = options.z ? dex.items.get(attacker.item).zMoveType : undefined;
  // Lo sconto di Band e Specs si applica come PS del difensore più alti di un nono: danno ×0,9 su tutte le misure
  // (solo quando attacca un membro del team: chi riceve il colpo prende il danno pieno)
  const hp = target.maxHP() / (LOCKING.has(toID(attacker.item)) && !options.incoming ? CHOICE_LOCK : 1);
  const types = target.types as string[];
  let best: Hit | null = null;
  for (const name of attacker.moves) {
    const data = getMove(name);
    if (!data || data.category === 'Status') continue;
    const grassyGlide = data.id === 'grassyglide' && (options.conditions ?? []).includes('grassyterrain');
    if (options.priorityOnly && !(data.priority > 0 || grassyGlide)) continue;
    const accuracy = data.accuracy === true ? 1 : data.accuracy / 100;
    // Mosse OHKO (Sheer Cold, Fissure): la libreria non le calcola; KO se colpiscono, salvo immunità
    if (data.ohko) {
      if (options.superEffectiveOnly && !superEffective(data.type, data.id, types)) continue;
      const immune = !dex.getImmunity(data.type, types) || (data.ohko === 'Ice' && types.includes('Ice'));
      const hit = { move: data.name, expected: immune ? 0 : accuracy, min: immune ? 0 : 1, max: immune ? 0 : 1 };
      if (!best || hit.expected > best.expected) best = hit;
      continue;
    }
    const useZ = !!zType && zType === data.type;
    // Loaded Dice: la media dei colpi possibili, ognuno col suo calcolo (la libreria ne conterebbe sempre quelli di base)
    const hitCounts = useZ ? [undefined] : diceHits(data, attacker.item, battleAbility(attacker));
    const calcMoves = hitCounts.map(hits => toMove(data.name, useZ, battleAbility(attacker), knownItem(attacker.item) ?? '', hits));
    if (calcMoves.some(m => !m)) continue;
    try {
      const results = calcMoves.map(m => calculate(gen, own, target, m!, field));
      // La Coverage vuole il vantaggio di tipo: si guarda il tipo con cui la mossa colpisce davvero (Pixilate, Ivy Cudgel, Tera Blast…)
      if (options.superEffectiveOnly && !superEffective(results[0].move.type, data.id, types)) continue;
      const all = results.map(r => rollSums(r.damage));
      if (all.some(x => !x)) continue;
      const avg = all.reduce((acc, x) => acc + x!.avg, 0) / all.length;
      const low = Math.min(...all.map(x => x!.low));
      const high = Math.max(...all.map(x => x!.high));
      // Mosse a due turni (Solar Blade, Meteor Beam…): un colpo ogni due turni, salvo sole/pioggia giusti o Power Herb
      const charge = data.flags.charge && !instantCharge(data.id, options.conditions ?? [], attacker.item) ? 0.5 : 1;
      const firstTurn = !options.priorityOnly ? 1 : FIRST_TURN.has(data.id) ? 0.5 : IF_ATTACKED.has(data.id) ? 0.75 : 1;
      const hit = { move: data.name, expected: (avg / hp) * accuracy * charge * firstTurn, min: (low / hp) * charge, max: (high / hp) * charge };
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
/** Mosse prioritarie che funzionano solo al primo turno in campo: metà. */
const FIRST_TURN = new Set(['fakeout', 'firstimpression']);
/** Mosse prioritarie che falliscono se l'avversario non attacca (setup, mosse di stato): tre quarti. */
const IF_ATTACKED = new Set(['suckerpunch', 'thunderclap']);

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

export function standardHit(attacker: Target, defender: Target, category: 'Physical' | 'Special', options: HitOptions = {}): Hit | null {
  return withFirstHit(defender, options, target => standardHitOn(attacker, target, category, options));
}

function standardHitOn(attacker: Target, defender: Target, category: 'Physical' | 'Special', options: HitOptions): Hit | null {
  const own = toPokemon(attacker, options);
  // Unaware ignora gli aumenti del bersaglio; la chiave della cache li contiene
  const targetBoosts = toID(battleAbility(attacker)) === 'unaware' ? undefined : options.targetBoosts;
  const target = toPokemon(defender, { boosts: targetBoosts }, 'defender');
  if (!own || !target) return null;
  // Il colpo tipizzato lo calcola la libreria (Wonder Guard ferma i non super efficaci); senza tipo vale un OHKO
  if (!options.moveType && toID(battleAbility(defender as TeamSet)) === 'wonderguard') return { move: category, expected: 1, min: 1, max: 1 };
  // Il colpo fisico è di contatto (come quasi tutte le mosse fisiche: Fluffy, Tough Claws), lo speciale no
  const type = options.moveType ?? '???';
  const move = cached(moves, `standard|${category}|${type}`, () => new CalcMove(gen, 'Tackle', {
    overrides: { type: type as never, basePower: 100, category, flags: { contact: category === 'Physical' ? 1 : 0 } },
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
