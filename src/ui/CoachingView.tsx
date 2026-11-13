import { Fragment, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { PROBLEM_CATEGORIES, type CoachAdvice, type Coaching, type CoachProblem, type ProblemCategory } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { needLabel, type Need } from '../engine/needs';
import { columnOf, MAX_STEPS, stepNumbers, type CoachStep, type MapColumn } from '../engine/coachSteps';
import type { MoveFix } from '../engine/moveFixes';
import type { TeamRating } from '../engine/rating';
import { formatPercent, t, type MessageKey } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { EeveeMoment } from './EeveeMoment';
import { PokemonIcon } from './PokemonName';
import { Sprite } from './Sprite';
import { TypeIcons } from './typeIcons';
import { Typed } from './TypeText';
import { useFitCount } from './useFit';
import { rolesValue } from './AreaDetail';
import { DashLink } from './dashboard/DashCard';

const CATEGORY: Record<ProblemCategory, MessageKey> = {
  rules: 'coach.category.rules', defense: 'coach.category.defense', coverage: 'coach.category.coverage', roles: 'coach.category.roles',
  conditions: 'coach.category.conditions', redundancy: 'coach.category.redundancy', meta: 'coach.category.meta', metaHit: 'coach.category.metaHit',
};

// I tipi colorati; `plain`: senza colore (nella mappa l'icona del tipo è già davanti)
function ProblemText({ text, plain = false }: { text: string; plain?: boolean }) {
  return plain ? <>{text}</> : <Typed text={text} />;
}

/** Un testo del dizionario con dei pezzi al posto dei segnaposto ({member}, {species}…). */
function Template({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  return <>{text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 1 ? <Fragment key={i}>{parts[piece]}</Fragment> : piece))}</>;
}

/** Il voto in più di una proposta: "+3", a pari voto "±0" (mai "+0"). */
export const gainText = (gain: number) => (gain > 0 ? `+${gain}` : gain < 0 ? `−${-gain}` : '±0');

/** Anteprima nella mappa: i problemi risolti (`solves`), `null` per toglierla. */
type OnPreview = (solves: string[] | null) => void;

/** I gestori dell'anteprima: entrata e fuoco la accendono, uscita e perdita del fuoco la spengono. */
const previewHandlers = (solves: string[], onPreview: OnPreview) => ({
  onMouseEnter: () => onPreview(solves), onMouseLeave: () => onPreview(null),
  onFocus: () => onPreview(solves), onBlur: () => onPreview(null),
});

/**
 * Una proposta: il pulsante che applica il cambio (`children`) e, accanto, l'icona piccola che apre le alternative
 * (scheda Pokémon o editor). Puntatore o fuoco: anteprima nella mappa. `describedBy`: la riga "risolve anche".
 */
function Proposal({ className, label, title, describedBy, solves, onApply, onAlternatives, alternativesFor, onPreview, or, children }: {
  className: string; label: string; title?: string; describedBy: string; solves: string[]; onApply: () => void; onAlternatives: () => void; alternativesFor: string;
  onPreview: OnPreview; or?: string; children: ReactNode;
}) {
  const tr = useT();
  const alternatives = tr('coach.steps.alternativesAria', { name: alternativesFor });
  return (
    <div className={`coach-prop ${className}`} data-or={or} {...previewHandlers(solves, onPreview)}>
      <button type="button" className="coach-fix" aria-label={label} aria-describedby={describedBy} title={title} onClick={onApply}>{children}</button>
      <button type="button" className="coach-alt" aria-label={alternatives} title={tr('coach.steps.alternatives')} onClick={onAlternatives}>
        <Icon name="search" />
      </button>
    </div>
  );
}

/**
 * Un cambio di Pokémon, la proposta principale della striscia: chi esce piccolo e spento, ⇄, chi entra grande (animato
 * solo con la striscia sotto il puntatore o col fuoco: `animated`) col nome e il voto in più (in aggiunta: "Aggiungi" al posto di chi esce). Il suo pulsante copre tutta la striscia.
 */
