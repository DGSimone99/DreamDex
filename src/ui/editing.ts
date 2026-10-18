import { useSyncExternalStore } from 'react';

/**
 * Membro aperto nell'editor, condiviso tra il team e il badge del voto senza passare dall'App:
 * aprire e chiudere ridisegna solo chi lo legge (suggerimenti e analisi restano fermi).
 */
let current: number | null = null;
const listeners = new Set<() => void>();

export function setEditing(index: number | null): void {
  if (index === current) return;
  current = index;
  for (const listener of listeners) listener();
}

export function useEditing(): number | null {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => null,
  );
}
