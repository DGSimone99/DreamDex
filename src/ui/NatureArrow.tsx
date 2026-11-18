/** La freccetta doppia della natura, come in Pokémon Champions: su per la statistica che sale, giù per quella che scende. */
export function NatureArrow({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg className={`nature-arrow ${dir}`} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d={dir === 'up' ? 'M3 9l5-5 5 5M3 13l5-5 5 5' : 'M3 3l5 5 5-5M3 7l5 5 5-5'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
