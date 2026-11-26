import { useEffect, useId, useRef } from 'react';
import { useT } from '../i18n/react';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';

/**
 * Finestra di conferma per un'azione che cambia molte cose insieme (es. Migliora i set su tutto il team):
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
  useEffect(() => { ok.current?.focus(); }, []);
  useEscape(onCancel);
  return (
    <ModalShell className="confirm-dialog" role="alertdialog" titleId={`${id}-title`} describedBy={`${id}-text`} title={title}
      closeLabel={t('help.close')} onClose={onCancel}>
        <p id={`${id}-text`} className="confirm-text">{text}</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button type="button" className="apply" ref={ok} onClick={onConfirm}>{confirm}</button>
        </div>
    </ModalShell>
  );
}
