import { battleAbility, battleSpecies, getMove, getSpecies, isDefined, STAT_ABILITIES, toID } from './dex';
import { rulesOf, type FormatRules } from './formatRules';
import { mostCommonSet, type TeamSet } from './sets';
import { statLines } from './statCalc';
import { attackStyle, SPEED_ABILITIES } from './roles';
import type { EngineData } from './data';
import { usesMeta } from './analysis';
import { setKey } from './damage';
import { memberOffense } from './offense';
import { memberSpeed } from './speedArea';
import { outspeedShare, speedPool, speedStat, type SpeedRival } from './speed';
import { teamField } from './types';

export type Family = 'attack' | 'defense' | 'field' | 'disruption';
export type SubRole = 'physicalSweeper' | 'specialSweeper' | 'physicalBreaker' | 'specialBreaker'
  | 'physicalWall' | 'specialWall' | 'recovery' | 'hazards' | 'removal' | 'pivot' | 'screens'
  | 'dot' | 'debuff' | 'phazer' | 'taunt' | 'encore' | 'itemRemoval';

/** Le sotto-ruoli di ogni famiglia, nell'ordine della tabella della specifica. */
export const FAMILIES: Record<Family, SubRole[]> = {
  attack: ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker'],
  defense: ['physicalWall', 'specialWall', 'recovery'],
  field: ['hazards', 'removal', 'pivot', 'screens'],
  disruption: ['dot', 'debuff', 'phazer', 'taunt', 'encore', 'itemRemoval'],
};

/** Sotto-ruoli misurati: famiglia Attacco, muri e Recupero. */
export const MEASURED: SubRole[] = [...FAMILIES.attack, 'physicalWall', 'specialWall', 'recovery'];

/** Valori 0-1 per sotto-ruolo; solo le voci > 0. */
export type SubRoleValues = Partial<Record<SubRole, number>>;

export interface StatusSource {
  move: string;
  dot: number;
  debuff: number;
  status: 'tox' | 'brn' | 'psn' | 'par' | 'slp' | 'yawn' | 'trap' | 'salt' | 'seed';
}

const ORDER: SubRole[] = (Object.values(FAMILIES) as SubRole[][]).flat();

/** I sotto-ruoli con valore almeno `min`, nell'ordine delle famiglie. */
export const rolesList = (v: SubRoleValues, min = 0.5): SubRole[] => ORDER.filter(r => (v[r] ?? 0) >= min);

/** Indice di muro: PS x Dif e PS x DifSp sulle statistiche reali (livello 100), con i moltiplicatori di strumento e abilità. */
export function wallIndex(set: TeamSet): { physical: number; special: number } {
  const species = battleSpecies(set);
  if (!species) return { physical: 0, special: 0 };
  const lines = statLines(set);
  const value = (id: string) => lines.find(l => l.stat === id)?.value ?? 0;
  const item = toID(set.item);
  const ability = toID(battleAbility(set));
  let def = 1;
  let spd = 1;
  if (item === 'assaultvest') spd *= 1.5;
  // Eviolite conta solo su chi non è completamente evoluto
  if (item === 'eviolite' && (species.evos?.length ?? 0) > 0) { def *= 1.5; spd *= 1.5; }
  if (ability === 'furcoat') def *= 2;
  if (ability === 'icescales') spd *= 2;
  if (ability === 'marvelscale' && (item === 'flameorb' || item === 'toxicorb')) def *= 1.5;
  return { physical: value('hp') * value('def') * def, special: value('hp') * value('spd') * spd };
}

/** Valore di ogni stato: danno nel tempo e debuff, prima di probabilità e immunità. */
const STATUS_TABLE: Record<StatusSource['status'], { dot: number; debuff: number }> = {
  tox: { dot: 1, debuff: 0 }, brn: { dot: 0.5, debuff: 0.25 }, psn: { dot: 0.5, debuff: 0 },
  par: { dot: 0, debuff: 0.25 }, slp: { dot: 0, debuff: 1 }, yawn: { dot: 0, debuff: 0.5 },
  trap: { dot: 0.25, debuff: 0 }, salt: { dot: 1, debuff: 0 }, seed: { dot: 0.5, debuff: 0 },
};
const VOLATILE_STATUS: Record<string, StatusSource['status']> = {
  yawn: 'yawn', leechseed: 'seed', saltcure: 'salt', partiallytrapped: 'trap',
};

