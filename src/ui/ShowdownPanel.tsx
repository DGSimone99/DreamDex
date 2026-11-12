import { useState } from 'react';
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
  const [linkCopied, setLinkCopied] = useState(false);
  // Copia veloce dalla barra: il testo Showdown del team va negli appunti, la linguetta dice "Copiato" per un attimo
  const [quickCopied, setQuickCopied] = useState(false);
  const quickCopy = async () => {
    if (await copyText(exportShowdown(team, { tera }))) {
      setQuickCopied(true);
      setTimeout(() => setQuickCopied(false), 1600);
    }
  };
  const copyLink = async () => {
    if (await copyText(shareUrl(team, format))) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

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
        <summary title={t('showdown.title')}><Icon name="swap" /><span className="btn-label">{t('showdown.title')}</span></summary>
        <div>
          <textarea aria-label={t('showdown.text')} rows={12} value={text} onChange={e => setText(e.target.value)} />
          <div className="actions">
            <button type="button" onClick={doImport}>{t('showdown.import')}</button>
            <button type="button" onClick={() => { setText(exportShowdown(team, { tera })); }}>{t('showdown.export')}</button>
            <button type="button" onClick={() => copyText(text)}>{t('showdown.copy')}</button>
            <button type="button" disabled={!team.length} onClick={copyLink}>{t('showdown.copyLink')}</button>
            {linkCopied && <span className="copied" role="status">{t('showdown.linkCopied')}</span>}
          </div>
          {review && <ImportDialog review={review.review} onYes={unlock} onClose={() => setReview(null)} />}
        </div>
      </details>
      {team.length > 0 && (
        <button type="button" className={`team-action quick-copy${quickCopied ? ' copied' : ''}`} title={t('showdown.quickCopyTitle')} onClick={quickCopy}>
          <Icon name={quickCopied ? 'check' : 'copy'} />
          <span className="btn-label">{t(quickCopied ? 'showdown.quickCopied' : 'showdown.quickCopy')}</span>
          {quickCopied && <span className="visually-hidden" role="status">{t('showdown.quickCopied')}</span>}
        </button>
      )}
    </>
  );
}
