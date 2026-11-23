import type { ReactNode } from 'react';
import { useT } from '../i18n/react';
import { hint } from './MoveTip';

/**
 * Il pulsante in fondo a una colonna che non ci sta tutta (Riassunto della Panoramica, Scheda della Meta): a vista quello
 * che manca ("+3", "+ Contro il tuo team") sopra due frecce verso il basso, al clic riduce il team così la colonna si
 * allunga e mostra il resto. `label`: cosa è nascosto, per il tooltip del browser e i lettori di schermo ("Riduci il team
 * per vedere: …"); `tipped`: il "+N" colorato col tooltip DreamDex al passaggio (`hover`), senza il tooltip del browser.
 */
export function MoreBelow({ label, onClick, tipped = false, hover, children }: {
  label: string;
  onClick: () => void;
  tipped?: boolean;
  hover?: { onMouseEnter?: (e: { currentTarget: Element }) => void; onMouseLeave?: () => void };
  children: ReactNode;
}) {
  const t = useT();
  return (
    <button type="button" className={`sum-more-below${tipped ? ' tipped' : ''}`} onClick={onClick} {...hover}
      {...(tipped ? {} : hint(label))} aria-label={t('sum.showMore', { label })}>
      <span aria-hidden="true">{children}</span>
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5 12 12l5.5-5.5M6.5 12.5 12 18l5.5-5.5" />
      </svg>
    </button>
  );
}
