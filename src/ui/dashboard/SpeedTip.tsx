import type { ReactNode } from 'react';
import type { SpeedLane, SpeedNeighbour } from '../../engine/overviewDashboard';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { ItemIcon } from '../ItemIcon';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';

/** Il nome con accanto l'icona dello strumento che alza la Velocità (Sciarpa o Booster), se c'è. */
function Name({ species, item }: { species: string; item?: string }) {
  return <span className="stip-name"><span>{species}</span>{item && <ItemIcon item={item} size={20} />}</span>;
}

/** Una riga della scala: sprite, nome con l'icona dello strumento che alza la Velocità, e la velocità effettiva. */
function Rung({ mon, tone, tag }: { mon: SpeedNeighbour; tone: 'faster' | 'slower' | 'tie'; tag?: string }) {
  return (
    <div className={`stip-rung ${tone}`}>
      <span className="stip-mon"><Sprite species={mon.species} size={SPRITE_TIP_ROW} /></span>
      <Name species={mon.species} item={mon.scarf ? 'Choice Scarf' : mon.booster ? 'Booster Energy' : undefined} />
      {tag && <span className="stip-item tie">{tag}</span>}
      <b className="stip-speed">{mon.speed}</b>
    </div>
  );
}

/**
 * Il tooltip di una barra della Velocità: una scala, in alto i rivali appena più veloci (il più veloce in cima), al
 * centro il membro scelto in evidenza, sotto quelli appena più lenti; ognuno con la sua velocità effettiva (spread e
 * strumento più usati: Sciarpa e Booster con la loro icona accanto al nome). Rosso chi ti supera, verde chi superi.
 * `extra`: righe in più prima della nota (nella scheda Velocità: cosa aggiunge ogni guadagno).
 */
export function SpeedTip({ lane, vsMeta, extra }: { lane: SpeedLane; vsMeta: boolean; extra?: ReactNode }) {
  const t = useT();
  const near = lane.near;
  return (
    <>
      <div className="stip-head">
        <span className="stip-bolt"><Icon name="speed" /></span>
        <b>{lane.species}</b>
        <em className="stip-own">{lane.speed}</em>
      </div>
      <div className="stip-ladder">
        {near && [...near.faster].reverse().map(mon => <Rung key={`f-${mon.species}-${mon.speed}`} mon={mon} tone="faster" />)}
        <div className="stip-rung self">
          <span className="stip-mon"><Sprite species={lane.species} size={SPRITE_TIP_ROW} /></span>
          <Name species={lane.species} item={lane.item} />
          <b className="stip-speed">{lane.speed}</b>
        </div>
        {near?.ties.map(mon => <Rung key={`t-${mon.species}-${mon.speed}`} mon={mon} tone="tie" tag={t('stip.tie')} />)}
        {near?.slower.map(mon => <Rung key={`s-${mon.species}-${mon.speed}`} mon={mon} tone="slower" />)}
        {!near && <p className="stip-empty">{t('stip.none')}</p>}
      </div>
      {extra}
      <p className="ftip-foot">{t(vsMeta ? 'stip.footMeta' : 'stip.footTier')}</p>
    </>
  );
}
