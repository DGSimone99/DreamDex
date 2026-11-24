import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';

/**
 * Il foglio che sale dal basso sul telefono (Offesa, Difesa): il dettaglio di una carta o di una tessera senza lasciare la
 * scheda. È una finestra modale (la pagina sotto inerte, Esc o un tocco fuori la chiude, il fuoco torna alla carta): in
 * testa `lead` (la sprite o il tipo), il titolo, una riga sotto e la ×; poi il contenuto, che scorre se è lungo.
 */
export function AnalysisSheet({ title, sub, lead, onClose, className = '', children }: {
  title: string; sub?: ReactNode; lead?: ReactNode; onClose: () => void; className?: string; children: ReactNode;
}) {
  const t = useT();
  const id = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close.current(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="help-backdrop an-sheet-back" onClick={onClose}>
      <ModalLock />
      <section className={`help-dialog an-sheet${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        onClick={e => e.stopPropagation()}>
        <span className="an-sheet-grab" aria-hidden="true" />
        <header className="an-sheet-head">
          {lead && <span className="an-sheet-lead" aria-hidden="true">{lead}</span>}
          <span className="an-sheet-titles">
            <h3 id={`${id}-title`}>{title}</h3>
            {sub && <span className="an-sheet-sub">{sub}</span>}
          </span>
          <button ref={closeButton} type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="an-sheet-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
