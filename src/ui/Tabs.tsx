import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n/react';
import { Icon, type IconName } from './icons';

export type TabId = 'pokemon' | 'analysis' | 'meta' | 'lists';

export interface TabInfo {
  id: TabId | 'compare';
  label: string;
  /** Contatore accanto al nome; `level` ne dà il colore (stato). */
  count?: { text: string; level: 'serious' | 'minor' | 'warn' | 'info' } | null;
  disabled?: boolean;
  /** Perché la scheda è disattivata. */
  note?: string;
  /** Il fumetto dell'app sulla scheda: cosa conta il numero a destra. */
  hint?: string;
  /** Nella barra laterale: l'icona della sezione e una riga di stato sotto il nome (tessere del menu del gioco). */
  icon?: IconName;
  status?: ReactNode;
}

/** Sezioni dell'app: frecce per spostarsi come le schede native (in verticale anche su e giù). */
export function Tabs({ tabs, active, onChange, orientation = 'horizontal' }: {
  tabs: TabInfo[]; active: TabId; onChange: (tab: TabId) => void; orientation?: 'horizontal' | 'vertical';
}) {
  const t = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = tabs.map((tab, i) => (tab.disabled ? -1 : i)).filter(i => i >= 0);
  const onKey = (e: KeyboardEvent, index: number) => {
    const at = enabled.indexOf(index);
    const next = e.key === 'ArrowRight' || (orientation === 'vertical' && e.key === 'ArrowDown');
    const previous = e.key === 'ArrowLeft' || (orientation === 'vertical' && e.key === 'ArrowUp');
    const step = next ? 1 : previous ? -1 : 0;
    const target = step ? enabled[(at + step + enabled.length) % enabled.length]
      : e.key === 'Home' ? enabled[0] : e.key === 'End' ? enabled[enabled.length - 1] : undefined;
    if (target === undefined) return;
    e.preventDefault();
    refs.current[target]?.focus();
    onChange(tabs[target].id as TabId);
  };
  return (
    <div className={`tabs ${orientation}`} role="tablist" aria-label={t('tabs.label')} aria-orientation={orientation}>
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.disabled ? undefined : `panel-${tab.id}`}
            aria-disabled={tab.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            title={tab.note}
            data-hint={tab.hint}
            // Tessere: il nome della scheda è solo il nome, la riga di stato ne è la descrizione
            aria-labelledby={tab.icon ? `tab-${tab.id}-name` : undefined}
            aria-describedby={tab.icon && tab.status ? `tab-${tab.id}-status` : undefined}
            onClick={() => { if (!tab.disabled) onChange(tab.id as TabId); }}
            onKeyDown={e => onKey(e, i)}
          >
            {tab.icon ? <>
              <span className="tab-icon" aria-hidden="true"><Icon name={tab.icon} /></span>
              <span className="tab-text">
                <span className="tab-name" id={`tab-${tab.id}-name`}>{tab.label}</span>
                {tab.status && <span className="tab-status" id={`tab-${tab.id}-status`}>{tab.status}</span>}
              </span>
            </> : <span>{tab.label}</span>}
            {tab.count && <span className={`tab-count ${tab.count.level}`}>{tab.count.text}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Il contenuto di una scheda: resta montato (ricerca, filtri e pagina non si perdono), nascosto dal CSS. */
export function TabPanel({ id, active, children, className = '' }: { id: TabId; active: TabId; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={`tab-panel ${className}${id === active ? ' active' : ''}`}>
      {children}
    </div>
  );
}
