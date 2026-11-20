import { bestHit, type FieldCondition, type Hit, type HitOptions } from './damage';
import { getMove, toID } from './dex';
import { AVOID_MOVES } from './generatedSet';
import { hitsToKO } from './duel';
import type { TeamSet } from './sets';
import type { StatID } from '@pkmn/dex';
import { paradoxSpeedBoost, speedStat } from './speed';
import { setupBoosts } from './setupBoosts';
import { ownConditions } from './coverage';
import { teamFieldCombos, teamFieldSources } from './partner';

/**
 * La Sfida dell'editor: il membro contro un avversario scelto. Il colpo migliore del membro e quello che fa più male
 * all'avversario, coi colpi per mandare KO, e un consiglio di EV quando una piccola modifica sposta una soglia.
 * Il danno è quello pieno (niente sconto della Choice né mezze misure del primo colpo: Multiscale vale a PS pieni).
 */
const OPTIONS = { incoming: true, firstHitShare: 1 } as const;

const WEATHERS: FieldCondition[] = ['sun', 'rain', 'sand', 'snow'];
/**
 * Il campo della Sfida: il meteo e il terreno che portano le abilità in campo (Charizard Mega Y col sole, Rillaboom col
 * Grassy Terrain). Conta prima quello di chi attacca; se non ne porta, quello di chi difende (tra i due resta l'ultimo).
 */
export function duelField(attacker: TeamSet, defender: TeamSet): FieldCondition[] {
  const a = ownConditions(attacker);
  const d = ownConditions(defender);
  const pick = (isWeather: boolean) => {
    const own = a.filter(c => WEATHERS.includes(c) === isWeather);
    return own.length ? own : d.filter(c => WEATHERS.includes(c) === isWeather);
  };
  return [...pick(true), ...pick(false)];
}
/** Le opzioni del colpo di chi attacca, col campo della Sfida. */
const optsFor = (attacker: TeamSet, defender: TeamSet) => ({ ...OPTIONS, conditions: duelField(attacker, defender) });

export interface DuelHit extends Hit {
  category: 'Physical' | 'Special';
  /** Colpi per un KO sicuro (danno minimo) e possibile (danno massimo); Infinity se non fa danno. */
  hitsSure: number;
  hitsMaybe: number;
}

export interface EvTip {
  /** Dove mettere gli EV in più, e quanti. */
  add: Partial<Record<StatID, number>>;
  total: number;
  /** Colpi dopo la modifica (difesa: quelli che servono all'avversario; attacco: quelli che servono al membro). */
  hits: number;
  side: 'defense' | 'attack';
}

/** Una mossa da mettere nel set che manda KO l'avversario con meno colpi del colpo migliore di oggi. */
export interface MoveTip {
  move: string;
  /** Colpi per un KO sicuro con la mossa nuova. */
  hits: number;
}

export interface EditorDuel {
  mine: DuelHit | null;
  theirs: DuelHit | null;
  /** Il consiglio di EV più piccolo fra attacco e difesa (a parità, la difesa). */
  tip: EvTip | null;
  /** I consigli di EV per lato, ognuno solo se è un ritocco. */
  atkTip: EvTip | null;
  defTip: EvTip | null;
  moveTip: MoveTip | null;
}

const hitsFor = hitsToKO;

function toDuelHit(hit: Hit | null): DuelHit | null {
  if (!hit) return null;
  const category = getMove(hit.move)?.category === 'Special' ? 'Special' : 'Physical';
  return { ...hit, category, hitsSure: hitsFor(hit.min), hitsMaybe: hitsFor(hit.max) };
}

/** I due colpi migliori della Sfida (il tuo e il suo), con le stesse regole delle righe. */
export function duelHits(me: TeamSet, opp: TeamSet): { mine: DuelHit | null; theirs: DuelHit | null } {
  return { mine: toDuelHit(bestHit(me, opp, optsFor(me, opp))), theirs: toDuelHit(bestHit(opp, me, optsFor(opp, me))) };
}

/** Il colpo con una mossa sola (per cercare le soglie senza ricalcolare le altre tre). */
const single = (attacker: TeamSet, move: string, defender: TeamSet) => bestHit({ ...attacker, moves: [move] }, defender, optsFor(attacker, defender));

