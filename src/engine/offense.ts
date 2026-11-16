import { usesMeta } from './analysis';
import { teamFieldSources, type FieldSource } from './partner';
import { coverageTargets, META_DEPTH, teamCoverage, type CoverageRow } from './coverage';
import { bestHit, hasZMove, setKey, type FieldCondition, type Hit, type HitOptions, type Target } from './damage';
import type { EngineData } from './data';
import { defenderPanel, isDefensiveSet } from './defenders';
// Import circolare con defense.ts: si usano solo funzioni, chiamate dopo il caricamento
import { firstHitShare } from './defense';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { rulesOf } from './formatRules';
import { attackStyle } from './roles';
import { mostCommonSet, type TeamSet } from './sets';
import { setupBoosts } from './setupBoosts';
import { topThreats } from './stats';
import { softScore } from './scale';
import { enables } from './synergy';

/** Solo per i Ruoli: il riferimento di riserva della loro Potenza (bersagli della Coverage). */
const ROLES_POWER_FULL = 0.6;
/** Soglie del colpo migliore contro un difensore: 3HKO e 2HKO (il difensore non può entrare due volte). */
export const THREE_HIT = 1 / 3;
export const TWO_HIT = 0.5;
/** Valore di un difensore: 3HKO 0,5, 2HKO 1, OHKO sicuro 1,5. */
export const STEP_3HKO = 0.5;
export const STEP_2HKO = 1;
export const STEP_OHKO = 1.5;
/** Riferimento di riserva: media dei valori che vale Wallbreaking 100 (misura dei Ruoli). */
export const STEP_FULL = 1.25;
/** Il 100 dei Ruoli (Potenza e Wallbreaking della misura dei Ruoli): il 3° miglior attaccante fra i più usati del formato. */
export const REFERENCE_RANK = 3;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare gli attaccanti di riferimento dei Ruoli. */
const REFERENCE_SCAN = 40;
/** Solo per i Ruoli (wallbreaker, sweeper): il vecchio valore del membro, Potenza e Wallbreaking 50 e 35. */
const ROLES_WEIGHTS = { power: 0.5, wallbreaking: 0.35 };

/**
 * Offesa del team: il pacchetto dei tipi 50% e la Coverage del meta 50% (2026-11-13, era 70/30: il meta è quello che si
 * incontra davvero); senza meta il pacchetto vale tutto.
 * Il pacchetto ha preso il posto di Potenza e Coverage tipi, che misuravano quasi la stessa cosa sugli stessi bersagli.
 */
export const OFFENSE_SHARES = { types: 0.5, meta: 0.5 };
/**
 * Il credito di un colpo è il suo danno vero (quota dei PS, al massimo 1), ma solo dal KO in due colpi: sotto il 50% vale 0.
 * 50% vale 0,5, 80% vale 0,8, l'OHKO 1. Uguale nella Coverage del meta (2026-11-15, era: dal 33% in linea fino all'OHKO,
 * 50% valeva 0,25): su 535 team National Dex OU separa meglio i team da torneo dai medi e dai brutti.
 */
export const CREDIT_FLOOR = 0.5;
/**
 * Per ogni tipo, il 1°, 2° e 3° membro che lo colpisce meglio valgono 70, 20 e 10%, come nella Coverage del meta
 * (2026-11-15, era 50/30/20): una regola sola per le due schede, e più team da torneo arrivano alla S.
 */
export const OFFENSE_DEPTH = [0.7, 0.2, 0.1];
/** Un colpo è forte dai due terzi dei PS (le caselle verdi piene della Coverage tipi); sotto, dal 50%, conta come medio. */
export const STRONG_CREDIT = 2 / 3;
/** Un tipo è scoperto se nessun membro lo manda KO in due colpi (danno sotto il 50%): un problema grave del Coaching. */
export const HOLE_HIT = TWO_HIT;
/**
 * Il setup costa un turno libero e ripaga dal terzo turno: in tre turni un +2 fa quattro colpi invece di tre, e se il membro
 * esce perde il potenziamento. Nell'Offesa entra un terzo del guadagno dopo una danza, per ogni setup (+1 e +2 allo stesso modo).
 */
export const SETUP_SHARE = 1 / 3;
/** I Ruoli (wallbreaker, sweeper) tengono il setup a tre quarti: le loro soglie sono tarate su questo. */
export const ROLES_SETUP_SHARE = 0.75;
/**
 * Pesi per posizione per la Sostenibilità della Difesa: tutti uguali, una media semplice (scelta dell'utente 2026-11-03).
 * L'Offesa non li usa più: il pacchetto pesa i membri per bersaglio (OFFENSE_DEPTH).
 */
