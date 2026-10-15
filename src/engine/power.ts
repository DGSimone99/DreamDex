import type { Species } from '@pkmn/dex';
import { battleSpecies, dex, isLegal } from './dex';
import type { TeamSet } from './sets';

/** Quanto pesa il lato forte (offesa o robustezza) nella forza del membro. */
export const STRONG_SIDE = 0.65;

type Stats = Species['baseStats'];

/** Potenza offensiva: soprattutto la migliore tra Atk e SpA, con una quota per la velocità. */
const offenseIndex = (bs: Stats) => 0.7 * Math.max(bs.atk, bs.spa) + 0.3 * bs.spe;
/** Robustezza: PS combinati con la media delle due difese. */
const bulkIndex = (bs: Stats) => (bs.hp * (bs.def + bs.spd)) / 2;

let reference: { offense: number[]; bulk: number[] } | null = null;

/** Riferimento: tutti i Pokémon completamente evoluti legali in National Dex (Mega incluse). */
function referencePool() {
  if (!reference) {
    const pool = dex.species.all().filter(s => s.exists && !s.nfe && isLegal(s));
    reference = {
      offense: pool.map(s => offenseIndex(s.baseStats)).sort((a, b) => a - b),
      bulk: pool.map(s => bulkIndex(s.baseStats)).sort((a, b) => a - b),
    };
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

/** Forza di un membro dalle statistiche base della forma in battaglia (la Mega se tiene la pietra). */
export function memberPower(set: TeamSet): MemberPower | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const ref = referencePool();
  const offense = percentile(ref.offense, offenseIndex(species.baseStats));
  const bulk = percentile(ref.bulk, bulkIndex(species.baseStats));
  const power = Math.round(STRONG_SIDE * Math.max(offense, bulk) + (1 - STRONG_SIDE) * Math.min(offense, bulk));
  return { species: set.species, offense, bulk, power };
}

/** Forza del team: media dei membri presenti nel Pokédex (null se nessuno lo è). */
export function teamPower(team: TeamSet[]): { value: number | null; members: MemberPower[] } {
  const members = team.map(memberPower).filter((m): m is MemberPower => m !== null);
  if (members.length === 0) return { value: null, members };
  return { value: Math.round(members.reduce((acc, m) => acc + m.power, 0) / members.length), members };
}
