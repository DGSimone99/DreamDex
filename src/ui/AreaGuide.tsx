import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n/react';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';
import { tabStep } from './tabStep';

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
  const section = sections.find(s => s.key === current) ?? sections[0];

  useEffect(() => {
    // Il focus va alla sezione scelta solo all'apertura
    tabs.current[Math.max(0, sections.findIndex(s => s.key === current))]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEscape(onClose);

  // Frecce su/giù tra le sezioni, come una lista di schede verticale
  const onTabKey = (e: KeyboardEvent, index: number) => {
    const next = tabStep(e.key, index, sections.length, { horizontal: false, vertical: true, homeEnd: false });
    if (next === null) return;
    e.preventDefault();
    onCurrent(sections[next].key);
    tabs.current[next]?.focus();
  };

  return (
    // Eevee sbircia da dietro la finestra, come in "Come funziona il voto"
    <ModalShell className={`area-guide${className ? ` ${className}` : ''}`} titleId={`${id}-title`} title={title} heading="h2"
      closeLabel={t('help.close')} onClose={onClose} peek>
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
                  <h3>{item.label}</h3>
                  {item.content}
                </section>
              )
              : (
                <div key={item.key} className="help-panel guide-ghost" aria-hidden="true" inert>
                  <h3>{item.label}</h3>
                  {item.content}
                </div>
              )))}
          </div>
        </div>
    </ModalShell>
  );
}
