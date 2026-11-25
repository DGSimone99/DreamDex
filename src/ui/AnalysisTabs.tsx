import { hint } from './MoveTip';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { gradeFor } from '../engine/rating';
import type { AnalysisView, TabView } from './analysisView';
import { ModalLock } from './ModalLock';
import { EeveePeek } from './EeveePeek';
import { Icon, type IconName } from './icons';

/**
 * Le schede interne di Analisi, nell'ordine: Panoramica e Coaching, poi Offesa, Difesa e Velocità, con "Ruoli e Bonus" in
 * fondo (la scheda bonusMalus: due sottoschede grandi, Bonus/Malus e Ruoli; i Ruoli non hanno un peso nel voto).
 */
export const ANALYSIS_VIEWS: TabView[] = ['overview', 'coaching', 'strength', 'defense', 'speed', 'bonusMalus'];

/** Telefono: le schede sono una barra a icone (le aree con icona e voto, le altre con icona e nome corto). */
const TAB_ICON: Record<TabView, IconName> = { overview: 'roles', coaching: 'target', strength: 'sword', defense: 'shield', speed: 'speed', bonusMalus: 'star' };

/** Il nome della scheda: le aree col nome dell'area, Bonus/Malus (che tiene anche i Ruoli) col suo, "Ruoli e Bonus". */
export const viewLabelKey = (view: TabView) => (view === 'overview' || view === 'coaching' || view === 'bonusMalus' ? `analysis.view.${view}` : `area.${view}`) as 'analysis.view.overview';

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
    // Esc chiude; Tab resta nella finestra (l'unico punto da fuoco è la ×: il fuoco non cade sulla pagina dietro)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab') { e.preventDefault(); closeButton.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button ref={button} type="button" className="help-button" aria-label={label} {...hint(label)} onClick={() => setOpen(true)}>
        <Icon name="help" />
      </button>
      {open && createPortal(
        <div className="help-backdrop" onClick={close}>
          <ModalLock />
          {/* Eevee sbircia da dietro la finestra, come in "Come funziona il voto" */}
          <div className="help-frame with-peek">
          <EeveePeek />
          <div className={`help-dialog view-help${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
            <header className="help-head">
              <h3 id={titleId}>{title}</h3>
              <button ref={closeButton} type="button" className="help-close" aria-label={t('help.close')} onClick={close}><Icon name="close" /></button>
            </header>
            <div className="help-panel">
              {children}
            </div>
          </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Le schede interne: tablist orizzontale (frecce, Home/End). Il "?" di Bonus/Malus sta nella testata dell'area (AreaView). */
/** `areasDisabled`: senza voto (team vuoto) le aree non hanno niente da mostrare: restano visibili ma spente. */
/** `scores`: il voto di ogni area, scritto nella sua scheda (la Panoramica e Ruoli e Bonus non ne hanno). */
/** Il numero sulla scheda: tutti i problemi, quanti gravi e quanti minori (per il suggerimento al passaggio del mouse). */
/** `neutral`: team incompleto, il numero resta grigio anche con problemi gravi (come il contatore della barra laterale). */
export interface TabBadge { n: number; serious: number; minor: number; neutral?: boolean }
const badgeTitle = ({ serious, minor }: TabBadge, t: ReturnType<typeof useT>) => [
  serious ? t(serious === 1 ? 'analysis.seriousOne' : 'analysis.seriousMany', { n: serious }) : null,
  minor ? t(minor === 1 ? 'analysis.minorOne' : 'analysis.minorMany', { n: minor }) : null,
].filter(Boolean).join(' · ');

export function AnalysisTabs({ view, onView, panelId, areasDisabled = false, scores = {}, badges = {}, noOverview = false, aside = null }: { view: TabView; onView: (view: AnalysisView) => void; panelId: string; areasDisabled?: boolean; scores?: Partial<Record<TabView, number | string | null>>; badges?: Partial<Record<TabView, TabBadge>>;
  /** Telefono: niente scheda Panoramica (l'Analisi si apre sul Coaching). `aside`: in fondo a destra, fuori dalle schede (il voto del team). */
  noOverview?: boolean; aside?: ReactNode }) {

  const t = useT();
  const VIEWS = noOverview ? ANALYSIS_VIEWS.filter(item => item !== 'overview') : ANALYSIS_VIEWS;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Telefono: la fila delle schede scorre col dito; la scheda aperta si porta in vista (sul desktop non scorre: niente)
  useLayoutEffect(() => {
    const tab = buttons.current[VIEWS.indexOf(view)];
    const strip = tab?.closest<HTMLElement>('.analysis-tabs');
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = tab.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, left - (strip.clientWidth - tab.offsetWidth) / 2);
    }
  }, [view]);
  const go = (index: number) => {
    if (areasDisabled) return;
    const next = VIEWS[(index + VIEWS.length) % VIEWS.length];
    onView(next);
    buttons.current[VIEWS.indexOf(next)]?.focus();
  };
  const onKey = (e: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: VIEWS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    go(moves[e.key]);
  };
  return (
    <div className="analysis-tabs">
      <div role="tablist" aria-label={t('analysis.views')}>
        {VIEWS.map((item, i) => (
          <button key={item} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`analysis-view-${item}`}
            aria-selected={item === view} aria-controls={panelId} tabIndex={item === view ? 0 : -1}
            aria-disabled={areasDisabled && item !== 'overview' ? true : undefined}
            aria-describedby={scores[item] != null || badges[item] ? `analysis-view-${item}-desc` : undefined}
            title={badges[item] ? badgeTitle(badges[item]!, t) : undefined}
            onClick={() => { if (!(areasDisabled && item !== 'overview')) onView(item); }} onKeyDown={e => onKey(e, i)}>
            <span className="tab-icon" aria-hidden="true"><Icon name={TAB_ICON[item]} /></span>
            <span className="tab-name">{t(viewLabelKey(item))}</span>
            {scores[item] == null && <span className="tab-short" aria-hidden="true">{t(item === 'bonusMalus' ? 'analysis.view.bonusMalusShort' : viewLabelKey(item))}</span>}
            {/* Il voto dell'area si vede ma non entra nel nome della scheda */}
            {/* Problemi: numero fuori dal nome della scheda, rosso con almeno un grave (a team completo) */}
            {!!badges[item] && <span className={`tab-badge${badges[item]!.serious && !badges[item]!.neutral ? '' : ' minor'}`} aria-hidden="true">{badges[item]!.n}</span>}
            {scores[item] != null && <span className={`tab-score${typeof scores[item] === 'number' ? ` grade-${gradeFor(scores[item] as number).grade}` : ''}`} aria-hidden="true">{scores[item]}</span>}
          </button>
        ))}
      </div>
      {aside}
      {/* Voto e problemi delle schede per i lettori di schermo: descrizione, così il nome della scheda resta il suo nome */}
      {VIEWS.filter(item => scores[item] != null || badges[item]).map(item => (
        <span key={item} id={`analysis-view-${item}-desc`} hidden>
          {[scores[item] != null ? t('analysis.tabScore', { value: scores[item]! }) : null,
            badges[item] ? `${t(badges[item]!.n === 1 ? 'analysis.tabProblemsOne' : 'analysis.tabProblemsMany', { n: badges[item]!.n })} (${badgeTitle(badges[item]!, t)})` : null,
          ].filter(Boolean).join(', ')}
        </span>
      ))}
    </div>
  );
}
