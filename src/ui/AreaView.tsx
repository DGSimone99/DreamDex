import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PROBLEM_CATEGORIES, type CoachAdvice, type CoachProblem } from '../engine/coach';
import type { TeamAnalysis } from '../engine/analysis';
import { gradeFor, type TeamRating } from '../engine/rating';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { areaTabs, type AreaKey, type KoFocus } from './AreaDetail';
import { viewLabelKey } from './AnalysisTabs';
import { AreaGuide } from './AreaGuide';
import { solvable } from './dashboard/FixRow';
import { EffSwitch, PanelSwitch } from './effTag';
import { Icon } from './icons';
import { CoachLink } from './CoachLink';
import { isThreat, MoreProblems, problemEntries, ProblemChip, type ProblemEntry } from './ProblemPill';
import { useFitCount } from './useFit';
import { FLIP_TABLES_QUERY, PHONE_QUERY, useMediaQuery } from './useMediaQuery';

/** La scelta dell'interruttore Trick Room nella sessione del browser ("0" spento); senza scelta, o senza memoria, acceso. */
const ROOM_KEY = 'dreamdex.speedTrickRoom';
function readRoomPick(): boolean {
  try { return sessionStorage.getItem(ROOM_KEY) !== '0'; } catch { return true; }
}
function writeRoomPick(on: boolean) {
  try { sessionStorage.setItem(ROOM_KEY, on ? '1' : '0'); } catch { /* senza memoria vale finché la vista resta aperta */ }
}

/**
 * Un'area del voto sulla pagina (scheda di Analisi). In alto una testata sola: a sinistra la lettera del voto dell'area e
 * la sua parola (Ruoli e Bonus non ha un voto solo: niente), poi i problemi dell'area come pillole in una riga (quelli che
 * non stanno nel "+N"), a destra il selettore delle sottoschede (solo i nomi; con una sottoscheda sola non c'è) e il "?".
 * Ogni pillola mostra il problema intero nel tooltip (mouse e fuoco) ed è un pulsante che porta a quello di cui parla
 * (vedi AreaProblems); in fondo alla riga "Sistemalo nel Coaching". Sotto, il dettaglio della sottoscheda scelta a tutta larghezza.
 */
