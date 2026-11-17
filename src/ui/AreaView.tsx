import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PROBLEM_CATEGORIES, type CoachProblem } from '../engine/coach';
import type { TeamAnalysis } from '../engine/analysis';
import { needLabel, type Need } from '../engine/needs';
import { gradeFor, type TeamRating } from '../engine/rating';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { areaTabs, type AreaKey, type KoFocus } from './AreaDetail';
import { viewLabelKey } from './AnalysisTabs';
import { AreaGuide } from './AreaGuide';
import { stepNumbers, type CoachStep } from '../engine/coachSteps';
import { solvable } from './dashboard/FixRow';
import { EffSwitch } from './effTag';
import { Icon } from './icons';
import { isMissingRoles, ProblemPill, tipOf } from './ProblemPill';
import { Typed } from './TypeText';
import { useFitCount } from './useFit';
import { FloatTip, HiddenText, useFloatAnchor } from './FloatTip';

/**
 * Un'area del voto sulla pagina (scheda di Analisi). In alto una testata sola: a sinistra la lettera del voto dell'area e
 * la sua parola (Ruoli e Bonus non ha un voto solo: niente), poi i problemi dell'area come pillole in una riga (quelli che
 * non stanno nel "+N"), a destra il selettore delle sottoschede (solo i nomi; con una sottoscheda sola non c'è) e il "?".
 * Ogni pillola mostra il problema intero nel tooltip (mouse e fuoco) e, se il Coaching ha una proposta per lei, è un
 * pulsante che apre il Coaching su quel problema. Sotto, il dettaglio della sottoscheda scelta a tutta larghezza.
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
  /** Apre il Coaching sul problema di una pillola della testata; senza, le pillole non sono pulsanti. */
  onCoaching?: (problemKey?: string) => void;
  /** Le tappe del Coaching (null: si stanno calcolando, o non ci sono): una pillola porta lì solo se una tappa la risolve. */
  steps?: CoachStep[] | null;
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [own, setOwn] = useState<string | null>(null);
  const picked = remembered !== undefined ? remembered : own;
  const setPickedRaw = (key: string) => (onPick ? onPick(key) : setOwn(key));
  // Il dettaglio evidenziato da una tessera della Generale: si spegne appena si sceglie un'altra sottoscheda
  const [focus, setFocus] = useState<KoFocus | null>(null);
  const setPicked = (key: string) => { setFocus(null); setPickedRaw(key); };
  // `open`: le tessere della scheda Generale aprono la sottoscheda e le passano il focus (il pannello che le ospitava sparisce)
  const focusKey = useRef<string | null>(null);
  const open = (key: string) => { focusKey.current = key; setPicked(key); };
  const openFocus = (key: string, next: KoFocus) => { focusKey.current = key; setPickedRaw(key); setFocus(next); };
  // Un clic in qualunque punto spegne l'evidenziazione (anche fuori da "Mostra tutti"); il clic che l'ha accesa è già passato.
  // Non le frecce delle pagine di Coverage meta (si sfogliano i bersagli accesi), un tooltip, la riga della legenda (lì
  // c'è "Mostra tutti") e la barra di scorrimento di un riquadro
  useEffect(() => {
    if (!focus) return;
    // Sulla barra di scorrimento: il clic cade sul riquadro che scorre, fuori dalla sua parte interna
    const onBar = (e: MouseEvent, el: Element) => el instanceof HTMLElement && el.clientWidth > 0
      && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
      && (e.offsetX > el.clientWidth || e.offsetY > el.clientHeight);
    const clear = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('.cm-pages, .ftip, .rob-legend') || (el && onBar(e, el))) return;
      setFocus(null);
    };
    const timer = window.setTimeout(() => document.addEventListener('click', clear), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener('click', clear); };
  }, [focus]);
  // Interruttore dell'efficacia: uno per area, lo stesso per Coverage tipi e Coverage meta (spento all'inizio)
  const [effOnly, setEffOnly] = useState<Partial<Record<AreaKey, boolean>>>({});
  // La guida ha la sua sezione: cambiarla non sposta la sottoscheda dietro (null = chiusa)
  const [guide, setGuide] = useState<string | null>(null);
  // Chi ha aperto la guida (il "?" o un link nel pannello): alla chiusura il focus torna lì
  const opener = useRef<HTMLElement | null>(null);
  const openGuide = (key: string) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGuide(key); };
  const tabs = areaTabs(rating, area, t, lang, { team, analysis, open, roomy, formatId, effOnly: !!effOnly[area], guide: openGuide, focus, openFocus, clearFocus: () => setFocus(null) });
  // Si parte dalla prima scheda (Generale), anche se la sottoscheda ricordata non c'è più (es. meta spento)
  const index = Math.max(0, picked === null ? 0 : tabs.findIndex(tab => tab.key === picked));
  const current = tabs[index];
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const helpButton = useRef<HTMLButtonElement>(null);
  // Il nome della scheda di Analisi (Bonus/Malus si chiama "Ruoli e Bonus")
  const title = t(viewLabelKey(area));
  // Con una sottoscheda sola (Velocità) il selettore non c'è e il "?" spiega l'area intera: porta il suo nome
  const single = tabs.length === 1;
  const helpLabel = t('area.guide.button', { tab: single ? title : current.label });
  // Il voto dell'area come lettera e parola (Ruoli e Bonus non ha un voto solo)
  const areaInfo = rating.areas.find(a => a.key === area);
  const value = area === 'bonusMalus' ? null : areaInfo?.value ?? null;
  const grade = value === null ? null : gradeFor(value, lang);

  // Telefono: la sottoscheda aperta si porta in vista nel selettore, che lì scorre col dito (sul desktop non scorre: niente)
  useLayoutEffect(() => {
    const tab = buttons.current[index];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    if (tab.offsetLeft < strip.scrollLeft || tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2);
    }
  }, [index]);

  // Alla chiusura della guida il focus torna a chi l'ha aperta (di solito il "?" della testata)
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

  // Una scheda con `guideKey` apre la sezione di un'altra: la sua non si ripete
  const sections = tabs.filter(tab => tab.help && !tab.guideKey).flatMap(tab => [{
    key: tab.key,
    label: tab.guideLabel ?? (tab.key === 'general' ? t('area.guide.general') : tab.label),
    content: tab.help,
  }, ...(tab.guidePages ?? [])]);

  return (
    <section className={`area-view area-view-${area}`} aria-label={title}>
      {/* Titolo per i lettori di schermo: sotto "Analisi" (h2) l'area, poi i titoli delle parti (h4) */}
      <h3 className="visually-hidden">{title}</h3>
      <div className="area-head">
        {grade && (
          <p className={`area-grade grade-${grade.grade}`}>
            <span className="area-grade-letter">{grade.grade}</span> <span className="area-grade-word">{grade.label}</span>
          </p>
        )}
        {/* Un'area che non conta nel voto (Velocità nello stall) lo dice accanto al voto */}
        {areaInfo?.inactive && <span className="area-inactive" role="note">{t('rating.notCounted')}</span>}
        <AreaProblems area={title} problems={problems} steps={steps} onCoaching={onCoaching} />
        {!single && (
          <div className="area-subs" role="tablist" aria-orientation="horizontal" aria-label={t('area.subtabs', { area: title })}>
            {tabs.map((tab, i) => (
              <button key={tab.key} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${id}-${tab.key}`}
                aria-selected={tab === current} aria-controls={`${id}-panel`} tabIndex={tab === current ? 0 : -1}
                aria-describedby={`${id}-${tab.key}-desc`}
                onClick={() => setPicked(tab.key)} onKeyDown={e => onKey(e, i)}>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
        {/* Il valore di ogni sottoscheda non si scrive (la testata resta corta): ai lettori di schermo nella descrizione */}
        {!single && tabs.map(tab => <span key={tab.key} id={`${id}-${tab.key}-desc`} hidden>{tab.describe ?? tab.value ?? 'n/d'}</span>)}
        {current.help && (
          <button ref={helpButton} type="button" className="help-button area-help" aria-label={helpLabel}
            title={helpLabel} onClick={() => openGuide(current.guideKey ?? current.key)}>
            <Icon name="help" />
          </button>
        )}
      </div>
      {guide !== null && sections.length > 0 && (
        <AreaGuide title={t('area.guide.title', { area: title })} sections={sections} current={guide}
          onCurrent={setGuide} onClose={() => setGuide(null)} className={`area-guide-${area}`} />
      )}
      <div className="area-panel ad-panel" role="tabpanel" id={`${id}-panel`}
        aria-labelledby={single ? undefined : `${id}-${current.key}`} aria-label={single ? title : undefined}>
        {/* L'interruttore dell'efficacia, in alto a sinistra sulla riga della legenda, solo sulle sottoschede con l'etichetta
            nelle caselle */}
        {current.effSide && (
          <span className="panel-switch">
            <EffSwitch side={current.effSide} on={!!effOnly[area]} onChange={on => setEffOnly(s => ({ ...s, [area]: on }))} />
          </span>
        )}
        {/* Offesa, Difesa e Velocità non hanno titoli nelle loro schede: per i lettori di schermo la sottoscheda aperta (h4),
            sotto l'area (h3); Ruoli e Bonus hanno già i loro (le fasce, Sul voto) */}
        {(area === 'strength' || area === 'defense' || area === 'speed') && <h4 className="visually-hidden">{current.label}</h4>}
        {current.panel}
      </div>
    </section>
  );
}

/** Una pillola della testata: un problema, o un ruolo mancante (`role`: una pillola per ruolo, come nella mappa del Coaching). */
type Entry = { problem: CoachProblem; role?: string };

/** Il testo intero di una pillola (tooltip e lettori di schermo): il ruolo mancante col suo nome, il resto col problema. */
const fullText = ({ problem, role }: Entry, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>) =>
  (role ? needLabel(role as Need, lang) : tipOf(problem, t));

/**
 * I problemi dell'area nella testata, come pillole in una riga sola: prima quelli che i Suggerimenti risolvono, poi i
 * gravi, poi l'ordine delle categorie; quelli che non stanno nel "+N". Senza problemi una pillola verde "Nessun problema".
 * Una pillola è un pulsante (apre il Coaching su di lei) solo se il Coaching ha una proposta per lei; mentre le tappe si
 * calcolano, o senza proposte, mostra solo il tooltip.
 */
function AreaProblems({ area, problems, steps, onCoaching }: {
  area: string; problems: CoachProblem[]; steps: CoachStep[] | null; onCoaching?: (problemKey?: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const sorted = [...problems].sort((a, b) => Number(b.fixes.length > 0) - Number(a.fixes.length > 0)
    || Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const entries: Entry[] = sorted.flatMap(problem => (isMissingRoles(problem) ? problem.subjects!.map(role => ({ problem, role })) : [{ problem }]));
  const listRef = useRef<HTMLUListElement>(null);
  const fit = useFitCount(listRef, entries.length, `${lang}|${entries.map(e => `${e.problem.key}|${e.problem.text}|${e.role ?? ''}`).join('#')}`);
  const hidden = entries.slice(fit);
  // Quali problemi il Coaching sa risolvere (una tappa mostrata li copre) e il numero della tappa, come nella mappa
  const fixable = new Set(onCoaching && steps ? solvable(problems, steps).map(p => p.key) : []);
  const stepOf = steps ? stepNumbers(steps) : new Map<string, number>();
  return (
    <ul ref={listRef} className="area-chips" aria-label={t('analysis.areaProblems', { area })}>
      {entries.length === 0 ? (
        <li><span className="area-chip good"><Icon name="check" />{t('area.problems.clear')}</span></li>
      ) : entries.slice(0, fit).map(entry => (
        <ProblemChip key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} step={stepOf.get(entry.problem.key) ?? null}
          onOpen={fixable.has(entry.problem.key) ? () => onCoaching!(entry.problem.key) : undefined} />
      ))}
      {hidden.length > 0 && <MoreProblems hidden={hidden} />}
    </ul>
  );
}

/**
 * Una pillola: il testo corto del problema (lo stesso della mappa del Coaching) nel colore della gravità. Mouse e fuoco:
 * il tooltip DreamDex col problema intero e, se una tappa lo copre, quale. `onOpen`: il Coaching ha una proposta, la
 * pillola è un pulsante che lo apre su questo problema; senza, si raggiunge col Tab solo per il tooltip.
 */
function ProblemChip({ entry, step, onOpen }: { entry: Entry; step: number | null; onOpen?: () => void }) {
  const t = useT();
  const tip = useFloatAnchor<true>();
  const descId = useId();
  const { problem, role } = entry;
  // Il problema intero (anche per un ruolo mancante: la frase con tutti i ruoli che mancano)
  const full = tipOf(problem, t);
  const covered = step !== null ? t('coach.map.coveredBy', { n: step }) : null;
  const props = { className: `area-chip ${problem.severity}${onOpen ? ' is-link' : ''}`, 'data-key': problem.key, 'aria-describedby': descId, ...tip.bind(true) };
  const content = <><Icon name="warning" /><ProblemPill problem={problem} role={role} /></>;
  return (
    <li>
      {onOpen
        ? <button type="button" {...props} onClick={onOpen}>{content}</button>
        : <span tabIndex={0} {...props}>{content}</span>}
      {/* Il tooltip è solo visivo: le stesse parole ai lettori di schermo, e dove porta il pulsante */}
      <HiddenText id={descId}>{[full, covered, onOpen ? t('overview.fix.go') : ''].filter(Boolean).join(' · ')}</HiddenText>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={problem.severity === 'serious' ? 'var(--bad)' : 'var(--warn)'} className="kot area-chip-tip">
          <p className="kot-none"><Typed text={full} /></p>
          {covered && <p className="area-chip-by">{covered}</p>}
        </FloatTip>
      )}
    </li>
  );
}

/**
 * Il "+N" in fondo alle pillole: quelle che non stanno in riga, nel tooltip DreamDex col mouse e col fuoco; per lo screen
 * reader sono scritte nel testo nascosto.
 */
function MoreProblems({ hidden }: { hidden: Entry[] }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<true>();
  const serious = hidden.some(e => e.problem.severity === 'serious');
  const texts = hidden.map(e => fullText(e, t, lang));
  return (
    <li className="area-chips-more" tabIndex={0} {...tip.bind(true)}>
      <span aria-hidden="true">+{hidden.length}</span>
      <span className="visually-hidden">{t(hidden.length === 1 ? 'area.problems.moreOne' : 'area.problems.moreMany', { n: hidden.length })} {texts.join('; ')}</span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={serious ? 'var(--bad)' : 'var(--warn)'} className="kot">
          {hidden.map((e, i) => <p key={`${e.problem.key}|${e.role ?? ''}`} className="kot-none"><Typed text={texts[i]} /></p>)}
        </FloatTip>
      )}
    </li>
  );
}
