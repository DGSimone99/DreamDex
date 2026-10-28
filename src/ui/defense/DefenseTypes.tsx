import { useState, type CSSProperties } from 'react';
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
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';

/** La classe della cella dal moltiplicatore (×1 resta neutro). */
const cellClass = (m: number) => (m === 4 ? 'm-4' : m > 1 ? 'm-2' : m === 0 ? 'm-0' : m <= 0.25 ? 'm-quarter' : m < 1 ? 'm-half' : '');

/** Colore della Sicurezza: rosso sotto 50, giallo sotto 100, verde a 100. */
const safetyTone = (value: number) => (value < 50 ? 'bad' : value < 100 ? 'warn' : 'good');

const LEGEND = [
  [4, 'm-4', 'ddetail.m4'], [2, 'm-2', 'ddetail.m2'], [0.5, 'm-half', 'ddetail.mHalf'],
  [0.25, 'm-quarter', 'ddetail.mQuarter'], [0, 'm-0', 'ddetail.m0'],
] as const;

/**
 * Coverage tipi: una tabella sola, un membro per riga e i 18 tipi in colonna, poi Deboli / Resistono / Sicurezza per tipo
 * e sotto la legenda e le note del meteo. "Debole" è sempre `weaknessSeverity`: fascia sulla colonna, riga Deboli e conteggi.
 * Con la squadra chiusa (`ctx.roomy`) sotto compare "Chi entra": per ogni tipo in difetto, chi lo resiste o ne è immune.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const severities = analysis.weakness.map(weaknessSeverity);
  const serious = severities.filter(s => s === 'serious').length;
  const minor = severities.filter(s => s === 'minor').length;
  const safety = new Map(defense.coverageTypes.rows.map(row => [row.type, row.safety]));
  const shortName = (type: string) => (type === 'Bug' ? t('ddetail.typeShort.Bug') : typeName(type, lang));
  const size = Math.max(team.length, 1);
  /** Classi di una cella della colonna `col`: fascia del difetto e croce del puntatore. */
  const colClass = (col: number, extra = '') =>
    [extra, severities[col] && `sev-${severities[col]}`, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;
  const flagged = analysis.weakness.flatMap((row, i) => (severities[i] ? [{ row, severity: severities[i] }] : []));

  return (
    <div className={`def-types${ctx.roomy ? ' roomy' : ''}`}>
      <p className="ct-caption">
        {serious + minor === 0
          ? (team.length ? t('analysis.noShortfall') : '—')
          : <>
              {serious > 0 && <span className="ct-count serious"><Icon name="warning" />{serious} {t(serious === 1 ? 'issues.shortfallSeriousOne' : 'issues.shortfallSeriousMany')}</span>}
              {minor > 0 && <span className="ct-count minor"><Icon name="warning" />{minor} {t(minor === 1 ? 'issues.shortfallOne' : 'issues.shortfallMany')}</span>}
            </>}
      </p>
      <div className="ct-wrap">
        <table className="ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="ct-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">{t('detail.member')}</span></th>
              {analysis.weakness.map((row, i) => {
                const severity = severities[i];
                return (
                  <th key={row.type} scope="col" className={colClass(i)} title={typeName(row.type, lang)}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-name" aria-hidden="true">{shortName(row.type)}</span>
                    {severity && <span className="ct-sev" aria-hidden="true">{t(severity === 'serious' ? 'ddetail.sevSerious' : 'ddetail.sevMinor')}</span>}
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
                <th scope="row"><span className="ad-mon"><Sprite species={set.species} item={set.item} size={30} />{battleName(set)}</span></th>
                {analysis.weakness.map((row, i) => {
                  const m = row.multipliers[member];
                  return (
                    <td key={row.type} className={colClass(i, cellClass(m))} onMouseEnter={() => setHover({ row: member, col: i })}>
                      {formatMultiplier(m)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('ddetail.weak')}</th>
              {analysis.weakness.map((row, i) => (
                <td key={row.type} className={colClass(i, `ct-weak${severities[i] ? ' bad' : ''}`)} style={{ '--f': row.weak / size } as CSSProperties}>
                  {row.weak}
                </td>
              ))}
            </tr>
            <tr className="ct-sum">
              <th scope="row">{t('ddetail.resist')}</th>
              {analysis.weakness.map((row, i) => (
                <td key={row.type} className={colClass(i, 'ct-resist')} style={{ '--f': row.resist / size } as CSSProperties}>
                  {row.resist}
                </td>
              ))}
            </tr>
            <tr className="ct-sum ct-safety">
              <th scope="row">{t('ddetail.safety')}</th>
              {analysis.weakness.map((row, i) => {
                const value = safety.get(row.type) ?? 0;
                return <td key={row.type} className={colClass(i)}><span className={`ct-pill ${safetyTone(value)}`}>{value}%</span></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ct-legend">
        {t('ddetail.ctLegend')}
        {LEGEND.map(([m, cls, key]) => <span key={cls} className="ct-key"><span className={`ct-swatch ${cls}`}>{formatMultiplier(m)}</span>{t(key)}</span>)}
      </p>
      {ctx.roomy && flagged.length > 0 && (
        <section className="ct-switch" aria-label={t('ddetail.ctSwitch')}>
          <h5>{t('ddetail.ctSwitch')}</h5>
          <ul>
            {flagged.map(({ row, severity }) => {
              const safe = team.map((set, i) => ({ set, m: row.multipliers[i] })).filter(x => x.m < 1).sort((a, b) => a.m - b.m);
              return (
                <li key={row.type} className={`sev-${severity}`}>
                  <span className="ct-switch-type"><TypeIcons types={[row.type]} />{typeName(row.type, lang)}</span>
                  {safe.length === 0
                    ? <span className="ct-switch-none">{t('ddetail.ctSwitchNone')}</span>
                    : safe.map(({ set, m }, i) => (
                        <span key={i} className="ct-switch-mon" title={`${battleName(set)} ${formatMultiplier(m)}`}>
                          <Sprite species={set.species} item={set.item} size={36} />
                          <span className={`ct-swatch ${cellClass(m)}`}>{formatMultiplier(m)}</span>
                          <span className="visually-hidden">{battleName(set)}</span>
                        </span>
                      ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m, lang)} /></p>)}
    </div>
  );
}
