import { signed } from '../../i18n';
import type { TeamDefense } from '../../engine/defense';
import { FLIP_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { battleSpecies } from '../../engine/dex';
import { PokemonIcon } from '../PokemonName';
import { TypeIcons } from '../typeIcons';
import { useLang, useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { rocksHalvedText, sourceName } from './DefenseGeneral';
import { AreaHero, HeroCount } from '../AreaHero';

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
  const cards = useMediaQuery(FLIP_TABLES_QUERY);
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

  if (cards) {
    // Telefono e tablet: in cima la risposta del team (quanti si curano, quanti perdono PS a Levitoroccia e quanto in
    // media); poi un membro per riga: sprite, nome, il valore, la barra del netto e solo le fonti vere come pillole (il
    // "½" detto a parole: perché il danno di Levitoroccia è a metà)
    const ms = defense.members;
    const heal = ms.filter(m => m.sustainParts.recovery > 0).length;
    const hurt = ms.filter(m => m.sustainParts.rocks > 0);
    const avgRocks = hurt.length ? hurt.reduce((s, m) => s + m.sustainParts.rocks, 0) / hurt.length : 0;
    // Chi toglie gli hazard vale per tutto il team: detto una volta in cima, sui membri solo "metà danno"
    const halvedTexts = [...new Set(hurt.map(m => (m.sustainParts.rocksHalvedBy ? rocksHalvedText(t, m.sustainParts.rocksHalvedBy, lang) : '')).filter(Boolean))];
    const teamHalved = halvedTexts.length === 1 ? halvedTexts[0] : null;
    return (
      <div className="def-sus og-cards-frame sus-cards-frame">
        <AreaHero label={t('ddetail.sus.team')}>
          <HeroCount n={heal} of={ms.length} tone="plain">{t('ddetail.sus.healers')}</HeroCount>
          {hurt.length > 0 && <p className="sus-hero-rocks">{t('ddetail.sus.rocksTeam', { n: hurt.length, pct: pct(avgRocks) })}{teamHalved && <><br />{teamHalved}</>}</p>}
        </AreaHero>
        <ul className="sus-cards" aria-label={t('detail.member')}>
          {ms.map((m, i) => {
            const p = m.sustainParts;
            const halvedBy = p.rocksHalvedBy ? rocksHalvedText(t, p.rocksHalvedBy, lang) : null;
            const net = p.recovery - p.rocks - p.itemLoss;
            const set = setOf(ctx.team, m.species);
            return (
              <li key={`${m.species}-${i}`} className="sus-card">
                <span className="sus-card-head">
                  <PokemonIcon name={m.species} />
                  <span className="sus-card-name">{m.species}</span>
                  {set && <TypeIcons types={battleSpecies(set)?.types ?? []} className="sus-card-types" />}
                  <span className={`ct-pill ${m.sustain < 0 ? 'bad' : tone(m.sustain)}`} aria-label={`${t('ddetail.sustain')} ${signed(m.sustain)}`}>{signed(m.sustain)}</span>
                </span>
                <span className="sus-card-net"><small>{t('ddetail.sus.net')}</small>{netBar(net)}</span>
                <span className="sus-card-pills">
                  {p.recovery > 0 && <span className="sus-pill good"><b>+{pct(p.recovery)}</b>{p.sources.map(x => sourceName(x, lang)).join(' + ')}{p.halved && <em title={t('ddetail.halvedTip')}> · {t('ddetail.halved')}</em>}</span>}
                  {p.rocks > 0 && <span className="sus-pill bad"><b>−{pct(p.rocks)}</b>{t('ddetail.sus.rocks')}{halvedBy && <em> · {teamHalved ? t('ddetail.sus.half') : halvedBy}</em>}</span>}
                  {p.itemLoss > 0 && <span className="sus-pill bad"><b>−{pct(p.itemLoss)}</b>{p.itemLossFrom ? sourceName(p.itemLossFrom, lang) : t('ddetail.sus.orb')}</span>}
                  {p.recovery === 0 && p.rocks === 0 && p.itemLoss === 0 && <span className="sus-pill">{t('ddetail.sus.nothing')}</span>}
                </span>
              </li>
            );
          })}
        </ul>
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
