import { battleSpecies, toID } from '../../engine/dex';
import { formatRules, isOneType } from '../../engine/formatRules';
import type { TeamSpeed } from '../../engine/speedArea';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { SpeedGeneral } from './SpeedGeneral';
import { SpeedGuideSection } from './SpeedGuide';

/** I membri che portano Trick Room (nome di battaglia): con almeno uno, l'interruttore "Trick Room · chi" sopra la tabella. */
export const roomSetters = (ctx: AreaContext): string[] =>
  [...new Set(ctx.team.filter(set => set.moves.some(m => toID(m) === 'trickroom')).map(set => battleSpecies(set)?.name ?? set.species))];

/** La Velocità ha una scheda sola: i membri a barre, e da ogni barra il modale coi rivali; con Trick Room l'interruttore. */
export function speedTabs(speed: TeamSpeed, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  const roomBy = roomSetters(ctx);
  return [
    { key: 'general', label: t('detail.tab.general'), value: speed.value, roomBy, panel: <SpeedGeneral speed={speed} meta={meta} ctx={ctx} room={!!ctx.trickRoom && roomBy.length > 0} />, help: <SpeedGuideSection speed={speed} meta={meta} doubles={isOneType(formatRules(ctx.formatId))} /> },
  ];
}
