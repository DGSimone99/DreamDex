/**
 * Punteggio 0–100 da un rapporto (1 = il riferimento: il 3° miglior attaccante dei Ruoli, tre risposte per ogni muro, ogni
 * bersaglio coperto tre volte). Lineare: chi raggiunge il riferimento prende 100, e oltre resta 100.
 */
export function softScore(ratio: number): number {
  return Math.round(100 * Math.min(1, Math.max(0, ratio)));
}
