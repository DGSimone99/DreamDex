import { useEffect, useId, useRef } from 'react';
import type { ImportReview } from './importReview';
import { useT } from '../i18n/react';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';

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
  useEffect(() => { ok.current?.focus(); }, []);
  useEscape(onClose, { stop: true });
  const blocked = review.blocking.length > 0;
  const ask = !blocked && review.skill.length > 0;
  const title = blocked ? 'import.blockedTitle' : ask ? 'import.skillTitle' : 'import.infoTitle';
  const list = (items: string[]) => <ul className="import-list">{items.map((text, i) => <li key={i}>{text}</li>)}</ul>;
  return (
    // Tasti e clic restano qui: nell'albero React la finestra sta dentro il team, e un Esc chiuderebbe anche l'editor
    <ModalShell className="confirm-dialog import-dialog" role="alertdialog" titleId={`${id}-title`} describedBy={`${id}-text`} title={t(title)}
      closeLabel={t('help.close')} onClose={onClose} contained>
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
    </ModalShell>
  );
}
