import { useLayoutEffect, useRef, useState } from 'react';
import { EDITOR_TABS_QUERY, PHONE_QUERY, useMediaQuery } from './useMediaQuery';
import type { DashboardData } from '../engine/overviewDashboard';
import type { TeamSummary } from '../engine/teamSummary';
import type { TeamSet } from '../engine/sets';
import type { AnalysisView } from './analysisView';
import type { KoFocus } from './AreaDetail';
import type { BonusMalusPiece } from './BonusMalusView';
import { CoverageSection } from './dashboard/CoverageSection';
import { RolesSection } from './dashboard/RolesSection';
import { SpeedSection } from './dashboard/SpeedSection';
import { SummarySection } from './dashboard/SummarySection';

export type Density = 'tight' | 'normal' | 'roomy';

/**
 * Soglia sull'altezza del cruscotto (px CSS), misurata con la card del voto a cinque righe (6 membri):
 * 1366×768 aperto 368 (stretto) · 1440×900 aperto 471 · 1920×1080 aperto 621 · 2560×1440 aperto 694 (normale).
 * L'ampia c'è sempre col team ridotto e, col team aperto, da RICH_FROM (1920×1080 e schermi più alti).
 */
export const TIGHT_BELOW = 440;

/**
 * Altezza del cruscotto (px CSS) da cui, col team ridotto, il Riassunto diventa ricco (nomi, numeri, schede su due linee):
 * 8 righe da 68px + testata ≈ 592px. 1440×900 ridotto 701 · 1280×800 ridotto 601 (ricco); 1366×768 ridotto 573 (compatto).
 * Da RICH_TALL (2560×1440 ridotto 954) le schede crescono e riempiono la colonna più alta.
 */
export const RICH_FROM = 600;
export const RICH_TALL = 820;

/** La densità col team aperto sotto RICH_FROM: stretta o normale secondo l'altezza. */
export function densityFor(height: number): Density {
  return height < TIGHT_BELOW ? 'tight' : 'normal';
}

/**
 * La Panoramica come cruscotto che riempie lo spazio: il Riassunto in colonna a sinistra (in fondo, sempre, la riga Bonus/Malus
 * coi suoi punti); a destra la Copertura, sotto le Minacce del meta (solo col meta: senza, la Copertura prende il loro
 * posto), sotto Ruoli | Velocità.
 */
export function OverviewDashboard({ data, summary, members, team = [], grade, bonusMalus, onView, onCollapseTeam, teamCollapsed = false, density: forced }: {
  data: DashboardData;
  summary: TeamSummary;
  /** Quanti Pokémon ha il team: con uno solo la riga Tipo non c'è. */
  members: number;
  /** I set del team: la carta del Pokémon nei tooltip del Riassunto. */
  team?: TeamSet[];
  /** La lettera del voto del team (S…D): il tipo di team del Riassunto ne prende il colore. */
  grade?: string;
  /** La riga Bonus/Malus del Riassunto (netto e voci); senza, la riga non c'è. */
  bonusMalus?: { net: number; pieces: BonusMalusPiece[] };
  onView: (v: AnalysisView, sub?: string, focus?: KoFocus) => void;
  /** Team ridotto: sempre la densità ampia. */
  teamCollapsed?: boolean;
  /** Riduce il team (dal "+N" delle sinergie del Riassunto). */
  onCollapseTeam?: () => void;
  /** Solo per i test: altrimenti viene dall'altezza disponibile. */
  density?: Density;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Density>('normal');
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const box = ref.current;
    if (forced || !box || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      // Scheda nascosta (display: none) misura 0: resta l'ultima densità buona
      if (box.clientHeight > 0) {
        setMeasured(densityFor(box.clientHeight));
        setHeight(box.clientHeight);
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [forced]);
  // Ampia col team ridotto o, col team aperto, sugli schermi alti del computer (1920×1080 e su): lo spazio in più va ai contenuti
  // Telefono e tablet: il cruscotto è alto quanto il contenuto, la sua altezza non dice quanto spazio c'è
  const stacked = useMediaQuery(EDITOR_TABS_QUERY);
  const density = forced ?? (teamCollapsed || (!stacked && height >= RICH_FROM) ? 'roomy' : measured);
  // Riassunto ricco: ampio e abbastanza alto (densità imposta dai test: basta ampio)
  const rich = density === 'roomy' && (!!forced || height >= RICH_FROM);
  // Le minacce solo col meta (statistiche presenti e meta acceso)
  const threats = data.threats.available;

  // Telefono: la Panoramica è solo il Riassunto (Copertura, Ruoli e Velocità sono le loro schede, a un tocco nella barra
  // delle schede di Analisi, che ne mostra già voti e problemi)
  const phone = useMediaQuery(PHONE_QUERY);

  return (
    <div ref={ref} className={`dash ${density}${rich ? ' rich' : ''}${rich && height >= RICH_TALL ? ' tall' : ''}`} data-density={density}>
      <SummarySection summary={summary} members={members} grade={grade} density={density} rich={rich} bonusMalus={bonusMalus} onView={onView} onShowAll={teamCollapsed ? undefined : onCollapseTeam} />
      {/* Le minacce del meta sono la riga META della Copertura (la loro carta è stata tolta il 2026-11-22) */}
      {!phone && <>
        {/* Un membro solo: niente allarmi in Copertura e Ruoli (in cima l'invito ad aggiungerne un altro) */}
        <CoverageSection coverage={data.coverage} threats={threats ? data.threats : undefined} gentle={members === 1} onView={onView} />
        <RolesSection roles={data.roles} density={density} gentle={members === 1} onView={onView} />
        <SpeedSection speed={data.speed} density={density} onView={onView} />
      </>}
    </div>
  );
}