function SwapProposal({ fix, alsoId, solves, animated, onApply, onFix, onPreview }: {
  fix: CoachFix; alsoId: string; solves: string[]; animated: boolean; onApply: (fix: CoachFix) => void; onFix: (fix: CoachFix) => void; onPreview: OnPreview;
}) {
  const tr = useT();
  const gain = gainText(fix.gain);
  const label = fix.kind === 'add'
    ? tr('coach.fixAddAria', { species: fix.species, gain })
    : tr('coach.fixSwapAria', { member: fix.member ?? '', species: fix.species, gain });
  return (
    // Il pulsante copre la striscia: il suo title dice chi esce (lo sprite spento da solo non lo dice)
    <Proposal className="is-main" label={label} title={fix.kind === 'swap' ? `${tr('coach.steps.swap', { member: fix.member ?? '' })} → ${fix.species}` : `${tr('coach.steps.add')} ${fix.species}`}
      describedBy={alsoId} solves={solves} onApply={() => onApply(fix)} onAlternatives={() => onFix(fix)}
      alternativesFor={fix.species} onPreview={onPreview}>
      {fix.kind === 'swap' ? (
        <>
          <span className="coach-strip-out"><Sprite species={fix.member ?? ''} size={48} /></span>
          <span className="coach-strip-arrow"><Icon name="swap" /></span>
        </>
      ) : <><span className="coach-strip-add">{tr('coach.steps.add')}</span>{' '}</>}
      <span className="coach-strip-in"><Sprite species={fix.species} size={64} animated={animated} /></span>
      <span className="coach-fix-main"><strong>{fix.species}</strong></span>
      <span className="coach-gain">{gain}</span>
    </Proposal>
  );
}

/**
 * Un cambio di mossa: "Dai a Y · al posto di Z", la mossa col voto in più. Da sola è la proposta principale (sprite del
 * membro grande); accanto a uno scambio è l'alternativa "oppure" nella colonna di destra, col suo "risolve anche".
 */
function MoveProposal({ fix, main, alsoId, solves = fix.solves, skip, problems, or, onApply, onMoveFix, onPreview }: {
  fix: MoveFix; main: boolean; alsoId: string; solves?: string[]; skip: string[]; problems: CoachProblem[]; or?: string;
  onApply: (fix: MoveFix) => void; onMoveFix: (fix: MoveFix) => void; onPreview: OnPreview;
}) {
  const tr = useT();
  const lang = useLang();
  const to = gameName('move', fix.to, lang);
  const from = fix.from ? tr('coach.steps.moveFrom', { from: gameName('move', fix.from, lang) }) : '';
  const lead = <><Template text={tr('coach.steps.move')} parts={{ member: <b>{fix.member}</b> }} />{from && ` · ${from}`}</>;
  const title = `${tr('coach.steps.move', { member: fix.member })}${from ? ` · ${from}` : ''}`;
  return (
    <Proposal className={main ? 'is-main is-move' : 'is-move is-or'} or={or} label={tr('coach.steps.moveAria', { move: to, member: fix.member, gain: gainText(fix.gain) })}
      title={main ? title : undefined} describedBy={alsoId} solves={solves} onApply={() => onApply(fix)} onAlternatives={() => onMoveFix(fix)} alternativesFor={to} onPreview={onPreview}>
      {main && <span className="coach-strip-in"><Sprite species={fix.member} size={64} /></span>}
      <span className="coach-fix-text">
        <span className="coach-fix-lead" title={title}>{lead}</span>
        <span className="coach-fix-main"><strong>{to}</strong> <span className="coach-gain">{gainText(fix.gain)}</span></span>
        {!main && <Also id={alsoId} solves={fix.solves} skip={skip} problems={problems} />}
      </span>
    </Proposal>
  );
}

/** Quanti tipi, minacce e nomi si vedono nella riga "risolve anche"; il resto finisce nel "+N". */
const ALSO_TYPES = 4;
const ALSO_THREATS = 2;
const ALSO_NAMES = 1;

