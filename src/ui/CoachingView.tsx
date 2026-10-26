import { Fragment, useId, type ReactNode } from 'react';
import { PROBLEM_CATEGORIES, type Coaching, type CoachProblem, type ProblemCategory } from '../engine/coach';
import { fixesForProblem, type CoachFix } from '../engine/coachFixes';
import { t, type MessageKey } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonList, PokemonName, TypeDot } from './PokemonName';
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

const gainText = (fix: CoachFix) => `+${fix.gain}`;

/** Un candidato: nome col pallino del tipo e il voto in più; apre la scheda Pokémon su di lui. */
function FixButton({ fix, onFix }: { fix: CoachFix; onFix: (fix: CoachFix) => void }) {
  const tr = useT();
  const label = fix.kind === 'add'
    ? tr('coach.fixAddAria', { species: fix.species, gain: gainText(fix) })
    : tr('coach.fixSwapAria', { member: fix.member ?? '', species: fix.species, gain: gainText(fix) });
  return (
    <button type="button" className="coach-fix" aria-label={label} onClick={() => onFix(fix)}>
      <TypeDot name={fix.species} /><strong>{fix.species}</strong><span className="coach-gain">{gainText(fix)}</span>
    </button>
  );
}

/** Sotto il problema: chi lo risolve, raggruppato per membro sostituito (le aggiunte insieme). */
function ProblemFixes({ problem, fixes, onFix }: { problem: CoachProblem; fixes: CoachFix[]; onFix: (fix: CoachFix) => void }) {
  const tr = useT();
  const list = fixesForProblem(fixes, problem.key);
  if (list.length === 0) {
    // Nessun cambio alza il voto: restano i nomi di oggi, come testo
    if (problem.fixes.length === 0) return null;
    return (
      <p className="coach-fixes">
        <Template text={tr('coach.noFix')} parts={{ names: <PokemonList names={problem.fixes} separator={` ${tr('analysis.or')} `} /> }} />
      </p>
    );
  }
  const groups: CoachFix[][] = [];
  for (const fix of list) {
    const group = groups.find(g => g[0].kind === fix.kind && g[0].index === fix.index);
    if (group) group.push(fix);
    else groups.push([fix]);
  }
  return (
    <p className="coach-fixes">
      {groups.map((group, g) => {
        const [{ kind, member }] = group;
        const key: MessageKey = kind === 'add' ? (g === 0 ? 'coach.considerAdd' : 'coach.alsoAdd') : (g === 0 ? 'coach.considerSwap' : 'coach.alsoSwap');
        return (
          <Fragment key={g}>
            {g > 0 && ' · '}
            <span className="coach-fix-lead"><Template text={tr(key)} parts={{ member: member ? <PokemonName name={member} /> : null }} /></span>{' '}
            {group.map((fix, i) => <Fragment key={fix.species}>{i > 0 && ' · '}<FixButton fix={fix} onFix={onFix} /></Fragment>)}
          </Fragment>
        );
      })}
    </p>
  );
}

/**
 * La scheda Coaching: in cima il cambio che risolve di più ("Prima di tutto"), poi i problemi gravi e minori;
 * sotto ognuno i candidati di Migliora team che lo risolvono, col voto in più. Ogni candidato apre la scheda Pokémon.
 */
export function CoachingView({ coaching, onFix }: { coaching: Coaching; onFix: (fix: CoachFix) => void }) {
  const tr = useT();
  const id = useId();
  const { problems, fixes, first, bannedCount = 0 } = coaching;
  // In ogni gruppo l'ordine delle categorie: regole per prime
  const ordered = [...problems].sort((a, b) => PROBLEM_CATEGORIES.indexOf(a.category) - PROBLEM_CATEGORIES.indexOf(b.category));
  const groups = [
    { key: 'serious', label: tr('coach.group.serious'), items: ordered.filter(p => p.severity === 'serious') },
    { key: 'minor', label: tr('coach.group.minor'), items: ordered.filter(p => p.severity === 'minor') },
  ];
  return (
    <div className="coaching">
      {first && (
        <section className="coach-first" aria-label={tr('coach.first')}>
          <span className="coach-first-label" aria-hidden="true">{tr('coach.first')}</span>
          <span className="coach-first-move">
            {first.kind === 'add'
              ? <Template text={tr('coach.firstAdd')} parts={{ species: <PokemonName name={first.species} /> }} />
              : <Template text={tr('coach.firstSwap')} parts={{ member: <PokemonName name={first.member ?? ''} />, species: <PokemonName name={first.species} /> }} />}
            <span className="coach-gain">{gainText(first)}</span>
          </span>
          <span className="coach-first-solves">
            {first.solves.length === 1 ? tr('coach.solvesOne') : tr('coach.solvesMany', { n: first.solves.length })}
          </span>
          <button type="button" className="coach-open" onClick={() => onFix(first)}>
            {tr(first.kind === 'add' ? 'coach.openAdd' : 'coach.openSwap')} <Icon name="arrow" />
          </button>
        </section>
      )}
      {problems.length === 0 && <p className="coach-empty"><Icon name="check" />{tr('coach.noProblems')}</p>}
      {groups.filter(group => group.items.length > 0).map(group => (
        <Fragment key={group.key}>
          <h3 id={`${id}-${group.key}`} className={`coach-group ${group.key}`}>{group.label}</h3>
          <ul className="coach-problems" aria-labelledby={`${id}-${group.key}`}>
            {group.items.map(problem => (
              <li key={`${problem.key}|${problem.text}`} className={`coach-problem ${problem.severity}`}>
                <div className="coach-problem-line">
                  <span className="coach-problem-text"><ProblemText text={problem.text} /></span>
                  <span className="coach-area">{tr(CATEGORY[problem.category])}</span>
                </div>
                <ProblemFixes problem={problem} fixes={fixes} onFix={onFix} />
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
      {/* Candidati: chi è nella lista Ban dell'utente non viene proposto, ma si dice quanti sono */}
      {bannedCount > 0 && <p className="coach-note">{tr(bannedCount === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: bannedCount })}</p>}
    </div>
  );
}
