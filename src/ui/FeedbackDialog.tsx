import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { rulesOf, type FormatChoice } from '../engine/formatChoice';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { encodeShare } from '../share';
import { EeveeMoment } from './EeveeMoment';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';

/** Dove si aprono le segnalazioni pubbliche (il repo diventa pubblico col lancio). */
export const ISSUES_URL = 'https://github.com/DGSimone99/DreamDex/issues/new';
const ENDPOINT = 'https://api.web3forms.com/submit';
const KINDS = ['bug', 'grade', 'idea', 'other'] as const;
type Kind = (typeof KINDS)[number];
type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Segnala o suggerisci: tipo, messaggio, email facoltativa per la risposta e, se vuoi, il team (link condiviso, formato
 * e versione). Parte con Web3Forms, così l'indirizzo di chi riceve non si vede mai; senza la chiave del servizio, o se
 * l'invio non va, resta la strada di GitHub.
 */
export function FeedbackDialog({ team, choice, onClose, accessKey = import.meta.env.VITE_WEB3FORMS_KEY, send = fetch }: {
  team: TeamSet[];
  choice: FormatChoice;
  onClose: () => void;
  /** Chiave di Web3Forms (di solito dalla build; i test la passano). */
  accessKey?: string;
  send?: typeof fetch;
}) {
  const t = useT();
  const lang = useLang();
  const titleId = useId();
  const first = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [attach, setAttach] = useState(team.length > 0);
  const [status, setStatus] = useState<Status>('idle');
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessKey || !message.trim() || status === 'sending') return;
    setStatus('sending');
    const link = attach && team.length ? `${location.origin}${location.pathname}#team=${encodeShare(team, choice)}` : '';
    try {
      const response = await send(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: accessKey,
          subject: `DreamDex · ${t(`feedback.kind.${kind}`)}`,
          from_name: 'DreamDex',
          ...(email.trim() && { email: email.trim() }),
          tipo: kind,
          messaggio: message.trim(),
          ...(link && { team: link, formato: rulesOf(choice).formatId }),
          versione: __APP_VERSION__,
          lingua: lang,
          botcheck: false,
        }),
      });
      const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
      setStatus(response.ok && result?.success !== false ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const github = <a href={ISSUES_URL} target="_blank" rel="noreferrer">{t('feedback.github')}</a>;
  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <ModalLock />
      <div className="help-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={titleId}>{t('feedback.title')}</h3>
          <button type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        {status === 'sent' ? (
          <div className="feedback-body feedback-done" role="status">
            <EeveeMoment pose="happy" />
            <p><strong>{t('feedback.sent')}</strong></p>
            <p className="note">{t(email.trim() ? 'feedback.sentReply' : 'feedback.sentNoReply')}</p>
            <button type="button" onClick={onClose}>{t('help.close')}</button>
          </div>
        ) : !accessKey ? (
          // Senza la chiave del servizio (es. in locale) c'è solo GitHub
          <div className="feedback-body">
            <p>{t('feedback.intro')}</p>
            <p className="feedback-alt">{t('feedback.githubOnly')} {github}</p>
          </div>
        ) : (
          <form className="feedback-body" onSubmit={submit}>
            <p>{t('feedback.intro')}</p>
            <fieldset className="feedback-kinds">
              <legend>{t('feedback.kind')}</legend>
              {KINDS.map((k, i) => (
                <label key={k}>
                  <input ref={i === 0 ? first : undefined} type="radio" name="feedback-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                  <span>{t(`feedback.kind.${k}`)}</span>
                </label>
              ))}
            </fieldset>
            <label className="feedback-field">
              <span>{t('feedback.message')}</span>
              <textarea required rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder={t(`feedback.placeholder.${kind}`)} />
            </label>
            <label className="feedback-field">
              <span>{t('feedback.email')}</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('feedback.emailHint')} autoComplete="email" />
            </label>
            {team.length > 0 && (
              <label className="feedback-attach">
                <input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />
                <span>{t('feedback.attach')}</span>
              </label>
            )}
            {status === 'error' && <p className="feedback-error" role="alert">{t('feedback.error')} {github}</p>}
            <div className="feedback-actions">
              <span className="feedback-alt">{t('feedback.or')} {github}</span>
              <button type="submit" className="apply" disabled={!message.trim() || status === 'sending'}>
                {t(status === 'sending' ? 'feedback.sending' : 'feedback.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
