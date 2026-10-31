import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { softScore } from './scale';
import { bestHit, setKey } from './damage';
import { ownConditions } from './coverage';
import { usesMeta } from './analysis';
import { mostCommonSet, type TeamSet } from './sets';
import { isWebImmune, outspeedShare, paradoxSpeedBoost, sameSelf, speedPool, speedStat, statsKey, type SpeedRival } from './speed';
import { ownField } from './types';
import { getSpecies } from './dex';

export { isWebImmune };

/**
 * Le condizioni che fanno superare più Pokémon: setup, meteo/campo, boost dei Paradox (Booster Energy, sole, campo elettrico),
 * Unburden, Sticky Web, Trick Room, Tailwind, paralisi e rallentamenti.
 */
export type SpeedCondition = 'setup' | 'weather' | 'booster' | 'unburden' | 'priority' | 'web' | 'trickroom' | 'tailwind' | 'slow';

/** Protosynthesis e Quark Drive: Velocità ×1,5 quando è la statistica più alta. */
export const PARADOX_SPEED = 1.5;

/** Le condizioni che porta il team (il Controllo velocità); le altre sono del membro stesso (la sua Velocità). */
export const CONTROL_CONDITIONS: SpeedCondition[] = ['web', 'trickroom', 'tailwind', 'slow'];

/**
 * La quota media di Pokémon superati che vale "piena" (circa 93): i più lenti del meta li supera chiunque e non
 * contano, quindi non serve superare proprio tutti.
 */
export const SPEED_FULL = 0.9;

/** Peso di ogni membro per posizione di velocità, dal più veloce: i due più rapidi fanno quasi tutto, ma la velocità serve a tutti. */
export const SPEED_RANK_WEIGHTS = [25, 20, 16, 14, 13, 12];

/**
 * Quota del guadagno che entra nel voto: metà per ciò che dura o regge il team (setup, meteo, Web, Trick Room),
 * un quarto per Tailwind e un bersaglio rallentato.
 */
export const CONDITION_QUOTA: Record<SpeedCondition, number> = { setup: 0.5, weather: 0.5, booster: 0.5, unburden: 0.5, priority: 0.5, web: 0.5, trickroom: 0.5, tailwind: 0.25, slow: 0.25 };

export interface SpeedGain {
  condition: SpeedCondition;
  /** La mossa o l'abilità che la dà ("Dragon Dance", "Swift Swim", "Sticky Web"…). */
  source: string;
  /** Pokémon superati in più, già moltiplicati per la quota (0–1). */
  gain: number;
  /** Per il controllo del team: i compagni che portano la mossa (chi guadagna può non averla). */
  by?: string[];
}

/** Un rivale del gruppo visto dal membro: quanto conta nel suo totale e grazie a cosa. */
export interface SpeedCell {
  species: string;
  speed: number;
  scarf: boolean;
  booster: boolean;
  /** Sticky Web non lo rallenta (Volante, Levitate, Boots, Air Balloon). */
  webImmune: boolean;
  /** Per la versione con la Sciarpa o la Booster: la quota dei set che la usano. */
  itemShare?: number;
  /** Peso del rivale (0 per la propria specie, che non si confronta con sé). */
  weight: number;
  /** Quanto il rivale porta al totale del membro: supera (1), pareggio (0,5) o 0, più i guadagni; senza tetto. */
  credit: number;
  /** Superato senza condizioni (1), pareggio (0,5), più lento (0). */
  base: 1 | 0.5 | 0;
  /** La condizione che aggiunge di più su questo rivale (null se nessuna). */
  via: SpeedCondition | null;
  /** La mossa, abilità o strumento dietro `via`. */
  source: string | null;
}

export interface MemberSpeed {
  species: string;
  speed: number;
  /** Quota del gruppo superata senza condizioni (pareggio a metà). */
  raw: number;
  gains: SpeedGain[];
  /** Velocità pura più i guadagni del membro stesso (setup, meteo, Unburden, priorità), al massimo 1. */
  own: number;
  /** Con anche il controllo del team (Web, Trick Room, Tailwind, paralisi), al massimo 1. */
  total: number;
  /** L'effetto di ogni mossa di controllo da sola (anche le paralisi che non contano perché ce n'è una migliore). */
  controlOptions: SpeedGain[];
  /** Un rivale per cella, nell'ordine del gruppo (speedPool): la media pesata dei crediti è `total` (sotto i tetti). */
  cells: SpeedCell[];
}

