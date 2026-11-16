import type { ReactNode } from 'react';
import { holdBand, type TeamDefense } from '../../engine/defense';
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

/**
 * La scheda Generale della Difesa: i membri con una colonna per voce (Regge i tipi, Regge il meta, Sostenibilità) e la
 * Difesa del membro coi pesi della squadra. In fondo la riga Team Coverage, come nell'Offesa: i voti della squadra.
 * Le righe stanno nella cornice comune (`def-frame`): i membri restano nello stesso punto di Coverage tipi.
 * Con la squadra chiusa (`ctx.roomy`) le righe si allungano: sotto Tipi e Meta i tre colpi peggiori, sotto Sostenibilità
 * come recupera.
 */
export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { members } = defense;
  const roomy = !!ctx.roomy;
  // La colonna Difesa riserva il posto del "+N" se almeno un membro ha un setup difensivo
  const setupColumn = members.some(m => m.setupGain > 0 && !!m.setupMove);

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
          {/* Larghezze fisse: i nomi in una colonna, le quattro barre in colonne uguali */}
          <colgroup>
            <col className="def-col-mon" /><col className="dg-col-bars" />{meta && <col className="dg-col-bars" />}<col className="dg-col-bar" /><col className="dg-col-bar" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('kob.headTypes')}<Ask label={t('hold.attackersTitle')}><TypeAttackers formatId={ctx.formatId ?? DEFAULT_FORMAT.formatId} /></Ask></th>
              {meta && <th scope="col">{t('kob.headMeta')}<Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })}><MetaTargets species={metaSpecies} /></Ask></th>}
              <th scope="col">{t('ddetail.sustain')}</th>
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
                  <Bar value={m.sustain} />
                  {/* Squadra chiusa: come recupera, sotto la barra */}
                  {roomy && <span className="dg-rec" title={m.sustainParts.sources.join(' + ') || t('ddetail.noRecovery')}>{m.sustainParts.sources.length ? m.sustainParts.sources.join(' + ') : t('ddetail.noRecovery')}
                    {m.sustainParts.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}</span>}
                </td>
                <td>
                  {/* Quanto aggiunge il setup difensivo (tre quarti del guadagno entrano nel voto) */}
                  <Bar value={m.value} total reserve={setupColumn}
                    gain={m.setupGain > 0 && m.setupMove && <small className="ad-gain" title={t('ddetail.withSetup', { move: gameName('move', m.setupMove, lang) })}> (+{m.setupGain})</small>} />
                </td>
              </tr>
            ))}
            {/* Riempie lo spazio che resta: la riga Team Coverage sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={4 + (meta ? 1 : 0)} /></tr>
          </tbody>
          {/* In fondo la squadra intera, come la riga Team Coverage dell'Offesa: i voti delle sottoschede e la Difesa */}
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{t('odetail.gen.total')}</span></th>
              <td><HoldBars targets={teamHolds(typeBars)} who={teamName} of={ofTypes} alarm /></td>
              {meta && <td><HoldBars targets={teamHolds(metaBars)} who={teamName} of={ofMeta} alarm /></td>}
              <td><Bar value={defense.sustain} total /></td>
              <td><Bar value={defense.value} total reserve={setupColumn} /></td>
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
