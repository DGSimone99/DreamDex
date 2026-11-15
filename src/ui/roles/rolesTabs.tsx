import type { TeamRating } from '../../engine/rating';
import { rolesPointsLabel, rolesTally } from '../../engine/rolesArea';
import { ROLES_SUB, type AreaContext, type DetailTab, type T } from '../AreaDetail';
import { RolesGeneral } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';

/**
 * La sottoscheda Ruoli di Ruoli e Bonus: "Ruoli X/Y +N", lo stesso conteggio di Panoramica, Coaching e carta del voto
 * (rolesTally). X/Y conta solo essenziali e importanti (coperti sul totale per questo tipo di team), nel colore del
 * livello peggiore che manca (rosso se manca un essenziale, giallo se solo importanti); ±N, più piccolo, sono i punti
 * dei Ruoli sul voto (minori coperti meno le mancanze), solo se non 0. Tutto a parole nella descrizione.
 * I Ruoli non hanno un peso nel voto, contano coi loro punti. Dentro una vista sola, le tre
 * fasce Essenziali, Importanti e Minori (RolesGeneral). La guida dei Ruoli sta sul suo "?": Come funziona, Ruoli per
 * tipo di team.
 */
export function rolesTab(rating: TeamRating, t: T, ctx: AreaContext): DetailTab {
  const archetype = rating.needs.archetype;
  const { covered, total, missing, missingEssential, points } = rolesTally(rating.roles);
  return {
    key: ROLES_SUB, label: t('area.roles'), value: `${covered}/${total}`, panel: <RolesGeneral rating={rating} ctx={ctx} />,
    valueTone: missingEssential > 0 ? 'bad' : missing > 0 ? 'warn' : undefined,
    marks: points !== 0 ? <span className={`sub-plus${points < 0 ? ' neg' : ''}`}>{rolesPointsLabel(points)}</span> : undefined,
    describe: [
      t('rating.rolesSubCovered', { covered, total }),
      missing ? t('rating.rolesSubMissing', { n: missing }) : '',
      points !== 0 ? t('rating.rolesPoints', { value: rolesPointsLabel(points) }) : '',
    ].filter(Boolean).join(', '),
    help: <RolesGuideSection section="general" archetype={archetype} typeRule={rating.needs.rules.typeRule} />,
    guidePages: rolesGuidePages(archetype, t, rating.needs.rules.typeRule),
  };
}
