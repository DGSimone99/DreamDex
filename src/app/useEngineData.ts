import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import { DEFAULT_FORMAT, type Format } from '../engine/format';
import { dataSource } from '../engine/formats';
import { EMPTY_LISTS, effectiveLists, listContext, type UserLists } from '../engine/lists';
import { loadLists, saveLists } from '../storage';
import type { ListUndo } from '../ui/UndoToast';

const NO_DATA: EngineData = { stats: null, sets: null };

/**
 * Dati per fonte: ogni formato carica la sua la prima volta, poi resta in memoria. Un caricamento finito tardi si salva
 * sotto la sua fonte, quindi non tocca il formato attuale.
 */
export function useSourceData(initialData: EngineData, format: Format, loadSource?: (source: string) => Promise<EngineData>) {
  const [cache, setCache] = useState<Record<string, EngineData>>({ [dataSource(DEFAULT_FORMAT)]: initialData });
  const source = dataSource(format);
  const loading = !(source in cache) && !!loadSource;
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (source in cache || !loadSource || requested.current.has(source)) return;
    requested.current.add(source);
    loadSource(source).then(result => setCache(c => ({ ...c, [source]: result })));
  }, [source, cache, loadSource]);
  return { loaded: cache[source] ?? NO_DATA, loading };
}

/**
 * Nel browser la pagina si disegna prima del voto: voto, analisi e Coaching del team (migliaia di colpi, sul telefono
 * qualche secondo) si calcolano subito dopo il primo disegno, intanto la carta del voto dice che lo sta calcolando.
 * Senza worker (test, browser vecchi) come prima, tutto al primo disegno.
 */
const PAINT_FIRST = typeof Worker !== 'undefined';

/** Vero un giro dopo che la pagina è sullo schermo (vedi PAINT_FIRST). */
export function useBooted() {
  const [booted, setBooted] = useState(!PAINT_FIRST);
  useEffect(() => {
    if (booted) return;
    let timer = 0;
    const frame = requestAnimationFrame(() => { timer = window.setTimeout(() => startTransition(() => setBooted(true)), 0); });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [booted]);
  return booted;
}

/**
 * Preferiti e bannati dell'utente, salvati nel browser; `userLists` è la raccolta attiva nel contesto (gioco o formato)
 * più l'Universale (solo i suggerimenti la usano). Raccolta svuotata o sostituita, Pokémon tolto da un box: si può
 * annullare per qualche secondo, finché le liste restano quelle.
 */
export function useLists(storage: Storage | undefined, format: Format) {
  const [lists, setLists] = useState<UserLists>(() => (storage ? loadLists(storage) : EMPTY_LISTS));
  useEffect(() => {
    if (storage) saveLists(lists, storage);
  }, [lists, storage]);
  const listCtx = listContext(format);
  const userLists = useMemo(() => effectiveLists(lists, listCtx), [lists, listCtx]);
  const [listUndo, setListUndo] = useState<{ id: number; undo: ListUndo; before: UserLists; after: UserLists } | null>(null);
  // Stabile: la scheda Liste (oltre mille Pokémon) non si ridisegna quando cambia solo il team
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const changeLists = useCallback((next: UserLists, undo?: ListUndo) => {
    setListUndo(undo ? { id: Date.now(), undo, before: listsRef.current, after: next } : null);
    setLists(next);
  }, []);
  const undoLists = () => {
    if (listUndo) setLists(listUndo.before);
    setListUndo(null);
  };
  return { lists, userLists, changeLists, listUndo, setListUndo, undoLists };
}
