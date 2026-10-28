/**
 * Sicurezza di tipo del team: modulo foglia, così Difesa (defense.ts) e voto (rating.ts) la usano senza importarsi a vicenda.
 */

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

/** Punti di un membro contro un tipo contando solo chi: +1 se resiste o è immune, −1 se è debole, a qualunque moltiplicatore. */
export function memberPoints(multiplier: number): number {
  return multiplier < 1 ? 1 : multiplier > 1 ? -1 : 0;
}

/**
 * Saldo del team contro un tipo: metà quanto pesano resistenze e debolezze (`resistPoints`, un ×4 vale doppio),
 * metà quanti membri resistono o sono deboli (`memberPoints`). Tre che resistono contro tre deboli, uno ×4, fa −0,5.
 */
export function typeBalance(multipliers: number[]): number {
  const weighted = multipliers.reduce((acc, m) => acc + resistPoints(m), 0);
  const members = multipliers.reduce((acc, m) => acc + memberPoints(m), 0);
  return (weighted + members) / 2;
}

/**
 * Quanto il team è al sicuro da un tipo, dal saldo (`typeBalance`): +2 lo rende sicuro (100%), 0 vale 50%, −2 lo lascia
 * scoperto (0%). La stessa misura decide i tipi in difetto: sotto il 50% sono un problema (`pressure` in `weaknessTable`).
 */
export function typeSafety(multipliers: number[]): number {
  return Math.min(1, Math.max(0, 0.5 + typeBalance(multipliers) / (2 * BALANCE_SPAN)));
}
