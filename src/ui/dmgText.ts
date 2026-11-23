/**
 * Il danno di un colpo come lo scrive il calcolatore di Showdown, senza decimali: la forbice dei tiri "79–93" quando il
 * motore la conosce (dal tiro più basso al più alto, anche oltre 100) ed è il colpo vero della riga; se no il numero è una
 * stima (una media pesata: il meteo di un compagno contato a metà, setup o Tera per una parte della partita, la
 * precisione sotto 100, Multiscale, lo sconto di Fascia/Lenti…) e si scrive "≈79", così non si legge come un colpo
 * esatto accanto alle forbici. Il "%" lo aggiunge chi lo mostra. Una forbice di un numero solo ("100–100") si scrive una
 * volta, senza "≈" (è esatta).
 */
export type DmgRange = readonly [number, number];

/** Il segno della stima davanti a un danno senza forbice. */
export const DMG_EST = '≈';

export function dmgText(pct: number, range?: DmgRange | null): string {
  if (!range) return `${DMG_EST}${pct}`;
  const [lo, hi] = range;
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
