import type { ReactNode } from 'react';
import type { Format } from '../engine/format';
import type { StatsMeta } from '../engine/stats';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const USAGE_THRESHOLDS = [0, 0.005, 0.01, 0.02, 0.05];

interface Props {
  format: Format;
  onFormatChange: (format: Format) => void;
  meta: StatsMeta | null;
  children?: ReactNode;
}

export function TopBar({ format, onFormatChange, meta, children }: Props) {
  return (
    <header className="topbar">
      <h1>DreamDex</h1>
      <span>National Dex OU</span>
      <label>
        Fino a Gen{' '}
        <select
          aria-label="Generazione massima"
          value={String(format.genLimit)}
          onChange={e => onFormatChange({ ...format, genLimit: Number(e.target.value) })}
        >
          {GENERATIONS.map(gen => <option key={gen} value={gen}>{gen}</option>)}
        </select>
      </label>
      <label>
        Uso min.{' '}
        <select
          aria-label="Uso minimo"
          value={String(format.minUsage)}
          onChange={e => onFormatChange({ ...format, minUsage: Number(e.target.value) })}
        >
          {USAGE_THRESHOLDS.map(value => (
            <option key={value} value={value}>{value === 0 ? 'tutti' : `${value * 100}%`}</option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Più Mega ammesse"
          checked={format.allowMultipleMegas}
          onChange={e => onFormatChange({ ...format, allowMultipleMegas: e.target.checked })}
        />{' '}
        Più Mega ammesse
      </label>
      {children}
      <span className="meta">
        {meta ? `Statistiche: ${meta.month} (rating ${meta.cutoff}+)` : 'Statistiche: assenti'}
      </span>
    </header>
  );
}
