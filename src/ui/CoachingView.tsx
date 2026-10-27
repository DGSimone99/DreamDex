import { Fragment, useId, type ReactNode } from 'react';
import { PROBLEM_CATEGORIES, type CoachAdvice, type Coaching, type CoachProblem, type ProblemCategory } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { needLabel, type Need } from '../engine/needs';
import { columnOf, MAX_STEPS, type CoachStep, type MapColumn } from '../engine/coachSteps';
import type { MoveFix } from '../engine/moveFixes';
import type { TeamRating } from '../engine/rating';
import { t, type MessageKey } from '../i18n';
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
  return (
    <>
      {text.split(count).map((part, i) => (i % 2 === 1
        ? <span key={i} className={resist.some(w => part.endsWith(` ${w}`)) ? 'count-resist' : 'count-weak'}>{part}</span>
        : plain ? <Fragment key={i}>{part}</Fragment> : <Typed key={i} text={part} />))}
    </>
  );
}

/** Un testo del dizionario con dei pezzi al posto dei segnaposto ({member}, {species}…). */
function Template({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  return <>{text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 1 ? <Fragment key={i}>{parts[piece]}</Fragment> : piece))}</>;
}

/** Il corpo di una proposta: sprite, una riga piccola (chi cambia) e il nome grande col voto in più. */
function FixBody({ sprite, lead, name, gain, title }: { sprite: string; lead: ReactNode; name: string; gain: number; title?: string }) {
  return (
    <>
      <span className="coach-fix-sprite"><Sprite species={sprite} size={56} /></span>
      <span className="coach-fix-text">
        <span className="coach-fix-lead" title={title}>{lead}</span>{' '}
        <span className="coach-fix-main"><strong>{name}</strong> <span className="coach-gain">+{gain}</span></span>
      </span>
    </>
  );
}

/** Un cambio di Pokémon: "Al posto di X" / "Aggiungi", poi Y in grande col voto in più; apre la scheda Pokémon su di lui. */
function SwapButton({ fix, onFix }: { fix: CoachFix; onFix: (fix: CoachFix) => void }) {
  const tr = useT();
  const gain = `+${fix.gain}`;
  const label = fix.kind === 'add'
    ? tr('coach.fixAddAria', { species: fix.species, gain })
    : tr('coach.fixSwapAria', { member: fix.member ?? '', species: fix.species, gain });
  const lead = fix.kind === 'add'
    ? tr('coach.steps.add')
    : <Template text={tr('coach.steps.swap')} parts={{ member: <b>{fix.member}</b> }} />;
  return (
    <button type="button" className="coach-fix" aria-label={label} onClick={() => onFix(fix)}>
      <FixBody sprite={fix.species} lead={lead} name={fix.species} gain={fix.gain} />
    </button>
  );
}

