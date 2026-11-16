import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { signed } from './DefenseGeneral';

const pct = (x: number) => `${Math.round(100 * x)}%`;
/** Metà barra del netto: un netto di ±50% (SUSTAIN_FULL) arriva al bordo. */
const halfBar = (x: number) => `${Math.min(50, Math.round(100 * Math.abs(x)))}%`;
/** Colore del valore, come le barre di Generale: verde da 80, giallo da 50, rosso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/**
 * La Sostenibilità, nella cornice comune (i membri nello stesso punto delle altre schede). Per ogni membro quello che perde,
 * a parte Stealth Rock (a ogni ingresso, dimezzata se il team toglie gli hazard) e lo strumento (Life Orb, Flame Orb…), e quello che
 * recupera con le fonti, il netto (recupero meno perdite) come barra attorno allo zero e il valore in pastiglia.
 */
export function DefenseSustain({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const loss = (x: number, note?: string | null, halved = true) => (x > 0
    ? <span className="sus-loss-cell" title={note ?? undefined}>
        <span className="sus-loss-val">−{pct(x)}</span>
        {note && halved && <span className="sus-half" aria-hidden="true">½</span>}
        {note && <span className="visually-hidden"> {note}</span>}
      </span>
    : <span className="sus-none" aria-label="0">—</span>);
  return (
    <div className={`def-frame def-sus${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid sus-table">
          <colgroup><col className="def-col-mon" /><col className="sus-col-loss" /><col className="sus-col-loss" /><col className="sus-col-gain" /><col /><col className="sus-col-val" /></colgroup>
          <thead>
            <tr className="rob-grp">
              <th scope="col" rowSpan={2} className="def-mon-h">{t('detail.member')}</th>
              <th scope="colgroup" colSpan={2}>{t('ddetail.sus.loss')}</th>
              <th scope="col" rowSpan={2} className="sus-h">{t('ddetail.sus.gain')}</th>
              <th scope="col" rowSpan={2} className="sus-h sus-c">{t('ddetail.sus.net')}</th>
              <th scope="col" rowSpan={2} className="sus-h sus-r">{t('ddetail.sustain')}</th>
            </tr>
            <tr className="rob-atk sus-sub">
              <th scope="col">{t('ddetail.sus.rocks')}</th>
              <th scope="col">{t('ddetail.sus.orb')}</th>
            </tr>
          </thead>
          <tbody>
            {defense.members.map((m, i) => {
              const p = m.sustainParts;
              const halvedBy = p.rocksHalvedBy ? t('ddetail.sus.rocksHalved', { by: p.rocksHalvedBy }) : null;
              const net = p.recovery - p.rocks - p.itemLoss;
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats /></th>
                  <td className="sus-loss">{loss(p.rocks, halvedBy)}</td>
                  <td className="sus-loss">{loss(p.itemLoss, p.itemLossFrom, false)}</td>
                  <td className="sus-gain">
                    <div className="sus-flex">
                      {p.recovery > 0
                        ? <span className="sus-num good">+{pct(p.recovery)}</span>
                        : <span className="sus-none" aria-label="0">—</span>}
                      {p.sources.length > 0 && <small className="ad-src" title={p.sources.join(' + ')}><b>{p.sources.join(' + ')}</b></small>}
                      {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
                    </div>
                  </td>
                  <td className="sus-net">
                    <div className="sus-net-wrap">
                      <span className="sus-net-track" aria-hidden="true">
                        <i className={net >= 0 ? 'pos' : 'neg'} style={net >= 0 ? { left: '50%', width: halfBar(net) } : { right: '50%', width: halfBar(net) }} />
                      </span>
                      <b className={`sus-net-num ${net > 0 ? 'good' : net < 0 ? 'bad' : ''}`}>{net > 0 ? '+' : net < 0 ? '−' : ''}{pct(Math.abs(net))}</b>
                    </div>
                  </td>
                  <td className="sus-val"><span className={`ct-pill ${m.sustain < 0 ? 'bad' : tone(m.sustain)}`}>{signed(m.sustain)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
