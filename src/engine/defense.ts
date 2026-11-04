import { usesMeta } from './analysis';
import { metaThreats } from './attackers';
import { dexPool, ownConditions } from './coverage';
import { bestHit, setKey, standardHit, type FieldCondition, type Hit, type Target } from './damage';
import { ONE_USE_SHARE, rankWeighted } from './offense';
import { DEFAULT_FORMAT } from './format';
import { pokedexOf, teraAllowed } from './formats';
import { effectiveness, TYPES } from './types';
import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { REMOVAL_MOVES } from './roles';
import type { TeamSet } from './sets';
import { softScore } from './scale';

/** Valore di un colpo standard ricevuto (dal tiro più alto): OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5. */
export function holdStep(hit: Hit | null): number {
  if (!hit) return 1.5;
  return hit.max >= 1 ? 0 : hit.max >= 0.5 ? 0.5 : hit.max >= 1 / 3 ? 1 : 1.5;
}

/** Recupero per turno delle mosse (la migliore del set). */
const RECOVERY_MOVES: Record<string, number> = {
  recover: 0.5, roost: 0.5, slackoff: 0.5, softboiled: 0.5, milkdrink: 0.5, moonlight: 0.5, synthesis: 0.5,
  morningsun: 0.5, shoreup: 0.5, strengthsap: 0.5, wish: 0.25, rest: 0.33,
  leechseed: 0.125, painsplit: 0.25, junglehealing: 0.25, lunarblessing: 0.25,
};
/** Le mosse d'attacco che assorbono (Drain Punch, Giga Drain, Horn Leech, Draining Kiss…): circa un ottavo per turno. */
const DRAIN_RECOVERY = 0.125;
/** Abilità che curano solo col meteo del team: Rain Dish e Dry Skin con la pioggia, Ice Body con la neve. */
const WEATHER_HEAL: Record<string, { condition: FieldCondition; heal: number }> = {
  raindish: { condition: 'rain', heal: 0.0625 }, dryskin: { condition: 'rain', heal: 0.125 }, icebody: { condition: 'snow', heal: 0.0625 },
};
/** Recupero dell'abilità e dello strumento. */
const RECOVERY_ABILITIES: Record<string, number> = { regenerator: 0.33, poisonheal: 0.125 };
const RECOVERY_ITEMS: Record<string, number> = { leftovers: 0.0625, blacksludge: 0.0625 };
/** Stealth Rock all'ingresso: 1/8 dei PS per l'efficacia della Roccia. */
const STEALTH_ROCK = 0.125;
/** Con chi toglie gli hazard nel team la Stealth Rock pesa metà: le rocce si prendono comunque prima della rimozione. */
const ROCKS_WITH_REMOVAL = 0.5;
/**
 * Quanto toglie lo strumento del membro, come quota dei PS: Life Orb a ogni attacco, il bruciore di Flame Orb a ogni turno,
 * il veleno grave di Toxic Orb come media dei primi tre turni (1/16, 2/16, 3/16), Sticky Barb, Black Sludge su chi non è Veleno.
 */
const ITEM_LOSSES: Record<string, number> = { lifeorb: 0.1, flameorb: 0.0625, toxicorb: 0.125, stickybarb: 0.0625, blacksludge: 0.125 };
/**
 * Il recupero vale metà se il membro regge meno del 35% dei 36 colpi di tipo (pieno 1, a metà 0,5): un Pokémon con
 * Recover non è un muro se non regge i colpi. Con l'attaccante forte i muri veri stanno sopra (Toxapex 64%, Slowbro 43%,
 * Blissey 51%), gli attaccanti sotto (Garchomp 22%, Alakazam 3%).
 */
export const RECOVERY_HOLD = 0.35;
/** Recupero netto per turno che vale 100 di Sostenibilità. */
export const SUSTAIN_FULL = 0.5;

