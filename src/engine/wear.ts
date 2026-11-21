import type { EngineData } from './data';
import { holdsThreat } from './defense';
import { battleAbility, battleSpecies, toID } from './dex';
import { isOneType, rulesOf } from './formatRules';
import type { TeamSet } from './sets';
import { affects, statusSources } from './subRoles';

/**
 * Veleno nell'Offesa (2026-11-21, utente). Un Pokémon del meta che nessuno manda KO in due colpi conta coperto in parte
 * se un membro lo può avvelenare e lo regge: il veleno lo butta giù al posto dei colpi. Solo nel singolo.
 * - La mossa deve riuscire almeno una volta su due (Serene Grace compresa): Toxic sì, Sludge Bomb (30%) no. Una mossa
 *   sola, le probabilità di più mosse non si sommano.
 * - Chi avvelena deve reggere il bersaglio (il suo colpo migliore gli toglie meno di metà PS, come nella Difesa):
 *   deve entrare e avere il tempo di usare la mossa.
 * - Il bersaglio deve poter essere avvelenato (tipi Acciaio e Veleno, Magic Bounce, Immunity…) e deve perderci PS:
 *   niente contro Magic Guard, Poison Heal e chi ha già uno stato dal suo strumento (Toxic Orb, Flame Orb).
 * La scottatura per ora non conta (toglie metà del veleno e Leftovers la annulla): da vedere a parte.
 */
export const POISON_CHANCE = 0.5;
/**
 * Il credito del bersaglio avvelenato, nella profondità 70/20/10 al posto di chi lo manda KO in due colpi: iperveleno
 * 0,5 (come un KO in due colpi appena sufficiente: da solo lo manda KO in 6 turni), veleno normale tre quarti (8 turni).
 */
export const WEAR_CREDIT = { tox: 0.5, psn: 0.375 } as const;

const NO_LOSS_ABILITIES = new Set(['magicguard', 'poisonheal']);
const STATUS_ITEMS = new Set(['toxicorb', 'flameorb']);

export interface Wearer {
  species: string;
  move: string;
  status: keyof typeof WEAR_CREDIT;
  credit: number;
}

/** Chi nel team avvelena e regge questo Pokémon, dal credito più alto (vuoto in doppio). */
export function wearers(team: TeamSet[], target: TeamSet, data: EngineData): Wearer[] {
  if (isOneType(rulesOf(data))) return [];
  const species = battleSpecies(target);
  const ability = battleAbility(target);
  if (!species || NO_LOSS_ABILITIES.has(toID(ability)) || STATUS_ITEMS.has(toID(target.item))) return [];
  const rival = { types: [...species.types] as string[], ability, item: target.item ?? '' };
  const out: Wearer[] = [];
  for (const member of team) {
    const name = battleSpecies(member)?.name;
    if (!name) continue;
    const own = toID(battleAbility(member));
    const best = statusSources(member)
      .filter((src): src is typeof src & { status: Wearer['status'] } => (src.status === 'tox' || src.status === 'psn') && src.chance >= POISON_CHANCE)
      .filter(src => affects(src, rival, own === 'corrosion', own === 'prankster'))
      .sort((a, b) => WEAR_CREDIT[b.status] - WEAR_CREDIT[a.status])[0];
    if (!best || !holdsThreat(member, target, team, data)) continue;
    out.push({ species: name, move: best.move, status: best.status, credit: WEAR_CREDIT[best.status] });
  }
  return out.sort((a, b) => b.credit - a.credit);
}
