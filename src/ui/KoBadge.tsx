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

/** La fascia di un numero di colpi per il KO (1 OHKO, 2 2HKO, 3 3HKO, da 4 4HKO+); senza colpi (nessun danno) niente. */
export const bandOfHits = (n: number): HoldBand | null =>
  (!Number.isFinite(n) || n <= 0 ? null : n <= 1 ? 'ohko' : n === 2 ? 'two' : n === 3 ? 'three' : 'four');

/**
 * I colpi per il KO come fasce (la Sfida, i suoi effetti sul meta): `fewest` col tiro migliore, `most` quelli sicuri. Se
 * cadono nella stessa fascia un badge solo, se no le due fasce attaccate con una barra ("OHKO/2HKO", un colpo o due).
 * Senza colpi (nessun danno) un trattino spento.
 */
export function KoBands({ side, fewest, most }: { side: KoSide; fewest: number; most?: number }) {
  const a = bandOfHits(fewest);
  const b = most === undefined || !Number.isFinite(most) ? a : bandOfHits(most);
  if (!a || !b) return <span className="ko-bands none">—</span>;
  if (a === b) return <span className="ko-bands"><KoBadge side={side} band={a} /></span>;
  return <span className="ko-bands"><KoBadge side={side} band={a} /><i>/</i><KoBadge side={side} band={b} /></span>;
}

/** Le stesse fasce in parole, per i lettori di schermo ("OHKO/2HKO", "—"). */
export const koBandsText = (fewest: number, most?: number): string => {
  const a = bandOfHits(fewest);
  const b = most === undefined || !Number.isFinite(most) ? a : bandOfHits(most);
  if (!a || !b) return '—';
  return a === b ? KO_TAG[a] : `${KO_TAG[a]}/${KO_TAG[b]}`;
};

export function KoBadge({ side, band, n, className = '' }: { side: KoSide; band: KoBadgeBand; n?: ReactNode; className?: string }) {
  return (
    <span className={`ko-badge ${side} ${band}${className ? ` ${className}` : ''}`}>
      <em>{KO_TAG[band]}</em>
      {n !== undefined && n !== null && <b>{n}</b>}
    </span>
  );
}
