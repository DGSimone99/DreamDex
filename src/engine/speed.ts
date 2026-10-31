import type { Species } from '@pkmn/dex';
import type { EngineData } from './data';
import { battleSpecies, dex, getSpecies, isSelectable, toID } from './dex';
import { parseSpread, type TeamSet } from './sets';
import { statLines } from './statCalc';
import { DEFAULT_FORMAT, type FormatId } from './format';
import { usesMeta } from './analysis';
import { isLegalIn, tierIn } from './formats';

/** Velocità finale al livello 100 (IV del set, 31 se non indicati); `scarf` se la Sciarpa Scelta la moltiplica per 1,5. */
export interface Speed {
  value: number;
  scarf: boolean;
}

/** Quanti Pokémon del meta (i più usati) si confrontano. */
export const SPEED_POOL = 40;
/** Quanti vicini mostrare sopra e sotto. */
const NEIGHBOURS = 3;

export function speedStat(set: Pick<TeamSet, 'species' | 'item' | 'nature' | 'evs' | 'ivs'>): Speed {
  const base = battleSpecies(set)?.baseStats.spe ?? 0;
  const ev = set.evs.spe ?? 0;
  const raw = Math.floor((2 * base + (set.ivs?.spe ?? 31) + Math.floor(ev / 4)) * 100 / 100) + 5;
  const nature = dex.natures.get(set.nature);
  const withNature = Math.floor(raw * (nature.plus === 'spe' ? 1.1 : nature.minus === 'spe' ? 0.9 : 1));
  const scarf = toID(set.item) === 'choicescarf';
  return { value: scarf ? Math.floor(withNature * 1.5) : withNature, scarf };
}

/** Le abilità dei Paradox: alzano la statistica più alta (×1,5 se è la Velocità) con la Booster Energy, il sole o il campo elettrico. */
export const PARADOX_ABILITIES = new Set(['protosynthesis', 'quarkdrive']);

/**
 * Se Protosynthesis o Quark Drive alzerebbero la Velocità: deve essere la statistica finale più alta (livello 100, EV, IV,
 * natura, senza strumento); a pari valore vince la statistica che viene prima (Attacco, Difesa, Att. Sp., Dif. Sp.), mai la Velocità.
 */
export function paradoxSpeedBoost(set: Pick<TeamSet, 'species' | 'ability' | 'item' | 'nature' | 'evs' | 'ivs'>): boolean {
  if (!PARADOX_ABILITIES.has(toID(set.ability))) return false;
  const lines = statLines(set);
  const value = (stat: string) => lines.find(l => l.stat === stat)?.value ?? 0;
  const spe = value('spe');
  return ['atk', 'def', 'spa', 'spd'].every(stat => value(stat) < spe);
}

export interface SpeedRival extends Speed {
  species: string;
  /** Sticky Web non lo rallenta: Volante, Levitate o Heavy-Duty Boots (senza meta: solo dal tipo e dall'abilità). */
  webImmune?: boolean;
}

export interface SpeedTier {
  speed: number;
  /** Confronto coi più usati del meta (true) o col tier alla velocità massima (false). */
  vsMeta: boolean;
  /** Pokémon del meta confrontati (la specie stessa esclusa). */
  total: number;
  /** Quota di quei Pokémon più lenti del set. */
  outspeeds: number;
  /** I più vicini sopra (dal più vicino) e sotto (dal più vicino); a pari velocità si va in "ties". */
  faster: SpeedRival[];
  slower: SpeedRival[];
  ties: SpeedRival[];
}

const top = (shares: Record<string, number>) => Object.entries(shares).sort((a, b) => b[1] - a[1])[0]?.[0];

/**
 * Il gruppo con cui si confronta la velocità, lo stesso per editor, scheda dei membri e voto. Col meta attivo:
 * i più usati del mese col loro spread e strumento più comuni (Sciarpa compresa). Senza meta o senza statistiche:
 * i Pokémon del tier del formato alla velocità massima (252 EV, natura che la alza), senza strumento.
 */
const pools = new Map<string, SpeedRival[]>();
export function speedPool(data: EngineData): SpeedRival[] {
  const formatId = data.formatId ?? 'ou';
  const meta = usesMeta(data);
  const key = `${formatId}|${meta}|${!!data.stats}`;
  let pool = pools.get(key);
  if (pool) return pool;
  pool = meta
    ? Object.entries(data.stats!.pokemon)
      // Un nome che il Pokédex non conosce darebbe velocità 0: si salta
      .filter(([name]) => !!getSpecies(name))
      .sort((a, b) => b[1].usage - a[1].usage)
      .slice(0, SPEED_POOL)
      .map(([name, entry]) => {
        const { nature, evs } = parseSpread(top(entry.spreads));
        const item = dex.items.get(top(entry.items) ?? '').name ?? '';
        const webImmune = isWebImmune(name, top(entry.abilities) ?? '', item);
        return { species: name, ...speedStat({ species: name, item, nature, evs }), webImmune };
      })
    : tierSpecies(formatId).map(s => ({
      species: s.name, value: Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1), scarf: false,
      webImmune: isWebImmune(s.name, s.abilities[0], ''),
    }));
  pools.set(key, pool);
  return pool;
}

