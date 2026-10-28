import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import { Icon } from './icons';

/** Le schede interne di Analisi, nell'ordine: Panoramica e Coaching, poi Offesa, Difesa, Velocità e Ruoli, con Bonus/Malus in fondo. */
export const ANALYSIS_VIEWS: AnalysisView[] = ['overview', 'coaching', 'strength', 'defense', 'speed', 'roles', 'bonusMalus'];

const viewLabelKey = (view: AnalysisView) => (view === 'overview' || view === 'coaching' ? `analysis.view.${view}` : `area.${view}`) as 'analysis.view.overview';

/** Un "?" che apre un riquadro di aiuto: un titolo e il contenuto. `label`: il nome del pulsante, se diverso dal titolo. */
export function HelpButton({ title, label = title, className, children }: { title: string; label?: string; className?: string; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = () => { setOpen(false); button.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button ref={button} type="button" className="help-button" aria-label={label} title={label} onClick={() => setOpen(true)}>
        <Icon name="help" />
      </button>
      {open && createPortal(
        <div className="help-backdrop" onClick={close}>
          <div className={`help-dialog view-help${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
            <header className="help-head">
              <h3 id={titleId}>{title}</h3>
              <button ref={closeButton} type="button" className="help-close" aria-label={t('help.close')} onClick={close}><Icon name="close" /></button>
            </header>
            <div className="help-panel">
              {children}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Le schede con un "?" di pagina: non lo hanno la Panoramica, il Coaching e la Difesa (che ha la sua guida a sezioni). */
type HelpView = Exclude<AnalysisView, 'overview' | 'coaching' | 'defense'>;
const hasHelp = (view: AnalysisView): view is HelpView => view !== 'overview' && view !== 'coaching' && view !== 'defense';

/** Il "?" accanto alla scheda aperta: cosa mostra quella scheda e come conta nel voto. */
export function ViewHelp({ view }: { view: HelpView }) {
  const t = useT();
  return (
    <HelpButton title={t('help.view.button', { view: t(viewLabelKey(view)) })}>
      {t(`help.view.${view}` as const).split('\n').map(line => <p key={line}>{line}</p>)}
    </HelpButton>
  );
}

/** Le schede interne: tablist orizzontale (frecce, Home/End), col "?" accanto a quella aperta. */
/** `areasDisabled`: senza voto (team vuoto) le aree non hanno niente da mostrare: restano visibili ma spente. */
/** `scores`: il voto di ogni area, scritto nella sua scheda (la Panoramica non ne ha). */
export function AnalysisTabs({ view, onView, panelId, areasDisabled = false, scores = {}, badges = {} }: { view: AnalysisView; onView: (view: AnalysisView) => void; panelId: string; areasDisabled?: boolean; scores?: Partial<Record<AnalysisView, number | null>>; badges?: Partial<Record<AnalysisView, number>> }) {

  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Il "?" sta fuori dal tablist (lì solo schede) ma si vede accanto alla scheda aperta
  const [helpLeft, setHelpLeft] = useState(0);
  useLayoutEffect(() => {
    const tab = buttons.current[ANALYSIS_VIEWS.indexOf(view)];
    if (!tab) return;
    // Dentro la scheda aperta, a destra (prima del taglio inclinato)
    const place = () => setHelpLeft(tab.offsetLeft + tab.offsetWidth - 64);
    place();
    // La scheda Analisi può essere nascosta al primo disegno (misure a 0): si riposiziona quando prende le sue dimensioni
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [view, t]);
  const go = (index: number) => {
    if (areasDisabled) return;
    const next = ANALYSIS_VIEWS[(index + ANALYSIS_VIEWS.length) % ANALYSIS_VIEWS.length];
    onView(next);
    buttons.current[ANALYSIS_VIEWS.indexOf(next)]?.focus();
  };
  const onKey = (e: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: ANALYSIS_VIEWS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    go(moves[e.key]);
  };
  return (
    <div className="analysis-tabs">
      <div role="tablist" aria-label={t('analysis.views')}>
        {ANALYSIS_VIEWS.map((item, i) => (
          <button key={item} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`analysis-view-${item}`}
            aria-selected={item === view} aria-controls={panelId} tabIndex={item === view ? 0 : -1}
            aria-disabled={areasDisabled && item !== 'overview' ? true : undefined}
            title={badges[item] ? t('analysis.seriousCount', { n: badges[item]! }) : undefined}
            onClick={() => { if (!(areasDisabled && item !== 'overview')) onView(item); }} onKeyDown={e => onKey(e, i)}>
            <span>{t(viewLabelKey(item))}</span>
            {/* Il voto dell'area si vede ma non entra nel nome della scheda */}
            {/* Problemi gravi: numero fuori dal nome della scheda */}
            {!!badges[item] && <span className="tab-badge" aria-hidden="true">{badges[item]}</span>}
            {scores[item] != null && <span className="tab-score" aria-hidden="true">{scores[item]}</span>}
          </button>
        ))}
      </div>
      {/* Panoramica e Coaching non hanno "?" (l'aiuto della Panoramica è accanto al tipo di team) */}
      {hasHelp(view) && <span className="analysis-help" style={{ left: helpLeft }}><ViewHelp view={view} /></span>}
    </div>
  );
}
