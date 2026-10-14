import { describeSwap, type Coaching } from '../engine/coach';

export function CoachPanel({ coaching, onReplace }: { coaching: Coaching; onReplace: (index: number) => void }) {
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
      {swaps.length > 0 && (
        <>
          <h3>Sostituzioni consigliate</h3>
          <ul>
            {swaps.map(swap => (
              <li key={swap.index}>
                {describeSwap(swap)}{' '}
                <button type="button" aria-label={`Vedi sostituti per ${swap.member}`} onClick={() => onReplace(swap.index)}>
                  ⇄ Vedi sostituti
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
