import type { CSSProperties } from 'react';
import { activeFilterCount, EMPTY_FILTERS, MAX_TYPES, type CandidateFilters, type Inclusion } from '../engine/filters';
import { FIT_ARCHETYPES, type FitArchetype } from '../engine/archetype';
import { DESIRABLE_ROLES, ESSENTIAL_ROLES, roleLabel, type Role } from '../engine/roles';
import { CONDITIONS, conditionName, type Condition } from '../engine/synergy';
import { TYPES, type TypeName } from '../engine/types';
import { inkFor, typeColor } from './Sprite';
import { typeTextColor } from './TypeText';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';

const ROLES: Role[] = [...ESSENTIAL_ROLES, 'setup', ...DESIRABLE_ROLES];
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** Griglia dei 18 tipi da accendere e spegnere, nei loro colori. */
function TypeGrid({ label, selected, max, onChange }: {
  label: string;
  selected: TypeName[];
  max?: number;
  onChange: (types: TypeName[]) => void;
}) {
  const lang = useLang();
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
              {typeName(type, lang)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tre scelte affiancate: tutti / esclusi / solo. */
function Segmented({ label, value, onChange }: {
  label: string;
  value: Inclusion;
  onChange: (value: Inclusion) => void;
}) {
  const t = useT();
  const labels = [t('filters.incl.all'), t('filters.incl.none'), t('filters.incl.only')];
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
  const t = useT();
  const lang = useLang();
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });

  return (
    <details className="block filters">
      <summary>{count === 0 ? t('filters.title') : count === 1 ? t('filters.activeOne') : t('filters.activeMany', { n: count })}</summary>

      <div className="type-filters">
        <TypeGrid label={t('filters.type')} selected={filters.types} max={MAX_TYPES} onChange={types => set({ types })} />
        <TypeGrid label={t('filters.resists')} selected={filters.resists} onChange={resists => set({ resists })} />
        <TypeGrid label={t('filters.hits')} selected={filters.hits} onChange={hits => set({ hits })} />
      </div>

      <div className="filter-section">
        <h4>{t('filters.role')}</h4>
        <div role="group" aria-label={t('filters.role')} className="chips">
          {ROLES.map(role => (
            <button key={role} type="button" aria-pressed={filters.roles.includes(role)} onClick={() => set({ roles: toggle(filters.roles, role) })}>
              {roleLabel(role, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-controls">
        <label className="control">
          <span className="control-label">{t('filters.sets')}</span>
          <select aria-label={t('filters.sets')} value={filters.provides} onChange={e => set({ provides: e.target.value as Condition | '' })}>
            <option value="">{t('filters.any')}</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{conditionName(c, lang)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">{t('filters.benefits')}</span>
          <select aria-label={t('filters.benefits')} value={filters.benefitsFrom} onChange={e => set({ benefitsFrom: e.target.value as Condition | '' })}>
            <option value="">{t('filters.any')}</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{conditionName(c, lang)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">{t('filters.fits')}</span>
          <select aria-label={t('filters.fits')} title={t('filters.fitsTitle')} value={filters.fitsArchetype} onChange={e => set({ fitsArchetype: e.target.value as FitArchetype | '' })}>
            <option value="">{t('filters.any')}</option>
            {FIT_ARCHETYPES.map(a => <option key={a} value={a}>{t(`archetype.${a}`)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">{t('filters.tier')}</span>
          <select aria-label={t('filters.tier')} value={filters.tier} onChange={e => set({ tier: e.target.value as CandidateFilters['tier'] })}>
            {(['all', 'legal', 'uber', 'ou', 'uu', 'ru', 'nfe'] as const).map(tier => <option key={tier} value={tier}>{t(`filters.tier.${tier}`)}</option>)}
          </select>
        </label>
        <label className="control">
          <span className="control-label">{t('filters.usage')}</span>
          <select aria-label={t('filters.usage')} value={filters.usage} onChange={e => set({ usage: e.target.value as CandidateFilters['usage'] })}>
            {(['all', 'common', 'niche'] as const).map(usage => <option key={usage} value={usage}>{t(`filters.usage.${usage}`)}</option>)}
          </select>
        </label>
        <Segmented label={t('filters.mega')} value={filters.mega} onChange={mega => set({ mega })} />
        <Segmented label={t('filters.legendary')} value={filters.legendary} onChange={legendary => set({ legendary })} />
      </div>

      <div className="filter-footer">
        <button type="button" disabled={count === 0} onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>{t('filters.reset')}</button>
      </div>
    </details>
  );
}
