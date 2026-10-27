import { useEffect, useRef, useState } from 'react';
import type { ListSprite, ListStyle } from './theme';
import { useT } from '../i18n/react';
import { Icon } from './icons';

const STYLES: ListStyle[] = ['cards', 'menu'];
const SPRITES: ListSprite[] = ['normal', 'box'];

/**
 * Vista della lista, in fondo alla fascia "Candidati": stile (Carte / Menu) e sprite (Normale / Icona box).
 * Le stesse impostazioni del dialogo Impostazioni (stesso salvataggio): cambiarle qui le cambia anche lì.
 * Si chiude cliccando fuori o con Esc (il focus torna al pulsante).
 */
export function ListViewMenu({ listStyle, listSprite, onListStyleChange, onListSpriteChange }: {
  listStyle: ListStyle;
  listSprite: ListSprite;
  onListStyleChange: (style: ListStyle) => void;
  onListSpriteChange: (sprite: ListSprite) => void;
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
  return (
    <div className="list-view" ref={rootRef}>
      <button ref={buttonRef} type="button" className="list-view-toggle" aria-label={tr('suggest.view')} title={tr('suggest.view')}
        aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
        <Icon name="roles" />
      </button>
      {open && (
        <div className="list-view-pop" role="group" aria-label={tr('suggest.view')}>
          <fieldset>
            <legend>{tr('suggest.view.style')}</legend>
            {STYLES.map(choice => (
              <label key={choice}>
                <input type="radio" name="list-view-style" value={choice} checked={listStyle === choice} onChange={() => onListStyleChange(choice)} />
                <span>{tr(`settings.listStyle.${choice}`)}</span>
              </label>
            ))}
          </fieldset>
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
