import { Typed } from './TypeText';
import { useT } from '../i18n/react';
/** Vantaggi (+) e svantaggi (−) di una sostituzione. */
export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  const t = useT();
  if (pros.length === 0 && cons.length === 0) return null;
  return (
    <div className="pros-cons">
      {pros.length > 0 && (
        <ul aria-label={t('pros.label')}>
          {pros.map(text => <li key={text} className="pro"><span aria-hidden="true">+</span><span><Typed text={text} /></span></li>)}
        </ul>
      )}
      {cons.length > 0 && (
        <ul aria-label={t('cons.label')}>
          {cons.map(text => <li key={text} className="con"><span aria-hidden="true">−</span><span><Typed text={text} /></span></li>)}
        </ul>
      )}
    </div>
  );
}