/** Fonti di stato del set, già x probabilità x precisione (solo il sonno), prima delle immunità. */
export function statusSources(set: TeamSet): StatusSource[] {
  const serene = toID(battleAbility(set)) === 'serenegrace';
  const out: StatusSource[] = [];
  const add = (move: string, status: StatusSource['status'] | undefined, chance: number, accuracy: number) => {
    if (!status || !STATUS_TABLE[status]) return;
    const k = chance * (status === 'slp' ? accuracy : 1);
    out.push({ move, status, dot: STATUS_TABLE[status].dot * k, debuff: STATUS_TABLE[status].debuff * k });
  };
  for (const m of set.moves.map(getMove).filter(isDefined)) {
    const accuracy = m.accuracy === true ? 1 : (m.accuracy ?? 100) / 100;
    const direct = (m.status as StatusSource['status'] | undefined) ?? VOLATILE_STATUS[m.volatileStatus ?? ''];
    add(m.name, direct, 1, accuracy);
    const secondaries = m.secondaries ?? (m.secondary ? [m.secondary] : []);
    for (const sec of secondaries) {
      const status = (sec.status as StatusSource['status'] | undefined) ?? VOLATILE_STATUS[sec.volatileStatus ?? ''];
      add(m.name, status, Math.min(1, ((sec.chance ?? 100) / 100) * (serene ? 2 : 1)), accuracy);
    }
  }
  return out;
}

const RECOVERY: Record<string, number> = {
  recover: 1, roost: 1, slackoff: 1, softboiled: 1, milkdrink: 1, moonlight: 1, synthesis: 1, morningsun: 1,
  shoreup: 1, strengthsap: 1, wish: 1, rest: 0.5, painsplit: 0.5, leechseed: 0.25,
};
const HAZARDS: Record<string, number> = { stealthrock: 1, spikes: 1, stoneaxe: 1, ceaselessedge: 1, toxicspikes: 0.75 };
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
const PIVOT = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);
const PHAZER = new Set(['haze', 'clearsmog', 'whirlwind', 'roar', 'dragontail', 'circlethrow']);
const SNOW = new Set(['snowscape', 'chillyreception']);

/** Soglia di statistica reale (Att/AttSp o Vel) per contare come attaccante o veloce. */
const STAT_MIN = 300;

/** Sotto-ruoli del solo set (senza meta): gli attaccanti sono un'approssimazione, i muri usano l'indice reale. */
export function setSubRoles(set: TeamSet, rules: FormatRules): SubRoleValues {
  const species = battleSpecies(set);
  if (!species) return {};
  const moves = set.moves.map(getMove).filter(isDefined);
  const ids: string[] = moves.map(m => m.id);
  const item = toID(set.item);
  const ability = toID(battleAbility(set));
  const v: SubRoleValues = {};
  const put = (role: SubRole, value: number) => { if (value > (v[role] ?? 0)) v[role] = value; };

  // Attacco: statistica reale e stile d'attacco; lo sweeper deve anche muoversi per primo
  const lines = statLines(set);
  const stat = (id: string) => lines.find(l => l.stat === id)?.value ?? 0;
  const style = attackStyle(set);
  const selfBoost = (s: 'atk' | 'spa' | 'spe') => moves.some(m => m.category === 'Status' && m.target === 'self' && (m.boosts?.[s] ?? 0) > 0);
  const priority = moves.some(m => m.category !== 'Status' && m.priority > 0);
  // Abilità che moltiplicano Att/AttSp (Huge Power, Pure Power…) e che raddoppiano la Velocità (Swift Swim, Sand Rush…), come la regola di prima
  const boost = STAT_ABILITIES[ability] ?? {};
  const attackStat = (id: 'atk' | 'spa') => stat(id) * (boost[id] ?? 1);
  const fast = stat('spe') >= STAT_MIN || item === 'choicescarf' || SPEED_ABILITIES.has(ability);
  if (style === 'physical' && attackStat('atk') >= STAT_MIN) {
    put('physicalBreaker', 1);
    if (fast || selfBoost('spe') || (selfBoost('atk') && priority)) put('physicalSweeper', 1);
  }
  if (style === 'special' && attackStat('spa') >= STAT_MIN) {
    put('specialBreaker', 1);
    if (fast || selfBoost('spe') || (selfBoost('spa') && priority)) put('specialSweeper', 1);
  }

  // Difesa
  const wall = wallIndex(set);
  if (wall.physical >= rules.wallIndex.physical) put('physicalWall', 1);
  if (wall.special >= rules.wallIndex.special) put('specialWall', 1);
  ids.forEach(id => put('recovery', RECOVERY[id] ?? 0));
  if (ability === 'regenerator') put('recovery', 1);

  // Campo
  ids.forEach(id => put('hazards', HAZARDS[id] ?? 0));
  if (ids.some(id => REMOVAL.has(id))) put('removal', 1);
  if (ids.some(id => PIVOT.has(id))) put('pivot', 1);
  const clay = item === 'lightclay' ? 1 : 0.75;
  const veil = ids.includes('auroraveil');
  const snow = ability === 'snowwarning' || ids.some(id => SNOW.has(id));
  const reflect = ids.includes('reflect');
  const lightScreen = ids.includes('lightscreen');
  // Aurora Veil vale 1 solo con la neve (qui solo se il set la porta da sé; la neve del team la vede il team)
  if ((reflect && lightScreen) || (veil && snow)) put('screens', clay);
  else if (reflect || lightScreen || veil) put('screens', 0.6 * clay);

  // Disturbo
  for (const s of statusSources(set)) {
    put('dot', Math.min(1, s.dot));
    put('debuff', Math.min(1, s.debuff));
  }
  if (ids.some(id => PHAZER.has(id)) || ability === 'unaware') put('phazer', 1);
  if (ids.includes('taunt')) put('taunt', 1);
  if (ids.includes('encore')) put('encore', 1);
  if (ids.includes('knockoff')) put('itemRemoval', 1);
  if (ids.includes('trick') || ids.includes('switcheroo')) put('itemRemoval', item.startsWith('choice') ? 1 : 0.5);

  return v;
}

