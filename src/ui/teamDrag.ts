import type { DragEvent } from 'react';
import type { TeamSet } from '../engine/sets';

/**
 * Trascinamento di un candidato della lista Pokémon sul team: sopra un membro lo sostituisce, sopra uno slot
 * vuoto lo aggiunge. Il set viaggia qui (il dataTransfer si legge solo al rilascio, e nei test può mancare).
 */
let dragged: TeamSet | null = null;
const listeners = new Set<(set: TeamSet | null) => void>();
const notify = () => listeners.forEach(listener => listener(dragged));

export function startSetDrag(e: DragEvent, set: TeamSet) {
  dragged = set;
  try {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', set.species);
  } catch { /* senza dataTransfer basta il riferimento */ }
  notify();
}

export function endSetDrag() {
  if (!dragged) return;
  dragged = null;
  notify();
}

/** Il set che si sta trascinando dalla lista (null se nessuno). */
export const draggedSet = () => dragged;

/** Avvisa quando un trascinamento dalla lista parte o finisce. */
export function onSetDrag(listener: (set: TeamSet | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