export const RANK_WEIGHTS = [1, 1, 1, 1, 1, 1].map(w => w / 6);
/** Tera e mosse Z si usano una volta a partita: nel voto entra un quarto di quello che aggiungono. */
export const ONE_USE_SHARE = 0.25;

/** Il credito di un colpo da x (quota dei PS del bersaglio): 0 sotto il 50%, poi il danno stesso fino a 1 con l'OHKO. */
export function offenseCredit(x: number): number {
  return x >= CREDIT_FLOOR ? Math.min(1, x) : 0;
}

/** Il colpo di un membro su uno dei 18 Pokémon medi: danno (con un terzo del setup e un quarto di Tera/Z) e credito. */
export interface TargetHit {
  /** Il tipo del bersaglio. */
  label: string;
  /** La mossa migliore senza setup né Tera/Z (null se nessuna lo colpisce). */
  move: string | null;
  /** Danno % arrotondato in basso, al massimo 100. */
  pct: number;
  /** 0–1. */
  credit: number;
  /** Danno % del colpo semplice (senza setup né Tera/Z), dopo una danza (null senza setup) e con Tera/Z (null senza): per la Generale. */
  plainPct: number;
  setupPct: number | null;
  oncePct: number | null;
  /** Il colpo intero col meteo o il campo del team (null se non fa di più) e chi lo porta: solo da mostrare. */
  teamPct: number | null;
  teamVia: FieldSource[] | null;
  /** La mossa del colpo col meteo o il campo del team. */
  teamMove: string | null;
  /** Dopo la danza e col meteo/campo del team insieme (null se manca l'uno o l'altro): danno % e mossa. */
  comboPct: number | null;
  comboMove: string | null;
}

export interface MemberOffense {
  species: string;
  /** La mossa più spesso migliore contro i 18 Pokémon medi; null senza mosse d'attacco. */
  bestMove: string | null;
  /** La mossa di potenziamento del set (null se non ne ha). */
  setupMove: string | null;
  /** Tera o mossa Z del membro (una volta a partita), null se non ne ha. */
  oneUse: { kind: 'tera' | 'z'; name: string } | null;
  /** 0–100: la media dei crediti sui 18 Pokémon medi, setup (un terzo) e Tera/Z (un quarto) compresi. */
  value: number;
  /** Punti di `value` che vengono dal setup. */
  setupGain: number;
  /** Punti di `value` che vengono da Tera/Z. */
  oneUseGain: number;
  /** I 18 bersagli, nell'ordine di `coverageTargets(data, 'types')`. */
  hits: TargetHit[];
  /** Quota (0–100) dei bersagli del meta che il membro manda KO in due colpi da solo (null senza meta). */
  coverMeta: number | null;
  /** Quanto il membro porta all'Offesa coi pesi della squadra: 50% `value` + 50% `coverMeta`; senza meta `value`. */
  total: number;
}

/** Un tipo del pacchetto: il livello del team (0–100) e i migliori tre membri che lo mandano KO in due colpi (dal 50%). */
export interface TypeRow {
  label: string;
  level: number;
  best: { species: string; move: string | null; pct: number; credit: number }[];
}

export interface CoverageDetail {
  value: number;
  /** Bersagli che nessuno manda KO in due colpi. */
  holes: string[];
  /** Per ogni bersaglio: tipi, Pokémon, peso, quanto è coperto e chi lo copre (con quale mossa). */
  rows: CoverageRow[];
}

export interface TeamOffense {
  /** Quanti attaccanti fisici, speciali e misti (solo informazione, non entra nel voto). */
  attackers: { physical: number; special: number; mixed: number };
  /** Pacchetto 50% + Coverage meta 50% (senza meta il pacchetto). */
  value: number;
  /** Il pacchetto dei tipi: valore, una riga per tipo, e i buchi (i tipi che nessuno manda KO in due colpi). */
  types: { value: number; rows: TypeRow[]; holes: string[] };
  /** null senza meta. */
  coverageMeta: CoverageDetail | null;
  /** Punti di Offesa finale che vengono dal setup. */
  setupGain: number;
  setters: { species: string; move: string }[];
  members: MemberOffense[];
  /** Per ogni membro (ordine di `members`): cosa copre e quanto porta davvero al voto; i `points` sommati fanno `value`. */
  shares: MemberShare[];
}

