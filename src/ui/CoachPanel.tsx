import { Icon } from './icons';
import { PokemonList, PokemonName } from './PokemonName';
import { IssueCounts, PROBLEM_LABELS } from './IssueCounts';
import type { TeamSet } from '../engine/sets';
import { ProsCons } from './ProsCons';
import { describeSwap, previewSwap, PROBLEM_CATEGORIES, type Coaching, type SwapLevel, type SwapPreview } from '../engine/coach';
import { Typed } from './TypeText';

// "3 Deboli" in rosso e "0 Resistono" in verde, il resto con i tipi colorati
const COUNT = /(\d+ (?:Debole|Deboli|Resiste|Resistono))/;

function ProblemText({ text }: { text: string }) {
  return (
    <>
      {text.split(COUNT).map((part, i) => (i % 2 === 1
        ? <span key={i} className={/Resist/.test(part) ? 'count-resist' : 'count-weak'}>{part}</span>
        : <Typed key={i} text={part} />))}
    </>
  );
}

const SWAP_GROUPS: { level: SwapLevel; title: string }[] = [
  { level: 'recommended', title: 'Valuta di sostituire' },
  { level: 'optional', title: 'Possibili raccomandazioni' },
];

export function CoachPanel({ coaching, preview = null, onReplace, onSwap }: {
  /** Mette subito nel team il sostituto mostrato nella card. */
  onSwap?: (index: number, set: TeamSet) => void;
  coaching: Coaching;
  /** Sostituto aperto in "Altri sostituti": aggiorna la raccomandazione dello stesso membro. */
  preview?: SwapPreview | null;
  onReplace: (index: number) => void;
}) {
  const { verdict, strengths, problems, swaps } = coaching;
  return (
    <details className="block coach" open>
      <summary>
        <span>Coaching</span>
        <span className="summary-info">
          {verdict}
          <IssueCounts serious={problems.filter(p => p.severity === 'serious').length}
            minor={problems.filter(p => p.severity === 'minor').length} labels={PROBLEM_LABELS} />
        </span>
      </summary>
      {strengths.length > 0 && (
        <>
          <h3>Punti di forza</h3>
          <ul className="checklist">
            {strengths.map(text => <li key={text}><Icon name="check" /><span><Typed text={text} /></span></li>)}
          </ul>
        </>
      )}
      {problems.length > 0 && (
        <>
          <h3>Problemi</h3>
          {PROBLEM_CATEGORIES.map(category => {
            const group = problems.filter(p => p.category === category);
            if (group.length === 0) return null;
            return (
              <details key={category} open aria-label={`Problemi: ${category}`} className="problem-group">
                <summary>
                  <h4>{category} <span className="count">{group.length}</span></h4>
                  {group.some(p => p.severity === 'serious') && (
                    <span className="issue serious" title="Contiene problemi seri"><Icon name="warning" /></span>
                  )}
                </summary>
                <ul>
                  {group.map(p => (
                    <li key={p.text} className={p.severity === 'serious' ? 'bad' : ''}>
                      <span className={`issue ${p.severity}`} title={p.severity === 'serious' ? 'Serio' : 'Minore'}>
                        <Icon name="warning" /><span className="visually-hidden">{p.severity === 'serious' ? 'Serio: ' : 'Minore: '}</span>
                      </span>
                      <span>
                        <ProblemText text={p.text} />
                        {p.fixes.length > 0 && <small className="fixes">Considera <PokemonList names={p.fixes} separator=" o " /></small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </>
      )}
      {SWAP_GROUPS.map(({ level, title }) => {
        const group = swaps.filter(swap => swap.level === level);
        if (group.length === 0) return null;
        return (
          <div key={level} role="group" aria-label={title} className={`swaps ${level}`}>
            <h3>{title}</h3>
            <ul>
              {group.map(proposed => {
                const swap = previewSwap(proposed, preview);
                const picked = swap !== proposed;
                const { gain, pros, cons } = describeSwap(swap);
                return (
                  <li key={swap.index} className={`swap${picked ? ' picked' : ''}`} title={`Adattamento al team: ${swap.member} ${swap.fit} · ${swap.replacement} ${swap.score}`}>
                    <p className="swap-head">
                      <PokemonName name={swap.member} muted icon />
                      <Icon name="arrow" />
                      <span className="visually-hidden">con</span>
                      <PokemonName name={swap.replacement} icon />
                      {gain >= 0
                        ? <span className="gain" aria-label={`si adatta meglio di ${gain} punti`}>+{gain}</span>
                        : <span className="gain worse" aria-label={`si adatta peggio di ${-gain} punti`}>−{-gain}</span>}
                      {swap.similar && <small>Ruolo simile</small>}
                      {picked && <small className="picked-tag">Selezionato</small>}
                    </p>
                    <ProsCons pros={pros} cons={cons} />
                    <div className="swap-actions">
                      {onSwap && (
                        <button type="button" className="swap-now" aria-label={`Sostituisci ${swap.member} con ${swap.replacement}`}
                          title={`Sostituisci ${swap.member} con ${swap.replacement}`}
                          onClick={() => onSwap(swap.index, swap.set)}>
                          <Icon name="swap" />
                        </button>
                      )}
                      <button type="button" aria-label={`Altri sostituti per ${swap.member}`} onClick={() => onReplace(swap.index)}>
                        Altri sostituti
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
