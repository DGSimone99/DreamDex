import type { TeamSet } from '../../engine/sets';
import type { ImportReview } from '../importReview';

/** Il voto del team, per il chip nella testata dell'editor sul telefono (lì il voto grande è coperto). */
export interface EditorGradeInfo { letter: string; overall: number; illegal: boolean }
/** Il chip dell'editor: il voto di adesso e quello di quando si è aperto il membro. */
export type EditorGradeShown = EditorGradeInfo & { from: number };

export interface MoveProposal { index: number; slot: number; from: string; to: string; gain: number; nonce: number }

/**
 * Azioni delle carte, una volta sola per tutto il team (prendono la posizione del membro): restano le stesse
 * a ogni disegno, così una carta si ridisegna solo quando cambia qualcosa di suo (memo).
 */
export interface SlotActions {
  toggle: (index: number, open: boolean) => void;
  /** Frecce sulla card: apre il membro accanto. */
  step: (index: number, delta: number) => void;
  /** Alt + frecce: sposta il membro di una posizione. */
  move: (index: number, delta: number) => void;
  /** Trascinamento: inizio, passaggio sopra, rilascio, fine. */
  drag: (index: number, phase: 'start' | 'over' | 'drop' | 'end') => void;
  /** Inizio del trascinamento: dove e quanto è grande la carta presa, per la carta che segue il mouse. */
  lift: (index: number, at: Lift) => void;
  /** Set incollato; `review`: mosse non imparabili o nomi non trovati, da chiedere/dire dopo averlo applicato. */
  paste: (index: number, set: TeamSet, review?: ImportReview) => void;
  /** Preset con il voto del team più alto per questo membro, completato e ritoccato (null se il membro non ne ha). */
  best: (index: number) => TeamSet | null;
  /** Solo quale preset dà al team il voto più alto (posizione in presetsForSet), per segnarlo nel menu Set. */
  bestIndex: (index: number) => number | null;
  ignoreWarning: () => void;
  change: (index: number, set: TeamSet) => void;
  /** Set intero cambiato (preset, I miei set, spread): con Annulla. */
  setChange: (index: number, set: TeamSet) => void;
  /** Consiglio della Sfida applicato: con Annulla. */
  tip: (index: number, set: TeamSet, change: string) => void;
  /** La Sfida passa la mano: apre il membro `index` con lo stesso avversario. */
  openWith: (index: number, opponent: string) => void;
  remove: (index: number) => void;
  replace: (index: number) => void;
  proposalDone: (applied: boolean) => void;
}

/** Dove si è afferrata una carta da trascinare: il punto, lo scarto dal suo angolo, la misura, team ridotto o no. */
export interface Lift { x: number; y: number; dx: number; dy: number; w: number; h: number; collapsed: boolean }
