import { hint as bubble } from '../MoveTip';
import { Icon } from '../icons';
import { draggedSet } from '../teamDrag';
import { useT } from '../../i18n/react';

/**
 * Slot libero: cerchio tratteggiato al posto dello sprite; il clic porta alla ricerca, col cursore già dentro.
 * Solo il primo slot libero dice "Aggiungi un Pokémon": gli altri sono cornici tratteggiate più tenui, senza scritta
 * (ma col nome per i lettori di schermo), così l'occhio va a un punto solo.
 */
export function EmptySlot({ onClick, quiet = false, dropTarget = false, onDragOver, onDrop }: {
  onClick: () => void;
  quiet?: boolean;
  /** Un candidato della lista trascinato qui sopra: al rilascio si aggiunge. */
  dropTarget?: boolean;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const tr = useT();
  // Solo i candidati della lista si posano su uno slot vuoto (i membri del team si riordinano tra loro)
  const drop = {
    onDragOver: (e: React.DragEvent) => { if (!draggedSet()) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; onDragOver(); },
    onDrop: (e: React.DragEvent) => { if (!draggedSet()) return; e.preventDefault(); onDrop(); },
  };
  const cls = `slot empty${quiet ? ' quiet' : ''}${dropTarget ? ' drop-target' : ''}`;
  if (quiet) {
    return <button type="button" className={cls} aria-label={tr('team.emptyAdd')} {...bubble(tr('team.emptyAddTitle'))} onClick={onClick} {...drop} />;
  }
  return (
    <button type="button" className={cls} {...bubble(tr('team.emptyAddTitle'))} onClick={onClick} {...drop}>
      <span className="empty-ring" aria-hidden="true"><Icon name="plus" /></span>
      <span className="empty-label">{tr('team.emptyAdd')}</span>
    </button>
  );
}
