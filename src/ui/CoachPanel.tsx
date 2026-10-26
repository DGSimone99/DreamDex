import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';
import { t } from '../i18n';
import { PokemonList } from './PokemonName';
import { IssueCounts, PROBLEM_LABELS } from './IssueCounts';
import type { TeamSet } from '../engine/sets';
import { PROBLEM_CATEGORIES, type Coaching, type SwapPreview } from '../engine/coach';
import { Typed } from './TypeText';

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

type SwapProps = {
  /** Mette subito nel team il sostituto mostrato nella card. */
  onSwap?: (index: number, set: TeamSet) => void;
  coaching: Coaching;
  /** Sostituto aperto in "Altri sostituti": aggiorna la raccomandazione dello stesso membro. */
  preview?: SwapPreview | null;
  onReplace: (index: number) => void;
};

/** Tipo di team e stili (Hyper Offense, Volt-turn…), col perché nel tooltip. */
export function TeamTypeLine({ teamType }: { teamType: NonNullable<Coaching['teamType']> }) {
  const tr = useT();
  return (
    <p className="team-type">
      <span className="team-type-label">{tr('coach.teamType')}</span>
      <strong title={tr(`archetype.${teamType.archetype}.note`)}>{tr(`archetype.${teamType.archetype}`)}</strong>
      {teamType.styles.map(style => (
        <span key={style} className="team-style" title={tr(`teamStyle.${style}.note`)}>{tr(`teamStyle.${style}`)}</span>
      ))}
    </p>
  );
}

/** La parte "cosa non va" del coaching: tipo di team, punti di forza, problemi per categoria (regole per prime), bannati esclusi. */
/** `heading`: la testa "Problemi" (la Panoramica ha già la sua). */
export function CoachProblems({ coaching, heading = true }: { coaching: Coaching; heading?: boolean }) {
  // Senza la testa (Panoramica) anche il tipo di team sta sopra, nella riga del giudizio
  const showType = heading;
  const tr = useT();
  const { teamType, strengths, problems, bannedCount = 0 } = coaching;
  return (
    <>
      {showType && teamType && (
        <p className="team-type">
          <span className="team-type-label">{tr('coach.teamType')}</span>
          <strong title={tr(`archetype.${teamType.archetype}.note`)}>{tr(`archetype.${teamType.archetype}`)}</strong>
          {teamType.styles.map(style => (
            <span key={style} className="team-style" title={tr(`teamStyle.${style}.note`)}>{tr(`teamStyle.${style}`)}</span>
          ))}
        </p>
      )}
      {strengths.length > 0 && (
        <>
          <h3>{tr('coach.strengths')}</h3>
          <ul className="checklist">
            {strengths.map(text => <li key={text}><Icon name="check" /><span><Typed text={text} /></span></li>)}
          </ul>
        </>
      )}
      {problems.length > 0 && (
        <>
          {heading && <h3>{tr('coach.problems')}</h3>}
          {PROBLEM_CATEGORIES.map(category => {
            const group = problems.filter(p => p.category === category);
            const label = tr(`problemCategory.${category}`);
            if (group.length === 0) return null;
            return (
              <details key={category} open aria-label={tr('coach.problemsGroup', { category: label })} className="problem-group">
                <summary>
                  <h4>{label} <span className="count">{group.length}</span></h4>
                  {group.some(p => p.severity === 'serious') && (
                    <span className="issue serious" title={tr('coach.hasSerious')}><Icon name="warning" /></span>
                  )}
                </summary>
                <ul>
                  {group.map(p => (
                    <li key={p.text} className={p.severity === 'serious' ? 'bad' : ''}>
                      <span className={`issue ${p.severity}`} title={tr(p.severity === 'serious' ? 'coach.serious' : 'coach.minor')}>
                        <Icon name="warning" /><span className="visually-hidden">{`${tr(p.severity === 'serious' ? 'coach.serious' : 'coach.minor')}: `}</span>
                      </span>
                      <span>
                        <ProblemText text={p.text} />
                        {p.fixes.length > 0 && <small className="fixes">{tr('analysis.consider')} <PokemonList names={p.fixes} separator={` ${tr('analysis.or')} `} /></small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </>
      )}
      {/* Sostituzioni: chi è nella lista Ban dell'utente non viene proposto, ma si dice quanti sono */}
      {bannedCount > 0 && <p className="banned-note">{tr(bannedCount === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: bannedCount })}</p>}
    </>
  );
}

/** Il coaching intero in un blocco (giudizio e problemi): lo usano i test e chi lo mostra da solo. */
export function CoachPanel(props: SwapProps) {
  const tr = useT();
  const { verdict, problems } = props.coaching;
  return (
    <details className="block coach" open>
      <summary>
        <span>{tr('coach.title')}</span>
        <span className="summary-info">
          {verdict}
          <IssueCounts serious={problems.filter(p => p.severity === 'serious').length}
            minor={problems.filter(p => p.severity === 'minor').length} labels={PROBLEM_LABELS} />
        </span>
      </summary>
      <CoachProblems coaching={props.coaching} />
      {/* I cambi proposti tornano col Coaching nuovo (candidati sotto i problemi) */}
    </details>
  );
}