const ev = (set: TeamSet, stat: StatID) => set.evs[stat] ?? 0;
const withEvs = (set: TeamSet, add: Partial<Record<StatID, number>>): TeamSet => {
  const evs = { ...set.evs };
  for (const [stat, n] of Object.entries(add) as [StatID, number][]) evs[stat] = ev(set, stat) + n;
  return { ...set, evs };
};

/** Il più piccolo multiplo di 4 in [0, room] che rende vero `ok` (che cresce con gli EV), o null. */
function smallest(room: number, ok: (n: number) => boolean): number | null {
  const steps = Math.floor(room / 4);
  if (steps <= 0 || !ok(steps * 4)) return null;
  let lo = 0;
  let hi = steps;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ok(mid * 4)) hi = mid; else lo = mid;
  }
  return hi * 4;
}

/**
 * Difesa: quanti EV in più (PS e la difesa giusta) servono perché il colpo peggiore dell'avversario, anche col danno
 * massimo, abbia bisogno di un colpo in più. Si prova ogni quota di PS e si cerca la difesa minima; vince il totale più basso.
 */
function defenseTip(me: TeamSet, opp: TeamSet, theirs: DuelHit): EvTip | null {
  if (!Number.isFinite(theirs.hitsMaybe)) return null;
  const target = theirs.hitsMaybe + 1;
  const def: StatID = theirs.category === 'Special' ? 'spd' : 'def';
  const hpRoom = 252 - ev(me, 'hp');
  const defRoom = 252 - ev(me, def);
  let best: EvTip | null = null;
  for (let hp = 0; hp <= hpRoom; hp += 4) {
    if (best && hp >= best.total) break;
    const survives = (d: number) => {
      const hit = single(opp, theirs.move, withEvs(me, { hp, [def]: d }));
      return !hit || hitsFor(hit.max) >= target;
    };
    const d = survives(0) ? 0 : smallest(defRoom, survives);
    if (d === null) continue;
    const total = hp + d;
    if (total > 0 && (!best || total < best.total)) {
      best = { add: { ...(hp ? { hp } : {}), ...(d ? { [def]: d } : {}) }, total, hits: target, side: 'defense' };
    }
  }
  return best;
}

/** Attacco: quanti EV in più nella statistica d'attacco servono per mandarlo KO con un colpo in meno (sicuro). */
function attackTip(me: TeamSet, opp: TeamSet, mine: DuelHit): EvTip | null {
  if (!Number.isFinite(mine.hitsSure) || mine.hitsSure <= 1) return null;
  const target = mine.hitsSure - 1;
  const stat: StatID = mine.category === 'Special' ? 'spa' : 'atk';
  const n = smallest(252 - ev(me, stat), add => {
    const hit = single(withEvs(me, { [stat]: add }), mine.move, opp);
    return !!hit && hitsFor(hit.min) <= target;
  });
  return n === null ? null : { add: { [stat]: n }, total: n, hits: target, side: 'attack' };
}

/** Oltre questi EV in più non è un ritocco ma un altro spread: niente consiglio. */
export const TIP_MAX_EVS = 160;

/**
 * La mossa migliore fra quelle che il membro può imparare (pool) e non ha già: quella col danno atteso più alto, solo se
 * manda KO con meno colpi sicuri di oggi (o se oggi non ha colpi). Niente mosse OHKO (dipendono dalla precisione) né
 * mosse difficili da usare (AVOID_MOVES: Focus Punch, Dream Eater, Belch…), che vincerebbero solo per la potenza.
 */
function moveTip(me: TeamSet, opp: TeamSet, mine: DuelHit | null, pool: readonly string[]): MoveTip | null {
  if (mine && mine.hitsSure <= 1) return null;
  const have = new Set(me.moves.map(toID));
  const moves = pool.filter(name => {
    const move = getMove(name);
    return !!move && move.category !== 'Status' && !move.ohko && !AVOID_MOVES.has(move.id) && !have.has(move.id);
  });
  if (!moves.length) return null;
  const hit = bestHit({ ...me, moves }, opp, optsFor(me, opp));
  if (!hit || hit.min <= 0) return null;
  const hits = hitsFor(hit.min);
  return !mine || !Number.isFinite(mine.hitsSure) || hits < mine.hitsSure ? { move: hit.move, hits } : null;
}

