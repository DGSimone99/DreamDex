import type { ReactNode } from 'react';
import { holdBand, type SustainParts, type TeamDefense } from '../../engine/defense';
import { defenseShares } from '../../engine/defenseShares';
import { useLang, useT } from '../../i18n/react';
import { gameName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { TYPES } from '../../engine/types';
import { HoldBars, metaHolds, teamHolds, typeHolds, TypeAttackers, WorstHits, worstOf } from './HoldBars';
import { Ask, MetaTargets } from '../offense/TargetsTip';
import { DEFAULT_FORMAT } from '../../engine/format';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { typeColor } from '../Sprite';
import { effLabel } from '../effTag';
import { DefenseHitTip } from './DefenseTypes';
import { ThreatHitTip } from './DefenseMeta';

/** Il colore di una barra dal valore: buono da 80, medio da 50, scarso sotto. */
export const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/**
 * Una barra con il numero accanto (0-100), del colore della soglia del valore.
 * `gain`: il "+N" (setup, Tera, mossa Z) in un posto suo dopo il numero, così non sborda nella colonna dopo.
 * `reserve`: il posto c'è anche senza "+N", per tutta la colonna, così le barre della colonna restano lunghe uguali.
 */
/** `extra`: un guadagno possibile (il setup) disegnato a righe dopo la barra, staccato da una riga scura. */
export function Bar({ value, total, unit = '', gain, reserve = false, extra = 0, extraTitle }: { value: number; total?: boolean; unit?: string; gain?: ReactNode; reserve?: boolean; extra?: number; extraTitle?: string }) {
  const slot = reserve || !!gain;
  const base = Math.max(0, Math.min(100, value));
  const more = Math.max(0, Math.min(100 - base, extra));
  return (
    <span className={`def-cell${slot ? ' with-gain' : ''}`}>
      <span className={`def-bar ${tone(value)}${total ? ' total' : ''}`} aria-hidden="true"><i style={{ width: `${base}%` }} />{more > 0 && <i className="def-bar-extra" title={extraTitle} style={{ left: `${base}%`, width: `${more}%` }} />}</span>
      <span className={`def-num ${tone(value)}${total ? ' total' : ''}`}>{value}{unit}</span>
      {slot && <span className="def-gain">{gain}</span>}
    </span>
  );
}

/** Un numero con segno: "+47", "−25", "0" (il meno tipografico). */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * La Sostenibilità (−100..100) nella Generale: solo il numero con segno (verde-giallo-rosso sopra zero, rosso sotto), e
 * accanto, se c'è, da dove recupera; a squadra chiusa anche le perdite che non sono Stealth Rock.
 */
export function SustainNum({ value, parts, roomy = false, total = false }: { value: number; parts?: SustainParts; roomy?: boolean; total?: boolean }) {
  const cls = value > 0 ? tone(value) : value < 0 ? 'bad' : 'zero';
  return (
    <span className={`dg-sus${total ? ' total' : ''}`}>
      <span className={`def-num total ${cls}`}>{signed(value)}</span>
      {parts && <SustainNote parts={parts} roomy={roomy} />}
    </span>
  );
}

/**
 * La scheda Generale della Difesa: i membri con una colonna per voce (Regge i tipi, Regge il meta, Sostenibilità) e la
 * Difesa del membro coi pesi della squadra. In fondo la riga Team Coverage, come nell'Offesa: i voti della squadra.
 * Le righe stanno nella cornice comune (`def-frame`): i membri restano nello stesso punto di Coverage tipi.
 * Con la squadra chiusa (`ctx.roomy`) le righe si allungano: sotto Tipi e Meta i tre colpi peggiori, sotto Sostenibilità
 * come recupera.
 */
/**
 * Quanto porta un membro alla Difesa del team, come nell'Offesa: in tenue la Difesa del team divisa nei pezzi dei membri,
 * uno dopo l'altro nell'ordine delle righe, il pezzo del membro acceso al suo posto; il numero sono i suoi punti (sotto
 * zero, in rosso, se toglie: la sua Sostenibilità è negativa e pesa più di quello che regge).
 */
function DefShare({ points, from, team }: { points: number; from: number; team: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <span className="def-cell">
      <span className="def-bar og-share-bar" aria-hidden="true">
        <i className="og-share-team" style={{ width: `${clamp(team)}%` }} />
        {points > 0 && <i className="og-share-own" style={{ left: `${clamp(from)}%`, width: `${clamp(Math.min(points, 100 - from))}%` }} />}
      </span>
      <span className={`def-num total og-share-num${points < 0 ? ' neg' : ''}`}>{points < 0 ? `−${-points}` : `+${points}`}</span>
    </span>
  );
}

/** Sotto la Sostenibilità (squadra chiusa): il recupero, poi le perdite in rosso ("Life Orb −10%"), senza Stealth Rock. */
function SustainNote({ parts, roomy }: { parts: SustainParts; roomy: boolean }) {
  const t = useT();
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  // Stealth Rock c'è quasi sempre: qui solo le altre perdite (strumenti, contraccolpo, sabbia), il dettaglio è nella sottoscheda
  const losses = [roomy && parts.itemLoss > 0 ? `${parts.itemLossFrom ?? t('ddetail.sus.orb')} −${pct(parts.itemLoss)}` : null]
    .filter((x): x is string => !!x);
  const gain = parts.sources.length ? parts.sources.join(' + ') : null;
  if (!gain && !losses.length) return null;
  const full = [gain, ...losses].filter(Boolean).join(' · ');
  return (
    <span className="dg-rec" title={full}>
      {gain}
      {parts.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
      {losses.map((l, k) => <span key={k} className="dg-loss">{(gain || k > 0) && ' · '}{l}</span>)}
    </span>
  );
}

export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { members } = defense;
  const roomy = !!ctx.roomy;
  // Quanto porta ogni membro alla Difesa del team, e dove comincia il suo pezzo nella barra (i punti delle righe sopra)
  const shares = defenseShares(defense);
  const shareFrom = shares.map((_, i) => Math.max(0, shares.slice(0, i).reduce((a, b) => a + Math.max(0, b), 0)));

  // Le barre a pezzi di Tipi e Meta: le fasce di ogni membro, e del team (il membro che regge meglio ogni bersaglio)
  const metaRows = defense.coverageMeta?.rows ?? [];
  const typeBars = members.map((_, i) => typeHolds(defense.typed[i]?.cells ?? []));
  const metaBars = members.map(m => metaHolds(metaRows, m.species));
  const metaSpecies = [...metaRows].sort((x, y) => y.weight - x.weight).map(r => r.species);
  const ofTypes = t('kob.ofTypes');
  const ofMeta = t('kob.ofMeta', { n: metaRows.length });
  const teamName = t('odetail.gen.total');

  // Squadra chiusa: sotto le barre i tre colpi che fanno più male (tipi: il lato peggiore; meta: chi lo manda KO in un
  // colpo prima, dalla minaccia più usata, poi dal danno più alto), col tooltip delle caselle di Coverage tipi e meta
  const slotOf = (i: number) => ctx.team.findIndex(set => battleName(set) === members[i].species);
  const multipliers = new Map(ctx.analysis.weakness.map(row => [row.type, row.multipliers]));
  const worstTypes = (i: number) => worstOf((defense.typed[i]?.cells ?? []).map((c, k) => ({ label: TYPES[k], kind: 'type' as const, pct: c.pct, band: c.band, cell: c })))
    .map(h => ({ ...h, color: typeColor(h.label),
      tip: <DefenseHitTip type={h.label} species={members[i].species} cell={h.cell} mult={effLabel(multipliers.get(h.label as TypeName)?.[slotOf(i)] ?? 1, 'defense')} /> }));
  const byUse = [...metaRows].sort((x, y) => y.weight - x.weight);
  const worstMeta = (i: number) => worstOf(byUse.map(row => {
    const h = row.heldBy.find(x => x.species === members[i].species);
    return { label: row.species, kind: 'mon' as const, pct: h ? h.pct : null, band: h ? holdBand(h.pct / 100) : 'ohko' as const, row, h };
  })).map(x => ({ ...x, color: typeColor((battleSpecies(x.row.set)?.types[0] as string | undefined) ?? ''),
    tip: <ThreatHitTip row={x.row} name={members[i].species} hit={x.h ?? 'ko'} mult={effLabel(x.row.mults?.[i], 'defense')} koMove={x.row.hits?.[i]?.move} /> }));


  return (
    <div className={`def-frame def-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid def-members">
          {/* Come l'Offesa: i nomi in una colonna, poi Tipi, Meta e l'ultima in colonne uguali; nell'ultima Sostenibilità e
              Difesa affiancate, così Tipi e Meta stanno nello stesso posto e larghi uguali */}
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('kob.headTypes')}<Ask label={t('hold.attackersTitle')}><TypeAttackers formatId={ctx.formatId ?? DEFAULT_FORMAT.formatId} /></Ask></th>
              {meta && <th scope="col">{t('kob.headMeta')}<Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })}><MetaTargets species={metaSpecies} /></Ask></th>}
              <th scope="col" className="dg-pair-h"><span className="dg-pair"><span>{t('ddetail.sustain')}</span><span>{t('area.defense')}</span></span></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row">
                  <MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats />
                </th>
                {/* Quanti colpi di tipo regge (i due lati nel suggerimento) e quante minacce del meta */}
                <td><HoldBars targets={typeBars[i]} who={m.species} of={ofTypes} />{roomy && <WorstHits hits={worstTypes(i)} />}</td>
                {meta && <td><HoldBars targets={metaBars[i]} who={m.species} of={ofMeta} />{roomy && <WorstHits hits={worstMeta(i)} />}</td>}
                <td>
                  <span className="dg-pair">
                    <span>
                      {/* Il numero e da dove recupera (a squadra chiusa anche le altre perdite) */}
                      <SustainNum value={m.sustain} parts={m.sustainParts} roomy={roomy} />
                    </span>
                    {/* Quanto porta alla Difesa del team: i punti dei membri sommati fanno la Difesa del team */}
                    <span className="og-share" title={t('ddetail.shareTitle', { n: shares[i] < 0 ? `−${-shares[i]}` : `+${shares[i]}` })}><DefShare points={shares[i]} from={shareFrom[i]} team={defense.value} /></span>
                  </span>
                </td>
              </tr>
            ))}
            {/* Riempie lo spazio che resta: la riga Team Coverage sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={3 + (meta ? 1 : 0)} /></tr>
          </tbody>
          {/* In fondo la squadra intera, come la riga Team Coverage dell'Offesa: i voti delle sottoschede e la Difesa */}
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{t('odetail.gen.total')}</span></th>
              <td><HoldBars targets={teamHolds(typeBars)} who={teamName} of={ofTypes} alarm /></td>
              {meta && <td><HoldBars targets={teamHolds(metaBars)} who={teamName} of={ofMeta} alarm /></td>}
              <td><span className="dg-pair"><SustainNum value={defense.sustain} total /><Bar value={defense.value} total /></span></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* I colori dei pezzi di Tipi e Meta (nei pezzi c'è solo il numero, la colonna è stretta) */}
      <div className="rob-legend og-legend" aria-hidden="true"><span className="area-legend">
        <span className="area-legend-swatch"><i className="hb-sw hb-held" />{t('hold.held')}</span>
        <span className="area-legend-swatch"><i className="hb-sw hb-2" />2HKO</span>
        <span className="area-legend-swatch"><i className="hb-sw hb-ohko" />OHKO</span>
      </span></div>
    </div>
  );
}
