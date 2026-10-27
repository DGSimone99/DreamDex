import { Fragment, useId, type ReactNode } from 'react';
import { PROBLEM_CATEGORIES, type CoachAdvice, type Coaching, type CoachProblem, type ProblemCategory } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { needLabel, type Need } from '../engine/needs';
import { columnOf, coveredKeys, MAX_STEPS, type CoachStep, type MapColumn } from '../engine/coachSteps';
import type { MoveFix } from '../engine/moveFixes';
import type { TeamRating } from '../engine/rating';
import { t, type MessageKey } from '../i18n';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonName } from './PokemonName';
import { Sprite } from './Sprite';
import { TypeIcons } from './typeIcons';
import { Typed } from './TypeText';

const CATEGORY: Record<ProblemCategory, MessageKey> = {
  rules: 'coach.category.rules', defense: 'coach.category.defense', coverage: 'coach.category.coverage', roles: 'coach.category.roles',
  conditions: 'coach.category.conditions', redundancy: 'coach.category.redundancy', meta: 'coach.category.meta',
};

// "3 Deboli" in rosso e "0 Resistono" in verde (parole del dizionario della lingua attiva), il resto con i tipi colorati
function ProblemText({ text }: { text: string }) {
  const lang = useLang();
  const weak = [t(lang, 'coach.word.weakOne'), t(lang, 'coach.word.weakMany')];
  const resist = [t(lang, 'coach.word.resistOne'), t(lang, 'coach.word.resistMany')];
  const words = [...new Set([...weak, ...resist])].sort((x, y) => y.length - x.length);
  const count = new RegExp(`(\\d+ (?:${words.join('|')}))(?![\\w])`);
  return (
    <>
      {text.split(count).map((part, i) => (i % 2 === 1
        ? <span key={i} className={resist.some(w => part.endsWith(` ${w}`)) ? 'count-resist' : 'count-weak'}>{part}</span>
        : <Typed key={i} text={part} />))}
    </>
  );
}

/** Un testo del dizionario con dei pezzi al posto dei segnaposto ({member}, {species}…). */
function Template({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  return <>{text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 1 ? <Fragment key={i}>{parts[piece]}</Fragment> : piece))}</>;
}

/** Un cambio di Pokémon: sprite, "Al posto di X metti Y" / "Aggiungi Y" e il voto in più; apre la scheda Pokémon su di lui. */
function SwapButton({ fix, onFix }: { fix: CoachFix; onFix: (fix: CoachFix) => void }) {
  const tr = useT();
  const gain = `+${fix.gain}`;
  const label = fix.kind === 'add'
    ? tr('coach.fixAddAria', { species: fix.species, gain })
    : tr('coach.fixSwapAria', { member: fix.member ?? '', species: fix.species, gain });
  const species = <strong>{fix.species}</strong>;
  return (
    <button type="button" className="coach-fix" aria-label={label} onClick={() => onFix(fix)}>
      <Sprite species={fix.species} size={32} />
      <span className="coach-fix-text">
        {fix.kind === 'add'
          ? <Template text={tr('coach.steps.add')} parts={{ species }} />
          : <Template text={tr('coach.steps.swap')} parts={{ member: fix.member ? <PokemonName name={fix.member} /> : null, species }} />}
      </span>
      <span className="coach-gain">{gain}</span>
    </button>
  );
}

/** Un cambio di mossa: "Dai X a Y" (e "al posto di Z"), col voto in più. */
function MoveButton({ fix, onMoveFix }: { fix: MoveFix; onMoveFix: (fix: MoveFix) => void }) {
  const tr = useT();
  const gain = `+${fix.gain}`;
  return (
    <button type="button" className="coach-fix" aria-label={tr('coach.steps.moveAria', { move: fix.to, member: fix.member, gain })} onClick={() => onMoveFix(fix)}>
      <Sprite species={fix.member} size={32} />
      <span className="coach-fix-text">
        <Template text={tr('coach.steps.move')} parts={{ move: <strong>{fix.to}</strong>, member: <PokemonName name={fix.member} /> }} />
        {fix.from && <small> <Template text={tr('coach.steps.moveFrom')} parts={{ from: fix.from }} /></small>}
      </span>
      <span className="coach-gain">{gain}</span>
    </button>
  );
}