/** Il membro nella Generale: i tipi per fascia (senza doppioni), i bersagli del meta mandati KO in due colpi, i punti che porta. */
export interface MemberShare {
  species: string;
  /** Su 18: KO in un colpo, forti (dal 66%, senza KO), contano (dal 50%, sotto il 66%). */
  types: { ohko: number; strong: number; counts: number };
  /** null senza meta. */
  meta: { covered: number; total: number } | null;
  /** Punti di Offesa che porta al team: 50% di quanto porta ai tipi + 50% di quanto porta al meta (senza meta solo i tipi). */
  points: number;
}

/**
 * Quanto porta ogni membro su un bersaglio con la profondità: il 1° prende il primo peso, il 2° il secondo…; a pari credito
 * i membri si dividono i pesi dei loro posti (due set uguali portano uguale). Il totale è la profondità del bersaglio.
 */
export function depthShares(credits: number[], depth: number[]): number[] {
  const order = credits.map((c, k) => ({ c, k })).sort((a, b) => b.c - a.c);
  const out = credits.map(() => 0);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j < order.length && order[j].c === order[i].c) j++;
    const weight = depth.slice(i, j).reduce((a, w) => a + w, 0) / (j - i);
    for (let k = i; k < j; k++) out[order[k].k] = weight * order[k].c;
    i = j;
  }
  return out;
}

/** Arrotonda i punti in modo che la somma faccia esattamente `total` (si danno i punti mancanti ai resti più grandi). */
function roundToTotal(raw: number[], total: number): number[] {
  const floors = raw.map(Math.floor);
  let missing = total - floors.reduce((a, b) => a + b, 0);
  const byRest = raw.map((x, k) => ({ k, rest: x - Math.floor(x) })).sort((a, b) => b.rest - a.rest);
  const out = [...floors];
  // Di solito manca o avanza un punto; il giro si ripete solo se ne mancano più dei membri
  for (let n = 0; missing !== 0 && n < 10 * raw.length; n++) {
    const k = byRest[n % raw.length].k;
    if (missing > 0) { out[k]++; missing--; } else if (out[k] > 0) { out[k]--; missing++; }
  }
  return out;
}

/** Valore del colpo migliore contro un difensore: 0, 0,5 (3HKO), 1 (2HKO) o 1,5 (OHKO sicuro; mai per le mosse OHKO, che possono mancare). */
export function stepValue(hit: Hit | null): number {
  if (!hit) return 0;
  if (hit.min >= 1 && !getMove(hit.move)?.ohko) return STEP_OHKO;
  return hit.expected >= TWO_HIT ? STEP_2HKO : hit.expected >= THREE_HIT ? STEP_3HKO : 0;
}

/**
 * Soglia di una casella della tabella dei muri. Il valore può essere una media (Tera, Z e meteo contano a metà):
 * da 1,25 è un OHKO, da 0,75 un 2HKO, da 0,25 un 3HKO.
 */
