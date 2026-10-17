import type { Move, Species } from '@pkmn/dex';
import { battleSpecies, dex, effectiveStats, isLegal } from './dex';
import { DEFAULT_FORMAT, type FormatId } from './format';
import { isLegalIn } from './formats';
import type { FormatRules } from './formatRules';
import { attackStyle } from './roles';
import type { TeamSet } from './sets';

/** Quanto pesa il lato forte (offesa o robustezza) nella forza del membro. */
export const STRONG_SIDE = 0.65;

type Stats = Species['baseStats'];

/** Potenza offensiva: soprattutto la statistica d'attacco, con una quota per la velocità. */
const offenseIndex = (bs: Stats, attack = Math.max(bs.atk, bs.spa)) => 0.7 * attack + 0.3 * bs.spe;
/** Robustezza: PS combinati con la media delle due difese. */
const bulkIndex = (bs: Stats) => (bs.hp * (bs.def + bs.spd)) / 2;

type Reference = { offense: number[]; bulk: number[]; atk: number[]; spa: number[]; def: number[] };
const references = new Map<FormatId | 'all', Reference>();

/**
 * Riferimento: tutti i Pokémon completamente evoluti legali in National Dex (Mega incluse),
 * oppure solo quelli legali nel formato dato (UU: i Pokémon di UU si confrontano tra loro).
 */
function referencePool(formatId: FormatId | null = null) {
  let reference = references.get(formatId ?? 'all');
  if (!reference) {
    const format = formatId ? { ...DEFAULT_FORMAT, formatId } : null;
    const pool = dex.species.all().filter(s => s.exists && !s.nfe && isLegal(s) && (!format || isLegalIn(s, format)));
    const sorted = (f: (s: Species) => number) => pool.map(f).sort((a, b) => a - b);
    reference = {
      offense: sorted(s => offenseIndex(s.baseStats)),
      bulk: sorted(s => bulkIndex(s.baseStats)),
      atk: sorted(s => s.baseStats.atk),
      spa: sorted(s => s.baseStats.spa),
      def: sorted(s => s.baseStats.def),
    };
    references.set(formatId ?? 'all', reference);
  }
  return reference;
}

/** Percentile 0–100: quota del riferimento sotto il valore (i pari contano a metà). */
function percentile(sorted: number[], value: number): number {
  const below = sorted.filter(v => v < value).length;
  const equal = sorted.filter(v => v === value).length;
  return Math.round((100 * (below + equal / 2)) / sorted.length);
}

export interface MemberPower {
  species: string;
  offense: number;
  bulk: number;
  power: number;
}

/** Statistica d'attacco che il set sfrutta: Attacco se fisico, Attacco Speciale se speciale, altrimenti la migliore. */
function usedAttack(set: TeamSet, bs: Stats): number {
  const style = attackStyle(set);
  return style === 'physical' ? bs.atk : style === 'special' ? bs.spa : Math.max(bs.atk, bs.spa);
}

/**
 * Forza di un membro dalle statistiche base della forma in battaglia (la Mega se tiene la pietra) e dal tipo dei suoi attacchi.
 * `pool`: formato con cui confrontarlo (null = tutti i Pokémon).
 */
export function memberPower(set: TeamSet, pool: FormatId | null = null): MemberPower | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const ref = referencePool(pool);
  // Statistiche effettive: Huge Power raddoppia l'Attacco di Azumarill, Fur Coat la Difesa…
  const stats = effectiveStats(set);
  const offense = percentile(ref.offense, offenseIndex(stats, usedAttack(set, stats)));
  const bulk = percentile(ref.bulk, bulkIndex(stats));
  const power = Math.round(STRONG_SIDE * Math.max(offense, bulk) + (1 - STRONG_SIDE) * Math.min(offense, bulk));
  return { species: species.name, offense, bulk, power };
}

/** Valore minimo di un colpo super efficace, anche da chi ha la statistica d'attacco più bassa. */
export const MIN_HIT_QUALITY = 0.4;
/** Percentile della statistica d'attacco da cui il colpo vale pieno. */
const FULL_HIT_PERCENTILE = 50;

/**
 * Quanto vale un colpo (0,4–1) dalla statistica che usa: Attacco, Attacco Speciale o Difesa (Body Press).
 * Danno fisso (Seismic Toss) 0,6; Foul Play, che usa l'Attacco del bersaglio, 0,7.
 */
export function hitQuality(set: TeamSet, move: Move | string): number {
  const m = typeof move === 'string' ? dex.moves.get(move) : move;
  const species = battleSpecies(set);
  if (!species || !m.exists) return MIN_HIT_QUALITY;
  if (m.damage) return 0.6;
  if (m.overrideOffensivePokemon === 'target') return 0.7;
  const stat = (m.overrideOffensiveStat ?? (m.category === 'Physical' ? 'atk' : 'spa')) as 'atk' | 'spa' | 'def';
  const ref = referencePool();
  const p = percentile(ref[stat] ?? ref.atk, effectiveStats(set)[stat]);
  return Math.min(1, MIN_HIT_QUALITY + (1 - MIN_HIT_QUALITY) * p / FULL_HIT_PERCENTILE);
}

/**
 * Forza del team: media dei membri presenti nel Pokédex (null se nessuno lo è).
 * `passive[i]` vero: il membro è un muro passivo di uno stall e conta solo la sua robustezza.
 */
export function teamPower(team: TeamSet[], passive: boolean[] = [], rules?: FormatRules): { value: number | null; members: MemberPower[] } {
  const scored = team
    .map((set, i) => ({ member: memberPower(set, rules?.strengthPool ?? null), passive: passive[i] ?? false }))
    .filter((x): x is { member: MemberPower; passive: boolean } => x.member !== null);
  const members = scored.map(x => x.member);
  if (members.length === 0) return { value: null, members };
  const sum = scored.reduce((acc, x) => acc + (x.passive ? x.member.bulk : x.member.power), 0);
  return { value: Math.round(sum / members.length), members };
}
