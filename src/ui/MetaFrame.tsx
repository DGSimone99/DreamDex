import { useState, type ReactNode } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { useMediaQuery } from './useMediaQuery';

/** Pokémon del meta per pagina: le colonne della tabella (8 sul computer largo e sul telefono, dove la tabella è girata). */
export const META_PAGE = 8;
/** Sul computer stretto e sul tablet (768–1279 px) 6 per pagina, così le caselle restano larghe; più pagine. */
export const META_PAGE_NARROW = 6;
export const META_NARROW_QUERY = '(min-width: 768px) and (max-width: 1279px)';

/** Pastiglia con il conteggio di un gruppo (grigia a zero), come nella barra di Coverage meta. */
export function MetaCount({ n, tone, label }: { n: number; tone: 'good' | 'warn' | 'bad'; label: string }) {
  return <span className={`ct-pill ${n ? tone : 'zero'}`}>{n} {label}</span>;
}

/** L'ordine delle colonne: dalla minaccia gestita peggio (come la Panoramica) o dal più usato nel meta. */
export type MetaOrder = 'threat' | 'usage';

/**
 * L'interruttore dell'ordine, "Uso · Minaccia", a sinistra sulla riga della legenda (dopo l'interruttore dell'efficacia):
 * due pulsanti a pressione come le altre scelte piccole (.segmented). Cambiarlo riporta alla prima pagina (MetaFrame).
 */
export function MetaOrderSwitch({ order, onChange }: { order: MetaOrder; onChange: (order: MetaOrder) => void }) {
  const t = useT();
  return (
    <span className="cm-order">
      <span className="cm-order-label" aria-hidden="true">{t('cm.order')}</span>
      <span className="segmented" role="group" aria-label={t('cm.order')}>
        {(['usage', 'threat'] as const).map(key => (
          <button key={key} type="button" aria-pressed={order === key} title={t(`cm.order.${key}.title`)} onClick={() => onChange(key)}>
            {t(`cm.order.${key}`)}
          </button>
        ))}
      </span>
    </span>
  );
}

/** Le etichette della navigazione tra le pagine: minacce per la Difesa, bersagli per l'Offesa. */
export type MetaLabels = { pages: string; prev: string; next: string; page: (from: number, to: number) => string };

/**
 * Cornice di Coverage meta per Difesa e Offesa: il corpo (la tabella) lo disegna chi chiama e riceve le pagine compatte
 * ("‹ 1/5 ›", da mettere nella casella in alto a sinistra della tabella) e il riepilogo (da mettere sulla riga sotto,
 * accanto alla legenda). Le righe arrivano già ordinate (l'ordine scelto con MetaOrderSwitch); la cornice taglia la pagina.
 */
export function MetaFrame<R>({ rows, summary, body, labels, resetKey }: {
  rows: R[]; summary: ReactNode; labels: MetaLabels;
  body: (shown: R[], pager: ReactNode, summary: ReactNode) => ReactNode;
  /** Cambia (es. l'ordine scelto): si torna alla prima pagina, senza rimontare la tabella (il fuoco resta dov'è). */
  resetKey?: string;
}) {
  const perPage = useMediaQuery(META_NARROW_QUERY) ? META_PAGE_NARROW : META_PAGE;
  const [page, setPage] = useState(0);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) { setSeenKey(resetKey); setPage(0); }
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