/** "Risolve anche": cosa risolve la proposta oltre al problema della tappa (tipi come icone, ruoli, minacce, membri); niente riga se non c'è altro. */
function Also({ solves, skip, problems }: { solves: string[]; skip: string; problems: CoachProblem[] }) {
  const tr = useT();
  const lang = useLang();
  const types: string[] = [];
  const names: string[] = [];
  const add = (list: string[], value: string) => { if (!list.includes(value)) list.push(value); };
  for (const key of new Set(solves)) {
    if (key === skip) continue;
    const problem = problems.find(p => p.key === key);
    if (!problem) continue;
    const subjects = problem.subjects ?? [];
    if (subjects.length === 0) add(names, tr(CATEGORY[problem.category]));
    else if (problem.category === 'defense' || problem.category === 'coverage') subjects.forEach(type => add(types, type));
    else if (problem.category === 'roles') subjects.forEach(need => add(names, needLabel(need as Need, lang)));
    else subjects.forEach(subject => add(names, subject));
  }
  if (types.length === 0 && names.length === 0) return null;
  const typeNames = types.map(type => typeName(type, lang));
  return (
    <p className="coach-also">
      {tr('coach.steps.also')}{' '}
      {types.length > 0 && <><TypeIcons types={types} title={typeNames.join(' · ')} /><span className="visually-hidden">{typeNames.join(', ')}</span></>}
      {types.length > 0 && names.length > 0 && ' · '}
      {names.join(' · ')}
    </p>
  );
}

function Step({ step, index, problems, onFix, onMoveFix }: {
  step: CoachStep; index: number; problems: CoachProblem[]; onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void;
}) {
  const { problem, swap, move } = step;
  return (
    <li className={`coach-step ${problem.severity}`}>
      <span className="coach-step-num">{index + 1}</span>
      <div className="coach-step-body">
        <p className="coach-step-problem"><ProblemText text={problem.text} /></p>
        {swap && (
          <div className="coach-prop">
            <SwapButton fix={swap} onFix={onFix} />
            <Also solves={swap.solves} skip={problem.key} problems={problems} />
          </div>
        )}
        {move && (
          <div className="coach-prop">
            <MoveButton fix={move} onMoveFix={onMoveFix} />
            <Also solves={move.solves} skip={problem.key} problems={problems} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Un problema nella mappa: gravità, icone del tipo o sprite della minaccia, testo; barrato se una tappa lo copre. */
function MapProblem({ problem, covered }: { problem: CoachProblem; covered: boolean }) {
  const tr = useT();
  const subjects = problem.subjects ?? [];
  return (
    <li data-key={problem.key} className={`coach-prob ${problem.severity}${covered ? ' is-covered' : ''}`}>
      <span className="coach-sev">{tr(problem.severity === 'serious' ? 'dash.serious' : 'dash.minor')}</span>
      <span className="coach-prob-text">
        {problem.category === 'defense' && subjects.length > 0 && <TypeIcons types={subjects} />}
        {problem.category === 'meta' && subjects.length > 0 && <Sprite species={subjects[0]} size={28} />}
        <ProblemText text={problem.text} />
      </span>
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
  const covered = advice ? coveredKeys(advice.steps) : new Set<string>();
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
              const main = items.filter(p => p.category !== 'redundancy');
              const redundancy = items.filter(p => p.category === 'redundancy');
              const score = area ? rating?.areas.find(a => a.key === area)?.value ?? null : null;
              const row = (p: CoachProblem) => <MapProblem key={`${p.key}|${p.text}`} problem={p} covered={covered.has(p.key)} />;
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
