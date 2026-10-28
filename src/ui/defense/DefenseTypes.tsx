import { weaknessSeverity } from '../../engine/coach';
import { battleName } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import { weatherMitigations } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { formatMultiplier, mitigationNote } from '../AnalysisTables';
import type { AreaContext } from '../AreaDetail';
import { IssueCounts, WEAKNESS_LABELS } from '../IssueCounts';
import { Sprite } from '../Sprite';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';

/** La classe della cella dal moltiplicatore (×1 resta neutro). */
const cellClass = (m: number) => (m === 4 ? 'm-4' : m > 1 ? 'm-2' : m === 0 ? 'm-0' : m <= 0.25 ? 'm-quarter' : m < 1 ? 'm-half' : '');

/** Colore della Sicurezza: rosso sotto 50, giallo sotto 100, verde a 100. */
const safetyTone = (value: number) => (value < 50 ? 'bad' : value < 100 ? 'warn' : 'good');

/**
 * Coverage tipi: una tabella sola, un membro per riga e i 18 tipi in colonna, poi Deboli / Resistono / Sicurezza per tipo
 * e sotto le note del meteo. "Debole" è sempre `weaknessSeverity`: segno in testata, riga Deboli e conteggi.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const severities = analysis.weakness.map(weaknessSeverity);
  const serious = severities.filter(s => s === 'serious').length;
  const minor = severities.filter(s => s === 'minor').length;
  const safety = new Map(defense.coverageTypes.rows.map(row => [row.type, row.safety]));
  const shortName = (type: string) => (type === 'Bug' ? t('ddetail.typeShort.Bug') : typeName(type, lang));

  return (
    <>
      <p className="ct-caption">
        {serious + minor === 0 && (team.length ? t('analysis.noShortfall') : '—')}
        <IssueCounts serious={serious} minor={minor} labels={WEAKNESS_LABELS} />
      </p>
      <div className="ad-scroll">
        <table className="ct-table">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">{t('detail.member')}</span></th>
              {analysis.weakness.map((row, i) => {
                const severity = severities[i];
                return (
                  <th key={row.type} scope="col" className={severity ? `sev-${severity}` : undefined} title={typeName(row.type, lang)}>
                    <TypeIcons types={[row.type]} />
                    <span aria-hidden="true">{shortName(row.type)}</span>
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
              <tr key={member}>
                <th scope="row"><span className="ad-mon"><Sprite species={set.species} item={set.item} size={30} />{battleName(set)}</span></th>
                {analysis.weakness.map(row => {
                  const m = row.multipliers[member];
                  return <td key={row.type} className={cellClass(m)}>{formatMultiplier(m)}</td>;
                })}
              </tr>
            ))}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('ddetail.weak')}</th>
              {analysis.weakness.map((row, i) => <td key={row.type} className={severities[i] ? 'bad' : undefined}>{row.weak}</td>)}
            </tr>
            <tr className="ct-sum">
              <th scope="row">{t('ddetail.resist')}</th>
              {analysis.weakness.map(row => <td key={row.type}>{row.resist}</td>)}
            </tr>
            <tr className="ct-sum ct-safety">
              <th scope="row">{t('ddetail.safety')}</th>
              {analysis.weakness.map(row => {
                const value = safety.get(row.type) ?? 0;
                return <td key={row.type} className={safetyTone(value)}>{value}%</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m, lang)} /></p>)}
    </>
  );
}
