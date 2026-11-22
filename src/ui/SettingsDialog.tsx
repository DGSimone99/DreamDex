import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';
import { PALETTES, type PaletteSetting } from './theme';

const CHOICES: PaletteSetting[] = ['auto', ...PALETTES];

/**
 * Impostazioni: la palette (segue il gioco o fissa), salvata nel browser. Quando ci saranno gli account passeranno lì.
 */
export function SettingsDialog({ palette, onPaletteChange, onCredits, onFeedback, onClose }: {
  palette: PaletteSetting;
  onPaletteChange: (palette: PaletteSetting) => void;
  /** Crediti e note legali (sul telefono la barra in fondo non c'è). */
  onCredits?: () => void;
  /** Segnala o suggerisci (sul telefono la barra in fondo non c'è). */
  onFeedback?: () => void;
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
          <ModalLock />
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
          {onFeedback && <button type="button" className="settings-credits" onClick={onFeedback}>{t('feedback.open')}<Icon name="next" /></button>}
          {onCredits && <button type="button" className="settings-credits" onClick={onCredits}>{t('credits.openLong')}<Icon name="next" /></button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
