import type { HitOptions } from './damage';
import { battleSpecies, getMove, toID } from './dex';
import type { TeamSet } from './sets';

/** Potenziamenti che i dati non descrivono come aumenti di sé: Belly Drum (+6), Curse (+1 e +1, non da Spettro), Tidy Up (+1). */
const SPECIAL_BOOSTS: Record<string, { atk?: number; spa?: number; def?: number }> = {
  bellydrum: { atk: 6 }, curse: { atk: 1, def: 1 }, tidyup: { atk: 1 },
};

/** La mossa di potenziamento più forte del set: Attacco, Attacco Speciale, o Difesa con Body Press, dopo un uso. */
export function setupBoosts(set: TeamSet): { move: string; boosts: NonNullable<HitOptions['boosts']> } | null {
  const bodyPress = set.moves.some(m => toID(m) === 'bodypress');
  // Stored Power e Power Trip contano ogni aumento (anche Dif. Speciale e Velocità): con loro si tengono tutti
  const allBoosts = set.moves.some(m => ['storedpower', 'powertrip'].includes(toID(m)));
  let best: { move: string; boosts: NonNullable<HitOptions['boosts']> } | null = null;
  let bestSum = 0;
  const ghost = (battleSpecies(set)?.types as readonly string[] | undefined)?.includes('Ghost');
  for (const name of set.moves) {
    const move = getMove(name);
    if (!move || move.category !== 'Status') continue;
    // Mosse che i dati non descrivono come potenziamento di sé: Belly Drum (+6), Curse (+1, non da Spettro), Tidy Up (+1)
    const special = SPECIAL_BOOSTS[move.id];
    const own = special ?? (move.target === 'self' ? move.boosts : undefined);
    if (!own || (move.id === 'curse' && ghost)) continue;
    const boosts = {
      atk: Math.max(0, own.atk ?? 0), spa: Math.max(0, own.spa ?? 0), def: bodyPress || allBoosts ? Math.max(0, own.def ?? 0) : 0,
      ...(allBoosts ? { spd: Math.max(0, (own as { spd?: number }).spd ?? 0), spe: Math.max(0, (own as { spe?: number }).spe ?? 0) } : {}),
    };
    const sum = boosts.atk + boosts.spa + boosts.def;
    if (sum > bestSum) { best = { move: move.name, boosts }; bestSum = sum; }
  }
  return best;
}