/** Soglie del rilevatore misurato (Offesa, Wallbreaking e quota di Velocità del membro). */
export const SWEEPER_OFFENSE = 50;
export const SWEEPER_SPEED = 0.6;
export const BREAKER_WALLBREAKING = 55;

/** Un rivale del gruppo con cui si misurano gli stati: tipi, abilità e strumento del suo set più comune. */
export interface StatusRival { species: string; types: string[]; ability: string; item: string; weight: number }

const statusPools = new Map<string, StatusRival[]>();

/** Stesse specie di speedPool; col meta set più comune e uso come peso, senza meta prima abilità e peso uguale. */
export function statusPool(data: EngineData): StatusRival[] {
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let pool = statusPools.get(key);
  if (pool) return pool;
  const meta = usesMeta(data);
  pool = speedPool(data).flatMap(r => {
    const species = getSpecies(r.species);
    if (!species) return [];
    const common = meta ? mostCommonSet(data.stats, r.species) : null;
    const usage = meta ? data.stats!.pokemon[r.species]?.usage ?? 0 : 1;
    return [{
      species: r.species, types: [...species.types],
      ability: common?.ability || species.abilities[0] || '', item: common?.item ?? '', weight: usage > 0 ? usage : 0,
    }];
  });
  statusPools.set(key, pool);
  return pool;
}

const SLEEP_ABILITIES = ['insomnia', 'vitalspirit', 'sweetveil', 'comatose', 'purifyingsalt'];
/** Abilità che bloccano lo stato, per tipo di stato (oltre ai tipi e ai blocchi sulle mosse di stato). */
const BLOCKING_ABILITIES: Record<StatusSource['status'], string[]> = {
  tox: ['immunity', 'pastelveil', 'comatose', 'purifyingsalt'], psn: ['immunity', 'pastelveil', 'comatose', 'purifyingsalt'],
  brn: ['waterveil', 'waterbubble', 'thermalexchange', 'comatose', 'purifyingsalt'],
  par: ['limber', 'comatose', 'purifyingsalt'], slp: SLEEP_ABILITIES, yawn: SLEEP_ABILITIES,
  trap: [], salt: [], seed: [],
};
const IMMUNE_TYPE: Partial<Record<StatusSource['status'], string>> = { brn: 'Fire', par: 'Electric', seed: 'Grass' };

