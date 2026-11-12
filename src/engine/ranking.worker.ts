/// <reference lib="webworker" />
/**
 * Il calcolo della lista dei candidati in sottofondo (vedi candidateRanking.ts e ui/useRanking.ts). Ogni worker ha un
 * motore tutto suo, con le sue cache: tier, ban e learnset li carica da sé all'avvio, i dati del formato e i nomi
 * italiani arrivano dall'app. Le parti dei dati arrivano una volta sola (per numero) e i team uguali diventano lo
 * stesso oggetto: così le cache del motore (che guardano l'identità) valgono da una richiesta all'altra.
 */
import { loadBans, loadTiers } from '../data/load';
import { initGameNames, type GameNames } from '../i18n/game';
import { rankCandidates, type RankingParams } from './candidateRanking';
import type { EngineData } from './data';
import { initTiers } from './dex';
import { initBans } from './formats';
import { initLearnsets } from './learnsets';
import type { WorkerData, WorkerRequest, WorkerResponse } from './rankingProtocol';
import type { TeamSet } from './sets';
import { collectGainJobs, computeGains, primeGains } from './teamGain';
import { coachAdvice } from './coach';
import { improveSets } from './bestPreset';
import { fillProposals } from './fillProposals';

const ready = Promise.all([loadTiers().then(initTiers), loadBans().then(initBans)]);
// I learnset (tanta memoria) servono solo a fare i set dei candidati, cioè a chi decide i voti e fa la lista: chi
// calcola solo voti non li carica (il voto non li usa: voti identici con e senza, controllato su 784 voti)
// Il primo calcolo ("lead", quello che fa la lista) li carica subito, così la prima lista non li aspetta
let learnsets: Promise<void> | null = self.name === 'lead' ? initLearnsets() : null;

const parts = new Map<number, unknown>();
const part = <T,>(id: number): T => (id ? (parts.get(id) as T) : null as T);

/** Gli stessi dati per le stesse parti: un solo oggetto (le cache guardano anche l'identità delle parti). */
const datas = new Map<string, EngineData>();
function engineData(d: WorkerData): EngineData {
  const key = JSON.stringify(d);
  let data = datas.get(key);
  if (!data) {
    data = {
      stats: part(d.stats), sets: part(d.sets), fallback: part(d.fallback), presets: part(d.presets),
      fallbackPresets: part(d.fallbackPresets), fallbackStats: part(d.fallbackStats), tournamentTeams: part(d.tournamentTeams), userLists: part(d.userLists) ?? undefined,
      ignoreMeta: d.ignoreMeta, allowMultipleMegas: d.allowMultipleMegas, formatId: d.formatId,
    };
    if (datas.size >= 20) datas.clear();
    datas.set(key, data);
  }
  return data;
}

/** Un team uguale a uno già visto è lo stesso oggetto (e anche i suoi membri). */
const teams = new Map<string, TeamSet[]>();
function sameTeam(team: TeamSet[]): TeamSet[] {
  const key = JSON.stringify(team);
  let known = teams.get(key);
  if (!known) {
    if (teams.size >= 50) teams.clear();
    teams.set(key, (known = team));
  }
  return known;
}
const withTeam = (params: RankingParams): RankingParams => ({ ...params, team: sameTeam(params.team) });

function handle(message: Exclude<WorkerRequest, { kind: 'parts' | 'names' | 'fill' | 'cancel' }>): WorkerResponse {
  if (message.kind === 'plan') {
    const params = withTeam(message.params);
    const data = engineData(message.data);
    const jobs = collectGainJobs(() => rankCandidates(params, data));
    return { id: message.id, ok: true, kind: 'plan', jobs };
  }
  if (message.kind === 'gains') {
    return { id: message.id, ok: true, kind: 'gains', values: computeGains(message.jobs, engineData(message.data), message.lang, message.archetype) };
  }
  if (message.kind === 'advicePlan' || message.kind === 'advice') {
    // I consigli del Coaching: stesso schema della lista (voti raccolti, calcolati in parallelo, messi in cache)
    const { team, format, problems, lang } = message.params;
    const run = () => coachAdvice(sameTeam(team), format, engineData(message.data), problems, lang);
    if (message.kind === 'advicePlan') return { id: message.id, ok: true, kind: 'advicePlan', jobs: collectGainJobs(() => { run(); }) };
    primeGains(message.primed);
    return { id: message.id, ok: true, kind: 'advice', advice: run() };
  }
  // Migliora i set: i set nuovi e il guadagno di ogni membro (qualche secondo la prima volta: qui non ferma la pagina)
  if (message.kind === 'improve') return { id: message.id, ok: true, kind: 'improve', changes: improveSets(message.team, engineData(message.data), message.genLimit) };
  primeGains(message.primed);
  return { id: message.id, ok: true, kind: 'rank', result: rankCandidates(withTeam(message.params), engineData(message.data)) };
}

/** Le richieste di Completa team arrivate e non ancora finite, e quelle fra loro da fermare. */
const fills = new Set<number>();
const cancelled = new Set<number>();
/** Un attimo di pausa (MessageChannel: più rapido di setTimeout), così fra un passo e l'altro passano le altre richieste. */
const pause = () => new Promise<void>(resolve => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
  channel.port2.postMessage(null);
});

/**
 * Completa team un passo per volta: ogni proposta parte appena trovata; fra un passo e l'altro una pausa, così le altre
 * richieste (voti della lista, Migliora i set) non aspettano la fine e `cancel` può fermarla. Alla fine le forme escluse.
 */
async function fill(message: Extract<WorkerRequest, { kind: 'fill' }>): Promise<WorkerResponse> {
  const exclude = new Set(message.exclude);
  const steps = fillProposals(sameTeam(message.team), message.choice, exclude, message.format, engineData(message.data));
  let found = 0;
  while (!cancelled.has(message.id)) {
    const next = steps.next();
    if (next.done) break;
    if (next.value) {
      self.postMessage({ id: message.id, ok: true, kind: 'fillProposal', proposal: next.value } satisfies WorkerResponse);
      if (message.max && ++found >= message.max) break;
    }
    await pause();
  }
  return { id: message.id, ok: true, kind: 'fillDone', exclude: [...exclude] };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.kind === 'cancel') {
    if (fills.has(message.id)) cancelled.add(message.id);
    return;
  }
  if (message.kind === 'fill') fills.add(message.id);
  if (message.kind === 'parts') {
    for (const [id, value] of message.parts) parts.set(id, value);
    for (const id of message.drop) parts.delete(id);
    return;
  }
  if (message.kind === 'names') {
    initGameNames(message.names as GameNames | null);
    return;
  }
  await ready;
  if (message.kind !== 'gains') await (learnsets ??= initLearnsets());
  let response: WorkerResponse;
  try {
    response = message.kind === 'fill' ? await fill(message) : handle(message);
  } catch (error) {
    response = { id: message.id, ok: false, error: String(error) };
  }
  if (message.kind === 'fill') { fills.delete(message.id); cancelled.delete(message.id); }
  self.postMessage(response);
};
