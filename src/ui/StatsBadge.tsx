import { useId } from 'react';
import { battleSpecies } from '../engine/dex';
import { STAT_IDS } from '../engine/sets';

const STAT_NAMES = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' } as const;

/** Fascia di colore come su Showdown: dal rosso dei valori bassi al turchese dei più alti. */
function band(value: number): string {
  if (value < 50) return 'low';
  if (value < 80) return 'mid';
  if (value < 100) return 'ok';
  if (value < 120) return 'good';
  return 'top';
}

/** Badge "Stats": passandoci sopra (o col focus) mostra le statistiche base con barre e totale. */
export function StatsBadge({ species, item = '' }: { species: string; item?: string }) {
  const id = useId();
  const forme = battleSpecies({ species, item });
  if (!forme) return null;
  const stats = forme.baseStats;
  const total = STAT_IDS.reduce((sum, stat) => sum + stats[stat], 0);
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
          Statistiche base{forme.name !== species ? <small>{forme.name}</small> : null}
        </span>
        {STAT_IDS.map(stat => (
          <span key={stat} className={`stats-row ${band(stats[stat])}`}>
            <span className="stats-name">{STAT_NAMES[stat]}</span>
            <span className="stats-value">{stats[stat]}</span>
            <span className="stats-bar"><span style={{ width: `${Math.min(100, (stats[stat] / 180) * 100)}%` }} /></span>
          </span>
        ))}
        <span className="stats-total"><span>Totale</span><span>{total}</span></span>
      </span>
    </span>
  );
}
