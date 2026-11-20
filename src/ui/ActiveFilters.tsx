import { activeFilterCount, EMPTY_FILTERS, type CandidateFilters, type Inclusion } from '../engine/filters';
import { roleLabel } from '../engine/roles';
import { conditionName } from '../engine/synergy';
import type { TypeName } from '../engine/types';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';

/** Un chip per ogni filtro attivo, sotto la barra: si vede cosa restringe la lista e lo si toglie senza aprire i filtri. */
/** Il numero di risultati non sta qui: lo dice già la fascia "Candidati (N)" sopra la lista. */
export function ActiveFilters({ filters, onChange }: { filters: CandidateFilters; onChange: (filters: CandidateFilters) => void }) {
  const t = useT();
  const lang = useLang();
  if (activeFilterCount(filters) === 0) return null;
  const types = (list: TypeName[]) => list.map(type => typeName(type, lang)).join(', ');
  const incl = (value: Inclusion) => t(`filters.incl.${value}`);
  const chips: { key: string; label: string; clear: Partial<CandidateFilters> }[] = [
    ...(filters.types.length ? [{
      key: 'types',
      label: `${t('filters.type')}: ${filters.types.map(type => typeName(type, lang)).join(' / ')}${filters.mono ? ` · ${t('filters.mono')}` : ''}`,
      clear: { types: [], mono: false },
    }] : []),
    ...(filters.provides ? [{ key: 'provides', label: `${t('filters.sets')}: ${conditionName(filters.provides, lang)}`, clear: { provides: '' as const } }] : []),
    ...(filters.benefitsFrom ? [{ key: 'benefits', label: `${t('filters.benefits')}: ${conditionName(filters.benefitsFrom, lang)}`, clear: { benefitsFrom: '' as const } }] : []),
    ...(filters.tier !== 'all' ? [{ key: 'tier', label: `${t('filters.tier')}: ${t(`filters.tier.${filters.tier}`)}`, clear: { tier: 'all' as const } }] : []),
    ...(filters.usage !== 'all' ? [{ key: 'usage', label: `${t('filters.usage')}: ${t(`filters.usage.${filters.usage}`)}`, clear: { usage: 'all' as const } }] : []),
    ...(filters.resists.length ? [{ key: 'resists', label: `${t('filters.resists')}: ${types(filters.resists)}`, clear: { resists: [] } }] : []),
    ...(filters.hits.length ? [{ key: 'hits', label: `${t('filters.hits')}: ${types(filters.hits)}`, clear: { hits: [] } }] : []),
    ...(filters.roles.length ? [{ key: 'roles', label: `${t('filters.role')}: ${filters.roles.map(role => roleLabel(role, lang)).join(', ')}`, clear: { roles: [] } }] : []),
    ...(filters.mega !== 'all' ? [{ key: 'mega', label: `${t('filters.mega')}: ${incl(filters.mega)}`, clear: { mega: 'all' as const } }] : []),
    ...(filters.legendary !== 'all' ? [{ key: 'legendary', label: `${t('filters.legendary')}: ${incl(filters.legendary)}`, clear: { legendary: 'all' as const } }] : []),
    ...(filters.favoritesOnly ? [{ key: 'favorites', label: t('filters.favoritesOnly'), clear: { favoritesOnly: false } }] : []),
  ];
  return (
    <div className="active-filters">
      {chips.map(chip => (
        <button key={chip.key} type="button" className="filter-chip" aria-label={t('filters.removeChip', { name: chip.label })}
          onClick={() => onChange({ ...filters, ...chip.clear })}>
          <span>{chip.label}</span>
          <Icon name="close" />
        </button>
      ))}
      <button type="button" className="link" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>{t('filters.reset')}</button>
    </div>
  );
}
