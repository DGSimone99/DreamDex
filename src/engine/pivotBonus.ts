import { battleName, battleSpecies, toID } from './dex';
import type { TeamDefense } from './defense';
import type { TeamOffense } from './offense';
import type { TeamRoles } from './rolesArea';
import type { TeamSet } from './sets';
import type { TeamSpeed } from './speedArea';
import { defensiveMultiplier, TYPES } from './types';

/**
 * Bonus "pivot rispettato" (2026-11-21, utente): una mossa pivot da sola non vale niente, vale se il team la sfrutta.
 * - Pivot lento e difensivo: regge il colpo, poi esce e fa entrare in sicurezza un attaccante fragile.
 * - Pivot veloce: esce prima del colpo, e per ogni sua debolezza di tipo c'è un compagno che entra e lo para.
 * Sul banco (National Dex OU) il pivot semplice ce l'hanno l'83% dei team da torneo e l'87% dei medi: non distingue.
 * Quello rispettato sì: 39% torneo, 24% medio, 3% brutto (misura sui colpi forti; qui il veloce guarda le debolezze vere).
 */
export const PIVOT_POINTS = 1;
/** Lento: supera da solo meno di questa quota del gruppo della Velocità (Teleport, a priorità −6, è sempre lento). */
export const PIVOT_SLOW_BELOW = 0.35;
/** Veloce: supera da solo almeno metà del gruppo. */
export const PIVOT_FAST_FROM = 0.5;
/** Difensivo: regge almeno un terzo delle minacce del meta (senza meta: dei colpi di tipo). */
export const PIVOT_STURDY = { meta: 33, types: 43 };
/** Attaccante fragile: attacca forte (Offesa del membro) e regge meno di un colpo su sei del meta (senza meta: dei tipi). */
export const FRAGILE_OFFENSE = 48;
export const FRAGILE_HOLD = { meta: 17, types: 19 };

const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);

export interface PivotLink {
  kind: 'slow' | 'fast';
  /** Chi ha la mossa pivot e la mossa. */
  pivot: string;
  move: string;
  /** Lento: gli attaccanti fragili che fa entrare. Veloce: i compagni che parano le sue debolezze. */
  partners: string[];
}

export interface PivotParts {
  offense: TeamOffense;
  defense: TeamDefense;
  speed: TeamSpeed;
  roles: TeamRoles;
}

/** I legami pivot del team, prima i lenti (nell'ordine del team). Vuoto se le liste dei membri non combaciano. */
export function pivotLinks(team: TeamSet[], { offense, defense, speed, roles }: PivotParts): PivotLink[] {
  // Offesa, Difesa e Velocità hanno un membro per ogni specie riconosciuta, nell'ordine del team; i Ruoli uno per ogni set
  const known = team.map((set, index) => ({ set, index })).filter(x => !!battleSpecies(x.set));
  const n = known.length;
  if (!n || offense.members.length !== n || defense.members.length !== n || defense.typed.length !== n || speed.members.length !== n || roles.members.length !== team.length) return [];
  const members = known.map(({ set, index }, k) => {
    const def = defense.members[k];
    const usesMeta = def.metaHold !== null;
    const hold = def.metaHold ?? def.hold;
    const moves = set.moves.map(toID);
    return {
      set, k, name: battleName(set),
      move: set.moves.find(m => PIVOT_MOVES.has(toID(m))) ?? null,
      teleport: moves.includes('teleport'),
      speed: speed.members[k].raw,
      sturdy: hold >= (usesMeta ? PIVOT_STURDY.meta : PIVOT_STURDY.types),
      fragile: roles.members[index].primary === 'attack' && offense.members[k].total >= FRAGILE_OFFENSE
        && hold <= (usesMeta ? FRAGILE_HOLD.meta : FRAGILE_HOLD.types),
    };
  });
  const slow: PivotLink[] = [];
  const fast: PivotLink[] = [];
  for (const m of members) {
    if (!m.move) continue;
    const others = members.filter(x => x !== m);
    if (m.teleport || m.speed < PIVOT_SLOW_BELOW) {
      const fragile = others.filter(x => x.fragile);
      if (m.sturdy && fragile.length) slow.push({ kind: 'slow', pivot: m.name, move: m.move, partners: fragile.map(x => x.name) });
    } else if (m.speed >= PIVOT_FAST_FROM) {
      // Ogni debolezza di tipo deve avere un compagno che la para: prende meno di un terzo dei PS sul lato peggiore
      const weak = TYPES.map((type, i) => ({ type, i })).filter(({ type }) => defensiveMultiplier(type, m.set) > 1);
      const blockers = weak.map(({ i }) => others.filter(x => defense.typed[x.k].cells[i]?.band === 'four'));
      if (weak.length && blockers.every(list => list.length)) {
        fast.push({ kind: 'fast', pivot: m.name, move: m.move, partners: [...new Set(blockers.flat().map(x => x.name))] });
      }
    }
  }
  return [...slow, ...fast];
}
