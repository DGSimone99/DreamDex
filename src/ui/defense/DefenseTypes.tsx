import { useState } from 'react';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import type { TypeName } from '../../engine/types';
import { weatherMitigations } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { formatMultiplier, mitigationNote } from '../AnalysisTables';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from './MemberMon';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';
import { HOLD_BANDS, HOLD_ORDER } from './holds';

/** Colore di una percentuale: verde da 80, giallo da 50, rosso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');
/** Quanti membri reggono del tutto il tipo: 0 rosso, 1 giallo, da 2 verde. */
const countTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

/**
 * Coverage tipi della Difesa: un membro per riga (nello stesso punto delle altre schede), i 18 tipi in colonna. In ogni
 * casella il danno di un colpo forte di quel tipo sul lato peggiore (fisico o speciale), colorato per quanti colpi regge
 * (OHKO, 2HKO, 3HKO, 4 o più), col moltiplicatore classico piccolo in un angolo; il suggerimento dà i due lati.
 * A destra quanto regge il membro; in fondo Lo reggono (chi regge del tutto il lato peggiore) e la Copertura del tipo.
 * I tipi che nessuno regge hanno il filo rosso sotto l'icona.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const { rows, weak } = defense.coverageTypes;
  const multipliers = new Map(analysis.weakness.map(row => [row.type, row.multipliers]));
  // Il membro del motore per ogni posto del team (i Pokémon sconosciuti non ci sono)
  let next = 0;
  const slots = team.map(set => {
    const name = battleSpecies(set)?.name;
    if (!name || defense.typed[next]?.species !== name) return null;
    return next++;
  });
  /** Classi di una cella della colonna `col`: il puntatore accende riga e colonna. */
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="def-col-mon" />{rows.map(row => <col key={row.type} />)}<col className="ht-col-side" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {rows.map((row, i) => {
                const hole = weak.includes(row.type);
                return (
                  <th key={row.type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')} title={typeName(row.type as TypeName, lang)}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(row.type as TypeName, lang)}{hole && ` ${t('analysis.shortfallSerious')}`}</span>
                  </th>
                );
              })}
              <th scope="col" className="ht-side-h">{t('ddetail.holdCol')}</th>
            </tr>
          </thead>
          <tbody>
            {team.map((set, member) => {
              const s = slots[member];
              const typed = s === null ? null : defense.typed[s];
              const m = s === null ? null : defense.members[s];
              return (
                <tr key={member} className={hover?.row === member ? 'x-row' : undefined}>
                  <th scope="row"><MemberMon name={battleName(set)} set={set} stats /></th>
                  {rows.map((row, i) => {
                    const cell = typed?.cells[i];
                    if (!cell) return <td key={row.type} className={colClass(i, 'rob-cell ht-cell hold-none')}>—</td>;
                    const band = HOLD_BANDS[cell.band];
                    const mult = formatMultiplier(multipliers.get(row.type as TypeName)?.[member] ?? 1);
                    return (
                      <td key={row.type} className={colClass(i, `rob-cell ht-cell ${band.cls}`)} onMouseEnter={() => setHover({ row: member, col: i })}
                        title={`${typeName(row.type as TypeName, lang)}: ${band.tag} · ${t('ddetail.sides', { p: cell.physical, s: cell.special })}`}>
                        <span className="hold-pct">{cell.pct}%</span>
                        <span className="visually-hidden"> {band.tag}</span>
                        {mult && <small className="ct-mult" aria-hidden="true">{mult}</small>}
                      </td>
                    );
                  })}
                  <td className="ht-side">{m ? <span className={`ct-pill ${tone(m.hold)}`}>{m.hold}%</span> : '—'}</td>
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('ddetail.heldBy')}</th>
              {rows.map((row, i) => <td key={row.type} className={colClass(i)}><span className={`ct-pill ${countTone(row.heldBy.length)}`}>{row.heldBy.length}</span></td>)}
              <td />
            </tr>
            <tr className="ct-sum">
              <th scope="row">{t('ddetail.level')}</th>
              {rows.map((row, i) => <td key={row.type} className={colClass(i)}><span className={`ct-pill ${tone(row.level)}`}>{row.level}%</span></td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rob-legend" aria-hidden="true">
        <span>{t('ddetail.holdLegend')}</span>
        {HOLD_ORDER.map(b => <span key={b} className={`hold-chip ${HOLD_BANDS[b].cls}`}>{HOLD_BANDS[b].tag}</span>)}
        <span className="ht-mult-note">{t('ddetail.multNote')}</span>
      </p>
      {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m, lang)} /></p>)}
    </div>
  );
}
