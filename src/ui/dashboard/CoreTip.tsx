import type { Core } from '../../engine/cores';
import { holdBand } from '../../engine/defense';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { HOLD_BANDS } from '../defense/holds';
import { Sprite } from '../Sprite';
import { TipGlyph, TipHead } from '../TipHead';
import { typeTextColor } from '../TypeText';
import { SPRITE_TIP, SPRITE_TIP_ROW } from '../spriteSizes';
import { tileStyle, typeIconUrl } from '../typeIcons';
import { coreTitle } from './CoreTriangle';

/**
 * Il tooltip di un core a tre: per ogni lato chi para, il tipo che para (nel suo colore) e quanto lo regge, come badge
 * dei colpi (OHKO, 2HKO, 3HKO, 4HKO+: i colori e le soglie della scheda Difesa, senza percentuali), poi chi protegge.
 * La testata unica (scudo, i tipi del core, sotto cosa misura il badge; a destra "Core"); i tipi nel colore schiarito dei
 * nomi dei tipi (typeTextColor, leggibile sul fondo scuro).
 * `taken`: per membro e tipo il danno subito (0–100), dal Riassunto.
 */
export function CoreTip({ core, taken }: { core: Core; taken: Record<string, Record<string, number>> }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <TipHead lead={<TipGlyph icon="shield" />} title={coreTitle(core, lang)} sub={t('coreTip.foot')}
        badge={<span className="tip-kind">{t('sum.link.core')}</span>} />
      {core.sides.map(side => {
        const pct = taken[side.from]?.[side.type];
        const band = pct === undefined ? null : holdBand(pct / 100);
        return (
          <div key={side.from} className="core-tip-side">
            <span className="ctip-plinth good"><Sprite species={side.from} size={SPRITE_TIP} /></span>
            <span className="core-tip-what">
              <b>{side.from}</b>
              <span className="core-tip-type" style={{ color: typeTextColor(side.type) }}>
                <img className="ti-sq" style={tileStyle(side.type)} src={typeIconUrl(side.type)} alt="" draggable={false} />{t('coreTip.holds', { type: typeName(side.type, lang) })}
              </span>
            </span>
            {band && <span className={`ftip-ko def ${band}`}>{HOLD_BANDS[band].tag}</span>}
            <span className="core-tip-for">
              <small>{t('coreTip.for')}</small>
              <Sprite species={side.to} size={SPRITE_TIP_ROW} />
            </span>
          </div>
        );
      })}
    </>
  );
}