/** Il rivale può subire lo stato di questa fonte? `corrosion`: chi avvelena ignora Acciaio e Veleno. */
function affects(src: StatusSource, rival: StatusRival, corrosion: boolean): boolean {
  const move = getMove(src.move);
  const ability = toID(rival.ability);
  const types = rival.types;
  const isStatusMove = move?.category === 'Status';
  if (BLOCKING_ABILITIES[src.status].includes(ability)) return false;
  if (isStatusMove && (ability === 'magicbounce' || ability === 'goodasgold')) return false;
  if (!isStatusMove && ability === 'shielddust' && src.status !== 'salt') return false;
  if (src.status === 'tox' || src.status === 'psn') {
    if (!corrosion && (types.includes('Steel') || types.includes('Poison'))) return false;
  } else {
    const t = IMMUNE_TYPE[src.status];
    if (t && types.includes(t)) return false;
  }
  if (src.status === 'par' && toID(src.move) === 'thunderwave' && types.includes('Ground')) return false;
  // Le polveri non toccano l'Erba, chi ha Overcoat o gli Occhialini Protettivi
  if (move?.flags?.powder && (types.includes('Grass') || ability === 'overcoat' || toID(rival.item) === 'safetygoggles')) return false;
  return true;
}

/**
 * Perché il membro ha il sotto-ruolo: la fonte (mossa, abilità, 'wall' per i muri), la quota del gruppo per Taunt,
 * Encore e stati, e per i muri l'indice reale con la soglia del formato.
 */
export interface SubRoleReason { role: SubRole; value: number; source: string; share?: number; index?: number; threshold?: number; prankster?: boolean }

const moveName = (id: string) => getMove(id)?.name ?? id;

/** La fonte di un sotto-ruolo del solo set: la mossa (o l'abilità) che vale di più. */
function setSource(role: SubRole, ids: string[], ability: string, item: string): string {
  const best = (table: Record<string, number>) => ids.reduce<string | null>((a, id) => ((table[id] ?? 0) > (a ? table[a] ?? 0 : 0) ? id : a), null);
  const first = (list: Set<string>) => ids.find(id => list.has(id));
  let id: string | null | undefined = null;
  if (role === 'recovery') {
    id = best(RECOVERY);
    // Regenerator vale 1: vince su Rest, Pain Split e Leech Seed
    if (ability === 'regenerator' && !(id && RECOVERY[id] === 1)) return 'Regenerator';
  }
  if (role === 'hazards') id = best(HAZARDS);
  if (role === 'removal') id = first(REMOVAL);
  if (role === 'pivot') id = first(PIVOT);
  if (role === 'phazer') { id = first(PHAZER); if (!id && ability === 'unaware') return 'Unaware'; }
  if (role === 'itemRemoval') {
    if (ids.includes('knockoff')) id = 'knockoff';
    else { id = ids.find(m => m === 'trick' || m === 'switcheroo'); if (id && item.startsWith('choice')) return `${moveName(id)} + Choice`; }
  }
  return id ? moveName(id) : 'set';
}

const isPriorityAttack = (set: TeamSet) => set.moves.map(getMove).filter(isDefined).some(m => m.category !== 'Status' && m.priority > 0);

