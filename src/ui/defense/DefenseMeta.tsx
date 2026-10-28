import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { PokemonIcon } from '../PokemonName';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];

/** Gruppo di una minaccia: nessuno la regge, solo a metà (chi regge va KO in due colpi), retta. */
const groupOf = (row: Row) => (row.heldBy.length === 0 ? 'none' : row.heldBy.some(h => !h.partial) ? 'held' : 'partial');
const GROUP_ORDER = { none: 0, partial: 1, held: 2 } as const;
/** Colore del livello, come le altre pastiglie: verde da 80, giallo sopra zero, rosso senza difensori. */
const tone = (row: Row) => (row.heldBy.length === 0 ? 'bad' : row.level >= 80 ? 'good' : 'warn');

/**
 * Coverage meta: una tessera per minaccia del meta, prima quelle senza risposta, poi quelle rette solo a metà, poi le altre,
 * ognuna per uso. In ogni tessera l'icona della minaccia, il livello in pastiglia e chi la regge (attenuato se solo a metà).
 * In alto i conteggi dei tre gruppi; la griglia riempie il pannello.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const rows = [...(defense.coverageMeta?.rows ?? [])]
    .sort((a, b) => GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)] || b.weight - a.weight);
  const count = (group: keyof typeof GROUP_ORDER) => rows.filter(r => groupOf(r) === group).length;
  return (
    <div className={`cm-frame${ctx.roomy ? ' roomy' : ''}`}>
      <p className="cm-summary">
        <span>{t('ddetail.cm.threats', { n: rows.length })}</span>
        <span className={`ct-pill ${count('held') ? 'good' : 'zero'}`}>{count('held')} {t('ddetail.cm.held')}</span>
        <span className={`ct-pill ${count('partial') ? 'warn' : 'zero'}`}>{count('partial')} {t('ddetail.cm.partial')}</span>
        <span className={`ct-pill ${count('none') ? 'bad' : 'zero'}`}>{count('none')} {t('ddetail.cm.none')}</span>
      </p>
      <ul className="cm-grid" style={{ gridTemplateRows: `repeat(${Math.ceil(rows.length / 8)}, minmax(0, 1fr))` }}>
        {rows.map(row => {
          const holders = row.heldBy.map(h => `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`);
          const label = `${row.species}: ${row.level}%, ${holders.length ? holders.join('; ') : t('detail.nobody')}`;
          return (
            <li key={row.species} className={`cm-tile ${groupOf(row)}`} aria-label={label} title={label}>
              <span className="cm-head">
                <span className="def-box cm-threat"><PokemonIcon name={row.species} /></span>
                <span className={`ct-pill ${tone(row)}`}>{row.heldBy.length ? `${row.level}%` : t('detail.nobody')}</span>
              </span>
              <span className="cm-by" aria-hidden="true">
                {row.heldBy.map((h, i) => (
                  <span key={`${h.species}-${i}`} className={`cm-holder${h.partial ? ' partial' : ''}`}>
                    <span className="def-box"><PokemonIcon name={h.species} /></span>
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