export function AreaView({ rating, area, problems, team, analysis, roomy = false, picked: remembered, onPick, formatId, onCoaching, advice = null, initialFocus = null }: {
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
  /** I consigli del Coaching (null: si stanno calcolando): una pillola porta lì solo se una proposta la risolve. */
  advice?: CoachAdvice | null;
  /** Il dettaglio da accendere all'apertura (una minaccia scelta nella Panoramica); poi la vista lo tiene da sé. */
  initialFocus?: KoFocus | null;
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [own, setOwn] = useState<string | null>(null);
  const picked = remembered !== undefined ? remembered : own;
  const setPickedRaw = (key: string) => (onPick ? onPick(key) : setOwn(key));
  // Il dettaglio evidenziato da una tessera della Generale: si spegne appena si sceglie un'altra sottoscheda
  const [focus, setFocus] = useState<KoFocus | null>(initialFocus);
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
      // (nemmeno una pillola della testata: ne accende un'altra, o la stessa di nuovo)
      if (el?.closest?.('.cm-pages, .ftip, .rob-legend, .area-chip-item, .more-probs-menu') || (el && onBar(e, el))) return;
      setFocus(null);
    };
    const timer = window.setTimeout(() => document.addEventListener('click', clear), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener('click', clear); };
  }, [focus]);
  // Interruttore dell'efficacia: uno per area, lo stesso per Coverage tipi e Coverage meta (spento all'inizio)
  const [effOnly, setEffOnly] = useState<Partial<Record<AreaKey, boolean>>>({});
  // Interruttore Trick Room della Velocità (solo con Trick Room nel team): acceso all'inizio, poi resta com'è stato messo
  // per la sessione, anche cambiando area (la vista si rimonta a ogni area: la scelta sta nella sessione del browser)
  const [trickRoom, setTrickRoomState] = useState(readRoomPick);
  const cards = useMediaQuery(FLIP_TABLES_QUERY);
  // Telefono: in Coverage meta l'interruttore dell'efficacia sta sulla riga di Ordine (lo disegna la sottoscheda)
  const phone = useMediaQuery(PHONE_QUERY);
  const setTrickRoom = (on: boolean) => { setTrickRoomState(on); writeRoomPick(on); };
  // La guida ha la sua sezione: cambiarla non sposta la sottoscheda dietro (null = chiusa)
  const [guide, setGuide] = useState<string | null>(null);
  // Chi ha aperto la guida (il "?" o un link nel pannello): alla chiusura il focus torna lì
  const opener = useRef<HTMLElement | null>(null);
  const openGuide = (key: string) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGuide(key); };
  // I soggetti (minacce, tipi) che sono problemi dell'area: i fogli dal basso di Coverage tipi e meta portano al Coaching
  const subjectKeys = new Map(problems.filter(p => isThreat(p) || p.category === 'defense' || p.category === 'coverage')
    .flatMap(p => (p.subjects ?? []).map(subject => [subject, p.key] as const)));
  const coach = onCoaching ? { keyOf: (subject: string) => subjectKeys.get(subject), go: onCoaching } : undefined;
  const tabs = areaTabs(rating, area, t, lang, { team, analysis, open, roomy, formatId, effOnly: !!effOnly[area], setEffOnly: on => setEffOnly(s => ({ ...s, [area]: on })), trickRoom, guide: openGuide, focus, openFocus, clearFocus: () => setFocus(null), coach });
  // Dove porta una pillola della testata: una minaccia del meta a Coverage meta (la sua colonna accesa, sulle carte il
  // suo foglio), un tipo a Coverage tipi; il resto (Ruoli e Bonus) da nessuna parte (null)
  const jumpOf = (p: CoachProblem): Jump | null => {
    if (area !== 'defense' && area !== 'strength') return null;
    const subject = p.subjects?.[0];
    if (!subject) return null;
    const side = area === 'defense' ? 'defense' as const : 'offense' as const;
    const tab = (key: string) => tabs.find(x => x.key === key);
    if (isThreat(p)) {
      const meta = tab('coverageMeta');
      return meta ? { key: meta.key, place: meta.label, focus: { kind: 'threat', side, species: subject, open: true } } : null;
    }
    if (p.category !== 'defense' && p.category !== 'coverage') return null;
    const types = tab(area === 'defense' ? 'coverageTypes' : 'types');
    return types ? { key: types.key, place: types.label, focus: { kind: 'type', side, type: subject, open: true } } : null;
  };
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
        <AreaProblems area={title} problems={problems} advice={advice} onCoaching={onCoaching} low={grade?.grade === 'C' || grade?.grade === 'D'} lowKey={area === 'strength' ? 'offense' : area === 'defense' || area === 'speed' ? area : null}
          jumpOf={jumpOf} onJump={jump => openFocus(jump.key, jump.focus)} />
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
        {current.effSide && !(phone && current.key === 'coverageMeta') && (
          <span className="panel-switch">
            <EffSwitch side={current.effSide} on={!!effOnly[area]} onChange={on => setEffOnly(s => ({ ...s, [area]: on }))} />
          </span>
        )}
        {/* Nello stesso posto, nella Velocità con Trick Room nel team: le barre in Trick Room (i lenti muovono prima) */}
        {!current.effSide && !!current.roomBy?.length && (
          <span className="panel-switch">
            <PanelSwitch tone="room" on={trickRoom} onChange={setTrickRoom}
              label={`${t('sdetail.room.switch')} · ${current.roomBy.join(', ')}`} title={t('sdetail.room.title')} />
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

/** Dove porta una pillola: la sottoscheda, il suo nome e il dettaglio da accendere. */
type Jump = { key: string; place: string; focus: KoFocus };

/**
 * I problemi dell'area nella testata, come pillole in una riga sola: prima quelli che il Coaching sa risolvere, poi i
 * gravi, poi l'ordine delle categorie; quelli che non stanno nel "+N". Senza problemi una pillola verde "Nessun problema".
 * Una pillola porta a quello di cui parla (`jumpOf`: Coverage meta sulla minaccia, Coverage tipi sul tipo); dove non
 * porta da nessuna parte (Ruoli e Bonus) apre il Coaching sulla prima proposta che la risolve, se una proposta la
 * risolve; se no mostra solo il tooltip. Il "+N" apre la tendina delle pillole nascoste, ognuna con lo stesso salto.
 * Con almeno un problema, in fondo alla riga il link "Sistemalo nel Coaching" (sul problema più in alto che il Coaching
 * sa risolvere, se c'è).
 */
function AreaProblems({ area, problems, advice, onCoaching, low = false, lowKey = null, jumpOf, onJump }: {
  area: string; problems: CoachProblem[]; advice: CoachAdvice | null; onCoaching?: (problemKey?: string) => void;
  /** Voto C o D: senza problemi la pillola non è verde (il voto è basso per la media, non per un buco). */
  low?: boolean;
  /** Le parole della pillola gialla per l'area (Offesa, Difesa, Velocità); le altre la frase comune. */
  lowKey?: 'offense' | 'defense' | 'speed' | null;
  jumpOf: (problem: CoachProblem) => Jump | null;
  onJump: (jump: Jump) => void;
}) {
  const t = useT();
  const lang = useLang();
  const sorted = [...problems].sort((a, b) => Number(b.fixes.length > 0) - Number(a.fixes.length > 0)
    || Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const entries = problemEntries(sorted);
  const listRef = useRef<HTMLUListElement>(null);
  const fit = useFitCount(listRef, entries.length, `${lang}|${entries.map(e => `${e.problem.key}|${e.problem.text}|${e.role ?? ''}`).join('#')}`);
  const hidden = entries.slice(fit);
  // Quali problemi il Coaching sa risolvere: almeno una sua proposta li risolve
  const fixable = new Set(onCoaching && advice ? solvable(problems, advice).map(p => p.key) : []);
  // Il salto di ogni pillola, o il Coaching se lì c'è una proposta per lei
  const actionOf = (entry: ProblemEntry): { run: () => void; place: string; jump: boolean } | null => {
    const jump = jumpOf(entry.problem);
    if (jump) return { run: () => onJump(jump), place: jump.place, jump: true };
    return fixable.has(entry.problem.key) ? { run: () => onCoaching!(entry.problem.key), place: t('analysis.view.coaching'), jump: false } : null;
  };
  const firstFixable = sorted.find(p => fixable.has(p.key))?.key;
  return (
    <div className="area-probs">
      <ul ref={listRef} className="area-chips" aria-label={t('analysis.areaProblems', { area })}>
        {entries.length === 0 ? (
          low
            ? <li><span className="area-chip low">{t(lowKey ? `area.problems.lowAverage.${lowKey}` : 'area.problems.lowAverage')}</span></li>
            : <li><span className="area-chip good"><Icon name="check" />{t('area.problems.clear')}</span></li>
        ) : entries.slice(0, fit).map(entry => {
          const action = actionOf(entry);
          return (
            <ProblemChip key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry}
              onOpen={action?.run} go={action?.jump ? action.place : undefined} />
          );
        })}
        {hidden.length > 0 && (
          <MoreProblems hidden={hidden} onPick={entry => actionOf(entry)?.run()} placeOf={entry => actionOf(entry)?.place ?? null} />
        )}
      </ul>
      {entries.length > 0 && onCoaching && <CoachLink className="area-coach" onClick={() => onCoaching(firstFixable)} />}
    </div>
  );
}
