import type { ReactNode } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { NARROW_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { useLang, useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { rocksHalvedText, signed, sourceName } from './DefenseGeneral';

const pct = (x: number) => `${Math.round(100 * x)}%`;
/** Metà barra del netto: un netto di ±50% (SUSTAIN_FULL) arriva al bordo. */
const halfBar = (x: number) => `${Math.min(50, Math.round(100 * Math.abs(x)))}%`;
/** Colore del valore, come le barre di Generale: verde da 80, giallo da 50, rosso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/**
 * Il Recupero, nella cornice comune (i membri nello stesso punto delle altre schede). Per ogni membro quello che perde,
 * a parte Stealth Rock (a ogni ingresso, dimezzata se il team toglie gli hazard) e lo strumento (Life Orb, Flame Orb…), e quello che
 * recupera con le fonti, il netto (recupero meno perdite) come barra attorno allo zero e il valore in pastiglia.
 * Niente riga del team: il valore del team è già sull'etichetta della scheda.
 */
export function DefenseSustain({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const narrow = useMediaQuery(NARROW_TABLES_QUERY);
  const loss = (x: number, note?: string | null, halved = true) => (x > 0
    ? <span className="sus-loss-cell" title={note ?? undefined}>
        <span className="sus-loss-val">−{pct(x)}</span>
        {note && halved && <span className="sus-half" aria-hidden="true">½</span>}
        {note && <span className="visually-hidden"> {note}</span>}
      </span>
    : <span className="sus-none" aria-label="0">—</span>);
  /** Il netto (recupero meno perdite): barra attorno allo zero e numero. */
  const netBar = (net: number) => (
    <div className="sus-net-wrap">
      <span className="sus-net-track" aria-hidden="true">
        <i className={net >= 0 ? 'pos' : 'neg'} style={net >= 0 ? { left: '50%', width: halfBar(net) } : { right: '50%', width: halfBar(net) }} />
      </span>
      <b className={`sus-net-num ${net > 0 ? 'good' : net < 0 ? 'bad' : ''}`}>{net > 0 ? '+' : net < 0 ? '−' : ''}{pct(Math.abs(net))}</b>
    </div>
  );
  /** Quello che recupera, con le fonti. */
  const gain = (p: (typeof defense.members)[number]['sustainParts']) => (
    <div className="sus-flex">
      {p.recovery > 0
        ? <span className="sus-num good">+{pct(p.recovery)}</span>
        : <span className="sus-none" aria-label="0">—</span>}
      {p.sources.length > 0 && <small className="ad-src" title={p.sources.map(x => sourceName(x, lang)).join(' + ')}><b>{p.sources.map(x => sourceName(x, lang)).join(' + ')}</b></small>}
      {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
    </div>
  );

  if (narrow) {
    // Telefono e tablet piccolo: per ogni membro il nome e il valore in alto, sotto Perde (Stealth Rock e strumenti),
    // Recupera e Netto, una riga ciascuno con l'etichetta corta a sinistra: niente da scorrere di lato
    const line = (label: string, cell: ReactNode, key: string) => (
      <tr key={key} className="og-bar-row sus-line">
        <th scope="row" className="og-bar-label">{label}</th>
        <td colSpan={2}>{cell}</td>
      </tr>
    );
    return (
      <div className={`def-frame def-sus og-stack${ctx.roomy ? ' roomy' : ''}`}>
        <div className="ad-scroll">
          <table className="def-grid sus-table def-members og-stack-table sus-stack" aria-label={`${t('area.defense')}: ${t('ddetail.sustain')}`}>
            <colgroup><col className="og-col-label sus-col-label" /><col /><col className="og-col-share" /></colgroup>
            <thead>
              <tr>
                <th scope="col" colSpan={2} className="def-mon-h og-stack-head">{t('detail.member')}</th>
                <th scope="col" className="og-share-h">{t('ddetail.sustain')}</th>
              </tr>
            </thead>
            {defense.members.map((m, i) => {
              const p = m.sustainParts;
              const halvedBy = p.rocksHalvedBy ? rocksHalvedText(t, p.rocksHalvedBy, lang) : null;
              const net = p.recovery - p.rocks - p.itemLoss;
              return (
                <tbody key={`${m.species}-${i}`} className="og-stack-mon">
                  <tr className="og-mon-row">
                    <th scope="rowgroup" colSpan={2}><MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats /></th>
                    <td className="sus-val"><span className={`ct-pill ${m.sustain < 0 ? 'bad' : tone(m.sustain)}`}>{signed(m.sustain)}</span></td>
                  </tr>
                  {line(t('ddetail.sus.loss'), (
                    <span className="sus-losses">
                      <span className="sus-loss-item"><small>{t('ddetail.sus.rocks')}</small>{loss(p.rocks, halvedBy)}</span>
                      <span className="sus-loss-item"><small>{t('ddetail.sus.orb')}</small>{loss(p.itemLoss, p.itemLossFrom ? sourceName(p.itemLossFrom, lang) : null, false)}</span>
                    </span>
                  ), 'loss')}
                  {line(t('ddetail.sus.gain'), gain(p), 'gain')}
                  {line(t('ddetail.sus.net'), netBar(net), 'net')}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`def-frame def-sus${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid sus-table def-members" aria-label={`${t('area.defense')}: ${t('ddetail.sustain')}`}>
          <colgroup><col className="def-col-mon" /><col className="sus-col-loss" /><col className="sus-col-loss" /><col /><col className="sus-col-net" /><col className="sus-col-val" /></colgroup>
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
              const halvedBy = p.rocksHalvedBy ? rocksHalvedText(t, p.rocksHalvedBy, lang) : null;
              const net = p.recovery - p.rocks - p.itemLoss;
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats /></th>
                  <td className="sus-loss">{loss(p.rocks, halvedBy)}</td>
                  <td className="sus-loss">{loss(p.itemLoss, p.itemLossFrom ? sourceName(p.itemLossFrom, lang) : null, false)}</td>
                  <td className="sus-gain">
                    <div className="sus-flex">
                      {p.recovery > 0
                        ? <span className="sus-num good">+{pct(p.recovery)}</span>
                        : <span className="sus-none" aria-label="0">—</span>}
                      {p.sources.length > 0 && <small className="ad-src" title={p.sources.map(x => sourceName(x, lang)).join(' + ')}><b>{p.sources.map(x => sourceName(x, lang)).join(' + ')}</b></small>}
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
            {/* Riempie lo spazio che resta: le righe dei membri alte come nelle altre schede (là in fondo c'è la riga del team) */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={6} /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