/** Mosse che alzano la Velocità di uno stadio (×1,5) o di due (×2; Shift Gear ne dà due, Geomancy con la Power Herb). */
const SETUP_PLUS_ONE = new Set(['dragondance', 'quiverdance', 'victorydance', 'tidyup', 'trailblaze', 'flamecharge', 'rapidspin', 'aquastep', 'esperwing', 'scaleshot']);
const SETUP_PLUS_TWO = new Set(['shellsmash', 'agility', 'rockpolish', 'autotomize', 'shiftgear', 'geomancy']);
/** Abilità che raddoppiano la velocità col meteo o il campo giusto. */
const WEATHER_SPEED: Record<string, { weather?: string; terrain?: string }> = {
  swiftswim: { weather: 'rain' }, chlorophyll: { weather: 'sun' }, sandrush: { weather: 'sand' }, slushrush: { weather: 'snow' },
  surgesurfer: { terrain: 'electric' },
};
const PARALYSIS = new Set(['thunderwave', 'glare', 'stunspore', 'nuzzle']);
const SPEED_DROP = new Set(['icywind', 'electroweb', 'bulldoze', 'rocktomb', 'lowsweep']);

/** Strumenti che si consumano e attivano Unburden (oltre a bacche, gemme e semi). */
const CONSUMED = new Set([
  'whiteherb', 'powerherb', 'mentalherb', 'airballoon', 'focussash', 'weaknesspolicy', 'throatspray', 'ejectbutton', 'ejectpack',
  'redcard', 'adrenalineorb', 'roomservice', 'blunderpolicy', 'boosterenergy', 'mirrorherb',
]);
function consumable(item: string): boolean {
  const data = dex.items.get(item);
  if (!data.exists) return false;
  const id = toID(item);
  return !!data.isBerry || !!data.isGem || id.endsWith('seed') || CONSUMED.has(id);
}

/**
 * Quanto una mossa rallenta un avversario: paralisi a metà, un calo di Velocità a due terzi; 1 se il tipo ne è immune
 * (Elettro non si paralizza, Terra non prende Thunder Wave, Erba non prende le polveri, Volante non prende Bulldoze…).
 */
export function slowFactor(move: string, species: string): number {
  const id = toID(move);
  const types = getSpecies(species)?.types ?? [];
  const has = (type: string) => types.includes(type as never);
  if (PARALYSIS.has(id)) {
    if (has('Electric')) return 1;
    if ((id === 'thunderwave' || id === 'nuzzle') && has('Ground')) return 1;
    if (id === 'stunspore' && has('Grass')) return 1;
    return 0.5;
  }
  if (SPEED_DROP.has(id)) {
    if (id === 'bulldoze' && has('Flying')) return 1;
    if (id === 'electroweb' && has('Ground')) return 1;
    if (id === 'lowsweep' && has('Ghost')) return 1;
    return 2 / 3;
  }
  return 1;
}

const moveName = (set: TeamSet, ids: Set<string>) => set.moves.find(m => ids.has(toID(m))) ?? null;
const teamMove = (team: TeamSet[], ids: Set<string>) => {
  for (const member of team) { const found = moveName(member, ids); if (found) return getMove(found)?.name ?? found; }
  return null;
};
/** I membri che hanno la mossa (per nome di battaglia). */
const holders = (team: TeamSet[], move: string) =>
  team.filter(member => member.moves.some(m => toID(m) === toID(move))).map(member => battleSpecies(member)?.name ?? member.species);

/**
 * Una condizione che fa arrivare prima il membro: le sue (setup, meteo, Booster, Unburden) moltiplicano la sua velocità,
 * quelle del team (Web, paralisi) rallentano i rivali, Tailwind raddoppia il membro, Trick Room inverte l'ordine.
 * Sono i check del modale della Velocità e le condizioni che il voto misura (la priorità è a parte: dipende dal danno).
 */
