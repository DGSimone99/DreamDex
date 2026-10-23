import type { Species } from '@pkmn/dex';
import type { EngineData } from './data';
import { battleSpecies, dex, getSpecies, isSelectable, toID } from './dex';
import { memberPower } from './power';
import { parseSpread, type TeamSet } from './sets';
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
      .sort((a, b) => b[1].usage - a[1].usage)
      .slice(0, SPEED_POOL)
      .map(([name, entry]) => {
        const { nature, evs } = parseSpread(top(entry.spreads));
        const item = dex.items.get(top(entry.items) ?? '').name ?? '';
        const webImmune = isFlying(name) || toID(top(entry.abilities) ?? '') === 'levitate' || toID(item) === 'heavydutyboots';
        return { species: name, ...speedStat({ species: name, item, nature, evs }), webImmune };
      })
    : tierSpecies(formatId).map(s => ({
      species: s.name, value: Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1), scarf: false,
      webImmune: s.types.includes('Flying') || toID(s.abilities[0]) === 'levitate',
    }));
  pools.set(key, pool);
  return pool;
}

const isFlying = (name: string) => !!getSpecies(name)?.types.includes('Flying');
const baseOf = (name: string) => getSpecies(name)?.baseSpecies ?? name;

/** Quota del gruppo più lenta di `speed`; un pareggio vale metà. La specie stessa (`ownSpecies`) non si confronta con sé. */
export function outspeedShare(speed: number, pool: SpeedRival[], ownSpecies?: string): number {
  const own = ownSpecies ? baseOf(ownSpecies) : null;
  const rivals = own ? pool.filter(r => baseOf(r.species) !== own) : pool;
  if (!rivals.length) return 0;
  return rivals.reduce((acc, r) => acc + (r.value < speed ? 1 : r.value === speed ? 0.5 : 0), 0) / rivals.length;
}

/** Velocità del set rispetto al gruppo del formato (speedPool), coi vicini più veloci e più lenti. */
export function speedTier(set: TeamSet, data: EngineData): SpeedTier | null {
  const own = baseOf(set.species);
  const speed = speedStat(set).value;
  const rivals = speedPool(data).filter(r => baseOf(r.species) !== own);
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


/** Offesa (percentile) da cui un membro conta per la velocità del team: un Pokémon veloce che non fa danni non serve. */
export const SPEED_ATTACKER = 60;

/**
 * Velocità del team (0–1), dai suoi due attaccanti più veloci: vince chi si muove per primo e fa danno.
 * Quota del riferimento del formato che ognuno dei due supera (non dipende dal meta del mese).
 * Con meno di due attaccanti, il posto mancante vale zero.
 */
export function teamSpeed(team: TeamSet[], data: EngineData, threats: string[] | null = null): number {
  const fastest = team
    .filter(set => (memberPower(set)?.offense ?? 0) >= SPEED_ATTACKER)
    .map(set => speedStat(set).value)
    .sort((a, b) => b - a)
    .slice(0, 2);
  const share = threats?.length
    ? (speed: number) => { const rivals = threats.map(name => metaSpeed(data, name)); return rivals.filter(r => r < speed).length / rivals.length; }
    : (speed: number) => { const pool = referenceSpeeds(data.formatId ?? 'ou'); return pool.filter(v => v < speed).length / pool.length; };
  return fastest.reduce((acc, speed) => acc + share(speed), 0) / 2;
}
