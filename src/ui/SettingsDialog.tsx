import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PALETTES, type ListSprite, type ListStyle, type PaletteSetting } from './theme';

const CHOICES: PaletteSetting[] = ['auto', ...PALETTES];
const LIST_STYLES: ListStyle[] = ['cards', 'menu'];
const LIST_SPRITES: ListSprite[] = ['normal', 'box'];

/**
 * Impostazioni: per ora solo la palette (segue il gioco o fissa), salvata nel browser.
 * Quando ci saranno gli account passeranno lì.
 */
export function SettingsDialog({ palette, onPaletteChange, listStyle, onListStyleChange, listSprite, onListSpriteChange, onClose }: {
  palette: PaletteSetting;
  onPaletteChange: (palette: PaletteSetting) => void;
  listStyle: ListStyle;
  onListStyleChange: (style: ListStyle) => void;
  listSprite: ListSprite;
  onListSpriteChange: (sprite: ListSprite) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const label = (choice: PaletteSetting) => (choice === 'auto' ? t('settings.paletteAuto') : t(`settings.palette.${choice}`));
  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={titleId}>{t('settings.title')}</h3>
          <button type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="settings-body">
          <fieldset className="settings-palette">
            <legend>{t('settings.palette')}</legend>
            {CHOICES.map((choice, i) => (
              <label key={choice} className={`palette-choice palette-${choice}`}>
                <input ref={i === 0 ? first : undefined} type="radio" name="palette" value={choice}
                  checked={palette === choice} onChange={() => onPaletteChange(choice)} />
                <span className="swatches" aria-hidden="true"><i /><i /></span>
                <span>{label(choice)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="settings-palette">
            <legend>{t('settings.listStyle')}</legend>
            {LIST_STYLES.map(choice => (
              <label key={choice} className="palette-choice">
                <input type="radio" name="listStyle" value={choice}
                  checked={listStyle === choice} onChange={() => onListStyleChange(choice)} />
                <span>{t(`settings.listStyle.${choice}`)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="settings-palette">
            <legend>{t('settings.listSprite')}</legend>
            {LIST_SPRITES.map(choice => (
              <label key={choice} className="palette-choice">
                <input type="radio" name="listSprite" value={choice}
                  checked={listSprite === choice} onChange={() => onListSpriteChange(choice)} />
                <span>{t(`settings.listSprite.${choice}`)}</span>
              </label>
            ))}
          </fieldset>
          <p className="note">{t('settings.local')}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
