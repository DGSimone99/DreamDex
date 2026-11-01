import { useState, type ReactNode } from 'react';
import { Icon } from './icons';

/** Pokémon del meta per pagina: le colonne della tabella. */
export const META_PAGE = 8;

/** Pastiglia con il conteggio di un gruppo (grigia a zero), come nella barra di Coverage meta. */
export function MetaCount({ n, tone, label }: { n: number; tone: 'good' | 'warn' | 'bad'; label: string }) {
  return <span className={`ct-pill ${n ? tone : 'zero'}`}>{n} {label}</span>;
}

/** Le etichette della navigazione tra le pagine: minacce per la Difesa, bersagli per l'Offesa. */
export type MetaLabels = { pages: string; prev: string; next: string; page: (from: number, to: number) => string };

/**
 * Cornice di Coverage meta per Difesa e Offesa: il corpo (la tabella) lo disegna chi chiama e riceve la barra di pagine e
 * riepilogo da mettere dove serve. Le righe arrivano già ordinate; la cornice taglia la pagina.
 */
export function MetaFrame<R>({ rows, summary, body, labels }: {
  rows: R[]; summary: ReactNode; labels: MetaLabels;
  body: (shown: R[], bar: ReactNode) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / META_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * META_PAGE, (current + 1) * META_PAGE);
  const bar = (
      <div className="cm-bar">
        <nav className="cm-pages" aria-label={labels.pages}>
          <button type="button" className="cm-step" aria-label={labels.prev} disabled={current === 0} onClick={() => setPage(current - 1)}>
            <Icon name="prev" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" className="cm-page" aria-current={i === current ? 'page' : undefined}
              aria-label={labels.page(i * META_PAGE + 1, Math.min(rows.length, (i + 1) * META_PAGE))}
              onClick={() => setPage(i)}>
              {i + 1}
            </button>
          ))}
          <button type="button" className="cm-step" aria-label={labels.next} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
            <Icon name="next" />
          </button>
        </nav>
        <p className="cm-summary">{summary}</p>
      </div>
  );
  return <>{body(shown, bar)}</>;
}
