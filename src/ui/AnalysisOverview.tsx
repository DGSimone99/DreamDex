import { useMemo } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { EngineData } from '../engine/data';
import { dashboardData } from '../engine/overviewDashboard';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { teamSummary } from '../engine/teamSummary';
import { useLang, useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import { AlertMark } from './AlertMark';
import { OverviewDashboard } from './OverviewDashboard';

/** La Panoramica: il giudizio in cima, poi il cruscotto (Riassunto, Copertura, Ruoli, Velocità) che riempie lo spazio. */
export function AnalysisOverview({ team, analysis, rating, coaching, data, onView, onAdd, teamCollapsed = false }: {
  /** Team ridotto: il cruscotto usa la densità ampia. */
  teamCollapsed?: boolean;
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  coaching?: Coaching;
  data: EngineData;
  onView: (view: AnalysisView) => void;
  /** Messo da parte con la riga Membri: torna quando la riga trova posto. */
  onMember?: (index: number) => void;
}) {
  const t = useT();
  const lang = useLang();
  const metaMonth = data.stats?.meta?.month;
  const notes = [
    ...(rating && metaMonth ? [rating.meta ? t('rating.metaOn', { month: metaMonth }) : t('rating.metaOff')] : []),
    ...(rating?.archetype === 'stall' ? [t('rating.stall')] : []),
  ];
  const problems = coaching?.problems;
  const dash = useMemo(() => (rating ? dashboardData(team, analysis, rating, problems ?? [], data, lang) : null), [team, analysis, rating, problems, data, lang]);
  const summary = useMemo(() => (rating && coaching && dash ? teamSummary(team, rating, coaching, dash, data, lang) : null), [team, rating, coaching, dash, data, lang]);
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
      {/* Una riga: giudizio e come è calcolato il voto (nel segno); il tipo di team è nel Riassunto */}
      <div className="overview-headline">
        {coaching && <strong>{coaching.verdict}</strong>}
        {notes.length > 0 && <AlertMark alerts={notes.map(text => ({ level: 'info' as const, text }))} />}
      </div>
      {dash && summary && <OverviewDashboard data={dash} summary={summary} onView={onView} teamCollapsed={teamCollapsed} />}
    </div>
  );
}
