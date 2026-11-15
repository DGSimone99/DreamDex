/**
 * Legame con la fascia del team in alto: passando sulla riga di un membro in una tabella di Analisi, la sua carta (stesso
 * posto nel team) si accende. Solo a vista, tramite una classe sulla carta: le due parti non si conoscono.
 */
export function linkTeamCard(slot: number | null) {
  document.querySelectorAll('.slot-card.is-linked').forEach(el => el.classList.remove('is-linked'));
  if (slot === null) return;
  document.querySelectorAll('.team .slot.filled > .slot-card')[slot]?.classList.add('is-linked');
}
