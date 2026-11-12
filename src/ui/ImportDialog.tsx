import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ModalLock } from './ModalLock';
import { Icon } from './icons';
import type { ImportReview } from './importReview';
import { useT } from '../i18n/react';

/**
 * Esito di un import Showdown che va detto (stesso stile della finestra di conferma):
 * - problemi che lo fermano: l'elenco e OK (non si è importato niente);
 * - mosse/abilità non imparabili o non trovate: l'elenco per Pokémon e la domanda sul Custom Skillset (Sì / No);
 * - strumenti, Tera o nature non trovati: solo da sapere, con OK.
 * Esc, la × o un clic fuori valgono come No / OK.
 */
export function ImportDialog({ review, onYes, onClose }: {
  review: ImportReview;
  /** Sì alla domanda sul Custom Skillset */
  onYes: () => void;
  /** OK, No o chiusura */
  onClose: () => void;
}) {
  const t = useT();
  const id = useId();
  const ok = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const blocked = review.blocking.length > 0;
  const ask = !blocked && review.skill.length > 0;
  const title = blocked ? 'import.blockedTitle' : ask ? 'import.skillTitle' : 'import.infoTitle';
  const list = (items: string[]) => <ul className="import-list">{items.map((text, i) => <li key={i}>{text}</li>)}</ul>;
  return createPortal(
    // Tasti e clic restano qui: nell'albero React la finestra sta dentro il team, e un Esc chiuderebbe anche l'editor
    <div className="help-backdrop" onClick={e => { e.stopPropagation(); onClose(); }} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
      <ModalLock />
      <div className="help-dialog confirm-dialog import-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}
        onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}>{t(title)}</h3>
          <button type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div id={`${id}-text`} className="confirm-text">
          {blocked ? <>
            <p>{t('import.blockedIntro')}</p>
            {list(review.blocking)}
          </> : <>
            {ask && <>
              <p>{t('import.skillIntro')}</p>
              {list(review.skill.map(line => line.text))}
            </>}
            {review.info.length > 0 && <>
              <p>{t('import.infoIntro')}</p>
              {list(review.info)}
            </>}
            {ask && <p className="import-question">{t('import.skillQuestion')}</p>}
          </>}
        </div>
        <div className="confirm-actions">
          {ask ? <>
            <button type="button" onClick={onClose}>{t('import.no')}</button>
            <button type="button" className="apply" ref={ok} onClick={onYes}>{t('import.yes')}</button>
          </> : <button type="button" className="apply" ref={ok} onClick={onClose}>{t('import.ok')}</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
