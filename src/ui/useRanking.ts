import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { rankCandidates, type RankingParams, type RankingResult } from '../engine/candidateRanking';
import type { EngineData } from '../engine/data';
import type { AdviceParams, GainValue, WorkerData, WorkerProgress, WorkerRequest, WorkerResponse } from '../engine/rankingProtocol';
import { coachAdvice, type CoachAdvice } from '../engine/coach';
import { improveSets, type SetChange } from '../engine/bestPreset';
import type { TeamSet } from '../engine/sets';
import { defaultChoice, fillProposals, formeId, type FillChoice, type Proposal } from '../engine/fillProposals';
import type { Format } from '../engine/format';
import type { GainJob } from '../engine/teamGain';
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

type Call = Exclude<WorkerRequest, { kind: 'parts' | 'names' }>;
type Answer<K extends Call['kind']> = Extract<WorkerResponse, { kind: K }>;

/** Un calcolo in sottofondo (ranking.worker.ts), con le parti dei dati che ha già ricevuto. */
class EngineWorker {
  readonly sent = new Set<number>();
  namesSent = -1;
  private next = 0;
  private waiting = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: unknown) => void; onItem?: (r: WorkerProgress) => void }>();
  constructor(private worker: Worker, onBroken: () => void) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const entry = this.waiting.get(event.data.id);
      if (!entry) return;
      // Una risposta intermedia (una proposta di Completa team): la richiesta resta aperta
      if (event.data.ok && event.data.kind === 'fillProposal') { entry.onItem?.(event.data); return; }
      this.waiting.delete(event.data.id);
      if (event.data.ok) entry.resolve(event.data);
      else entry.reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      onBroken();
      for (const entry of this.waiting.values()) entry.reject(new Error('worker'));
      this.waiting.clear();
    };
  }
  post(message: WorkerRequest) {
    this.worker.postMessage(message);
  }
  call<K extends Call['kind']>(message: Omit<Extract<Call, { kind: K }>, 'id'>): Promise<Answer<K>> {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject });
      this.post({ ...message, id } as unknown as Call);
    });
  }
  /**
   * Come `call`, ma prima della risposta finale ne arrivano altre (stesso id), passate una alla volta a `onItem`.
   * `cancel` chiede al calcolo di fermarsi al passo dopo (la risposta finale arriva lo stesso).
   */
  stream(message: Omit<Extract<Call, { kind: 'fill' }>, 'id'>, onItem: (r: WorkerProgress) => void):
    { result: Promise<Extract<WorkerResponse, { kind: 'fillDone' }>>; cancel: () => void } {
    const id = ++this.next;
    const result = new Promise<Extract<WorkerResponse, { kind: 'fillDone' }>>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject, onItem });
      this.post({ ...message, id });
    });
    return { result, cancel: () => { if (this.waiting.has(id)) this.post({ kind: 'cancel', id }); } };
  }
}

/**
 * I calcoli in sottofondo: uno ogni due core (fino a 6: ognuno ha i suoi dati in memoria). Il primo decide quali voti servono
 * e fa la lista, i voti si dividono fra tutti; lo stesso candidato va sempre allo stesso calcolo, che lo ha già in
 * cache. Le parti grandi dei dati si mandano una volta (per identità), i nomi italiani quando cambiano. Senza worker
 * (test, browser vecchi) o se uno si rompe, il calcolo si fa qui come prima.
 */
class RankingClient {
  private workers: EngineWorker[];
  private broken = false;
  private ids = new WeakMap<object, number>();
  private values = new Map<number, unknown>();
  private nextPart = 0;
  private lists = 0;
  /** Completa team in corso sull'ultimo calcolo: intanto i voti della lista vanno agli altri. */
  private fills = 0;

  constructor(make: (lead: boolean) => Worker, count: number) {
    this.workers = Array.from({ length: count }, (_, i) => new EngineWorker(make(i === 0), () => { this.broken = true; }));
  }

  private idOf(value: object | null | undefined): number {
    if (!value) return 0;
    let id = this.ids.get(value);
    if (id === undefined) {
      id = ++this.nextPart;
      this.ids.set(value, id);
      this.values.set(id, value);
    }
    return id;
  }

