import type { ReactNode } from 'react';
import type { SpeedLane, SpeedNeighbour } from '../../engine/overviewDashboard';
import { useT } from '../../i18n/react';
import { FormeName } from '../candidateParts';
import { ItemIcon } from '../ItemIcon';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { TipHead, TipSec } from '../TipHead';

/** Lo strumento che alza la Velocità: la Sciarpa Scelta (×1,5) o la Capsula energetica (Booster). */
type SpeedItem = 'Choice Scarf' | 'Booster Energy';
const itemOf = (mon: { scarf?: boolean; booster?: boolean }): SpeedItem | undefined =>
  (mon.scarf ? 'Choice Scarf' : mon.booster ? 'Booster Energy' : undefined);

/**
 * Il nome come sulle carte (la specie base e la forma piccola o il simbolo Mega: FormeName) e, quando la sua velocità viene
 * da uno strumento, la targhetta con l'icona e la parola ("Sciarpa", "Capsula"): si vede subito chi corre col ×1,5.
 */
function Name({ species, item }: { species: string; item?: string }) {
  const t = useT();
  const mark = item === 'Choice Scarf' ? t('stip.scarf') : item === 'Booster Energy' ? t('stip.booster') : null;
  return (
    <span className="stip-name">
      <span className="stip-who"><FormeName species={species} /></span>
      {mark && <span className={`stip-mark ${item === 'Choice Scarf' ? 'scarf' : 'booster'}`} data-testid="stip-item"><ItemIcon item={item!} size={20} />{mark}</span>}
    </span>
  );
}

/**
 * Una riga della scala: sprite, nome (con la targhetta dello strumento che alza la Velocità) e la velocità effettiva.
 * `ahead`: muove prima del membro (rosso), `behind`: dopo (verde), `tie`: alla stessa velocità (giallo, con la targhetta
 * "pari": chi vince lo decide il caso).
 */
function Rung({ mon, tone, tag }: { mon: SpeedNeighbour; tone: 'ahead' | 'behind' | 'tie'; tag?: string }) {
  return (
    <div className={`stip-rung ${tone}`}>
      <span className="stip-mon"><Sprite species={mon.species} size={SPRITE_TIP_ROW} /></span>
      <Name species={mon.species} item={itemOf(mon)} />
      {tag && <span className="stip-item tie" data-testid="stip-tie">{tag}</span>}
      <b className="stip-speed">{mon.speed}</b>
    </div>
  );
}

/**
 * Il tooltip di una barra della Velocità: una scala, in alto i rivali appena più veloci (il più veloce in cima), al
 * centro il membro scelto in evidenza, sotto quelli appena più lenti; ognuno con la sua velocità effettiva (spread e
 * strumento più usati: Sciarpa e Booster con la loro icona accanto al nome). Rosso chi ti supera, verde chi superi.
 * `room` (l'interruttore Trick Room della scheda Velocità): la scala nell'ordine di Trick Room, in alto i più lenti
 * (muovono prima, in rosso), sotto i più veloci (il membro muove prima di loro, in verde).
 * La testata unica (la sprite del membro in piedi, il nome come sulle carte, sotto cosa sono i numeri, a destra la sua velocità
 * in Text); la nota sta nella riga sotto il titolo, così l'unico piede resta quello del clic (TipGo) dove c'è.
 * `extra`: le sezioni in più sotto la scala (nella scheda Velocità: cosa aggiunge ogni guadagno alla barra).
 */
export function SpeedTip({ lane, vsMeta, extra, room = false }: { lane: SpeedLane; vsMeta: boolean; extra?: ReactNode; room?: boolean }) {
  const t = useT();
  const near = lane.near;
  // Sopra il membro chi muove prima (il primo in cima), sotto chi muove dopo (il più vicino per primo)
  const above = near ? [...(room ? near.slower : near.faster)].reverse() : [];
  const below = near ? (room ? near.faster : near.slower) : [];
  return (
    <>
      <TipHead sprite={lane.species} title={<FormeName species={lane.species} />} sub={room ? t('stip.footRoom') : t(vsMeta ? 'stip.footMeta' : 'stip.footTier')}
        num={lane.speed} />
      <TipSec className="stip-ladder">
        {above.map(mon => <Rung key={`a-${mon.species}-${mon.speed}`} mon={mon} tone="ahead" />)}
        <div className="stip-rung self">
          <span className="stip-mon"><Sprite species={lane.species} size={SPRITE_TIP_ROW} /></span>
          <Name species={lane.species} item={lane.item} />
          <b className="stip-speed">{lane.speed}</b>
        </div>
        {near?.ties.map(mon => <Rung key={`t-${mon.species}-${mon.speed}`} mon={mon} tone="tie" tag={t('stip.tie')} />)}
        {below.map(mon => <Rung key={`b-${mon.species}-${mon.speed}`} mon={mon} tone="behind" />)}
        {!near && <p className="stip-empty">{t('stip.none')}</p>}
      </TipSec>
      {extra}
    </>
  );
}
