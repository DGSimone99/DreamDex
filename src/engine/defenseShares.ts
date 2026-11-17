import { DEFENSE_DEPTH, DEFENSE_SHARES, DEFENSE_SHARES_NO_META, holdCredit, type TeamDefense } from './defense';
import { depthShares } from './offense';

/** Il credito di un membro su una minaccia del meta, come nella Coverage meta: sotto metà PS pieno, sotto il KO a metà. */
const metaCredit = (pct: number) => (pct < 50 ? 1 : pct < 100 ? 0.5 : 0);

/** Arrotonda tenendo la somma uguale a `total` (resti più grandi prima); i valori possono essere negativi. */
function roundSigned(raw: number[], total: number): number[] {
  const floors = raw.map(Math.floor);
  let missing = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((x, k) => ({ k, rest: x - Math.floor(x) })).sort((a, b) => b.rest - a.rest);
  const out = [...floors];
  for (let n = 0; missing !== 0 && n < 10 * raw.length; n++) {
    const k = order[n % raw.length].k;
    if (missing > 0) { out[k]++; missing--; } else { out[k]--; missing++; }
  }
  return out;
}

/** Quanto porta un membro alla Difesa del team, e da dove: i tre pezzi sommati fanno `points`. */
export interface DefenseShare {
  points: number;
  /** Dalla Coverage tipi e dalla Coverage meta (meta 0 senza meta). */
  types: number;
  meta: number;
  /** Dal Recupero: sotto zero se perde più di quanto recupera. */
  sustain: number;
}

/**
 * Quanto porta ogni membro alla Difesa del team (ordine di `defense.members`), come il "+N" dell'Offesa: i punti sommati
 * fanno la Difesa del team. Coverage tipi e meta: per ogni colpo (36 di tipo, le minacce pesate per uso) la parte del
 * membro nella profondità 70/20/10, riportata al valore della sottoscheda; Recupero: la sua quota della media
 * (sotto zero se perde, allora toglie). Poi i pesi della Difesa (40/40/20, senza meta 80/20).
 */
export function defenseShares(defense: TeamDefense): DefenseShare[] {
  const n = defense.members.length;
  if (!n) return [];
  const columns = 2 * (defense.typed[0]?.cells.length ?? 0);
  // Coverage tipi: i 36 colpi (fisico e speciale di ogni tipo)
  const typePart = Array.from({ length: n }, () => 0);
  for (let c = 0; c < columns; c++) {
    const credits = defense.typed.map(t => {
      const cell = t.cells[c >> 1];
      return holdCredit((c % 2 ? cell.special : cell.physical) / 100);
    });
    depthShares(credits, DEFENSE_DEPTH).forEach((x, k) => { typePart[k] += x / columns; });
  }
  // Coverage meta: le minacce pesate per uso
  const rows = defense.coverageMeta?.rows ?? [];
  const metaPart = Array.from({ length: n }, () => 0);
  for (const row of rows) {
    const credits = defense.members.map((_, m) => metaCredit(row.hits?.[m]?.pct ?? 100));
    depthShares(credits, DEFENSE_DEPTH).forEach((x, k) => { metaPart[k] += row.weight * x; });
  }
  // Ogni parte riportata al valore della sua sottoscheda (che passa per softScore), così le parti sommate tornano
  const scaled = (part: number[], value: number) => {
    const sum = part.reduce((a, b) => a + b, 0);
    return part.map(x => (sum > 0 ? (x / sum) * value : value / n));
  };
  const shares = defense.coverageMeta ? DEFENSE_SHARES : { ...DEFENSE_SHARES_NO_META, meta: 0 };
  const types = scaled(typePart, defense.coverageTypes.value).map(x => shares.types * x);
  const meta = defense.coverageMeta ? scaled(metaPart, defense.coverageMeta.value).map(x => shares.meta * x) : types.map(() => 0);
  const sustain = defense.members.map(m => (shares.sustain * m.sustain) / n);
  const points = roundSigned(defense.members.map((_, k) => types[k] + meta[k] + sustain[k]), defense.value);
  // I pezzi arrotondati: il Recupero e i tipi per conto loro, il meta quello che resta (così sommano a `points`)
  return points.map((p, k) => {
    const sus = Math.round(sustain[k]);
    const ty = Math.round(types[k]);
    return { points: p, types: ty, meta: p - sus - ty, sustain: sus };
  });
}
