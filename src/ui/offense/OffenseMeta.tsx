import type { ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import type { TeamOffense } from '../../engine/offense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { MetaCount, MetaFrame } from '../MetaFrame';
import { PokemonIcon } from '../PokemonName';

type Row = NonNullable<TeamOffense['coverageMeta']>['rows'][number];
type Bucket = 'ohko' | 'two' | 'three' | 'none';

/** Soglia di una casella dal danno %: OHKO da 100, 2HKO da 50, 3HKO da 34 (come la Coverage: un terzo dei PS). */
const bucket = (pct: number): Bucket => (pct >= 100 ? 'ohko' : pct >= 50 ? 'two' : pct >= 34 ? 'three' : 'none');
const TAG: Record<Bucket, string> = { ohko: 'OHKO', two: '2HKO', three: '3HKO', none: '' };
const KO_ORDER: Bucket[] = ['ohko', 'two', 'three'];
/** Quanti membri lo mandano KO in due colpi: 0 rosso, 1 giallo, da 2 verde. */
const coverTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

/**
 * Coverage meta dell'Offesa: i membri in riga (nello stesso punto delle altre schede), i Pokémon del meta in colonna,
 * 8 per pagina dal meno coperto (a pari livello il più usato). In ogni casella il danno % del colpo semplice (senza
 * Tera, Z e setup) colorato per soglia, con "setup N%" quando la danza cambia soglia; in fondo "Lo coprono" conta chi
 * lo manda KO in due colpi. Pagine e riepilogo stanno sotto la tabella, così la tabella parte dove partono le altre.
 */
export function OffenseMeta({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const rows = [...(offense.coverageMeta?.rows ?? [])].sort((a, b) => a.level - b.level || b.weight - a.weight);
  const covered = rows.filter(r => r.level > 0).length;
  const only3 = rows.filter(r => r.level === 0 && (r.cells ?? []).some(c => c.pct >= 34)).length;
  const summary = (
    <>
      <span>{t('odetail.cm.targets', { n: rows.length })}</span>
      <MetaCount n={covered} tone="good" label={t('odetail.cm.covered')} />
      <MetaCount n={only3} tone="warn" label={t('odetail.cm.only3')} />
      <MetaCount n={rows.length - covered - only3} tone="bad" label={t('odetail.cm.uncovered')} />
    </>
  );

  const cell = (row: Row, m: number) => {
    const c = row.cells?.[m];
    if (!c || c.pct < 0) return <td key={row.species} className="rob-cell ko-none">—</td>;
    const k = bucket(c.pct);
    const up = c.setupPct !== null && bucket(c.setupPct) !== k;
    const setupText = up ? `setup ${c.setupPct}%` : '';
    return (
      <td key={row.species} className={`rob-cell ko-${k}${up ? ' has-setup' : ''}`} title={[TAG[k], setupText].filter(Boolean).join(' · ') || undefined}>
        <span className="wall-pct">{c.pct}%</span>
        {TAG[k] && <span className="visually-hidden"> {TAG[k]}</span>}
        {up && <small className="wall-setup">{setupText}</small>}
      </td>
    );
  };

  const body = (shown: Row[], bar: ReactNode) => (
    <div className={`def-frame def-walls cm-matrix${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table">
          <colgroup>
            <col className="def-col-mon" />
            {shown.map(r => <col key={r.species} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {shown.map(r => (
                <th key={r.species} scope="col" aria-label={r.species} title={r.species} className="wall-h">
                  <span className="def-box"><PokemonIcon name={r.species} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, m) => {
              const name = battleSpecies(set)?.name ?? set.species;
              return (
                <tr key={`${name}-${m}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {shown.map(r => cell(r, m))}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('odetail.cm.coveredBy')}</th>
              {shown.map(r => {
                const n = (r.cells ?? []).filter(c => c.pct >= 50).length;
                return <td key={r.species}><span className={`ct-pill ${coverTone(n)}`}>{n}</span></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rob-legend" aria-hidden="true">
        {KO_ORDER.map(b => <span key={b} className={`hold-chip ko-${b}`}>{TAG[b]}</span>)}
        <span className="hold-chip ko-none">{t('odetail.wall.legendLess')}</span>
        <span className="wall-legend-setup"><i className="wall-tick" />{t('odetail.wall.legendSetup')}</span>
      </p>
      <p className="cm-note">{t('odetail.cm.oneUseNote')}</p>
      {bar}
    </div>
  );

  return <MetaFrame rows={rows} roomy={ctx.roomy} summary={summary} body={body}
    labels={{ pages: t('odetail.cm.pages'), prev: t('odetail.cm.prev'), next: t('odetail.cm.next'), page: (from, to) => t('odetail.cm.page', { from, to }) }} />;
}
