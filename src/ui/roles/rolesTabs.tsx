import type { TeamRating } from '../../engine/rating';
import type { Level } from '../../engine/roleLevels';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { RolesGeneral } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';
import { RolesLevel } from './RolesLevel';
import { LEVEL_ORDER, roleLines } from './rolesRows';

/**
 * Le schede dei Ruoli: Generale (cosa manca e chi copre ciò che conta) e una per livello, con quante voci il team copre
 * ("3/5"; Non contano: solo quante sono). Un livello senza voci per questo tipo di team non ha la scheda.
 * La guida sta sul Generale: Come funziona, Ruoli per tipo di team, Come si ottiene un ruolo.
 */
export function rolesTabs(rating: TeamRating, value: string, t: T, ctx: AreaContext): DetailTab[] {
  const lines = roleLines(rating);
  const archetype = rating.needs.archetype;
  const meta = !!rating.meta;
  const levelTab = (level: Level): DetailTab | null => {
    const rows = lines.filter(l => l.level === level);
    if (!rows.length) return null;
    const covered = rows.filter(l => !l.missing).length;
    return {
      key: level, label: t(`rdetail.group.${level}`),
      value: level === 'ignored' ? rows.length : `${covered}/${rows.length}`,
      panel: <RolesLevel rating={rating} level={level} ctx={ctx} />,
    };
  };
  return [
    {
      key: 'general', label: t('detail.tab.general'), value, panel: <RolesGeneral rating={rating} ctx={ctx} />,
      help: <RolesGuideSection section="general" archetype={archetype} meta={meta} />,
      guidePages: rolesGuidePages(archetype, meta, t),
    },
    ...LEVEL_ORDER.map(levelTab).filter((tab): tab is DetailTab => tab !== null),
  ];
}