export function stepBucket(step: number): 'ohko' | 'two' | 'three' | 'none' {
  return step >= 1.25 ? 'ohko' : step >= 0.75 ? 'two' : step >= 0.25 ? 'three' : 'none';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Dal rapporto col riferimento al punteggio: lineare, il riferimento vale 100 (solo misura dei Ruoli). */
const toScore = (x: number, full: number) => softScore(x / full);

/** Condizioni di campo (meteo, terreni) che il team porta; quelle che il set porta con la sua abilità sono sempre attive per lui. */
export function conditionsOf(set: TeamSet, team: TeamSet[]) {
  const field = (links: ReturnType<typeof enables>) => links.map(l => l.condition).filter((c): c is FieldCondition => c !== 'trickroom');
  const own = field(enables(set).filter(l => toID(l.via) === toID(battleAbility(set))));
  const all = [...new Set([...own, ...team.flatMap(member => field(enables(member)))])].sort();
  // Quelle che nel team arrivano solo da una mossa (Sunny Day, Rain Dance…): costano un turno, valgono meno (MOVE_FIELD_SHARE)
  const fromAbility = new Set(team.flatMap(member => field(enables(member).filter(l => toID(l.via) === toID(battleAbility(member))))));
  return { own: [...new Set(own)], all, moveOnly: all.filter(c => !fromAbility.has(c)) };
}

const WEATHERS: FieldCondition[] = ['sun', 'rain', 'sand', 'snow'];

/** Il meteo o il campo del team vale metà del colpo (non è sempre attivo); il resto è il colpo senza. */
export const FIELD_SHARE = 0.5;
/**
 * Un quarto se nel team arriva solo da una mossa (Sunny Day, Rain Dance, Electric Terrain…): costa un turno e dura
 * poco. Prima valeva metà come quello da abilità e una mossa meteo alzava l'Offesa di 1–4 punti (2026-11-09, controllo 2 punto 3.1).
 */
export const MOVE_FIELD_SHARE = 0.25;

/**
 * Le combinazioni di campo che il team può dare al membro, oltre alle sue: un meteo e un terreno alla volta
 * (due meteo non stanno insieme). Quelli che il membro porta con la sua abilità restano sempre.
 */
export function fieldCombos(own: FieldCondition[], all: FieldCondition[]): FieldCondition[][] {
  const isWeather = (c: FieldCondition) => WEATHERS.includes(c);
  const options = (pick: (c: FieldCondition) => boolean) => {
    const mine = own.filter(pick);
    return mine.length ? [mine] : [[], ...all.filter(pick).map(c => [c])];
  };
  const combos = options(isWeather).flatMap(w => options(c => !isWeather(c)).map(t => [...w, ...t]));
  return combos.filter(c => c.length > own.length);
}

/** Per ognuno dei 18 bersagli del pacchetto: danno senza niente, dopo una danza e con Tera/Z (al massimo 1), e la mossa migliore. */
interface PerTarget { plain: number[]; danced: number[] | null; once: number[] | null; moves: (string | null)[];
  /** Il colpo intero col meteo o il campo del team che fa di più (null se non ce n'è) e quali condizioni lo danno. */
  team: (number | null)[]; teamConditions: (FieldCondition[] | null)[]; teamMoves: (string | null)[];
  /** Setup e meteo/campo del team insieme: il colpo intero e la mossa (null senza setup o senza meteo del team). */
  combo: (number | null)[] | null; comboMoves: (string | null)[] | null }

/**
 * Misure grezze del set. Pacchetto (`power`): danno contro i 18 Pokémon medi dei tipi, bersaglio per bersaglio.
 * Ruoli (`roles`): danno medio contro i bersagli della Coverage e valore del colpo migliore contro ogni muro del formato.
 */
interface Raw {
  species: string; expected: number; setupMove: string | null; bestMove: string | null;
  /** Con Tera o mossa Z (null se il set non ne ha): danno medio e valore dei colpi contro ogni muro. */
  oneUse: { kind: 'tera' | 'z'; name: string; expected: number; steps: number[] } | null;
  /** Per ogni muro: valore del colpo migliore e danno (0–1), senza e con il setup. */
  steps: number[]; hits: number[]; setupSteps: number[] | null; setupHits: number[] | null;
  /** Danno medio dopo una danza (null senza mossa di potenziamento). */
  setupExpected: number | null;
  /** Solo nel pacchetto: i 18 bersagli uno per uno. */
  perTarget: PerTarget | null;
}

/**
 * Su cosa si misura il set. `power`: il pacchetto del voto, contro i 18 Pokémon medi dei tipi (con e senza meta), senza muri.
 * `roles`: la vecchia misura che usano solo i Ruoli: danno contro i bersagli della Coverage e colpi contro i muri del formato.
 */
type Measure = 'power' | 'roles';

function measureSet(set: TeamSet, team: TeamSet[], data: EngineData, measure: Measure): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const attacks = set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status');
  const conditions = conditionsOf(set, team);
  const { own, all } = conditions;
  const combos = fieldCombos(own, all);
  const moveOnly = new Set(conditions.moveOnly);
  // Poteri da una volta a partita (Tera, mossa Z): il valore base è senza, a parte la variante con
  const teraOk = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType;
  const zItem = dex.items.get(set.item);
  const zOk = hasZMove(set);
  const oneUseVariants = [...(teraOk ? [{ tera: true, z: false }] : []), ...(zOk ? [{ tera: false, z: true }] : [])];
  let known = false;

  // Contro un bersaglio: il meteo del team vale metà, un quarto se arriva solo da una mossa (mai sotto il danno senza);
  // `oneUse` prova Tera/Z e tiene il meglio
  const against = (target: Target, boosts?: HitOptions['boosts'], oneUse = false) => {
    const expected: number[] = [];
    const steps: number[] = [];
    let move: string | null = null;
    let teamHit: { expected: number; conditions: FieldCondition[]; move: string | null } | null = null;
    // Multiscale, Tera Shell, Air Balloon del bersaglio: un quarto, metà se si cura (damage.ts)
    const firstHit = firstHitShare(target);
    for (const variant of oneUse ? oneUseVariants : [{ tera: false, z: false }]) {
      const base = { ...variant, boosts, firstHitShare: firstHit };
      const off = bestHit(set, target, { ...base, conditions: own });
      // Col meteo del team: ogni combinazione possibile (un meteo e un terreno alla volta), quella che conviene di più
      // Un KO è un KO: oltre il 100% dei PS il danno non conta di più. Il meteo vale `share` del colpo, il resto è senza
      const mix = (hit: Hit | null, share: number) => ({
        expected: (1 - share) * Math.min(1, off?.expected ?? 0) + share * Math.min(1, hit?.expected ?? 0),
        step: (1 - share) * stepValue(off) + share * stepValue(hit),
      });
      let pick = mix(off, FIELD_SHARE);
      let on: Hit | null = null;
      for (const conditions of combos) {
        const hit = bestHit(set, target, { ...base, conditions });
        if ((hit?.expected ?? 0) > (on?.expected ?? 0)) on = hit;
        if ((hit?.expected ?? 0) > Math.max(off?.expected ?? 0, teamHit?.expected ?? 0)) teamHit = { expected: hit!.expected, conditions: conditions.filter(c => !own.includes(c)), move: hit!.move ?? null };
        const value = mix(hit, conditions.some(c => moveOnly.has(c)) ? MOVE_FIELD_SHARE : FIELD_SHARE);
        if (value.expected > pick.expected) pick = value;
      }
      if (off || on) known = true;
      move ??= off?.move ?? on?.move ?? null;
      expected.push(pick.expected);
      steps.push(pick.step);
    }
    const best = expected.indexOf(Math.max(...expected));
    return { expected: expected[best] ?? 0, step: steps[best] ?? 0, move, team: teamHit };
  };

  const targets = measure === 'power' ? coverageTargets(data, 'types') : coverageTargets(data);
  const setup = attacks ? setupBoosts(set) : null;
  const withOneUse = attacks && oneUseVariants.length > 0;
  // Bersaglio per bersaglio: senza niente, dopo una danza, con Tera/Z (mai sotto il danno senza)
  const plainHits = targets.map(target => against(target.set));
  const plain = plainHits.map(h => h.expected);
  const dancedHits = setup ? targets.map(target => against(target.set, setup.boosts)) : null;
  const danced = dancedHits ? dancedHits.map(h => h.expected) : null;
  const once = withOneUse ? targets.map((target, i) => Math.max(plain[i], against(target.set, undefined, true).expected)) : null;
  const weighted = (xs: number[]) => targets.reduce((acc, target, i) => acc + target.weight * xs[i], 0);
  // Quale mossa è più spesso la migliore (per le schede)
  const byMove = new Map<string, number>();
  plainHits.forEach((hit, i) => { if (hit.move) byMove.set(hit.move, (byMove.get(hit.move) ?? 0) + targets[i].weight); });
  const bestMove = [...byMove].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const defenders = measure === 'roles' ? defenderPanel(data) : [];
  const plainWalls = defenders.map(defender => against(defender));
  // Ha mosse d'attacco ma la libreria non sa calcolarne nessuna: Pokémon sconosciuto, non conta
  if (attacks && !known) return null;
  const boosted = setup ? defenders.map(defender => against(defender, setup.boosts)) : null;
  const oneUse = withOneUse ? {
    kind: teraOk ? 'tera' as const : 'z' as const,
    name: teraOk ? set.teraType! : zItem.name,
    expected: weighted(once!),
    steps: defenders.map((defender, d) => Math.max(plainWalls[d].step, against(defender, undefined, true).step)),
  } : null;
  return {
    species: species.name, expected: weighted(plain), setupMove: setup?.move ?? null, bestMove, oneUse,
    setupExpected: danced ? weighted(danced) : null,
    steps: plainWalls.map(r => r.step), hits: plainWalls.map(r => r.expected),
    setupSteps: boosted?.map(r => r.step) ?? null, setupHits: boosted?.map(r => r.expected) ?? null,
    perTarget: measure === 'power' ? {
      plain, danced, once, moves: plainHits.map(h => h.move),
      team: plainHits.map(h => (h.team ? Math.min(1, h.team.expected) : null)), teamConditions: plainHits.map(h => h.team?.conditions ?? null), teamMoves: plainHits.map(h => h.team?.move ?? null),
      combo: dancedHits ? dancedHits.map(h => (h.team ? Math.min(1, h.team.expected) : null)) : null,
      comboMoves: dancedHits ? dancedHits.map(h => h.team?.move ?? null) : null,
    } : null,
  };
}