  /** I dati come numeri; a ogni calcolo le parti che non ha ancora (e i nomi italiani nuovi). */
  private wire(data: EngineData): WorkerData {
    const wire: WorkerData = {
      stats: this.idOf(data.stats), sets: this.idOf(data.sets), fallback: this.idOf(data.fallback),
      presets: this.idOf(data.presets), fallbackPresets: this.idOf(data.fallbackPresets),
      fallbackStats: this.idOf(data.fallbackStats), tournamentTeams: this.idOf(data.tournamentTeams), userLists: this.idOf(data.userLists),
      ignoreMeta: data.ignoreMeta, allowMultipleMegas: data.allowMultipleMegas, formatId: data.formatId,
    };
    // Le liste dell'utente cambiano spesso (preferiti, bannati): quelle vecchie non servono più
    const drop = this.lists && this.lists !== wire.userLists ? [this.lists] : [];
    if (drop.length) this.values.delete(this.lists);
    this.lists = wire.userLists;
    const needed = [wire.stats, wire.sets, wire.fallback, wire.presets, wire.fallbackPresets, wire.fallbackStats, wire.tournamentTeams, wire.userLists].filter(Boolean);
    for (const worker of this.workers) {
      const parts = needed.filter(id => !worker.sent.has(id)).map(id => [id, this.values.get(id)] as [number, unknown]);
      for (const [id] of parts) worker.sent.add(id);
      for (const id of drop) worker.sent.delete(id);
      if (parts.length || drop.length) worker.post({ kind: 'parts', parts, drop });
      if (worker.namesSent !== gameNamesVersion()) {
        worker.namesSent = gameNamesVersion();
        worker.post({ kind: 'names', names: currentGameNames() });
      }
    }
    return wire;
  }

  async request(input: RankingInput): Promise<RankingResult> {
    if (this.broken) return rank(input);
    try {
      const params = paramsOf(input);
      const data = this.wire(input.source.data);
      const [first] = this.workers;
      let primed: [string, GainValue][] = [];
      if (this.workers.length > 1) {
        const { jobs } = await first.call<'plan'>({ kind: 'plan', params, data });
        primed = await this.gains(jobs, params.lang, params.archetype, data);
      }
      const { result } = await first.call<'rank'>({ kind: 'rank', params, data, primed });
      return result;
    } catch {
      this.broken = true;
      return rank(input);
    }
  }

  /**
   * I voti richiesti, divisi fra i calcoli in parallelo, come coppie chiave → voto da mettere in cache. Con Completa
   * team in corso (e almeno tre calcoli) l'ultimo è occupato: i voti vanno agli altri, senza aspettare dietro di lui.
   */
  private async gains(jobs: GainJob[], lang: RankingParams['lang'], archetype: RankingParams['archetype'], data: WorkerData): Promise<[string, GainValue][]> {
    const last = this.workers.length - 1;
    const groups = splitJobs(jobs, this.workers.length, this.fills > 0 && this.workers.length > 2 ? last : undefined);
    const answers = await Promise.all(groups.map((group, i) => (group.length
      ? this.workers[i].call<'gains'>({ kind: 'gains', jobs: group, lang, archetype, data })
      : Promise.resolve({ values: [] as GainValue[] }))));
    return groups.flatMap((group, i) => group.map((job, j) => [job.key, answers[i].values[j]] as [string, GainValue]));
  }

  /**
   * Migliora i set in sottofondo, sull'ultimo calcolo: non aspetta in coda dietro la lista dei candidati (che fa il
   * primo). Quel calcolo carica i learnset alla prima richiesta (i ritocchi usano solo mosse legali).
   */
  async improve(team: TeamSet[], genLimit: number, given: EngineData): Promise<SetChange[]> {
    if (this.broken) return improveSets(team, given, genLimit);
    try {
      const { changes } = await this.workers[this.workers.length - 1].call<'improve'>({ kind: 'improve', team, genLimit, data: this.wire(given) });
      return changes;
    } catch {
      this.broken = true;
      return improveSets(team, given, genLimit);
    }
  }