export interface SpeedOption {
  condition: SpeedCondition;
  /** La mossa, l'abilità o lo strumento. */
  source: string;
  /** Per il controllo del team: chi porta la mossa. */
  by?: string[];
  /** Quanto moltiplica la velocità del membro (1 se agisce sui rivali). */
  memberFactor: number;
  /** Quanto moltiplica la velocità di un rivale (Web: 2/3 se non immune; paralisi: metà se non immune). */
  rivalFactor?: (rival: SpeedRival) => number;
  /** Trick Room: un rivale è "superato" se è più veloce. */
  trickRoom?: boolean;
}

/** Le condizioni di velocità di un membro nel suo team, nell'ordine del voto: prima le sue, poi quelle del team. */
export function speedOptions(set: TeamSet, team: TeamSet[]): SpeedOption[] {
  const options: SpeedOption[] = [];
  const fields = [...team, set].map(ownField);
  const weathers = fields.map(f => f.weather).filter(Boolean) as string[];
  const terrains = fields.map(f => f.terrain).filter(Boolean) as string[];
  const ability = toID(battleAbility(set));
  const plusTwo = moveName(set, SETUP_PLUS_TWO);
  const plusOne = moveName(set, SETUP_PLUS_ONE) ?? (ability === 'speedboost' ? battleAbility(set) : null);
  if (plusTwo) options.push({ condition: 'setup', source: getMove(plusTwo)?.name ?? plusTwo, memberFactor: 2 });
  else if (plusOne) options.push({ condition: 'setup', source: getMove(plusOne)?.name ?? plusOne, memberFactor: 1.5 });
  const needs = WEATHER_SPEED[ability];
  if (needs && ((needs.weather && weathers.includes(needs.weather)) || (needs.terrain && terrains.includes(needs.terrain)))) {
    options.push({ condition: 'weather', source: battleAbility(set), memberFactor: 2 });
  }
  // Paradox: la Booster Energy (si consuma) o il sole / campo elettrico del team, se la Velocità è la statistica più alta
  if (paradoxSpeedBoost(set)) {
    const byItem = toID(set.item) === 'boosterenergy';
    const byField = (ability === 'protosynthesis' && weathers.includes('sun')) || (ability === 'quarkdrive' && terrains.includes('electric'));
    if (byItem || byField) options.push({ condition: 'booster', source: byItem ? 'Booster Energy' : battleAbility(set), memberFactor: PARADOX_SPEED });
  }
  if (ability === 'unburden' && consumable(set.item)) options.push({ condition: 'unburden', source: battleAbility(set), memberFactor: 2 });
  const web = teamMove(team, new Set(['stickyweb']));
  if (web) options.push({ condition: 'web', source: web, by: holders(team, web), memberFactor: 1, rivalFactor: r => (r.webImmune ? 1 : 2 / 3) });
  const trickRoom = teamMove(team, new Set(['trickroom']));
  if (trickRoom) options.push({ condition: 'trickroom', source: trickRoom, by: holders(team, trickRoom), memberFactor: 1, trickRoom: true });
  const tailwind = teamMove(team, new Set(['tailwind']));
  if (tailwind) options.push({ condition: 'tailwind', source: tailwind, by: holders(team, tailwind), memberFactor: 2 });
  // Tutte le mosse che rallentano del team (immunità diverse): il voto conta poi la migliore
  const slowing = [...new Set(team.flatMap(member => member.moves.map(m => getMove(m)).filter(m => !!m && (PARALYSIS.has(m.id) || SPEED_DROP.has(m.id))).map(m => m!.name)))].sort();
  for (const move of slowing) options.push({ condition: 'slow', source: move, by: holders(team, move), memberFactor: 1, rivalFactor: r => slowFactor(move, r.species) });
  return options;
}

const members = new Map<string, MemberSpeed | null>();
const MEMBER_LIMIT = 5000;