/**
 * La sfida: i due colpi, i consigli di EV per lato (solo se sono un ritocco) e, se si passa l'elenco delle mosse
 * imparabili, una mossa migliore da mettere nel set.
 */
export function editorDuel(me: TeamSet, opp: TeamSet, pool: readonly string[] = []): EditorDuel {
  const mine = toDuelHit(bestHit(me, opp, optsFor(me, opp)));
  const theirs = toDuelHit(bestHit(opp, me, optsFor(opp, me)));
  const small = (t: EvTip | null) => (t && t.total <= TIP_MAX_EVS ? t : null);
  const defTip = small(theirs && defenseTip(me, opp, theirs));
  const atkTip = small(mine && attackTip(me, opp, mine));
  const tip = [defTip, atkTip].filter((t): t is EvTip => !!t).sort((a, b) => a.total - b.total)[0] ?? null;
  return { mine, theirs, tip, atkTip, defTip, moveTip: pool.length ? moveTip(me, opp, mine, pool) : null };
}

/** Come va lo scontro uno contro uno: vinci, perdi, o dipende dai tiri del danno (o dalla Velocità pari). */
export type MatchupVerdict = 'good' | 'even' | 'bad';
export interface Matchup {
  verdict: MatchupVerdict;
  /** Il tuo danno atteso meno il suo (frazioni dei PS): a parità di giudizio, più è basso più la sfida è brutta. */
  score: number;
}

/**
 * Lo scontro col colpo migliore di ognuno: vince chi manda KO in meno colpi; a pari colpi chi è più veloce. Si guarda
 * coi tiri a tuo favore (il tuo danno più alto, il suo più basso) e a tuo sfavore: vinci in tutti e due i casi =
 * favorevole, perdi in tutti e due = sfavorevole, altrimenti alla pari (decidono i tiri, o la Velocità pari).
 */
export function matchup(me: TeamSet, opp: TeamSet): Matchup {
  const mine = bestHit(me, opp, optsFor(me, opp));
  const theirs = bestHit(opp, me, optsFor(opp, me));
  const a = battleSpeed(me);
  const b = battleSpeed(opp);
  const outcome = (myDamage: number, theirDamage: number) => {
    const myHits = hitsToKO(myDamage);
    const theirHits = hitsToKO(theirDamage);
    if (myHits === Infinity && theirHits === Infinity) return 0;
    if (myHits !== theirHits) return myHits < theirHits ? 1 : -1;
    return a > b ? 1 : a < b ? -1 : 0;
  };
  const lucky = outcome(mine?.max ?? 0, theirs?.min ?? 0);
  const unlucky = outcome(mine?.min ?? 0, theirs?.max ?? 0);
  const verdict: MatchupVerdict = unlucky > 0 ? 'good' : lucky < 0 ? 'bad' : 'even';
  return { verdict, score: (mine?.expected ?? 0) - (theirs?.expected ?? 0) };
}

const VERDICT_ORDER: Record<MatchupVerdict, number> = { bad: 0, even: 1, good: 2 };

/** Gli avversari dal matchup peggiore al migliore: prima le sfide sfavorevoli, poi alla pari, poi favorevoli. */
export function rankMatchups(me: TeamSet, threats: TeamSet[]): { set: TeamSet; matchup: Matchup }[] {
  return threats
    .map(set => ({ set, matchup: matchup(me, set) }))
    .sort((x, y) => VERDICT_ORDER[x.matchup.verdict] - VERDICT_ORDER[y.matchup.verdict] || x.matchup.score - y.matchup.score);
}

/** L'avversario di partenza: fra le minacce del meta, quella che fa più male al membro. */
export function worstThreat(me: TeamSet, threats: TeamSet[]): TeamSet | null {
  let worst: { set: TeamSet; expected: number } | null = null;
  for (const set of threats) {
    const hit = bestHit(set, me, optsFor(set, me));
    if (hit && (!worst || hit.expected > worst.expected)) worst = { set, expected: hit.expected };
  }
  return worst?.set ?? null;
}

/** Velocità in lotta: quella finale (Sciarpa compresa) e ×1,5 se Protosynthesis o Quark Drive la alzano con la Booster Energy. */
export function battleSpeed(set: TeamSet): number {
  const { value } = speedStat(set);
  const booster = toID(set.item) === 'boosterenergy' && paradoxSpeedBoost(set);
  return booster ? Math.floor(value * 1.5) : value;
}

