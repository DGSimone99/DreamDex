import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { PokemonIcon } from '../PokemonName';
import { Icon } from '../icons';
import { MemberMon, setOf } from './MemberMon';

/** Soglia di un colpo standard ricevuto, dal valore del colpo (holdStep: OHKO 0 … 4HKO o più 1,5). */
export const HOLD_TAGS: Record<number, { cls: string; tag: string }> = {
  0: { cls: 'hold-ohko', tag: 'OHKO' }, 0.5: { cls: 'hold-2', tag: '2HKO' }, 1: { cls: 'hold-3', tag: '3HKO' }, 1.5: { cls: 'hold-4', tag: '4HKO+' },
};
/** Le soglie in ordine, dalla peggiore (le chiavi numeriche di HOLD_TAGS non tengono l'ordine). */
export const HOLD_ORDER = [0, 0.5, 1, 1.5].map(step => HOLD_TAGS[step]);

/** Colore di un valore di lato, come le barre di Generale: verde da 80, giallo da 50, rosso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/**
 * La Robustezza, nella cornice comune (i membri nello stesso punto di Generale e Coverage tipi): membri in riga, i 20
 * attaccanti in colonna (fisici, poi speciali, icone del box), in ogni casella il % del colpo standard colorato per soglia
 * e a fine gruppo il valore del lato in pastiglia. Fra i due gruppi una colonna vuota; la legenda in fondo.
 */
export function DefenseRobustness({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const { members, matrix } = defense;
  const groups = [
    { key: 'physical' as const, title: t('ddetail.side.physical'), side: t('ddetail.physical'), rows: matrix.filter(row => row.physical) },
    { key: 'special' as const, title: t('ddetail.side.special'), side: t('ddetail.special'), rows: matrix.filter(row => !row.physical) },
  ];
  const gap = (key: string, Cell: 'td' | 'th' = 'td') => <Cell key={`${key}-gap`} className="rob-gap" aria-hidden="true" />;
  return (
    <div className={`def-frame def-rob${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced rob-matrix">
          <colgroup>
            <col className="def-col-mon" />
            {groups.map((g, gi) => [
              ...g.rows.map((_, i) => <col key={`${g.key}-${i}`} />),
              <col key={`${g.key}-side`} className="rob-col-side" />,
              ...(gi === 0 ? [<col key="gap" className="rob-col-gap" />] : []),
            ])}
          </colgroup>
          <thead>
            <tr className="rob-grp">
              <th scope="col" rowSpan={2} className="def-mon-h">{t('detail.member')}</th>
              {groups.map((g, gi) => [
                <th key={g.key} scope="colgroup" colSpan={g.rows.length}>{g.title}</th>,
                <th key={`${g.key}-side`} scope="col" rowSpan={2} className="rob-side-h" title={g.side}>
                  <Icon name={g.key} /><span className="visually-hidden">{g.side}</span>
                </th>,
                ...(gi === 0 ? [gap('head', 'th')] : []),
              ])}
            </tr>
            <tr className="rob-atk">
              {groups.map((g, gi) => [
                ...g.rows.map((row, i) => (
                  <th key={`${row.species}-${i}`} scope="col" aria-label={row.species} title={row.species}>
                    <span className="def-box"><PokemonIcon name={row.species} /></span>
                  </th>
                )),
                ...(gi === 0 ? [gap('atk', 'th')] : []),
              ])}
            </tr>
          </thead>
          <tbody>
            {members.map((m, mi) => (
              <tr key={`${m.species}-${mi}`}>
                <th scope="row"><MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats /></th>
                {groups.map((g, gi) => [
                  ...g.rows.map((row, i) => {
                    const cell = row.cells[mi];
                    const hold = HOLD_TAGS[cell.step];
                    // La soglia anche in testo: il colore da solo non arriva ai lettori di schermo
                    return (
                      <td key={`${row.species}-${i}`} className={`rob-cell ${hold.cls}`} title={hold.tag}>
                        {cell.pct}%<span className="visually-hidden"> {hold.tag}</span>
                      </td>
                    );
                  }),
                  <td key={`${g.key}-side`} className="rob-side"><span className={`ct-pill ${tone(m[g.key])}`}>{m[g.key]}</span></td>,
                  ...(gi === 0 ? [gap(`row-${mi}`)] : []),
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rob-legend">
        {t('ddetail.holdLegend')}
        {HOLD_ORDER.map(h => <span key={h.cls} className={`hold-chip ${h.cls}`}>{h.tag}</span>)}
      </p>
    </div>
  );
}
