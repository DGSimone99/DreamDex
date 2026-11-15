import type { CSSProperties } from 'react';
import type { Core } from '../../engine/cores';
import { holdBand } from '../../engine/defense';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { HOLD_BANDS } from '../defense/holds';
import { Sprite, typeColor } from '../Sprite';
import { typeIconUrl } from '../typeIcons';
import { coreTitle } from './CoreTriangle';

/**
 * Il tooltip di un core a tre: per ogni lato chi para, il tipo che para (nel suo colore) e quanto lo regge, come badge
 * dei colpi (OHKO, 2HKO, 3HKO, 4HKO+: i colori e le soglie della scheda Difesa, senza percentuali), poi chi protegge.
 * `taken`: per membro e tipo il danno subito (0–100), dal Riassunto.
 */
export function CoreTip({ core, taken }: { core: Core; taken: Record<string, Record<string, number>> }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <div className="core-tip-head">
        <em className="core-tip-tag">{t('sum.link.core')}</em>
        <b>{coreTitle(core, lang)}</b>
      </div>
      {core.sides.map(side => {
        const pct = taken[side.from]?.[side.type];
        const band = pct === undefined ? null : holdBand(pct / 100);
        return (
          <div key={side.from} className="core-tip-side">
            <span className="ctip-plinth good"><Sprite species={side.from} size={40} /></span>
            <span className="core-tip-what">
              <b>{side.from}</b>
              <span className="core-tip-type" style={{ '--mc': typeColor(side.type) } as CSSProperties}>
                <img src={typeIconUrl(side.type)} alt="" draggable={false} />{t('coreTip.holds', { type: typeName(side.type, lang) })}
              </span>
            </span>
            {band && <span className={`ftip-ko def ${band}`}>{HOLD_BANDS[band].tag}</span>}
            <span className="core-tip-for">
              <small>{t('coreTip.for')}</small>
              <Sprite species={side.to} size={30} />
            </span>
          </div>
        );
      })}
      <p className="ftip-foot">{t('coreTip.foot')}</p>
    </>
  );
}
