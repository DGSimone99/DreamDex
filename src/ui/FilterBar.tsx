import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { activeFilterCount, EMPTY_FILTERS, filterRolesFor, type CandidateFilters, type FilterRole, type Inclusion } from '../engine/filters';
import { DEFAULT_RULES, isOneType, type FormatRules } from '../engine/formatRules';
import { roleDescription, roleLabel } from '../engine/roles';
import { FAMILIES, type Family } from '../engine/subRoles';
import { CONDITIONS, conditionName } from '../engine/synergy';
import { CONDITION_TYPE } from './dashboard/ConditionTip';
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

/** Il bottone di un tipo come le chip di Champions: icona nel quadretto del colore, nome a fianco (o il nome di una condizione col suo tipo). */
function TypeFace({ type, label: text }: { type: TypeName; label?: string }) {
  const lang = useLang();
  const label = text ?? typeName(type, lang);
  return (
    <>
      <i aria-hidden="true"><img src={typeIconUrl(type)} alt="" draggable={false} /></i>
      <span className={label.length > 8 ? 'long' : undefined}>{label}</span>
    </>
  );
}

/**
 * Una casella con tendina (Tipo 1, Tipo 2, Imposta, Sfrutta): mostra la scelta col colore e l'icona del suo tipo, o
 * Qualsiasi; cliccata apre la tendina con le tessere e Qualsiasi per svuotarla. Esc o un clic fuori la chiudono.
 */
function Slot<V extends string>({ label, value, options, disabled, onPick, columns = 6, up = false }: {
  label: string;
  value: V | undefined;
  /** Ogni scelta col tipo che le dà colore e icona; `off` la spegne (il tipo già nell'altra casella). */
  options: { value: V; label: string; type: TypeName; off?: boolean }[];
  disabled?: boolean;
  onPick: (value: V | undefined) => void;
  columns?: number;
  /** La tendina si apre verso l'alto (le caselle in fondo alla finestra). */
  up?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    box.current?.querySelector<HTMLButtonElement>('.type-slot-menu button[aria-pressed="true"], .type-slot-menu button:not(:disabled)')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const pick = (v: V | undefined) => { onPick(v); setOpen(false); };
  const chosen = options.find(o => o.value === value);
  const colors = (type: TypeName) => {
    const c = typeColor(type);
    return { '--c': c, '--ink': inkFor(c), '--tc': typeTextColor(type) } as CSSProperties;
  };
  return (
    <div className={`type-slot${up ? ' up' : ''}`} ref={box}
      onKeyDown={e => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
      <span className="fchoice-label">{label}</span>
      <button type="button" className={`type-slot-btn${chosen ? ' set' : ''}${open ? ' open' : ''}`} disabled={disabled}
        aria-haspopup="true" aria-expanded={open} aria-label={`${label}: ${chosen ? chosen.label : t('filters.any')}`}
        style={chosen ? colors(chosen.type) : undefined}
        onClick={() => setOpen(o => !o)}>
        {chosen ? <TypeFace type={chosen.type} label={chosen.label} /> : <span className="type-slot-any">{t('filters.any')}</span>}
        <b className="type-slot-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="type-slot-menu" style={{ '--slot-cols': columns } as CSSProperties}>
          <div role="group" aria-label={label} className="type-grid">
            {options.map(o => (
              <button key={o.value} type="button" aria-pressed={value === o.value} disabled={o.off} style={colors(o.type)} onClick={() => pick(o.value)}>
                <TypeFace type={o.type} label={o.label} />
              </button>
            ))}
          </div>
          <button type="button" className="type-slot-clear" disabled={!chosen} onClick={() => pick(undefined)}>{t('filters.any')}</button>
        </div>
      )}
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
 * Il pulsante Filtri nella barra e, aperto, la finestra dei filtri: tutto in vista (tipo, resistenze, ruoli, campo), i
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

  const typeOptions = (taken: TypeName | undefined) => TYPES.map(type => ({ value: type, label: typeName(type, lang), type, off: type === taken }));
  // Ogni condizione col colore e l'icona del suo tipo (Sole Fuoco, Pioggia Acqua, Trick Room Psico…), come nel Riassunto
  const conditionOptions = CONDITIONS.map(c => ({ value: c, label: conditionName(c, lang), type: CONDITION_TYPE[c] ?? 'Normal' }));
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
          {/* Solo preferiti in alto a destra, accanto ad Azzera: vale su tutto, non è un gruppo */}
          {meta && (
            <label className="switch filters-head-fav">
              <input type="checkbox" checked={filters.favoritesOnly} onChange={e => set({ favoritesOnly: e.target.checked })} />
              <Icon name="heart" /> {t('filters.favoritesOnly')}
            </label>
          )}
          <button type="button" className="filters-head-reset" disabled={count === 0} onClick={reset}>
            <Icon name="undo" /> {t('filters.reset')}
          </button>
          <button ref={closeRef} type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="filters-body">
          <section className="fgroup">
            <GroupHead label={t('filters.ownType')} />
            <div className="own-types">
              <Slot label={t('filters.type1')} value={first} options={typeOptions(second)} onPick={type => setOwnTypes(type, second)} />
              <Slot label={t('filters.type2')} value={second} options={typeOptions(first)} disabled={!first || filters.mono} onPick={type => setOwnTypes(first, type)} />
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
            <div className="own-types">
              <Slot label={t('filters.sets')} value={filters.provides || undefined} options={conditionOptions} columns={5} up onPick={provides => set({ provides: provides ?? '' })} />
              <Slot label={t('filters.benefits')} value={filters.benefitsFrom || undefined} options={conditionOptions} columns={5} up onPick={benefitsFrom => set({ benefitsFrom: benefitsFrom ?? '' })} />
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
