import { Icon } from './icons';
import { hint } from './MoveTip';

/**
 * Le pagine "‹ 2/7 ›"; con una pagina sola non si mostrano (tranne con `single`). A vista il numero; il lettore di schermo sente `pageText`
 * ("Pagina 2 di 7", "Righe 11–20") a ogni cambio. Due forme:
 * - `cm` (di base): i pulsanti col bordo di Coverage meta, del Coaching e delle Liste;
 * - `step`: quelli della barra dei candidati e di Completa team.
 */
export function Pager({ page, pages, onPage, label, prev, next, pageText, look = 'cm', className, single = false }: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** Il nome della navigazione per il lettore di schermo ("Pagine delle proposte"). */
  label?: string;
  prev: string;
  next: string;
  pageText: string;
  look?: 'cm' | 'step';
  /** Classi in più sul contenitore (es. "coach-pages"). */
  className?: string;
  /** Anche con una pagina sola ("1/1"): dove le pagine hanno un posto fisso (la casella della tabella, il piede di Completa team). */
  single?: boolean;
}) {
  if (pages <= 1 && !single) return null;
  const cm = look === 'cm';
  const step = cm ? 'cm-step' : 'step';
  return (
    <nav className={`${cm ? 'cm-pages' : 'pager'}${className ? ` ${className}` : ''}`} aria-label={label}>
      <button type="button" className={step} aria-label={prev} {...hint(prev)} disabled={page === 0} onClick={() => onPage(page - 1)}>
        <Icon name="prev" />
      </button>
      {/* Detto e annunciato `pageText` (l'annuncio legge il testo, non l'etichetta) */}
      <span className={cm ? 'cm-at' : 'pager-count'} role="status" aria-label={pageText}>
        <span aria-hidden="true">{page + 1}/{pages}</span>
        <span className="visually-hidden">{pageText}</span>
      </span>
      <button type="button" className={step} aria-label={next} {...hint(next)} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        <Icon name="next" />
      </button>
    </nav>
  );
}
