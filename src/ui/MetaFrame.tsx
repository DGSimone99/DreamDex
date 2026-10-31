import { useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { MoveName } from './TypeText';

/** Tessere per pagina: 4 colonne × 2 righe, abbastanza grandi da mostrare chi copre o regge per nome. */
export const META_PAGE = 8;

/** Pastiglia con il conteggio di un gruppo (grigia a zero), come nella barra di Coverage meta. */
export function MetaCount({ n, tone, label }: { n: number; tone: 'good' | 'warn' | 'bad'; label: string }) {
  return <span className={`ct-pill ${n ? tone : 'zero'}`}>{n} {label}</span>;
}

/** Le etichette della navigazione tra le pagine: minacce per la Difesa, bersagli per l'Offesa. */
export type MetaLabels = { pages: string; prev: string; next: string; page: (from: number, to: number) => string };

/**
 * Cornice di Coverage meta per Difesa e Offesa. Con `tile`: in alto le pagine e il riepilogo, sotto la griglia 4 × 2 di
 * tessere. Con `body`: il corpo lo disegna chi chiama (la tabella dell'Offesa) e riceve la barra di pagine e riepilogo
 * da mettere dove serve. Le righe arrivano già ordinate; la cornice taglia la pagina.
 */
export function MetaFrame<R>({ rows, roomy, summary, tile, body, labels }: {
  rows: R[]; roomy?: boolean; summary: ReactNode; labels: MetaLabels;
  tile?: (row: R) => ReactNode; body?: (shown: R[], bar: ReactNode) => ReactNode;
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
  if (body) return <>{body(shown, bar)}</>;
  return (
    <div className={`cm-frame${roomy ? ' roomy' : ''}`}>
      {bar}
      <ul className="cm-grid">{shown.map(row => tile!(row))}</ul>
    </div>
  );
}

/** Chi regge (Difesa) o chi copre (Offesa) una tessera: icona, nome, mossa a squadra chiusa e % (gialla se solo a metà). */
export function MetaHolders({ list, roomy }: { list: { species: string; move: string; pct: number; partial: boolean }[]; roomy?: boolean }) {
  return (
    <span className={`cm-by${list.length > 4 ? ' many' : ''}`} aria-hidden="true">
      {list.map((h, i) => (
        <span key={`${h.species}-${i}`} className={`cm-holder${h.partial ? ' partial' : ''}`} title={`${h.species}: ${h.move} ${h.pct}%`}>
          <span className="def-box"><PokemonIcon name={h.species} /></span>
          <span className="cm-holder-name">{h.species}</span>
          {roomy && h.move && <span className="cm-holder-move"><MoveName move={h.move} /></span>}
          <span className={`cm-holder-pct${h.partial ? ' half' : ''}`}>{h.pct}%</span>
        </span>
      ))}
    </span>
  );
}
