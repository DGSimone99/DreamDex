import { useEffect, useId, useRef, useState } from 'react';
import type { ListSprite } from './theme';
import { useT } from '../i18n/react';
import { Icon } from './icons';

const SPRITES: ListSprite[] = ['normal', 'box'];

/**
 * Vista della lista, in fondo alla fascia "Candidati": lo sprite (Normale / Icona box).
 * La stessa impostazione del dialogo Impostazioni (stesso salvataggio): cambiarla qui la cambia anche lì.
 * Si chiude cliccando fuori o con Esc (il focus torna al pulsante).
 */
export function ListViewMenu({ listSprite, onListSpriteChange }: {
  listSprite: ListSprite;
  onListSpriteChange: (sprite: ListSprite) => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popId = useId();
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
  return (
    <div className="list-view" ref={rootRef}>
      <button ref={buttonRef} type="button" className="list-view-toggle" aria-label={tr('suggest.view')} title={tr('suggest.view')}
        // Niente aria-haspopup: il riquadro è un gruppo di scelte, non un menu
        aria-expanded={open} aria-controls={open ? popId : undefined} onClick={() => setOpen(o => !o)}>
        <Icon name="roles" />
      </button>
      {open && (
        <div id={popId} className="list-view-pop" role="group" aria-label={tr('suggest.view')}>
          <fieldset>
            <legend>{tr('suggest.view.sprite')}</legend>
            {SPRITES.map(choice => (
              <label key={choice}>
                <input type="radio" name="list-view-sprite" value={choice} checked={listSprite === choice} onChange={() => onListSpriteChange(choice)} />
                <span>{tr(`settings.listSprite.${choice}`)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
