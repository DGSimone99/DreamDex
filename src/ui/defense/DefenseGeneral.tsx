import type { ReactNode } from 'react';
import type { HoldBand, SustainParts, TeamDefense } from '../../engine/defense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { TypeIcons } from '../typeIcons';
import { TYPES } from '../../engine/types';
import { HOLD_BANDS } from './holds';

/** Il colore di una barra dal valore: buono da 80, medio da 50, scarso sotto. */
export const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/** Sotto questo valore il membro con la Difesa più bassa è l'anello debole. */
const WEAK_LINK_BELOW = 50;

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

/** Le due colonne in più a squadra chiusa: il colpo di tipo che fa più male al membro e come recupera. */
function WorstAndRecovery({ hit, parts }: { hit: { type: string; pct: number; band: HoldBand } | null; parts: SustainParts }) {
  const t = useT();
  const lang = useLang();
  const hold = hit ? HOLD_BANDS[hit.band] : undefined;
  return (
    <>
      <td>
        {hit && hold && (
          <span className="def-hit">
            <TypeIcons types={[hit.type]} title={typeName(hit.type, lang)} />
            <span className={`hold-chip ${hold.cls}`} title={`${typeName(hit.type, lang)}: ${hold.tag}`}>{hit.pct}%<span className="visually-hidden"> {typeName(hit.type, lang)} {hold.tag}</span></span>
          </span>
        )}
      </td>
      <td className="def-rec">
        <span>{parts.sources.length ? parts.sources.join(' + ') : '—'}</span>
        {parts.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
      </td>
    </>
  );
}

/**
 * La scheda Generale della Difesa: i membri con una colonna per voce (Regge i tipi, Regge il meta, Sostenibilità) e la
 * Difesa del membro coi pesi della squadra. In fondo la riga Team Coverage, come nell'Offesa: i voti della squadra.
 * Le righe stanno nella cornice comune (`def-frame`): i membri restano nello stesso punto di Coverage tipi.
 * Con la squadra chiusa (`ctx.roomy`) le righe si allungano e compaiono il colpo peggiore e il recupero.
 */
export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { members } = defense;
  const roomy = !!ctx.roomy;
  // La colonna Difesa riserva il posto del "+N" se almeno un membro ha un setup difensivo
  const setupColumn = members.some(m => m.setupGain > 0 && !!m.setupMove);

  // L'anello debole: la Difesa più bassa (a parità, il primo), solo se sotto soglia
  const lowest = members.reduce((best, m, i) => (m.value < members[best].value ? i : best), 0);
  const weakLink = members.length > 0 && members[lowest].value < WEAK_LINK_BELOW ? lowest : -1;

  // Squadra chiusa: il colpo di tipo che fa più male a ogni membro (a parità, il primo tipo)
  const worstHit = (i: number) => (defense.typed[i]?.cells ?? []).reduce<{ type: string; pct: number; band: HoldBand } | null>(
    (best, cell, k) => (!best || cell.pct > best.pct ? { type: TYPES[k], pct: cell.pct, band: cell.band } : best), null);

  return (
    <div className={`def-frame def-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid def-members">
          {/* Larghezze fisse: i nomi in una colonna, le quattro barre in colonne uguali */}
          <colgroup>
            <col className="def-col-mon" /><col />{meta && <col />}<col /><col />
            {roomy && <><col className="def-col-hit" /><col className="def-col-rec" /></>}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('ddetail.holdTypes')}</th>
              {meta && <th scope="col">{t('ddetail.holdMeta')}</th>}
              <th scope="col">{t('ddetail.sustain')}</th>
              <th scope="col">{t('area.defense')}</th>
              {roomy && <><th scope="col">{t('ddetail.worstHit')}</th><th scope="col">{t('ddetail.recoveryCol')}</th></>}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row">
                  <MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats>
                    {i === weakLink && <span className="def-weak">{t('ddetail.weakLink')}</span>}
                  </MemberMon>
                </th>
                {/* Quanti colpi di tipo regge (i due lati nel suggerimento) e quante minacce del meta */}
                <td title={t('ddetail.sides', { p: m.physical, s: m.special })}><Bar value={m.hold} unit="%" /></td>
                {meta && <td><Bar value={m.metaHold ?? 0} unit="%" /></td>}
                <td><Bar value={m.sustain} /></td>
                <td>
                  {/* Quanto aggiunge il setup difensivo (tre quarti del guadagno entrano nel voto) */}
                  <Bar value={m.value} total reserve={setupColumn}
                    gain={m.setupGain > 0 && m.setupMove && <small className="ad-gain" title={t('ddetail.withSetup', { move: gameName('move', m.setupMove, lang) })}> (+{m.setupGain})</small>} />
                </td>
                {roomy && <WorstAndRecovery hit={worstHit(i)} parts={m.sustainParts} />}
              </tr>
            ))}
          </tbody>
          {/* In fondo la squadra intera, come la riga Team Coverage dell'Offesa: i voti delle sottoschede e la Difesa */}
          <tfoot>
            <tr className="og-total">
              <th scope="row">{t('odetail.gen.total')}</th>
              <td><Bar value={defense.coverageTypes.value} total /></td>
              {meta && <td><Bar value={defense.coverageMeta?.value ?? 0} total /></td>}
              <td><Bar value={defense.sustain} total /></td>
              <td><Bar value={defense.value} total reserve={setupColumn} /></td>
              {roomy && <><td /><td /></>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
