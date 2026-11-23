import type { Core } from '../../engine/cores';
import { holdBand } from '../../engine/defense';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { KoBadge } from '../KoBadge';
import { Sprite } from '../Sprite';
import { TipGlyph, TipHead, TipRow, TipRows, TipSec } from '../TipHead';
import { typeTextColor } from '../TypeText';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { tileStyle, typeIconUrl } from '../typeIcons';
import { coreTitle } from './CoreTriangle';

/**
 * Il tooltip di un core a tre: una riga per lato (TipRow), come le righe degli altri tooltip: la sprite da 40 di chi para,
 * il nome, sotto la tessera del tipo che para (nel colore schiarito dei nomi dei tipi, typeTextColor) e per chi lo para;
 * a destra quanto lo regge, come fascia dei colpi (KoBadge, i colori della Difesa, senza percentuali).
 * La testata unica (scudo, i tipi del core, sotto cosa misura la fascia; a destra "Core").
 * `taken`: per membro e tipo il danno subito (0–100), dal Riassunto.
 */
export function CoreTip({ core, taken }: { core: Core; taken: Record<string, Record<string, number>> }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <TipHead lead={<TipGlyph icon="shield" />} title={coreTitle(core, lang)} sub={t('coreTip.foot')}
        badge={<span className="tip-kind">{t('sum.link.core')}</span>} />
      <TipSec>
        <TipRows className="core-tip-rows">
          {core.sides.map(side => {
            const pct = taken[side.from]?.[side.type];
            const band = pct === undefined ? null : holdBand(pct / 100);
            return (
              <TipRow key={side.from} lead={<Sprite species={side.from} size={SPRITE_TIP_ROW} />} title={side.from}
                sub={(
                  <span className="core-tip-type">
                    <img className="ti-sq" style={tileStyle(side.type)} src={typeIconUrl(side.type)} alt="" draggable={false} />
                    <span style={{ color: typeTextColor(side.type) }}>{t('coreTip.holds', { type: typeName(side.type, lang) })}</span>
                    <span className="core-tip-for">{t('coreTip.for')} {side.to}</span>
                  </span>
                )}
                value={band ? <KoBadge side="def" band={band} /> : undefined} />
            );
          })}
        </TipRows>
      </TipSec>
    </>
  );
}
