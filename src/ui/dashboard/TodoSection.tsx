import type { CoachProblem, ProblemCategory } from '../../engine/coach';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon, type IconName } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Typed } from '../TypeText';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/** L'area di ogni problema come icona (il nome nel tooltip e per i lettori di schermo). */
const AREA: Record<ProblemCategory, { icon: IconName; key: MessageKey }> = {
  rules: { icon: 'gavel', key: 'coach.category.rules' },
  defense: { icon: 'shield', key: 'coach.category.defense' },
  coverage: { icon: 'sword', key: 'coach.category.coverage' },
  roles: { icon: 'gear', key: 'coach.category.roles' },
  conditions: { icon: 'cloud', key: 'coach.category.conditions' },
  redundancy: { icon: 'copy', key: 'coach.category.redundancy' },
  meta: { icon: 'globe', key: 'coach.category.meta' },
};

/** "Tutti gli 8", "gli 11": in italiano "gli" davanti ai numeri che iniziano per vocale (otto, ottanta, undici). */
const gli = (n: number): boolean => /^8/.test(String(n)) || n === 11;

/** Cosa fare: i problemi del Coaching dal più grave, quanti ne stanno (almeno 2), e il link a tutti. */
export function TodoSection({ problems, members, density, onView }: { problems: CoachProblem[]; members: number; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const sorted = [...problems].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'serious' ? -1 : 1));
  const { ref, shown } = useFit<HTMLOListElement>(`${density}|${sorted.map(p => p.key).join()}`, sorted.length, { min: 2 });
  const serious = sorted.filter(p => p.severity === 'serious').length;
  const minor = sorted.length - serious;
  const counts = members >= 2 && sorted.length > 0 && (
    <>
      {serious > 0 && <b className="bad">{t(serious === 1 ? 'summary.seriousOne' : 'summary.seriousMany', { n: serious })}</b>}
      {serious > 0 && minor > 0 && ' · '}
      {minor > 0 && t(minor === 1 ? 'summary.minorOne' : 'summary.minorMany', { n: minor })}
    </>
  );
  let body;
  if (members < 2) {
    // Senza coaching niente "nessun problema": si invita ad aggiungere, come nel Coaching
    body = <p className="dash-note">{t('coach.addTwo')}</p>;
  } else if (!sorted.length) {
    body = <p className="dash-note good"><Icon name="check" />{t('summary.noProblems')}</p>;
  } else {
    body = (
      <>
        <ol ref={ref} className="dash-problems dash-fit">
          {sorted.slice(0, shown).map(problem => {
            const area = AREA[problem.category];
            const name = t(area.key);
            return (
              <li key={problem.key} data-fit className={problem.severity}>
                <span className="dash-sev">{t(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span>
                <span className="dash-problem"><Typed text={problem.text} /></span>
                <span className="dash-area" role="img" aria-label={name} title={name}><Icon name={area.icon} /></span>
              </li>
            );
          })}
        </ol>
        <button type="button" className="dash-more" onClick={() => onView('coaching')}>
          {sorted.length === 1 ? t('dash.oneInCoaching') : t(gli(sorted.length) ? 'dash.allInCoachingGli' : 'dash.allInCoaching', { n: sorted.length })}
          <Icon name="next" />
        </button>
      </>
    );
  }
  // La freccia al Coaching c'è sempre, anche senza problemi o con meno di 2 membri
  const coaching = t('analysis.view.coaching');
  return (
    <DashCard className="dash-todo" title={t('dash.todo')} meta={counts || undefined}
      links={<DashLink area={coaching} onClick={() => onView('coaching')} />}>
      {body}
    </DashCard>
  );
}