/**
 * "Risolve anche": cosa risolve la proposta oltre al problema della tappa, in una riga corta: tipi come icone,
 * minacce come "check" + icona (il nome nudo accanto al candidato si leggerebbe come il candidato stesso),
 * ruoli, membri e aree come nomi; quello che non sta va nel "+N". Niente riga se non c'è altro.
 * `skip`: i problemi già nel titolo della tappa. `self`: il candidato della proposta, che non si dice "check" di sé stesso.
 */
function Also({ id, solves, skip, problems, self }: { id: string; solves: string[]; skip: string[]; problems: CoachProblem[]; self?: string }) {
  const tr = useT();
  const lang = useLang();
  const types: string[] = [];
  const threats: string[] = [];
  const names: string[] = [];
  const add = (list: string[], value: string) => { if (!list.includes(value)) list.push(value); };
  for (const key of new Set(solves)) {
    if (skip.includes(key)) continue;
    const problem = problems.find(p => p.key === key);
    if (!problem) continue;
    const subjects = problem.subjects ?? [];
    if (problem.category === 'meta' && self && subjects.includes(self)) continue;
    if (subjects.length === 0) add(names, tr(CATEGORY[problem.category]));
    else if (problem.category === 'defense' || problem.category === 'coverage') subjects.forEach(type => add(types, type));
    else if (problem.category === 'meta') subjects.forEach(species => add(threats, species));
    else if (problem.category === 'roles') subjects.forEach(need => add(names, needLabel(need as Need, lang)));
    else subjects.forEach(subject => add(names, subject));
  }
  // Niente da dire: un segnaposto vuoto (il pulsante lo cita in aria-describedby)
  if (types.length + threats.length + names.length === 0) return <span id={id} hidden />;
  const check = (species: string) => tr('coach.steps.checkTitle', { species });
  const rest = [...types.slice(ALSO_TYPES).map(type => typeName(type, lang)), ...threats.slice(ALSO_THREATS).map(check), ...names.slice(ALSO_NAMES)];
  return (
    <span className="coach-also" id={id}>
      <span className="coach-also-label">{tr('coach.steps.also')}</span>
      {types.slice(0, ALSO_TYPES).map(type => (
        <span key={type} className="coach-also-item" title={typeName(type, lang)}>
          <TypeIcons types={[type]} /><span className="visually-hidden">{typeName(type, lang)}</span>
        </span>
      ))}
      {threats.length > 0 && (
        <span className="coach-also-item">
          <span aria-hidden="true">{tr('coach.steps.check')}</span>
          {threats.slice(0, ALSO_THREATS).map(species => (
            <span key={species} className="coach-also-mon" title={check(species)}>
              <PokemonIcon name={species} /><span className="visually-hidden">{check(species)}</span>
            </span>
          ))}
        </span>
      )}
      {names.slice(0, ALSO_NAMES).map(name => <span key={name} className="coach-also-item coach-also-name">{name}</span>)}
      {rest.length > 0 && (
        <span className="coach-also-more" title={tr('coach.steps.moreTitle', { names: rest.join(' · ') })}>
          <span aria-hidden="true">+{rest.length}</span><span className="visually-hidden">{rest.join(', ')}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Il titolo di una tappa: il suo problema e quelli raggruppati con lui (`group`). Le debolezze diventano
 * "Debole a" coi tipi (icona e nome, senza i conteggi, che restano nella mappa), le minacce "Nessun check per" coi
 * Pokémon, i ruoli mancanti "Manca" coi ruoli; le altre categorie il loro testo (più problemi separati da " · ").
 */
function StepTitle({ step, problems }: { step: CoachStep; problems: CoachProblem[] }) {
  const tr = useT();
  const lang = useLang();
  const { problem } = step;
  const group = step.group.map(key => (key === problem.key ? problem : problems.find(p => p.key === key))).filter(p => p !== undefined);
  const subjects = group.flatMap(p => p.subjects ?? []);
  const list = (items: ReactNode[]) => items.map((item, i) => <Fragment key={i}>{i > 0 && ', '}{item}</Fragment>);
  if (problem.category === 'defense' && subjects.length === group.length) {
    return <>{tr('coach.steps.weakTo')} {list(subjects.map(type => (
      <span className="coach-step-subject"><TypeIcons types={[type]} />{typeName(type, lang)}</span>
    )))}</>;
  }
  if (group.every(isMissingRoles)) {
    return <>{tr('coach.steps.missing')} {list(subjects.map(need => needLabel(need as Need, lang)))}</>;
  }
  if (problem.category === 'meta' && subjects.length === group.length) {
    return <>{tr('coach.steps.noCheck')} {list(subjects.map(species => (
      <span className="coach-step-subject is-mon"><PokemonIcon name={species} />{species}</span>
    )))}</>;
  }
  return <>{group.map((p, i) => <Fragment key={p.key}>{i > 0 && ' · '}<ProblemText text={p.text} /></Fragment>)}</>;
}

/** Le azioni sulle proposte: applicare (clic) e aprire le alternative (icona). */
interface StepActions {
  onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void; onApplyFix: (fix: CoachFix) => void; onApplyMove: (fix: MoveFix) => void;
}

/**
 * Una tappa, come striscia a tutta larghezza: numero sulla lama, problema, la proposta principale (scambio, o la mossa
 * se è sola) il cui pulsante copre tutta la striscia, a destra "risolve anche" e l'eventuale mossa "oppure".
 * Puntatore sulla striscia (cioè sul pulsante principale): la mappa mostra tutto quello che le sue proposte risolvono;
 * sulla mossa "oppure": solo il suo.
 */
function Step({ step, index, problems, actions, onCard, onPreview }: {
  step: CoachStep; index: number; problems: CoachProblem[]; actions: StepActions; onCard: OnPreview; onPreview: OnPreview;
}) {
  const tr = useT();
  const alsoId = useId();
  const orId = useId();
  // Striscia sotto il puntatore o col fuoco dentro: chi entra si anima
  const [hot, setHot] = useState(false);
  const { problem, swap, move } = step;
  const skip = step.group;
  const solved = [...new Set([...step.group, ...(swap?.solves ?? []), ...(move?.solves ?? [])])];
  return (
    <li className={`coach-step coach-strip ${problem.severity}`}
      onMouseEnter={() => { onCard(solved); setHot(true); }} onMouseLeave={() => { onCard(null); setHot(false); }}
      onFocus={() => setHot(true)} onBlur={() => setHot(false)}>
      <span className="coach-step-num">{index + 1}</span>
      <p className="coach-step-problem">
        <span className="coach-sev">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span> <StepTitle step={step} problems={problems} />
      </p>
      {swap ? <SwapProposal fix={swap} alsoId={alsoId} solves={solved} animated={hot} onApply={actions.onApplyFix} onFix={actions.onFix} onPreview={onPreview} />
        : move && <MoveProposal fix={move} main alsoId={alsoId} solves={solved} skip={skip} problems={problems} onApply={actions.onApplyMove} onMoveFix={actions.onMoveFix} onPreview={onPreview} />}
      {/* La colonna di destra fa parte della striscia: un clic fuori dai suoi pulsanti applica la proposta principale (da tastiera c'è il pulsante) */}
      <div className="coach-strip-extras" onClick={e => {
        if ((e.target as Element).closest('button')) return;
        if (swap) actions.onApplyFix(swap);
        else if (move) actions.onApplyMove(move);
      }}>
        <Also id={alsoId} solves={swap?.solves ?? move?.solves ?? []} skip={skip} problems={problems} self={swap?.species} />
        {swap && move && (
          <MoveProposal fix={move} main={false} alsoId={orId} skip={skip} problems={problems} or={tr('coach.steps.or')}
            onApply={actions.onApplyMove} onMoveFix={actions.onMoveFix} onPreview={onPreview} />
        )}
      </div>
    </li>
  );
}

/**
 * Un problema nella tessera della sua area, come pillola: bordo del colore della gravità (la gravità detta solo ai
 * lettori di schermo), icona del tipo o della minaccia, testo; le debolezze in breve ("Terra 3↓ 1↑"). Il testo intero
 * nel title; un ruolo mancante (`role`) con la ×. Se una tappa lo copre, il numero della tappa in fondo. `preview`: la proposta sotto il puntatore (o col
 * fuoco) lo risolve, quindi si vede barrato in verde. `dim`: ridondanze e minacce, più quiete dei problemi veri.
 */
function MapProblem({ problem, step, preview, usage, dim = false, role }: {
  problem: CoachProblem; step: number | null; preview: boolean; usage?: number; dim?: boolean;
  /** Per i ruoli mancanti: il ruolo di questa pillola (una pillola per ruolo, tutte con la chiave del problema) */
  role?: string;
}) {
  const tr = useT();
  const lang = useLang();
  const subjects = problem.subjects ?? [];
  const threat = isThreat(problem) && subjects.length > 0 ? subjects[0] : null;
  const covered = step !== null ? tr('coach.map.coveredBy', { n: step }) : '';
  // Difesa e coverage: le icone dei tipi davanti, il testo senza colori (il tipo non si legge due volte)
  const typed = (problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0;
  const counts = problem.category === 'defense' && subjects.length === 1 ? problem.counts : undefined;
  const title = covered ? `${problem.text} · ${covered}` : problem.text;
  return (
    <li data-key={problem.key} title={title}
      className={`coach-prob ${problem.severity}${dim ? ' is-dim' : ''}${step !== null ? ' is-covered' : ''}${preview ? ' is-solved-preview' : ''}`}>
      <span className="coach-sev visually-hidden">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span>
      {threat ? (
        <span className="coach-prob-text is-threat">
          <PokemonIcon name={threat} /><span className="coach-threat-name" aria-hidden="true">{threat}</span><span className="visually-hidden">{problem.text}</span>
          {usage !== undefined && <span className="coach-usage">{formatPercent(lang, usage, 0)}</span>}
        </span>
      ) : role ? (
        <span className="coach-prob-text coach-miss"><Icon name="close" />{needLabel(role as Need, lang)}</span>
      ) : counts ? (
        <span className="coach-prob-text">
          <TypeIcons types={subjects} /><span aria-hidden="true">{typeName(subjects[0], lang)}{' '}
            <span className="coach-counts">· <span className={counts.held ? 'count-resist' : 'count-weak'}>{tr(counts.held === 0 ? 'coach.pill.held0' : counts.held === 1 ? 'coach.pill.held1' : 'coach.pill.heldN', { n: counts.held })}</span></span>
          </span><span className="visually-hidden">{problem.text}</span>
        </span>
      ) : (
        <span className="coach-prob-text">
          {typed && <TypeIcons types={subjects} />}
          <ProblemText text={problem.text} plain={typed} />
        </span>
      )}
      {step !== null && <span className="coach-by"><span aria-hidden="true">{step}</span><span className="visually-hidden">{covered}</span></span>}
    </li>
  );
}

/** I problemi "ruoli mancanti" (essenziali o importanti) coi ruoli come soggetti. */
const isMissingRoles = (p: CoachProblem) => p.category === 'roles' && (p.key === 'roles:essential' || p.key === 'roles:important') && (p.subjects?.length ?? 0) > 0;

/** Cosa mostra la scheda che il "+N" di ogni colonna apre (Regole·Meta: la scheda Meta, solo le minacce). */
const OPENS: Record<MapColumn, ProblemCategory[]> = { defense: ['defense', 'meta'], offense: ['coverage', 'metaHit'], roles: ['roles'], rules: [] };

/** Le minacce del meta: chi nessuno regge (Difesa) e chi nessuno manda KO (Offesa), come righe con l'icona del Pokémon. */
const isThreat = (p: CoachProblem) => p.category === 'meta' || p.category === 'metaHit';

const COLUMNS: { key: MapColumn; area: 'defense' | 'strength' | 'roles' | null }[] = [
  { key: 'defense', area: 'defense' }, { key: 'offense', area: 'strength' }, { key: 'roles', area: 'roles' }, { key: 'rules', area: null },
];

/**
 * Una tessera della mappa: targa, voto, barretta e i problemi della colonna come pillole. Le pillole che non stanno
 * nell'altezza della tessera finiscono in un "+N" (title e testo nascosto con tutte): prima restano quelle risolvibili
 * (rimedi o una tappa mostrata), poi i gravi, poi l'ordine di `items`. Ridondanze e minacce sotto un'etichetta, più quiete.
 */
function MapTile({ id, name, items, score, count, stepOf, preview, threatUsage, watch, onMore, opens = [] }: {
  id: string; name: string; items: CoachProblem[]; score: number | null;
  /** Il "+N" come link alla scheda dell'area (assente: resta una nota, es. Regole col meta spento). */
  onMore?: () => void;
  /** Le categorie che la scheda aperta da `onMore` mostra: se un problema nascosto non ci sta, il "+N" resta una nota. */
  opens?: ProblemCategory[];
  /** Al posto del voto, senza barretta: i Ruoli coperti sul totale ("7/9"). */
  count?: string; stepOf: Map<string, number>; preview: Set<string> | null;
  threatUsage?: Record<string, number>;
  /** Il contenitore del Coaching: quando cambia misura si rimisura (la tessera stessa si stringe col contenuto). */
  watch: RefObject<HTMLElement | null>;
}) {
  const tr = useT();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  type Section = 'main' | 'redundancy' | 'meta';
  const sectionOf = (p: CoachProblem): Section => (p.category === 'redundancy' ? 'redundancy' : isThreat(p) ? 'meta' : 'main');
  // Ruoli mancanti: una pillola per ruolo (possono riempirli Pokémon diversi), senza la frase davanti
  const pills = items.flatMap(p => (isMissingRoles(p) ? (p.subjects ?? []).map(role => ({ p, role })) : [{ p, role: undefined as string | undefined }]))
    .map((pill, i) => ({ ...pill, i, section: sectionOf(pill.p) }));
  const solvable = (p: CoachProblem) => p.fixes.length > 0 || stepOf.has(p.key);
  const priority = [...pills].sort((a, b) => Number(solvable(b.p)) - Number(solvable(a.p))
    || Number(b.p.severity === 'serious') - Number(a.p.severity === 'serious') || a.i - b.i);
  const fit = useFitCount(ref, pills.length, `${lang}|${pills.map(x => `${x.p.key}|${x.p.text}|${x.role ?? ''}`).join('#')}`, watch);
  const shown = new Set(priority.slice(0, fit).map(x => x.i));
  const hidden = priority.slice(fit);
  const hiddenText = (x: typeof pills[number]) => (x.role ? needLabel(x.role as Need, lang) : x.p.text);
  const row = ({ p, role, section }: typeof pills[number]) => <MapProblem key={`${p.key}|${p.text}|${role ?? ''}`} problem={p} step={stepOf.get(p.key) ?? null}
    preview={preview?.has(p.key) ?? false} usage={isThreat(p) ? threatUsage?.[p.subjects?.[0] ?? ''] : undefined} dim={section !== 'main'} role={role} />;
  const list = (section: Section) => pills.filter(x => x.section === section && shown.has(x.i));
  const [main, redundancy, threats] = [list('main'), list('redundancy'), list('meta')];
  // Difesa: "Nessuno le regge"; Offesa: "Nessuno le manda KO"
  const threatLabel = tr(items.some(p => p.category === 'metaHit') ? 'coach.map.metaHit' : 'dash.todo.threats');
  return (
    <div ref={ref} role="group" aria-labelledby={id} className="coach-tile"
      style={score !== null ? { '--score': `${Math.max(0, Math.min(100, score))}%` } as CSSProperties : undefined}>
      <header className={`coach-tile-head dash-head${onMore ? ' is-link' : ''}`}>
        <h4 id={id} className="dash-plate">{name}</h4>
        {score !== null ? <span className="dash-meta"><b>{Math.round(score)}</b></span> : count && <span className="dash-meta"><b>{count}</b></span>}
        {/* Tutta la barra porta alla scheda dell'area (la freccia è il pulsante) */}
        {onMore && <span className="dash-links"><DashLink area={name} onClick={onMore} /></span>}
      </header>
      {score !== null && <span className="coach-tile-bar" aria-hidden="true" />}
      {main.length > 0 && <ul className="coach-probs">{main.map(row)}</ul>}
      {redundancy.length > 0 && (
        <>
          <h5 className="coach-sep">{tr('coach.map.redundancy')}</h5>
          <ul className="coach-probs">{redundancy.map(row)}</ul>
        </>
      )}
      {threats.length > 0 && (
        <>
          {/* Solo minacce nella tessera: l'etichetta non serve (lo dice la targa), le righe hanno più posto */}
          {pills.some(x => x.section !== 'meta') ? <h5 className="coach-sep">{threatLabel}</h5> : <h5 className="visually-hidden">{threatLabel}</h5>}
          <ul className="coach-probs">{threats.map(row)}</ul>
        </>
      )}
      {hidden.length > 0 && (onMore && hidden.every(x => opens.includes(x.p.category)) ? (
        // "e altri N ›": porta alla scheda dell'area, che li mostra tutti (le minacce: alla scheda Meta)
        <button type="button" className="coach-more is-link" title={hidden.map(hiddenText).join('\n')} onClick={onMore}>
          <span>{tr(hidden.every(x => x.section === 'meta') ? 'coach.map.moreThreats' : 'coach.map.more', { n: hidden.length })}</span><span aria-hidden="true"> ›</span>
          <span className="visually-hidden">{tr(hidden.length === 1 ? 'area.problems.moreOne' : 'area.problems.moreMany', { n: hidden.length })} {hidden.map(hiddenText).join('; ')}</span>
        </button>
      ) : (
        <p className="coach-more" title={hidden.map(hiddenText).join('\n')}>
          <span aria-hidden="true">{tr(hidden.every(x => x.section === 'meta') ? 'coach.map.moreThreats' : 'coach.map.more', { n: hidden.length })}</span>
          <span className="visually-hidden">{tr(hidden.length === 1 ? 'area.problems.moreOne' : 'area.problems.moreMany', { n: hidden.length })} {hidden.map(hiddenText).join('; ')}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * La scheda Coaching: in alto i problemi per area (quattro tessere), sotto fino a 3 tappe (cosa farei per prima).
 * `advice` null: i consigli si stanno calcolando (lo scheletro delle tappe; la mappa si vede già).
 */
export function CoachingView({ coaching, advice, members, rating, threatUsage, onOpen, onFix, onMoveFix, onApplyFix, onApplyMove }: {
  coaching: Coaching; advice: CoachAdvice | null; members: number; rating: TeamRating | null; metaOn: boolean;
  /** Il "+N" di una tessera apre la scheda della sua area (Regole non ne ha: resta una nota). */
  onOpen?: (column: MapColumn) => void;
  /** Uso in % (0-1) delle minacce per specie, mostrato sulle righe "senza check" */
  threatUsage?: Record<string, number>;
} & StepActions) {
  const tr = useT();
  const id = useId();
  // Anteprima nella mappa: la tappa sotto il puntatore, o più precisa la proposta sotto il puntatore o col fuoco.
  // Vale solo per i consigli con cui è nata: applicata una proposta, la tappa sparisce senza "uscita" del puntatore
  const [hover, setHover] = useState<{ advice: CoachAdvice | null; card: string[] | null; prop: string[] | null }>({ advice: null, card: null, prop: null });
  const live = hover.advice === advice ? hover : null;
  const shown = live?.prop ?? live?.card ?? null;
  const preview = shown ? new Set(shown) : null;
  const onCard: OnPreview = card => setHover(h => ({ advice, card, prop: h.advice === advice ? h.prop : null }));
  const onPreview: OnPreview = prop => setHover(h => ({ advice, card: h.advice === advice ? h.card : null, prop }));
  const actions: StepActions = { onFix, onMoveFix, onApplyFix, onApplyMove };
  const { problems, bannedCount = 0 } = coaching;
  const root = useRef<HTMLDivElement>(null);
  // Sotto i 2 membri il coach non cerca problemi: l'invito ad aggiungere, non "nessun problema"
  if (members < 2) return <div className="coaching"><p className="coach-note coach-top">{tr('coach.addTwo')}</p></div>;
  const steps = (advice?.steps ?? []).slice(0, MAX_STEPS);
  // Problema → numero della prima tappa mostrata che lo copre
  const stepOf = stepNumbers(steps);
  // Gravi prima, poi l'ordine delle categorie (regole per prime)
  const ordered = [...problems].sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const cols = COLUMNS.map(c => ({ ...c, items: ordered.filter(p => columnOf(p.category) === c.key) }));
  const tiles = cols.filter(c => c.items.length > 0);
  const clean = cols.filter(c => c.items.length === 0 && c.key !== 'rules');
  // Il valore dell'area nella riga verde: il voto, i Ruoli coperti; senza voto solo il nome
  const valueOf = (c: (typeof cols)[number]): string => {
    if (!rating) return '';
    if (c.key === 'roles') return rolesValue(rating);
    const v = c.area ? rating.areas.find(a => a.key === c.area)?.value : undefined;
    return v === undefined || v === null ? '' : String(Math.round(v));
  };
  const columnName: Record<MapColumn, string> = {
    defense: tr('coach.map.defense'), offense: tr('coach.map.offense'), roles: tr('coach.map.roles'), rules: tr('coach.map.rules'),
  };
  return (
    <div className="coaching" ref={root}>
      {problems.length === 0 && (
        <div className="coach-empty with-eevee">
          <EeveeMoment pose="happy" />
          <p><strong><Icon name="check" />{tr('coach.noProblems')}</strong><span>{tr('coach.noProblemsSub')}</span></p>
        </div>
      )}
      {problems.length > 0 && (
        <section aria-labelledby={`${id}-map`} className="coach-map-region">
          <h3 id={`${id}-map`} className="coach-sec muted">{tr('coach.map.title')}</h3>
          {/* Le aree senza problemi in una riga sola; nella fila restano solo le aree con problemi (Regole·Meta non ha voto: pulita, non si dice) */}
          {clean.length > 0 && (
            <p className="coach-clean"><Icon name="check" />{tr('coach.map.cleanIn')}{' '}
              <b>{clean.map(c => [columnName[c.key], valueOf(c)].filter(Boolean).join(' ')).join(' · ')}</b>
            </p>
          )}
          <div className="coach-map" data-tiles={tiles.length} style={{ '--tiles': tiles.length } as CSSProperties}>
            {tiles.map(({ key, area, items }) => (
              <MapTile key={key} id={`${id}-${key}`} name={columnName[key]} items={items}
                score={area ? rating?.areas.find(a => a.key === area)?.value ?? null : null}
                count={key === 'roles' && rating ? rolesValue(rating) : key === 'rules' ? String(items.length) : undefined} stepOf={stepOf} preview={preview} threatUsage={threatUsage} watch={root}
                onMore={onOpen && key !== 'rules' ? () => onOpen(key) : undefined} opens={OPENS[key]} />
            ))}
          </div>
        </section>
      )}
      {problems.length > 0 && (
        <section aria-labelledby={`${id}-steps`} className="coach-steps-region">
          <h3 id={`${id}-steps`} className="coach-sec">{tr('coach.steps.title')}</h3>
          {advice && steps.length === 0 ? (
            // Nessuna tappa: una riga alta come le tappe, così la mappa non salta
            <p className="coach-steps-none"><Icon name="check" />{tr('coach.steps.none')}</p>
          ) : advice ? (
            <ol className="coach-steps">
              {steps.map((step, i) => <Step key={step.problem.key} step={step} index={i} problems={problems} actions={actions} onCard={onCard} onPreview={onPreview} />)}
            </ol>
          ) : (
            <>
              <ol className="coach-steps" aria-busy="true">
                {[0, 1, 2].map(i => <li key={i} className="coach-step coach-strip skeleton" aria-hidden="true" />)}
              </ol>
              <p className="visually-hidden" role="status">{tr('coach.computing')}</p>
            </>
          )}
        </section>
      )}
      {/* Candidati: chi è nella lista Ban dell'utente non viene proposto, ma si dice quanti sono */}
      {bannedCount > 0 && <p className="coach-note">{tr(bannedCount === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: bannedCount })}</p>}
    </div>
  );
}
