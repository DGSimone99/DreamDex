import { attackStyle } from '../../engine/roles';
import { isGroupKey, type Level, type LevelKey } from '../../engine/roleLevels';
import { MISSING_BELOW } from '../../engine/needs';
import type { TeamRoles } from '../../engine/rolesArea';
import type { TeamSet } from '../../engine/sets';
import { ATTACKER_ROLES, FAMILIES, type SubRoleReason } from '../../engine/subRoles';
import type { T } from '../AreaDetail';
import { PokemonIcon } from '../PokemonName';
import { points, type RoleHolder } from './rolesRows';

/** Nome della voce: il sotto-ruolo, o il gruppo degli attaccanti ("Sweeper", "Attaccante fisico"…). */
export const keyLabel = (key: LevelKey, t: T) => (isGroupKey(key) ? t(`need.${key}`) : t(`role.${key}`));

const thousands = (n: number) => `${Math.round(n / 1000)}k`;
const ATTACK_KEYS = new Set<LevelKey>(['anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', ...FAMILIES.attack]);

/** Il motivo di un sotto-ruolo in parole: quota del gruppo per Taunt, Encore e stati, indice per i muri, colpo per l'Attacco. */
export function reasonText(r: SubRoleReason, pool: string, t: T): string {
  const pct = Math.round(100 * (r.share ?? 0));
  if (r.role === 'taunt' || r.role === 'encore') return t(r.prankster ? 'rdetail.reason.prankster' : 'rdetail.reason.outspeed', { move: r.source, pct, pool });
  if ((r.role === 'dot' || r.role === 'debuff') && r.share !== undefined) return t('rdetail.reason.status', { move: r.source, pct, pool });
  if ((r.role === 'physicalWall' || r.role === 'specialWall') && r.index !== undefined) {
    return t(r.role === 'physicalWall' ? 'rdetail.reason.wall.physical' : 'rdetail.reason.wall.special', { index: thousands(r.index), threshold: thousands(r.threshold ?? 0) });
  }
  if (FAMILIES.attack.includes(r.role) || ATTACKER_ROLES.includes(r.role)) return t('rdetail.reason.attack', { move: r.source });
  // 'set': fonte generica del solo set, senza una mossa da nominare
  return r.source === 'set' || r.source === 'wall' ? '' : r.source;
}

/** La nota dopo il motivo: pivot offensivo o difensivo (se chi lo porta è un muro), "misto" per chi attacca da entrambi i lati. */
export function kindNote(key: LevelKey, h: RoleHolder, roles: TeamRoles, team: TeamSet[], t: T): string {
  const m = roles.members[h.slot];
  if (key === 'pivot') {
    const v = m?.credited ?? m?.values ?? {};
    const wall = (v.physicalWall ?? 0) >= MISSING_BELOW || (v.specialWall ?? 0) >= MISSING_BELOW;
    return t(wall ? 'rdetail.pivot.defensive' : 'rdetail.pivot.offensive');
  }
  const set = team[h.slot];
  return ATTACK_KEYS.has(key) && set && attackStyle(set) === 'mixed' ? t('rdetail.mixed') : '';
}

/** Motivo completo di chi porta la voce: il motivo misurato (o la fonte) e la nota. */
export function holderReason(key: LevelKey, h: RoleHolder, roles: TeamRoles, team: TeamSet[], pool: string, t: T): string {
  const why = h.reason ? reasonText(h.reason, pool, t) : h.source === 'set' || h.source === 'wall' ? '' : h.source;
  return [why, kindNote(key, h, roles, team, t)].filter(Boolean).join(' · ');
}

/** Il livello come etichetta piccola (Essenziale, Importante, Minore, Non conta). */
export function LevelTag({ level, t }: { level: Level; t: T }) {
  return <span className={`rl-tag ${level}`}>{t(`rdetail.level.${level}`)}</span>;
}

/**
 * Chi porta la voce: l'icona del box, col valore piccolo sotto solo quando non è pieno (sotto 100); il secondario e chi
 * la porta solo in parte (sotto il pieno) più tenui. Nome, valore e motivo per lo screen reader e nel tooltip.
 */
export function RoleMon({ h, why, t, mark = false }: { h: RoleHolder; why?: string; t: T; mark?: boolean }) {
  const weak = h.secondary || h.value < 1;
  const value = points(h.value);
  const title = [h.species, h.secondary && t('rdetail.secondary'), why, String(value)].filter(Boolean).join(' · ');
  return (
    <span className={`rl-mon${weak ? ' weak' : ''}${h.value < MISSING_BELOW ? ' partial' : ''}`} title={title}>
      <span className="rl-box"><PokemonIcon name={h.species} /></span>
      <span className="visually-hidden">{h.species}{h.secondary ? ` (${t('rdetail.secondary')})` : ''}</span>
      {value < 100 && <small className="rl-val">{value}</small>}
      {mark && h.secondary && <small className="rl-sec" aria-hidden="true">{t('rdetail.secondaryShort')}</small>}
    </span>
  );
}
