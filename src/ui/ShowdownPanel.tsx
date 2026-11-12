import { useEffect, useRef, useState } from 'react';
import type { Format } from '../engine/format';
import { shareUrl } from '../share';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { copyText } from './clipboard';
import { ImportDialog } from './ImportDialog';
import { reviewImport, type ImportReview } from './importReview';
import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';

export function ShowdownPanel({ team, format, tera = true, onImport }: { team: TeamSet[]; format: Format; /** Tera ammesso nel formato */ tera?: boolean; onImport: (team: TeamSet[]) => void }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  // Esito dell'import da dire in una finestra: cosa lo ferma, o le mosse non imparabili (con i set già importati)
  const [review, setReview] = useState<{ review: ImportReview; sets: TeamSet[] } | null>(null);
  // Esporta: il testo Showdown o il link vanno negli appunti; sotto la linguetta un fumetto dice per un attimo cosa si è copiato
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);
  // Sotto il mouse (o col fuoco) il fumetto dice prima cosa farà il clic
  const [hint, setHint] = useState<'text' | 'link' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = async (kind: 'text' | 'link') => {
    if (!await copyText(kind === 'text' ? exportShowdown(team, { tera }) : shareUrl(team, format))) return;
    setCopied(kind);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

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
    onImport(review.sets.map((set, i) => (marked.has(i) ? { ...set, customSkillset: true } : set)));
    setReview(null);
  };

  return (
    <>
      <details className="popover">
        <summary title={t('showdown.importTitle')}><Icon name="paste" /><span className="btn-label">{t('showdown.importTab')}</span></summary>
        <div>
          <textarea aria-label={t('showdown.text')} rows={12} value={text} onChange={e => setText(e.target.value)} />
          <div className="actions">
            <button type="button" onClick={doImport}>{t('showdown.import')}</button>
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
          {copied ? <span key={copied} className="export-note done" role="status"><Icon name="check" />{t(copied === 'text' ? 'showdown.quickCopied' : 'showdown.linkCopied')}</span>
            : hint && <span key={hint} id="export-note" className="export-note">{t(hint === 'text' ? 'showdown.quickCopyTitle' : 'showdown.copyLinkTitle')}</span>}
        </div>
      )}
    </>
  );
}
