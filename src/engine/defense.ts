import { usesMeta } from './analysis';
import { attackerPanels, metaThreats, panelWeights } from './attackers';
import { COVERAGE_DEPTH, ownConditions } from './coverage';
import { bestHit, setKey, standardHit, type FieldCondition, type Hit } from './damage';
import { ONE_USE_SHARE, rankWeighted, SETUP_SHARE } from './offense';
import { DEFENSE_FULL, typeSafety } from './typeSafety';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { effectiveness, weaknessTable } from './types';
import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { mostCommonSet, type TeamSet } from './sets';
import { softScore } from './scale';
import { topThreats } from './stats';

/** Valore di un colpo standard ricevuto (dal tiro più alto): OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5. */
export function holdStep(hit: Hit | null): number {
  if (!hit) return 1.5;
  return hit.max >= 1 ? 0 : hit.max >= 0.5 ? 0.5 : hit.max >= 1 / 3 ? 1 : 1.5;
}

/** Recupero per turno delle mosse (la migliore del set). */
const RECOVERY_MOVES: Record<string, number> = {
  recover: 0.5, roost: 0.5, slackoff: 0.5, softboiled: 0.5, milkdrink: 0.5, moonlight: 0.5, synthesis: 0.5,
  morningsun: 0.5, shoreup: 0.5, strengthsap: 0.5, wish: 0.25, rest: 0.33,
};
/** Recupero dell'abilità e dello strumento. */
const RECOVERY_ABILITIES: Record<string, number> = { regenerator: 0.33, poisonheal: 0.125 };
const RECOVERY_ITEMS: Record<string, number> = { leftovers: 0.0625, blacksludge: 0.0625 };
/** Stealth Rock all'ingresso: 1/8 dei PS per l'efficacia della Roccia. */
const STEALTH_ROCK = 0.125;
const LIFE_ORB = 0.1;
/** Sotto un 3HKO medio il recupero vale metà: un Pokémon con Recover non è un muro se non regge i colpi. */
const RECOVERY_HOLD = 1;
/** Recupero netto per turno che vale 100 di Sostenibilità. */
export const SUSTAIN_FULL = 0.5;

/** Le voci della Sostenibilità, per turno in quota dei PS: il recupero (già dimezzato se serve) e le perdite. */
export interface SustainParts {
  /** Mossa, abilità e strumento che curano (la mossa migliore sola). */
  sources: string[];
  recovery: number;
  /** Il recupero vale metà: il membro non regge in media un 3HKO. */
  halved: boolean;
  rocks: number;
  lifeOrb: number;
}

export function sustainParts(set: TeamSet, robustStep: number): SustainParts {
  const ability = toID(battleAbility(set));
  const item = toID(set.item);
  const best = set.moves.reduce<string | null>((acc, m) => ((RECOVERY_MOVES[toID(m)] ?? 0) > (acc ? RECOVERY_MOVES[toID(acc)] : 0) ? m : acc), null);
  // Poison Heal cura solo da avvelenato: lo garantisce Toxic Orb
  const abilityHeal = ability === 'poisonheal' && item !== 'toxicorb' ? 0 : RECOVERY_ABILITIES[ability] ?? 0;
  const sources = [best, abilityHeal ? battleAbility(set) : null, RECOVERY_ITEMS[item] ? set.item : null]
    .filter((x): x is string => !!x);
  const gross = (best ? RECOVERY_MOVES[toID(best)] : 0) + abilityHeal + (RECOVERY_ITEMS[item] ?? 0);
  const halved = gross > 0 && robustStep < RECOVERY_HOLD;
  const magicGuard = ability === 'magicguard';
  const types = battleSpecies(set)?.types ?? [];
  const rocks = item === 'heavydutyboots' || magicGuard ? 0 : STEALTH_ROCK * effectiveness('Rock', types as never);
  // Sheer Force toglie il contraccolpo di Life Orb alle mosse con effetti secondari
  const sheerForce = ability === 'sheerforce' && set.moves.some(m => { const move = getMove(m); return !!(move?.secondary || move?.secondaries?.length); });
  const lifeOrb = item === 'lifeorb' && !magicGuard && !sheerForce ? LIFE_ORB : 0;
  return { sources, recovery: halved ? gross / 2 : gross, halved, rocks, lifeOrb };
}

