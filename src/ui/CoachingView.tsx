import { Fragment, useId, useState, type CSSProperties, type ReactNode } from 'react';
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
import { PokemonIcon } from './PokemonName';
import { Sprite } from './Sprite';
import { TypeIcons } from './typeIcons';
import { Typed } from './TypeText';

const CATEGORY: Record<ProblemCategory, MessageKey> = {
  rules: 'coach.category.rules', defense: 'coach.category.defense', coverage: 'coach.category.coverage', roles: 'coach.category.roles',
  conditions: 'coach.category.conditions', redundancy: 'coach.category.redundancy', meta: 'coach.category.meta',
};

// "3 Deboli" in rosso e "0 Resistono" in verde (parole del dizionario della lingua attiva), il resto con i tipi colorati;
// `plain`: i tipi senza colore (nella mappa l'icona del tipo è già davanti)
function ProblemText({ text, plain = false }: { text: string; plain?: boolean }) {
  const lang = useLang();
  const weak = [t(lang, 'coach.word.weakOne'), t(lang, 'coach.word.weakMany')];
  const resist = [t(lang, 'coach.word.resistOne'), t(lang, 'coach.word.resistMany')];
  const words = [...new Set([...weak, ...resist])].sort((x, y) => y.length - x.length);
  const count = new RegExp(`(\\d+ (?:${words.join('|')}))(?![\\w])`);
  const parts = text.split(count);
  const render = (part: string, i: number) => (i % 2 === 1
    ? <span key={i} className={resist.some(w => part.endsWith(` ${w}`)) ? 'count-resist' : 'count-weak'}>{part}</span>
    : plain ? <Fragment key={i}>{part}</Fragment> : <Typed key={i} text={part} />);
  // "3 Deboli – 2 Resistono" non si spezza (un trattino a fine riga si legge male)
  const last = parts.length - 2;
  if (last < 1) return <>{parts.map(render)}</>;
  return (
    <>
      {render(parts[0], 0)}
      <span className="coach-counts">{parts.slice(1, last + 1).map((part, i) => render(part, i + 1))}</span>
      {parts.slice(last + 1).map((part, i) => render(part, i + last + 1))}
    </>
  );
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
function Proposal({ className, label, describedBy, solves, onApply, onAlternatives, alternativesFor, onPreview, or, children }: {
  className: string; label: string; describedBy: string; solves: string[]; onApply: () => void; onAlternatives: () => void; alternativesFor: string;
  onPreview: OnPreview; or?: string; children: ReactNode;
}) {
  const tr = useT();
  const alternatives = tr('coach.steps.alternativesAria', { name: alternativesFor });
  return (
    <div className={`coach-prop ${className}`} data-or={or} {...previewHandlers(solves, onPreview)}>
      <button type="button" className="coach-fix" aria-label={label} aria-describedby={describedBy} onClick={onApply}>{children}</button>
      <button type="button" className="coach-alt" aria-label={alternatives} title={tr('coach.steps.alternatives')} onClick={onAlternatives}>
        <Icon name="search" />
      </button>
    </div>
  );
}

/**
 * Un cambio di Pokémon, la proposta principale della striscia: chi esce piccolo e spento, ⇄, chi entra grande e animato
 * col nome e il voto in più (in aggiunta: "Aggiungi" al posto di chi esce). Il suo pulsante copre tutta la striscia.
 */
function SwapProposal({ fix, alsoId, onApply, onFix, onPreview }: {
  fix: CoachFix; alsoId: string; onApply: (fix: CoachFix) => void; onFix: (fix: CoachFix) => void; onPreview: OnPreview;
}) {
  const tr = useT();
  const gain = gainText(fix.gain);
  const label = fix.kind === 'add'
    ? tr('coach.fixAddAria', { species: fix.species, gain })
    : tr('coach.fixSwapAria', { member: fix.member ?? '', species: fix.species, gain });
  return (
    <Proposal className="is-main" label={label} describedBy={alsoId} solves={fix.solves} onApply={() => onApply(fix)} onAlternatives={() => onFix(fix)}
      alternativesFor={fix.species} onPreview={onPreview}>
      {fix.kind === 'swap' ? (
        <>
          <span className="coach-strip-out" title={tr('coach.steps.swap', { member: fix.member ?? '' })}><Sprite species={fix.member ?? ''} size={52} /></span>
          <span className="coach-strip-arrow"><Icon name="swap" /></span>
        </>
      ) : <><span className="coach-strip-add">{tr('coach.steps.add')}</span>{' '}</>}
      <span className="coach-strip-in"><Sprite species={fix.species} size={72} animated /></span>
      <span className="coach-fix-main"><strong>{fix.species}</strong></span>
      <span className="coach-gain">{gain}</span>
    </Proposal>
  );
}

/**
 * Un cambio di mossa: "Dai a Y · al posto di Z", la mossa col voto in più. Da sola è la proposta principale (sprite del
 * membro grande); accanto a uno scambio è l'alternativa "oppure" nella colonna di destra, col suo "risolve anche".
 */
function MoveProposal({ fix, main, alsoId, skip, problems, or, onApply, onMoveFix, onPreview }: {
  fix: MoveFix; main: boolean; alsoId: string; skip: string[]; problems: CoachProblem[]; or?: string;
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
      describedBy={alsoId} solves={fix.solves} onApply={() => onApply(fix)} onAlternatives={() => onMoveFix(fix)} alternativesFor={to} onPreview={onPreview}>
      {main && <span className="coach-strip-in"><Sprite species={fix.member} size={72} /></span>}
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
 * Pokémon; le altre categorie il loro testo (più problemi separati da " · ").
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
 * Puntatore sulla tappa: la mappa mostra tutto quello che le sue proposte risolvono (una proposta: solo il suo).
 */
function Step({ step, index, problems, actions, onCard, onPreview }: {
  step: CoachStep; index: number; problems: CoachProblem[]; actions: StepActions; onCard: OnPreview; onPreview: OnPreview;
}) {
  const tr = useT();
  const alsoId = useId();
  const orId = useId();
  const { problem, swap, move } = step;
  const skip = step.group;
  const solved = [...new Set([...step.group, ...(swap?.solves ?? []), ...(move?.solves ?? [])])];
  return (
    <li className={`coach-step coach-strip ${problem.severity}`} style={{ '--i': index } as CSSProperties}
      onMouseEnter={() => onCard(solved)} onMouseLeave={() => onCard(null)}>
      <span className="coach-step-num">{index + 1}</span>
      <p className="coach-step-problem">
        <span className="coach-sev">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span> <StepTitle step={step} problems={problems} />
      </p>
      {swap ? <SwapProposal fix={swap} alsoId={alsoId} onApply={actions.onApplyFix} onFix={actions.onFix} onPreview={onPreview} />
        : move && <MoveProposal fix={move} main alsoId={alsoId} skip={skip} problems={problems} onApply={actions.onApplyMove} onMoveFix={actions.onMoveFix} onPreview={onPreview} />}
      <div className="coach-strip-extras">
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
 * nel title. Se una tappa lo copre, il numero della tappa in fondo. `preview`: la proposta sotto il puntatore (o col
 * fuoco) lo risolve, quindi si vede barrato in verde. `dim`: ridondanze e minacce, più quiete dei problemi veri.
 */
function MapProblem({ problem, step, preview, usage, dim = false }: { problem: CoachProblem; step: number | null; preview: boolean; usage?: number; dim?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const subjects = problem.subjects ?? [];
  const threat = problem.category === 'meta' && subjects.length > 0 ? subjects[0] : null;
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
          <PokemonIcon name={threat} /><span className="visually-hidden">{problem.text}</span>
          {usage !== undefined && <span className="coach-usage">{formatPercent(lang, usage, 0)}</span>}
        </span>
      ) : counts ? (
        <span className="coach-prob-text">
          <TypeIcons types={subjects} /><span aria-hidden="true">{typeName(subjects[0], lang)}{' '}
            <span className="coach-counts"><span className="count-weak">{counts.weak}↓</span> <span className="count-resist">{counts.resist}↑</span></span>
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

const COLUMNS: { key: MapColumn; area: 'defense' | 'strength' | 'roles' | null }[] = [
  { key: 'defense', area: 'defense' }, { key: 'offense', area: 'strength' }, { key: 'roles', area: 'roles' }, { key: 'rules', area: null },
];

/**
 * La scheda Coaching: in alto i problemi per area (quattro tessere), sotto fino a 3 tappe (cosa farei per prima).
 * `advice` null: i consigli si stanno calcolando (lo scheletro delle tappe; la mappa si vede già).
 */
export function CoachingView({ coaching, advice, members, rating, metaOn, threatUsage, onFix, onMoveFix, onApplyFix, onApplyMove }: {
  coaching: Coaching; advice: CoachAdvice | null; members: number; rating: TeamRating | null; metaOn: boolean;
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
  // Sotto i 2 membri il coach non cerca problemi: l'invito ad aggiungere, non "nessun problema"
  if (members < 2) return <div className="coaching"><p className="coach-note coach-top">{tr('coach.addTwo')}</p></div>;
  const steps = (advice?.steps ?? []).slice(0, MAX_STEPS);
  // Problema → numero della prima tappa mostrata che lo copre
  const stepOf = stepNumbers(steps);
  // Gravi prima, poi l'ordine delle categorie (regole per prime)
  const ordered = [...problems].sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const columnName: Record<MapColumn, string> = {
    defense: tr('coach.map.defense'), offense: tr('coach.map.offense'), roles: tr('coach.map.roles'), rules: tr(metaOn ? 'coach.map.rulesMeta' : 'coach.map.rules'),
  };
  return (
    <div className="coaching">
      {problems.length === 0 && <p className="coach-empty"><Icon name="check" />{tr('coach.noProblems')}</p>}
      {problems.length > 0 && (
        <section aria-labelledby={`${id}-map`} className="coach-map-region">
          <h3 id={`${id}-map`} className="coach-sec muted">{tr('coach.map.title')}</h3>
          <div className="coach-map">
            {COLUMNS.map(({ key, area }) => {
              const items = ordered.filter(p => columnOf(p.category) === key);
              // Ridondanze e minacce (sempre minori) sotto un'etichetta, più quiete: l'ordine "gravi prima" resta
              const main = items.filter(p => p.category !== 'redundancy' && p.category !== 'meta');
              const redundancy = items.filter(p => p.category === 'redundancy');
              const threats = items.filter(p => p.category === 'meta');
              const score = area ? rating?.areas.find(a => a.key === area)?.value ?? null : null;
              const clean = items.length === 0;
              const row = (p: CoachProblem, dim = false) => <MapProblem key={`${p.key}|${p.text}`} problem={p} step={stepOf.get(p.key) ?? null} preview={preview?.has(p.key) ?? false}
                usage={p.category === 'meta' ? threatUsage?.[p.subjects?.[0] ?? ''] : undefined} dim={dim} />;
              return (
                <div key={key} role="group" aria-labelledby={`${id}-${key}`} className={`coach-tile${clean ? ' is-clean' : ''}`}
                  style={score !== null ? { '--score': `${Math.max(0, Math.min(100, score))}%` } as CSSProperties : undefined}>
                  <header className="coach-tile-head">
                    <h4 id={`${id}-${key}`} className="dash-plate">{columnName[key]}</h4>
                    {score !== null && <span className="dash-meta"><b>{Math.round(score)}</b></span>}
                  </header>
                  {score !== null && <span className="coach-tile-bar" aria-hidden="true" />}
                  {clean && <p className="coach-tile-ok"><Icon name="check" />{tr('coach.map.none')}</p>}
                  {main.length > 0 && <ul className="coach-probs">{main.map(p => row(p))}</ul>}
                  {redundancy.length > 0 && (
                    <>
                      <h5 className="coach-sep">{tr('coach.map.redundancy')}</h5>
                      <ul className="coach-probs">{redundancy.map(p => row(p, true))}</ul>
                    </>
                  )}
                  {threats.length > 0 && (
                    <>
                      <h5 className="coach-sep">{tr('dash.todo.threats')}</h5>
                      <ul className="coach-probs">{threats.map(p => row(p, true))}</ul>
                    </>
                  )}
                </div>
              );
            })}
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
