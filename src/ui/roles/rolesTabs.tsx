import type { TeamRating } from '../../engine/rating';
import { MISSING_BELOW } from '../../engine/needs';
import { ROLES_SUB, type AreaContext, type DetailTab, type T } from '../AreaDetail';
import { Icon } from '../icons';
import { RolesGeneral } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';

/**
 * La sottoscheda Ruoli di Ruoli e Bonus (coperti/totale, e quanti essenziali e importanti mancano a segni, come la riga
 * Ruoli del voto): i Ruoli non hanno un peso nel voto, contano coi loro bonus e malus. Dentro una vista sola, le tre
 * fasce Essenziali, Importanti e Minori (RolesGeneral). La guida dei Ruoli sta sul suo "?": Come funziona, Ruoli per
 * tipo di team, Come si ottiene un ruolo.
 */
export function rolesTab(rating: TeamRating, value: string, t: T, ctx: AreaContext): DetailTab {
  const archetype = rating.needs.archetype;
  const meta = !!rating.meta;
  const holes = (level: string) => rating.roles.rows.filter(r => r.level === level && r.value < MISSING_BELOW).length;
  const essential = holes('essential');
  const important = holes('important');
  return {
    key: ROLES_SUB, label: t('area.roles'), value, panel: <RolesGeneral rating={rating} ctx={ctx} />,
    // Le mancanze a segni: il numero col triangolo rosso (essenziali) o giallo (importanti), come accanto al team
    marks: essential + important > 0 ? <>
      {essential > 0 && <span className="sub-miss bad">{essential}<Icon name="warning" /></span>}
      {important > 0 && <span className="sub-miss warn">{important}<Icon name="warning" /></span>}
    </> : undefined,
    describe: [
      essential > 0 ? t('rating.rolesMissingEssential', { n: essential }) : '',
      important > 0 ? t('rating.rolesMissingImportant', { n: important }) : '',
    ].filter(Boolean).join(', ') || undefined,
    help: <RolesGuideSection section="general" archetype={archetype} meta={meta} typeRule={rating.needs.rules.typeRule} />,
    guidePages: rolesGuidePages(archetype, meta, t, rating.needs.rules.typeRule),
  };
}
