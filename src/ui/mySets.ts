import { useSyncExternalStore } from 'react';
import { sameSet, type TeamSet } from '../engine/sets';
import { MY_SETS_MAX, loadMySets, saveMySets, type MySet } from '../storage';

/** I set salvati dall'utente, condivisi da tutti gli editor della pagina (e salvati nel browser). */
const listeners = new Set<() => void>();
const NONE: MySet[] = [];
let cache: ReturnType<typeof loadMySets> | null = null;
const read = () => (cache ??= loadMySets());
const write = (next: ReturnType<typeof loadMySets>) => {
  cache = next;
  saveMySets(next);
  for (const listener of listeners) listener();
};

export function useMySets(species: string): MySet[] {
  const all = useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    read,
    read,
  );
  return all[species] ?? NONE;
}

const clean = (set: TeamSet): TeamSet => ({ ...set, favorite: undefined });

/** Salva il set col nome dato (vuoto = il primo "Set N" libero); null se la specie ha già MY_SETS_MAX set. */
export function saveMySet(species: string, set: TeamSet, nameOf: (n: number) => string, name = ''): MySet | null {
  const list = read()[species] ?? [];
  if (list.length >= MY_SETS_MAX) return null;
  let n = 1;
  while (list.some(s => s.name === nameOf(n))) n++;
  const saved: MySet = { name: name.trim() || nameOf(n), set: clean(set) };
  write({ ...read(), [species]: [...list, saved] });
  return saved;
}

/** Il set salvato con questo nome (senza distinguere maiuscole), o -1. */
export const mySetByName = (list: MySet[], name: string) => list.findIndex(s => s.name.toLowerCase() === name.trim().toLowerCase());

/** Tutti i set di una specie in una volta (sovrascrivere, rinominare, annullare). */
export function setMySets(species: string, list: MySet[]): void {
  const next = { ...read() };
  if (list.length) next[species] = list.slice(0, MY_SETS_MAX); else delete next[species];
  write(next);
}

export function overwriteMySet(species: string, index: number, set: TeamSet): void {
  setMySets(species, (read()[species] ?? []).map((s, i) => (i === index ? { ...s, set: clean(set) } : s)));
}

export function renameMySet(species: string, index: number, name: string): void {
  if (!name.trim()) return;
  setMySets(species, (read()[species] ?? []).map((s, i) => (i === index ? { ...s, name: name.trim() } : s)));
}

/** Per l'Annulla: i set della specie com'erano. */
export const mySetsOf = (species: string): MySet[] => read()[species] ?? [];

export function deleteMySet(species: string, index: number): void {
  const list = (read()[species] ?? []).filter((_, i) => i !== index);
  const next = { ...read() };
  if (list.length) next[species] = list; else delete next[species];
  write(next);
}

/** L'indice del set salvato uguale a quello attuale, o -1. */
export const mySetIndex = (list: MySet[], set: TeamSet) => list.findIndex(s => sameSet(s.set, set));

/** Solo per i test: rilegge l'archivio. */
export function resetMySetsCache(): void { cache = null; }
