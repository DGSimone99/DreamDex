import { useEffect, useId, useRef } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PALETTES, type PaletteSetting } from './theme';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';

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
  useEffect(() => { first.current?.focus(); }, [onClose]);
  useEscape(onClose);
  const label = (choice: PaletteSetting) => (choice === 'auto' ? t('settings.paletteAuto') : t(`settings.palette.${choice}`));
  return (
    <ModalShell className="settings-dialog" titleId={titleId} title={t('settings.title')} closeLabel={t('settings.close')} onClose={onClose}>
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
    </ModalShell>
  );
}
