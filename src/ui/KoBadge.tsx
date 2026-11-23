import type { ReactNode } from 'react';
import type { HoldBand } from '../engine/defense';

/**
 * La fascia dei colpi (OHKO, 2HKO, 3HKO, 4HKO+; "3HKO+" per 3HKO e 4HKO+ insieme) come badge, la stessa in ogni tooltip
 * (vedi DESIGN.md, "Tooltips"): un colore fisso per fascia, quello delle tessere della Generale e delle caselle di
 * Coverage del suo lato. `off` (Offesa, colpisci tu): OHKO verde pieno, 2HKO verde chiaro, 3HKO giallo, 4HKO+ grigio;
 * `def` (Difesa, colpiscono te): OHKO rosso, 2HKO giallo, 3HKO verde chiaro, 4HKO+ e 3HKO+ verde. Il nome della fascia
 * sempre intero (mai solo "KO"); `n` un numero dopo il nome (il conto della fascia, "OHKO 14"). Testo in Text su ogni
 * fondo (almeno 4,5:1).
 */
export type KoSide = 'off' | 'def';
export type KoBadgeBand = HoldBand | 'held';

export const KO_TAG: Record<KoBadgeBand, string> = { ohko: 'OHKO', two: '2HKO', three: '3HKO', four: '4HKO+', held: '3HKO+' };

export function KoBadge({ side, band, n, className = '' }: { side: KoSide; band: KoBadgeBand; n?: ReactNode; className?: string }) {
  return (
    <span className={`ko-badge ${side} ${band}${className ? ` ${className}` : ''}`}>
      <em>{KO_TAG[band]}</em>
      {n !== undefined && n !== null && <b>{n}</b>}
    </span>
  );
}
