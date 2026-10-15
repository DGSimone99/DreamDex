import { activeFilterCount, EMPTY_FILTERS, MAX_TYPES, type CandidateFilters } from '../engine/filters';
import { DESIRABLE_ROLES, ESSENTIAL_ROLES, ROLE_LABELS, type Role } from '../engine/roles';
import { CONDITION_LABELS, type Condition } from '../engine/synergy';
import { TYPES, type TypeName } from '../engine/types';

const ROLES: Role[] = [...ESSENTIAL_ROLES, 'setup', ...DESIRABLE_ROLES];
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

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

      <div role="group" aria-label="Tipo" className="chips">
        {TYPES.map(type => (
          <button
            key={type}
            type="button"
            aria-pressed={filters.types.includes(type)}
            disabled={!filters.types.includes(type) && filters.types.length >= MAX_TYPES}
            onClick={() => set({ types: toggle(filters.types, type) })}
          >
            {type}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Ruolo" className="chips">
        {ROLES.map(role => (
          <button key={role} type="button" aria-pressed={filters.roles.includes(role)} onClick={() => set({ roles: toggle(filters.roles, role) })}>
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <div className="filter-selects">
        <label>
          Porta
          <select aria-label="Porta" value={filters.provides} onChange={e => set({ provides: e.target.value as Condition | '' })}>
            <option value="">—</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{capitalize(CONDITION_LABELS[c])}</option>)}
          </select>
        </label>
        <label>
          Sfrutta
          <select aria-label="Sfrutta" value={filters.benefitsFrom} onChange={e => set({ benefitsFrom: e.target.value as Condition | '' })}>
            <option value="">—</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{capitalize(CONDITION_LABELS[c])}</option>)}
          </select>
        </label>
        <label>
          Resiste a
          <select aria-label="Resiste a" value={filters.resists} onChange={e => set({ resists: e.target.value as TypeName | '' })}>
            <option value="">—</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Colpisce super efficace
          <select aria-label="Colpisce super efficace" value={filters.hits} onChange={e => set({ hits: e.target.value as TypeName | '' })}>
            <option value="">—</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Mega
          <select aria-label="Mega" value={filters.mega} onChange={e => set({ mega: e.target.value as CandidateFilters['mega'] })}>
            <option value="all">Tutti</option>
            <option value="only">Solo Mega</option>
            <option value="none">No Mega</option>
          </select>
        </label>
        <label>
          Tier
          <select aria-label="Tier" value={filters.tier} onChange={e => set({ tier: e.target.value as CandidateFilters['tier'] })}>
            <option value="all">Tutti</option>
            <option value="legal">Legali in National Dex OU</option>
            <option value="uber">Uber e AG</option>
            <option value="ou">OU</option>
            <option value="uu">UU (UUBL + UU)</option>
            <option value="ru">RU e inferiori</option>
            <option value="nfe">Non evoluti</option>
          </select>
        </label>
        <label>
          Uso nel meta
          <select aria-label="Uso nel meta" value={filters.usage} onChange={e => set({ usage: e.target.value as CandidateFilters['usage'] })}>
            <option value="all">Tutti</option>
            <option value="common">Comuni (≥ 5%)</option>
            <option value="niche">Di nicchia (&lt; 1%)</option>
          </select>
        </label>
      </div>

      <button type="button" onClick={() => onChange(EMPTY_FILTERS)}>Azzera filtri</button>
    </details>
  );
}
