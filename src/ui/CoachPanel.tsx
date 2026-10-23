import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';
import { t, type MessageKey } from '../i18n';
import { PokemonList, PokemonName } from './PokemonName';
import { IssueCounts, PROBLEM_LABELS } from './IssueCounts';
import type { TeamSet } from '../engine/sets';
import { ProsCons } from './ProsCons';
import { describeSwap, previewSwap, PROBLEM_CATEGORIES, type Coaching, type SwapLevel, type SwapPreview } from '../engine/coach';
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

const SWAP_GROUPS: { level: SwapLevel; title: MessageKey }[] = [
  { level: 'recommended', title: 'coach.swaps.recommended' },
  { level: 'optional', title: 'coach.swaps.optional' },
];

export function CoachPanel({ coaching, preview = null, onReplace, onSwap }: {
  /** Mette subito nel team il sostituto mostrato nella card. */
  onSwap?: (index: number, set: TeamSet) => void;
  coaching: Coaching;
  /** Sostituto aperto in "Altri sostituti": aggiorna la raccomandazione dello stesso membro. */
  preview?: SwapPreview | null;
  onReplace: (index: number) => void;
}) {
  const tr = useT();
  const lang = useLang();
  const { verdict, teamType, strengths, problems, swaps, bannedCount = 0 } = coaching;
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
      {teamType && (
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
          <h3>{tr('coach.problems')}</h3>
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
      {SWAP_GROUPS.map(({ level, title: titleKey }) => {
        const title = tr(titleKey);
        const group = swaps.filter(swap => swap.level === level);
        if (group.length === 0) return null;
        return (
          <div key={level} role="group" aria-label={title} className={`swaps ${level}`}>
            <h3>{title}</h3>
            <ul>
              {group.map(proposed => {
                const swap = previewSwap(proposed, preview);
                const picked = swap !== proposed;
                const { gain, pros, cons } = describeSwap(swap, lang);
                return (
                  <li key={swap.index} className={`swap${picked ? ' picked' : ''}`} title={tr('coach.fitTitle', { member: swap.member, fit: swap.fit, replacement: swap.replacement, score: swap.score })}>
                    <p className="swap-head">
                      <PokemonName name={swap.member} muted icon />
                      <Icon name="arrow" />
                      <span className="visually-hidden">{tr('coach.with')}</span>
                      <PokemonName name={swap.replacement} icon />
                      {/* Punti di voto del team: il criterio con cui il coaching sceglie le sostituzioni */}
                      {gain > 0
                        ? <span className="gain" aria-label={tr('coach.betterBy', { n: gain })}>+{gain}<span className="gain-unit" aria-hidden="true">{tr('coach.ratingUnit')}</span></span>
                        : gain === 0
                          ? <span className="gain same" aria-label={tr('coach.sameRating')}>±0<span className="gain-unit" aria-hidden="true">{tr('coach.ratingUnit')}</span></span>
                          : <span className="gain worse" aria-label={tr('coach.worseBy', { n: -gain })}>−{-gain}<span className="gain-unit" aria-hidden="true">{tr('coach.ratingUnit')}</span></span>}
                      {swap.similar && <small>{tr('coach.similarRole')}</small>}
                      {picked && <small className="picked-tag">{tr('coach.selected')}</small>}
                    </p>
                    <ProsCons pros={pros} cons={cons} />
                    <div className="swap-actions">
                      {onSwap && (
                        <button type="button" className="swap-now" aria-label={tr('coach.swapNow', { member: swap.member, replacement: swap.replacement })}
                          title={tr('coach.swapNow', { member: swap.member, replacement: swap.replacement })}
                          onClick={() => onSwap(swap.index, swap.set)}>
                          <Icon name="swap" />
                        </button>
                      )}
                      <button type="button" aria-label={tr('coach.otherReplacements', { member: swap.member })} onClick={() => onReplace(swap.index)}>
                        {tr('coach.otherReplacementsButton')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </details>
  );
}
