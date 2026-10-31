import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { softScore } from './scale';
import { bestHit, setKey } from './damage';
import { ownConditions } from './coverage';
import { usesMeta } from './analysis';
import { mostCommonSet, type TeamSet } from './sets';
import { isWebImmune, outspeedShare, sameSelf, speedPool, speedStat, type SpeedRival } from './speed';
import { ownField } from './types';
import { getSpecies } from './dex';

export { isWebImmune };

/** Le condizioni che fanno superare più Pokémon: setup, meteo/campo, Unburden, Sticky Web, Trick Room, Tailwind, paralisi e rallentamenti. */
export type SpeedCondition = 'setup' | 'weather' | 'unburden' | 'priority' | 'web' | 'trickroom' | 'tailwind' | 'slow';

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
export const CONDITION_QUOTA: Record<SpeedCondition, number> = { setup: 0.5, weather: 0.5, unburden: 0.5, priority: 0.5, web: 0.5, trickroom: 0.5, tailwind: 0.25, slow: 0.25 };

export interface SpeedGain {
  condition: SpeedCondition;
  /** La mossa o l'abilità che la dà ("Dragon Dance", "Swift Swim", "Sticky Web"…). */
  source: string;
  /** Pokémon superati in più, già moltiplicati per la quota (0–1). */
  gain: number;
  /** Per il controllo del team: i compagni che portano la mossa (chi guadagna può non averla). */
  by?: string[];
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
}

const SETUP_PLUS_ONE = new Set(['dragondance', 'quiverdance', 'shiftgear', 'victorydance', 'tidyup', 'trailblaze', 'flamecharge', 'rapidspin', 'aquastep', 'esperwing']);
const SETUP_PLUS_TWO = new Set(['shellsmash', 'agility', 'rockpolish', 'autotomize']);
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

const members = new Map<string, MemberSpeed | null>();
const MEMBER_LIMIT = 5000;