/** Velocità di un membro: quanti Pokémon del gruppo supera, e quanti in più con setup, meteo, Web, Tailwind e paralisi. */
export function memberSpeed(set: TeamSet, team: TeamSet[], data: EngineData): MemberSpeed | null {
  // Tutti i meteo e i campi che il team porta (anche più d'uno), compresi quelli del membro stesso
  const fields = [...team, set].map(ownField);
  const weathers = [...new Set(fields.map(f => f.weather).filter(Boolean))].sort() as string[];
  const terrains = [...new Set(fields.map(f => f.terrain).filter(Boolean))].sort() as string[];
  const options = speedOptions(set, team);
  const bringers = options.filter(o => o.by).map(o => `${o.source}:${o.by}`).join(',');
  const key = `${setKey(set)}|${weathers}|${terrains}|${bringers}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${statsKey(data.stats)}`;
  if (members.has(key)) return members.get(key)!;
  if (members.size >= MEMBER_LIMIT) members.clear();
  const value = measure(set, data, { weathers, terrains, options });
  members.set(key, value);
  return value;
}

interface TeamConditions {
  weathers: string[];
  terrains: string[];
  /** Le condizioni del membro e del team (speedOptions). */
  options: SpeedOption[];
}

function measure(set: TeamSet, data: EngineData, team: TeamConditions): MemberSpeed | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const pool = speedPool(data);
  const speed = speedStat(set).value;
  // Ogni rivale del gruppo: la propria specie pesa 0 (non si confronta con sé); le versioni di una specie pesano per la loro quota
  const weights = pool.map(r => (sameSelf(r.species, set.species) ? 0 : r.weight));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wmean = (values: number[]) => (totalWeight ? values.reduce((acc, v, i) => acc + weights[i] * v, 0) / totalWeight : 0);
  const baseAt = (value: number, own: number): 1 | 0.5 | 0 => (value < own ? 1 : value === own ? 0.5 : 0);
  /** Per ogni rivale: supera (1), pareggio (0,5) o 0, alla velocità `own` del membro, col rivale moltiplicato per `opponent`. */
  const basesWith = (own: number, opponent: (r: SpeedRival) => number = () => 1) =>
    pool.map((r, i) => (weights[i] ? baseAt(Math.floor(r.value * opponent(r)), own) : 0));
  const bases = basesWith(speed);
  const raw = wmean(bases);
  const gains: SpeedGain[] = [];
  const controlOptions: SpeedGain[] = [];
  /** I guadagni per rivale di ogni condizione che conta (la stessa condizione non si ripete). */
  const perRival = new Map<SpeedCondition, number[]>();
  /**
   * Guadagno per rivale: la quota della condizione per quanto il rivale è superato in più. Con Trick Room i rivali più
   * lenti si perdono (guadagno negativo): la condizione conta solo se in media fa guadagnare.
   */
  const extraOf = (condition: SpeedCondition, boosted: number[]) => boosted.map((b, i) => CONDITION_QUOTA[condition] * (b - bases[i]));
  const gainOf = (condition: SpeedCondition, share: number) => CONDITION_QUOTA[condition] * Math.max(0, share - raw);
  const add = (condition: SpeedCondition, source: string, boosted: number[], by?: string[]) => {
    const extra = extraOf(condition, boosted);
    const gain = wmean(extra);
    if (gain <= 0) return;
    const entry = by ? { condition, source, gain, by } : { condition, source, gain };
    gains.push(entry);
    perRival.set(condition, extra);
    if (entry.by) controlOptions.push(entry);
  };
  /** I rivali "superati" con la condizione: il membro più veloce, i rivali più lenti, o l'ordine invertito (Trick Room:
   *  chi è lento supera chi è più veloce, a pari velocità metà, e perde i più lenti). */
  const boostedWith = (o: SpeedOption) => (o.trickRoom ? bases.map((b, i) => (weights[i] ? 1 - b : 0))
    : o.rivalFactor ? basesWith(speed, o.rivalFactor) : basesWith(Math.floor(speed * o.memberFactor)));

  for (const o of team.options.filter(o => o.condition !== 'slow')) add(o.condition, o.source, boostedWith(o), o.by);
  // Rallentare: conta la mossa migliore che il team ha, con le immunità di tipo
  const slowing = team.options.filter(o => o.condition === 'slow')
    .map(o => ({ o, boosted: boostedWith(o) }))
    .map(x => ({ ...x, share: wmean(x.boosted) }))
    .sort((a, b) => b.share - a.share);
  if (slowing[0]) add('slow', slowing[0].o.source, slowing[0].boosted, slowing[0].o.by);
  // Le altre non si sommano, ma il modale mostra anche il loro effetto da sole
  for (const option of slowing.slice(1)) {
    const gain = gainOf('slow', option.share);
    if (gain > 0) controlOptions.push({ condition: 'slow', source: option.o.source, gain, by: option.o.by });
  }

  // Priorità come il setup: colpisce per primo anche chi è più veloce, pesato da quanto fa male (metà PS vale pieno)
  // Il campo del colpo: quello del membro, se no quello del team (la pioggia di Pelipper potenzia Aqua Jet).
  // Grassy Glide è prioritaria solo col Grassy Terrain, quindi lì vince il campo erboso
  const own = ownConditions(set);
  const ownWeather = own.some(c => WEATHER_CONDITIONS.has(c));
  const teamWeather = ownWeather ? [] : team.weathers.slice(0, 1).map(w => WEATHER_TO_CONDITION[w]).filter(Boolean);
  const grassy = own.includes('grassyterrain') || team.terrains.includes('grassy');
  const ownTerrain = own.filter(c => !WEATHER_CONDITIONS.has(c));
  const terrain = grassy ? ['grassyterrain' as const] : ownTerrain.length ? [] : team.terrains.slice(0, 1).map(tr => TERRAIN_TO_CONDITION[tr]).filter(Boolean);
  const conditions = [...own.filter(c => WEATHER_CONDITIONS.has(c) || !grassy), ...teamWeather, ...terrain] as typeof own;
  // Senza mosse che qui sono prioritarie (Grassy Glide senza campo erboso) niente calcoli
  const hasPriority = set.moves.some(m => { const d = getMove(m); return !!d && d.category !== 'Status' && (d.priority > 0 || (d.id === 'grassyglide' && grassy)); });
  const byMove = new Map<string, number>();
  const priorityExtra = pool.map(() => 0);
  if (totalWeight && hasPriority) {
    pool.forEach((r, i) => {
      if (!weights[i] || r.value < speed) return;
      const hit = bestHit(set, rivalSet(r.species, data), { priorityOnly: true, conditions });
      if (!hit) return;
      const first = (r.value === speed ? 0.5 : 1) * Math.min(1, hit.expected / PRIORITY_FULL);
      priorityExtra[i] = CONDITION_QUOTA.priority * first;
      byMove.set(hit.move, (byMove.get(hit.move) ?? 0) + weights[i] * first);
    });
  }
  const firstHits = [...byMove.values()].reduce((a, b) => a + b, 0);
  // Il nome: la mossa che porta più guadagno
  const priorityMove = [...byMove.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (priorityMove && firstHits > 0) {
    gains.push({ condition: 'priority', source: priorityMove, gain: CONDITION_QUOTA.priority * firstHits / totalWeight });
    perRival.set('priority', priorityExtra);
  }

  const sum = (list: SpeedGain[]) => list.reduce((acc, g) => acc + g.gain, 0);
  const ownTotal = Math.min(1, raw + sum(gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition))));
  // Trick Room e gli altri controlli (Web, Tailwind, paralisi) vanno in direzioni opposte: conta il migliore dei due
  const room = sum(gains.filter(g => g.condition === 'trickroom'));
  const speedUps = sum(gains.filter(g => CONTROL_CONDITIONS.includes(g.condition) && g.condition !== 'trickroom'));
  const total = Math.min(1, ownTotal + Math.max(room, speedUps));

  // Le celle: per ogni rivale la base più i guadagni propri e quelli del controllo che vince per il membro (senza tetto)
  const ownConds = [...perRival.keys()].filter(c => !CONTROL_CONDITIONS.includes(c));
  const controlConds = [...perRival.keys()].filter(c => CONTROL_CONDITIONS.includes(c) && (room > speedUps ? c === 'trickroom' : c !== 'trickroom'));
  const sourceOf = (condition: SpeedCondition) => gains.find(g => g.condition === condition)?.source ?? null;
  const cells: SpeedCell[] = pool.map((r, i) => {
    if (!weights[i]) return { species: r.species, speed: r.value, scarf: r.scarf, booster: !!r.booster, webImmune: !!r.webImmune, itemShare: r.itemShare, weight: 0, credit: 0, base: 0, via: null, source: null };
    let credit = bases[i];
    let via: SpeedCondition | null = null;
    let best = 0;
    for (const condition of [...ownConds, ...controlConds]) {
      const extra = perRival.get(condition)![i];
      credit += extra;
      if (extra > best) { best = extra; via = condition; }
    }
    return { species: r.species, speed: r.value, scarf: r.scarf, booster: !!r.booster, webImmune: !!r.webImmune, itemShare: r.itemShare, weight: weights[i], credit, base: bases[i], via, source: via ? sourceOf(via) : null };
  });
  return { species: species.name, speed, raw, gains, own: ownTotal, total, controlOptions, cells };
}

