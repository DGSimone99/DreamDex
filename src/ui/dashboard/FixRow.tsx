import type { CoachProblem } from '../../engine/coach';
import { t as translate, type Lang } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';

/** Quante voci si leggono nella riga; le altre stanno nel "+N" (col testo nel tooltip). */
export const FIX_SHOWN = 2;

/**
 * Le voci della riga "Da sistemare": prima i problemi gravi (l'ordine del Coaching resta a parità), e le minacce del meta
 * che nessuno regge in una frase sola coi nomi, al posto della prima di loro.
 */
export function fixItems(problems: CoachProblem[], lang: Lang): { shown: string[]; hidden: string[]; more: number } {
  const sorted = [...problems.filter(p => p.severity === 'serious'), ...problems.filter(p => p.severity !== 'serious')];
  const threats = sorted.filter(p => p.category === 'meta' && p.subjects?.length).flatMap(p => p.subjects!);
  const items: string[] = [];
  let threatsPlaced = false;
  for (const p of sorted) {
    if (p.category === 'meta' && p.subjects?.length) {
      if (!threatsPlaced) items.push(translate(lang, 'overview.fix.threats', { list: threats.join(', ') }));
      threatsPlaced = true;
    } else items.push(p.text);
  }
  const shown = items.slice(0, FIX_SHOWN);
  const hidden = items.slice(FIX_SHOWN);
  return { shown, hidden, more: hidden.length };
}

/** In fondo alla Panoramica: cosa resta da sistemare, coi nomi, e il passaggio al Coaching. Senza problemi non c'è. */
export function FixRow({ problems, onView }: { problems: CoachProblem[]; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { shown, hidden, more } = fixItems(problems, lang);
  if (shown.length === 0) return null;
  return (
    <section className="fix-row" aria-label={t('overview.fix.title')}>
      <span className="fix-label" aria-hidden="true">{t('overview.fix.title')}</span>
      <span className="fix-items" title={[...shown, ...hidden].join(' · ')}>
        {shown.join(' · ')}
      </span>
      {more > 0 && (
        <span className="fix-more" title={hidden.join(' · ')}>
          <span aria-hidden="true">{t('overview.fix.more', { n: more })}</span>
          <span className="visually-hidden">{hidden.join(' · ')}</span>
        </span>
      )}
      <button type="button" className="fix-go dash-link" onClick={() => onView('coaching')}>
        {t('overview.fix.go')}<span aria-hidden="true"> ›</span>
      </button>
    </section>
  );
}
