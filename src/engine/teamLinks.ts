import { battleName, getMove, toID } from './dex';
import { PIVOT_MOVES } from './roles';
import type { TeamSet } from './sets';

/** Mosse che mettono hazard sul campo avversario (per il legame hazard + phazer). */
export const HAZARD_MOVES = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'];

export type LinkKind = 'pivot' | 'batonpass' | 'wish' | 'phazer';

/** Un legame di squadra: `from` fa la mossa, `to` ne approfitta (nomi di battaglia); `move` è il nome inglese della mossa principale. */
export interface TeamLink { kind: LinkKind; from: string[]; to: string[]; move: string }

const BATON_MOVES = ['batonpass', 'shedtail'];
/** Mosse che forzano il cambio (Haze e Clear Smog no: non fanno uscire nessuno). */
const FORCE_SWITCH = ['roar', 'whirlwind', 'dragontail', 'circlethrow'];

interface Member { name: string; ids: string[]; moves: string[] }

/** Prima mossa del membro tra quelle date, col suo nome inglese. */
function firstMove(m: Member, pool: Iterable<string>): { id: string; name: string } | null {
  const set = new Set(pool);
  const i = m.ids.findIndex(id => set.has(id));
  if (i < 0) return null;
  return { id: m.ids[i], name: getMove(m.moves[i])?.name ?? m.moves[i] };
}

/** Legami del team: ciclo di pivot, Baton Pass/Shed Tail, Wish, hazard + phazer; ordine fisso. */
export function teamLinks(team: TeamSet[], attackers: string[]): TeamLink[] {
  const members: Member[] = team
    .filter(set => set.species)
    .map(set => ({ name: battleName(set), ids: set.moves.map(toID), moves: set.moves }));
  const links: TeamLink[] = [];

  // Pivot: almeno due membri; la mossa è quella più usata (a pari merito, la prima del team)
  const pivots = members.filter(m => firstMove(m, PIVOT_MOVES));
  if (pivots.length >= 2) {
    // ogni mossa pivot di ogni membro conta una volta; a pari merito vince la prima incontrata
    const counts = new Map<string, { n: number; name: string }>();
    for (const m of pivots) {
      m.ids.forEach((id, i) => {
        if (!PIVOT_MOVES.has(id) || m.ids.indexOf(id) !== i) return;
        const c = counts.get(id) ?? { n: 0, name: getMove(m.moves[i])?.name ?? m.moves[i] };
        c.n++;
        counts.set(id, c);
      });
    }
    let best: { n: number; name: string } | null = null;
    for (const c of counts.values()) if (!best || c.n > best.n) best = c;
    const names = pivots.map(m => m.name);
    const target = attackers.find(a => !names.includes(a));
    links.push({ kind: 'pivot', from: names, to: target ? [target] : [], move: best!.name });
  }

  // Baton Pass / Shed Tail: ogni membro che la usa passa al primo attaccante diverso da sé
  for (const m of members) {
    const mv = firstMove(m, BATON_MOVES);
    if (!mv) continue;
    const target = attackers.find(a => a !== m.name);
    links.push({ kind: 'batonpass', from: [m.name], to: target ? [target] : [], move: mv.name });
  }

  for (const m of members) {
    const mv = firstMove(m, ['wish']);
    if (mv) links.push({ kind: 'wish', from: [m.name], to: [], move: mv.name });
  }

  // Hazard + phazer: servono due membri diversi
  for (const phazer of members) {
    const mv = firstMove(phazer, FORCE_SWITCH);
    if (!mv) continue;
    const setter = members.find(m => m !== phazer && firstMove(m, HAZARD_MOVES));
    if (!setter) continue;
    links.push({ kind: 'phazer', from: [setter.name], to: [phazer.name], move: mv.name });
    break;
  }

  return links;
}