export interface DuelSpeed {
  mine: number;
  theirs: number;
  /** Chi muove per primo (senza mosse con priorità): 'pari' = 50% a testa. */
  order: 'mine' | 'theirs' | 'tie';
  /** Se sei più lento o pari: quanti EV in più in Velocità servono per superarlo (solo se è un ritocco). */
  tip: { evs: number } | null;
}

/** Il confronto di Velocità della Sfida, col consiglio di EV come per i colpi. */
export function duelSpeed(me: TeamSet, opp: TeamSet): DuelSpeed {
  const mine = battleSpeed(me);
  const theirs = battleSpeed(opp);
  const order = mine > theirs ? 'mine' : mine < theirs ? 'theirs' : 'tie';
  let tip: DuelSpeed['tip'] = null;
  if (order !== 'mine') {
    const n = smallest(252 - ev(me, 'spe'), add => battleSpeed(withEvs(me, { spe: add })) > theirs);
    if (n !== null && n <= TIP_MAX_EVS) tip = { evs: n };
  }
  return { mine, theirs, order, tip };
}


/**
 * Un potenziamento che si può accendere in una riga della Sfida: la danza del set (setup), il meteo o il campo che porta
 * il team (team), il Ventoincoda di un compagno. `against`: è dell'avversario (va contro di te). `apply`: cosa cambia nel
 * calcolo (aumenti di chi attacca, meteo e campi; per la Velocità i moltiplicatori). `hits` / `first`: l'esito col solo
 * questo potenziamento, per il tooltip.
 */
export interface DuelBuff {
  id: string;
  kind: 'setup' | 'team';
  /** La mossa o l'abilità che lo dà (Swords Dance, Drought, Tailwind). */
  source: string;
  /** Chi lo porta, se è un compagno. */
  by?: string;
  against?: boolean;
  apply: BuffEffect;
  hits?: number;
  first?: 'mine' | 'theirs' | 'tie';
}

export interface BuffEffect {
  boosts?: NonNullable<HitOptions['boosts']>;
  conditions?: FieldCondition[];
  /** Velocità: moltiplicatori tuo e suo. */
  mine?: number;
  theirs?: number;
}

/** Più potenziamenti accesi insieme: gli aumenti si sommano (fino a +6), meteo e campi si uniscono, i moltiplicatori si moltiplicano. */
export function mergeEffects(effects: BuffEffect[]): BuffEffect {
  const boosts: NonNullable<HitOptions['boosts']> = {};
  const conditions = new Set<FieldCondition>();
  let mine = 1;
  let theirs = 1;
  for (const e of effects) {
    for (const [stat, n] of Object.entries(e.boosts ?? {}) as [keyof NonNullable<HitOptions['boosts']>, number][]) boosts[stat] = Math.min(6, (boosts[stat] ?? 0) + n);
    for (const c of e.conditions ?? []) conditions.add(c);
    mine *= e.mine ?? 1;
    theirs *= e.theirs ?? 1;
  }
  return { boosts, conditions: [...conditions], mine, theirs };
}

/** Il colpo migliore con i potenziamenti accesi (meteo dell'abilità di chi attacca sempre attivo). */
export function buffedHit(attacker: TeamSet, defender: TeamSet, effect: BuffEffect): DuelHit | null {
  // Il campo della Sfida, con quello che portano i potenziamenti accesi al posto suo (un meteo ne sostituisce un altro)
  const added = effect.conditions ?? [];
  const isWeather = (c: FieldCondition) => WEATHERS.includes(c);
  const base = duelField(attacker, defender).filter(c => !added.some(x => isWeather(x) === isWeather(c)));
  const conditions = [...new Set([...base, ...added])];
  return toDuelHit(bestHit(attacker, defender, { ...OPTIONS, conditions, boosts: effect.boosts }));
}

/** Un potenziamento conta se sposta il danno (almeno mezzo punto di PS) o i colpi. */
const changes = (now: DuelHit | null, next: DuelHit | null) => !!next && (!now
  || Math.abs(next.max - now.max) >= 0.005 || next.hitsSure !== now.hitsSure);

