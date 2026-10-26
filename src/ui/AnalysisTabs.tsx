import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import type { AnalysisView } from './analysisView';
import { Icon } from './icons';

/** Le schede interne di Analisi, nell'ordine: prima cosa fare, poi le aree del voto (Bonus/Malus sta nel Coaching). */
export const ANALYSIS_VIEWS: AnalysisView[] = ['overview', 'defense', 'strength', 'roles', 'speed'];

const viewLabelKey = (view: AnalysisView) => (view === 'overview' ? 'analysis.view.overview' : `area.${view}`) as 'analysis.view.overview';

/** Il "?" accanto alla scheda aperta: cosa mostra quella scheda e come conta nel voto. */
export function ViewHelp({ view }: { view: AnalysisView }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const label = t(viewLabelKey(view));
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
      <button ref={button} type="button" className="help-button" aria-label={t('help.view.button', { view: label })} title={t('help.view.button', { view: label })}
        onClick={() => setOpen(true)}>
        <Icon name="help" />
      </button>
      {open && createPortal(
        <div className="help-backdrop" onClick={close}>
          <div className="help-dialog view-help" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
            <header className="help-head">
              <h3 id={titleId}>{t('help.view.button', { view: label })}</h3>
              <button ref={closeButton} type="button" className="help-close" aria-label={t('help.close')} onClick={close}><Icon name="close" /></button>
            </header>
            <div className="help-panel">
              {t(`help.view.${view}` as 'help.view.overview').split('\n').map(line => <p key={line}>{line}</p>)}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Le schede interne: tablist orizzontale (frecce, Home/End), col "?" accanto a quella aperta. */
/** `areasDisabled`: senza voto (team vuoto) le aree non hanno niente da mostrare: restano visibili ma spente. */
/** `scores`: il voto di ogni area, scritto nella sua scheda (la Panoramica non ne ha). */
export function AnalysisTabs({ view, onView, panelId, areasDisabled = false, scores = {} }: { view: AnalysisView; onView: (view: AnalysisView) => void; panelId: string; areasDisabled?: boolean; scores?: Partial<Record<AnalysisView, number | null>> }) {
  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Il "?" sta fuori dal tablist (lì solo schede) ma si vede accanto alla scheda aperta
  const [helpLeft, setHelpLeft] = useState(0);
  useLayoutEffect(() => {
    const tab = buttons.current[ANALYSIS_VIEWS.indexOf(view)];
    if (!tab) return;
    // Dentro la scheda aperta, a destra (prima del taglio inclinato)
    const place = () => setHelpLeft(tab.offsetLeft + tab.offsetWidth - 40);
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
            onClick={() => { if (!(areasDisabled && item !== 'overview')) onView(item); }} onKeyDown={e => onKey(e, i)}>
            <span>{t(viewLabelKey(item))}</span>
            {/* Il voto dell'area si vede ma non entra nel nome della scheda */}
            {scores[item] != null && <span className="tab-score" aria-hidden="true">{scores[item]}</span>}
          </button>
        ))}
      </div>
      <span className="analysis-help" style={{ left: helpLeft }}><ViewHelp view={view} /></span>
    </div>
  );
}
