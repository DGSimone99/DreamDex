import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PALETTES, type PaletteSetting } from './theme';

const CHOICES: PaletteSetting[] = ['auto', ...PALETTES];

/**
 * Impostazioni: per ora solo la palette (segue il gioco o fissa), salvata nel browser.
 * Quando ci saranno gli account passeranno lì.
 */
export function SettingsDialog({ palette, onPaletteChange, onClose }: {
  palette: PaletteSetting;
  onPaletteChange: (palette: PaletteSetting) => void;
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
          <p className="note">{t('settings.local')}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
