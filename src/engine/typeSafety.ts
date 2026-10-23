/**
 * Sicurezza di tipo del team: modulo foglia, così Difesa (defense.ts) e voto (rating.ts) la usano senza importarsi a vicenda.
 */

/** La Coverage tipi della Difesa è piena all'80% del saldo perfetto (ogni tipo resistito due volte). */
export const DEFENSE_FULL = 0.8;

/** Punti di un membro contro un tipo: immunità +2, ×¼ +1,5, ×½ +1, neutro 0, ×2 −1, ×4 −2. */
export function resistPoints(multiplier: number): number {
  if (multiplier === 0) return 2;
  if (multiplier <= 0.25) return 1.5;
  if (multiplier < 1) return 1;
  if (multiplier >= 4) return -2;
  return multiplier > 1 ? -1 : 0;
}

/** Saldo che separa un tipo scoperto (0) da uno sicuro (1); a saldo 0 il tipo vale 0,5. */
export const BALANCE_SPAN = 2;

/**
 * Quanto il team è al sicuro da un tipo, dal saldo fra resistenze e debolezze dei membri:
 * un'immunità o due resistenze lo rendono sicuro, un ×4 o due ×2 scoperti lo lasciano scoperto.
 */
export function typeSafety(multipliers: number[]): number {
  const net = multipliers.reduce((acc, m) => acc + resistPoints(m), 0);
  return Math.min(1, Math.max(0, 0.5 + net / (2 * BALANCE_SPAN)));
}
