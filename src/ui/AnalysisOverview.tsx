import { useMemo } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { Coaching, CoachAdvice } from '../engine/coach';
import type { EngineData } from '../engine/data';
import { dashboardData } from '../engine/overviewDashboard';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { teamSummary } from '../engine/teamSummary';
import { useLang, useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import { OverviewDashboard } from './OverviewDashboard';
import { FixRow } from './dashboard/FixRow';

/** La Panoramica: il cruscotto (Riassunto, Copertura, Ruoli, Velocità) che riempie lo spazio, in fondo la riga Da sistemare; il giudizio in cima solo con un membro. */
export function AnalysisOverview({ team, analysis, rating, coaching, advice = null, data, onView, onAdd, teamCollapsed = false }: {
  /** I consigli del Coaching (null finché si calcolano): la riga Da sistemare mostra solo ciò che risolvono. */
  advice?: CoachAdvice | null;
  /** Team ridotto: il cruscotto usa la densità ampia. */
  teamCollapsed?: boolean;
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  coaching?: Coaching;
  data: EngineData;
  onView: (view: AnalysisView, sub?: string) => void;
}) {
  const t = useT();
  const lang = useLang();
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
      {/* Con un membro solo l'invito ad aggiungerne un altro; dopo, prima com'è fatto il team e in fondo cosa sistemare */}
      {team.length < 2 && coaching && <div className="overview-headline"><strong>{coaching.verdict}</strong></div>}
      {dash && summary && <OverviewDashboard data={dash} summary={summary} members={team.length} onView={onView} teamCollapsed={teamCollapsed} />}
      {team.length >= 2 && problems && <FixRow problems={problems} steps={advice?.steps ?? null} onView={onView} />}
    </div>
  );
}
