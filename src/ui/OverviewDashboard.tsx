import { useLayoutEffect, useRef, useState } from 'react';
import type { DashboardData } from '../engine/overviewDashboard';
import type { TeamSummary } from '../engine/teamSummary';
import type { AnalysisView } from './analysisView';
import { CoverageSection } from './dashboard/CoverageSection';
import { RolesSection } from './dashboard/RolesSection';
import { SpeedSection } from './dashboard/SpeedSection';
import { SummarySection } from './dashboard/SummarySection';

export type Density = 'tight' | 'normal' | 'roomy';

/**
 * Soglia sull'altezza del cruscotto (px CSS), misurata con la card del voto a cinque righe (6 membri):
 * 1366×768 aperto 368 (stretto) · 1440×900 aperto 471 · 1920×1080 aperto 621 · 2560×1440 aperto 694 (normale).
 * L'ampia non dipende dall'altezza: c'è solo col team ridotto, a ogni risoluzione.
 */
export const TIGHT_BELOW = 440;

/** La densità col team aperto: stretta o normale secondo l'altezza, mai ampia. */
export function densityFor(height: number): Density {
  return height < TIGHT_BELOW ? 'tight' : 'normal';
}

/** La Panoramica come cruscotto a due righe che riempie lo spazio: Riassunto | Copertura, poi Ruoli | Velocità. */
export function OverviewDashboard({ data, summary, members, onView, teamCollapsed = false, density: forced }: {
  data: DashboardData;
  summary: TeamSummary;
  /** Quanti Pokémon ha il team: con uno solo la riga Tipo non c'è. */
  members: number;
  onView: (v: AnalysisView) => void;
  /** Team ridotto: sempre la densità ampia. */
  teamCollapsed?: boolean;
  /** Solo per i test: altrimenti viene dall'altezza disponibile. */
  density?: Density;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Density>('normal');
  useLayoutEffect(() => {
    const box = ref.current;
    if (forced || !box || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      // Scheda nascosta (display: none) misura 0: resta l'ultima densità buona
      if (box.clientHeight > 0) setMeasured(densityFor(box.clientHeight));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [forced]);
  const density = forced ?? (teamCollapsed ? 'roomy' : measured);
  return (
    <div ref={ref} className={`dash ${density}`} data-density={density}>
      <SummarySection summary={summary} members={members} onView={onView} />
      <CoverageSection coverage={data.coverage} onView={onView} />
      <RolesSection roles={data.roles} density={density} onView={onView} />
      <SpeedSection speed={data.speed} density={density} onView={onView} />
    </div>
  );
}
