import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { CoachProblem } from '../engine/coach';
import type { TeamAnalysis } from '../engine/analysis';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { areaTabs, type AreaKey } from './AreaDetail';
import { AreaGuide } from './AreaGuide';
import { Icon } from './icons';
import { Typed } from './TypeText';

/** La scheda da cui si parte: la coverage dei tipi in Offesa (la più consultata), altrimenti la prima. */
const START: Partial<Record<AreaKey, string>> = { strength: 'coverageTypes' };

/**
 * Un'area del voto sulla pagina (scheda di Analisi): una striscia di sottoschede (col loro valore) attaccata alla scheda
 * aperta, una riga coi problemi dell'area e il dettaglio di quella scelta a tutta larghezza.
 * `extra`: contenuto in più in cima a una scheda (la tabella completa delle debolezze, della coverage, dei bisogni).
 */
export function AreaView({ rating, area, problems, team, analysis, extra }: {
  rating: TeamRating;
  area: AreaKey;
  problems: CoachProblem[];
  team: TeamSet[];
  analysis: TeamAnalysis;
  extra?: { tabKey: string; panel: ReactNode };
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [picked, setPicked] = useState<string | null>(null);
  // `open`: le tessere della scheda Generale aprono la sottoscheda
  const tabs = areaTabs(rating, area, t, lang, { team, analysis, open: setPicked });
  const start = Math.max(0, tabs.findIndex(tab => tab.key === START[area]));
  const index = Math.max(0, picked === null ? start : tabs.findIndex(tab => tab.key === picked));
  const current = tabs[index];
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const helpButton = useRef<HTMLButtonElement>(null);
  const [guide, setGuide] = useState(false);
  const title = t(`area.${area}`);

  // Il "?" sta fuori dal tablist (lì solo schede) ma si vede sulla scheda aperta, a destra
  const [helpLeft, setHelpLeft] = useState(0);
  const hasHelp = current.help !== undefined;
  useLayoutEffect(() => {
    const tab = buttons.current[index];
    if (!tab) return;
    const place = () => setHelpLeft(tab.offsetLeft + tab.offsetWidth - 28);
    place();
    // La scheda può essere nascosta al primo disegno (misure a 0): si riposiziona quando prende le sue dimensioni
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [index, t, hasHelp]);

  // Alla chiusura della guida il focus torna al "?"
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !guide) helpButton.current?.focus();
    wasOpen.current = guide;
  }, [guide]);

  // Frecce destra/sinistra (con giro), Home e End fra le sottostatistiche
  const onKey = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + tabs.length) % tabs.length;
    setPicked(tabs[next].key);
    buttons.current[next]?.focus();
  };

  const sections = tabs.filter(tab => tab.help).map(tab => ({
    key: tab.key,
    label: tab.key === 'general' ? t('area.guide.general') : tab.label,
    content: tab.help,
  }));

  return (
    <section className="area-view" aria-label={title}>
      <div className="area-strip">
        <div className="area-subs" role="tablist" aria-orientation="horizontal" aria-label={t('area.subtabs', { area: title })}>
          {tabs.map((tab, i) => (
            <button key={tab.key} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${id}-${tab.key}`}
              aria-selected={tab === current} aria-controls={`${id}-panel`} tabIndex={tab === current ? 0 : -1}
              onClick={() => setPicked(tab.key)} onKeyDown={e => onKey(e, i)}>
              <span>{tab.label}</span>{' '}
              <b>{tab.value ?? 'n/d'}</b>
              {/* Posto per il "?": aprendo un'altra scheda la striscia non si sposta */}
              {tab.help && <span className="sub-help-room" aria-hidden="true" />}
            </button>
          ))}
        </div>
        {current.help && (
          <span className="area-help" style={{ left: helpLeft }}>
            <button ref={helpButton} type="button" className="help-button" aria-label={t('area.guide.button', { tab: current.label })}
              title={t('area.guide.button', { tab: current.label })} onClick={() => setGuide(true)}>
              <Icon name="help" />
            </button>
          </span>
        )}
      </div>
      {/* Nome e voto dell'area stanno già nella scheda aperta: sotto la striscia solo la nota quando l'area non conta */}
      {rating.areas.find(a => a.key === area)?.inactive && <p className="area-inactive" role="note">{t('rating.notCounted')}</p>}
      {guide && sections.length > 0 && (
        <AreaGuide title={t('area.guide.title', { area: title })} sections={sections} current={current.key}
          onCurrent={key => setPicked(key)} onClose={() => setGuide(false)} />
      )}
      {problems.length > 0 && (
        <ul className="area-problems" aria-label={t('analysis.areaProblems', { area: title })}>
          {problems.map(problem => (
            <li key={problem.text} className={problem.severity}><Typed text={problem.text} /></li>
          ))}
        </ul>
      )}
      <div className="area-panel ad-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${current.key}`}>
        {extra && extra.tabKey === current.key && <div className="area-extra">{extra.panel}</div>}
        {current.panel}
      </div>
    </section>
  );
}
