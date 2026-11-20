import type { StatID } from '@pkmn/dex';
import { metaThreats } from './attackers';
import type { EngineData } from './data';
import { getMove, toID } from './dex';
import { battleSpeed, duelHits, duelSpeed, editorDuel } from './editorDuel';
import { rateTeam } from './rating';
import type { TeamSet } from './sets';

/**
 * I consigli della Sfida resi azioni: per ogni consiglio le varianti del set (da dove si prendono gli EV, quale mossa
 * si toglie), il voto del team con ognuna e cosa cambia contro il resto del meta.
 */

export type EvMap = Partial<Record<StatID, number>>;

const MAX_TOTAL = 510;
const STATS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const ev = (evs: EvMap, stat: StatID) => evs[stat] ?? 0;
const total = (evs: EvMap) => STATS.reduce((acc, stat) => acc + ev(evs, stat), 0);

/**
 * I modi di pagare gli EV di `add`: se bastano quelli liberi (a multipli di 4) una sola variante senza togliere niente;
 * altrimenti il mancante (a multipli di 4) tolto da UNA statistica fuori da `add` che ne ha abbastanza, una variante
 * per statistica. Nessuna variante: il consiglio non si può fare.
 */
export function evSources(set: TeamSet, add: EvMap): { set: TeamSet; taken: EvMap }[] {
  const added = { ...set.evs };
  for (const stat of STATS) if (add[stat]) added[stat] = ev(added, stat) + add[stat]!;
  const free = Math.max(0, MAX_TOTAL - total(set.evs));
  const need = Math.max(0, total(add) - (free - (free % 4)));
  if (need === 0) return [{ set: { ...set, evs: added }, taken: {} }];
  const pay = Math.ceil(need / 4) * 4;
  return STATS.filter(stat => !add[stat] && ev(set.evs, stat) >= pay).map(stat => ({
    set: { ...set, evs: { ...added, [stat]: ev(set.evs, stat) - pay } },
    taken: { [stat]: pay },
  }));
}

export type MetaEffectKind = 'takeMore' | 'takeLess' | 'dealMore' | 'dealLess';
export interface MetaShift { species: string; before: number; after: number }
export interface MetaEffect { kind: MetaEffectKind; shifts: MetaShift[]; type?: string }

const KIND_ORDER: MetaEffectKind[] = ['takeMore', 'dealMore', 'takeLess', 'dealLess'];
const hitsOf = (hit: { hitsSure: number; hitsMaybe: number } | null, sure: boolean) => (hit ? (sure ? hit.hitsSure : hit.hitsMaybe) : Infinity);
/** Quanto si è spostata la soglia (Infinity conta come un colpo oltre l'altro numero). */
const gap = (s: MetaShift) => (Number.isFinite(s.before) && Number.isFinite(s.after) ? Math.abs(s.after - s.before) : 1);

/**
 * Cosa cambia contro ogni minaccia passando da `before` ad `after`: il tuo colpo (colpi sicuri) e il suo (colpi
 * possibili), come nelle righe della Sfida. Solo i cambi dei colpi per il KO; dentro ogni tipo prima il cambio più grande,
 * poi la minaccia più usata.
 */
export function metaEffects(before: TeamSet, after: TeamSet, threats: { set: TeamSet; weight: number }[]): MetaEffect[] {
  const found = new Map<MetaEffectKind, { shift: MetaShift; weight: number }[]>();
  const push = (kind: MetaEffectKind, shift: MetaShift, weight: number) => {
    const list = found.get(kind) ?? [];
    list.push({ shift, weight });
    found.set(kind, list);
  };
  for (const { set: threat, weight } of threats) {
    const was = duelHits(before, threat);
    const now = duelHits(after, threat);
    const dealt = { species: threat.species, before: hitsOf(was.mine, true), after: hitsOf(now.mine, true) };
    const taken = { species: threat.species, before: hitsOf(was.theirs, false), after: hitsOf(now.theirs, false) };
    if (dealt.after < dealt.before) push('dealMore', dealt, weight);
    else if (dealt.after > dealt.before) push('dealLess', dealt, weight);
    if (taken.after > taken.before) push('takeMore', taken, weight);
    else if (taken.after < taken.before) push('takeLess', taken, weight);
  }
  return KIND_ORDER.filter(kind => found.has(kind)).map(kind => ({
    kind,
    shifts: found.get(kind)!.sort((a, b) => gap(b.shift) - gap(a.shift) || b.weight - a.weight).map(x => x.shift),
  }));
}

export type TipId = 'def' | 'atk' | 'spe' | 'move';
export interface TipOption {
  set: TeamSet;
  /** EV tolti per pagare il consiglio (vuoto se bastano quelli liberi). */
  taken: EvMap;
  /** La mossa tolta (solo consigli di mossa; '' = slot vuoto). */
  replaced: string | null;
  /** Voto del team con questa variante; null se il voto è bloccato. */
  overall: number | null;
  effects: MetaEffect[];
}
export interface DuelTip { id: TipId; row: 'mine' | 'theirs' | 'speed'; add: EvMap; move: string | null; options: TipOption[]; best: number }
export interface DuelTipsResult { overall: number | null; tips: DuelTip[] }

const SPEED_RANK = { theirs: 0, tie: 1, mine: 2 } as const;
const speedRank = (me: TeamSet, opp: TeamSet) => {
  const a = battleSpeed(me);
  const b = battleSpeed(opp);
  return SPEED_RANK[a > b ? 'mine' : a < b ? 'theirs' : 'tie'];
};

