import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import { Sprite } from '../Sprite';

/** Il colore della tessera dalla copertura: buono da 80, medio sopra zero e senza difensori, scarso. */
const tone = (level: number, holders: number) => (holders === 0 ? 'bad' : level >= 80 ? 'good' : 'warn');

/**
 * Coverage meta: una tessera per minaccia del meta, dalla più usata. Sprite, quanta parte regge (%) e gli sprite di chi
 * la regge (smorzati se tiene solo a metà); senza difensori la tessera è rossa e dice "nessuno".
 */
export function DefenseMeta({ defense }: { defense: TeamDefense }) {
  const t = useT();
  const rows = defense.coverageMeta?.rows ?? [];
  return (
    <ul className="cm-grid">
      {[...rows].sort((a, b) => b.weight - a.weight).map(row => {
        const holders = row.heldBy.map(h => `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`);
        const label = `${row.species}: ${row.level}%, ${holders.length ? holders.join('; ') : t('detail.nobody')}`;
        return (
          <li key={row.species} className={`cm-tile ${tone(row.level, row.heldBy.length)}`} aria-label={label} title={label}>
            <Sprite species={row.species} size={32} />
            <b className="cm-level">{row.level}%</b>
            <span className="cm-by">
              {row.heldBy.length
                ? row.heldBy.map((h, i) => <span key={`${h.species}-${i}`} className={h.partial ? 'partial' : undefined}><Sprite species={h.species} size={22} /></span>)
                : <em>{t('detail.nobody')}</em>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
