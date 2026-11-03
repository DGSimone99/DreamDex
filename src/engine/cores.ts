import { battleName, battleSpecies } from './dex';
import type { TeamSet } from './sets';
import { defensiveMultiplier, effectiveness, TYPES } from './types';
import type { TypeName } from './types';

/** `from` para `type` per `to`: resiste ciò che colpirebbe forte `to` (nomi di battaglia). */
export interface CoreSide {
  from: string; to: string;
  /** Il tipo parato più forte (per le frecce del triangolo). */
  type: TypeName;
  /** Tutti i tipi parati, dal moltiplicatore più alto su `to`; a parità l'ordine di TYPES. */
  types: TypeName[];
}

export interface Core {
  /** 2 o 3 nomi di battaglia; nel trio l'ordine del ciclo è members[0]→[1]→[2]→[0]. */
  members: string[];
  sides: CoreSide[];
  /** Per membro, i suoi tipi (inglese) che parano almeno un tipo del core, nell'ordine dei tipi del membro. */
  names: string[][];
  strength: number;
}

/** Tipi che `covered` subisce in modo super efficace e che `cover` resiste o annulla. */
export function parries(cover: TeamSet, covered: TeamSet): TypeName[] {
  return TYPES.filter((t) => defensiveMultiplier(t, covered) > 1 && defensiveMultiplier(t, cover) < 1);
}

/** Tipi ordinati per moltiplicatore decrescente su `covered`; sort stabile, quindi a parità resta l'ordine di TYPES. */
function sortedTypes(covered: TeamSet, types: TypeName[]): TypeName[] {
  return [...types].sort((a, b) => defensiveMultiplier(b, covered) - defensiveMultiplier(a, covered));
}

interface Side { from: number; to: number; types: TypeName[]; type: TypeName; weight: number }

function makeSide(team: TeamSet[], from: number, to: number): Side {
  const types = parries(team[from], team[to]);
  let type = types[0];
  let best = 0;
  let weight = 0;
  for (const t of types) {
    const mult = defensiveMultiplier(t, team[to]);
    weight += Math.log2(mult);
    // A parità vince il primo nell'ordine di TYPES (confronto stretto).
    if (mult > best) { best = mult; type = t; }
  }
  return { from, to, types, type, weight };
}

interface Candidate { order: number[]; sides: Side[]; strength: number }

const strengthOf = (sides: Side[]) => sides.reduce((sum, s) => sum + s.weight, 0);

export function teamCores(team: TeamSet[], max = 2): Core[] {
  const present = team.map((_, i) => i).filter((i) => battleSpecies(team[i]) !== null);
  const sideCache = new Map<string, Side>();
  const side = (from: number, to: number): Side => {
    const key = `${from}>${to}`;
    let cached = sideCache.get(key);
    if (!cached) {
      cached = makeSide(team, from, to);
      sideCache.set(key, cached);
    }
    return cached;
  };

  const trios: Candidate[] = [];
  const pairs: Candidate[] = [];
  for (let a = 0; a < present.length; a++) {
    for (let b = a + 1; b < present.length; b++) {
      const i = present[a];
      const j = present[b];
      const ij = side(i, j);
      const ji = side(j, i);
      if (ij.types.length && ji.types.length) pairs.push({ order: [i, j], sides: [ij, ji], strength: strengthOf([ij, ji]) });
      for (let c = b + 1; c < present.length; c++) {
        const k = present[c];
        // Le due orientazioni del ciclo: i→j→k→i e i→k→j→i; tengo la migliore.
        let best: Candidate | null = null;
        for (const order of [[i, j, k], [i, k, j]]) {
          const sides = [side(order[0], order[1]), side(order[1], order[2]), side(order[2], order[0])];
          if (!sides.every((s) => s.types.length)) continue;
          const strength = strengthOf(sides);
          if (!best || strength > best.strength) best = { order, sides, strength };
        }
        if (best) trios.push(best);
      }
    }
  }

  // Dal più forte; a parità decidono i nomi, così il risultato non dipende dall'ordine dei membri
  const nameKey = (x: Candidate) => x.order.map((m) => battleName(team[m])).sort().join('/');
  const byStrength = (x: Candidate, y: Candidate) => y.strength - x.strength || nameKey(x).localeCompare(nameKey(y));
  trios.sort(byStrength);
  pairs.sort(byStrength);
  const chosen: Candidate[] = [];
  const used = new Set<number>();
  // Due trii senza membri in comune valgono più del trio più forte da solo: se ci sono, si prendono quelli
  // (prima il trio più forte poteva rubare un membro al secondo, e l'ordine dei membri cambiava il risultato)
  const disjoint = (x: Candidate, y: Candidate) => !x.order.some((m) => y.order.includes(m));
  let bestPair: [Candidate, Candidate] | null = null;
  if (max >= 2) {
    for (let x = 0; x < trios.length; x++) {
      for (let y = x + 1; y < trios.length; y++) {
        if (!disjoint(trios[x], trios[y])) continue;
        if (!bestPair || trios[x].strength + trios[y].strength > bestPair[0].strength + bestPair[1].strength) bestPair = [trios[x], trios[y]];
      }
    }
  }
  const order = bestPair ? [...bestPair, ...pairs] : [...trios, ...pairs];
  for (const cand of order) {
    if (chosen.length >= max) break;
    if (cand.order.some((m) => used.has(m))) continue;
    chosen.push(cand);
    cand.order.forEach((m) => used.add(m));
  }

  return chosen.map((cand) => {
    const members = cand.order.map((m) => battleName(team[m]));
    const names = cand.order.map((m) => {
      const mine = cand.sides.filter((s) => s.from === m).flatMap((s) => s.types);
      const speciesTypes: string[] = [...(battleSpecies(team[m])?.types ?? [])];
      const own = speciesTypes.filter((t) => mine.some((T) => effectiveness(T, [t]) < 1));
      // Para solo grazie all'abilità: ripiego sul tipo primario.
      return own.length ? own : speciesTypes.slice(0, 1);
    });
    return {
      members,
      sides: cand.sides.map((s) => ({ from: battleName(team[s.from]), to: battleName(team[s.to]), type: s.type, types: sortedTypes(team[s.to], s.types) })),
      names,
      strength: cand.strength,
    };
  });
}
