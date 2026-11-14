import type { ReactNode } from 'react';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MetaCount, MetaFrame } from '../MetaFrame';
import { PokemonIcon } from '../PokemonName';
import { MemberMon } from './MemberMon';
import { ColName, EffTag, effClass, effLabel, useColumnHover } from '../effTag';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];
type Holder = Row['heldBy'][number];

/** Gruppo di una minaccia: nessuno la regge, solo a metà (chi regge va KO in due colpi), retta. */
const groupOf = (row: Row) => (row.heldBy.length === 0 ? 'none' : row.heldBy.some(h => !h.partial) ? 'held' : 'partial');
/** Quanti membri la reggono del tutto: 0 rosso, 1 giallo, da 2 verde (come "Lo coprono" dell'Offesa). */
const countTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');
/** Le tre soglie della casella, coi colori di Coverage tipi: regge (sotto metà PS), a metà (KO in due colpi), KO. */
const LEGEND = [{ cls: 'hold-4', tag: '< 50%' }, { cls: 'hold-3', tag: '50–99%' }, { cls: 'hold-ohko', tag: 'KO' }] as const;

/**
 * Per ogni posto del team, cosa prende dal colpo migliore della minaccia: `null` se il motore non conosce il membro,
 * 'ko' se va KO in un colpo (il motore lo lascia fuori da `heldBy`), altrimenti la voce di `heldBy`. Le voci di `heldBy`
 * seguono l'ordine dei membri conosciuti, così anche due membri della stessa specie restano al loro posto.
 */
function cellsOf(row: Row, names: (string | null)[]): (Holder | 'ko' | null)[] {
  let next = 0;
  return names.map(name => {
    if (!name) return null;
    const h = row.heldBy[next];
    if (h && h.species === name) { next++; return h; }
    return 'ko';
  });
}

/**
 * Coverage meta della Difesa, a tabella come quella dell'Offesa: i membri in riga (nello stesso punto delle altre schede),
 * le minacce del meta in colonna, 8 per pagina dalla meno coperta (a pari livello la più usata). In ogni casella il danno
 * che il membro prende dal colpo migliore della minaccia, verde se regge (sotto metà PS), giallo se solo a metà, rosso se
 * va KO; in fondo Regge conta chi la regge del tutto. Le pagine ("‹ 1/5 ›") stanno nella casella in alto a sinistra;
 * sotto la tabella una sola riga col riepilogo; la legenda dei colori sta sulla riga dei problemi (DefenseMetaLegend).
 * In basso a sinistra l'efficacia della mossa della minaccia che fa più danno al membro (la stessa del %) quando non è
 * neutra (×4, ×2, ×½, ×¼, 0); "Solo efficacia" (`ctx.effOnly`) spegne le caselle neutre. Col puntatore la colonna si accende e
 * sotto lo sprite compare il nome.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const hover = useColumnHover();
  const rows = [...(defense.coverageMeta?.rows ?? [])].sort((a, b) => a.level - b.level || b.weight - a.weight);
  const names = ctx.team.map(set => battleSpecies(set)?.name ?? null);
  // Il posto fra i membri conosciuti dal motore (l'ordine di `mults`)
  let seen = 0;
  const knownIndex = names.map(name => (name ? seen++ : -1));
  const count = (group: 'held' | 'partial' | 'none') => rows.filter(r => groupOf(r) === group).length;
  const summary = (
    <>
      <span>{t('ddetail.cm.threats', { n: rows.length })}</span>
      <MetaCount n={count('held')} tone="good" label={t('ddetail.cm.held')} />
      <MetaCount n={count('partial')} tone="warn" label={t('ddetail.cm.partial')} />
      <MetaCount n={count('none')} tone="bad" label={t('ddetail.cm.none')} />
    </>
  );

  const cell = (row: Row, c: Holder | 'ko' | null, m: number, k: number) => {
    const key = `${row.species}-${m}`;
    const dim = ctx.effOnly ? ' eff-dim' : '';
    if (c === null) return <td key={key} className={hover.cls(k, `rob-cell hold-none${dim}`)} {...hover.enter(k)}>—</td>;
    const tag = effLabel(row.mults?.[knownIndex[m]], 'defense');
    const eff = effClass(tag, 'defense', ctx.effOnly);
    if (c === 'ko') {
      return (
        <td key={key} className={hover.cls(k, `rob-cell hold-ohko${eff}`)} {...hover.enter(k)} title={`${row.species}: KO`}>
          KO<EffTag label={tag} side="defense" />
        </td>
      );
    }
    const cls = c.partial ? 'hold-3' : 'hold-4';
    const title = `${row.species}: ${c.move ? `${c.move} ` : ''}${c.pct}%`;
    return (
      <td key={key} className={hover.cls(k, `rob-cell ${cls}${eff}`)} {...hover.enter(k)} title={title}>
        {c.pct}%<span className="visually-hidden"> {title}</span>
        <EffTag label={tag} side="defense" />
      </td>
    );
  };

  const body = (shown: Row[], pager: ReactNode, counts: ReactNode) => {
    const cells = shown.map(r => cellsOf(r, names));
    return (
      <div className={`def-frame def-meta-grid cm-matrix${ctx.roomy ? ' roomy' : ''}`}>
        <div className="ad-scroll">
          <table className="def-grid spaced ct-table" {...hover.table}>
            <colgroup>
              <col className="def-col-mon" />
              {shown.map(r => <col key={r.species} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="def-mon-h cm-pager-h">{pager}</th>
                {shown.map((r, k) => (
                  <th key={r.species} scope="col" aria-label={r.species} title={r.species} className={hover.cls(k, 'dm-h')} {...hover.enter(k)}>
                    <span className="def-box"><PokemonIcon name={r.species} /></span>
                    {hover.col === k && <ColName name={r.species} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctx.team.map((set, m) => (
                <tr key={`${names[m] ?? set.species}-${m}`}>
                  <th scope="row"><MemberMon name={battleName(set)} set={set} stats /></th>
                  {shown.map((r, k) => cell(r, cells[k][m], m, k))}
                </tr>
              ))}
              <tr className="ct-sum ct-sum-first">
                <th scope="row">{t('ddetail.heldBy')}</th>
                {shown.map(r => {
                  const n = r.heldBy.filter(h => !h.partial).length;
                  return <td key={r.species}><span className={`ct-pill ${countTone(n)}`}>{n}</span></td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rob-legend cm-foot">{counts}</div>
      </div>
    );
  };

  return <MetaFrame rows={rows} summary={summary} body={body}
    labels={{ pages: t('ddetail.cm.pages'), prev: t('ddetail.cm.prev'), next: t('ddetail.cm.next'), page: (from, to) => t('ddetail.cm.page', { from, to }) }} />;
}

/** La legenda dei colori di Coverage meta della Difesa, sulla riga dei problemi: regge, a metà, KO. */
export function DefenseMetaLegend() {
  const t = useT();
  return (
    <>
      <span title={t('ddetail.cm.damage')}>{t('ddetail.cm.damageShort')}</span>
      {LEGEND.map(l => <span key={l.cls} className={`hold-chip ${l.cls}`}>{l.tag}</span>)}
    </>
  );
}
