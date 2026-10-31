import type { ReactElement } from 'react';
import type { TeamSpeed } from '../../engine/speedArea';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { SpeedControl } from './SpeedControl';
import { SpeedGeneral } from './SpeedGeneral';
import { SpeedThreats } from './SpeedThreats';

export type SpeedSection = 'general' | 'threats' | 'control';

/** Le schede della Velocità: Generale, Chi supera (i rivali del gruppo in colonna) e Controllo velocità. */
export function speedTabs(speed: TeamSpeed, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  const tabs: { key: SpeedSection; label: string; value: number | string; panel: ReactElement }[] = [
    { key: 'general', label: t('detail.tab.general'), value: speed.value, panel: <SpeedGeneral speed={speed} meta={meta} ctx={ctx} /> },
    { key: 'threats', label: t('sdetail.threats'), value: speed.speed, panel: <SpeedThreats speed={speed} meta={meta} ctx={ctx} /> },
    { key: 'control', label: t('sdetail.control'), value: `+${speed.control}`, panel: <SpeedControl speed={speed} /> },
  ];
  return tabs;
}
