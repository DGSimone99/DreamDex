import { useState } from 'react';
import { weaknessSeverity } from '../../engine/coach';
import { battleName } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import { weatherMitigations } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { formatMultiplier, mitigationNote } from '../AnalysisTables';
import type { AreaContext } from '../AreaDetail';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';
import { MemberMon } from './MemberMon';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';

/** La classe della cella dal moltiplicatore (×1 resta neutro). */
const cellClass = (m: number) => (m === 4 ? 'm-4' : m > 1 ? 'm-2' : m === 0 ? 'm-0' : m <= 0.25 ? 'm-quarter' : m < 1 ? 'm-half' : '');

/** Colore della Sicurezza: rosso sotto 50, giallo sotto 100, verde a 100. */
const safetyTone = (value: number) => (value < 50 ? 'bad' : value < 100 ? 'warn' : 'good');

/** Tessere "Chi entra" nella fascia in alto: oltre questo numero l'ultima raccoglie gli altri tipi. */
const SWITCH_TILES = 4;

/**
 * Coverage tipi. In alto, alla stessa altezza delle tessere di Generale, "Chi entra": una tessera per tipo in difetto con
 * chi lo resiste. Sotto la griglia come quella della Panoramica: un membro per riga (nello stesso punto di Generale), i 18
 * tipi in colonna e la Sicurezza; a squadra chiusa anche Deboli e Resistono.
 * "Debole" è sempre `weaknessSeverity`: tessere, filo sotto l'icona del tipo e riga Deboli.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const severities = analysis.weakness.map(weaknessSeverity);
  const safety = new Map(defense.coverageTypes.rows.map(row => [row.type, row.safety]));
  const sevLabel = (severity: 'serious' | 'minor') => t(severity === 'serious' ? 'ddetail.sevSerious' : 'ddetail.sevMinor');
  /** Classi di una cella della colonna `col`: il puntatore accende riga e colonna. */
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;

  // Tipi in difetto, i gravi per primi
  const flagged = analysis.weakness
    .flatMap((row, i) => (severities[i] ? [{ row, severity: severities[i]! }] : []))
    .sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious'));
  const shown = flagged.length > SWITCH_TILES ? flagged.slice(0, SWITCH_TILES - 1) : flagged;
  const rest = flagged.slice(shown.length);

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
            {roomy && (
              <>
                <tr className="ct-sum ct-sum-first">
                  <th scope="row">{t('ddetail.weak')}</th>
                  {analysis.weakness.map((row, i) => <td key={row.type} className={colClass(i, severities[i] ? 'bad' : '')}>{row.weak}</td>)}
                </tr>
                <tr className="ct-sum">
                  <th scope="row">{t('ddetail.resist')}</th>
                  {analysis.weakness.map((row, i) => <td key={row.type} className={colClass(i)}>{row.resist}</td>)}
                </tr>
              </>
            )}
            <tr className={`ct-sum${roomy ? '' : ' ct-sum-first'}`}>
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
      <div className="def-sum def-tiles" aria-label={t('ddetail.ctSwitch')} role="group">
        {flagged.length === 0 && (
          <div className="def-tile good ct-tile">
            <span className="def-tile-head"><span>{t('ddetail.ctSwitchCap')}</span></span>
            <span className="def-tile-fact"><span className="def-visual def-none"><Icon name="check" />{t('ddetail.types.noWeak')}</span></span>
          </div>
        )}
        {shown.map(({ row, severity }) => {
          const safe = team.map((set, i) => ({ set, m: row.multipliers[i] })).filter(x => x.m < 1).sort((a, b) => a.m - b.m);
          return (
            <div key={row.type} className={`def-tile ct-tile ${severity === 'serious' ? 'bad' : 'warn'} ${severity}`}>
              <span className="def-tile-head">
                <span className="ct-tile-type"><TypeIcons types={[row.type]} />{typeName(row.type, lang)}</span>
                <em className={`ct-sev ${severity}`}>{sevLabel(severity)}</em>
              </span>
              <span className="def-tile-fact">
                <span className="def-cap"><em>{t('ddetail.ctSwitchCap')}</em><b>{safe.length}/{team.length}</b></span>
                <span className="def-visual">
                  {safe.length === 0
                    ? <span className="ct-switch-none">{t('ddetail.ctSwitchNone')}</span>
                    : safe.map(({ set, m }, i) => (
                        <span key={i} className="ct-switch-mon" title={`${battleName(set)} ${formatMultiplier(m)}`}>
                          <Sprite species={set.species} item={set.item} size={24} />
                          <span className={`ct-swatch ${cellClass(m)}`}>{formatMultiplier(m)}</span>
                          <span className="visually-hidden">{battleName(set)}</span>
                        </span>
                      ))}
                </span>
              </span>
            </div>
          );
        })}
        {rest.length > 0 && (
          <div className="def-tile ct-tile warn">
            <span className="def-tile-head"><span>{t('ddetail.ctMore')}</span><b>+{rest.length}</b></span>
            <span className="def-tile-fact">
              <span className="def-visual">
                {rest.map(({ row, severity }) => (
                  <span key={row.type} className={`def-chip ${severity}`}><TypeIcons types={[row.type]} />{typeName(row.type, lang)}</span>
                ))}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
