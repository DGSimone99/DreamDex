import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { rankCandidates, type RankingParams, type RankingResult } from '../engine/candidateRanking';
import type { EngineData } from '../engine/data';
import type { AdviceParams, GainValue, WorkerData, WorkerProgress, WorkerRequest, WorkerResponse } from '../engine/rankingProtocol';
import { coachAdvice, type CoachAdvice } from '../engine/coach';
import { improveSets, type SetChange } from '../engine/bestPreset';
import type { TeamSet } from '../engine/sets';
import { defaultChoice, fillProposals, type FillChoice, type Proposal } from '../engine/fillProposals';
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
  /** Come `call`, ma prima della risposta finale ne arrivano altre (stesso id), passate una alla volta a `onItem`. */
  stream(message: Omit<Extract<Call, { kind: 'fill' }>, 'id'>, onItem: (r: WorkerProgress) => void): Promise<Extract<WorkerResponse, { kind: 'fillDone' }>> {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject, onItem });
      this.post({ ...message, id });
    });
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
  private nextProbe = 0;

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

  /** I voti richiesti, divisi fra i calcoli in parallelo, come coppie chiave → voto da mettere in cache. */
  private async gains(jobs: GainJob[], lang: RankingParams['lang'], archetype: RankingParams['archetype'], data: WorkerData): Promise<[string, GainValue][]> {
    const groups = splitJobs(jobs, this.workers.length);
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

  /**
   * Completa team in sottofondo: le proposte arrivano una alla volta a `onProposal`, alla fine le forme escluse.
   * Di solito sull'ultimo calcolo (come Migliora i set); i controlli "questo tipo ha proposte?" (`probe`) a turno sugli
   * altri, così non fanno la coda davanti alle proposte vere. Se il calcolo si rompe, l'errore passa a chi chiama.
   */
  async fill(team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, given: EngineData, probe: boolean,
    onProposal: (p: Proposal) => void): Promise<Set<string>> {
    if (this.broken) throw new Error('worker');
    const last = this.workers.length - 1;
    const worker = this.workers[probe && last > 0 ? this.nextProbe++ % last : last];
    try {
      const done = await worker.stream({ kind: 'fill', team, choice, exclude: [...exclude], format, data: this.wire(given) },
        item => onProposal(item.proposal));
      return new Set(done.exclude);
    } catch (error) {
      this.broken = true;
      throw error;
    }
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
 */
function splitJobs(jobs: GainJob[], count: number): GainJob[][] {
  const bySpecies = new Map<string, GainJob[]>();
  for (const job of jobs) {
    const list = bySpecies.get(job.set.species);
    if (list) list.push(job);
    else bySpecies.set(job.set.species, [job]);
  }
  const groups = Array.from({ length: count }, () => [] as GainJob[]);
  const share = Math.ceil(jobs.length / count);
  for (const [species, list] of [...bySpecies].sort((a, b) => b[1].length - a[1].length)) {
    const own = affinity(species) % count;
    const target = groups[own].length + list.length <= share ? own
      : groups.reduce((best, group, i) => (group.length < groups[best].length ? i : best), 0);
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

/** Una richiesta di proposte in corso: quelle già arrivate, chi le aspetta, la fine (le forme escluse). */
interface FillRun {
  proposals: Proposal[];
  listeners: Set<(p: Proposal) => void>;
  done: Promise<Set<string>>;
  /** Ferma il calcolo fatto qui (senza worker); col worker non fa niente: finisce comunque e resta in cache. */
  stop: () => void;
}

/** Quante richieste finite (del primo giro) restano pronte da ripetere. */
const FILL_CACHE = 8;
const fillCache = new Map<string, { proposals: Proposal[]; exclude: string[] }>();
/** Le richieste del primo giro ancora in corso: una seconda uguale si aggancia invece di ripartire. */
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

/** Fa partire il calcolo: col worker in sottofondo; senza (o se si rompe) qui, un passo per volta (setTimeout). */
function startFill(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData, probe: boolean,
  onFinish: (final: Set<string>, complete: boolean) => void,
): FillRun {
  const run: FillRun = { proposals: [], listeners: new Set(), done: Promise.resolve(exclude), stop: () => undefined };
  const emit = (proposal: Proposal) => {
    run.proposals.push(proposal);
    for (const listener of [...run.listeners]) listener(proposal);
  };
  run.done = new Promise<Set<string>>(resolve => {
    let ended = false;
    const finish = (final: Set<string>, complete: boolean) => {
      if (ended) return;
      ended = true;
      onFinish(final, complete);
      resolve(final);
    };
    // Qui, saltando le proposte già consegnate dal worker (il calcolo dà sempre le stesse, nello stesso ordine)
    const local = (skip: number) => {
      const own = new Set(exclude);
      const steps = fillProposals(team, choice, own, format, data);
      let timer: ReturnType<typeof setTimeout>;
      let stopped = false;
      const step = () => {
        if (stopped) return;
        let next: IteratorResult<Proposal | null, void>;
        try { next = steps.next(); } catch { finish(own, false); return; }
        if (next.done) { finish(own, true); return; }
        if (next.value) { if (skip > 0) skip--; else emit(next.value); }
        timer = setTimeout(step, 0);
      };
      timer = setTimeout(step, 0);
      run.stop = () => { stopped = true; clearTimeout(timer); finish(own, false); };
    };
    const client = rankingClient();
    if (!client) { local(0); return; }
    client.fill(team, choice, exclude, format, data, probe, emit).then(final => finish(final, true), () => local(run.proposals.length));
  });
  return run;
}

/**
 * Le proposte di Completa team una alla volta, senza fermare la pagina: col worker sull'ultimo calcolo (`probe`: a
 * turno sugli altri, per i controlli "questo tipo ha proposte?", che si fermano alla prima con `cancel`); senza, qui
 * un passo per volta. `done` dà le forme escluse alla fine, per "Altre proposte" (`exclude` resta com'è). Dopo
 * `cancel` non arriva più niente. Il primo giro (`exclude` vuoto) delle ultime FILL_CACHE richieste resta pronto: la
 * stessa richiesta consegna le proposte già durante la chiamata, e se è ancora in corso ci si aggancia.
 */
export function streamFill(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData,
  onProposal: (p: Proposal) => void, options: { probe?: boolean } = {},
): { done: Promise<Set<string>>; cancel: () => void } {
  const key = exclude.size === 0 ? fillKey(team, choice, format, data) : null;
  const cached = key ? fillCache.get(key) : undefined;
  if (key && cached) {
    // In fondo alla fila: è la più recente
    fillCache.delete(key);
    fillCache.set(key, cached);
    for (const proposal of cached.proposals) onProposal(proposal);
    return { done: Promise.resolve(new Set(cached.exclude)), cancel: () => undefined };
  }
  let run = key ? fillLive.get(key) : undefined;
  if (!run) {
    const started: FillRun = startFill(team, choice, exclude, format, data, !!options.probe, (final, complete) => {
      if (!key || fillLive.get(key) !== started) return;
      fillLive.delete(key);
      if (!complete) return;
      fillCache.set(key, { proposals: started.proposals, exclude: [...final] });
      if (fillCache.size > FILL_CACHE) fillCache.delete(fillCache.keys().next().value!);
    });
    if (key) fillLive.set(key, started);
    run = started;
  }
  const live = run;
  for (const proposal of live.proposals) onProposal(proposal);
  let listening = true;
  const listener = (proposal: Proposal) => { if (listening) onProposal(proposal); };
  live.listeners.add(listener);
  return {
    done: live.done.then(final => new Set(final)),
    cancel: () => {
      if (!listening) return;
      listening = false;
      live.listeners.delete(listener);
      // Nessuno aspetta più: il calcolo fatto qui si ferma (col worker no: finisce e resta pronto)
      if (!live.listeners.size) live.stop();
    },
  };
}

/** Prepara le proposte di partenza di Completa team, solo col calcolo in sottofondo (come prepareImproveSets). */
export function prepareFill(team: TeamSet[], format: Format, data: EngineData): void {
  if (rankingClient() && team.length < 6 && data.stats) streamFill(team, defaultChoice(team), new Set(), format, data, () => undefined);
}
