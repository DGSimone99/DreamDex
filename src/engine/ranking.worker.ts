/// <reference lib="webworker" />
/**
 * Il calcolo della lista dei candidati in sottofondo (vedi candidateRanking.ts). Ha un motore tutto suo, con le sue
 * cache: tier, ban e learnset li carica da sé all'avvio, i dati del formato e i nomi italiani arrivano dall'app.
 * Le parti dei dati arrivano una volta sola (per numero): restano gli stessi oggetti, così le cache del motore valgono
 * da una richiesta all'altra.
 */
import { loadBans, loadTiers } from '../data/load';
import { initGameNames, type GameNames } from '../i18n/game';
import { rankCandidates, type RankingParams } from './candidateRanking';
import type { EngineData } from './data';
import { initTiers } from './dex';
import { initBans } from './formats';
import { initLearnsets } from './learnsets';
import type { WorkerData, WorkerRequest, WorkerResponse } from './rankingProtocol';

const ready = Promise.all([loadTiers().then(initTiers), loadBans().then(initBans), initLearnsets()]);

const parts = new Map<number, unknown>();
const part = <T,>(id: number): T => (id ? (parts.get(id) as T) : null as T);

function engineData(d: WorkerData): EngineData {
  return {
    stats: part(d.stats), sets: part(d.sets), fallback: part(d.fallback), presets: part(d.presets),
    fallbackPresets: part(d.fallbackPresets), fallbackStats: part(d.fallbackStats), userLists: part(d.userLists) ?? undefined,
    ignoreMeta: d.ignoreMeta, allowMultipleMegas: d.allowMultipleMegas, formatId: d.formatId,
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
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
  let response: WorkerResponse;
  try {
    const result = rankCandidates(message.params as RankingParams, engineData(message.data));
    response = { id: message.id, ok: true, result };
  } catch (error) {
    response = { id: message.id, ok: false, error: String(error) };
  }
  self.postMessage(response);
};
