import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { rankCandidates, type RankingParams, type RankingResult } from '../engine/candidateRanking';
import type { EngineData } from '../engine/data';
import type { WorkerData, WorkerRequest, WorkerResponse } from '../engine/rankingProtocol';
import { currentGameNames, gameNamesVersion } from '../i18n/game';

/**
 * Quello che decide la lista: i parametri e i dati del formato. `source` è la parte che cambia col team (senza worker
 * si calcola dopo il resto della pagina), `query` ricerca, filtri e lingua (senza worker subito, come prima).
 */
export interface RankingInput {
  source: Omit<RankingParams, 'applied' | 'filtering' | 'lang'> & { data: EngineData };
  query: Pick<RankingParams, 'applied' | 'filtering' | 'lang'>;
}

const paramsOf = ({ source: { data: _data, ...rest }, query }: RankingInput): RankingParams => ({ ...rest, ...query });
const rank = (input: RankingInput) => rankCandidates(paramsOf(input), input.source.data);

export interface Ranking {
  result: RankingResult;
  /** La lista non è ancora quella dell'ultimo input (si sta calcolando): si mostra attenuata. */
  pending: boolean;
  /** L'input a cui corrisponde la lista mostrata. */
  input: RankingInput;
}

/**
 * Il calcolo in sottofondo (ranking.worker.ts): un solo worker per l'app. Le parti grandi dei dati si mandano una
 * volta (per identità), i nomi italiani quando cambiano. Senza worker (test, browser vecchi) o se il worker si rompe,
 * il calcolo si fa qui come prima.
 */
class RankingClient {
  private worker: Worker;
  private broken = false;
  private ids = new WeakMap<object, number>();
  private nextPart = 0;
  private sentLists = 0;
  private namesSent = -1;
  private nextRequest = 0;
  private waiting = new Map<number, { resolve: (r: RankingResult) => void; input: RankingInput }>();

  constructor(worker: Worker) {
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = this.waiting.get(response.id);
      if (!entry) return;
      this.waiting.delete(response.id);
      entry.resolve(response.ok ? response.result : rank(entry.input));
    };
    worker.onerror = () => {
      // Worker che non parte o si rompe: le richieste in attesa (e le prossime) si calcolano qui
      this.broken = true;
      for (const entry of this.waiting.values()) entry.resolve(rank(entry.input));
      this.waiting.clear();
    };
  }

  private idOf(value: object | null | undefined, fresh: [number, unknown][]): number {
    if (!value) return 0;
    let id = this.ids.get(value);
    if (id === undefined) {
      id = ++this.nextPart;
      this.ids.set(value, id);
      fresh.push([id, value]);
    }
    return id;
  }

  request(input: RankingInput): Promise<RankingResult> {
    if (this.broken) return Promise.resolve(rank(input));
    const { data } = input.source;
    const fresh: [number, unknown][] = [];
    const wire: WorkerData = {
      stats: this.idOf(data.stats, fresh), sets: this.idOf(data.sets, fresh), fallback: this.idOf(data.fallback, fresh),
      presets: this.idOf(data.presets, fresh), fallbackPresets: this.idOf(data.fallbackPresets, fresh),
      fallbackStats: this.idOf(data.fallbackStats, fresh), userLists: this.idOf(data.userLists, fresh),
      ignoreMeta: data.ignoreMeta, allowMultipleMegas: data.allowMultipleMegas, formatId: data.formatId,
    };
    // Le liste dell'utente cambiano spesso (preferiti, bannati): quelle vecchie nel worker non servono più
    const drop = this.sentLists && this.sentLists !== wire.userLists ? [this.sentLists] : [];
    this.sentLists = wire.userLists;
    if (fresh.length || drop.length) this.post({ kind: 'parts', parts: fresh, drop });
    if (this.namesSent !== gameNamesVersion()) {
      this.namesSent = gameNamesVersion();
      this.post({ kind: 'names', names: currentGameNames() });
    }
    const id = ++this.nextRequest;
    return new Promise(resolve => {
      this.waiting.set(id, { resolve, input });
      this.post({ kind: 'rank', id, params: paramsOf(input), data: wire });
    });
  }

  private post(message: WorkerRequest) {
    try {
      this.worker.postMessage(message);
    } catch {
      this.broken = true;
    }
  }
}

let client: RankingClient | null | undefined;
function rankingClient(): RankingClient | null {
  if (client !== undefined) return client;
  try {
    client = typeof Worker === 'undefined' ? null
      : new RankingClient(new Worker(new URL('../engine/ranking.worker.ts', import.meta.url), { type: 'module' }));
  } catch {
    client = null;
  }
  return client;
}

/** In sottofondo: la lista resta quella vecchia (attenuata) finché la nuova non è pronta; l'app non si blocca mai. */
function useWorkerRanking(input: RankingInput): Ranking {
  const worker = rankingClient()!;
  const [shown, setShown] = useState<{ input: RankingInput; result: RankingResult } | null>(null);
  // Una richiesta alla volta: mentre il worker calcola, conta solo l'ultimo input (quelli in mezzo si saltano)
  const busy = useRef(false);
  const latest = useRef(input);
  latest.current = input;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (busy.current) return;
    const run = (next: RankingInput) => {
      busy.current = true;
      void worker.request(next).then(result => {
        busy.current = false;
        if (!alive.current) return;
        setShown({ input: next, result });
        if (latest.current !== next) run(latest.current);
      });
    };
    run(input);
  }, [input, worker]);
  if (!shown) return { result: { items: [], excluded: 0 }, pending: true, input };
  return { result: shown.result, pending: shown.input !== input, input: shown.input };
}

/** Senza worker: il calcolo qui, dopo il resto della pagina (come prima del worker). */
function useSyncRanking(input: RankingInput): Ranking {
  const source = useDeferredValue(input.source);
  const shown = useMemo(() => ({ source, query: input.query }), [source, input.query]);
  const result = useMemo(() => rank(shown), [shown]);
  return { result, pending: source !== input.source, input: shown };
}

export const useRanking: (input: RankingInput) => Ranking = rankingClient() ? useWorkerRanking : useSyncRanking;