  /** Un calcolo si è rotto (errore del worker): da qui in poi tutto si fa sulla pagina. */
  get isBroken(): boolean { return this.broken; }

  /**
   * Completa team in sottofondo, sull'ultimo calcolo (come Migliora i set; anche i controlli "questo tipo ha proposte?":
   * sugli altri caricherebbero i learnset, tanta memoria). Il worker fa un passo per volta, quindi le richieste in coda
   * non aspettano la fine. Le proposte arrivano una alla volta a `onProposal`; `max` lo ferma dopo tante proposte,
   * `cancel` al passo dopo. Un errore del calcolo (risposta non ok) non rompe il worker: passa a chi chiama.
   */
  fill(team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, given: EngineData, max: number | undefined,
    onProposal: (p: Proposal) => void): { done: Promise<void>; cancel: () => void } {
    const { result, cancel } = this.workers[this.workers.length - 1].stream(
      { kind: 'fill', team, choice, exclude: [...exclude], format, data: this.wire(given), max }, item => onProposal(item.proposal));
    this.fills++;
    const settle = () => { this.fills--; };
    result.then(settle, settle);
    return { done: result.then(() => undefined), cancel };
  }

  /** I consigli del Coaching in sottofondo: stessi tre passi della lista (voti raccolti, in parallelo, poi i consigli). */
  async advise(params: AdviceParams, given: EngineData): Promise<CoachAdvice> {
    // I dati col formato scelto (come fa coachAdvice): così i voti calcolati a parte usano le stesse regole del formato
    const engine = given.formatId === params.format.formatId ? given : { ...given, formatId: params.format.formatId };
    const direct = () => coachAdvice(params.team, params.format, engine, params.problems, params.lang);
    if (this.broken) return direct();
    try {
      const data = this.wire(engine);
      const [first] = this.workers;
      let primed: [string, GainValue][] = [];
      if (this.workers.length > 1) {
        const { jobs } = await first.call<'advicePlan'>({ kind: 'advicePlan', params, data });
        primed = await this.gains(jobs, params.lang, undefined, data);
      }
      const { advice } = await first.call<'advice'>({ kind: 'advice', params, data, primed });
      return advice;
    } catch {
      this.broken = true;
      return direct();
    }
  }
}

/**
 * I voti divisi fra i calcoli: i voti dello stesso candidato insieme, di solito al calcolo "suo" (che lo ha già in
 * cache dalle liste precedenti); se quello è già pieno, al calcolo più scarico. Così nessuno resta indietro.
 * `busy` è un calcolo occupato (Completa team): non riceve niente, la sua parte va ai più scarichi.
 */
export function splitJobs(jobs: GainJob[], count: number, busy?: number): GainJob[][] {
  const bySpecies = new Map<string, GainJob[]>();
  for (const job of jobs) {
    const list = bySpecies.get(job.set.species);
    if (list) list.push(job);
    else bySpecies.set(job.set.species, [job]);
  }
  const groups = Array.from({ length: count }, () => [] as GainJob[]);
  const free = busy === undefined ? count : count - 1;
  const share = Math.ceil(jobs.length / Math.max(1, free));
  const start = busy === 0 && count > 1 ? 1 : 0;
  for (const [species, list] of [...bySpecies].sort((a, b) => b[1].length - a[1].length)) {
    const own = affinity(species) % count;
    const target = own !== busy && groups[own].length + list.length <= share ? own
      : groups.reduce((best, group, i) => (i !== busy && group.length < groups[best].length ? i : best), start);
    groups[target].push(...list);
  }
  return groups;
}

