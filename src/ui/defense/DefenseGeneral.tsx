import type { CSSProperties, ReactNode } from 'react';
import { holdBand, type SustainParts, type TeamDefense } from '../../engine/defense';
import { defenseShares, type DefenseShare } from '../../engine/defenseShares';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { useLang, useT } from '../../i18n/react';
import { gameName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { TYPES } from '../../engine/types';
import { HoldBars, metaHolds, teamHolds, typeHolds, TypeAttackers, WorstHits, worstOf } from './HoldBars';
import { Ask, MetaTargets } from '../offense/TargetsTip';
import { DEFAULT_FORMAT } from '../../engine/format';
import { battleName, battleSpecies, getMove, toID } from '../../engine/dex';
import type { TeamSet } from '../../engine/sets';
import { ItemIcon } from '../ItemIcon';
import { typeIconUrl } from '../typeIcons';
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

/** Le perdite e il recupero di un membro in una riga: "Recover + Leftovers · Stealth Rock −6%". */
function sustainLine(parts: SustainParts, rocksLabel: string, itemLabel: string): string {
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  return [parts.sources.join(' + '), parts.rocks > 0 ? `${rocksLabel} −${pct(parts.rocks)}` : '', parts.itemLoss > 0 ? `${parts.itemLossFrom ?? itemLabel} −${pct(parts.itemLoss)}` : '']
    .filter(Boolean).join(' · ');
}

/**
 * Il tooltip di quanto porta un membro (o il team) alla Difesa: i tre pezzi, Coverage tipi, Coverage meta e
 * Sostenibilità, con sotto la Sostenibilità il suo valore e da dove viene.
 */
function ShareTip({ who, share, sustain, line, meta, total = false }: { who: string; share: DefenseShare; sustain: number; line: string; meta: boolean; total?: boolean }) {
  const t = useT();
  return (
    <>
      <div className="ftip-head"><b>{who}</b><span className={`dsh-total${share.points < 0 ? ' neg' : ''}`}>{total ? share.points : signed(share.points)}</span></div>
      <div className="dsh-rows">
        <span className="dsh-row"><i className="dsh-sw cover" />{t('detail.coverageTypes')}<b>{signed(share.types)}</b></span>
        {meta && <span className="dsh-row"><i className="dsh-sw cover" />{t('detail.coverageMeta')}<b>{signed(share.meta)}</b></span>}
        <span className="dsh-row"><i className={`dsh-sw ${share.sustain < 0 ? 'loss' : 'gain'}`} />{t('ddetail.sustain')} <small>{signed(sustain)}</small><b>{signed(share.sustain)}</b></span>
        {line && <span className="dsh-line">{line}</span>}
      </div>
    </>
  );
}

/**
 * Quanto porta un membro alla Difesa del team, come nell'Offesa: in tenue la Difesa del team divisa nei pezzi dei membri,
 * uno dopo l'altro nell'ordine delle righe; il pezzo del membro acceso al suo posto, in due parti: quello che regge (tipi
 * e meta, nel colore dell'Offesa) e la Sostenibilità, verde se aggiunge, rossa se toglie (la parte che si mangia). Il
 * numero sono i suoi punti; passandoci sopra il tooltip coi pezzi.
 */
function DefShare({ share, from, team, tip }: { share: DefenseShare; from: number; team: number; tip: ReactNode }) {
  const float = useFloatAnchor<true>();
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const cover = Math.max(0, share.types + share.meta);
  const lit = share.sustain >= 0 ? cover : Math.max(0, cover + share.sustain);
  const side = share.sustain >= 0 ? share.sustain : Math.min(cover, -share.sustain);
  return (
    <span className="def-cell dsh" onMouseEnter={e => float.open(true, e.currentTarget)} onMouseLeave={float.close}>
      <span className="def-bar og-share-bar" aria-hidden="true">
        <i className="og-share-team" style={{ width: `${clamp(team)}%` }} />
        {lit > 0 && <i className="og-share-own" style={{ left: `${clamp(from)}%`, width: `${clamp(Math.min(lit, 100 - from))}%` }} />}
        {side > 0 && <i className={`dsh-sus ${share.sustain >= 0 ? 'gain' : 'loss'}`} style={{ left: `${clamp(from + lit)}%`, width: `${clamp(Math.min(side, 100 - from - lit))}%` }} />}
      </span>
      <span className={`def-num total og-share-num${share.points < 0 ? ' neg' : ''}`}>{signed(share.points)}</span>
      {float.anchor && <FloatTip rect={float.anchor.rect} tone="var(--accent)" className="dsh-tip">{tip}</FloatTip>}
    </span>
  );
}

/**
 * A squadra chiusa, sotto la barra Difesa: la Sostenibilità come le mosse dell'Offesa. In verde da dove recupera (la
 * mossa con l'icona del suo tipo, lo strumento con la sua icona, l'abilità), in rosso le perdite col loro % (Stealth
 * Rock con l'icona Roccia, lo strumento o la mossa che costa PS). Il nome intero nel suggerimento.
 */
function SustainChips({ parts, set }: { parts: SustainParts; set: TeamSet | undefined }) {
  const lang = useLang();
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  const isItem = (name: string) => !!set && toID(name) === toID(set.item);
  // Una fonte: l'icona (tipo della mossa, strumento, Grassy Terrain e sabbia col loro tipo; un pallino per l'abilità) e il nome nella lingua
  const source = (src: string): { icon: ReactNode; name: string } => {
    if (src === 'Grassy Terrain') return { icon: <img src={typeIconUrl('Grass')} alt="" draggable={false} />, name: src };
    if (src === 'Sandstorm') return { icon: <img src={typeIconUrl('Rock')} alt="" draggable={false} />, name: src };
    const move = getMove(src);
    if (move) return { icon: <img src={typeIconUrl(move.type)} alt="" draggable={false} />, name: gameName('move', move.name, lang) };
    if (isItem(src)) return { icon: <ItemIcon item={src} size={16} />, name: gameName('item', src, lang) };
    return { icon: <i className="dsc-ab" aria-hidden="true" />, name: src };
  };
  // Stealth Rock c'è quasi sempre: non qui (è nel tooltip e nella sottoscheda)
  const chips = [
    ...parts.gains.map(g => ({ ...source(g.source), value: `+${pct(g.heal)}`, loss: false })),
    ...parts.losses.map(l => ({ ...source(l.source), value: `−${pct(l.loss)}`, loss: true })),
  ];
  if (!chips.length) return null;
  return (
    <span className="mcs dscs">
      {/* Una pastiglia per fonte: icona, nome e quanto cura (verde) o quanto toglie (rosso) */}
      {chips.map((c, k) => (
        <span key={k} className={`mc dsc${c.loss ? ' loss' : ''}`} style={{ '--c': c.loss ? 'var(--bad)' : 'var(--good)' } as CSSProperties}>
          <span className="dsc-ic">{c.icon}</span>
          <span className="dsc-name">{c.name}</span>
          <b>{c.value}</b>
        </span>
      ))}
    </span>
  );
}

/** La Difesa del team in fondo: la barra in due parti, quello che regge (tipi e meta) e la Sostenibilità (verde o rossa). */
function TeamDefense({ value, sustainPoints, tip }: { value: number; sustainPoints: number; tip: ReactNode }) {
  const float = useFloatAnchor<true>();
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const cover = clamp(value - sustainPoints);
  const lit = sustainPoints >= 0 ? cover : clamp(cover + sustainPoints);
  const side = Math.abs(sustainPoints);
  return (
    <span className="def-cell dsh" onMouseEnter={e => float.open(true, e.currentTarget)} onMouseLeave={float.close}>
      <span className={`def-bar total ${tone(value)}`} aria-hidden="true">
        <i style={{ width: `${lit}%` }} />
        {side > 0 && <i className={`dsh-sus ${sustainPoints >= 0 ? 'gain' : 'loss'}`} style={{ left: `${lit}%`, width: `${clamp(Math.min(side, 100 - lit))}%` }} />}
      </span>
      <span className={`def-num ${tone(value)} total`}>{value}</span>
      {float.anchor && <FloatTip rect={float.anchor.rect} tone="var(--accent)" className="dsh-tip">{tip}</FloatTip>}
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
  // Il pezzo di un membro occupa quello che regge (la parte rossa di chi perde resta dentro)
  const span = (x: DefenseShare) => Math.max(0, x.types + x.meta, x.points);
  const shareFrom = shares.map((_, i) => shares.slice(0, i).reduce((a, b) => a + span(b), 0));
  const teamShare = shares.reduce<DefenseShare>((a, b) => ({ points: a.points + b.points, types: a.types + b.types, meta: a.meta + b.meta, sustain: a.sustain + b.sustain }), { points: 0, types: 0, meta: 0, sustain: 0 });
  const rocksLabel = t('ddetail.sus.rocks');
  const itemLabel = t('ddetail.sus.orb');

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
              <th scope="col">{t('area.defense')}</th>
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
                  {/* Quanto porta alla Difesa del team (sommati fanno la Difesa del team): quello che regge e la Sostenibilità */}
                  <span className="og-share" aria-label={t('ddetail.shareTitle', { n: signed(shares[i].points) })}>
                    <DefShare share={shares[i]} from={shareFrom[i]} team={defense.value}
                      tip={<ShareTip who={m.species} share={shares[i]} sustain={m.sustain} line={sustainLine(m.sustainParts, rocksLabel, itemLabel)} meta={!!defense.coverageMeta} />} />
                  </span>
                  {roomy && <SustainChips parts={m.sustainParts} set={setOf(ctx.team, m.species)} />}
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
              <td><TeamDefense value={defense.value} sustainPoints={teamShare.sustain}
                tip={<ShareTip who={teamName} share={teamShare} sustain={defense.sustain} line={t('ddetail.sus.teamNote')} meta={!!defense.coverageMeta} total />} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* I colori dei pezzi di Tipi e Meta (nei pezzi c'è solo il numero, la colonna è stretta) */}
      <div className="rob-legend og-legend" aria-hidden="true"><span className="area-legend">
        <span className="area-legend-swatch"><i className="hb-sw hb-held" />{t('hold.held')}</span>
        <span className="area-legend-swatch"><i className="hb-sw hb-2" />2HKO</span>
        <span className="area-legend-swatch"><i className="hb-sw hb-ohko" />OHKO</span>
        <span className="area-legend-swatch"><i className="dsh-leg gain" />{t('ddetail.legendRecovery')}</span>
        <span className="area-legend-swatch"><i className="dsh-leg loss" />{t('ddetail.legendLoss')}</span>
      </span></div>
    </div>
  );
}