/** Le voci della Sostenibilità, per turno in quota dei PS: il recupero (già dimezzato se serve) e le perdite. */
export interface SustainParts {
  /** Mossa, abilità e strumento che curano (la mossa migliore sola). */
  sources: string[];
  recovery: number;
  /** Il recupero vale metà: il membro regge meno del 35% dei colpi di tipo. */
  halved: boolean;
  rocks: number;
  /** Chi toglie gli hazard nel team ("Defog (Corviknight)"): la Stealth Rock è già dimezzata. */
  rocksHalvedBy: string | null;
  /** Quanto toglie lo strumento (Life Orb, Flame Orb, Toxic Orb…) e quale. */
  itemLoss: number;
  itemLossFrom: string | null;
}

/** Il primo membro del team con una mossa che toglie gli hazard, come "Defog (Corviknight)". */
export function hazardRemover(team: TeamSet[]): string | null {
  for (const set of team) {
    const move = set.moves.find(m => REMOVAL_MOVES.has(toID(m)));
    if (move) return `${getMove(move)?.name ?? move} (${battleSpecies(set)?.name ?? set.species})`;
  }
  return null;
}

/**
 * Le voci della Sostenibilità del membro. `holdShare` è la quota (0–1) dei 36 colpi di tipo che regge (pieno 1, a metà 0,5);
 * `conditions` il meteo che il team porta (per Rain Dish, Dry Skin, Ice Body).
 */
export function sustainParts(set: TeamSet, holdShare: number, remover: string | null = null, conditions: FieldCondition[] = []): SustainParts {
  const ability = toID(battleAbility(set));
  const item = toID(set.item);
  const moveHeal = (m: string) => {
    const move = getMove(m);
    return RECOVERY_MOVES[toID(m)] ?? (move && move.category !== 'Status' && move.drain ? DRAIN_RECOVERY : 0);
  };
  const best = set.moves.reduce<string | null>((acc, m) => (moveHeal(m) > (acc ? moveHeal(acc) : 0) ? m : acc), null);
  // Poison Heal cura solo da avvelenato: lo garantisce Toxic Orb; Rain Dish, Dry Skin e Ice Body solo col loro meteo
  const weather = WEATHER_HEAL[ability];
  const abilityHeal = ability === 'poisonheal' && item !== 'toxicorb' ? 0
    : weather ? (conditions.includes(weather.condition) ? weather.heal : 0)
      : RECOVERY_ABILITIES[ability] ?? 0;
  const types: string[] = battleSpecies(set)?.types ?? [];
  // Black Sludge cura solo i Pokémon Veleno: agli altri toglie PS
  const itemHeal = item === 'blacksludge' && !types.includes('Poison') ? 0 : RECOVERY_ITEMS[item] ?? 0;
  const sources = [best, abilityHeal ? battleAbility(set) : null, itemHeal ? set.item : null]
    .filter((x): x is string => !!x);
  const gross = (best ? moveHeal(best) : 0) + abilityHeal + itemHeal;
  const halved = gross > 0 && holdShare < RECOVERY_HOLD;
  const magicGuard = ability === 'magicguard';
  const fullRocks = item === 'heavydutyboots' || magicGuard ? 0 : STEALTH_ROCK * effectiveness('Rock', types as never);
  const rocksHalvedBy = fullRocks > 0 ? remover : null;
  const rocks = rocksHalvedBy ? fullRocks * ROCKS_WITH_REMOVAL : fullRocks;
  // Sheer Force toglie il contraccolpo di Life Orb alle mosse con effetti secondari
  const sheerForce = ability === 'sheerforce' && set.moves.some(m => { const move = getMove(m); return !!(move?.secondary || move?.secondaries?.length); });
  // Niente danno con Magic Guard; niente stato per chi ne è immune (Fuoco col bruciore, Veleno e Acciaio col veleno), e
  // Poison Heal trasforma il veleno di Toxic Orb in cura
  const immune = (item === 'flameorb' && types.includes('Fire'))
    || (item === 'toxicorb' && (types.includes('Poison') || types.includes('Steel') || ability === 'poisonheal'))
    || (item === 'lifeorb' && sheerForce) || (item === 'blacksludge' && itemHeal > 0);
  const itemLoss = magicGuard || immune ? 0 : ITEM_LOSSES[item] ?? 0;
  return { sources, recovery: halved ? gross / 2 : gross, halved, rocks, rocksHalvedBy, itemLoss, itemLossFrom: itemLoss ? set.item : null };
}

