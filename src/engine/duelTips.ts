import type { StatID } from '@pkmn/dex';
import { duelHits } from './editorDuel';
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
