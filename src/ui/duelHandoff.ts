/**
 * Il passaggio di mano della Sfida: "Lascialo a Kingambit" apre l'editor di quel membro con lo stesso avversario. La Sfida
 * del nuovo membro nasce subito dopo e lo prende da qui (una volta sola).
 */
let pending: { owner: string; opponent: string } | null = null;

export function handOffOpponent(owner: string, opponent: string): void {
  pending = { owner, opponent };
}

/** L'avversario lasciato per questo membro, se c'è (e lo si consuma). */
export function takeOpponent(owner: string): string | null {
  if (!pending || pending.owner !== owner) return null;
  const { opponent } = pending;
  pending = null;
  return opponent;
}
