import { Fragment } from 'react';
import type { CoachProblem, ProblemCategory } from '../../engine/coach';
import { needLabel, type Need } from '../../engine/needs';
import { groupProblems, type TodoGroup } from '../../engine/todoGroups';
import type { Lang, MessageKey } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon, type IconName } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Typed } from '../TypeText';
import { DashCard, DashLink } from './DashCard';
import { useFit, useShrink } from './useFit';

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

/** Il titolo di ogni gruppo. */
const TITLES: Record<Exclude<TodoGroup['kind'], 'single'>, MessageKey> = {
  weak: 'dash.todo.weak',
  threats: 'dash.todo.threats',
  illegal: 'dash.todo.illegal',
  roles: 'dash.todo.roles',
};

/** Il nome di un elemento, tradotto qui: tipi e voci dei ruoli nella lingua scelta, specie e membri come sono. */
function itemLabel(kind: TodoGroup['kind'], subject: string, lang: Lang): string {
  if (kind === 'weak') return typeName(subject, lang);
  if (kind === 'roles') return needLabel(subject as Need, lang);
  return subject;
}

/** Nella densità ampia, sotto un gruppo i testi interi dei suoi problemi (non per le minacce: direbbero solo il nome). */
const detailsOf = (group: TodoGroup): string[] => (group.kind === 'single' || group.kind === 'threats' ? [] : group.details);

/** "Tutti gli 8", "gli 11": in italiano "gli" davanti ai numeri che iniziano per vocale (otto, ottanta, undici). */
const gli = (n: number): boolean => /^8/.test(String(n)) || n === 11;

/** Una riga di Cosa fare: un gruppo ("Debole a Terra · Fuoco" col numerino) o un problema singolo col suo testo. */
function TodoRow({ group, sub }: { group: TodoGroup; sub: string[] }) {
  const t = useT();
  const lang = useLang();
  const area = AREA[group.category];
  const name = t(area.key);
  const severity = t(group.severity === 'serious' ? 'dash.serious' : 'dash.minor');
  const areaIcon = <span className="dash-area" role="img" aria-label={name} title={name}><Icon name={area.icon} /></span>;
  if (group.kind === 'single') {
    return (
      <li data-fit className={group.severity}>
        <span className="dash-sev">{severity}</span>
        <span className="dash-problem"><Typed text={group.text ?? ''} /></span>
        {areaIcon}
      </li>
    );
  }
  const title = t(TITLES[group.kind]);
  const labels = group.items.map(item => ({ ...item, label: itemLabel(group.kind, item.subject, lang) }));
  // Per i lettori di schermo tutto in una frase: "Grave. Debole a: Terra, Fuoco, Spettro. 3 problemi"
  const sentence = [
    `${t(group.severity === 'serious' ? 'dash.todo.serious' : 'dash.todo.minor')}.`,
    `${title}: ${labels.map(i => i.label).join(', ')}.`,
    group.count > 1 ? t('dash.todo.count', { n: group.count }) : '',
  ].filter(Boolean).join(' ');
  return (
    <li data-fit className={`${group.severity} dash-group`} title={group.details.join('\n')}>
      <span className="dash-sev" aria-hidden="true">{severity}</span>
      <span className="dash-problem" aria-hidden="true">
        <span className="dash-todo-title">{title}:</span>
        {group.count > 1 && <span className="dash-count">{group.count}</span>}
        {' '}
        {labels.map((item, i) => (
          <Fragment key={item.subject}>
            {i > 0 && <span className="dash-sep"> · </span>}
            <span className={`dash-todo-item${item.serious ? ' serious' : ''}`}><Typed text={item.label} /></span>
          </Fragment>
        ))}
      </span>
      <span className="visually-hidden">{sentence}</span>
      {areaIcon}
      {sub.length > 0 && (
        <ul className="dash-sub">
          {sub.map(text => <li key={text} data-fit-sub><Typed text={text} /></li>)}
        </ul>
      )}
    </li>
  );
}

/** Cosa fare: i problemi del Coaching raggruppati, dal gruppo più grave, quanti ne stanno (almeno 2), e il link a tutti. */
export function TodoSection({ problems, members, density, onView }: { problems: CoachProblem[]; members: number; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const groups = groupProblems(problems);
  const key = `${density}|${lang}|${problems.map(p => `${p.severity}${p.key}`).join()}`;
  const { ref, box, shown, measured, round } = useFit<HTMLOListElement>(key, groups.length, { min: 2 });
  // Ampio: se ci stanno tutti i gruppi, sotto ognuno i suoi dettagli finché c'è spazio (prima quelli dei gruppi in alto)
  const roomy = density === 'roomy' && measured && shown === groups.length;
  const lines = roomy ? groups.flatMap(detailsOf).length : 0;
  const allowed = useShrink(box, `${key}|${round}|${roomy}`, lines);
  let left = allowed;
  const subs = groups.map(group => {
    const take = roomy ? detailsOf(group).slice(0, Math.max(0, left)) : [];
    left -= take.length;
    return take;
  });
  // L'intestazione conta i problemi, non i gruppi
  const serious = problems.filter(p => p.severity === 'serious').length;
  const minor = problems.length - serious;
  const counts = members >= 2 && problems.length > 0 && (
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
  } else if (!problems.length) {
    body = <p className="dash-note good"><Icon name="check" />{t('summary.noProblems')}</p>;
  } else {
    body = (
      <>
        <ol ref={ref} className="dash-problems dash-fit">
          {groups.slice(0, shown).map((group, i) => <TodoRow key={group.kind === 'single' ? group.details[0] : group.kind} group={group} sub={subs[i]} />)}
        </ol>
        <button type="button" className="dash-more" onClick={() => onView('coaching')}>
          {problems.length === 1 ? t('dash.oneInCoaching') : t(gli(problems.length) ? 'dash.allInCoachingGli' : 'dash.allInCoaching', { n: problems.length })}
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
