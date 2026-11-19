import { bestHit, type Hit } from './damage';
import { getMove, toID } from './dex';
import { hitsToKO } from './duel';
import type { TeamSet } from './sets';
import type { StatID } from '@pkmn/dex';

/**
 * La Sfida dell'editor: il membro contro un avversario scelto. Il colpo migliore del membro e quello che fa più male
 * all'avversario, coi colpi per mandare KO, e un consiglio di EV quando una piccola modifica sposta una soglia.
 * Il danno è quello pieno (niente sconto della Choice né mezze misure del primo colpo: Multiscale vale a PS pieni).
 */
const OPTIONS = { incoming: true, firstHitShare: 1 } as const;

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

/** Il colpo con una mossa sola (per cercare le soglie senza ricalcolare le altre tre). */
const single = (attacker: TeamSet, move: string, defender: TeamSet) => bestHit({ ...attacker, moves: [move] }, defender, OPTIONS);

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
 * manda KO con meno colpi sicuri di oggi (o se oggi non ha colpi). Niente mosse OHKO: dipendono dalla precisione.
 */
function moveTip(me: TeamSet, opp: TeamSet, mine: DuelHit | null, pool: readonly string[]): MoveTip | null {
  if (mine && mine.hitsSure <= 1) return null;
  const have = new Set(me.moves.map(toID));
  const moves = pool.filter(name => {
    const move = getMove(name);
    return !!move && move.category !== 'Status' && !move.ohko && !have.has(move.id);
  });
  if (!moves.length) return null;
  const hit = bestHit({ ...me, moves }, opp, OPTIONS);
  if (!hit || hit.min <= 0) return null;
  const hits = hitsFor(hit.min);
  return !mine || !Number.isFinite(mine.hitsSure) || hits < mine.hitsSure ? { move: hit.move, hits } : null;
}

/**
 * La sfida: i due colpi, i consigli di EV per lato (solo se sono un ritocco) e, se si passa l'elenco delle mosse
 * imparabili, una mossa migliore da mettere nel set.
 */
export function editorDuel(me: TeamSet, opp: TeamSet, pool: readonly string[] = []): EditorDuel {
  const mine = toDuelHit(bestHit(me, opp, OPTIONS));
  const theirs = toDuelHit(bestHit(opp, me, OPTIONS));
  const small = (t: EvTip | null) => (t && t.total <= TIP_MAX_EVS ? t : null);
  const defTip = small(theirs && defenseTip(me, opp, theirs));
  const atkTip = small(mine && attackTip(me, opp, mine));
  const tip = [defTip, atkTip].filter((t): t is EvTip => !!t).sort((a, b) => a.total - b.total)[0] ?? null;
  return { mine, theirs, tip, atkTip, defTip, moveTip: pool.length ? moveTip(me, opp, mine, pool) : null };
}

/** L'avversario di partenza: fra le minacce del meta, quella che fa più male al membro. */
export function worstThreat(me: TeamSet, threats: TeamSet[]): TeamSet | null {
  let worst: { set: TeamSet; expected: number } | null = null;
  for (const set of threats) {
    const hit = bestHit(set, me, OPTIONS);
    if (hit && (!worst || hit.expected > worst.expected)) worst = { set, expected: hit.expected };
  }
  return worst?.set ?? null;
}
