import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { ModalLock } from './ModalLock';
import { Icon } from './icons';

/**
 * La guida di un'area, a sezioni: stesso guscio del modale "Come funziona il voto" (argomenti a sinistra, testo a destra).
 * Si apre sulla sezione `current`; Esc o clic fuori chiudono.
 */
export function AreaGuide({ title, sections, current, onCurrent, onClose, className = '' }: {
  title: string;
  /** Classe in più sul modale (es. l'altezza fissa della guida dell'Offesa). */
  className?: string;
  sections: { key: string; label: string; content: ReactNode }[];
  current: string;
  onCurrent: (key: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const close = useRef(onClose);
  close.current = onClose;
  const section = sections.find(s => s.key === current) ?? sections[0];

  useEffect(() => {
    // Il focus va alla sezione scelta solo all'apertura
    tabs.current[Math.max(0, sections.findIndex(s => s.key === current))]?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frecce su/giù tra le sezioni, come una lista di schede verticale
  const onTabKey = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + sections.length) % sections.length;
    onCurrent(sections[next].key);
    tabs.current[next]?.focus();
  };

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
          <ModalLock />
      <div className={`help-dialog area-guide${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}>{title}</h3>
          <button type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="help-body">
          <nav className="help-nav" role="tablist" aria-orientation="vertical" aria-label={title}>
            {sections.map((item, i) => (
              <button key={item.key} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`${id}-tab-${item.key}`}
                aria-selected={item.key === section.key} aria-controls={`${id}-panel`} tabIndex={item.key === section.key ? 0 : -1}
                onClick={() => onCurrent(item.key)} onKeyDown={e => onTabKey(e, i)}>
                {item.label}
              </button>
            ))}
          </nav>
          {/* Tutte le sezioni nella stessa cella, le altre invisibili: il riquadro prende l'altezza della più lunga e non
              cambia misura passando da una sezione all'altra */}
          <div className="guide-stack">
            {sections.map(item => (item === section
              ? (
                <section key={item.key} className="help-panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${item.key}`}>
                  <h4>{item.label}</h4>
                  {item.content}
                </section>
              )
              : (
                <div key={item.key} className="help-panel guide-ghost" aria-hidden="true" inert>
                  <h4>{item.label}</h4>
                  {item.content}
                </div>
              )))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