/** Recupero meno perdite per turno (in quota dei PS); `robustStep` è il valore medio dei colpi standard ricevuti. */
export function sustainability(set: TeamSet, robustStep: number): number {
  const parts = sustainParts(set, robustStep);
  return parts.recovery - parts.rocks - parts.lifeOrb;
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
  /** Mossa di setup difensivo e punti di Robustezza (valore) che porta: metà del guadagno, già dentro fisica, speciale e valore. */
  setupMove: string | null;
  setupGain: number;
  physical: number;
  special: number;
  sustain: number;
  sustainParts: SustainParts;
  value: number;
}

/** Pesi della Robustezza del membro: Fisica, Speciale, Sostenibilità. */
export const ROBUSTNESS_WEIGHTS = { physical: 0.4, special: 0.4, sustain: 0.2 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Colpi standard ricevuti dai due gruppi di attaccanti; per contenuto del set, formato e meta. */
interface Raw {
  species: string; physical: (Hit | null)[]; special: (Hit | null)[]; physicalStep: number; specialStep: number;
  /** Passi medi dopo un uso del setup difensivo (uguali ai normali senza setup). */
  setupMove: string | null; physicalSetupStep: number; specialSetupStep: number;
}
const raws = new Map<string, Raw | null>();
const RAW_LIMIT = 5000;

/** Abilità che ignorano Intimidate (Mirror Armor lo rimanda indietro); Defiant e Guard Dog invece alzano l'Attacco. */
const INTIMIDATE_IMMUNE = new Set(['clearbody', 'hypercutter', 'innerfocus', 'oblivious', 'owntempo', 'scrappy', 'fullmetalbody', 'whitesmoke', 'mirrorarmor']);
const INTIMIDATE_RAISES = new Set(['defiant', 'guarddog']);

/** Il cambio d'Attacco dell'attaccante fisico quando il membro ha Intimidate; `undefined` se non ne ha. */
export function intimidateBoost(member: TeamSet, attacker: TeamSet): { atk: number } | undefined {
  if (toID(battleAbility(member)) !== 'intimidate') return undefined;
  const theirs = toID(battleAbility(attacker));
  if (INTIMIDATE_IMMUNE.has(theirs)) return undefined;
  return { atk: INTIMIDATE_RAISES.has(theirs) ? 1 : -1 };
}

function measure(set: TeamSet, data: EngineData): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const panels = attackerPanels(data);
  const mine = ownConditions(set);
  // Il meteo dell'abilità dell'attaccante vale sempre; quello del membro protegge lui (sabbia sulla Difesa Speciale della Roccia)
  const setup = defensiveSetup(set);
  const against = (attacker: TeamSet, category: 'Physical' | 'Special', boosted = false) => {
    const theirs = ownConditions(attacker);
    const conditions: FieldCondition[] = theirs.length ? theirs : mine;
    const boosts = category === 'Physical' ? intimidateBoost(set, attacker) : undefined;
    return standardHit(attacker, set, category, { conditions, boosts, targetBoosts: boosted ? setup?.boosts : undefined });
  };
  const physical = panels.physical.map(a => against(a, 'Physical'));
  const special = panels.special.map(a => against(a, 'Special'));
  if (![...physical, ...special].some(Boolean)) return null;
  // Media pesata per uso: reggere il più usato conta di più
  const weights = panelWeights(data);
  const weighted = (hits: (Hit | null)[], w: number[]) => hits.reduce((acc, hit, i) => acc + w[i] * holdStep(hit), 0);
  const physicalStep = weighted(physical, weights.physical);
  const specialStep = weighted(special, weights.special);
  // Dopo un uso del setup: gli attaccanti Unaware lo ignorano (lo decide standardHit)
  const boostedP = setup ? weighted(panels.physical.map(a => against(a, 'Physical', true)), weights.physical) : physicalStep;
  const boostedS = setup ? weighted(panels.special.map(a => against(a, 'Special', true)), weights.special) : specialStep;
  return {
    species: species.name,
    physical, special, physicalStep, specialStep,
    setupMove: setup?.move ?? null, physicalSetupStep: boostedP, specialSetupStep: boostedS,
  };
}

