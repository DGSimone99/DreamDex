import type { Format } from '../engine/format';
import { formatLabel, hasSmogonAnalysis, smogonUrl } from '../engine/formats';
import { useLang, useT } from '../i18n/react';
import { Hint } from './Hint';
import { Icon } from './icons';
import { hint } from './MoveTip';

/** Link esterno alla pagina Smogon del Pokémon: l'analisi del formato se c'è, altrimenti la pagina generale. */
export function SmogonLink({ species, format, presets, iconOnly = false, short = false }: { species: string; format: Format; presets: { format: string }[]; iconOnly?: boolean; short?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const analysed = hasSmogonAnalysis(presets, format);
  const href = smogonUrl(species, format, analysed);
  const formatText = formatLabel(format, lang);
  // Solo icona (accanto ai preset): il nome e dove porta nel fumetto, come gli altri controlli della testata
  if (iconOnly) {
    return (
      <Hint label={tr('detail.smogon')} detail={tr(analysed ? 'detail.smogonFor' : 'detail.smogonNone', { format: formatText })}>
        <a className="smogon-link icon-only" href={href} target="_blank" rel="noopener noreferrer" aria-label={tr('detail.smogon')}>
          <Icon name="external" />
        </a>
      </Hint>
    );
  }
  return (
    <a className="smogon-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={short ? tr('detail.smogon') : undefined}
      aria-description={tr(analysed ? 'detail.smogonTitle' : 'detail.smogonGeneral', { format: formatText })}
      {...hint(tr(analysed ? 'detail.smogonTitle' : 'detail.smogonGeneral', { format: formatText }))}>
      {/* `short`: anche il nome breve ("Smogon"), che il contenitore mostra quando manca spazio */}
      <Icon name="external" /> {short
        ? <span className="btn-label" aria-hidden="true"><span className="lbl-full">{tr('detail.smogon')}</span><span className="lbl-short">{tr('detail.smogonShort')}</span></span>
        : <span className="btn-label">{tr('detail.smogon')}</span>}
    </a>
  );
}
