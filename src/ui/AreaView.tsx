import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PROBLEM_CATEGORIES, type CoachProblem } from '../engine/coach';
import type { TeamAnalysis } from '../engine/analysis';
import type { TeamRating } from '../engine/rating';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { areaTabs, type AreaKey } from './AreaDetail';
import { viewLabelKey } from './AnalysisTabs';
import { AreaGuide } from './AreaGuide';
import type { CoachStep } from '../engine/coachSteps';
import { solvable } from './dashboard/FixRow';
import { EffSwitch } from './effTag';
import { Icon } from './icons';
import { Typed } from './TypeText';
import { useFitCount } from './useFit';

/** Lato del "?" sulla scheda aperta (px). */
const HELP_SIZE = 18;

/**
 * Un'area del voto sulla pagina (scheda di Analisi): una striscia di sottoschede (col loro valore) attaccata alla scheda
 * aperta (a destra l'interruttore dell'efficacia), subito sotto il dettaglio di quella scelta a tutta larghezza (la legenda
 * dei colori, dove c'è, sta nella riga in fondo alla tabella) e in fondo la striscia coi problemi dell'area, che porta al
 * Coaching solo quando il Coaching ha una proposta per almeno uno di loro.
 */
export function AreaView({ rating, area, problems, team, analysis, roomy = false, picked: remembered, onPick, formatId, onCoaching, steps = null }: {
  rating: TeamRating;
  area: AreaKey;
  problems: CoachProblem[];
  team: TeamSet[];
  analysis: TeamAnalysis;
  /** Squadra chiusa: più spazio per il contenuto. */
  roomy?: boolean;
  /** La sottoscheda scelta, tenuta da chi contiene la vista (così resta cambiando area); senza, la tiene la vista. */
  picked?: string | null;
  onPick?: (key: string) => void;
  /** Formato scelto, per la guida dell'Offesa. */
  formatId?: FormatId;
  /** Apre il Coaching (la striscia dei problemi in fondo); senza, la striscia non è un pulsante. */
  onCoaching?: () => void;
  /** Le tappe del Coaching (null: si stanno calcolando, o non ci sono): la striscia porta lì solo se una risolve un problema. */
  steps?: CoachStep[] | null;
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [own, setOwn] = useState<string | null>(null);
  const picked = remembered !== undefined ? remembered : own;
  const setPicked = (key: string) => (onPick ? onPick(key) : setOwn(key));
  // `open`: le tessere della scheda Generale aprono la sottoscheda e le passano il focus (il pannello che le ospitava sparisce)
  const focusKey = useRef<string | null>(null);
  const open = (key: string) => { focusKey.current = key; setPicked(key); };
  // Interruttore dell'efficacia: uno per area, lo stesso per Coverage tipi e Coverage meta (spento all'inizio)
  const [effOnly, setEffOnly] = useState<Partial<Record<AreaKey, boolean>>>({});
  // La guida ha la sua sezione: cambiarla non sposta la sottoscheda dietro (null = chiusa)
  const [guide, setGuide] = useState<string | null>(null);
  // Chi ha aperto la guida (il "?" o un link nel pannello): alla chiusura il focus torna lì
  const opener = useRef<HTMLElement | null>(null);
  const openGuide = (key: string) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGuide(key); };
  const tabs = areaTabs(rating, area, t, lang, { team, analysis, open, roomy, formatId, effOnly: !!effOnly[area], guide: openGuide });
  // Si parte dalla prima scheda (Generale), anche se la sottoscheda ricordata non c'è più (es. meta spento)
  const index = Math.max(0, picked === null ? 0 : tabs.findIndex(tab => tab.key === picked));
  const current = tabs[index];
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const helpButton = useRef<HTMLButtonElement>(null);
  // Il nome della scheda di Analisi (Bonus/Malus si chiama "Ruoli e Bonus")
  const title = t(viewLabelKey(area));
  // Con una sottoscheda sola (Velocità) il "?" spiega l'area intera: porta il suo nome
  const helpLabel = t('area.guide.button', { tab: tabs.length === 1 ? title : current.label });
  // Problemi: prima quelli che i Suggerimenti risolvono, poi i gravi, poi l'ordine delle categorie; in riga quelli che stanno
  const sorted = [...problems].sort((a, b) => Number(b.fixes.length > 0) - Number(a.fixes.length > 0)
    || Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const listRef = useRef<HTMLUListElement>(null);
  const fit = useFitCount(listRef, sorted.length, `${lang}|${sorted.map(p => p.text).join('|')}`);
  const hidden = sorted.slice(fit);
  const serious = problems.some(p => p.severity === 'serious');
  const count = t(problems.length === 1 ? 'area.problems.one' : 'area.problems.many', { n: problems.length });
  // La striscia porta al Coaching solo se lì c'è una proposta per almeno uno dei problemi: senza problemi, coi problemi
  // che nessuna tappa risolve o mentre le tappe si calcolano è ferma (i problemi restano scritti)
  const computing = problems.length > 0 && !!onCoaching && steps === null;
  const link = problems.length > 0 && !!onCoaching && !!steps && solvable(problems, steps).length > 0;

  // Il "?" sta fuori dal tablist (lì solo schede) ma si vede sulla scheda aperta, a destra
  const [helpPlace, setHelpPlace] = useState({ left: 0, top: 0 });
  const hasHelp = current.help !== undefined;
  useLayoutEffect(() => {
    const tab = buttons.current[index];
    if (!tab) return;
    // Centrato sul valore della scheda, nello spazio riservato dopo il numero
    const place = () => {
      const strip = tab.parentElement?.parentElement;
      const value = tab.querySelector('b');
      const room = tab.querySelector('.sub-help-room');
      if (!strip || !value || !room) return;
      const base = strip.getBoundingClientRect();
      const v = value.getBoundingClientRect();
      const r = room.getBoundingClientRect();
      // + scrollLeft: sul telefono la striscia scorre col dito e il "?" (assoluto) si misura dal suo inizio (sul desktop è 0)
      setHelpPlace({ left: r.right - base.left + strip.scrollLeft - HELP_SIZE, top: v.top + v.height / 2 - base.top - HELP_SIZE / 2 });
    };
    // Telefono: la sottoscheda aperta si porta in vista nella striscia (sul desktop la striscia non scorre: niente)
    const strip = tab.parentElement?.parentElement;
    if (strip && strip.scrollWidth > strip.clientWidth
      && (tab.offsetLeft < strip.scrollLeft || tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth)) {
      strip.scrollLeft = Math.max(0, tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2);
    }
    place();
    // La scheda può essere nascosta al primo disegno (misure a 0): si riposiziona quando prende le sue dimensioni
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [index, t, hasHelp]);

  // Alla chiusura della guida il focus torna a chi l'ha aperta (di solito il "?" della sottoscheda su cui si era)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && guide === null) (opener.current?.isConnected ? opener.current : helpButton.current)?.focus();
    wasOpen.current = guide !== null;
  }, [guide]);

  // Dopo un'apertura da tessera il focus va alla sottoscheda scelta
  useEffect(() => {
    if (focusKey.current === null) return;
    buttons.current[tabs.findIndex(tab => tab.key === focusKey.current)]?.focus();
    focusKey.current = null;
  });

  // Frecce destra/sinistra (con giro), Home e End fra le sottostatistiche
  const onKey = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + tabs.length) % tabs.length;
    setPicked(tabs[next].key);
    buttons.current[next]?.focus();
  };

  const sections = tabs.filter(tab => tab.help).flatMap(tab => [{
    key: tab.key,
    label: tab.key === 'general' ? t('area.guide.general') : tab.label,
    content: tab.help,
  }, ...(tab.guidePages ?? [])]);

  return (
    <section className={`area-view area-view-${area}`} aria-label={title}>
      {/* Titolo per i lettori di schermo: sotto "Analisi" (h2) l'area, poi i titoli delle parti (h4) */}
      <h3 className="visually-hidden">{title}</h3>
      <div className="area-strip">
        <div className="area-subs" role="tablist" aria-orientation="horizontal" aria-label={t('area.subtabs', { area: title })}>
          {tabs.map((tab, i) => (
            <button key={tab.key} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${id}-${tab.key}`}
              aria-selected={tab === current} aria-controls={`${id}-panel`} tabIndex={tab === current ? 0 : -1}
              aria-describedby={tab.describe ? `${id}-${tab.key}-desc` : undefined}
              onClick={() => setPicked(tab.key)} onKeyDown={e => onKey(e, i)}>
              <span>{tab.label}</span>{' '}
              <b className={tab.valueTone ? `sub-val-${tab.valueTone}` : undefined}>{tab.value ?? 'n/d'}</b>
              {/* Segni dopo il valore (Ruoli: il +N dei minori), a parole nella descrizione della scheda */}
              {tab.marks && <span className="sub-marks" aria-hidden="true">{tab.marks}</span>}
              {/* Posto per il "?": aprendo un'altra scheda la striscia non si sposta */}
              {tab.help && <span className="sub-help-room" aria-hidden="true" />}
            </button>
          ))}
        </div>
        {tabs.filter(tab => tab.describe).map(tab => <span key={tab.key} id={`${id}-${tab.key}-desc`} hidden>{tab.describe}</span>)}
        {/* L'interruttore dell'efficacia, a destra nella striscia, solo sulle sottoschede con l'etichetta nelle caselle */}
        {current.effSide && (
          <span className="strip-switch">
            <EffSwitch side={current.effSide} on={!!effOnly[area]} onChange={on => setEffOnly(s => ({ ...s, [area]: on }))} />
          </span>
        )}
        {current.help && (
          <span className="area-help" style={helpPlace}>
            <button ref={helpButton} type="button" className="help-button" aria-label={helpLabel}
              title={helpLabel} onClick={() => openGuide(current.key)}>
              <Icon name="help" />
            </button>
          </span>
        )}
      </div>
      {/* Nome e voto dell'area stanno già nella scheda aperta: sotto la striscia solo la nota quando l'area non conta */}
      {rating.areas.find(a => a.key === area)?.inactive && <p className="area-inactive" role="note">{t('rating.notCounted')}</p>}
      {guide !== null && sections.length > 0 && (
        <AreaGuide title={t('area.guide.title', { area: title })} sections={sections} current={guide}
          onCurrent={setGuide} onClose={() => setGuide(null)} className={`area-guide-${area}`} />
      )}
      <div className="area-panel ad-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${current.key}`}>
        {current.panel}
      </div>
      {/* In fondo i problemi dell'area, la stessa striscia della Panoramica (stesso posto, stessa misura): c'è sempre. Senza
          problemi (anche in Velocità, dove il Coaching non ne dà) solo "Nessun problema in quest'area", ferma; coi problemi
          scritti, tutta la striscia porta al Coaching solo se lì c'è una proposta per almeno uno: il clic sta sulla striscia, il
          pulsante vero è "Vai al Coaching" (tastiera e lettori). Senza proposte la striscia è ferma e senza pulsante; mentre le
          tappe si calcolano il pulsante tiene il suo posto, invisibile, così i problemi in riga non cambiano */}
      <div className={`area-problems-row fix-row${problems.length === 0 ? ' is-clear' : serious ? ' serious' : ''}${link ? ' is-link' : ''}`}
        onClick={link ? onCoaching : undefined}>
        {problems.length === 0 ? (
          <span className="area-problems-label" role="note" aria-label={t('analysis.areaProblems', { area: title })}>
            <Icon name="check" />{t('area.problems.none')}
          </span>
        ) : (
          <>
            {/* Un'etichetta dice che cos'è la striscia: i problemi dell'area, quanti */}
            <span className="area-problems-label" aria-hidden="true">
              <Icon name="warning" />{count}
            </span>
            {/* Sempre una riga: quelli che non stanno finiscono nel "+N" (title e testo nascosto con tutti) */}
            <ul ref={listRef} className="area-problems" aria-label={t('analysis.areaProblems', { area: title })}>
              {sorted.slice(0, fit).map(problem => (
                <li key={problem.text} className={problem.severity}><Typed text={problem.text} /></li>
              ))}
              {hidden.length > 0 && (
                <li className="area-problems-more" title={hidden.map(p => p.text).join('\n')}>
                  <span aria-hidden="true">+{hidden.length}</span>
                  <span className="visually-hidden">{t(hidden.length === 1 ? 'area.problems.moreOne' : 'area.problems.moreMany', { n: hidden.length })} {hidden.map(p => p.text).join('; ')}</span>
                </li>
              )}
            </ul>
          </>
        )}
        {link && (
          // Il clic arriva alla striscia (anche da tastiera: Invio e Spazio fanno un clic); il nome dice dove porta e cosa c'è
          <button type="button" className="fix-go dash-link" aria-label={t('area.problems.go', { what: `${count} ${t('area.problems.inArea', { area: title })}` })}>
            {t('overview.fix.go')}<span aria-hidden="true"> ›</span>
          </button>
        )}
        {computing && (
          <span className="fix-go dash-link fix-go-wait" aria-hidden="true">{t('overview.fix.go')} ›</span>
        )}
      </div>
    </section>
  );
}