function rawOf(set: TeamSet, data: EngineData): Raw | null {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  if (raws.has(key)) return raws.get(key)!;
  if (raws.size >= RAW_LIMIT) raws.clear();
  const value = measure(set, data);
  raws.set(key, value);
  return value;
}

/** Riferimento di riserva senza statistiche: un 3HKO in media vale circa 93. */
const FALLBACK_STEP = 1;
/** Il 100 di Robustezza: il 3° più robusto fra i più usati del meta, per lato. */
const REFERENCE_RANK = 3;
const REFERENCE_SCAN = 40;
const references = new Map<string, { physical: number; special: number }>();

export function defenseReference(data: EngineData): { physical: number; special: number } {
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let ref = references.get(key);
  if (ref) return ref;
  const measured = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .map(set => (set ? rawOf(set, data) : null))
    .filter((r): r is Raw => r !== null);
  const nth = (values: number[]) => values.sort((a, b) => b - a)[Math.min(REFERENCE_RANK, values.length) - 1];
  const physical = measured.length ? nth(measured.map(r => r.physicalStep)) : 0;
  const special = measured.length ? nth(measured.map(r => r.specialStep)) : 0;
  ref = { physical: physical > 0 ? physical : FALLBACK_STEP, special: special > 0 ? special : FALLBACK_STEP };
  references.set(key, ref);
  return ref;
}

/** Difesa di un membro: quanti colpi standard regge dai due gruppi di attaccanti, e quanto resta in campo. */
export function memberDefense(set: TeamSet, _team: TeamSet[], data: EngineData): MemberDefense | null {
  const raw = rawOf(set, data);
  if (!raw) return null;
  const ref = defenseReference(data);
  const plainP = softScore(raw.physicalStep / ref.physical);
  const plainS = softScore(raw.specialStep / ref.special);
  // Metà del guadagno del setup entra nella Robustezza (come SETUP_SHARE nell'Offesa)
  const physical = Math.round(plainP + SETUP_SHARE * (softScore(raw.physicalSetupStep / ref.physical) - plainP));
  const special = Math.round(plainS + SETUP_SHARE * (softScore(raw.specialSetupStep / ref.special) - plainS));
  const parts = sustainParts(set, (raw.physicalStep + raw.specialStep) / 2);
  const sustain = softScore(Math.max(0, parts.recovery - parts.rocks - parts.lifeOrb) / SUSTAIN_FULL);
  const w = ROBUSTNESS_WEIGHTS;
  const plainValue = Math.round(w.physical * plainP + w.special * plainS + w.sustain * sustain);
  const value = Math.round(w.physical * physical + w.special * special + w.sustain * sustain);
  return { species: raw.species, setupMove: raw.setupMove, setupGain: value - plainValue, physical, special, sustain, sustainParts: parts, value };
}

/** Robustezza e coverage nella Difesa: 50 e 50 (la coverage non va mai oltre il 50%). */
export const DEFENSE_SHARES = { robustness: 0.5, coverage: 0.5 };
/** Una minaccia è retta se toglie meno di metà PS; a metà se manda KO in due colpi. */
const HOLD_FULL = 0.5;

export interface ThreatRow {
  species: string;
  weight: number;
  /** Quanto è retta: 0–100, coi crediti dei membri al 70, 20 e 10%. */
  level: number;
  heldBy: { species: string; move: string; pct: number; partial: boolean }[];
}

