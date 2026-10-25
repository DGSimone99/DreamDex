import { useId } from 'react';
import { battleSpecies } from '../engine/dex';
import { STAT_IDS } from '../engine/sets';
import { statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';


/** Fascia di colore come su Showdown: dal rosso dei valori bassi al turchese dei più alti. */
function band(value: number): string {
  if (value < 50) return 'low';
  if (value < 80) return 'mid';
  if (value < 100) return 'ok';
  if (value < 120) return 'good';
  return 'top';
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/**
 * Badge "Stats": passandoci sopra (o col focus) mostra le statistiche base con barre e totale.
 * Con `compare` (il membro che esce in una sostituzione) ogni riga dice anche quanto si guadagna o si perde.
 */
export function StatsBadge({ species, item = '', compare }: { species: string; item?: string; compare?: { species: string; item?: string } }) {
  const id = useId();
  const lang = useLang();
  const t = useT();
  const forme = battleSpecies({ species, item });
  if (!forme) return null;
  const stats = forme.baseStats;
  const total = STAT_IDS.reduce((sum, stat) => sum + stats[stat], 0);
  const other = compare ? battleSpecies({ species: compare.species, item: compare.item ?? '' }) : null;
  const otherTotal = other ? STAT_IDS.reduce((sum, stat) => sum + other.baseStats[stat], 0) : 0;
  const diff = (n: number) => <span className={`stats-diff${n > 0 ? ' up' : n < 0 ? ' down' : ''}`}>{signed(n)}</span>;
  return (
    <span
      className="stats-badge"
      tabIndex={0}
      aria-describedby={id}
      // Dentro un <summary>: il badge non deve aprire o chiudere la card
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      Stats
      <span id={id} role="tooltip" className="stats-pop">
        <span className="stats-title">
          {t('stats.title')}{forme.name !== species ? <small>{forme.name}</small> : null}
        </span>
        {other && <span className="stats-vs">{t('stats.vs', { species: other.name })}</span>}
        {STAT_IDS.map(stat => (
          <span key={stat} className={`stats-row ${band(stats[stat])}`}>
            <span className="stats-name">{statShort(stat, lang)}</span>
            <span className="stats-value">{stats[stat]}</span>
            <span className="stats-bar"><span style={{ width: `${Math.min(100, (stats[stat] / 180) * 100)}%` }} /></span>
            {other && diff(stats[stat] - other.baseStats[stat])}
          </span>
        ))}
        <span className="stats-total"><span>{t('stats.total')}</span><span>{total}{other && <> {diff(total - otherTotal)}</>}</span></span>
      </span>
    </span>
  );
}
