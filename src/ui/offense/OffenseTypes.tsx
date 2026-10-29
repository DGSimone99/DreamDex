import { useState } from 'react';
import { battleSpecies } from '../../engine/dex';
import type { TeamOffense } from '../../engine/offense';
import { TYPES } from '../../engine/types';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { TypeIcons } from '../typeIcons';
import { offenseSlots } from './slots';

/** Colore della riga Copertura: rosso a 0, giallo sotto 80, verde da 80. */
const coverTone = (value: number) => (value === 0 ? 'bad' : value < 80 ? 'warn' : 'good');

/**
 * Coverage tipi dell'Offesa: stessa griglia della Difesa (un membro per riga, 18 tipi in colonna) con, per ogni tipo,
 * chi lo colpisce super efficace e quanto (verde = copre, giallo = copre a metà). Il filo sotto l'icona è rosso sui tipi
 * scoperti; in fondo la riga Copertura. Chi il motore ha scartato resta con le caselle vuote.
 */
export function OffenseTypes({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const { rows, holes } = offense.coverageTypes;
  const byType = new Map(rows.map(row => [row.label, row]));
  const slots = offenseSlots(team, offense.members);
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="def-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {TYPES.map((type, i) => {
                const hole = holes.includes(type);
                return (
                  <th key={type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')} title={typeName(type, lang)}>
                    <TypeIcons types={[type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(type, lang)}{hole && ` ${t('odetail.types.hole')}`}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const member = slots[slot] === null ? null : offense.members[slots[slot]!];
              return (
                <tr key={`${name}-${slot}`} className={hover?.row === slot ? 'x-row' : undefined}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {TYPES.map((type, i) => {
                    const hit = member ? byType.get(type)?.coveredBy.find(c => c.species === member.species) : undefined;
                    return (
                      <td key={type} className={colClass(i, `ct-cell${hit ? (hit.partial ? ' ok-half' : ' ok-full') : ''}`)}
                        title={hit ? `${hit.species}: ${hit.move} ${hit.pct}%` : undefined} onMouseEnter={() => setHover({ row: slot, col: i })}>
                        {hit && <>
                          {hit.pct}%
                          <span className="visually-hidden"> {t(hit.partial ? 'odetail.types.half' : 'odetail.types.covers')}</span>
                        </>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('detail.level')}</th>
              {TYPES.map((type, i) => {
                const level = byType.get(type)?.level ?? 0;
                return <td key={type} className={colClass(i)}><span className={`ct-pill ${coverTone(level)}`}>{level}%</span></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ct-legend" aria-hidden="true">
        <span><i className="ok-full" />{t('odetail.types.legendFull')}</span>
        <span><i className="ok-half" />{t('odetail.types.legendHalf')}</span>
        <span><i className="hole" />{t('odetail.types.legendHole')}</span>
      </p>
    </div>
  );
}
