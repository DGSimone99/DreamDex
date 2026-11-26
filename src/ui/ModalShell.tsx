import type { ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { EeveePeek } from './EeveePeek';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';

/**
 * La cornice di ogni finestra del sito, nel body: lo sfondo scuro (un clic fuori chiude), il blocco della pagina sotto
 * (ModalLock), la testata col titolo e la × di chiusura. Il contenuto va dopo la testata. Esc e il primo fuoco li decide
 * ogni finestra (cambiano da una all'altra).
 */
export function ModalShell({ className, titleId, title, heading = 'h3', closeLabel, onClose, closeRef, dialogRef, role = 'dialog', describedBy, peek = false, backdropClassName, headClassName, headExtra, contained = false, children }: {
  /** Le classi della finestra dopo `help-dialog` (es. "settings-dialog"). */
  className: string;
  titleId: string;
  title: ReactNode;
  /** Il livello del titolo: h3, h2 per le guide grandi. */
  heading?: 'h2' | 'h3';
  /** Il nome della × per i lettori di schermo. */
  closeLabel: string;
  onClose: () => void;
  closeRef?: Ref<HTMLButtonElement>;
  dialogRef?: Ref<HTMLDivElement>;
  /** `alertdialog` per le finestre che chiedono una conferma. */
  role?: 'dialog' | 'alertdialog';
  describedBy?: string;
  /** Eevee sbircia da dietro la finestra (le guide, i crediti). */
  peek?: boolean;
  backdropClassName?: string;
  headClassName?: string;
  /** Altro nella testata, tra il titolo e la ×. */
  headExtra?: ReactNode;
  /**
   * Tasti e clic restano dentro la finestra: nell'albero React la finestra può stare dentro un'altra parte (il team), e
   * un Esc o un clic arriverebbero anche lì (chiudendo l'editor).
   */
  contained?: boolean;
  children: ReactNode;
}) {
  const Heading = heading;
  const dialog = (
    <div ref={dialogRef} className={`help-dialog ${className}`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy}
      onClick={e => e.stopPropagation()}>
      <header className={`help-head${headClassName ? ` ${headClassName}` : ''}`}>
        <Heading id={titleId}>{title}</Heading>
        {headExtra}
        <button ref={closeRef} type="button" className="help-close" aria-label={closeLabel} onClick={onClose}><Icon name="close" /></button>
      </header>
      {children}
    </div>
  );
  return createPortal(
    <div className={`help-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`}
      onClick={contained ? e => { e.stopPropagation(); onClose(); } : onClose}
      onKeyDown={contained ? e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); } : undefined}>
      <ModalLock />
      {peek ? <div className="help-frame with-peek"><EeveePeek />{dialog}</div> : dialog}
    </div>,
    document.body,
  );
}
