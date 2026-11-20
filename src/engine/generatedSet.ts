import { battleSpecies, getMove, getSpecies, isDefined } from './dex';
import { legalAbilities, legalMoves } from './learnsets';
import type { StatID, TeamSet } from './sets';
import type { GameId } from './games';
import { effectiveness, TYPES, type TypeName } from './types';

/** Mosse d'attacco da non proporre in un set generato: si ricaricano, si esauriscono o dipendono da condizioni. */
const AVOID = new Set([
  'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser',
  'eternabeam', 'meteorassault', 'selfdestruct', 'explosion', 'mistyexplosion', 'finalgambit', 'memento',
  'focuspunch', 'solarbeam', 'solarblade', 'skyattack', 'razorwind', 'skullbash', 'futuresight', 'doomdesire',
  'dreameater', 'belch', 'lastresort', 'synchronoise', 'steelbeam', 'mindblown', 'shelltrap', 'beakblast',
  'burnup', 'doubleshock', 'fling', 'naturalgift', 'spitup', 'trumpcard', 'snore', 'round', 'echoedvoice',
]);

/** Mosse di supporto, in ordine di preferenza: la prima imparabile entra nel set. */
const UTILITY = [
  'stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'rapidspin', 'defog',
  'uturn', 'voltswitch', 'flipturn', 'partingshot',
  'swordsdance', 'nastyplot', 'dragondance', 'quiverdance', 'calmmind', 'bulkup', 'shellsmash',
  'recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'synthesis', 'morningsun', 'shoreup', 'strengthsap',
  'willowisp', 'thunderwave', 'toxic', 'knockoff', 'protect',
];

/**
 * In doppio Protect è la prima scelta (lo porta quasi metà dei Pokémon) e le trappole di Stealth Rock non si propongono:
 * il resto della lista resta com'è.
 */
const DOUBLES_UTILITY = ['protect', ...UTILITY.filter(id => id !== 'stealthrock' && id !== 'protect')];

interface Candidate {
  name: string;
  type: TypeName;
  power: number;
}

/** Potenza effettiva di una mossa per questo Pokémon: STAB, precisione e statistica d'attacco usata. */
function strength(move: NonNullable<ReturnType<typeof getMove>>, types: readonly string[], atk: number, spa: number): number {
  const stab = types.includes(move.type) ? 1.5 : 1;
  const accuracy = move.accuracy === true ? 1 : move.accuracy / 100;
  const stat = move.category === 'Physical' ? atk : spa;
  const hits = Array.isArray(move.multihit) ? (move.multihit[0] + move.multihit[1]) / 2 : move.multihit ?? 1;
  return move.basePower * hits * stab * accuracy * stat;
}

/**
 * Un set ragionevole per un Pokémon senza dati in nessun formato: le STAB più forti, una copertura
 * che colpisce più tipi possibili, una mossa di supporto; natura, EV e strumento dalle statistiche base.
 * `doubles`: la mossa di supporto si sceglie dalla lista del doppio (Protect per prima).
 */
export function generatedSet(speciesName: string, genLimit = 9, game: GameId | null = null, doubles = false): TeamSet {
  const species = getSpecies(speciesName);
  const empty: TeamSet = { species: speciesName, item: '', ability: '', moves: [], nature: 'Serious', evs: {} };
  if (!species) return empty;
  const forme = battleSpecies({ species: speciesName, item: species.requiredItem ?? '' }) ?? species;
  const { hp, atk, def, spa, spd, spe } = forme.baseStats;
  const types = forme.types;
  const physical = atk >= spa;
  const legal = legalMoves(speciesName, genLimit, game);
  const learnable = [...(legal ?? [])].map(getMove).filter(isDefined);

  // Attacchi: dello stile del Pokémon (con un margine per i misti), escluse le mosse problematiche
  const attacks: Candidate[] = learnable
    .filter(m => m.category !== 'Status' && m.basePower > 0 && !AVOID.has(m.id) && !m.flags.charge && !m.flags.recharge)
    .filter(m => Math.abs(atk - spa) < 15 || (m.category === 'Physical') === physical)
    .map(m => ({ name: m.name, type: m.type as TypeName, power: strength(m, types, atk, spa) }))
    .sort((a, b) => b.power - a.power);

  const moves: Candidate[] = [];
  // Una STAB per tipo
  for (const type of types) {
    const best = attacks.find(c => c.type === type);
    if (best) moves.push(best);
  }
  // Coperture: ogni volta la mossa che aggiunge più tipi colpiti super efficace
  const hitsSE = (chosen: Candidate[]) => new Set(TYPES.filter(def => chosen.some(c => effectiveness(c.type, [def]) > 1)));
  while (moves.length < 3) {
    const covered = hitsSE(moves);
    const pick = attacks
      .filter(c => !moves.some(m => m.type === c.type))
      .map(c => ({ c, gain: [...hitsSE([c])].filter(t => !covered.has(t)).length }))
      .sort((a, b) => b.gain - a.gain || b.c.power - a.c.power)[0];
    if (!pick) break;
    moves.push(pick.c);
  }
  const names = moves.map(m => m.name);
  // Supporto, poi eventuali altri attacchi per arrivare a 4
  const utility = (doubles ? DOUBLES_UTILITY : UTILITY).find(id => legal?.has(id));
  if (utility) names.push(getMove(utility)!.name);
  for (const c of attacks) {
    if (names.length >= 4) break;
    if (!names.includes(c.name)) names.push(c.name);
  }

  const fast = spe >= 90;
  const bulky = hp + def + spd > 3 * Math.max(atk, spa);
  const nature = bulky
    ? (def >= spd ? (physical ? 'Impish' : 'Bold') : (physical ? 'Careful' : 'Calm'))
    : fast ? (physical ? 'Jolly' : 'Timid') : (physical ? 'Adamant' : 'Modest');
  const evs: Partial<Record<StatID, number>> = bulky
    ? { hp: 252, [def >= spd ? 'def' : 'spd']: 252, [physical ? 'atk' : 'spa']: 4 }
    : { [physical ? 'atk' : 'spa']: 252, spe: 252, hp: 4 };
  const item = species.requiredItem
    ?? (species.nfe ? 'Eviolite' : bulky ? 'Leftovers' : 'Life Orb');
  const abilities = legalAbilities(speciesName, genLimit) ?? Object.values(species.abilities).filter(Boolean) as string[];

  return { species: speciesName, item, ability: abilities[0] ?? '', moves: names.slice(0, 4), nature, evs };
}