/** Per misura, contenuto del set, formato, meta e condizioni del team: le proposte rifanno set uguali con oggetti nuovi. */
const raws = new Map<string, Raw | null>();
/** Le condizioni del team, segnando con * quelle che arrivano solo da una mossa (valgono un quarto, non metà). */
const conditionKey = ({ all, moveOnly }: ReturnType<typeof conditionsOf>) => all.map(c => (moveOnly.includes(c) ? `${c}*` : c)).join(',');
const RAW_LIMIT = 5000;

function rawOf(set: TeamSet, team: TeamSet[], data: EngineData, measure: Measure = 'power'): Raw | null {
  const key = `${measure}|${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${conditionKey(conditionsOf(set, team))}`;
  if (raws.has(key)) return raws.get(key)!;
  if (raws.size >= RAW_LIMIT) raws.clear();
  const value = measureSet(set, team, data, measure);
  raws.set(key, value);
  return value;
}

/** I danni dei 18 bersagli con le quote date di setup e di Tera/Z (al massimo 1). */
function shareDamage(p: PerTarget, setupShare: number, oneShare: number): number[] {
  return p.plain.map((x, i) => Math.min(1, x + setupShare * Math.max(0, (p.danced?.[i] ?? x) - x) + oneShare * Math.max(0, (p.once?.[i] ?? x) - x)));
}
const creditsOf = (p: PerTarget, setupShare: number, oneShare: number) => shareDamage(p, setupShare, oneShare).map(offenseCredit);
const meanScore = (credits: number[]) => Math.round(100 * mean(credits));

