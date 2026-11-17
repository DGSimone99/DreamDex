import { useEffect, useRef, useState } from 'react';
import { battleName } from '../engine/dex';
import type { TeamSet } from '../engine/sets';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';

/**
 * Aggiungi / Sostituisci, e attaccata a Sostituisci una tendina (▾) con chi esce: Tutti (il motore sceglie per ogni
 * candidato) o un membro preciso. Il pulsante della tendina dice "Tutti" o mostra l'icona del membro scelto; si chiude scegliendo, cliccando fuori
 * o con Esc (il focus torna al pulsante).
 */
export function ModeSwitch({ team, view, replacing, replaceIndex, addDisabled, improveDisabled, onAdd, onImprove, onAll, onTarget }: {
  team: TeamSet[];
  view: 'add' | 'all' | 'member';
  replacing: boolean;
  replaceIndex: number | null;
  addDisabled: boolean;
  improveDisabled: boolean;
  onAdd: () => void;
  onImprove: () => void;
  /** Chi esce: tutti. */
  onAll: () => void;
  onTarget: (index: number) => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const chosen = replacing && replaceIndex !== null ? team[replaceIndex] : undefined;
  const pick = (choose: () => void) => { choose(); setOpen(false); };
  return (
    <div className="mode-switch" ref={rootRef}>
      <div className="segmented" role="group" aria-label={tr('suggest.mode')}>
        <button type="button" aria-pressed={view === 'add'} disabled={addDisabled} onClick={onAdd}>
          <Icon name="plus" />{tr('suggest.addMode')}
        </button>
        <button type="button" aria-pressed={view !== 'add'} disabled={improveDisabled} onClick={onImprove}>{tr('suggest.improve')}</button>
        <button ref={buttonRef} type="button" className={`target-toggle${view !== 'add' ? ' on' : ''}`} disabled={improveDisabled}
          aria-label={`${tr('suggest.target')}: ${chosen ? battleName(chosen) : tr('suggest.targetAll')}`}
          aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
          {chosen ? <PokemonIcon name={battleName(chosen)} /> : <span className="target-all" aria-hidden="true">{tr('suggest.targetAll')}</span>}
          <span className="chevron" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="target-pop" role="group" aria-label={tr('suggest.target')}>
          <span className="targets-label" aria-hidden="true">{tr('suggest.targetLabel')}</span>
          <button type="button" aria-pressed={view === 'all'} onClick={() => pick(onAll)}>{tr('suggest.targetAll')}</button>
          {team.map((member, index) => (
            <button key={index} type="button" className="target-member" aria-pressed={replacing && replaceIndex === index}
              aria-label={tr('suggest.targetMember', { member: battleName(member) })}
              title={member.favorite ? `${battleName(member)} · ${tr('suggest.targetFavorite')}` : battleName(member)}
              onClick={() => pick(() => onTarget(index))}>
              <PokemonIcon name={battleName(member)} />
              <span className="target-name" aria-hidden="true">{battleName(member)}</span>
              {member.favorite && <Icon name="lock" filled />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
