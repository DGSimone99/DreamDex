import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { MemberMon } from './MemberMon';

/** Soglia di un colpo standard ricevuto, dal valore del colpo (holdStep: OHKO 0 … 4HKO o più 1,5). */
export const HOLD_TAGS: Record<number, { cls: string; tag: string }> = {
  0: { cls: 'hold-ohko', tag: 'OHKO' }, 0.5: { cls: 'hold-2', tag: '2HKO' }, 1: { cls: 'hold-3', tag: '3HKO' }, 1.5: { cls: 'hold-4', tag: '4HKO+' },
};

/**
 * La Robustezza: membri in riga, i 20 attaccanti in colonna (fisici, poi speciali), in ogni cella il % del colpo standard
 * e a fine gruppo il valore del lato. Il vuoto tra i due gruppi è spaziatura CSS, non una cella.
 */
export function DefenseRobustness({ defense }: { defense: TeamDefense }) {
  const t = useT();
  const { members, matrix } = defense;
  const groups = [
    { key: 'physical' as const, title: t('ddetail.side.physical'), side: t('ddetail.physical'), rows: matrix.filter(row => row.physical) },
    { key: 'special' as const, title: t('ddetail.side.special'), side: t('ddetail.special'), rows: matrix.filter(row => !row.physical) },
  ];
  return (
    <>
      <h4>{t('ddetail.robustness')}</h4>
      <div className="ad-scroll">
        <table className="rob-matrix">
          <thead>
            <tr className="rob-grp">
              <td aria-hidden="true" />
              {groups.map(g => [
                <th key={g.key} scope="colgroup" colSpan={g.rows.length} className={g.key === 'special' ? 'rob-start' : undefined}>{g.title}</th>,
                <th key={`${g.key}-side`} scope="col" className="rob-side-h">{g.side}</th>,
              ])}
            </tr>
            <tr className="rob-atk">
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {groups.map(g => [
                ...g.rows.map((row, i) => (
                  <th key={`${row.species}-${i}`} scope="col" aria-label={row.species} title={row.species} className={g.key === 'special' && i === 0 ? 'rob-start' : undefined}>
                    <Sprite species={row.species} size={24} />
                  </th>
                )),
                <th key={`${g.key}-side`} scope="col" aria-hidden="true" />,
              ])}
            </tr>
          </thead>
          <tbody>
            {members.map((m, mi) => (
              <tr key={`${m.species}-${mi}`}>
                <th scope="row"><MemberMon name={m.species} /></th>
                {groups.map(g => [
                  ...g.rows.map((row, i) => {
                    const cell = row.cells[mi];
                    const hold = HOLD_TAGS[cell.step];
                    // La soglia anche in testo: il colore da solo non arriva ai lettori di schermo
                    return (
                      <td key={`${row.species}-${i}`} className={`rob-cell ${hold.cls}${g.key === 'special' && i === 0 ? ' rob-start' : ''}`} title={hold.tag}>
                        {cell.pct}%<span className="visually-hidden"> {hold.tag}</span>
                      </td>
                    );
                  }),
                  <td key={`${g.key}-side`} className="rob-side">{m[g.key]}</td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rob-legend">
        {t('ddetail.holdLegend')}
        {Object.values(HOLD_TAGS).map(h => <span key={h.cls} className={`hold-chip ${h.cls}`}>{h.tag}</span>)}
      </p>
    </>
  );
}
