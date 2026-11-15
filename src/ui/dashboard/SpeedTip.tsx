import type { SpeedLane, SpeedNeighbour } from '../../engine/overviewDashboard';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';

/** Una riga della scala: sprite, nome, cosa alza la Velocità (Sciarpa o Booster) e la velocità effettiva. */
function Rung({ mon, tone, tag }: { mon: SpeedNeighbour; tone: 'faster' | 'slower' | 'tie'; tag?: string }) {
  const t = useT();
  return (
    <div className={`stip-rung ${tone}`}>
      <span className="stip-mon"><Sprite species={mon.species} size={32} /></span>
      <span className="stip-name">{mon.species}</span>
      {mon.scarf && <span className="stip-item">{t('stip.scarf')}</span>}
      {mon.booster && <span className="stip-item">{t('stip.booster')}</span>}
      {tag && <span className="stip-item tie">{tag}</span>}
      <b className="stip-speed">{mon.speed}</b>
    </div>
  );
}

/**
 * Il tooltip di una barra della Velocità: una scala, in alto i rivali appena più veloci (il più veloce in cima), al
 * centro il membro scelto in evidenza, sotto quelli appena più lenti; ognuno con la sua velocità effettiva (spread e
 * strumento più usati: Sciarpa e Booster scritti). Rosso chi ti supera, verde chi superi.
 */
export function SpeedTip({ lane, vsMeta }: { lane: SpeedLane; vsMeta: boolean }) {
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
          <span className="stip-mon"><Sprite species={lane.species} size={32} /></span>
          <span className="stip-name">{lane.species}</span>
          <b className="stip-speed">{lane.speed}</b>
        </div>
        {near?.ties.map(mon => <Rung key={`t-${mon.species}-${mon.speed}`} mon={mon} tone="tie" tag={t('stip.tie')} />)}
        {near?.slower.map(mon => <Rung key={`s-${mon.species}-${mon.speed}`} mon={mon} tone="slower" />)}
        {!near && <p className="stip-empty">{t('stip.none')}</p>}
      </div>
      <p className="ftip-foot">{t(vsMeta ? 'stip.footMeta' : 'stip.footTier')}</p>
    </>
  );
}