/** Sticky Web non rallenta i Volanti, chi ha Levitate, Heavy-Duty Boots o Air Balloon. */
export function isWebImmune(species: string, ability: string, item: string): boolean {
  return !!getSpecies(species)?.types.includes('Flying') || ['levitate'].includes(toID(ability)) || ['heavydutyboots', 'airballoon'].includes(toID(item));
}

/** La forma che conta come "sé stesso": la propria (Rotom-Wash non è Rotom-Heat), le Mega e le Primal come la base. */
const selfOf = (name: string) => {
  const species = getSpecies(name);
  if (!species) return name;
  return species.isMega || species.isPrimal ? species.baseSpecies : species.name;
};
export const sameSelf = (a: string, b: string) => selfOf(a) === selfOf(b);

/** Quota del gruppo più lenta di `speed`; un pareggio vale metà. La specie stessa (`ownSpecies`) non si confronta con sé. */
export function outspeedShare(speed: number, pool: SpeedRival[], ownSpecies?: string): number {
  const rivals = ownSpecies ? pool.filter(r => !sameSelf(r.species, ownSpecies)) : pool;
  if (!rivals.length) return 0;
  return rivals.reduce((acc, r) => acc + (r.value < speed ? 1 : r.value === speed ? 0.5 : 0), 0) / rivals.length;
}

/** Velocità del set rispetto al gruppo del formato (speedPool), coi vicini più veloci e più lenti. */
export function speedTier(set: TeamSet, data: EngineData): SpeedTier | null {
  const speed = speedStat(set).value;
  const rivals = speedPool(data).filter(r => !sameSelf(r.species, set.species));
  if (!rivals.length) return null;
  return {
    speed,
    vsMeta: usesMeta(data),
    total: rivals.length,
    outspeeds: outspeedShare(speed, rivals),
    faster: rivals.filter(r => r.value > speed).sort((a, b) => a.value - b.value).slice(0, NEIGHBOURS),
    slower: rivals.filter(r => r.value < speed).sort((a, b) => b.value - a.value).slice(0, NEIGHBOURS),
    ties: rivals.filter(r => r.value === speed),
  };
}

/** Velocità di un Pokémon del meta col suo spread e strumento più usati (0 se non ha statistiche). */
export function metaSpeed(data: EngineData, name: string): number {
  const entry = data.stats?.pokemon[name];
  if (!entry) return 0;
  const { nature, evs } = parseSpread(top(entry.spreads));
  return speedStat({ species: name, item: dex.items.get(top(entry.items) ?? '').name ?? '', nature, evs }).value;
}

/** Tier che contano come "il formato" per la velocità: chi ci gioca davvero (in Ubers anche gli OU). */
const SPEED_TIERS: Partial<Record<FormatId, string[]>> = {
  ou: ['OU'], uu: ['UU'], ubers: ['Uber', 'OU'], all: ['AG', 'Uber', 'OU'],
  gen9ou: ['OU'], gen9uu: ['UU'], gen9ubers: ['Uber', 'OU'], gen9ag: ['AG', 'Uber', 'OU'],
};

/**
 * Velocità massima (252 EV, natura che la alza) dei Pokémon che giocano nel formato: i completamente evoluti
 * del suo tier (in OU gli OU, in Ubers anche gli OU). Il tier cambia di rado: non dipende dal meta del mese.
 */
const maxSpeeds = new Map<string, number[]>();

/** I completamente evoluti che giocano nel formato (il suo tier; in Ubers anche gli OU): il riferimento senza meta. */
const tierPools = new Map<FormatId, Species[]>();
export function tierSpecies(formatId: FormatId = 'ou'): Species[] {
  let pool = tierPools.get(formatId);
  if (!pool) {
    const format = { ...DEFAULT_FORMAT, formatId };
    const tiers = SPEED_TIERS[formatId] ?? ['OU'];
    pool = dex.species.all()
      .filter(s => s.exists && !s.nfe && isSelectable(s) && isLegalIn(s, format) && tiers.includes(tierIn(s, format)));
    tierPools.set(formatId, pool);
  }
  return pool;
}

export function referenceSpeeds(formatId: FormatId = 'ou'): number[] {
  const key = formatId;
  let speeds = maxSpeeds.get(key);
  if (!speeds) {
    speeds = tierSpecies(formatId)
      .map(s => Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1))
      .sort((a, b) => a - b);
    maxSpeeds.set(key, speeds);
  }
  return speeds;
}

/** Velocità del rivale a metà del gruppo (speedPool); null se il gruppo è vuoto. */
export function poolMedian(data: EngineData): number | null {
  const values = speedPool(data).map(r => r.value).sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : null;
}