/** La variante fa davvero quello che promette il consiglio (togliere EV ai PS può annullare quelli messi in difesa). */
function improves(id: TipId, me: TeamSet, next: TeamSet, opp: TeamSet): boolean {
  if (id === 'spe') return battleSpeed(next) > battleSpeed(opp);
  const was = duelHits(me, opp);
  const now = duelHits(next, opp);
  if (id === 'def') return (now.theirs?.hitsMaybe ?? Infinity) > (was.theirs?.hitsMaybe ?? Infinity);
  return (now.mine?.hitsSure ?? Infinity) < (was.mine?.hitsSure ?? Infinity);
}

/**
 * I chip dei consigli subito, senza voti: i consigli della Sfida che si possono pagare (almeno un modo di prendere gli EV
 * che migliora davvero la sua riga). Gli stessi, nello stesso ordine, di duelTips.
 */
export function quickTips(me: TeamSet, opp: TeamSet, pool: readonly string[]): { id: TipId; add: EvMap; move: string | null }[] {
  const duel = editorDuel(me, opp, pool);
  const speed = duelSpeed(me, opp);
  const ok = (id: TipId, add: EvMap) => evSources(me, add).some(v => improves(id, me, v.set, opp));
  return [
    ...(duel.defTip && ok('def', duel.defTip.add) ? [{ id: 'def' as const, add: duel.defTip.add, move: null }] : []),
    ...(duel.atkTip && ok('atk', duel.atkTip.add) ? [{ id: 'atk' as const, add: duel.atkTip.add, move: null }] : []),
    ...(speed.tip && ok('spe', { spe: speed.tip.evs }) ? [{ id: 'spe' as const, add: { spe: speed.tip.evs }, move: null }] : []),
    ...(duel.moveTip ? [{ id: 'move' as const, add: {}, move: duel.moveTip.move }] : []),
  ];
}

/** Il consiglio non peggiora le altre righe della Sfida (il tuo KO, i colpi che reggi, chi muove primo). */
function keepsOthers(id: TipId, me: TeamSet, next: TeamSet, opp: TeamSet): boolean {
  const was = duelHits(me, opp);
  const now = duelHits(next, opp);
  const mineOk = (now.mine?.hitsSure ?? Infinity) <= (was.mine?.hitsSure ?? Infinity);
  const theirsOk = (now.theirs?.hitsMaybe ?? Infinity) >= (was.theirs?.hitsMaybe ?? Infinity);
  const speedOk = speedRank(next, opp) >= speedRank(me, opp);
  if (id === 'def') return mineOk && speedOk;
  if (id === 'atk') return theirsOk && speedOk;
  return mineOk && theirsOk;
}

/**
 * I consigli della Sfida con le loro varianti: EV per reggere un colpo in più (def), per un KO con un colpo in meno (atk),
 * per superarlo in Velocità (spe), una mossa migliore (move). Per gli EV la variante scelta è quella che non peggiora le
 * altre righe, poi col voto più alto, poi con più EV rimasti; per la mossa quella col voto più alto (a pari voto lo slot vuoto).
 */
export function duelTips(team: TeamSet[], index: number, opp: TeamSet, pool: readonly string[], data: EngineData): DuelTipsResult {
  const me = team[index];
  const rate = (set: TeamSet) => rateTeam(team.map((s, i) => (i === index ? set : s)), data)?.overall ?? null;
  const skip = new Set([toID(me.species), toID(opp.species)]);
  const threats = metaThreats(data).filter(t => !skip.has(toID(t.set.species)));
  const duel = editorDuel(me, opp, pool);
  const speed = duelSpeed(me, opp);
  const tips: DuelTip[] = [];

  const evTip = (id: TipId, row: DuelTip['row'], add: EvMap) => {
    const options = evSources(me, add).filter(v => improves(id, me, v.set, opp))
      .map(v => ({ ...v, replaced: null, overall: rate(v.set), effects: metaEffects(me, v.set, threats) }));
    if (!options.length) return;
    const keeps = options.map(o => keepsOthers(id, me, o.set, opp));
    const left = (o: TipOption) => STATS.reduce((acc, stat) => acc + (o.taken[stat] ? ev(o.set.evs, stat) : 0), 0);
    let best = 0;
    options.forEach((o, i) => {
      const b = options[best];
      const better = Number(keeps[i]) - Number(keeps[best]) || (o.overall ?? -1) - (b.overall ?? -1) || left(o) - left(b);
      if (better > 0) best = i;
    });
    tips.push({ id, row, add, move: null, options, best });
  };
  if (duel.defTip) evTip('def', 'theirs', duel.defTip.add);
  if (duel.atkTip) evTip('atk', 'mine', duel.atkTip.add);
  if (speed.tip) evTip('spe', 'speed', { spe: speed.tip.evs });

  if (duel.moveTip) {
    const move = duel.moveTip.move;
    const slots = [0, 1, 2, 3].map(i => me.moves[i] ?? '');
    const options = slots.map((replaced, slot): TipOption => {
      const moves = [...slots];
      moves[slot] = move;
      const set = { ...me, moves };
      const effects = metaEffects(me, set, threats).map(fx => {
        const type = fx.kind === 'dealMore' ? getMove(move)?.type : fx.kind === 'dealLess' && replaced ? getMove(replaced)?.type : undefined;
        return type ? { ...fx, type } : fx;
      });
      return { set, taken: {}, replaced, overall: rate(set), effects };
    });
    let best = 0;
    options.forEach((o, i) => {
      const b = options[best];
      const better = (o.overall ?? -1) - (b.overall ?? -1) || Number(!o.replaced) - Number(!b.replaced);
      if (better > 0) best = i;
    });
    tips.push({ id: 'move', row: 'mine', add: {}, move, options, best });
  }
  return { overall: rate(me), tips };
}
