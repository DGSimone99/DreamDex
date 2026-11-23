import type { CoachAdvice, CoachProblem } from '../../engine/coach';
import { proposalGroups, solvedKeys } from '../../engine/coachProposals';
import { useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { gainText } from '../CoachingView';
import { Icon } from '../icons';

/**
 * I problemi che il Coaching sa risolvere: quelli che almeno una delle sue proposte risolve (tutte, la scheda le mostra
 * tutte). Li usano le pillole della testata delle aree (un pulsante solo se c'è una proposta per loro).
 */
export function solvable(problems: CoachProblem[], advice: Pick<CoachAdvice, 'fixes' | 'moves'>): CoachProblem[] {
  const keys = solvedKeys(advice);
  return problems.filter(p => keys.has(p.key));
}

/**
 * Le proposte del Coaching contate come nel Coaching: le sue righe (`proposalGroups`, le quasi uguali in una riga sola) e
 * il voto che aggiunge la migliore (il +N più alto fra le prime proposte delle righe). `best` null senza proposte.
 */
export function coachingOffer(problems: CoachProblem[], advice: Pick<CoachAdvice, 'fixes' | 'moves'>): { count: number; best: number | null } {
  const groups = proposalGroups(problems, advice);
  const gains = groups.map(g => g.options[0]?.fix.gain ?? 0);
  return { count: groups.length, best: gains.length ? Math.max(...gains) : null };
}

/**
 * In fondo alla Panoramica, una riga sola per il Coaching (la Panoramica riassume, il Coaching non si copia qui):
 * "N problemi · il Coaching ha M proposte, la migliore +X · Vai al Coaching ›". Rossa con almeno un problema grave,
 * gialla coi soli minori; con problemi ma nessuna proposta "N problemi · nessuna sostituzione singola li risolve" (porta
 * comunque al Coaching, dove c'è Migliora i set). Senza problemi "Nessun problema da sistemare", verde e ferma. Mentre i
 * consigli si calcolano (`advice` null) uno scheletro alto uguale, così la pagina non salta. N è il numero della scheda
 * Coaching (tutti i problemi).
 */
export function FixRow({ problems, advice, onView }: { problems: CoachProblem[]; advice: CoachAdvice | null; onView: (v: AnalysisView) => void }) {
  const t = useT();
  if (problems.length === 0) {
    return (
      <section className="fix-row is-clear" aria-label={t('overview.fix.title')}>
        <span className="fix-label"><Icon name="check" />{t('overview.fix.none')}</span>
      </section>
    );
  }
  if (!advice) {
    return (
      <div className="fix-row is-skeleton fill-skeleton" aria-hidden="true">
        <span className="fix-bone" style={{ width: 84 }} />
        <span className="fix-bone" style={{ width: 280 }} />
        <span className="fix-bone" style={{ width: 96, marginLeft: 'auto' }} />
      </div>
    );
  }
  const { count, best } = coachingOffer(problems, advice);
  const status = t(problems.length === 1 ? 'area.problems.one' : 'area.problems.many', { n: problems.length });
  const offer = best === null
    ? t(problems.length === 1 ? 'overview.fix.stuckOne' : 'overview.fix.stuckMany')
    : t(count === 1 ? 'overview.fix.proposalsOne' : 'overview.fix.proposalsMany', { n: count, gain: gainText(best) });
  // Il colore dice il caso: rosso con almeno un problema grave, giallo coi soli minori
  const serious = problems.some(p => p.severity === 'serious');
  // Il numero di proposte e il +N in risalto: il testo si spezza attorno a loro
  const gain = best === null ? null : gainText(best);
  const parts = gain ? offer.split(gain) : [offer];
  return (
    // Il clic sta sulla striscia; il pulsante vero è "Vai al Coaching" (tastiera e lettori: Invio e Spazio fanno un clic)
    <section className={`fix-row is-link${serious ? ' serious' : ' minor'}`} aria-label={t('overview.fix.title')} onClick={() => onView('coaching')}>
      <span className="fix-label" aria-hidden="true"><Icon name="warning" />{status}</span>
      <span className="fix-items">
        {parts[0]}{gain && <b className="fix-gain">{gain}</b>}{parts.slice(1).join(gain ?? '')}
      </span>
      <button type="button" className="fix-go dash-link" aria-label={t('area.problems.go', { what: `${status}, ${offer}` })}>
        {t('overview.fix.go')}<Icon name="next" />
      </button>
    </section>
  );
}
