import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n/react';

export type TabId = 'pokemon' | 'analysis' | 'meta' | 'lists';

export interface TabInfo {
  id: TabId | 'compare';
  label: string;
  /** Contatore accanto al nome; `level` ne dà il colore (stato). */
  count?: { text: string; level: 'serious' | 'minor' | 'warn' | 'info' } | null;
  disabled?: boolean;
  /** Perché la scheda è disattivata. */
  note?: string;
}

/** Barra delle schede sotto il team: frecce sinistra/destra per spostarsi, come le schede native. */
export function Tabs({ tabs, active, onChange }: { tabs: TabInfo[]; active: TabId; onChange: (tab: TabId) => void }) {
  const t = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = tabs.map((tab, i) => (tab.disabled ? -1 : i)).filter(i => i >= 0);
  const onKey = (e: KeyboardEvent, index: number) => {
    const at = enabled.indexOf(index);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const target = step ? enabled[(at + step + enabled.length) % enabled.length]
      : e.key === 'Home' ? enabled[0] : e.key === 'End' ? enabled[enabled.length - 1] : undefined;
    if (target === undefined) return;
    e.preventDefault();
    refs.current[target]?.focus();
    onChange(tabs[target].id as TabId);
  };
  return (
    <div className="tabs" role="tablist" aria-label={t('tabs.label')}>
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
            onClick={() => { if (!tab.disabled) onChange(tab.id as TabId); }}
            onKeyDown={e => onKey(e, i)}
          >
            <span>{tab.label}</span>
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
