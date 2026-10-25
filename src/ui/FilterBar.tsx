import { useState, type CSSProperties } from 'react';
import { activeFilterCount, EMPTY_FILTERS, normalizeTypes, type CandidateFilters, type FilterRole, type Inclusion } from '../engine/filters';
import { FAMILIES } from '../engine/subRoles';
import { CONDITIONS, conditionName, type Condition } from '../engine/synergy';
import { TYPES, type TypeName } from '../engine/types';
import { inkFor, typeColor } from './Sprite';
import { typeTextColor } from './TypeText';
import { typeName } from '../i18n/game';
import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';

/** I 17 sotto-ruoli nell'ordine delle famiglie, poi i tre filtri sulle mosse (ricerca, non voto). */
const ROLES: FilterRole[] = [...Object.values(FAMILIES).flat(), 'priority', 'speedControl', 'setup'];
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** Griglia dei 18 tipi da accendere e spegnere, nei loro colori. */
function TypeGrid({ label, selected, onChange }: {
  label: string;
  selected: TypeName[];
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

/** Tipo 1 e Tipo 2 in due tendine: Tipo 2 può essere Qualsiasi, Mono (solo monotipo) o un secondo tipo. */
function TypeSelects({ filters, onChange }: { filters: CandidateFilters; onChange: (patch: Partial<CandidateFilters>) => void }) {
  const t = useT();
  const lang = useLang();
  const [first, second] = filters.types;
  const secondValue = second ?? (filters.mono ? 'mono' : '');
  const choose = (one: string, two: string) => {
    if (!one) return onChange({ types: [], mono: false });
    const types = [one, ...(two && two !== 'mono' ? [two] : [])] as TypeName[];
    const normalized = normalizeTypes(types);
    onChange({ types: normalized.types, mono: normalized.mono || two === 'mono' });
  };
  const options = TYPES.map(type => <option key={type} value={type}>{typeName(type, lang)}</option>);
  return (
    <>
      <label className="control">
        <span className="control-label">{t('filters.type1')}</span>
        <select aria-label={t('filters.type1')} value={first ?? ''} onChange={e => choose(e.target.value, secondValue)}>
          <option value="">{t('filters.any')}</option>
          {options}
        </select>
      </label>
      <label className="control">
        <span className="control-label">{t('filters.type2')}</span>
        <select aria-label={t('filters.type2')} value={secondValue} disabled={!first} onChange={e => choose(first ?? '', e.target.value)}>
          <option value="">{t('filters.any')}</option>
          <option value="mono" aria-label={t('filters.monoAria')} disabled={!first}>{t('filters.mono')}</option>
          {options}
        </select>
      </label>
    </>
  );
}

interface Props {
  filters: CandidateFilters;
  onChange: (filters: CandidateFilters) => void;
  /** In Liste (solo un elenco di Pokémon) restano i filtri che non riguardano il meta. */
  context?: 'suggestions' | 'lists';
}

export function FilterBar({ filters, onChange, context = 'suggestions' }: Props) {
  const meta = context === 'suggestions';
  const t = useT();
  const lang = useLang();
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });
  // Aperti, l'azzeramento sta in fondo: nella riga del titolo solo a filtri chiusi
  const [open, setOpen] = useState(false);
  const reset = () => onChange({ ...EMPTY_FILTERS, query: filters.query });

  return (
    <details className="block filters" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>
        {count === 0 ? t('filters.title') : count === 1 ? t('filters.activeOne') : t('filters.activeMany', { n: count })}
        {/* Azzera anche a filtri chiusi, senza aprirli (nei suggerimenti lo fanno i chip sotto la barra) */}
        {count > 0 && !open && !meta && (
          <button type="button" className="filters-reset" onClick={e => { e.preventDefault(); reset(); }}>
            <Icon name="close" /> {t('filters.reset')}
          </button>
        )}
      </summary>

      <div className="filter-controls">
        <TypeSelects filters={filters} onChange={set} />
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
          <span className="control-label">{t('filters.tier')}</span>
          <select aria-label={t('filters.tier')} value={filters.tier} onChange={e => set({ tier: e.target.value as CandidateFilters['tier'] })}>
            {(['all', 'legal', 'uber', 'ou', 'uu', 'ru', 'nfe'] as const).map(tier => <option key={tier} value={tier}>{t(`filters.tier.${tier}`)}</option>)}
          </select>
        </label>
        {meta && (
          <label className="control">
            <span className="control-label">{t('filters.usage')}</span>
            <select aria-label={t('filters.usage')} value={filters.usage} onChange={e => set({ usage: e.target.value as CandidateFilters['usage'] })}>
              {(['all', 'common', 'niche'] as const).map(usage => <option key={usage} value={usage}>{t(`filters.usage.${usage}`)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="type-filters">
        <TypeGrid label={t('filters.resists')} selected={filters.resists} onChange={resists => set({ resists })} />
        <TypeGrid label={t('filters.hits')} selected={filters.hits} onChange={hits => set({ hits })} />
      </div>

      <div className="filter-section">
        <h4>{t('filters.role')}</h4>
        <div role="group" aria-label={t('filters.role')} className="chips">
          {ROLES.map(role => (
            <button key={role} type="button" aria-pressed={filters.roles.includes(role)} onClick={() => set({ roles: toggle(filters.roles, role) })}>
              {t(`role.${role}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-controls filter-switches">
        <Segmented label={t('filters.mega')} value={filters.mega} onChange={mega => set({ mega })} />
        <Segmented label={t('filters.legendary')} value={filters.legendary} onChange={legendary => set({ legendary })} />
        {meta && (
          <label className="switch">
            <input type="checkbox" checked={filters.favoritesOnly} onChange={e => set({ favoritesOnly: e.target.checked })} />
            {t('filters.favoritesOnly')}
          </label>
        )}
      </div>

      <div className="filter-footer">
        <button type="button" disabled={count === 0} onClick={reset}>{t('filters.reset')}</button>
      </div>
    </details>
  );
}
