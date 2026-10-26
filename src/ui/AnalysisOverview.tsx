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
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { IssueCounts, PROBLEM_LABELS } from './IssueCounts';

/** I numeri chiave in una riga: ognuno porta alla scheda della sua area; sotto, come è stato calcolato il voto. */
function OverviewStats({ analysis, onView }: { analysis: TeamAnalysis; onView: (view: AnalysisView) => void }) {
  const t = useT();
  const uncovered = analysis.weakness.map(weaknessSeverity).filter(Boolean).length;
  const hits = analysis.coverage.filter(row => row.hitters.length > 0).length;
  const essentialMissing = analysis.needs.essentialMissing.length;
  const stats: { label: string; value: string; caption: string; view: AnalysisView; bad: boolean }[] = [
    { label: t('analysis.stat.uncovered', { n: uncovered }), value: String(uncovered), caption: t(uncovered === 1 ? 'analysis.stat.uncoveredShortOne' : 'analysis.stat.uncoveredShort'), view: 'defense', bad: uncovered > 0 },
    { label: t('analysis.stat.coverage', { n: hits }), value: `${hits}/18`, caption: t('analysis.stat.coverageShort'), view: 'strength', bad: hits < 18 },
    { label: t('analysis.stat.essential', { n: essentialMissing }), value: String(essentialMissing), caption: t(essentialMissing === 1 ? 'analysis.stat.essentialShortOne' : 'analysis.stat.essentialShort'), view: 'roles', bad: essentialMissing > 0 },
  ];
  return (
    <div role="group" aria-label={t('analysis.keyNumbers')} className="overview-stats">
      {stats.map(stat => (
        // Numero e cosa conta, compatti; portano alla scheda dell'area
        <button key={stat.view} type="button" className={`stat-tile ${stat.bad ? 'bad' : 'ok'}`} aria-label={stat.label} onClick={() => onView(stat.view)}>
          <b>{stat.value}</b><span>{stat.caption}</span>
        </button>
      ))}
    </div>
  );
}

/** Bonus e malus attivi coi punti e il netto; sotto, apribile, il catalogo completo. */
function BonusMalus({ rating }: { rating: TeamRating }) {
  const t = useT();
  const net = rating.bonus.total - rating.penalty.total;
  const title = t('coach.bonusMalus', { net: signed(net) });
  const items = [
    ...rating.penalty.items.map(item => ({ key: `m${item.text}`, text: item.text, points: -item.points })),
    ...rating.bonus.items.map(item => ({ key: `b${item.text}`, text: item.text, points: item.points })),
  ];
  return (
    <div className="bonus-malus" role="group" aria-label={title}>
      <h3>{title}</h3>
      {items.length > 0
        ? <ul>{items.map(item => <li key={item.key} className={item.points < 0 ? 'loss' : 'gain'}><Typed text={item.text} />{item.points !== 0 && ` (${signed(item.points)})`}</li>)}</ul>
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
  const metaMonth = data.stats?.meta?.month;
  const notes = [
    ...(rating && metaMonth ? [rating.meta ? t('rating.metaOn', { month: metaMonth }) : t('rating.metaOff')] : []),
    ...(rating?.archetype === 'stall' ? [t('rating.stall')] : []),
  ];
  // Senza cambi da proporre la colonna Soluzioni non c'è: i Problemi prendono tutta la larghezza
  const solutions = !!coaching && coaching.swaps.length > 0;
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
      {/* Una riga: giudizio, tipo di team, come è calcolato il voto (nel segno), e i numeri chiave a destra */}
      <div className="overview-headline">
        {coaching && <strong>{coaching.verdict}</strong>}
        {notes.length > 0 && <AlertMark alerts={notes.map(text => ({ level: 'info' as const, text }))} />}
        {coaching?.teamType && <TeamTypeLine teamType={coaching.teamType} />}
      </div>
      <div className={`overview-cols${solutions ? '' : ' single'}`}>
        <section className="overview-col" aria-label={t('analysis.problems')}>
          <h3 className="overview-head">
            <span className="box-head">{t('analysis.problems')}</span>
            {coaching && (
              <span className="summary-info">
                {!solutions && <span className="no-solutions">{t('analysis.noSolutions')}</span>}
                <IssueCounts serious={coaching.problems.filter(p => p.severity === 'serious').length}
                  minor={coaching.problems.filter(p => p.severity === 'minor').length} labels={PROBLEM_LABELS} />
              </span>
            )}
          </h3>
          {/* I numeri chiave come riga di utilità in cima al Coaching; sotto, a tutta larghezza, il contenuto su due colonne */}
          <OverviewStats analysis={analysis} onView={onView} />
          <div className="coach-body">
            {coaching && <CoachProblems coaching={coaching} heading={false} />}
            {rating && <BonusMalus rating={rating} />}
          </div>
        </section>
        {solutions && coaching && (
          <section className="overview-col" aria-label={t('analysis.solutions')}>
            <h3 className="overview-head"><span className="box-head">{t('analysis.solutions')}</span></h3>
            <CoachSolutions coaching={coaching} preview={preview} onReplace={onReplace} onSwap={onSwap} />
          </section>
        )}
      </div>
      <MemberCards team={team} data={data} onOpen={onMember} onAdd={onAdd} />
    </div>
  );
}