/** Un cambio di mossa: "Dai a Y · al posto di Z", poi la mossa in grande col voto in più. */
function MoveButton({ fix, onMoveFix }: { fix: MoveFix; onMoveFix: (fix: MoveFix) => void }) {
  const tr = useT();
  const lang = useLang();
  const to = gameName('move', fix.to, lang);
  const from = fix.from ? tr('coach.steps.moveFrom', { from: gameName('move', fix.from, lang) }) : '';
  const lead = <><Template text={tr('coach.steps.move')} parts={{ member: <b>{fix.member}</b> }} />{from && <span className="coach-fix-from"> · {from}</span>}</>;
  return (
    <button type="button" className="coach-fix" aria-label={tr('coach.steps.moveAria', { move: to, member: fix.member, gain: `+${fix.gain}` })} onClick={() => onMoveFix(fix)}>
      <FixBody sprite={fix.member} lead={lead} name={to} gain={fix.gain} title={`${tr('coach.steps.move', { member: fix.member })}${from ? ` · ${from}` : ''}`} />
    </button>
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
 */
function Also({ solves, skip, problems }: { solves: string[]; skip: string; problems: CoachProblem[] }) {
  const tr = useT();
  const lang = useLang();
  const types: string[] = [];
  const threats: string[] = [];
  const names: string[] = [];
  const add = (list: string[], value: string) => { if (!list.includes(value)) list.push(value); };
  for (const key of new Set(solves)) {
    if (key === skip) continue;
    const problem = problems.find(p => p.key === key);
    if (!problem) continue;
    const subjects = problem.subjects ?? [];
    if (subjects.length === 0) add(names, tr(CATEGORY[problem.category]));
    else if (problem.category === 'defense' || problem.category === 'coverage') subjects.forEach(type => add(types, type));
    else if (problem.category === 'meta') subjects.forEach(species => add(threats, species));
    else if (problem.category === 'roles') subjects.forEach(need => add(names, needLabel(need as Need, lang)));
    else subjects.forEach(subject => add(names, subject));
  }
  if (types.length + threats.length + names.length === 0) return null;
  const check = (species: string) => tr('coach.steps.checkTitle', { species });
  const rest = [...types.slice(ALSO_TYPES).map(type => typeName(type, lang)), ...threats.slice(ALSO_THREATS).map(check), ...names.slice(ALSO_NAMES)];
  return (
    <p className="coach-also">
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
    </p>
  );
}

function Step({ step, index, problems, onFix, onMoveFix }: {
  step: CoachStep; index: number; problems: CoachProblem[]; onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void;
}) {
  const tr = useT();
  const { problem, swap, move } = step;
  return (
    <li className={`coach-step ${problem.severity}`}>
      <span className="coach-step-num">{index + 1}</span>
      <div className="coach-step-body">
        <p className="coach-step-problem">
          <span className="coach-sev">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span> <ProblemText text={problem.text} />
        </p>
        {swap && (
          <div className="coach-prop">
            <SwapButton fix={swap} onFix={onFix} />
            <Also solves={swap.solves} skip={problem.key} problems={problems} />
          </div>
        )}
        {move && (
          <div className="coach-prop is-move" data-or={swap ? tr('coach.steps.or') : undefined}>
            <MoveButton fix={move} onMoveFix={onMoveFix} />
            <Also solves={move.solves} skip={problem.key} problems={problems} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Un problema nella mappa: gravità, icona del tipo o della minaccia, testo. Se una tappa lo copre è attenuato,
 * col numero della tappa in fondo, così non si legge due volte.
 */
function MapProblem({ problem, step }: { problem: CoachProblem; step: number | null }) {
  const tr = useT();
  const subjects = problem.subjects ?? [];
  const threat = problem.category === 'meta' && subjects.length > 0 ? subjects[0] : null;
  const covered = step !== null ? tr('coach.map.coveredBy', { n: step }) : '';
  return (
    <li data-key={problem.key} className={`coach-prob ${problem.severity}${step !== null ? ' is-covered' : ''}`} title={covered || undefined}>
      <span className="coach-sev">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span>
      {threat ? (
        <span className="coach-prob-text is-threat" title={problem.text}>
          <PokemonIcon name={threat} /><strong aria-hidden="true">{threat}</strong><span className="visually-hidden">{problem.text}</span>
        </span>
      ) : (
        <span className="coach-prob-text">
          {problem.category === 'defense' && subjects.length > 0 && <TypeIcons types={subjects} />}
          <ProblemText text={problem.text} plain={problem.category === 'defense' && subjects.length > 0} />
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
 * La scheda Coaching: in alto fino a 3 tappe (cosa farei per prima), sotto la mappa dei problemi per area.
 * `advice` null: i consigli si stanno calcolando (lo scheletro delle tappe; la mappa si vede già).
 */
export function CoachingView({ coaching, advice, members, rating, metaOn, onFix, onMoveFix }: {
  coaching: Coaching; advice: CoachAdvice | null; members: number; rating: TeamRating | null; metaOn: boolean;
  onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void;
}) {
  const tr = useT();
  const id = useId();
  const { problems, bannedCount = 0 } = coaching;
  // Sotto i 2 membri il coach non cerca problemi: l'invito ad aggiungere, non "nessun problema"
  if (members < 2) return <div className="coaching"><p className="coach-note coach-top">{tr('coach.addTwo')}</p></div>;
  const steps = (advice?.steps ?? []).slice(0, MAX_STEPS);
  // Problema → numero della prima tappa mostrata che lo copre (come coveredKeys)
  const stepOf = new Map<string, number>();
  steps.forEach((step, i) => [step.problem.key, ...step.alsoSolves].forEach(key => { if (!stepOf.has(key)) stepOf.set(key, i + 1); }));
  // Gravi prima, poi l'ordine delle categorie (regole per prime)
  const ordered = [...problems].sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious')
    || PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const columnName: Record<MapColumn, string> = {
    defense: tr('coach.map.defense'), offense: tr('coach.map.offense'), roles: tr('coach.map.roles'), rules: tr(metaOn ? 'coach.map.rulesMeta' : 'coach.map.rules'),
  };
  return (
    <div className="coaching">
      {problems.length === 0 && <p className="coach-empty"><Icon name="check" />{tr('coach.noProblems')}</p>}
      {problems.length > 0 && (!advice || steps.length > 0) && (
        <section aria-labelledby={`${id}-steps`} className="coach-steps-region">
          <h3 id={`${id}-steps`} className="coach-sec">{tr('coach.steps.title')}</h3>
          {advice ? (
            <ol className="coach-steps">
              {steps.map((step, i) => <Step key={step.problem.key} step={step} index={i} problems={problems} onFix={onFix} onMoveFix={onMoveFix} />)}
            </ol>
          ) : (
            <>
              <ol className="coach-steps" aria-busy="true">
                {[0, 1, 2].map(i => <li key={i} className="coach-step skeleton" aria-hidden="true" />)}
              </ol>
              <p className="visually-hidden" role="status">{tr('coach.computing')}</p>
            </>
          )}
        </section>
      )}
      {problems.length > 0 && (
        <section aria-labelledby={`${id}-map`} className="coach-map-region">
          <h3 id={`${id}-map`} className="coach-sec muted">{tr('coach.map.title')}</h3>
          <div className="coach-map">
            {COLUMNS.map(({ key, area }) => {
              const items = ordered.filter(p => columnOf(p.category) === key);
              // Ridondanze e minacce (sempre minori) sotto un separatore: l'ordine "gravi prima" resta
              const main = items.filter(p => p.category !== 'redundancy' && p.category !== 'meta');
              const redundancy = items.filter(p => p.category === 'redundancy');
              const threats = items.filter(p => p.category === 'meta');
              const score = area ? rating?.areas.find(a => a.key === area)?.value ?? null : null;
              const row = (p: CoachProblem) => <MapProblem key={`${p.key}|${p.text}`} problem={p} step={stepOf.get(p.key) ?? null} />;
              return (
                <div key={key} role="group" aria-labelledby={`${id}-${key}`} className="dash-card coach-col">
                  <header className="dash-head">
                    <h4 id={`${id}-${key}`} className="dash-plate">{columnName[key]}</h4>
                    {score !== null && <span className="dash-meta"><b>{Math.round(score)}</b></span>}
                  </header>
                  {items.length === 0 && <p className="dash-note good"><Icon name="check" />{tr('coach.map.none')}</p>}
                  {main.length > 0 && <ul className="coach-probs">{main.map(row)}</ul>}
                  {redundancy.length > 0 && (
                    <>
                      <h5 className="coach-sep">{tr('coach.map.redundancy')}</h5>
                      <ul className="coach-probs">{redundancy.map(row)}</ul>
                    </>
                  )}
                  {threats.length > 0 && (
                    <>
                      <h5 className="coach-sep">{tr('dash.todo.threats')}</h5>
                      <ul className="coach-probs">{threats.map(row)}</ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {/* Candidati: chi è nella lista Ban dell'utente non viene proposto, ma si dice quanti sono */}
      {bannedCount > 0 && <p className="coach-note">{tr(bannedCount === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: bannedCount })}</p>}
    </div>
  );
}
