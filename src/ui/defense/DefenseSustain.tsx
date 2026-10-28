import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from './MemberMon';

const pct = (x: number) => `${Math.round(100 * x)}%`;
/** Larghezza della barra del recupero: 50% = barra piena. */
const half = (x: number) => `${Math.min(100, Math.round(200 * x))}%`;
/** Colore del valore, come le barre di Generale: verde da 80, giallo da 50, rosso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/**
 * La Sostenibilità, nella cornice comune (i membri nello stesso punto delle altre schede). Per ogni membro quello che perde,
 * a parte Stealth Rock (a ogni ingresso, dimezzata se il team toglie gli hazard) e Life Orb (a ogni attacco), e quello che
 * recupera con le fonti; in fondo il valore in pastiglia.
 */
export function DefenseSustain({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const loss = (x: number, note?: string | null) => (x > 0
    ? <span className={`sus-loss-val${note ? ' halved' : ''}`} title={note ?? undefined}>−{pct(x)}{note && <sup aria-hidden="true">½</sup>}{note && <span className="visually-hidden"> {note}</span>}</span>
    : <span className="sus-none" aria-label="0">—</span>);
  return (
    <div className={`def-frame def-sus${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid sus-table">
          <colgroup><col className="def-col-mon" /><col className="sus-col-loss" /><col className="sus-col-loss" /><col /><col className="sus-col-val" /></colgroup>
          <thead>
            <tr className="rob-grp">
              <th scope="col" rowSpan={2} className="def-mon-h">{t('detail.member')}</th>
              <th scope="colgroup" colSpan={2}>{t('ddetail.sus.loss')}</th>
              <th scope="col" rowSpan={2} className="sus-h">{t('ddetail.sus.gain')}</th>
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
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><MemberMon name={m.species} /></th>
                  <td className="sus-loss">{loss(p.rocks, halvedBy)}</td>
                  <td className="sus-loss">{loss(p.lifeOrb)}</td>
                  <td className="sus-gain">
                    <div className="sus-flex">
                      <span className="sus-track" aria-hidden="true"><i style={{ width: half(p.recovery) }} /></span>
                      {p.recovery > 0
                        ? <span className="sus-num good">+{pct(p.recovery)}</span>
                        : <span className="sus-none" aria-label="0">—</span>}
                      {p.sources.length > 0 && <small className="ad-src" title={p.sources.join(' + ')}><b>{p.sources.join(' + ')}</b></small>}
                      {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
                    </div>
                  </td>
                  <td className="sus-val"><span className={`ct-pill ${tone(m.sustain)}`}>{m.sustain}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