/** Il meteo e i campi del team che cambiano un colpo, uno per combinazione: il primo che lo sposta di più. */
function teamFieldBuffs(holder: TeamSet, attacker: TeamSet, defender: TeamSet, team: TeamSet[], now: DuelHit | null, prefix: string): DuelBuff[] {
  const sources = teamFieldSources(holder, team);
  const out: DuelBuff[] = [];
  for (const c of teamFieldCombos(ownConditions(holder), sources)) {
    if (c.added.length !== 1) continue;
    const effect = { conditions: c.added };
    const next = buffedHit(attacker, defender, effect);
    if (!changes(now, next)) continue;
    const via = sources.filter(s => c.added.includes(s.condition));
    out.push({ id: `${prefix}:team:${c.added.join('+')}`, kind: 'team', source: via.map(v => v.via).join(' + '), by: via.map(v => v.species).join(', '), apply: effect, hits: next!.hitsSure });
  }
  return out;
}

/** I potenziamenti del tuo colpo: la danza del tuo set, il meteo o il campo del team. */
export function attackBuffs(me: TeamSet, opp: TeamSet, team: TeamSet[], now: DuelHit | null): DuelBuff[] {
  const out: DuelBuff[] = [];
  const setup = setupBoosts(me);
  if (setup) {
    const effect = { boosts: setup.boosts };
    const next = buffedHit(me, opp, effect);
    if (changes(now, next)) out.push({ id: 'atk:setup', kind: 'setup', source: setup.move, apply: effect, hits: next!.hitsSure });
  }
  return [...out, ...teamFieldBuffs(me, me, opp, team, now, 'atk')];
}

/** La riga del suo colpo: il meteo o il campo del tuo team (a tuo favore o no), e la sua danza (contro di te). */
export function defenseBuffs(me: TeamSet, opp: TeamSet, team: TeamSet[], now: DuelHit | null): DuelBuff[] {
  const out = teamFieldBuffs(me, opp, me, team, now, 'def').map(b => ({ ...b, hits: buffedHit(opp, me, b.apply)?.hitsMaybe }));
  const setup = setupBoosts(opp);
  if (setup) {
    const effect = { boosts: setup.boosts };
    const next = buffedHit(opp, me, effect);
    if (changes(now, next)) out.push({ id: 'def:setup', kind: 'setup', source: setup.move, against: true, apply: effect, hits: next!.hitsMaybe });
  }
  return out;
}

/** Il moltiplicatore della Velocità dopo n aumenti. */
const stageMult = (n: number) => (2 + Math.min(6, n)) / 2;
/** La mossa di stato del set che alza di più la Velocità (Dragon Dance, Agility, Shift Gear), e di quanto. */
function speedSetup(set: TeamSet): { move: string; stages: number } | null {
  let best: { move: string; stages: number } | null = null;
  for (const name of set.moves) {
    const move = getMove(name);
    const spe = move?.category === 'Status' && move.target === 'self' ? move.boosts?.spe ?? 0 : 0;
    if (move && spe > 0 && (!best || spe > best.stages)) best = { move: move.name, stages: spe };
  }
  return best;
}
export const orderOf = (a: number, b: number): 'mine' | 'theirs' | 'tie' => (a > b ? 'mine' : a < b ? 'theirs' : 'tie');

/** I potenziamenti della Velocità: la tua danza, il Ventoincoda del team, la sua danza. */
export function speedBuffs(me: TeamSet, opp: TeamSet, team: TeamSet[]): DuelBuff[] {
  const mine = battleSpeed(me);
  const theirs = battleSpeed(opp);
  const out: DuelBuff[] = [];
  const own = speedSetup(me);
  if (own) out.push({ id: 'spe:setup', kind: 'setup', source: own.move, apply: { mine: stageMult(own.stages) }, first: orderOf(Math.floor(mine * stageMult(own.stages)), theirs) });
  const tailwind = team.find(member => member.moves.some(m => toID(m) === 'tailwind'));
  if (tailwind) out.push({ id: 'spe:tailwind', kind: 'team', source: getMove('tailwind')?.name ?? 'Tailwind', by: tailwind.species, apply: { mine: 2 }, first: orderOf(mine * 2, theirs) });
  const theirSetup = speedSetup(opp);
  if (theirSetup) out.push({ id: 'spe:against', kind: 'setup', source: theirSetup.move, against: true, apply: { theirs: stageMult(theirSetup.stages) }, first: orderOf(mine, Math.floor(theirs * stageMult(theirSetup.stages))) });
  return out;
}
