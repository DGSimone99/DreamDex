import { useState } from 'react';
import { weaknessSeverity } from '../../engine/coach';
import { battleName } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import { weatherMitigations } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { formatMultiplier, mitigationNote } from '../AnalysisTables';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from './MemberMon';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';

/** La classe della cella dal moltiplicatore (×1 resta neutro). */
const cellClass = (m: number) => (m === 4 ? 'm-4' : m > 1 ? 'm-2' : m === 0 ? 'm-0' : m <= 0.25 ? 'm-quarter' : m < 1 ? 'm-half' : '');

/** Colore della Sicurezza: rosso sotto 50, giallo sotto 100, verde a 100. */
const safetyTone = (value: number) => (value < 50 ? 'bad' : value < 100 ? 'warn' : 'good');

/**
 * Coverage tipi: la griglia come quella della Panoramica, un membro per riga (nello stesso punto di Generale) e i 18 tipi
 * in colonna, in fondo i totali per tipo (Deboli, Resistono, Sicurezza). "Debole" è sempre `weaknessSeverity`: filo sotto
 * l'icona del tipo e numero rosso nella riga Deboli.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const severities = analysis.weakness.map(weaknessSeverity);
  const safety = new Map(defense.coverageTypes.rows.map(row => [row.type, row.safety]));
  /** Classi di una cella della colonna `col`: il puntatore accende riga e colonna. */
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="def-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {analysis.weakness.map((row, i) => {
                const severity = severities[i];
                return (
                  <th key={row.type} scope="col" className={colClass(i, severity ? `sev-${severity}` : '')} title={typeName(row.type, lang)}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">
                      {typeName(row.type, lang)}{severity && ` ${t(severity === 'serious' ? 'analysis.shortfallSerious' : 'analysis.shortfall')}`}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((set, member) => (
              <tr key={member} className={hover?.row === member ? 'x-row' : undefined}>
                <th scope="row"><MemberMon name={battleName(set)} /></th>
                {analysis.weakness.map((row, i) => {
                  const m = row.multipliers[member];
                  return (
                    <td key={row.type} className={colClass(i, `ct-cell ${cellClass(m)}`)} onMouseEnter={() => setHover({ row: member, col: i })}>
                      {formatMultiplier(m)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('ddetail.weak')}</th>
              {analysis.weakness.map((row, i) => <td key={row.type} className={colClass(i, severities[i] ? 'bad' : '')}>{row.weak}</td>)}
            </tr>
            <tr className="ct-sum">
              <th scope="row">{t('ddetail.resist')}</th>
              {analysis.weakness.map((row, i) => <td key={row.type} className={colClass(i)}>{row.resist}</td>)}
            </tr>
            <tr className="ct-sum">
              <th scope="row">{t('ddetail.safety')}</th>
              {analysis.weakness.map((row, i) => {
                const value = safety.get(row.type) ?? 0;
                return <td key={row.type} className={colClass(i)}><span className={`ct-pill ${safetyTone(value)}`}>{value}%</span></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m, lang)} /></p>)}
    </div>
  );
}
