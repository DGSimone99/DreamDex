import type { TeamSpeed } from '../../engine/speedArea';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { SpeedGeneral } from './SpeedGeneral';

/** La Velocità ha una scheda sola: i membri a barre, le tessere, e da ogni barra il modale coi rivali. */
export function speedTabs(speed: TeamSpeed, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  return [
    { key: 'general', label: t('detail.tab.general'), value: speed.value, panel: <SpeedGeneral speed={speed} meta={meta} ctx={ctx} /> },
  ];
}
