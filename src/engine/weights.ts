/** Pesi delle componenti per le spiegazioni (il motivo principale di un candidato). Somma = 1. */
export const WEIGHTS = {
  defense: 0.25,
  threats: 0.2,
  coverage: 0.2,
  roles: 0.15,
  synergy: 0.15,
  strength: 0.05,
} as const;

export type ComponentKey = keyof typeof WEIGHTS;
export const COMPONENT_KEYS = Object.keys(WEIGHTS) as ComponentKey[];

/**
 * Pesi del punteggio che ordina i candidati (somma 1): il Coaching prova col voto vero solo i primi 15 per membro.
 * `power` è la forza del membro (power.ts memberPower, 0–100), la stessa del malus "membro debole".
 * Tarati il 2026-11-10 (controllo 2 punto 3.12) su 41 team National Dex OU: lo scambio migliore fra i primi 100 finisce
 * nei primi 15 nel 77% dei membri (era il 57%), il migliore di tutto il team nell'85% dei team (era il 50%).
 * Coverage, sinergia e uso non aiutavano a trovarlo.
 */
export const SCORE_WEIGHTS = { defense: 0.3, threats: 0.15, roles: 0.1, power: 0.45 } as const;
