/**
 * Il danno di un colpo come lo scrive il calcolatore di Showdown, senza decimali: la forbice dei tiri "79–93" quando il
 * motore la conosce (dal tiro più basso al più alto, anche oltre 100), se no il numero solo "79"; il "%" lo aggiunge chi
 * lo mostra. Una forbice di un numero solo ("100–100") si scrive una volta.
 */
export type DmgRange = readonly [number, number];

export function dmgText(pct: number, range?: DmgRange | null): string {
  if (!range) return String(pct);
  const [lo, hi] = range;
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
