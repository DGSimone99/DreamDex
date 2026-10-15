import type { CSSProperties } from 'react';
import { activeFilterCount, EMPTY_FILTERS, MAX_TYPES, type CandidateFilters, type Inclusion } from '../engine/filters';
import { DESIRABLE_ROLES, ESSENTIAL_ROLES, roleLabel, type Role } from '../engine/roles';
import { CONDITIONS, conditionName, type Condition } from '../engine/synergy';
import { TYPES, type TypeName } from '../engine/types';
import { inkFor, typeColor } from './Sprite';
import { typeTextColor } from './TypeText';

const ROLES: Role[] = [...ESSENTIAL_ROLES, 'setup', ...DESIRABLE_ROLES];
const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** Griglia dei 18 tipi da accendere e spegnere, nei loro colori. */
function TypeGrid({ label, selected, max, onChange }: {
  label: string;
  selected: TypeName[];
  max?: number;
  onChange: (types: TypeName[]) => void;
}) {
  return (
    <div className="type-filter">
      <h4>{label}</h4>
      <div role="group" aria-label={label} className="type-grid">
        {TYPES.map(type => {
          const on = selected.includes(type);
          const color = typeColor(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              disabled={!on && max !== undefined && selected.length >= max}
              style={{ '--c': color, '--ink': inkFor(color), '--tc': typeTextColor(type) } as CSSProperties}
              onClick={() => onChange(toggle(selected, type))}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tre scelte affiancate: tutti / esclusi / solo. */
function Segmented({ label, value, onChange, labels = ['Tutti', 'No', 'Solo'] }: {
  label: string;
  value: Inclusion;
  onChange: (value: Inclusion) => void;
  labels?: [string, string, string];
}) {
  const values: Inclusion[] = ['all', 'none', 'only'];
  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <div role="group" aria-label={label} className="segmented">
        {values.map((v, i) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{labels[i]}</button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  filters: CandidateFilters;
  onChange: (filters: CandidateFilters) => void;
}

export function FilterBar({ filters, onChange }: Props) {
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });

  return (
    <details className="block filters">
      <summary>{count ? `Filtri (${count} ${count === 1 ? 'attivo' : 'attivi'})` : 'Filtri'}</summary>

      <div className="type-filters">
        <TypeGrid label="Tipo" selected={filters.types} max={MAX_TYPES} onChange={types => set({ types })} />
        <TypeGrid label="Resiste a" selected={filters.resists} onChange={resists => set({ resists })} />
        <TypeGrid label="Superefficace contro" selected={filters.hits} onChange={hits => set({ hits })} />
      </div>

      <div className="filter-section">
        <h4>Ruolo</h4>
        <div role="group" aria-label="Ruolo" className="chips">
          {ROLES.map(role => (
            <button key={role} type="button" aria-pressed={filters.roles.includes(role)} onClick={() => set({ roles: toggle(filters.roles, role) })}>
              {roleLabel(role)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-controls">
        <label className="control">
          <span className="control-label">Imposta</span>
          <select aria-label="Imposta" value={filters.provides} onChange={e => set({ provides: e.target.value as Condition | '' })}>
            <option value="">Qualsiasi</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{conditionName(c)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">Sfrutta</span>
          <select aria-label="Sfrutta" value={filters.benefitsFrom} onChange={e => set({ benefitsFrom: e.target.value as Condition | '' })}>
            <option value="">Qualsiasi</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{conditionName(c)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">Tier</span>
          <select aria-label="Tier" value={filters.tier} onChange={e => set({ tier: e.target.value as CandidateFilters['tier'] })}>
            <option value="all">Tutti</option>
            <option value="legal">Legali nel formato</option>
            <option value="uber">Uber e AG</option>
            <option value="ou">OU</option>
            <option value="uu">UU (UUBL + UU)</option>
            <option value="ru">RU e inferiori</option>
            <option value="nfe">Non evoluti</option>
          </select>
        </label>
        <label className="control">
          <span className="control-label">Uso nel meta</span>
          <select aria-label="Uso nel meta" value={filters.usage} onChange={e => set({ usage: e.target.value as CandidateFilters['usage'] })}>
            <option value="all">Tutti</option>
            <option value="common">Comuni (≥ 5%)</option>
            <option value="niche">Di nicchia (&lt; 1%)</option>
          </select>
        </label>
        <Segmented label="Mega" value={filters.mega} onChange={mega => set({ mega })} />
        <Segmented label="Leggendari" value={filters.legendary} onChange={legendary => set({ legendary })} />
        <Segmented label="Mitici" value={filters.mythical} onChange={mythical => set({ mythical })} />
        <label className="control">
          <span className="control-label">Fino alla gen</span>
          <select aria-label="Fino alla gen" value={filters.maxGen ?? ''} onChange={e => set({ maxGen: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Tutte</option>
            {GENS.map(gen => <option key={gen} value={gen}>Gen {gen}</option>)}
          </select>
        </label>
      </div>

      <div className="filter-footer">
        <button type="button" disabled={count === 0} onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>Azzera filtri</button>
      </div>
    </details>
  );
}
