import { useSyncExternalStore } from 'react';
import { sameSet, type TeamSet } from '../engine/sets';
import { MY_SETS_MAX, loadMySets, saveMySets, type MySet } from '../storage';

/** I set salvati dall'utente, condivisi da tutti gli editor della pagina (e salvati nel browser). */
const listeners = new Set<() => void>();
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
  return all[species] ?? [];
}

/** Salva il set con il primo nome libero "Set N"; null se la specie ha già MY_SETS_MAX set. */
export function saveMySet(species: string, set: TeamSet, nameOf: (n: number) => string): MySet | null {
  const list = read()[species] ?? [];
  if (list.length >= MY_SETS_MAX) return null;
  let n = 1;
  while (list.some(s => s.name === nameOf(n))) n++;
  const saved: MySet = { name: nameOf(n), set: { ...set, favorite: undefined } };
  write({ ...read(), [species]: [...list, saved] });
  return saved;
}

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
