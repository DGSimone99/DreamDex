import { Typed } from './TypeText';
/** Vantaggi (+) e svantaggi (−) di una sostituzione. */
export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  if (pros.length === 0 && cons.length === 0) return null;
  return (
    <div className="pros-cons">
      {pros.length > 0 && (
        <ul aria-label="Vantaggi">
          {pros.map(text => <li key={text} className="pro"><span aria-hidden="true">+</span><span><Typed text={text} /></span></li>)}
        </ul>
      )}
      {cons.length > 0 && (
        <ul aria-label="Svantaggi">
          {cons.map(text => <li key={text} className="con"><span aria-hidden="true">−</span><span><Typed text={text} /></span></li>)}
        </ul>
      )}
    </div>
  );
}
