import type { Core } from '../../engine/cores';
import { holdBand } from '../../engine/defense';
import { useT } from '../../i18n/react';
import { KoBadge } from '../KoBadge';
import { Sprite } from '../Sprite';
import { TipGlyph, TipHead, TipRow, TipRows, TipSec, TipType } from '../TipHead';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { useLang } from '../../i18n/react';
import { coreTitle } from './CoreTriangle';

/**
 * I lati di un core come righe (TipRow), le stesse nel tooltip del core e nel "+N" delle Sinergie: la sprite da 40 di chi
 * para, il nome, sotto "para" con la tessera e il nome del tipo (in Text, mai una parola colorata) e per chi lo para; a
 * destra quanto lo regge, come fascia dei colpi (KoBadge, i colori della Difesa, senza percentuali).
 * `taken`: per membro e tipo il danno subito (0–100), dal Riassunto.
 */
export function CoreSideRows({ core, taken }: { core: Core; taken: Record<string, Record<string, number>> }) {
  const t = useT();
  // "para {type}": la parola prima e dopo il tipo, che in mezzo è la tessera col nome
  const [before, after] = t('coreTip.holds', { type: '\u0000' }).split('\u0000');
  return (
    <TipRows className="core-tip-rows">
      {core.sides.map(side => {
        const pct = taken[side.from]?.[side.type];
        const band = pct === undefined ? null : holdBand(pct / 100);
        return (
          <TipRow key={`${side.from}>${side.to}`} lead={<Sprite species={side.from} size={SPRITE_TIP_ROW} />} title={side.from}
            sub={(
              <span className="core-tip-type">
                {before}<TipType type={side.type} />{after}
                <span className="core-tip-for">{t('coreTip.for')} {side.to}</span>
              </span>
            )}
            value={band ? <KoBadge side="def" band={band} /> : undefined} />
        );
      })}
    </TipRows>
  );
}

/**
 * Il tooltip di un core a tre: la testata unica (scudo, i tipi del core, sotto cosa misura la fascia; a destra "Core"),
 * poi una riga per lato (CoreSideRows).
 */
export function CoreTip({ core, taken }: { core: Core; taken: Record<string, Record<string, number>> }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <TipHead lead={<TipGlyph icon="shield" />} title={coreTitle(core, lang)} sub={t('coreTip.foot')}
        badge={<span className="tip-kind">{t('sum.link.core')}</span>} />
      <TipSec>
        <CoreSideRows core={core} taken={taken} />
      </TipSec>
    </>
  );
}