/** La parte Velocità del team: i membri pesati dal più veloce (25/20/16/14/13/12), poi la scala morbida (100 non si raggiunge). */
export function speedPart(list: MemberSpeed[]): number {
  return softScore(weightedMean(list, m => m.total) / SPEED_FULL);
}

/** Media dei membri pesata per posizione di velocità (25/20/16/14/13/12; a pari velocità le posizioni si dividono il peso). */
function weightedMean(list: MemberSpeed[], pick: (m: MemberSpeed) => number): number {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => b.speed - a.speed);
  const rankWeight = (i: number) => SPEED_RANK_WEIGHTS[Math.min(i, SPEED_RANK_WEIGHTS.length - 1)];
  // A pari velocità le posizioni si dividono il peso: il risultato non dipende dall'ordine dei membri
  const weights = sorted.map(m => {
    const tied = sorted.map((o, i) => (o.speed === m.speed ? rankWeight(i) : null)).filter((w): w is number => w !== null);
    return tied.reduce((a, b) => a + b, 0) / tied.length;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return sorted.reduce((acc, m, i) => acc + weights[i] * pick(m), 0) / total;
}

const WEATHER_CONDITIONS = new Set(['sun', 'rain', 'sand', 'snow']);
const WEATHER_TO_CONDITION: Record<string, 'sun' | 'rain' | 'sand' | 'snow'> = { sun: 'sun', rain: 'rain', sand: 'sand', snow: 'snow' };
const TERRAIN_TO_CONDITION: Record<string, 'electricterrain' | 'grassyterrain' | 'mistyterrain' | 'psychicterrain'> = {
  electric: 'electricterrain', grassy: 'grassyterrain', misty: 'mistyterrain', psychic: 'psychicterrain',
};

/** La condizione di controllo che dà una mossa (null se non ne dà). */
function controlConditionOf(id: string): SpeedCondition | null {
  if (id === 'stickyweb') return 'web';
  if (id === 'trickroom') return 'trickroom';
  if (id === 'tailwind') return 'tailwind';
  return PARALYSIS.has(id) || SPEED_DROP.has(id) ? 'slow' : null;
}

/** Metà PS tolti con una mossa prioritaria valgono il colpo pieno: basta a finire un avversario indebolito. */
const PRIORITY_FULL = 0.5;

/** Il set di un avversario del gruppo: col meta il più comune, senza un set neutro. */
export function rivalSet(species: string, data: EngineData): TeamSet {
  const common = usesMeta(data) ? mostCommonSet(data.stats, species) : null;
  if (common) return common;
  // Senza meta: lo stesso set offensivo che il gruppo assume per la velocità (252 Velocità, natura che la alza)
  const s = getSpecies(species);
  const physical = (s?.baseStats.atk ?? 0) >= (s?.baseStats.spa ?? 0);
  return {
    species, item: '', ability: s?.abilities[0] ?? '', moves: [], nature: physical ? 'Jolly' : 'Timid',
    evs: { [physical ? 'atk' : 'spa']: 252, spe: 252, hp: 4 },
  };
}

/** Un rivale del gruppo visto dal team: quanti membri lo superano da soli e quanti lo raggiungono con le condizioni. */
export interface SpeedThreat {
  /** Posizione nel gruppo (speedPool) e nelle celle dei membri. */
  index: number;
  species: string;
  speed: number;
  scarf: boolean;
  booster: boolean;
  /** Membri che lo superano senza condizioni. */
  outsped: number;
  /** Membri con un credito su di lui (anche solo con setup, priorità o controllo). */
  reached: number;
}

export interface TeamSpeed {
  /** L'area: ogni membro con tutti i guadagni, pesato dal più veloce. */
  value: number;
  /** Velocità: ogni membro da solo (pura, setup, meteo, Unburden, priorità). */
  speed: number;
  /** Controllo velocità: i punti che Web, Trick Room, Tailwind e paralisi aggiungono alla Velocità (l'area meno la Velocità). */
  control: number;
  /** Chi porta il controllo: la mossa, quanti compagni aiuta e quanti punti aggiunge da sola. */
  sources: ControlSource[];
  members: MemberSpeed[];
  /** I rivali del gruppo dal meno superato: pagina 1 della tabella "Chi supera". */
  threats: SpeedThreat[];
}

export interface ControlSource {
  condition: SpeedCondition;
  move: string;
  by: string[];
  helped: number;
  plus: number;
}

/** Velocità del team: quanti Pokémon supera ogni membro da solo, e quanti in più grazie al controllo del team. */
export function teamSpeedArea(team: TeamSet[], data: EngineData): TeamSpeed {
  const list = team.map(set => memberSpeed(set, team, data)).filter((m): m is MemberSpeed => m !== null);
  if (!list.length) return { value: 0, speed: 0, control: 0, sources: [], members: [], threats: [] };
  const value = softScore(weightedMean(list, m => m.total) / SPEED_FULL);
  const speed = softScore(weightedMean(list, m => m.own) / SPEED_FULL);
  // Ogni mossa di controllo che il team porta, anche se non aiuta nessuno (Trick Room in un team veloce):
  // quanti compagni ne guadagnano e quanti punti aggiunge da sola alla Velocità
  const moves = new Map<string, { condition: SpeedCondition; move: string; by: string[] }>();
  for (const member of team) {
    for (const name of member.moves) {
      const move = getMove(name);
      const condition = move && controlConditionOf(move.id);
      if (!move || !condition) continue;
      const key = `${condition}|${move.name}`;
      const holder = battleSpecies(member)?.name ?? member.species;
      const entry = moves.get(key);
      if (entry) { if (!entry.by.includes(holder)) entry.by.push(holder); } else moves.set(key, { condition, move: move.name, by: [holder] });
    }
  }
  const sources = [...moves.values()].map(src => {
    const gainOf = (m: MemberSpeed) => m.controlOptions.find(g => g.condition === src.condition && g.source === src.move)?.gain ?? 0;
    return {
      ...src,
      helped: list.filter(m => gainOf(m) > 0).length,
      plus: softScore(weightedMean(list, m => Math.min(1, m.own + gainOf(m))) / SPEED_FULL) - speed,
    };
  }).sort((a, b) => b.plus - a.plus);
  return { value, speed, control: value - speed, sources, members: list, threats: threatsOf(list) };
}

/** I rivali del gruppo visti dal team, dal meno superato (poi dal meno raggiunto, poi dal più veloce). */
function threatsOf(list: MemberSpeed[]): SpeedThreat[] {
  const cells = list[0].cells;
  return cells.map((c, index) => ({
    index, species: c.species, speed: c.speed, scarf: c.scarf, booster: c.booster,
    outsped: list.filter(m => m.cells[index].weight > 0 && m.cells[index].base === 1).length,
    reached: list.filter(m => m.cells[index].weight > 0 && m.cells[index].credit > 0).length,
  })).sort((a, b) => a.outsped - b.outsped || a.reached - b.reached || b.speed - a.speed);
}
