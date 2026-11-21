import { attackStyle } from '../../engine/roles';
import { isGroupKey, type Level, type LevelKey } from '../../engine/roleLevels';
import { MISSING_BELOW } from '../../engine/needs';
import type { TeamRoles } from '../../engine/rolesArea';
import type { TeamSet } from '../../engine/sets';
import { ATTACKER_ROLES, FAMILIES, type SubRoleReason } from '../../engine/subRoles';
import type { T } from '../AreaDetail';
import { PokemonIcon } from '../PokemonName';
import type { RoleHolder } from './rolesRows';

/** Nome della voce: il sotto-ruolo, o il gruppo degli attaccanti ("Sweeper", "Attaccante fisico"…). */
export const keyLabel = (key: LevelKey, t: T) => (isGroupKey(key) ? t(`need.${key}`) : t(`role.${key}`));

const thousands = (n: number) => `${Math.round(n / 1000)}k`;
const ATTACK_KEYS = new Set<LevelKey>(['anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', ...FAMILIES.attack]);

/** Il motivo di un sotto-ruolo in parole, senza percentuali (2026-11-20, utente): la mossa, Prankster, il muro, il colpo per l'Attacco. */
export function reasonText(r: SubRoleReason, t: T): string {
  if (r.role === 'disruptor' && r.prankster) return t('rdetail.reason.prankster', { move: r.source });
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
export function holderReason(key: LevelKey, h: RoleHolder, roles: TeamRoles, team: TeamSet[], t: T): string {
  const why = h.reason ? reasonText(h.reason, t) : h.source === 'set' || h.source === 'wall' ? '' : h.source;
  return [why, kindNote(key, h, roles, team, t)].filter(Boolean).join(' · ');
}

/** Il livello come etichetta piccola (Essenziale, Importante, Minore, Non conta). */
export function LevelTag({ level, t }: { level: Level; t: T }) {
  return <span className={`rl-tag ${level}`}>{t(`rdetail.level.${level}`)}</span>;
}

/**
 * Chi porta la voce: l'icona del box; con `named` (l'unico che la porta) anche il nome accanto. Niente percentuali
 * (2026-11-20, utente): o la porta o no. Il secondario più tenue. Nome e motivo per lo screen reader e nel tooltip.
 */
export function RoleMon({ h, why, t, named = false }: { h: RoleHolder; why?: string; t: T; named?: boolean }) {
  const title = [h.species, h.secondary && t('rdetail.secondary'), why].filter(Boolean).join(' · ');
  return (
    <span className={`rl-mon${h.secondary ? ' weak' : ''}${named ? ' named' : ''}`} title={title}>
      <span className="rl-box"><PokemonIcon name={h.species} /></span>
      {named && <b className="rl-mon-name" aria-hidden="true">{h.species}</b>}
      <span className="visually-hidden">{h.species}{h.secondary ? ` (${t('rdetail.secondary')})` : ''}</span>
    </span>
  );
}
