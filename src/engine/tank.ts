import { battleSpecies, toID } from './dex';
import type { TeamSet } from './sets';

/**
 * Tank: almeno TANK_EVS EV fra HP, Difesa e Difesa Speciale, che si curi o no (Alomomola Assault Vest, Slowking-Galar
 * col solo Regenerator). Con almeno TANK_BRAKE tank il team non può essere Hyper Offense (2026-11-09, controllo 2 punto
 * 3.5b): un team Zamazenta, Kingambit, Zapdos, Slowking-Galar, Alomomola, Great Tusk senza mosse di recupero era HO.
 * Provato sugli 84 team National Dex OU del banco col tipo dell'autore e EV veri: 68 giusti come prima con 2 tank e
 * qualsiasi soglia da 300 a 500 EV (HO veri 17 su 18), team chiamati HO 146 → 102 su 543. Con 1 tank si perde un HO
 * vero; con 3 il team dell'esempio resta HO. Contare solo i tank al posto della regola (0 HO, 1–2 BO, 3 Balance…) era
 * molto peggio (34–61 giusti): Bulky Offense e Balance hanno lo stesso numero di tank. Gli EV e non le statistiche:
 * Great Tusk o Zamazenta con 252 Spe sono robusti di natura ma negli HO fanno gli attaccanti.
 * In più serve un minimo di robustezza di suo: HP × Difesa o HP × Difesa Speciale, statistiche a livello 100 senza EV
 * (IV 31, natura neutra; Eviolite × 1,5), almeno TANK_MIN_BULK: Ditto con 350 EV difensivi non è un tank. Le statistiche
 * base moltiplicate e basta penalizzavano chi ha pochi HP (Toxapex sotto Landorus-T, Shuckle e Rotom-Wash sotto
 * Pelipper). Sul banco i più fragili sono Ditto 31 mila, Wartortle 51, Rotom-Wash 60, Pelipper 62, Toxapex e Lando ~69;
 * i tipi giusti non cambiano. Pelipper difensivo resta un tank: è robusto quanto Rotom-Wash.
 */
export const TANK_EVS = 350;
export const TANK_MIN_BULK = 50_000;
export const TANK_BRAKE = 2;
export function isTank(set: TeamSet): boolean {
  if ((set.evs?.hp ?? 0) + (set.evs?.def ?? 0) + (set.evs?.spd ?? 0) < TANK_EVS) return false;
  const base = battleSpecies(set)?.baseStats;
  if (!base) return false;
  const hp = 2 * base.hp + 141;
  const eviolite = toID(set.item) === 'eviolite' ? 1.5 : 1;
  return hp * (2 * Math.max(base.def, base.spd) + 36) * eviolite >= TANK_MIN_BULK;
}