/** Recupero meno perdite per turno (in quota dei PS); `holdShare` come in `sustainParts`. */
export function sustainability(set: TeamSet, holdShare: number, remover: string | null = null, conditions: FieldCondition[] = []): number {
  const parts = sustainParts(set, holdShare, remover, conditions);
  return parts.recovery - parts.rocks - parts.itemLoss;
}

/** Mosse di potenziamento difensivo e gli aumenti che i dati non descrivono (Stockpile, Curse). */
const DEFENSIVE_SETUP = new Set(['irondefense', 'acidarmor', 'barrier', 'cottonguard', 'cosmicpower', 'stockpile', 'defendorder', 'bulkup', 'coil', 'curse',
  'calmmind', 'amnesia', 'quiverdance', 'geomancy', 'shelter', 'victorydance', 'noretreat'].map(toID));
const DEFENSIVE_EXTRA: Record<string, { def?: number; spd?: number }> = { stockpile: { def: 1, spd: 1 }, curse: { def: 1 } };

/** La mossa di potenziamento difensivo più forte del set (per Dif. + Dif. Speciale), dopo un uso. */
export function defensiveSetup(set: TeamSet): { move: string; boosts: { def: number; spd: number } } | null {
  const ghost = (battleSpecies(set)?.types as readonly string[] | undefined)?.includes('Ghost');
  let best: { move: string; boosts: { def: number; spd: number } } | null = null;
  let bestSum = 0;
  for (const name of set.moves) {
    const move = getMove(name);
    if (!move || move.category !== 'Status' || !DEFENSIVE_SETUP.has(move.id)) continue;
    if (move.id === 'curse' && ghost) continue;
    const own = DEFENSIVE_EXTRA[move.id] ?? (move.target === 'self' ? move.boosts : undefined);
    if (!own) continue;
    const boosts = { def: Math.max(0, own.def ?? 0), spd: Math.max(0, own.spd ?? 0) };
    const sum = boosts.def + boosts.spd;
    if (sum > bestSum) { best = { move: move.name, boosts }; bestSum = sum; }
  }
  return best;
}

export interface MemberDefense {
  species: string;
  /** Mossa di setup difensivo e quanto alza il valore (tre quarti del guadagno, già dentro fisica, speciale e valore). */
  setupMove: string | null;
  setupGain: number;
  /** Quota (0–100) dei 18 colpi fisici e dei 18 speciali di tipo che regge: pieno 1, a metà 0,5. Solo informazione. */
  physical: number;
  special: number;
  /** Lo stesso sui 36 colpi: la colonna "Regge i tipi". */
  hold: number;
  /** Quota (0–100, pesata per uso) delle minacce del meta che regge: sotto metà PS pieno, sotto il KO a metà. Null senza meta. */
  metaHold: number | null;
  sustain: number;
  sustainParts: SustainParts;
  value: number;
}

/**
 * Credito di un membro su un colpo standard tipizzato (danno atteso, al massimo 1): pieno se regge 4 colpi o più
 * (sotto un terzo dei PS), metà se ne regge 3 (sotto la metà), niente da lì in su.
 */
export const holdCredit = (x: number): number => (x < 1 / 3 ? 1 : x < 1 / 2 ? 0.5 : 0);

const dummies = new Map<string, Target>();