/** Velocità di un membro: quanti Pokémon del gruppo supera, e quanti in più con setup, meteo, Web, Tailwind e paralisi. */
export function memberSpeed(set: TeamSet, team: TeamSet[], data: EngineData): MemberSpeed | null {
  // Tutti i meteo e i campi che il team porta (anche più d'uno), compresi quelli del membro stesso
  const fields = [...team, set].map(ownField);
  const weathers = [...new Set(fields.map(f => f.weather).filter(Boolean))].sort() as string[];
  const terrains = [...new Set(fields.map(f => f.terrain).filter(Boolean))].sort() as string[];
  const web = teamMove(team, new Set(['stickyweb']));
  const trickRoom = teamMove(team, new Set(['trickroom']));
  const tailwind = teamMove(team, new Set(['tailwind']));
  // Tutte le mosse che rallentano del team (immunità diverse): conta poi la migliore
  const slowing = [...new Set(team.flatMap(member => member.moves.map(m => getMove(m)).filter(m => !!m && (PARALYSIS.has(m.id) || SPEED_DROP.has(m.id))).map(m => m!.name)))].sort();
  const bringers = [web, trickRoom, tailwind, ...slowing].filter((m): m is string => !!m).map(m => `${m}:${holders(team, m)}`).join(',');
  const key = `${setKey(set)}|${weathers}|${terrains}|${bringers}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  if (members.has(key)) return members.get(key)!;
  if (members.size >= MEMBER_LIMIT) members.clear();
  const value = measure(set, data, { weathers, terrains, web, trickRoom, tailwind, slowing, holders: (move: string) => holders(team, move) });
  members.set(key, value);
  return value;
}

interface TeamConditions {
  weathers: string[];
  terrains: string[];
  web: string | null;
  trickRoom: string | null;
  tailwind: string | null;
  slowing: string[];
  holders: (move: string) => string[];
}

function measure(set: TeamSet, data: EngineData, team: TeamConditions): MemberSpeed | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const pool = speedPool(data);
  const speed = speedStat(set).value;
  const shareWith = (own: number, opponent: (r: SpeedRival) => number = () => 1) =>
    outspeedShare(own, pool.map(r => ({ ...r, value: Math.floor(r.value * opponent(r)) })), set.species);
  const raw = shareWith(speed);
  const gains: SpeedGain[] = [];
  const controlOptions: SpeedGain[] = [];
  const gainOf = (condition: SpeedCondition, share: number) => CONDITION_QUOTA[condition] * Math.max(0, share - raw);
  const add = (condition: SpeedCondition, source: string, share: number) => {
    const gain = gainOf(condition, share);
    if (gain <= 0) return;
    const entry = CONTROL_CONDITIONS.includes(condition) ? { condition, source, gain, by: team.holders(source) } : { condition, source, gain };
    gains.push(entry);
    if (entry.by) controlOptions.push(entry);
  };

  const ability = toID(battleAbility(set));
  const plusTwo = moveName(set, SETUP_PLUS_TWO);
  const plusOne = moveName(set, SETUP_PLUS_ONE) ?? (ability === 'speedboost' ? battleAbility(set) : null);
  if (plusTwo) add('setup', getMove(plusTwo)?.name ?? plusTwo, shareWith(speed * 2));
  else if (plusOne) add('setup', getMove(plusOne)?.name ?? plusOne, shareWith(Math.floor(speed * 1.5)));

  const needs = WEATHER_SPEED[ability];
  if (needs && ((needs.weather && team.weathers.includes(needs.weather)) || (needs.terrain && team.terrains.includes(needs.terrain)))) {
    add('weather', battleAbility(set), shareWith(speed * 2));
  }
  if (ability === 'unburden' && consumable(set.item)) add('unburden', battleAbility(set), shareWith(speed * 2));
  if (team.web) add('web', team.web, shareWith(speed, r => (r.webImmune ? 1 : 2 / 3)));
  // Trick Room: chi è lento "supera" chi è più veloce di lui (a pari velocità metà). Misura da sola chi è adatto:
  // i lenti guadagnano molto, i veloci niente
  if (team.trickRoom) add('trickroom', team.trickRoom, 1 - raw);
  if (team.tailwind) add('tailwind', team.tailwind, shareWith(speed * 2));
  // Rallentare: conta la mossa migliore che il team ha, con le immunità di tipo
  const options = team.slowing
    .map(move => ({ move, share: shareWith(speed, r => slowFactor(move, r.species)) }))
    .sort((a, b) => b.share - a.share);
  if (options[0]) add('slow', options[0].move, options[0].share);
  // Le altre non si sommano, ma la tabella del controllo mostra anche il loro effetto da sole
  for (const option of options.slice(1)) {
    const gain = gainOf('slow', option.share);
    if (gain > 0) controlOptions.push({ condition: 'slow', source: option.move, gain, by: team.holders(option.move) });
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
  const faster = pool.filter(r => r.value >= speed && !sameSelf(r.species, set.species));
  const rivalsCount = pool.filter(r => !sameSelf(r.species, set.species)).length;
  // Senza mosse che qui sono prioritarie (Grassy Glide senza campo erboso) niente calcoli
  const hasPriority = set.moves.some(m => { const d = getMove(m); return !!d && d.category !== 'Status' && (d.priority > 0 || (d.id === 'grassyglide' && grassy)); });
  const byMove = new Map<string, number>();
  if (rivalsCount && hasPriority) {
    for (const r of faster) {
      const hit = bestHit(set, rivalSet(r.species, data), { priorityOnly: true, conditions });
      if (!hit) continue;
      byMove.set(hit.move, (byMove.get(hit.move) ?? 0) + (r.value === speed ? 0.5 : 1) * Math.min(1, hit.expected / PRIORITY_FULL));
    }
  }
  const firstHits = [...byMove.values()].reduce((a, b) => a + b, 0);
  // Il nome: la mossa che porta più guadagno
  const priorityMove = [...byMove.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (priorityMove && firstHits > 0) gains.push({ condition: 'priority', source: priorityMove, gain: CONDITION_QUOTA.priority * firstHits / rivalsCount });

  const sum = (list: SpeedGain[]) => list.reduce((acc, g) => acc + g.gain, 0);
  const ownTotal = Math.min(1, raw + sum(gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition))));
  // Trick Room e gli altri controlli (Web, Tailwind, paralisi) vanno in direzioni opposte: conta il migliore dei due
  const room = sum(gains.filter(g => g.condition === 'trickroom'));
  const speedUps = sum(gains.filter(g => CONTROL_CONDITIONS.includes(g.condition) && g.condition !== 'trickroom'));
  const total = Math.min(1, ownTotal + Math.max(room, speedUps));
  return { species: species.name, speed, raw, gains, own: ownTotal, total, controlOptions };
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
  if (!list.length) return { value: 0, speed: 0, control: 0, sources: [], members: [] };
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
  return { value, speed, control: value - speed, sources, members: list };
}
