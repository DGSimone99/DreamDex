import type { CoachProblem } from '../../engine/coach';
import { MAX_STEPS, type CoachStep } from '../../engine/coachSteps';
import { t as translate, type Lang } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';

/** Nomi delle minacce scritti nella frase; gli altri diventano "e altri N" (tutti nel tooltip). */
export const THREAT_NAMES = 3;

/**
 * I problemi che il Coaching sa risolvere: quelli delle tappe che mostra (il problema della tappa, il suo gruppo e gli altri
 * che copre). Gli altri (es. minacce minori quando nessun cambio alza il voto) non vanno nella riga: lì non c'è consiglio.
 */
export function solvable(problems: CoachProblem[], steps: CoachStep[]): CoachProblem[] {
  const keys = new Set(steps.slice(0, MAX_STEPS).flatMap(step => [step.problem.key, ...step.group, ...step.alsoSolves]));
  return problems.filter(p => keys.has(p.key));
}

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
      if (!threatsPlaced) {
        const list = threats.slice(0, THREAT_NAMES).join(', ');
        const rest = threats.length - THREAT_NAMES;
        items.push(rest > 0 ? translate(lang, 'overview.fix.threatsMore', { list, n: rest }) : translate(lang, 'overview.fix.threats', { list }));
      }
      threatsPlaced = true;
    } else items.push(p.text);
  }
  const shown = items.slice(0, FIX_SHOWN);
  const hidden = items.slice(FIX_SHOWN);
  return { shown, hidden, more: hidden.length };
}

/**
 * In fondo alla Panoramica: cosa il Coaching sa sistemare, coi nomi, e il passaggio al Coaching. Non c'è finché i consigli
 * si calcolano (`steps` null) né quando nessun problema ha una proposta.
 */
export function FixRow({ problems, steps, onView }: { problems: CoachProblem[]; steps: CoachStep[] | null; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { shown, hidden, more } = fixItems(steps ? solvable(problems, steps) : [], lang);
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
