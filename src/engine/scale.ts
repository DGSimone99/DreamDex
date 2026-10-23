/** Fino al ginocchio la scala delle sottostatistiche dell'Offesa è lineare (0,5 → 50). */
export const SCALE_KNEE = 0.8;

/**
 * Punteggio 0–99 da un rapporto (1 = il riferimento: il 3° miglior attaccante, tre risposte per ogni muro, ogni bersaglio
 * coperto tre volte). Lineare fino a 80, poi a rendimenti decrescenti verso 100 senza toccarlo: un punto in più conta
 * sempre meno quando si è già in alto, e il 100 resta un limite teorico.
 */
export function softScore(ratio: number): number {
  const x = Math.max(0, ratio);
  if (x <= SCALE_KNEE) return Math.round(100 * x);
  const room = 1 - SCALE_KNEE;
  const value = 100 * (SCALE_KNEE + room * (1 - Math.exp(-(x - SCALE_KNEE) / room)));
  return Math.min(99, Math.round(value));
}