/** Calcolo con i gruppi dati (i test li passano a mano); restituisce valori e motivi per la scheda. */
export function measureWith(set: TeamSet, team: TeamSet[], data: EngineData, pool: StatusRival[], speeds: SpeedRival[]): { values: SubRoleValues; reasons: SubRoleReason[] } {
  const values: SubRoleValues = {};
  const reasons: SubRoleReason[] = [];
  if (!battleSpecies(set)) return { values, reasons };
  const base = setSubRoles(set, rulesOf(data));
  const put = (role: SubRole, value: number, source: string, share?: number) => {
    if (!(value > 0) || value <= (values[role] ?? 0)) return;
    values[role] = value;
    const reason: SubRoleReason = share === undefined ? { role, value, source } : { role, value, source, share };
    const i = reasons.findIndex(r => r.role === role);
    if (i >= 0) reasons[i] = reason; else reasons.push(reason);
  };
  const ids: string[] = set.moves.map(getMove).filter(isDefined).map(m => m.id);
  const ability = toID(battleAbility(set));

  // Difesa e campo come nel rilevatore del set; Aurora Veil conta con la neve del team
  const keep: SubRole[] = ['recovery', 'hazards', 'removal', 'pivot', 'phazer', 'itemRemoval'];
  for (const role of keep) if (base[role]) put(role, base[role]!, setSource(role, ids, ability, toID(set.item)));
  // I muri con l'indice reale e la soglia, per il motivo nella scheda
  const rules = rulesOf(data);
  const wall = wallIndex(set);
  if (base.physicalWall) put('physicalWall', base.physicalWall, 'wall');
  if (base.specialWall) put('specialWall', base.specialWall, 'wall');
  for (const r of reasons) {
    if (r.role === 'physicalWall') { r.index = wall.physical; r.threshold = rules.wallIndex.physical; }
    if (r.role === 'specialWall') { r.index = wall.special; r.threshold = rules.wallIndex.special; }
  }
  const clay = toID(set.item) === 'lightclay' ? 1 : 0.75;
  const snow = teamField(team).weather === 'snow';
  const reflect = ids.includes('reflect');
  const lightScreen = ids.includes('lightscreen');
  const veil = ids.includes('auroraveil');
  // La fonte degli schermi: le mosse del set (Light Clay a parte, già nel valore)
  const screenMoves = [reflect && 'Reflect', lightScreen && 'Light Screen', veil && 'Aurora Veil'].filter(Boolean).join(' + ');
  if ((reflect && lightScreen) || (veil && snow)) put('screens', clay, screenMoves);
  else if (reflect || lightScreen || veil) put('screens', 0.6 * clay, screenMoves);

  // Attacco dai numeri dell'Offesa e della Velocità
  const offense = memberOffense(set, team, data);
  const category = offense?.bestMove ? getMove(offense.bestMove)?.category : undefined;
  if (offense && (category === 'Physical' || category === 'Special')) {
    const side = category === 'Physical' ? 'physical' : 'special';
    if (offense.wallbreaking + offense.wallbreakingGain >= BREAKER_WALLBREAKING) put(`${side}Breaker`, 1, offense.bestMove!);
    if (offense.value >= SWEEPER_OFFENSE) {
      const speed = memberSpeed(set, team, data);
      const fast = !!speed && speed.total >= SWEEPER_SPEED;
      const setupSpeed = !!speed?.gains.some(g => g.condition === 'setup');
      if (fast || setupSpeed || (offense.setupMove && isPriorityAttack(set))) put(`${side}Sweeper`, 1, offense.bestMove!);
    }
  }

  // Taunt ed Encore: quota del gruppo superata; Prankster: 1 meno la quota Dark
  const total = pool.reduce((a, r) => a + r.weight, 0);
  const share = (pred: (r: StatusRival) => boolean) => (total > 0 ? pool.filter(pred).reduce((a, r) => a + r.weight, 0) / total : 0);
  const open = ability === 'prankster'
    ? 1 - share(r => r.types.includes('Dark'))
    : outspeedShare(speedStat(set).value, speeds, set.species);
  if (ids.includes('taunt')) put('taunt', open, 'Taunt', open);
  if (ids.includes('encore')) put('encore', open, 'Encore', open);
  if (ability === 'prankster') for (const r of reasons) if (r.role === 'taunt' || r.role === 'encore') r.prankster = true;

  // Stati: valore x quota del gruppo che li può subire
  const corrosion = ability === 'corrosion';
  for (const src of statusSources(set)) {
    const s = share(r => affects(src, r, corrosion));
    put('dot', Math.min(1, src.dot * s), src.move, s);
    put('debuff', Math.min(1, src.debuff * s), src.move, s);
  }
  return { values, reasons };
}

const CACHE_LIMIT = 500;
const cache = new Map<string, { values: SubRoleValues; reasons: SubRoleReason[] }>();

function measured(set: TeamSet, team: TeamSet[], data: EngineData) {
  const key = `${setKey(set)}|${team.map(setKey).join(',')}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  hit = measureWith(set, team, data, statusPool(data), speedPool(data));
  cache.set(key, hit);
  return hit;
}

/** Sotto-ruoli del membro con i numeri veri: Offesa, Velocità e gruppo del meta (o del tier). */
export function measuredSubRoles(set: TeamSet, team: TeamSet[], data: EngineData): SubRoleValues {
  return measured(set, team, data).values;
}

/** Perché il membro ha ogni sotto-ruolo (per la scheda). */
export function subRoleReasons(set: TeamSet, team: TeamSet[], data: EngineData): SubRoleReason[] {
  return measured(set, team, data).reasons;
}
