import { useState, type ReactNode } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { MoveName } from './TypeText';

/** Tessere per pagina: 4 colonne × 2 righe, abbastanza grandi da mostrare chi copre o regge per nome. */
export const META_PAGE = 8;

/** Pastiglia con il conteggio di un gruppo (grigia a zero), come nella barra di Coverage meta. */
export function MetaCount({ n, tone, label }: { n: number; tone: 'good' | 'warn' | 'bad'; label: string }) {
  return <span className={`ct-pill ${n ? tone : 'zero'}`}>{n} {label}</span>;
}

/**
 * Cornice di Coverage meta, uguale per Difesa e Offesa: in alto le pagine e il riepilogo, sotto la griglia 4 × 2 di
 * tessere. Le righe arrivano già ordinate; la cornice taglia la pagina e disegna ogni tessera con `tile`.
 */
export function MetaFrame<R>({ rows, roomy, summary, tile }: { rows: R[]; roomy?: boolean; summary: ReactNode; tile: (row: R) => ReactNode }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / META_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * META_PAGE, (current + 1) * META_PAGE);
  return (
    <div className={`cm-frame${roomy ? ' roomy' : ''}`}>
      <div className="cm-bar">
        <nav className="cm-pages" aria-label={t('ddetail.cm.pages')}>
          <button type="button" className="cm-step" aria-label={t('ddetail.cm.prev')} disabled={current === 0} onClick={() => setPage(current - 1)}>
            <Icon name="prev" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" className="cm-page" aria-current={i === current ? 'page' : undefined}
              aria-label={t('ddetail.cm.page', { from: i * META_PAGE + 1, to: Math.min(rows.length, (i + 1) * META_PAGE) })}
              onClick={() => setPage(i)}>
              {i + 1}
            </button>
          ))}
          <button type="button" className="cm-step" aria-label={t('ddetail.cm.next')} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
            <Icon name="next" />
          </button>
        </nav>
        <p className="cm-summary">{summary}</p>
      </div>
      <ul className="cm-grid">{shown.map(tile)}</ul>
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
