import { Icon } from './icons';
import type { TeamSet } from '../engine/sets';
import { ProsCons } from './ProsCons';
import { describeSwap, previewSwap, PROBLEM_CATEGORIES, type Coaching, type SwapLevel, type SwapPreview } from '../engine/coach';

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
      <summary><span>Coaching</span><span>{verdict}</span></summary>
      {strengths.length > 0 && (
        <>
          <h3>Punti di forza</h3>
          <ul className="checklist">
            {strengths.map(text => <li key={text}><Icon name="check" />{text}</li>)}
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
                  {group.some(p => p.severity === 'serious') && <span className="serious-flag">Serio</span>}
                </summary>
                <ul>
                  {group.map(p => (
                    <li key={p.text} className={p.severity === 'serious' ? 'bad' : ''}>
                      <span className="severity">{p.severity === 'serious' ? 'Serio' : 'Minore'}</span>
                      <span>
                        {p.text}
                        {p.fixes.length > 0 && <small>Considera <b>{p.fixes.join(' o ')}</b></small>}
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
                      <span>{swap.member}</span>
                      <Icon name="arrow" />
                      <span className="visually-hidden">con</span>
                      <strong>{swap.replacement}</strong>
                      {gain >= 0
                        ? <span className="gain" aria-label={`si adatta meglio di ${gain} punti`}>+{gain}</span>
                        : <span className="gain worse" aria-label={`si adatta peggio di ${-gain} punti`}>−{-gain}</span>}
                      {swap.similar && <small>Ruolo simile</small>}
                      {picked && <small className="picked-tag">Selezionato</small>}
                    </p>
                    <ProsCons pros={pros} cons={cons} />
                    <div className="swap-actions">
                      {onSwap && (
                        <button type="button" className="primary swap-now" aria-label={`Sostituisci ${swap.member} con ${swap.replacement}`}
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
