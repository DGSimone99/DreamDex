import type { TeamRating } from '../../engine/rating';
import { rolesPointsLabel, rolesTally } from '../../engine/rolesArea';
import { ROLES_SUB, type AreaContext, type DetailTab, type T } from '../AreaDetail';
import { RolesGeneral } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';

/**
 * La sottoscheda Ruoli di Ruoli e Bonus: il valore "X/Y" e i punti ±N sono lo stesso conteggio di Panoramica, Coaching
 * e carta del voto (rolesTally). X/Y conta solo essenziali e importanti (coperti sul totale per questo tipo di team); ±N
 * sono i punti dei Ruoli sul voto (minori coperti meno le mancanze), solo se non 0. Sul selettore c'è solo il nome:
 * tutto a parole nella descrizione della scheda.
 * I Ruoli non hanno un peso nel voto, contano coi loro punti. Dentro una vista sola, le tre
 * fasce Essenziali, Importanti e Minori (RolesGeneral). La guida dei Ruoli sta sul suo "?": Come funziona, Ruoli per
 * tipo di team.
 */
export function rolesTab(rating: TeamRating, t: T, ctx: AreaContext): DetailTab {
  const archetype = rating.needs.archetype;
  const { covered, total, missing, points } = rolesTally(rating.roles);
  return {
    key: ROLES_SUB, label: t('area.roles'), value: `${covered}/${total}`, panel: <RolesGeneral rating={rating} ctx={ctx} />,
    describe: [
      t('rating.rolesSubCovered', { covered, total }),
      missing ? t('rating.rolesSubMissing', { n: missing }) : '',
      points !== 0 ? t('rating.rolesPoints', { value: rolesPointsLabel(points) }) : '',
    ].filter(Boolean).join(', '),
    help: <RolesGuideSection section="general" archetype={archetype} typeRule={rating.needs.rules.typeRule} />,
    guidePages: rolesGuidePages(archetype, t, rating.needs.rules.typeRule),
  };
}
