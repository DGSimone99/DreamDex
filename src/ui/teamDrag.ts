import type { DragEvent } from 'react';
import type { TeamSet } from '../engine/sets';

/**
 * Trascinamento di un candidato della lista Pokémon sul team: sopra un membro lo sostituisce, sopra uno slot
 * vuoto lo aggiunge. Il set viaggia qui (il dataTransfer si legge solo al rilascio, e nei test può mancare).
 */
let dragged: TeamSet | null = null;
/** Dove il mouse ha afferrato il candidato: da lì parte la carta del team che segue il mouse (TeamPanel). */
let start: { x: number; y: number } | null = null;
const listeners = new Set<(set: TeamSet | null) => void>();
const notify = () => listeners.forEach(listener => listener(dragged));

/** PNG 1×1 tutto trasparente, caricato subito: nasconde la copia sfumata che il browser disegna da sé. */
const EMPTY = typeof Image !== 'undefined'
  ? Object.assign(new Image(), { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=' })
  : null;

/** Toglie l'immagine del browser al trascinamento: al suo posto la carta del team che segue il mouse (TeamPanel). */
export function hideDragImage(e: DragEvent) {
  try { if (EMPTY) e.dataTransfer.setDragImage(EMPTY, 0, 0); } catch { /* senza dataTransfer (test) */ }
}

export function startSetDrag(e: DragEvent, set: TeamSet) {
  dragged = set;
  start = { x: e.clientX, y: e.clientY };
  try {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', set.species);
  } catch { /* senza dataTransfer basta il riferimento */ }
  notify();
}

export function endSetDrag() {
  if (!dragged) return;
  dragged = null;
  start = null;
  notify();
}

/** Il set che si sta trascinando dalla lista (null se nessuno). */
export const draggedSet = () => dragged;

/** Il punto dove è partito il trascinamento dalla lista (null se nessuno). */
export const dragStart = () => start;

/** Avvisa quando un trascinamento dalla lista parte o finisce. */
export function onSetDrag(listener: (set: TeamSet | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
