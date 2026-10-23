import { usesMeta } from './analysis';
import { attackerPanels } from './attackers';
import { ownConditions } from './coverage';
import { setKey, standardHit, type FieldCondition, type Hit } from './damage';
import type { EngineData } from './data';
import { battleAbility, battleSpecies, toID } from './dex';
import { mostCommonSet, type TeamSet } from './sets';
import { softScore } from './scale';
import { topThreats } from './stats';
import { effectiveness } from './types';

/** Valore di un colpo standard ricevuto (dal tiro più alto): OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5. */
export function holdStep(hit: Hit | null): number {
  if (!hit) return 1.5;
  return hit.max >= 1 ? 0 : hit.max >= 0.5 ? 0.5 : hit.max >= 1 / 3 ? 1 : 1.5;
}

/** Recupero per turno delle mosse (la migliore del set). */
const RECOVERY_MOVES: Record<string, number> = {
  recover: 0.5, roost: 0.5, slackoff: 0.5, softboiled: 0.5, milkdrink: 0.5, moonlight: 0.5, synthesis: 0.5,
  morningsun: 0.5, shoreup: 0.5, strengthsap: 0.5, wish: 0.25, rest: 0.33,
};
/** Recupero dell'abilità e dello strumento. */
const RECOVERY_ABILITIES: Record<string, number> = { regenerator: 0.33, poisonheal: 0.125 };
const RECOVERY_ITEMS: Record<string, number> = { leftovers: 0.0625, blacksludge: 0.0625 };
/** Stealth Rock all'ingresso: 1/8 dei PS per l'efficacia della Roccia. */
const STEALTH_ROCK = 0.125;
const LIFE_ORB = 0.1;
/** Sotto un 3HKO medio il recupero vale metà: un Pokémon con Recover non è un muro se non regge i colpi. */
const RECOVERY_HOLD = 1;
/** Recupero netto per turno che vale 100 di Sostenibilità. */
export const SUSTAIN_FULL = 0.5;

/** Recupero meno perdite per turno (in quota dei PS); `robustStep` è il valore medio dei colpi standard ricevuti. */
export function sustainability(set: TeamSet, robustStep: number): number {
  const ids = set.moves.map(toID);
  const ability = toID(battleAbility(set));
  const item = toID(set.item);
  const moves = Math.max(0, ...ids.map(id => RECOVERY_MOVES[id] ?? 0));
  const recovery = moves + (RECOVERY_ABILITIES[ability] ?? 0) + (RECOVERY_ITEMS[item] ?? 0);
  const magicGuard = ability === 'magicguard';
  const types = battleSpecies(set)?.types ?? [];
  const rocks = item === 'heavydutyboots' || magicGuard ? 0 : STEALTH_ROCK * effectiveness('Rock', types as never);
  const lifeOrb = item === 'lifeorb' && !magicGuard ? LIFE_ORB : 0;
  return recovery * (robustStep >= RECOVERY_HOLD ? 1 : 0.5) - rocks - lifeOrb;
}

export interface MemberDefense {
  species: string;
  physical: number;
  special: number;
  sustain: number;
  value: number;
}

/** Pesi della Robustezza del membro: Fisica, Speciale, Sostenibilità. */
export const ROBUSTNESS_WEIGHTS = { physical: 0.4, special: 0.4, sustain: 0.2 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Colpi standard ricevuti dai due gruppi di attaccanti; per contenuto del set, formato e meta. */
interface Raw { species: string; physical: Hit[]; special: Hit[]; physicalStep: number; specialStep: number }
const raws = new Map<string, Raw | null>();
const RAW_LIMIT = 5000;

function measure(set: TeamSet, data: EngineData): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const panels = attackerPanels(data);
  const mine = ownConditions(set);
  // Il meteo dell'abilità dell'attaccante vale sempre; quello del membro protegge lui (sabbia sulla Difesa Speciale della Roccia)
  const against = (attacker: TeamSet, category: 'Physical' | 'Special') => {
    const theirs = ownConditions(attacker);
    const conditions: FieldCondition[] = theirs.length ? theirs : mine;
    return standardHit(attacker, set, category, { conditions });
  };
  const physical = panels.physical.map(a => against(a, 'Physical'));
  const special = panels.special.map(a => against(a, 'Special'));
  if (![...physical, ...special].some(Boolean)) return null;
  return {
    species: species.name,
    physical: physical.filter((h): h is Hit => !!h), special: special.filter((h): h is Hit => !!h),
    physicalStep: mean(physical.map(holdStep)), specialStep: mean(special.map(holdStep)),
  };
}

function rawOf(set: TeamSet, data: EngineData): Raw | null {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  if (raws.has(key)) return raws.get(key)!;
  if (raws.size >= RAW_LIMIT) raws.clear();
  const value = measure(set, data);
  raws.set(key, value);
  return value;
}

/** Riferimento di riserva senza statistiche: un 3HKO in media vale circa 93. */
const FALLBACK_STEP = 1;
/** Il 100 di Robustezza: il 3° più robusto fra i più usati del meta, per lato. */
const REFERENCE_RANK = 3;
const REFERENCE_SCAN = 40;
const references = new Map<string, { physical: number; special: number }>();

export function defenseReference(data: EngineData): { physical: number; special: number } {
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let ref = references.get(key);
  if (ref) return ref;
  const measured = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .map(set => (set ? rawOf(set, data) : null))
    .filter((r): r is Raw => r !== null);
  const nth = (values: number[]) => values.sort((a, b) => b - a)[Math.min(REFERENCE_RANK, values.length) - 1];
  const physical = measured.length ? nth(measured.map(r => r.physicalStep)) : 0;
  const special = measured.length ? nth(measured.map(r => r.specialStep)) : 0;
  ref = { physical: physical > 0 ? physical : FALLBACK_STEP, special: special > 0 ? special : FALLBACK_STEP };
  references.set(key, ref);
  return ref;
}

/** Difesa di un membro: quanti colpi standard regge dai due gruppi di attaccanti, e quanto resta in campo. */
export function memberDefense(set: TeamSet, _team: TeamSet[], data: EngineData): MemberDefense | null {
  const raw = rawOf(set, data);
  if (!raw) return null;
  const ref = defenseReference(data);
  const physical = softScore(raw.physicalStep / ref.physical);
  const special = softScore(raw.specialStep / ref.special);
  const sustain = softScore(Math.max(0, sustainability(set, (raw.physicalStep + raw.specialStep) / 2)) / SUSTAIN_FULL);
  const w = ROBUSTNESS_WEIGHTS;
  return { species: raw.species, physical, special, sustain, value: Math.round(w.physical * physical + w.special * special + w.sustain * sustain) };
}