/**
 * L'attaccante finto della Coverage di tipi: un attaccante forte del tipo del colpo, con l'Attacco (o l'Attacco Speciale)
 * medio del quarto più forte dei completamente evoluti di quel tipo nel Pokédex del formato; le altre statistiche 100, 252 EV e natura che lo alza,
 * nessuno strumento né abilità che conti, del tipo del colpo (STAB per tutti allo stesso modo).
 */
export function dummyAttacker(data: EngineData, side: 'atk' | 'spa', type: string): Target {
  const format = { ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' };
  const key = `${pokedexOf(format)}|${side}|${type}`;
  let dummy = dummies.get(key);
  if (dummy) return dummy;
  const values = dexPool(format).filter(s => (s.types as string[]).includes(type)).map(s => s.baseStats[side]).sort((a, b) => b - a);
  const top = values.slice(0, Math.max(1, Math.ceil(values.length / 4)));
  const stat = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
  dummy = {
    species: 'Mew', item: '', ability: 'Synchronize', moves: [], nature: side === 'atk' ? 'Adamant' : 'Modest',
    evs: { [side]: 252 }, types: [type], baseStats: { [side]: stat },
  };
  dummies.set(key, dummy);
  return dummy;
}

/** L'Attacco e l'Attacco Speciale base dell'attaccante finto di un tipo nel formato: quelli di `dummyAttacker` (per la guida). */
export function dummyStats(formatId: EngineData['formatId'], type: string): { atk: number; spa: number } {
  const data: EngineData = { stats: null, sets: null, formatId };
  return { atk: dummyAttacker(data, 'atk', type).baseStats?.atk ?? 0, spa: dummyAttacker(data, 'spa', type).baseStats?.spa ?? 0 };
}

/** Un'abilità che non tocca i danni ricevuti: prende il posto di Tera Shell nei colpi della Difesa. */
const NEUTRAL_ABILITY = 'Pressure';

/**
 * Tera Shell rende poco efficace ogni colpo solo a PS pieni; la Difesa misura colpi ripetuti, quindi il membro si misura
 * come se l'abilità non ci fosse (Coverage tipi e Coverage meta; l'Offesa non cambia). Senza Tera Shell: il set stesso.
 * Le cache restano per set: il set senza abilità dipende solo da quello vero.
 */
export function withoutTeraShell(member: TeamSet): TeamSet {
  return toID(battleAbility(member)) === 'terashell' ? { ...member, ability: NEUTRAL_ABILITY } : member;
}

/**
 * La danza difensiva (Iron Defense, Calm Mind, Bulk Up…) conta per tre quarti del guadagno: aiuta già dal primo turno,
 * a differenza del setup offensivo dell'Offesa (un terzo). Scelta dell'utente 2026-11-04.
 */
export const DEFENSE_SETUP_SHARE = 0.75;
const typedCache = new Map<string, { plain: number[]; held: number[] }>();
const TYPED_LIMIT = 5000;

/**
 * I 36 colpi standard tipizzati sul membro (per ogni tipo, prima il fisico poi lo speciale): danno atteso, al massimo 1.
 * `plain` senza setup; `held` con la danza difensiva che conta per tre quarti (uguale a `plain` senza danza).
 * Il meteo e il terreno che il membro porta con la sua abilità valgono per lui.
 */
export function typedHits(member: TeamSet, data: EngineData): { plain: number[]; held: number[] } {
  const key = `${setKey(member)}|${data.formatId ?? 'ou'}`;
  const cachedHits = typedCache.get(key);
  if (cachedHits) return cachedHits;
  if (typedCache.size >= TYPED_LIMIT) typedCache.clear();
  const conditions = ownConditions(member);
  const setup = defensiveSetup(member);
  const target = withoutTeraShell(member);
  const hit = (type: string, category: 'Physical' | 'Special', boosted: boolean) => {
    const attacker = dummyAttacker(data, category === 'Physical' ? 'atk' : 'spa', type);
    const result = standardHit(attacker, target, category, { conditions, moveType: type, targetBoosts: boosted ? setup?.boosts : undefined });
    return Math.min(1, result?.expected ?? 0);
  };
  const plain = TYPES.flatMap(type => [hit(type, 'Physical', false), hit(type, 'Special', false)]);
  const held = setup
    ? TYPES.flatMap((type, i) => [hit(type, 'Physical', true), hit(type, 'Special', true)].map((boosted, k) => {
      const x = plain[2 * i + k];
      return x - DEFENSE_SETUP_SHARE * (x - boosted);
    }))
    : plain;
  const value = { plain, held };
  typedCache.set(key, value);
  return value;
}

/**
 * Difesa del team: Coverage tipi 40, Coverage meta 30, Sostenibilità 30; senza meta Coverage tipi 70, Sostenibilità 30.
 * 2026-11-03: Sostenibilità da 20 a 30 (via di mezzo): reggere i colpi senza recupero vale poco (il giudice cieco ha
 * preferito il recupero 8 coppie a 0; gli Hyper Offense con molte resistenze prendevano più Difesa dei core con Regenerator).
 */
export const DEFENSE_SHARES = { types: 0.4, meta: 0.3, sustain: 0.3 };
export const DEFENSE_SHARES_NO_META = { types: 0.7, sustain: 0.3 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Quota (0–1) dei colpi che il membro regge: pieno 1, a metà 0,5. `side` 0 i fisici, 1 gli speciali, assente tutti. */
const holdShare = (hits: number[], side?: 0 | 1) => mean(hits.filter((_, i) => side === undefined || i % 2 === side).map(holdCredit));

/** Meteo che i membri del team portano con l'abilità: Rain Dish, Dry Skin e Ice Body curano solo con loro. */
const teamConditions = (team: TeamSet[]): FieldCondition[] => [...new Set(team.flatMap(member => ownConditions(member)))];

/**
 * Difesa di un membro, solo informazione (il voto è del team): quanti dei 36 colpi di tipo regge per lato, la
 * Sostenibilità, e il valore 40/30/30. La danza difensiva conta per metà; `setupGain` è quanto alza il valore.
 */
export function memberDefense(set: TeamSet, team: TeamSet[], data: EngineData): MemberDefense | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const { plain, held } = typedHits(set, data);
  const parts = sustainParts(set, holdShare(held), hazardRemover(team), teamConditions(team));
  const sustain = softScore(Math.max(0, parts.recovery - parts.rocks - parts.itemLoss) / SUSTAIN_FULL);
  // Le minacce del meta: chi regge il colpo migliore vero, pesato per uso
  const threats = metaThreats(data);
  const metaHold = threats.length
    ? Math.round(100 * threats.reduce((acc, { weight }, i) => {
      const x = Math.min(1, threatHitsOf(set, data)[i]?.expected ?? 0);
      return acc + weight * (x < HOLD_FULL ? 1 : x < 1 ? 0.5 : 0);
    }, 0))
    : null;
  // Il valore del membro coi pesi della squadra: 40/30/30, senza meta 70/30
  const valueOf = (hits: number[]) => {
    // Dai numeri mostrati nelle colonne, così il conto si rifà a mano
    const hold = Math.round(100 * holdShare(hits));
    return Math.round(metaHold === null
      ? DEFENSE_SHARES_NO_META.types * hold + DEFENSE_SHARES_NO_META.sustain * sustain
      : DEFENSE_SHARES.types * hold + DEFENSE_SHARES.meta * metaHold + DEFENSE_SHARES.sustain * sustain);
  };
  const value = valueOf(held);
  const setup = defensiveSetup(set);
  return {
    species: species.name, setupMove: setup?.move ?? null, setupGain: value - valueOf(plain),
    physical: Math.round(100 * holdShare(held, 0)), special: Math.round(100 * holdShare(held, 1)), hold: Math.round(100 * holdShare(held)),
    metaHold, sustain, sustainParts: parts, value,
  };
}

/** Una minaccia è retta se toglie meno di metà PS; a metà se manda KO in due colpi. */
const HOLD_FULL = 0.5;

export interface ThreatRow {
  species: string;
  weight: number;
  /** Quanto è retta: 0–100, coi crediti dei membri al 50, 30 e 20%. */
  level: number;
  heldBy: { species: string; move: string; pct: number; partial: boolean }[];
}

/** Quanti colpi regge sul lato peggiore: KO, 2HKO, 3HKO, 4 o più. */
export type HoldBand = 'ohko' | 'two' | 'three' | 'four';
export const holdBand = (x: number): HoldBand => (x >= 1 ? 'ohko' : x >= 1 / 2 ? 'two' : x >= 1 / 3 ? 'three' : 'four');

export interface TypeHoldRow {
  type: string;
  /** Copertura del tipo (0–100): la media delle profondità dei due lati. */
  level: number;
  /** Profondità (0–100) dei crediti sul colpo fisico e su quello speciale. */
  physical: number;
  special: number;
  /** Chi regge del tutto il lato peggiore. */
  heldBy: string[];
}

export interface TeamDefense {
  /** Coverage tipi 40 + Coverage meta 30 + Sostenibilità 30 (senza meta 70 + 30). */
  value: number;
  sustain: number;
  /** `weak`: i tipi dove nessuno ha credito sul lato peggiore. */
  coverageTypes: { value: number; weak: string[]; rows: TypeHoldRow[] };
  coverageMeta: { value: number; unanswered: string[]; rows: ThreatRow[] } | null;
  members: MemberDefense[];
  /** Per ogni membro (ordine di `members`) e tipo (ordine di TYPES): danno % del lato peggiore e dei due lati. */
  typed: { species: string; cells: { pct: number; physical: number; special: number; band: HoldBand }[] }[];
}

/** Danno del colpo migliore vero di una minaccia su un membro; Tera e mossa Z della minaccia a un quarto. */
function threatHit(threat: TeamSet, member: TeamSet, data: EngineData): Hit | null {
  const conditions = ownConditions(threat);
  const base = bestHit(threat, member, { conditions });
  const teraOk = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!threat.teraType;
  const zType = dex.items.get(threat.item).zMoveType;
  const zOk = !!zType && threat.moves.some(m => getMove(m)?.type === zType);
  const once = [teraOk && bestHit(threat, member, { conditions, tera: true }), zOk && bestHit(threat, member, { conditions, z: true })]
    .filter((h): h is Hit => !!h);
  if (!base || !once.length) return base;
  const boosted = Math.max(...once.map(h => h.expected));
  return { ...base, expected: base.expected + ONE_USE_SHARE * Math.max(0, boosted - base.expected) };
}

/**
 * I colpi migliori di tutte le minacce del meta su un membro; per contenuto del set, formato e meta. Le mosse del
 * membro non contano (subisce il colpo): un set che cambia solo le mosse riusa i calcoli (cambi di mossa del Coaching).
 */
const threatCache = new Map<string, (Hit | null)[]>();
function threatHitsOf(member: TeamSet, data: EngineData): (Hit | null)[] {
  const key = `${setKey({ ...member, moves: [] })}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let hits = threatCache.get(key);
  if (hits) return hits;
  if (threatCache.size >= TYPED_LIMIT) threatCache.clear();
  const target = withoutTeraShell(member);
  hits = metaThreats(data).map(({ set }) => threatHit(set, target, data));
  threatCache.set(key, hits);
  return hits;
}

/**
 * Quanto vale chi regge un colpo o una minaccia, dal primo al terzo: 50/30/20. Meno sbilanciato dell'Offesa (70/20/10):
 * in Difesa conta avere più risposte, e col 70 al primo metà dei team forti finiva fra 95 e 100.
 */
export const DEFENSE_DEPTH = [0.5, 0.3, 0.2];
const depthOf = (credits: number[]) => [...credits].sort((a, b) => b - a).reduce((acc, c, i) => acc + (DEFENSE_DEPTH[i] ?? 0) * c, 0);

/**
 * Difesa del team. Coverage di tipi: per ognuno dei 36 colpi di tipo (18 tipi × fisico e speciale) i crediti dei
 * membri con la profondità 50/30/20, poi la media. Coverage meta: chi regge il colpo migliore vero di ogni minaccia.
 * Sostenibilità: media pesata per posizione. Col meta 40/30/30, senza 70/30.
 */
export function teamDefense(team: TeamSet[], data: EngineData): TeamDefense {
  const known = team.filter(set => !!battleSpecies(set));
  const members = known.map(set => memberDefense(set, team, data)!);
  const sustain = rankWeighted(members.map(m => m.sustain));

  // Coverage di tipi sui colpi
  const hits = known.map(set => typedHits(set, data).held);
  const columnDepth = (c: number) => depthOf(hits.map(h => holdCredit(h[c])));
  const depths = Array.from({ length: 2 * TYPES.length }, (_, c) => columnDepth(c));
  const typeValue = known.length ? softScore(mean(depths)) : 0;
  const names = members.map(m => m.species);
  const rows = TYPES.map((type, i) => {
    const [p, s] = [depths[2 * i], depths[2 * i + 1]];
    // Il lato peggiore del tipo: quello dove i membri reggono meno
    const worse = p <= s ? 2 * i : 2 * i + 1;
    return {
      type, level: Math.round(100 * (p + s) / 2), physical: Math.round(100 * p), special: Math.round(100 * s),
      heldBy: names.filter((_, m) => holdCredit(hits[m][worse]) === 1),
    };
  });
  const weak = rows.filter(row => Math.min(row.physical, row.special) === 0).map(row => row.type);
  const typed = known.map((set, m) => ({
    species: names[m],
    cells: TYPES.map((_, i) => {
      const [p, s] = [hits[m][2 * i], hits[m][2 * i + 1]];
      return { pct: Math.floor(100 * Math.max(p, s)), physical: Math.floor(100 * p), special: Math.floor(100 * s), band: holdBand(Math.max(p, s)) };
    }),
  }));

  // Coverage meta: per ogni minaccia, chi regge il suo colpo migliore vero
  const threats = metaThreats(data);
  let coverageMeta: TeamDefense['coverageMeta'] = null;
  if (threats.length && known.length) {
    let total = 0;
    const threatRows = threats.map(({ set: threat, weight }, i) => {
      const heldBy = known.flatMap(member => {
        const hit = threatHitsOf(member, data)[i];
        const x = Math.min(1, hit?.expected ?? 0);
        if (x >= 1) return [];
        return [{ species: battleSpecies(member)?.name ?? member.species, move: hit?.move ?? '', pct: Math.floor(100 * x), partial: x >= HOLD_FULL }];
      });
      const level = depthOf(heldBy.map(h => (h.partial ? 0.5 : 1)));
      total += weight * level;
      return { species: threat.species, weight, level: Math.round(100 * level), heldBy };
    });
    coverageMeta = { value: softScore(total), unanswered: threatRows.filter(r => !r.heldBy.some(h => !h.partial)).map(r => r.species), rows: threatRows };
  }

  const value = !known.length ? 0 : coverageMeta
    ? Math.round(DEFENSE_SHARES.types * typeValue + DEFENSE_SHARES.meta * coverageMeta.value + DEFENSE_SHARES.sustain * sustain)
    : Math.round(DEFENSE_SHARES_NO_META.types * typeValue + DEFENSE_SHARES_NO_META.sustain * sustain);
  return { value, sustain, coverageTypes: { value: typeValue, weak, rows }, coverageMeta, members, typed };
}
