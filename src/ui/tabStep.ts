/**
 * Le frecce fra le schede, come le schede native: da `at` la scheda dopo o prima (col giro), Home la prima, End l'ultima.
 * null se il tasto non sposta niente. `horizontal`: destra e sinistra; `vertical`: giù e su; `homeEnd`: Home e End.
 */
export function tabStep(key: string, at: number, count: number, { horizontal = true, vertical = false, homeEnd = true }: { horizontal?: boolean; vertical?: boolean; homeEnd?: boolean } = {}): number | null {
  const step = (horizontal && key === 'ArrowRight') || (vertical && key === 'ArrowDown') ? 1
    : (horizontal && key === 'ArrowLeft') || (vertical && key === 'ArrowUp') ? -1 : 0;
  if (step) return (at + step + count) % count;
  if (homeEnd && key === 'Home') return 0;
  if (homeEnd && key === 'End') return count - 1;
  return null;
}
