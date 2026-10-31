import { useState, type ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import type { SpeedCell, SpeedCondition, SpeedThreat, TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { MetaCount, MetaFrame } from '../MetaFrame';
import { offenseSlots } from '../offense/slots';
import { PokemonIcon } from '../PokemonName';

type Kind = 'full' | 'tie' | 'own' | 'team' | 'none';
const KINDS: Kind[] = ['full', 'tie', 'own', 'team', 'none'];
const TEAM_CONDITIONS: SpeedCondition[] = ['web', 'trickroom', 'tailwind', 'slow'];
/** Il nome corto dei setup nella cella (gli altri prendono la prima parola della mossa). */
const SHORT: Record<string, string> = {
  'Dragon Dance': 'DD', 'Quiver Dance': 'QD', 'Shell Smash': 'Smash', 'Shift Gear': 'Gear', 'Rock Polish': 'Polish',
  'Victory Dance': 'VD', 'Tidy Up': 'Tidy', 'Flame Charge': 'Charge', 'Rapid Spin': 'Spin', 'Aqua Step': 'Step', 'Esper Wing': 'Wing',
  'Thunder Wave': 'T-Wave', 'Stun Spore': 'Spore', 'Icy Wind': 'Icy', 'Low Sweep': 'Sweep', 'Rock Tomb': 'Tomb',
};
/** Quanti membri lo superano da soli: 0 rosso, 1 giallo, da 2 verde. */
const outspedTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

const kindOf = (c: SpeedCell): Kind =>
  (c.base === 1 ? 'full' : c.via ? (TEAM_CONDITIONS.includes(c.via) ? 'team' : 'own') : c.base === 0.5 ? 'tie' : 'none');

/**
 * Chi supera: i membri in riga (nello stesso punto delle altre schede), i rivali del gruppo in colonna, 8 per pagina dal
 * meno superato (pagina 1 = chi nessuno supera). In ogni cella se il membro arriva prima: da solo, a pari velocità, con
 * un guadagno suo (setup, meteo, Booster, Unburden, priorità) o col controllo del team (Web, Trick Room, Tailwind,
 * paralisi); in fondo "Lo superano" conta chi lo supera da solo, con tra parentesi chi lo raggiunge solo con le
 * condizioni. Pagine e riepilogo stanno sotto la tabella, così la tabella parte dove partono le altre.
 */
export function SpeedThreats({ speed, meta, ctx }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members, threats } = speed;
  const slots = offenseSlots(ctx.team, members);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const outsped = threats.filter(th => th.outsped > 0).length;
  const onlyWith = threats.filter(th => th.outsped === 0 && th.reached > 0).length;
  const summary = (
    <>
      <span>{t('sdetail.threats.rivals', { n: threats.length })}</span>
      <MetaCount n={outsped} tone="good" label={t('sdetail.threats.outsped')} />
      <MetaCount n={onlyWith} tone="warn" label={t('sdetail.threats.onlyWith')} />
      <MetaCount n={threats.length - outsped - onlyWith} tone="bad" label={t('sdetail.threats.nobody')} />
    </>
  );
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;
  const mark = (th: { scarf: boolean; booster: boolean }) =>
    th.scarf ? t('sdetail.mark.scarf') : th.booster ? t('sdetail.mark.booster') : '';

  const label = (c: SpeedCell, kind: Kind) => {
    if (kind === 'full') return t('sdetail.cell.yes');
    if (kind === 'tie') return t('sdetail.cell.tie');
    if (kind === 'none') return '—';
    const source = c.source ?? '';
    switch (c.via) {
      case 'setup': case 'slow': return SHORT[source] ?? source.split(' ')[0];
      case 'priority': return t('sdetail.cell.prio');
      case 'trickroom': return t('sdetail.cell.tr');
      case 'web': return t('sdetail.cell.web');
      case 'tailwind': return t('sdetail.cell.tailwind');
      case 'weather': return t('sdetail.cell.weather');
      case 'booster': return t('sdetail.cell.booster');
      case 'unburden': return t('sdetail.cell.unburden');
      default: return source;
    }
  };
  const how = (c: SpeedCell, kind: Kind) => {
    if (kind === 'full') return t('sdetail.how.full');
    if (kind === 'tie') return t('sdetail.how.tie');
    if (kind === 'none') return t('sdetail.how.none');
    return t(c.via === 'priority' ? 'sdetail.how.priority' : 'sdetail.how.via', { source: c.source ?? '' });
  };
  const cell = (th: SpeedThreat, col: number, member: SpeedCell[] | null, memberName: string, memberSpeed: number, row: number) => {
    const c = member?.[th.index];
    if (!c || !c.weight) return <td key={th.index} className={colClass(col, 'rob-cell sp-cell sp-none')}>—</td>;
    const kind = kindOf(c);
    const rivalMark = mark(th);
    const tip = t('sdetail.cell.tip', { member: memberName, speed: memberSpeed, rival: th.species, rivalSpeed: th.speed, mark: rivalMark ? ` (${rivalMark})` : '', how: how(c, kind) });
    return (
      <td key={th.index} className={colClass(col, `rob-cell sp-cell sp-${kind}`)} title={tip} onMouseEnter={() => setHover({ row, col })}>
        <span className="sp-cell-text">{label(c, kind)}</span>
        <span className="visually-hidden"> {how(c, kind)}</span>
      </td>
    );
  };

  const body = (shown: SpeedThreat[], bar: ReactNode) => (
    <div className={`def-frame def-walls sp-threats cm-matrix${ctx.roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup>
            <col className="def-col-mon" />
            {shown.map(th => <col key={th.index} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {shown.map((th, col) => {
                const hole = th.reached === 0;
                const rivalMark = mark(th);
                const name = `${th.species} ${th.speed}${rivalMark ? ` (${rivalMark})` : ''}`;
                return (
                  <th key={th.index} scope="col" aria-label={name} title={name} className={colClass(col, `wall-h sp-h${hole ? ' sev-serious' : ''}`)}>
                    <span className="def-box"><PokemonIcon name={th.species} /></span>
                    <span className="sp-h-speed" aria-hidden="true">{th.speed}{rivalMark && <small className="sp-mark">{rivalMark}</small>}</span>
                    <span className="ct-flag" aria-hidden="true" />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, row) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const m = slots[row] === null ? null : members[slots[row]!];
              return (
                <tr key={`${name}-${row}`} className={hover?.row === row ? 'x-row' : undefined}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {shown.map((th, col) => cell(th, col, m?.cells ?? null, name, m?.speed ?? 0, row))}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('sdetail.outspedBy')}</th>
              {shown.map((th, col) => (
                <td key={th.index} className={colClass(col)}>
                  <span className={`ct-pill ${outspedTone(th.outsped)}`}>
                    {th.outsped}{th.reached > th.outsped && <small className="sp-reached"> (+{th.reached - th.outsped})</small>}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rob-legend" aria-hidden="true">
        {KINDS.map(kind => <span key={kind} className={`hold-chip sp-chip sp-${kind}`}>{t(`sdetail.legend.${kind}`)}</span>)}
        <span className="sp-legend-note">{t(meta ? 'sdetail.legend.meta' : 'sdetail.legend.tier')}</span>
      </p>
      {bar}
    </div>
  );

  return <MetaFrame rows={threats} roomy={ctx.roomy} summary={summary} body={body}
    labels={{ pages: t('sdetail.threats.pages'), prev: t('sdetail.threats.prev'), next: t('sdetail.threats.next'), page: (from, to) => t('sdetail.threats.page', { from, to }) }} />;
}