export interface TeamDefense {
  value: number;
  physical: number;
  special: number;
  sustain: number;
  robustness: number;
  coverage: number;
  /** `rows`: per ogni tipo la sicurezza 0–100 e chi è debole o resiste (immuni compresi). */
  coverageTypes: { value: number; weak: string[]; rows: { type: string; safety: number; weak: string[]; resist: string[] }[] };
  coverageMeta: { value: number; unanswered: string[]; rows: ThreatRow[] } | null;
  members: MemberDefense[];
  /** Per ogni attaccante dei due gruppi: danno del colpo standard su ogni membro (tiro più alto, come la soglia; ordine di `members`). */
  matrix: { species: string; physical: boolean; cells: { pct: number; step: number }[] }[];
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
  if (threatCache.size >= RAW_LIMIT) threatCache.clear();
  hits = metaThreats(data).map(({ set }) => threatHit(set, member, data));
  threatCache.set(key, hits);
  return hits;
}

const depthOf = (credits: number[]) => [...credits].sort((a, b) => b - a).reduce((acc, c, i) => acc + (COVERAGE_DEPTH[i] ?? 0) * c, 0);

/** Difesa del team: robustezza (media pesata per posizione) e coverage difensiva di tipi e, col meta, del meta. */
export function teamDefense(team: TeamSet[], data: EngineData): TeamDefense {
  const known = team.filter(set => rawOf(set, data) !== null);
  const members = known.map(set => memberDefense(set, team, data)!);
  const physical = rankWeighted(members.map(m => m.physical));
  const special = rankWeighted(members.map(m => m.special));
  const sustain = rankWeighted(members.map(m => m.sustain));
  // La robustezza di ogni membro (Fisica e Speciale insieme) pesata per posizione: un muro fisico e uno speciale
  // non valgono come due muri completi
  const w = ROBUSTNESS_WEIGHTS;
  const sides = w.physical + w.special;
  const robust = rankWeighted(members.map(m => (w.physical * m.physical + w.special * m.special) / sides));
  const robustness = Math.round(sides * robust + w.sustain * sustain);

  // Coverage di tipi: il saldo di resistenze e debolezze sui 18 tipi, con la stessa scala dell'Offesa
  const table = weaknessTable(known);
  const typeValue = known.length ? softScore(mean(table.map(row => typeSafety(row.multipliers))) / DEFENSE_FULL) : 0;
  const weak = table.filter(row => row.pressure > 0).map(row => row.type);
  const names = members.map(m => m.species);
  const typeRows = table.map(row => ({
    type: row.type, safety: Math.round(100 * typeSafety(row.multipliers)),
    weak: names.filter((_, i) => row.multipliers[i] > 1), resist: names.filter((_, i) => row.multipliers[i] < 1),
  }));

  // Coverage meta: per ogni minaccia, chi regge il suo colpo migliore vero
  const threats = metaThreats(data);
  let coverageMeta: TeamDefense['coverageMeta'] = null;
  if (threats.length && known.length) {
    let total = 0;
    const rows = threats.map(({ set: threat, weight }, i) => {
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
    coverageMeta = { value: softScore(total), unanswered: rows.filter(r => !r.heldBy.some(h => !h.partial)).map(r => r.species), rows };
  }
  const coverage = coverageMeta ? Math.round((typeValue + coverageMeta.value) / 2) : typeValue;

  const panels = attackerPanels(data);
  const raws = known.map(set => rawOf(set, data)!);
  const row = (attacker: TeamSet, i: number, physicalSide: boolean) => ({
    species: attacker.species, physical: physicalSide,
    cells: raws.map(r => { const hit = (physicalSide ? r.physical : r.special)[i]; return { pct: Math.floor(100 * Math.min(1, hit?.max ?? 0)), step: holdStep(hit) }; }),
  });
  return {
    value: known.length ? Math.round(DEFENSE_SHARES.robustness * robustness + DEFENSE_SHARES.coverage * coverage) : 0,
    physical, special, sustain, robustness, coverage,
    coverageTypes: { value: typeValue, weak, rows: typeRows },
    coverageMeta,
    members,
    matrix: [...panels.physical.map((a, i) => row(a, i, true)), ...panels.special.map((a, i) => row(a, i, false))],
  };
}
