import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { activeFilterCount, EMPTY_FILTERS, filterRolesFor, type CandidateFilters, type FilterRole, type Inclusion } from '../engine/filters';
import { DEFAULT_RULES, isOneType, type FormatRules } from '../engine/formatRules';
import { roleDescription, roleLabel } from '../engine/roles';
import { FAMILIES, type Family } from '../engine/subRoles';
import { CONDITIONS, conditionName, type Condition } from '../engine/synergy';
import { TYPES, type TypeName } from '../engine/types';
import { inkFor, typeColor } from './Sprite';
import { typeIconUrl } from './typeIcons';
import { typeTextColor } from './TypeText';
import { typeName } from '../i18n/game';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';
import { useLang, useT } from '../i18n/react';

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** Testa di un gruppo come nel resto dell'app: fascia a righe con la targhetta inclinata; a destra un'aggiunta (Solo monotipo). */
function GroupHead({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="fgroup-head">
      <h3 className="fgroup-plate">{label}</h3>
      {children && <div className="fgroup-extra">{children}</div>}
    </div>
  );
}

/** Griglia dei 18 tipi da accendere e spegnere (Resiste a, Superefficace contro), con l'icona come le chip di Champions. */
function TypeGrid({ label, selected, onChange }: {
  label: string;
  selected: TypeName[];
  onChange: (types: TypeName[]) => void;
}) {
  return (
    <div className="type-filter">
      <GroupHead label={label} />
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
              <TypeFace type={type} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Il bottone di un tipo come le chip di Champions: icona nel quadretto del colore, nome a fianco. */
function TypeFace({ type }: { type: TypeName }) {
  const lang = useLang();
  const label = typeName(type, lang);
  return (
    <>
      <i aria-hidden="true"><img src={typeIconUrl(type)} alt="" draggable={false} /></i>
      <span className={label.length > 8 ? 'long' : undefined}>{label}</span>
    </>
  );
}

/**
 * Una casella del tipo del Pokémon (Tipo 1 o Tipo 2): mostra il tipo scelto o Qualsiasi; cliccata apre una tendina con
 * i 18 tipi e Qualsiasi. I tipi in `taken` (già nell'altra casella) sono spenti. Esc o un clic fuori la chiudono.
 */
function TypeSlot({ label, value, taken, disabled, onPick }: {
  label: string;
  value: TypeName | undefined;
  taken?: TypeName;
  disabled?: boolean;
  onPick: (type: TypeName | undefined) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    box.current?.querySelector<HTMLButtonElement>('.type-slot-menu button[aria-pressed="true"], .type-slot-menu button:not(:disabled)')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const pick = (type: TypeName | undefined) => { onPick(type); setOpen(false); };
  const color = value ? typeColor(value) : undefined;
  return (
    <div className="type-slot" ref={box}
      onKeyDown={e => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
      <span className="fchoice-label">{label}</span>
      <button type="button" className={`type-slot-btn${value ? ' set' : ''}${open ? ' open' : ''}`} disabled={disabled}
        aria-haspopup="true" aria-expanded={open} aria-label={`${label}: ${value ? typeName(value, lang) : t('filters.any')}`}
        style={value ? { '--c': color, '--tc': typeTextColor(value) } as CSSProperties : undefined}
        onClick={() => setOpen(o => !o)}>
        {value ? <TypeFace type={value} /> : <span className="type-slot-any">{t('filters.any')}</span>}
        <b className="type-slot-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="type-slot-menu">
          <div role="group" aria-label={label} className="type-grid">
            {TYPES.map(type => {
              const c = typeColor(type);
              return (
                <button key={type} type="button" aria-pressed={value === type} disabled={type === taken}
                  style={{ '--c': c, '--ink': inkFor(c), '--tc': typeTextColor(type) } as CSSProperties}
                  onClick={() => pick(type)}>
                  <TypeFace type={type} />
                </button>
              );
            })}
          </div>
          <button type="button" className="type-slot-clear" disabled={!value} onClick={() => pick(undefined)}>{t('filters.any')}</button>
        </div>
      )}
    </div>
  );
}

/** Una scelta sola fra tessere (Imposta, Sfrutta); con `clearTo` ricliccare la scelta la toglie. */
function Choice<V extends string>({ label, value, options, onChange, clearTo }: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
  /** Il valore "nessuna scelta": ricliccando la tessera accesa si torna qui. */
  clearTo?: V;
}) {
  return (
    <div className="fchoice">
      <span className="fchoice-label">{label}</span>
      <div role="group" aria-label={label} className="role-tiles">
        {options.map(o => (
          <button key={o.value} type="button" aria-pressed={value === o.value}
            onClick={() => onChange(clearTo !== undefined && value === o.value ? clearTo : o.value)}>
            {o.label}
          </button>
        ))}
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
    <div className="fchoice">
      <span className="fchoice-label">{label}</span>
      <div role="group" aria-label={label} className="segmented">
        {values.map((v, i) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{labels[i]}</button>
        ))}
      </div>
    </div>
  );
}

