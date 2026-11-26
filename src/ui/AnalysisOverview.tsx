import { useMemo } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { Coaching, CoachAdvice } from '../engine/coach';
import type { EngineData } from '../engine/data';
import { dashboardData } from '../engine/overviewDashboard';
import { GRADES, type TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { teamSummary } from '../engine/teamSummary';
import { useLang, useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import type { KoFocus } from './AreaDetail';
import { bonusMalusLine } from './BonusMalusView';
import { OverviewDashboard } from './OverviewDashboard';
import { FixRow } from './dashboard/FixRow';

/**
 * La Panoramica, il riassunto di tutto: il cruscotto (Riassunto con la riga Bonus/Malus, Copertura, Minacce del meta,
 * Ruoli, Velocità) che riempie lo spazio e in fondo una riga sola per il Coaching (quanti problemi, quante proposte e la
 * migliore); il giudizio in cima solo con un membro.
 */
export function AnalysisOverview({ team, analysis, rating, coaching, advice = null, data, onView, onAdd, onCollapseTeam, teamCollapsed = false }: {
  /** I consigli del Coaching (null finché si calcolano): la riga Da sistemare mostra solo ciò che risolvono. */
  advice?: CoachAdvice | null;
  /** Team ridotto: il cruscotto usa la densità ampia. */
  teamCollapsed?: boolean;
  /** Riduce il team (le sinergie che non stanno nel Riassunto). */
  onCollapseTeam?: () => void;
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  coaching?: Coaching;
  data: EngineData;
  onView: (view: AnalysisView, sub?: string, focus?: KoFocus) => void;
}) {
  const t = useT();
  const lang = useLang();
  const problems = coaching?.problems;
  const dash = useMemo(() => (rating ? dashboardData(team, analysis, rating, problems ?? [], data, lang) : null), [team, analysis, rating, problems, data, lang]);
  const bonusMalus = useMemo(() => (rating ? bonusMalusLine(rating, lang) : undefined), [rating, lang]);
  // A team completo le aree deboli (C, D): il loro numero nelle testate delle card prende il colore del voto
  const weak = useMemo(() => {
    const out: Partial<Record<'strength' | 'defense' | 'speed', 'C' | 'D'>> = {};
    if (!rating || team.length < 6) return out;
    for (const area of rating.areas) {
      if ((area.key !== 'strength' && area.key !== 'defense' && area.key !== 'speed') || area.value === null || area.inactive) continue;
      const grade = GRADES.find(g => area.value! >= g.min)?.grade;
      if (grade === 'C' || grade === 'D') out[area.key] = grade;
    }
    return out;
  }, [rating, team.length]);
  const summary = useMemo(() => (rating && coaching && dash ? teamSummary(team, rating, coaching, dash, data, lang) : null), [team, rating, coaching, dash, data, lang]);
  if (team.length === 0) {
    // Team vuoto: l'invito e, sotto, le quattro carte della Panoramica vuote (tratteggiate) con cosa mostreranno
    const ghosts = [
      ['dash-summary', t('sum.title'), t('analysis.ghost.summary')],
      ['dash-coverage', t('dash.coverage'), t('analysis.ghost.coverage')],
      ['dash-roles', t('area.roles'), t('analysis.ghost.roles')],
      ['dash-speed', t('area.speed'), t('analysis.ghost.speed')],
    ] as const;
    return (
      <div className="overview overview-empty">
        <div className="overview-empty-intro">
          <p>{t('analysis.overviewEmpty')}</p>
          {onAdd && <button type="button" className="primary" onClick={onAdd}>{t('analysis.addFirst')}</button>}
        </div>
        <div className="dash ghost">
          {ghosts.map(([cls, title, text]) => (
            <section key={cls} className={`dash-card ${cls} is-ghost`} aria-label={title}>
              <div className="dash-head"><h3 className="dash-plate">{title}</h3></div>
              <p className="ghost-text">{text}</p>
            </section>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="overview">
      {/* Prima com'è fatto il team e in fondo cosa sistemare; con un membro solo, in fondo, l'invito ad aggiungerne un altro
          nella stessa striscia neutra del team incompleto */}
      {dash && summary && <OverviewDashboard data={dash} summary={summary} members={team.length} grade={rating?.grade} weak={weak} bonusMalus={team.length >= 2 ? bonusMalus : undefined} onView={onView} onCollapseTeam={onCollapseTeam} teamCollapsed={teamCollapsed} />}
      {team.length >= 2 && problems && <FixRow problems={problems} advice={advice ?? null} members={team.length} onView={onView} />}
      {team.length < 2 && coaching && (
        <section className="fix-row building overview-headline" aria-label={t('overview.fix.title')}>
          <span className="fix-label">{t('overview.fix.building', { n: team.length })}</span>
          <span className="fix-items">{coaching.verdict}</span>
        </section>
      )}
    </div>
  );
}
