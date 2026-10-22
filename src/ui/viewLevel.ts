import { useSyncExternalStore } from 'react';

/** Livello a cui l'editor mostra le statistiche finali: solo per la vista, il set resta al livello 100. */
export type ViewLevel = 50 | 100;

let current: ViewLevel = 100;
const listeners = new Set<() => void>();

export function setViewLevel(level: ViewLevel): void {
  if (level === current) return;
  current = level;
  for (const listener of listeners) listener();
}

/** Lo stesso livello per tutti i membri, finché la pagina resta aperta. */
export function useViewLevel(): ViewLevel {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => 100,
  );
}