const ROLE_FAMILIES: Family[] = ['attack', 'defense', 'support', 'utility'];

/**
 * I ruoli in un blocco solo che va a capo, famiglia dopo famiglia (Attaccanti, Difensori, Support, Utility, poi Mosse con
 * priorità e setup), ognuna col suo nome in piccolo davanti; in doppio senza nomi, perché i ruoli del doppio non hanno famiglie.
 */
function RoleRows({ rules, selected, onToggle }: { rules: FormatRules; selected: FilterRole[]; onToggle: (role: FilterRole) => void }) {
  const t = useT();
  const lang = useLang();
  const offered = filterRolesFor(rules);
  const flat = isOneType(rules);
  const families = ROLE_FAMILIES.map(family => ({ key: family, label: t(`family.${family}`), roles: (FAMILIES[family] as FilterRole[]).filter(role => offered.includes(role)) }));
  const grouped = new Set(families.flatMap(f => f.roles));
  const rest = offered.filter(role => !grouped.has(role));
  const rows = flat
    ? [{ key: 'all', label: '', roles: offered }]
    : [...families, { key: 'moves', label: t('filters.family.moves'), roles: rest }].filter(row => row.roles.length > 0);
  return (
    <div role="group" aria-label={t('filters.role')} className="role-flow">
      {rows.map(row => (
        <div key={row.key} className="role-fam">
          {row.label && <span className="role-fam-label">{row.label}</span>}
          {row.roles.map(role => (
            <button key={role} type="button" aria-pressed={selected.includes(role)} title={roleDescription(role, lang)} onClick={() => onToggle(role)}>
              {roleLabel(role, lang)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Props {
  filters: CandidateFilters;
  onChange: (filters: CandidateFilters) => void;
  /** In Liste (solo un elenco di Pokémon) restano i filtri che non riguardano il meta. */
  context?: 'suggestions' | 'lists';
  /** Nel gioco (non più usato: Tier e Uso nel meta sono stati tolti dai filtri). */
  game?: boolean;
  /** Le regole del formato: decidono quali ruoli si possono cercare (in doppio quelli del doppio). */
  rules?: FormatRules;
  /** Quanti Pokémon restano con questi filtri: si legge nella finestra mentre si sceglie (la lista sta sotto, coperta). */
  resultCount?: number;
}

/**
 * Il pulsante Filtri nella barra e, aperto, la finestra dei filtri: tutto in vista (tipi, ruoli, campo, altro), i
 * filtri valgono subito e il piede dice quanti Pokémon restano. I filtri attivi si vedono anche a finestra chiusa, nei
 * chip sotto la barra (ActiveFilters).
 */
export function FilterBar({ filters, onChange, context = 'suggestions', rules = DEFAULT_RULES, resultCount }: Props) {
  const meta = context === 'suggestions';
  const t = useT();
  const count = activeFilterCount(filters);
  const [open, setOpen] = useState(false);
  const reset = () => onChange({ ...EMPTY_FILTERS, query: filters.query });

  return (
    <div className="filters">
      <button type="button" className={`filters-trigger${open ? ' open' : ''}${count > 0 ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {count === 0 ? t('filters.title') : count === 1 ? t('filters.activeOne') : t('filters.activeMany', { n: count })}
      </button>
      {/* Azzera anche a finestra chiusa (nei suggerimenti lo fanno i chip sotto la barra) */}
      {count > 0 && !meta && (
        <button type="button" className="filters-reset" onClick={reset}>
          <Icon name="close" /> {t('filters.reset')}
        </button>
      )}
      {open && (
        <FilterDialog filters={filters} onChange={onChange} meta={meta} rules={rules} resultCount={resultCount} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function FilterDialog({ filters, onChange, meta, rules, resultCount, onClose }: {
  filters: CandidateFilters;
  onChange: (filters: CandidateFilters) => void;
  meta: boolean;
  rules: FormatRules;
  resultCount?: number;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });
  const reset = () => onChange({ ...EMPTY_FILTERS, query: filters.query });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Il tipo del Pokémon: fino a due tipi (deve averli tutti); "Solo monotipo" toglie il Tipo 2. Svuotando il Tipo 1 il
  // Tipo 2 sale al suo posto
  const [first, second] = filters.types;
  const setOwnTypes = (one: TypeName | undefined, two: TypeName | undefined) => {
    const types = [one ?? two, one ? two : undefined].filter((x): x is TypeName => !!x);
    set({ types, mono: types.length < 2 && filters.mono });
  };

  const conditionOptions = [{ value: '' as const, label: t('filters.any') }, ...CONDITIONS.map(c => ({ value: c, label: conditionName(c, lang) }))];
  const showText = resultCount === undefined ? t('filters.done')
    : resultCount === 0 ? t('filters.showNone')
      : resultCount === 1 ? t('filters.showOne') : t('filters.showMany', { n: resultCount });

  return createPortal(
    <div className="help-backdrop filters-backdrop" onClick={onClose}>
      <ModalLock />
      <div className="help-dialog filters-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head filters-head">
          <h3 id={titleId}>{t('filters.title')}</h3>
          <span className={`filters-head-count${count > 0 ? ' on' : ''}`}>
            {count === 0 ? t('filters.countNone') : count === 1 ? t('filters.countOne') : t('filters.countMany', { n: count })}
          </span>
          <button type="button" className="filters-head-reset" disabled={count === 0} onClick={reset}>
            <Icon name="undo" /> {t('filters.reset')}
          </button>
          <button ref={closeRef} type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="filters-body">
          <section className="fgroup">
            <GroupHead label={t('filters.ownType')} />
            <div className="own-types">
              <TypeSlot label={t('filters.type1')} value={first} taken={second} onPick={type => setOwnTypes(type, second)} />
              <TypeSlot label={t('filters.type2')} value={second} taken={first} disabled={!first || filters.mono} onPick={type => setOwnTypes(first, type)} />
              <label className="fmono">
                <input type="checkbox" checked={filters.mono} disabled={filters.types.length >= 2} onChange={e => set({ mono: e.target.checked })} />
                {t('filters.monoAria')}
              </label>
            </div>
          </section>

          <div className="type-filters">
            <TypeGrid label={t('filters.resists')} selected={filters.resists} onChange={resists => set({ resists })} />
            <TypeGrid label={t('filters.hits')} selected={filters.hits} onChange={hits => set({ hits })} />
          </div>

          <section className="fgroup">
            <GroupHead label={t('filters.role')} />
            <RoleRows rules={rules} selected={filters.roles} onToggle={role => set({ roles: toggle(filters.roles, role) })} />
          </section>

          <section className="fgroup">
            <GroupHead label={t('filters.group.field')} />
            <div className="fchoices">
              <Choice label={t('filters.sets')} value={filters.provides} options={conditionOptions} clearTo="" onChange={provides => set({ provides: provides as Condition | '' })} />
              <Choice label={t('filters.benefits')} value={filters.benefitsFrom} options={conditionOptions} clearTo="" onChange={benefitsFrom => set({ benefitsFrom: benefitsFrom as Condition | '' })} />
            </div>
          </section>

          <section className="fgroup">
            <GroupHead label={t('filters.group.more')} />
            <div className="fmore">
              <Segmented label={t('filters.mega')} value={filters.mega} onChange={mega => set({ mega })} />
              <Segmented label={t('filters.legendary')} value={filters.legendary} onChange={legendary => set({ legendary })} />
              {meta && (
                <label className="switch">
                  <input type="checkbox" checked={filters.favoritesOnly} onChange={e => set({ favoritesOnly: e.target.checked })} />
                  {t('filters.favoritesOnly')}
                </label>
              )}
            </div>
          </section>
        </div>

        <footer className="filters-foot">
          <button type="button" className="primary" onClick={onClose}>{showText}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
