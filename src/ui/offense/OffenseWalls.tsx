import { battleSpecies } from '../../engine/dex';
import { stepBucket, type TeamOffense } from '../../engine/offense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';
import { offenseSlots } from './slots';

type Bucket = ReturnType<typeof stepBucket>;
/** Soglia di un colpo del membro sul muro: classe di colore e sigla (la sigla sta anche nel testo nascosto). */
const KO: Record<Bucket, { cls: string; tag: string }> = {
  ohko: { cls: 'ko-ohko', tag: 'OHKO' }, two: { cls: 'ko-two', tag: '2HKO' }, three: { cls: 'ko-three', tag: '3HKO' }, none: { cls: 'ko-none', tag: '' },
};
/** Le soglie in ordine, dalla migliore (per la legenda). */
const KO_ORDER: Bucket[] = ['ohko', 'two', 'three'];

/** Quanti membri sfondano il muro (OHKO o 2HKO): 0 rosso, 1 giallo, da 2 verde. */
const breakTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

/**
 * Il Wallbreaking, nella cornice comune (i membri nello stesso punto delle altre schede): membri in riga, i muri del formato
 * in colonna (icone del box), in ogni casella il danno % del colpo migliore colorato per soglia (con il danno dopo il setup
 * quando cambia la soglia) e in fondo il valore del membro. La riga "Lo sfondano" conta chi rompe ogni muro; legenda sotto.
 */
export function OffenseWalls({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const { walls, members } = offense;
  const slots = offenseSlots(ctx.team, members);
  const breakers = walls.map(wall => slots.filter(s => s !== null && ['ohko', 'two'].includes(stepBucket(wall.cells[s].step))).length);
  return (
    <div className={`def-frame def-rob def-walls${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced rob-matrix ct-table">
          <colgroup>
            <col className="def-col-mon" />
            {walls.map((w, i) => <col key={`${w.species}-${i}`} />)}
            <col className="rob-col-side" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {walls.map((w, i) => (
                <th key={`${w.species}-${i}`} scope="col" aria-label={w.species} title={w.species} className="wall-h">
                  <span className="def-box"><PokemonIcon name={w.species} /></span>
                </th>
              ))}
              <th scope="col" className="rob-side-h wall-side-h" title={t('detail.wallbreaking')}>
                <Icon name="gavel" /><span className="visually-hidden">{t('detail.wallbreaking')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const s = slots[slot];
              const m = s === null ? null : members[s];
              return (
                <tr key={`${name}-${slot}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {walls.map((w, i) => {
                    if (s === null) return <td key={`${w.species}-${i}`} className="rob-cell ko-none">—</td>;
                    const cell = w.cells[s];
                    const ko = KO[stepBucket(cell.step)];
                    const upgraded = cell.setupStep !== null && stepBucket(cell.setupStep) !== stepBucket(cell.step);
                    const setupText = upgraded ? `setup ${cell.setupPct}%` : '';
                    return (
                      <td key={`${w.species}-${i}`} className={`rob-cell ${ko.cls}${upgraded ? ' has-setup' : ''}`}
                        title={[ko.tag, setupText].filter(Boolean).join(' · ') || undefined}>
                        <span className="wall-pct">{cell.pct}%</span>
                        {ko.tag && <span className="visually-hidden"> {ko.tag}</span>}
                        {upgraded && <small className="wall-setup">{setupText}</small>}
                      </td>
                    );
                  })}
                  <td className="rob-side">
                    {m
                      ? <>
                        <span className={`ct-pill ${tone(m.wallbreaking)}`}>{m.wallbreaking}</span>
                        {m.wallbreakingGain > 0 && <small className="ad-gain wall-gain" title={t('detail.withSetup', { move: m.setupMove ?? '' })}>+{m.wallbreakingGain}</small>}
                      </>
                      : '—'}
                  </td>
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('odetail.wall.breakers')}</th>
              {breakers.map((n, i) => <td key={`${walls[i].species}-${i}`}><span className={`ct-pill ${breakTone(n)}`}>{n}</span></td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rob-legend" aria-hidden="true">
        {KO_ORDER.map(b => <span key={b} className={`hold-chip ${KO[b].cls}`}>{KO[b].tag}</span>)}
        <span className="hold-chip ko-none">{t('odetail.wall.legendLess')}</span>
        <span className="wall-legend-setup">{t('odetail.wall.legendSetup')}</span>
      </p>
    </div>
  );
}
