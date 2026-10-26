import type { TeamAnalysis } from '../engine/analysis';
import { weaknessSeverity, type Coaching, type SwapPreview } from '../engine/coach';
import type { EngineData } from '../engine/data';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { useT } from '../i18n/react';
import { signed } from './AreaDetail';
import type { AnalysisView } from './analysisView';
import { AreaView } from './AreaView';
import { CoachProblems, CoachSolutions, TeamTypeLine } from './CoachPanel';
import { MemberCards } from './MemberSheet';
import { Icon } from './icons';
import { IssueCounts, PROBLEM_LABELS } from './IssueCounts';

/** I numeri chiave in una riga: ognuno porta alla scheda della sua area; sotto, come è stato calcolato il voto. */
function OverviewStats({ analysis, rating, metaMonth, onView }: { analysis: TeamAnalysis; rating: TeamRating | null; metaMonth?: string; onView: (view: AnalysisView) => void }) {
  const t = useT();
  const uncovered = analysis.weakness.map(weaknessSeverity).filter(Boolean).length;
  const hits = analysis.coverage.filter(row => row.hitters.length > 0).length;
  const essentialMissing = analysis.needs.essentialMissing.length;
  const stats: { label: string; value: string; caption: string; view: AnalysisView; bad: boolean }[] = [
    { label: t('analysis.stat.uncovered', { n: uncovered }), value: String(uncovered), caption: t('analysis.stat.uncoveredShort'), view: 'defense', bad: uncovered > 0 },
    { label: t('analysis.stat.coverage', { n: hits }), value: `${hits}/18`, caption: t('analysis.stat.coverageShort'), view: 'strength', bad: hits < 18 },
    { label: t('analysis.stat.essential', { n: essentialMissing }), value: String(essentialMissing), caption: t('analysis.stat.essentialShort'), view: 'roles', bad: essentialMissing > 0 },
  ];
  return (
    <div className="overview-stats">
      <div role="group" aria-label={t('analysis.keyNumbers')}>
        {stats.map(stat => (
          // Un numero grande e cosa conta; la freccia dice che porta alla scheda dell'area
          <button key={stat.view} type="button" className={`stat-tile ${stat.bad ? 'bad' : 'ok'}`} aria-label={stat.label} onClick={() => onView(stat.view)}>
            <b>{stat.value}</b><span>{stat.caption}</span><Icon name="next" />
          </button>
        ))}
      </div>
      {rating && metaMonth && <p className="overview-note">{rating.meta ? t('rating.metaOn', { month: metaMonth }) : t('rating.metaOff')}</p>}
      {rating?.archetype === 'stall' && <p className="overview-note">{t('rating.stall')}</p>}
    </div>
  );
}

/** Bonus e malus attivi coi punti e il netto; sotto, apribile, il catalogo completo. */
function BonusMalus({ rating }: { rating: TeamRating }) {
  const t = useT();
  const net = rating.bonus.total - rating.penalty.total;
  const title = t('coach.bonusMalus', { net: signed(net) });
  const items = [
    ...rating.penalty.items.map(item => ({ text: item.text, points: -item.points })),
    ...rating.bonus.items.map(item => ({ text: item.text, points: item.points })),
  ];
  return (
    <div className="bonus-malus" role="group" aria-label={title}>
      <h3>{title}</h3>
      {items.length > 0
        ? <ul>{items.map(item => <li key={item.text} className={item.points < 0 ? 'loss' : 'gain'}>{item.text}{item.points !== 0 && ` (${signed(item.points)})`}</li>)}</ul>
        : <p className="note">{t('coach.noBonusMalus')}</p>}
      <details>
        <summary>{t('coach.catalogue')}</summary>
        <AreaView rating={rating} area="bonusMalus" problems={[]} />
      </details>
    </div>
  );
}

/** La Panoramica: cosa fare. Numeri chiave, poi problemi e soluzioni affiancati, in fondo i membri. */
export function AnalysisOverview({ team, analysis, rating, coaching, data, preview, onReplace, onSwap, onView, onMember, onAdd }: {
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  coaching?: Coaching;
  data: EngineData;
  preview?: SwapPreview | null;
  onReplace: (index: number) => void;
  onSwap?: (index: number, set: TeamSet) => void;
  onView: (view: AnalysisView) => void;
  onMember: (index: number) => void;
}) {
  const t = useT();
  if (team.length === 0) {
    return (
      <div className="overview-empty">
        <p>{t('analysis.overviewEmpty')}</p>
        {onAdd && <button type="button" className="primary" onClick={onAdd}>{t('analysis.addFirst')}</button>}
      </div>
    );
  }
  return (
    <div className="overview">
      {/* Il giudizio e il tipo di team in testa: la prima cosa che si legge */}
      {coaching && (
        <div className="overview-headline">
          <strong>{coaching.verdict}</strong>
          {coaching.teamType && <TeamTypeLine teamType={coaching.teamType} />}
        </div>
      )}
      <OverviewStats analysis={analysis} rating={rating} metaMonth={data.stats?.meta?.month} onView={onView} />
      <div className="overview-cols">
        <section className="overview-col" aria-label={t('analysis.problems')}>
          <h3 className="overview-head">
            <span className="box-head">{t('analysis.problems')}</span>
            {coaching && (
              <span className="summary-info">
                <IssueCounts serious={coaching.problems.filter(p => p.severity === 'serious').length}
                  minor={coaching.problems.filter(p => p.severity === 'minor').length} labels={PROBLEM_LABELS} />
              </span>
            )}
          </h3>
          {coaching && <CoachProblems coaching={coaching} heading={false} />}
          {rating && <BonusMalus rating={rating} />}
        </section>
        <section className="overview-col" aria-label={t('analysis.solutions')}>
          <h3 className="overview-head"><span className="box-head">{t('analysis.solutions')}</span></h3>
          {coaching && coaching.swaps.length > 0
            ? <CoachSolutions coaching={coaching} preview={preview} onReplace={onReplace} onSwap={onSwap} />
            : <p className="note">{t('analysis.noSolutions')}</p>}
        </section>
      </div>
      <MemberCards team={team} data={data} onOpen={onMember} onAdd={onAdd} />
    </div>
  );
}
