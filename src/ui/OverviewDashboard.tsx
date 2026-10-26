import { useLayoutEffect, useRef, useState } from 'react';
import type { CoachProblem } from '../engine/coach';
import type { DashboardData } from '../engine/overviewDashboard';
import type { AnalysisView } from './analysisView';
import { CoverageSection } from './dashboard/CoverageSection';
import { RolesSection } from './dashboard/RolesSection';
import { SpeedSection } from './dashboard/SpeedSection';
import { ThreatsSection } from './dashboard/ThreatsSection';
import { TodoSection } from './dashboard/TodoSection';

export type Density = 'tight' | 'normal' | 'roomy';

/**
 * Soglie sull'altezza del cruscotto (px CSS), rimisurate con la card del voto a cinque righe (6 membri):
 * 1366×768 aperto 368 (stretto) · 1440×900 aperto 471 · 1366×768 ridotto 573 (normale) ·
 * 1920×1080 aperto 621 · 2560×1440 aperto 694 (zoom 1.25) · 1440×900 ridotto 701 · 1920×1080 ridotto 881 (ampio).
 */
export const TIGHT_BELOW = 440;
export const ROOMY_FROM = 600;

export function densityFor(height: number): Density {
  return height < TIGHT_BELOW ? 'tight' : height >= ROOMY_FROM ? 'roomy' : 'normal';
}

/** La Panoramica come cruscotto a due colonne che riempie lo spazio: più alto è, più cose mostra. */
export function OverviewDashboard({ data, problems, members, onView, onMeta, density: forced }: {
  data: DashboardData;
  problems: CoachProblem[];
  members: number;
  onView: (v: AnalysisView) => void;
  onMeta: () => void;
  /** Solo per i test: altrimenti viene dall'altezza disponibile. */
  density?: Density;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Density>('normal');
  useLayoutEffect(() => {
    const box = ref.current;
    if (forced || !box || typeof ResizeObserver === 'undefined') return;
    const apply = () => setMeasured(densityFor(box.clientHeight));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [forced]);
  const density = forced ?? measured;
  return (
    <div ref={ref} className={`dash ${density}`} data-density={density}>
      <div className="dash-col dash-left">
        <CoverageSection coverage={data.coverage} onView={onView} />
        <div className="dash-pair">
          <RolesSection roles={data.roles} density={density} onView={onView} />
          <SpeedSection speed={data.speed} density={density} onView={onView} />
        </div>
      </div>
      <div className="dash-col dash-right">
        <TodoSection problems={problems} members={members} density={density} onView={onView} />
        <ThreatsSection threats={data.threats} density={density} onMeta={onMeta} />
      </div>
    </div>
  );
}
