import { useState, type ReactNode } from 'react';
import type { Format, FormatId } from '../engine/format';
import { FORMAT_OPTIONS } from '../engine/formats';
import { TYPES, type TypeName } from '../engine/types';
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
      <label>
        Formato{' '}
        <select
          aria-label="Formato"
          value={format.formatId}
          onChange={e => onFormatChange({ ...format, formatId: e.target.value as FormatId })}
        >
          {FORMAT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
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
      <AdvancedOptions format={format} onFormatChange={onFormatChange} />
      {children}
      <span className="meta">
        {meta ? `Statistiche: ${meta.month} (rating ${meta.cutoff}+)` : 'Statistiche: assenti'}
      </span>
    </header>
  );
}

/** Varianti di regole sopra il formato: Monotype, Ignora ban, Più Mega ammesse (in futuro Doubles). */
function AdvancedOptions({ format, onFormatChange }: { format: Format; onFormatChange: (format: Format) => void }) {
  // Monotype acceso ma tipo non ancora scelto: nessun vincolo finché non si sceglie
  const [monotypeOn, setMonotypeOn] = useState(format.monotype !== null);
  const active = [monotypeOn, format.ignoreBans, format.allowMultipleMegas].filter(Boolean).length;
  return (
    <details className="popover advanced">
      <summary>{active ? `Avanzate (${active})` : 'Avanzate'}</summary>
      <div>
        <label>
          <input
            type="checkbox"
            aria-label="Monotype"
            checked={monotypeOn}
            onChange={e => {
              setMonotypeOn(e.target.checked);
              if (!e.target.checked) onFormatChange({ ...format, monotype: null });
            }}
          />{' '}
          Monotype
        </label>
        {monotypeOn && (
          <label>
            Tipo del team{' '}
            <select
              aria-label="Tipo del team"
              value={format.monotype ?? ''}
              onChange={e => onFormatChange({ ...format, monotype: (e.target.value || null) as TypeName | null })}
            >
              <option value="">—</option>
              {TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        )}
        <label>
          <input
            type="checkbox"
            aria-label="Ignora ban"
            checked={format.ignoreBans}
            onChange={e => onFormatChange({ ...format, ignoreBans: e.target.checked })}
          />{' '}
          Ignora ban
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
      </div>
    </details>
  );
}
