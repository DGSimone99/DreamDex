import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { CoachProblem } from '../engine/coach';
import type { TeamRating } from '../engine/rating';
import { useLang, useT } from '../i18n/react';
import { areaTabs, areaValue, type AreaKey } from './AreaDetail';
import { Typed } from './TypeText';

/** La scheda da cui si parte: la coverage dei tipi in Difesa e Offesa (la più consultata), altrimenti la prima. */
const START: Partial<Record<AreaKey, string>> = { defense: 'coverageTypes', strength: 'coverageTypes' };

/**
 * Un'area del voto sulla pagina (scheda di Analisi): a sinistra le sottostatistiche col loro valore e i problemi
 * dell'area, a destra il dettaglio di quella scelta, membro per membro, con come conta nel voto.
 * `extra`: contenuto in più in cima a una scheda (la tabella completa delle debolezze, della coverage, dei bisogni).
 */
export function AreaView({ rating, area, problems, extra }: {
  rating: TeamRating;
  area: AreaKey;
  problems: CoachProblem[];
  extra?: { tabKey: string; panel: ReactNode };
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const tabs = areaTabs(rating, area, t, lang);
  const start = Math.max(0, tabs.findIndex(tab => tab.key === START[area]));
  const [picked, setPicked] = useState<string | null>(null);
  const index = Math.max(0, picked === null ? start : tabs.findIndex(tab => tab.key === picked));
  const current = tabs[index];
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const title = t(`area.${area}`);

  // Frecce su/giù fra le sottostatistiche, come nelle altre liste verticali
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    setPicked(tabs[next].key);
    buttons.current[next]?.focus();
  };

  return (
    <section className="area-view" aria-label={title}>
      <div className="area-side">
        <h3 className="area-title">{title} <strong>{areaValue(rating, area) ?? 'n/d'}</strong></h3>
        <div className="area-subs" role="tablist" aria-orientation="vertical" aria-label={title}>
          {tabs.map((tab, i) => (
            <button key={tab.key} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${id}-${tab.key}`}
              aria-selected={tab === current} aria-controls={`${id}-panel`} tabIndex={tab === current ? 0 : -1}
              onClick={() => setPicked(tab.key)} onKeyDown={e => onKey(e, i)}>
              <span>{tab.label}</span>
              {typeof tab.value === 'number' && <span className="sub-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, tab.value))}%` }} /></span>}
              <b>{tab.value ?? 'n/d'}</b>
            </button>
          ))}
        </div>
        {problems.length > 0 && (
          <ul className="area-problems" aria-label={t('analysis.areaProblems', { area: title })}>
            {problems.map(problem => (
              <li key={problem.text} className={problem.severity}><Typed text={problem.text} /></li>
            ))}
          </ul>
        )}
      </div>
      <div className="area-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${current.key}`}>
        {extra && extra.tabKey === current.key && <div className="area-extra">{extra.panel}</div>}
        {current.panel}
      </div>
    </section>
  );
}
