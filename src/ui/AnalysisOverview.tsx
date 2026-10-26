import { useMemo } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { EngineData } from '../engine/data';
import { summarizeTeam } from '../engine/overviewSummary';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import { TeamTypeLine } from './CoachPanel';
import { AlertMark } from './AlertMark';
import { OverviewSummary } from './OverviewSummary';

/** La Panoramica: giudizio e tipo di team in cima, poi il riassunto in sei tessere (i problemi stanno nel Coaching). */
export function AnalysisOverview({ team, analysis, rating, coaching, data, onView, onMeta, onAdd }: {
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  coaching?: Coaching;
  data: EngineData;
  onView: (view: AnalysisView) => void;
  /** La tessera Meta apre la scheda principale Meta. */
  onMeta?: () => void;
  /** Messo da parte con la riga Membri: torna quando la riga trova posto. */
  onMember?: (index: number) => void;
}) {
  const t = useT();
  const metaMonth = data.stats?.meta?.month;
  const notes = [
    ...(rating && metaMonth ? [rating.meta ? t('rating.metaOn', { month: metaMonth }) : t('rating.metaOff')] : []),
    ...(rating?.archetype === 'stall' ? [t('rating.stall')] : []),
  ];
  const problems = coaching?.problems;
  const tiles = useMemo(() => (rating ? summarizeTeam(analysis, rating, problems ?? [], data) : null), [analysis, rating, problems, data]);
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
      {/* Una riga: giudizio, come è calcolato il voto (nel segno) e tipo di team */}
      <div className="overview-headline">
        {coaching && <strong>{coaching.verdict}</strong>}
        {notes.length > 0 && <AlertMark alerts={notes.map(text => ({ level: 'info' as const, text }))} />}
        {coaching?.teamType && <TeamTypeLine teamType={coaching.teamType} />}
      </div>
      {tiles && <OverviewSummary tiles={tiles} problems={problems ?? []} onView={onView} onMeta={onMeta} strip={team.length >= 2} />}
    </div>
  );
}
