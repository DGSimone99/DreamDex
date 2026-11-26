import { useEffect, useState } from 'react';

/**
 * Un segno che si accende e si spegne da solo dopo `ms` (il "Copiato!" dei pulsanti Copia): come useState(false), ma
 * acceso torna a false dopo `ms`.
 */
export function useFlash(ms: number): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(timer);
  }, [on, ms]);
  return [on, setOn];
}
