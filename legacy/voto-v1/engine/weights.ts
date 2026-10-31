/** Pesi delle componenti del punteggio. Somma = 1. Da tarare provando team reali. */
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