/** Un numero per specie (sempre lo stesso): decide quale calcolo fa i voti di quel candidato. */
function affinity(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

let client: RankingClient | null | undefined;
function rankingClient(): RankingClient | null {
  if (client !== undefined) return client;
  try {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
    client = typeof Worker === 'undefined' ? null
      : new RankingClient(lead => new Worker(new URL('../engine/ranking.worker.ts', import.meta.url), { type: 'module', name: lead ? 'lead' : 'gains' }), Math.max(1, Math.min(6, Math.floor(cores / 2))));
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

/** Cosa decide i consigli del Coaching: il team (col formato e i dati) e i suoi problemi. */
export interface AdviceInput { source: { team: AdviceParams['team']; format: AdviceParams['format']; data: EngineData; lang: AdviceParams['lang'] }; problems: AdviceParams['problems'] }

/**
 * I consigli del Coaching per l'input dato (null: Coaching chiuso). Col worker si calcolano in sottofondo e finché non
 * arrivano si mostra null ("si stanno calcolando"); senza, come prima, dopo il resto della pagina.
 */
function useWorkerAdvice(input: AdviceInput | null): CoachAdvice | null {
  const worker = rankingClient()!;
  const [shown, setShown] = useState<{ input: AdviceInput; advice: CoachAdvice } | null>(null);
  useEffect(() => {
    if (!input) return;
    let live = true;
    const { source, problems } = input;
    void worker.advise({ team: source.team, format: source.format, problems, lang: source.lang }, source.data).then(advice => {
      if (live) setShown({ input, advice });
    });
    return () => { live = false; };
  }, [input, worker]);
  return shown && shown.input === input ? shown.advice : null;
}

function useSyncAdvice(input: AdviceInput | null): CoachAdvice | null {
  const deferred = useDeferredValue(input);
  const advice = useMemo(() => deferred && coachAdvice(deferred.source.team, deferred.source.format, deferred.source.data, deferred.problems, deferred.source.lang), [deferred]);
  return deferred === input ? advice : null;
}

export const useAdvice: (input: AdviceInput | null) => CoachAdvice | null = rankingClient() ? useWorkerAdvice : useSyncAdvice;

/**
 * Migliora i set senza fermare la pagina: col worker in sottofondo; senza (test, browser vecchi) qui, dopo un attimo,
 * così la finestra fa in tempo a disegnarsi.
 */
export function improveSetsLater(team: TeamSet[], data: EngineData, genLimit: number): Promise<SetChange[]> {
  // L'ultimo calcolo resta pronto: passando sul pulsante parte prima del clic, e riaprendo la finestra non si rifà
  const key = JSON.stringify([team, genLimit]);
  if (lastImprove && lastImprove.key === key && lastImprove.data === data) return lastImprove.result;
  const worker = rankingClient();
  const result = worker ? worker.improve(team, genLimit, data)
    : new Promise<SetChange[]>(resolve => setTimeout(() => resolve(improveSets(team, data, genLimit)), 30));
  lastImprove = { key, data, result };
  result.catch(() => { if (lastImprove?.result === result) lastImprove = null; });
  return result;
}
let lastImprove: { key: string; data: EngineData; result: Promise<SetChange[]> } | null = null;

/** Prepara Migliora i set in anticipo, solo se c'è il calcolo in sottofondo (senza, fermerebbe la pagina a ogni modifica). */
export function prepareImproveSets(team: TeamSet[], data: EngineData, genLimit: number): void {
  if (rankingClient()) void improveSetsLater(team, data, genLimit).catch(() => undefined);
}

/** Come è finita una richiesta di Completa team. */
export interface FillDone {
  /** Le forme escluse dopo le proposte consegnate (per "Altre proposte"). */
  exclude: Set<string>;
  /** true se il calcolo si è rotto (errore, già scritto in console): "nessuna proposta" non vuol dire "tipo vuoto". */
  failed: boolean;
}

/** Chi aspetta le proposte di un calcolo: una alla volta, poi la fine (rotto o no). */
interface FillListener { push: (p: Proposal) => void; end: (failed: boolean) => void }

/** Un calcolo di proposte in corso: quelle già arrivate e chi le aspetta. */
interface FillRun {
  proposals: Proposal[];
  listeners: Set<FillListener>;
  ended: boolean;
  /** Ferma il calcolo (col worker al passo dopo): quando non lo aspetta più nessuno. */
  stop: () => void;
}

/** Quante richieste finite (del primo giro) restano pronte da ripetere. */
const FILL_CACHE = 8;
const fillCache = new Map<string, Proposal[]>();
/** Le richieste del primo giro ancora in corso (senza `max`): una seconda uguale si aggancia invece di ripartire. */
const fillLive = new Map<string, FillRun>();
const dataIds = new WeakMap<EngineData, number>();
let nextDataId = 0;

/** Tutto quello che cambia le proposte: dati (per identità), team, scelta completa (coi valori di partenza), formato. */
function fillKey(team: TeamSet[], choice: FillChoice, format: Format, data: EngineData): string {
  let dataId = dataIds.get(data);
  if (dataId === undefined) dataIds.set(data, (dataId = ++nextDataId));
  const full = {
    archetype: choice.archetype, style: choice.style, favorites: choice.favorites ?? 'priority',
    keepSets: team.map((_, i) => choice.keepSets?.[i] ?? true),
  };
  return `${dataId}|${JSON.stringify([team, full, format])}`;
}

/** Le forme escluse dopo queste proposte: quelle di partenza più i nuovi di ognuna (come fa fillProposals). */
function excludeAfter(start: Set<string>, proposals: Proposal[]): Set<string> {
  const exclude = new Set(start);
  for (const proposal of proposals) for (const set of proposal.added) exclude.add(formeId(set));
  return exclude;
}

/** Un errore di chi riceve le proposte non deve fermare il calcolo né gli altri che aspettano. */
function safely(onProposal: (p: Proposal) => void, proposal: Proposal) {
  try { onProposal(proposal); } catch (error) { console.error(error); }
}

/**
 * Fa partire il calcolo (`max` 0 = tutte): col worker in sottofondo; senza, o se il worker si rompe, qui un passo per
 * volta (setTimeout). `onEnd` dice se è arrivato in fondo (finito, non fermato né rotto).
 */
function startFill(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData, max: number,
  onEnd: (complete: boolean) => void,
): FillRun {
  const run: FillRun = { proposals: [], listeners: new Set(), ended: false, stop: () => undefined };
  const emit = (proposal: Proposal) => {
    if (run.ended) return;
    run.proposals.push(proposal);
    for (const listener of [...run.listeners]) listener.push(proposal);
  };
  const end = (complete: boolean, failed: boolean) => {
    if (run.ended) return;
    run.ended = true;
    onEnd(complete);
    for (const listener of [...run.listeners]) listener.end(failed);
    run.listeners.clear();
  };
  // Qui, saltando le proposte già consegnate dal worker (il calcolo dà sempre le stesse, nello stesso ordine)
  const local = (skip: number) => {
    const steps = fillProposals(team, choice, new Set(exclude), format, data);
    let found = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (run.ended) return;
      let next: IteratorResult<Proposal | null, void>;
      try { next = steps.next(); } catch (error) { console.error(error); end(false, true); return; }
      if (next.done) { end(true, false); return; }
      if (next.value) {
        if (++found > skip) emit(next.value);
        if (max && found >= max) { end(true, false); return; }
      }
      timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    run.stop = () => { clearTimeout(timer); end(false, false); };
  };
  const client = rankingClient();
  if (!client || client.isBroken) { local(0); return run; }
  const call = client.fill(team, choice, exclude, format, data, max || undefined, emit);
  run.stop = () => { call.cancel(); end(false, false); };
  call.done.then(() => end(true, false), error => {
    if (run.ended) return;
    // Il worker si è rotto: si continua qui; un errore del calcolo invece si ripeterebbe uguale
    if (client.isBroken) local(run.proposals.length);
    else { console.error(error); end(false, true); }
  });
  return run;
}

/** Chi chiama riceve le proposte del calcolo (anche quelle già arrivate, subito) fino a `max`, poi `done`. */
function subscribe(run: FillRun, start: Set<string>, max: number, onProposal: (p: Proposal) => void) {
  const delivered: Proposal[] = [];
  let resolve!: (done: FillDone) => void;
  const done = new Promise<FillDone>(r => { resolve = r; });
  let open = true;
  const close = (failed: boolean) => {
    if (!open) return;
    open = false;
    run.listeners.delete(listener);
    resolve({ exclude: excludeAfter(start, delivered), failed });
    // Nessuno aspetta più: il calcolo si ferma (e non resta in cache)
    if (!run.ended && !run.listeners.size) run.stop();
  };
  const listener: FillListener = {
    push: proposal => {
      if (!open) return;
      delivered.push(proposal);
      safely(onProposal, proposal);
      if (delivered.length >= max) close(false);
    },
    end: close,
  };
  run.listeners.add(listener);
  for (const proposal of [...run.proposals]) listener.push(proposal);
  return { done, cancel: () => close(false) };
}

/**
 * Le proposte di Completa team una alla volta, senza fermare la pagina: col worker sull'ultimo calcolo; senza, qui un
 * passo per volta. `options.max` si ferma dopo tante proposte (il controllo "questo tipo ha proposte?" usa `max: 1`).
 * `done` dà le forme escluse dopo le proposte consegnate (per "Altre proposte": `exclude` resta com'è) e `failed`
 * se il calcolo si è rotto. Dopo `cancel` non arriva più niente e `done` si chiude; se non aspetta più nessuno, il
 * calcolo si ferma. Il primo giro (`exclude` vuoto, senza `max`) delle ultime FILL_CACHE richieste finite resta
 * pronto: la stessa richiesta consegna le proposte già durante la chiamata, e se è ancora in corso ci si aggancia
 * (anche con `max`). Le richieste con `max` non vanno mai in cache.
 */
export function streamFill(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData,
  onProposal: (p: Proposal) => void, options: { max?: number } = {},
): { done: Promise<FillDone>; cancel: () => void } {
  const max = options.max && options.max > 0 ? options.max : 0;
  const key = exclude.size === 0 ? fillKey(team, choice, format, data) : null;
  const cached = key ? fillCache.get(key) : undefined;
  if (key && cached) {
    // In fondo alla fila: è la più recente
    fillCache.delete(key);
    fillCache.set(key, cached);
    const shown = max ? cached.slice(0, max) : cached;
    for (const proposal of shown) safely(onProposal, proposal);
    return { done: Promise.resolve({ exclude: excludeAfter(exclude, shown), failed: false }), cancel: () => undefined };
  }
  let run = key ? fillLive.get(key) : undefined;
  if (!run) {
    const shared = key !== null && !max;
    const started: FillRun = startFill(team, choice, exclude, format, data, max, complete => {
      if (!shared || fillLive.get(key) !== started) return;
      fillLive.delete(key);
      if (!complete) return;
      fillCache.set(key, started.proposals);
      if (fillCache.size > FILL_CACHE) fillCache.delete(fillCache.keys().next().value!);
    });
    if (shared) fillLive.set(key, started);
    run = started;
  }
  return subscribe(run, exclude, max || Infinity, onProposal);
}

/**
 * L'ultima preparazione in anticipo, finché è in corso: una sola alla volta, quella vecchia (di un team già cambiato)
 * si ferma. Finita (o rotta) non conta più: se le proposte escono dalla cache, o il calcolo si è rotto, si rifà.
 */
let prefetch: { key: string; cancel: () => void } | null = null;

/** Prepara le proposte di partenza di Completa team, solo col calcolo in sottofondo (come prepareImproveSets). */
export function prepareFill(team: TeamSet[], format: Format, data: EngineData): void {
  const client = rankingClient();
  if (!client || client.isBroken || team.length >= 6 || !data.stats) return;
  const choice = defaultChoice(team);
  const key = fillKey(team, choice, format, data);
  if (prefetch?.key === key || fillCache.has(key)) return;
  cancelPrepareFill();
  const call = streamFill(team, choice, new Set(), format, data, () => undefined);
  const entry = { key, cancel: call.cancel };
  prefetch = entry;
  void call.done.then(() => { if (prefetch === entry) prefetch = null; });
}

/**
 * Ferma subito la preparazione in corso (il team è cambiato): non occupa il calcolo mentre la lista dei candidati
 * aspetta. Se il pannello è aperto sulle stesse proposte, il calcolo continua per lui.
 */
export function cancelPrepareFill(): void {
  prefetch?.cancel();
  prefetch = null;
}
