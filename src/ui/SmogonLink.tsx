import type { Format } from '../engine/format';
import { formatLabel, hasSmogonAnalysis, smogonUrl } from '../engine/formats';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';

/** Link esterno alla pagina Smogon del Pokémon: l'analisi del formato se c'è, altrimenti la pagina generale. */
export function SmogonLink({ species, format, presets }: { species: string; format: Format; presets: { format: string }[] }) {
  const tr = useT();
  const lang = useLang();
  const analysed = hasSmogonAnalysis(presets, format);
  return (
    <a className="smogon-link" href={smogonUrl(species, format, analysed)} target="_blank" rel="noopener noreferrer"
      title={tr(analysed ? 'detail.smogonTitle' : 'detail.smogonGeneral', { format: formatLabel(format, lang) })}>
      <Icon name="external" /> <span className="btn-label">{tr('detail.smogon')}</span>
    </a>
  );
}
