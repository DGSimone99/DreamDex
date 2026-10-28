import { useState } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];

/** Minacce per pagina: 4 colonne × 2 righe, abbastanza grandi da mostrare chi le regge per nome. */
export const META_PAGE = 8;

/** Gruppo di una minaccia: nessuno la regge, solo a metà (chi regge va KO in due colpi), retta. */
const groupOf = (row: Row) => (row.heldBy.length === 0 ? 'none' : row.heldBy.some(h => !h.partial) ? 'held' : 'partial');
/** Colore del livello, come le altre pastiglie: verde da 80, giallo sopra zero, rosso senza difensori. */
const tone = (row: Row) => (row.heldBy.length === 0 ? 'bad' : row.level >= 80 ? 'good' : 'warn');

/**
 * Coverage meta: le minacce del meta a pagine da 8, dalla meno coperta (a pari livello la più usata). Ogni tessera ha
 * l'icona e il nome della minaccia, il livello in pastiglia e chi la regge, col danno che prende (½ se regge solo a metà).
 * In alto le pagine e i conteggi dei tre gruppi.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const rows = [...(defense.coverageMeta?.rows ?? [])].sort((a, b) => a.level - b.level || b.weight - a.weight);
  const pages = Math.max(1, Math.ceil(rows.length / META_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * META_PAGE, (current + 1) * META_PAGE);
  const count = (group: 'held' | 'partial' | 'none') => rows.filter(r => groupOf(r) === group).length;
  const pill = (group: 'held' | 'partial' | 'none', cls: string, key: 'ddetail.cm.held' | 'ddetail.cm.partial' | 'ddetail.cm.none') =>
    <span className={`ct-pill ${count(group) ? cls : 'zero'}`}>{count(group)} {t(key)}</span>;
  return (
    <div className={`cm-frame${ctx.roomy ? ' roomy' : ''}`}>
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
        <p className="cm-summary">
          <span>{t('ddetail.cm.threats', { n: rows.length })}</span>
          {pill('held', 'good', 'ddetail.cm.held')}{pill('partial', 'warn', 'ddetail.cm.partial')}{pill('none', 'bad', 'ddetail.cm.none')}
        </p>
      </div>
      <ul className="cm-grid">
        {shown.map(row => {
          const holders = row.heldBy.map(h => `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`);
          const label = `${row.species}: ${row.level}%, ${holders.length ? holders.join('; ') : t('detail.nobody')}`;
          return (
            <li key={row.species} className={`cm-tile ${groupOf(row)}`} aria-label={label}>
              <span className="cm-head">
                <span className="def-box cm-threat"><PokemonIcon name={row.species} /></span>
                <b className="cm-name">{row.species}</b>
                <span className={`ct-pill ${tone(row)}`}>{row.heldBy.length ? `${row.level}%` : t('detail.nobody')}</span>
              </span>
              <span className="cm-by" aria-hidden="true">
                {row.heldBy.map((h, i) => (
                  <span key={`${h.species}-${i}`} className={`cm-holder${h.partial ? ' partial' : ''}`} title={`${h.species}: ${h.move} ${h.pct}%`}>
                    <span className="def-box"><PokemonIcon name={h.species} /></span>
                    <span className="cm-holder-name">{h.species}</span>
                    <span className="cm-holder-pct">{h.pct}%</span>
                    {h.partial && <i>½</i>}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
