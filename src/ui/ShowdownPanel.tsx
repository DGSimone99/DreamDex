import { useEffect, useRef, useState } from 'react';
import type { Format } from '../engine/format';
import { shareUrl } from '../share';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { copyText } from './clipboard';
import { ImportDialog } from './ImportDialog';
import { reviewImport, type ImportReview } from './importReview';
import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';

export function ShowdownPanel({ team, format, tera = true, onImport, onExport }: { team: TeamSet[]; format: Format; /** Tera ammesso nel formato */ tera?: boolean; /** `again`: lo stesso import ritoccato (Custom Skillset sbloccato dopo la domanda), non un import nuovo */
  onImport: (team: TeamSet[], again?: boolean) => void;
  /** Esporta il testo per Showdown e dice "team pronto" con l'avviso (DoneToast, lo stesso del Coaching); senza, copia e basta */
  onExport?: () => Promise<boolean> }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  // Esito dell'import da dire in una finestra: cosa lo ferma, o le mosse non imparabili (con i set già importati)
  const [review, setReview] = useState<{ review: ImportReview; sets: TeamSet[] } | null>(null);
  // Esporta: il testo Showdown o il link vanno negli appunti. Il testo lo dice l'avviso "Team copiato per Showdown" col voto
  // (onExport, lo stesso del Coaching), il link un fumetto sotto la linguetta; la linguetta resta verde con la spunta un attimo
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);
  // Sotto il mouse (o col fuoco) il fumetto dice prima cosa farà il clic
  const [hint, setHint] = useState<'text' | 'link' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = async (kind: 'text' | 'link') => {
    const ok = kind === 'text' && onExport ? await onExport() : await copyText(kind === 'text' ? exportShowdown(team, { tera }) : shareUrl(team, format));
    if (!ok) return;
    setCopied(kind);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const menu = useRef<HTMLDetailsElement>(null);
  // Annulla: via il testo scritto e chiude, col fuoco di nuovo su Importa
  const cancel = () => {
    setText('');
    if (!menu.current) return;
    menu.current.open = false;
    menu.current.querySelector<HTMLElement>(':scope > summary')?.focus();
  };
  const filled = !!text.trim();
  // Annulla c'è solo a menu aperto: chiuso, il pannello non deve offrire pulsanti
  const [open, setOpen] = useState(false);

  const doImport = () => {
    const result = importShowdown(text, lang);
    const next = reviewImport(result, format, lang);
    // Un problema che lo ferma: non si importa niente, il testo resta lì da correggere
    if (!next.blocking.length) onImport(result.sets);
    if (next.blocking.length || next.skill.length || next.info.length) setReview({ review: next, sets: result.sets });
  };
  // Sì: Custom Skillset sui soli Pokémon con mosse o abilità non imparabili
  const unlock = () => {
    if (!review) return;
    const marked = new Set(review.review.skill.map(line => line.index));
    // Se il team era già entrato (niente che lo fermava), è lo stesso import: l'Annulla riporta al team di prima
    onImport(review.sets.map((set, i) => (marked.has(i) ? { ...set, customSkillset: true } : set)), !review.review.blocking.length);
    setReview(null);
  };

  return (
    <>
      <details className="popover" ref={menu} data-keep-open={filled || undefined} onToggle={e => setOpen(e.currentTarget.open)}>
        <summary title={t('showdown.importTitle')}><Icon name="paste" /><span className="btn-label">{t('showdown.importTab')}</span></summary>
        {/* Importa: una riga che dice cosa incollare, la scatola con un esempio in grigio, Importa in evidenza (spento finché
            la scatola è vuota) e Annulla, come nel pannello del testo di un membro */}
        <div className="import-panel">
          <p className="import-hint">{t('showdown.importHint')}</p>
          <textarea aria-label={t('showdown.text')} rows={8} value={text} placeholder={t('showdown.importPlaceholder')} onChange={e => setText(e.target.value)} />
          <div className="actions">
            <button type="button" className="apply" disabled={!filled} onClick={doImport}><Icon name="paste" />{t('showdown.import')}</button>
            {open && <button type="button" onClick={cancel}>{t('showdown.cancel')}</button>}
          </div>
          {review && <ImportDialog review={review.review} onYes={unlock} onClose={() => setReview(null)} />}
        </div>
      </details>
      {/* Esporta: una linguetta sola in due parti, il testo per Showdown e (dopo la barretta) il link da condividere */}
      {team.length > 0 && (
        <div className="export-wrap">
          <div className={`export-tab${copied ? ' copied' : ''}`}>
            <button type="button" className="export-main" aria-describedby={hint === 'text' && !copied ? 'export-note' : undefined} onClick={() => copy('text')}
              onPointerEnter={() => setHint('text')} onPointerLeave={() => setHint(null)} onFocus={() => setHint('text')} onBlur={() => setHint(null)}>
              <Icon name={copied === 'text' ? 'check' : 'copy'} /><span className="btn-label">{t('showdown.quickCopy')}</span>
            </button>
            <button type="button" className="export-link" aria-label={t('showdown.copyLink')} aria-describedby={hint === 'link' && !copied ? 'export-note' : undefined} onClick={() => copy('link')}
              onPointerEnter={() => setHint('link')} onPointerLeave={() => setHint(null)} onFocus={() => setHint('link')} onBlur={() => setHint(null)}>
              <Icon name={copied === 'link' ? 'check' : 'link'} />
            </button>
          </div>
          {copied && (copied === 'link' || !onExport) ? <span key={copied} className="export-note done" role="status"><Icon name="check" />{t(copied === 'text' ? 'showdown.quickCopied' : 'showdown.linkCopied')}</span>
            : copied ? null
            : hint && <span key={hint} id="export-note" className="export-note">{t(hint === 'text' ? 'showdown.quickCopyTitle' : 'showdown.copyLinkTitle')}</span>}
        </div>
      )}
    </>
  );
}
