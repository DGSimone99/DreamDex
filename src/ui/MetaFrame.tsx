import { useState, type ReactNode } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { useMediaQuery } from './useMediaQuery';

/** Pokémon del meta per pagina: le colonne della tabella (8 sul computer largo e sul telefono, dove la tabella è girata). */
export const META_PAGE = 8;
/** Sul computer stretto (1100–1279 px) 6 per pagina, così le caselle restano larghe; più pagine. (Sul tablet la tabella è girata.) */
export const META_PAGE_NARROW = 6;
export const META_NARROW_QUERY = '(min-width: 1100px) and (max-width: 1279px)';

/** Pastiglia con il conteggio di un gruppo (grigia a zero), come nella barra di Coverage meta. */
export function MetaCount({ n, tone, label }: { n: number; tone: 'good' | 'warn' | 'bad'; label: string }) {
  return <span className={`ct-pill ${n ? tone : 'zero'}`}>{n} {label}</span>;
}

/** Le etichette della navigazione tra le pagine: minacce per la Difesa, bersagli per l'Offesa. */
export type MetaLabels = { pages: string; prev: string; next: string; page: (from: number, to: number) => string };

/**
 * Cornice di Coverage meta per Difesa e Offesa: il corpo (la tabella) lo disegna chi chiama e riceve le pagine compatte
 * ("‹ 1/5 ›", da mettere nella casella in alto a sinistra della tabella) e il riepilogo (da mettere sulla riga sotto,
 * accanto alla legenda). Le righe arrivano già ordinate (prima le minacce coperte peggio, byThreat); la cornice taglia la pagina.
 */
export function MetaFrame<R>({ rows, summary, body, labels }: {
  rows: R[]; summary: ReactNode; labels: MetaLabels;
  body: (shown: R[], pager: ReactNode, summary: ReactNode) => ReactNode;
}) {
  const perPage = useMediaQuery(META_NARROW_QUERY) ? META_PAGE_NARROW : META_PAGE;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * perPage, (current + 1) * perPage);
  const pager = (
    <nav className="cm-pages" aria-label={labels.pages}>
      <button type="button" className="cm-step" aria-label={labels.prev} title={labels.prev} disabled={current === 0} onClick={() => setPage(current - 1)}>
        <Icon name="prev" />
      </button>
      <span className="cm-at" aria-live="polite">
        <span aria-hidden="true">{current + 1}/{pages}</span>
        <span className="visually-hidden">{labels.page(current * perPage + 1, Math.min(rows.length, (current + 1) * perPage))}</span>
      </span>
      <button type="button" className="cm-step" aria-label={labels.next} title={labels.next} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
        <Icon name="next" />
      </button>
    </nav>
  );
  return <>{body(shown, pager, <span className="cm-summary">{summary}</span>)}</>;
}