export interface OffenseReference {
  /** Solo per i Ruoli: danno medio contro i bersagli della Coverage e valore medio dei colpi sui muri che valgono 100. */
  rolesPower: number;
  step: number;
  /** Gli attaccanti più usati del formato, dal miglior Wallbreaking (vuoto senza statistiche). */
  attackers: string[];
}

const references = new Map<string, OffenseReference>();

/**
 * Il 100 della misura dei Ruoli: il 3° miglior attaccante fra i più usati del formato (set più comune), per danno medio
 * e per Wallbreaking. Senza statistiche: i valori fissi di riserva. Il voto dell'Offesa non usa riferimenti.
 */
export function offenseReference(data: EngineData): OffenseReference {
  // Anche senza meta il riferimento usa le statistiche, se ci sono: mentre si caricano non devono restare quelle di riserva
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let reference = references.get(key);
  if (reference) return reference;
  const rules = rulesOf(data);
  const sets = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set
      && set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length >= 2 && !isDefensiveSet(set, rules));
  const forRoles = sets.map(set => rawOf(set, [set], data, 'roles'))
    .filter((raw): raw is Raw => raw !== null)
    .map(raw => ({ species: raw.species, expected: raw.expected, step: mean(raw.steps) }));
  const nth = (values: number[]) => values.sort((a, b) => b - a)[Math.min(REFERENCE_RANK, values.length) - 1];
  const rolesPower = forRoles.length ? nth(forRoles.map(r => r.expected)) : 0;
  const step = forRoles.length ? nth(forRoles.map(r => r.step)) : 0;
  reference = {
    rolesPower: rolesPower > 0 ? rolesPower : ROLES_POWER_FULL,
    step: step > 0 ? step : STEP_FULL,
    attackers: [...forRoles].sort((a, b) => b.step - a.step).map(r => r.species),
  };
  references.set(key, reference);
  return reference;
}

/**
 * Offesa di un membro: per ognuno dei 18 Pokémon medi il danno del colpo migliore (un terzo del setup, un quarto di
 * Tera/Z, il meteo di un compagno a metà), poi il credito (il danno stesso dal 50%, 0 sotto) e la media.
 * Null se la libreria non conosce il Pokémon.
 */
