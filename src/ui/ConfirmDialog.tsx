import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ModalLock } from './ModalLock';
import { Icon } from './icons';
import { useT } from '../i18n/react';

/**
 * Finestra di conferma per un'azione che cambia molte cose insieme (es. Preset migliori su tutto il team):
 * titolo, una frase che dice cosa succede, Annulla e il pulsante dell'azione. Esc, Annulla o un clic fuori chiudono
 * senza fare niente; il focus parte dal pulsante dell'azione.
 */
export function ConfirmDialog({ title, text, confirm, onConfirm, onCancel }: {
  title: string;
  text: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const id = useId();
  const ok = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="help-backdrop" onClick={onCancel}>
      <ModalLock />
      <div className="help-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}
        onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}>{title}</h3>
          <button type="button" className="help-close" aria-label={t('help.close')} onClick={onCancel}><Icon name="close" /></button>
        </header>
        <p id={`${id}-text`} className="confirm-text">{text}</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button type="button" className="apply" ref={ok} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
