import type { TeamRating } from '../../engine/rating';
import { MISSING_BELOW } from '../../engine/needs';
import { ROLES_SUB, type AreaContext, type DetailTab, type T } from '../AreaDetail';
import { RolesGeneral } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';

/**
 * La sottoscheda Ruoli di Ruoli e Bonus: "Ruoli X/Y +N". X/Y conta solo essenziali e importanti (coperti sul totale per
 * questo tipo di team), nel colore del livello peggiore che manca (rosso se manca un essenziale, giallo se solo
 * importanti); +N, verde e più piccolo, è il bonus dei minori coperti, solo se c'è. Tutto a parole nella descrizione.
 * I Ruoli non hanno un peso nel voto, contano coi loro punti. Dentro una vista sola, le tre
 * fasce Essenziali, Importanti e Minori (RolesGeneral). La guida dei Ruoli sta sul suo "?": Come funziona, Ruoli per
 * tipo di team.
 */
export function rolesTab(rating: TeamRating, t: T, ctx: AreaContext): DetailTab {
  const archetype = rating.needs.archetype;
  const counted = rating.roles.rows.filter(r => r.level === 'essential' || r.level === 'important');
  const missing = counted.filter(r => r.value < MISSING_BELOW);
  const covered = counted.length - missing.length;
  const minor = rating.roles.bonuses.reduce((n, b) => n + b.points, 0);
  return {
    key: ROLES_SUB, label: t('area.roles'), value: `${covered}/${counted.length}`, panel: <RolesGeneral rating={rating} ctx={ctx} />,
    valueTone: missing.some(r => r.level === 'essential') ? 'bad' : missing.length ? 'warn' : undefined,
    marks: minor > 0 ? <span className="sub-plus">+{minor}</span> : undefined,
    describe: [
      t('rating.rolesSubCovered', { covered, total: counted.length }),
      missing.length ? t('rating.rolesSubMissing', { n: missing.length }) : '',
      minor > 0 ? t('rating.rolesSubMinor', { n: minor }) : '',
    ].filter(Boolean).join(', '),
    help: <RolesGuideSection section="general" archetype={archetype} typeRule={rating.needs.rules.typeRule} />,
    guidePages: rolesGuidePages(archetype, t, rating.needs.rules.typeRule),
  };
}