export function memberOffense(set: TeamSet, team: TeamSet[], data: EngineData): MemberOffense | null {
  const raw = rawOf(set, team, data, 'power');
  if (!raw?.perTarget) return null;
  const p = raw.perTarget;
  const damage = shareDamage(p, SETUP_SHARE, ONE_USE_SHARE);
  const credits = damage.map(offenseCredit);
  const value = meanScore(credits);
  const setupGain = value - meanScore(creditsOf(p, 0, ONE_USE_SHARE));
  const oneUseGain = value - meanScore(creditsOf(p, SETUP_SHARE, 0));
  const labels = coverageTargets(data, 'types').map(t => t.label);
  const sources = teamFieldSources(set, team);
  const coverMeta = usesMeta(data) ? teamCoverage([set], data, 'meta').perMember[0] : null;
  return {
    species: raw.species, bestMove: raw.bestMove, setupMove: raw.setupMove,
    oneUse: raw.oneUse && { kind: raw.oneUse.kind, name: raw.oneUse.name },
    value, setupGain, oneUseGain,
    hits: labels.map((label, i) => ({
      label, move: p.moves[i], pct: Math.floor(100 * damage[i]), credit: credits[i],
      plainPct: Math.floor(100 * Math.min(1, p.plain[i])),
      setupPct: p.danced ? Math.floor(100 * Math.min(1, p.danced[i])) : null,
      oncePct: p.once ? Math.floor(100 * Math.min(1, p.once[i])) : null,
      teamPct: p.team[i] === null ? null : Math.floor(100 * p.team[i]!),
      teamVia: p.teamConditions[i] ? sources.filter(s => p.teamConditions[i]!.includes(s.condition)) : null,
      teamMove: p.teamMoves[i],
      comboPct: p.combo?.[i] == null ? null : Math.floor(100 * p.combo[i]!),
      comboMove: p.comboMoves?.[i] ?? null,
    })),
    coverMeta,
    total: coverMeta === null ? value : Math.round(OFFENSE_SHARES.types * value + OFFENSE_SHARES.meta * coverMeta),
  };
}

/** La vecchia Offesa del membro, solo per i Ruoli (wallbreaker e sweeper): non entra nel voto e non si mostra. */
export interface RolesMemberOffense {
  wallbreaking: number;
  wallbreakingGain: number;
  value: number;
  bestMove: string | null;
  setupMove: string | null;
}

/**
 * La misura dei Ruoli, com'era prima della revisione: Potenza contro i bersagli della Coverage e Wallbreaking contro
 * i muri del formato (pesi 50 e 35), setup a tre quarti del guadagno di Wallbreaking, Tera/Z a un quarto.
 */
export function rolesMemberOffense(set: TeamSet, team: TeamSet[], data: EngineData): RolesMemberOffense | null {
  const raw = rawOf(set, team, data, 'roles');
  if (!raw) return null;
  const ref = offenseReference(data);
  const power = toScore(raw.expected, ref.rolesPower);
  const wallbreaking = toScore(mean(raw.steps), ref.step);
  const withSetup = raw.setupSteps ? toScore(mean(raw.steps.map((x, d) => Math.max(x, raw.setupSteps![d]))), ref.step) : wallbreaking;
  const wallbreakingGain = Math.round(ROLES_SETUP_SHARE * (withSetup - wallbreaking));
  const one = raw.oneUse;
  const powerInGrade = one ? power + ONE_USE_SHARE * (toScore(one.expected, ref.rolesPower) - power) : power;
  const wallOneUse = one ? ONE_USE_SHARE * (toScore(mean(one.steps), ref.step) - wallbreaking) : 0;
  const w = ROLES_WEIGHTS;
  const value = Math.round((w.power * powerInGrade + w.wallbreaking * (wallbreaking + wallbreakingGain + wallOneUse)) / (w.power + w.wallbreaking));
  return { wallbreaking, wallbreakingGain, value, bestMove: raw.bestMove, setupMove: raw.setupMove };
}

/** Media coi pesi per posizione (oggi uguali): valori dal più alto al più basso, pesi rinormalizzati se sono meno di sei. */
export function rankWeighted(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const weights = sorted.map((_, i) => RANK_WEIGHTS[Math.min(i, RANK_WEIGHTS.length - 1)]);
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round(sorted.reduce((acc, v, i) => acc + v * weights[i], 0) / total);
}

/** Per ogni bersaglio, i crediti dei membri dal più alto, coi pesi 70/20/10. */
const depthOf = (credits: number[]) => [...credits].sort((a, b) => b - a).reduce((acc, c, i) => acc + (OFFENSE_DEPTH[i] ?? 0) * c, 0);
/** Il pacchetto: per ogni bersaglio la profondità dei crediti dei membri, poi la media ×100 (0 senza membri). */
const packOf = (lists: number[][], targets: number) =>
  lists.length ? Math.round(100 * mean(Array.from({ length: targets }, (_, i) => depthOf(lists.map(c => c[i]))))) : 0;

