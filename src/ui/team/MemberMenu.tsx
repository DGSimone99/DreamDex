import type { RefObject } from 'react';
import type { TeamSet } from '../../engine/sets';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';
import { supportsPopover } from '../useAnchoredPop';

/**
 * Col dito: il menu del membro che si apre dal basso tenendo premuta la carta (modifica, blocca, sposta, sostituisci,
 * togli), al posto dei pulsantini sulla carta. Ogni voce chiude il menu prima di fare la sua azione (`run`).
 */
export function MemberMenu({ set, name, index, total, menuRef, onEscape, run, onEdit, onLock, onMove, onReplace, onRemove }: {
  set: TeamSet;
  name: string;
  index: number;
  total: number;
  menuRef: RefObject<HTMLDivElement | null>;
  /** Esc: chiude il menu e torna sulla carta. */
  onEscape: () => void;
  run: (action: () => void) => void;
  onEdit: () => void;
  onLock: () => void;
  onMove: (delta: number) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const tr = useT();
  return (
    <div className="member-menu" ref={menuRef} popover={supportsPopover ? 'manual' : undefined} role="menu" aria-label={tr('team.memberMenu', { species: name })}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onEscape(); } }}>
      <p className="member-menu-head" aria-hidden="true"><Sprite species={set.species} item={set.item} shiny={!!set.shiny} size={48} /><strong>{set.name || name}</strong></p>
      <button type="button" role="menuitem" onClick={() => run(onEdit)}><Icon name="edit" />{tr('team.editSet')}</button>
      <button type="button" role="menuitem" onClick={() => run(onLock)}>
        <Icon name="lock" filled={!!set.favorite} /><span>{tr(set.favorite ? 'team.unlock' : 'team.lock')}<small>{tr('team.lockNote')}</small></span>
      </button>
      <button type="button" role="menuitem" disabled={index === 0} onClick={() => run(() => onMove(-1))}><Icon name="prev" />{tr('team.moveLeft')}</button>
      <button type="button" role="menuitem" disabled={index >= total - 1} onClick={() => run(() => onMove(1))}><Icon name="next" />{tr('team.moveRight')}</button>
      <button type="button" role="menuitem" onClick={() => run(onReplace)}><Icon name="swap" />{tr('team.replaceButton')}</button>
      <button type="button" role="menuitem" className="danger" onClick={() => run(onRemove)}><Icon name="close" />{tr('team.removeShort')}</button>
    </div>
  );
}
