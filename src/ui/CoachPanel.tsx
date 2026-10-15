import { Icon } from './icons';
import { ProsCons } from './ProsCons';
import { describeSwap, previewSwap, type Coaching, type SwapLevel, type SwapPreview } from '../engine/coach';

const SWAP_GROUPS: { level: SwapLevel; title: string }[] = [
  { level: 'recommended', title: 'Valuta di sostituire' },
  { level: 'optional', title: 'Possibili raccomandazioni' },
];

export function CoachPanel({ coaching, preview = null, onReplace }: {
  coaching: Coaching;
  /** Sostituto aperto in "Vedi sostituti": aggiorna la raccomandazione dello stesso membro. */
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
          <ul>{strengths.map(text => <li key={text}>{text}</li>)}</ul>
        </>
      )}
      {problems.length > 0 && (
        <>
          <h3>Problemi</h3>
          <ul>
            {problems.map(p => (
              <li key={p.text} className={p.severity === 'serious' ? 'bad' : ''}>
                <strong>{p.severity === 'serious' ? 'Serio' : 'Minore'}:</strong> {p.text}
                {p.fixes.length > 0 && <small>Considera {p.fixes.join(' o ')}</small>}
              </li>
            ))}
          </ul>
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
                    <button type="button" aria-label={`Vedi sostituti per ${swap.member}`} onClick={() => onReplace(swap.index)}>
                      <Icon name="swap" /> Vedi sostituti
                    </button>
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