/**
 * Offesa del team: il pacchetto dei tipi (per ognuno dei 18 Pokémon medi i crediti dei membri con la profondità 70/20/10,
 * poi la media) 50% e la Coverage del meta 50%; senza meta il pacchetto vale tutto. Un membro che non attacca non porta
 * crediti ma non abbassa il team.
 */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  const labels = coverageTargets(data, 'types').map(t => t.label);
  const metaCoverage = usesMeta(data) ? teamCoverage(team, data, 'meta') : null;
  const measured = team
    .map(set => ({ set, member: memberOffense(set, team, data) }))
    .filter((x): x is { set: TeamSet; member: MemberOffense } => x.member !== null);
  const members = measured.map(x => x.member);
  const final = (types: number) => (!members.length ? 0 : metaCoverage
    ? Math.round(OFFENSE_SHARES.types * types + OFFENSE_SHARES.meta * metaCoverage.value)
    : types);
  const typesValue = packOf(members.map(m => m.hits.map(h => h.credit)), labels.length);
  const value = final(typesValue);
  // Quanto vale il setup sull'Offesa finale: lo stesso conto con i membri senza la parte del setup
  const withoutSetup = final(packOf(measured.map(({ set }) => creditsOf(rawOf(set, team, data, 'power')!.perTarget!, 0, ONE_USE_SHARE)), labels.length));
  const rows = labels.map((label, i) => {
    const best = members
      .map(m => ({ species: m.species, move: m.hits[i].move, pct: m.hits[i].pct, credit: m.hits[i].credit }))
      .filter(b => b.credit > 0)
      .sort((a, b) => b.credit - a.credit)
      .slice(0, OFFENSE_DEPTH.length);
    return { label, level: Math.round(100 * depthOf(members.map(m => m.hits[i].credit))), best };
  });
  const styles = team.filter(set => battleSpecies(set)).map(attackStyle);
  return {
    attackers: { physical: styles.filter(s => s === 'physical').length, special: styles.filter(s => s === 'special').length, mixed: styles.filter(s => s === 'mixed').length },
    value,
    types: { value: typesValue, rows, holes: labels.filter((_, i) => !members.some(m => m.hits[i].pct >= 100 * HOLE_HIT)) },
    coverageMeta: metaCoverage && { value: metaCoverage.value, holes: metaCoverage.holes, rows: metaCoverage.rows },
    setupGain: value - withoutSetup,
    setters: members.filter(m => m.setupMove).map(m => ({ species: m.species, move: m.setupMove! })),
    members,
    shares: memberShares(members, labels.length, metaCoverage?.rows ?? null, value),
  };
}

/**
 * Cosa copre e quanto porta ogni membro. Tipi: per ogni bersaglio la sua parte della profondità 70/20/10, poi la media.
 * Meta: lo stesso coi bersagli del meta (il credito di chi lo manda KO in due colpi è il suo danno), pesati per uso.
 * I punti sommati fanno l'Offesa del team.
 */
function memberShares(members: MemberOffense[], targets: number, metaRows: CoverageRow[] | null, value: number): MemberShare[] {
  const typePart = members.map(() => 0);
  for (let i = 0; i < targets; i++) depthShares(members.map(m => m.hits[i].credit), OFFENSE_DEPTH).forEach((x, k) => { typePart[k] += (100 * x) / targets; });
  const metaPart = members.map(() => 0);
  for (const row of metaRows ?? []) {
    const credits = members.map(m => row.coveredBy.find(c => c.species === m.species)?.credit ?? 0);
    depthShares(credits, META_DEPTH).forEach((x, k) => { metaPart[k] += 100 * row.weight * x; });
  }
  const raw = members.map((_, k) => (metaRows ? OFFENSE_SHARES.types * typePart[k] + OFFENSE_SHARES.meta * metaPart[k] : typePart[k]));
  const points = roundToTotal(raw, value);
  return members.map((m, k) => ({
    species: m.species,
    types: {
      ohko: m.hits.filter(h => h.credit >= 1).length,
      strong: m.hits.filter(h => h.credit >= STRONG_CREDIT && h.credit < 1).length,
      counts: m.hits.filter(h => h.credit > 0 && h.credit < STRONG_CREDIT).length,
    },
    meta: metaRows && { covered: metaRows.filter(r => r.coveredBy.some(c => c.species === m.species)).length, total: metaRows.length },
    points: points[k],
  }));
}
