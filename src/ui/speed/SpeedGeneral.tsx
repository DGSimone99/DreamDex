import { battleSpecies } from '../../engine/dex';
import { CONTROL_CONDITIONS, type MemberSpeed, type TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { Bar, tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { Icon } from '../icons';
import { offenseSlots } from '../offense/slots';
import { PokemonIcon } from '../PokemonName';

/** Quanti rivali che nessuno supera si mostrano come icone nella tessera; gli altri vanno in "+N". */
const HOLE_ICONS = 6;
const points = (x: number) => Math.round(100 * x);

/**
 * La scheda Generale della Velocità, nella cornice comune (`def-frame`): i membri dal più veloce con una colonna per
 * voce (Velocità reale, Pura, Propria coi guadagni del membro, Con il team coi guadagni del controllo) e sotto le due
 * tessere, Velocità e Controllo velocità (un clic apre la sottoscheda).
 * Le righe seguono il team dal più veloce; chi il motore non conosce resta con "—".
 */
export function SpeedGeneral({ speed, meta, ctx }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members, threats } = speed;
  const slots = offenseSlots(ctx.team, members);
  const rows = ctx.team
    .map((set, slot) => ({ set, m: slots[slot] === null ? null : members[slots[slot]!] }))
    .sort((a, b) => (b.m?.speed ?? -1) - (a.m?.speed ?? -1));
  const ownGains = (m: MemberSpeed) => m.gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition));
  const teamGains = (m: MemberSpeed) => m.gains.filter(g => CONTROL_CONDITIONS.includes(g.condition));
  const tip = (list: MemberSpeed['gains']) => list.map(g => `${t(`sdetail.cond.${g.condition}`)} (${g.source}): +${points(g.gain)}`).join('\n');
  const gainOf = (from: number, to: number, list: MemberSpeed['gains']) => {
    const plus = points(to) - points(from);
    return plus > 0 ? <small className="ad-gain" title={tip(list)}>(+{plus})</small> : undefined;
  };
  const ownColumn = members.some(m => points(m.own) > points(m.raw));
  const teamColumn = members.some(m => points(m.total) > points(m.own));

  // Tessera Velocità: i rivali che nessuno supera da solo
  const holes = threats.filter(th => th.outsped === 0);
  const hiddenHoles = holes.slice(HOLE_ICONS).map(th => th.species).join(', ');
  const controls = speed.sources.filter(src => src.helped > 0);
  const tiles = [
    {
      key: 'threats', label: t('sdetail.speed'), value: speed.speed,
      fact: <>
        <span className="def-cap"><em>{t('sdetail.tile.holes')}</em><b>{holes.length}/{threats.length}</b></span>
        {holes.length
          ? <span className="def-visual">
            {holes.slice(0, HOLE_ICONS).map(th => (
              <span key={th.index} className="def-open-mon plain" title={th.species}><PokemonIcon name={th.species} /><span className="visually-hidden">{th.species}</span></span>
            ))}
            {hiddenHoles && <span className="def-more" title={hiddenHoles}>+{holes.length - HOLE_ICONS}<span className="visually-hidden"> {hiddenHoles}</span></span>}
          </span>
          : <span className="def-visual def-none"><Icon name="check" />{t('sdetail.tile.noHoles')}</span>}
      </>,
    },
    {
      key: 'control', label: t('sdetail.control'), value: speed.control,
      fact: controls.length
        ? <>
          <span className="def-cap"><em>{t('sdetail.tile.control')}</em><b>+{speed.control}</b></span>
          <span className="def-visual sp-controls">{controls.map(src => <span key={`${src.condition}-${src.move}`} className="sp-control-move">{src.move}</span>)}</span>
        </>
        : <span className="def-visual def-faint">{t('sdetail.general.controlNone')}</span>,
    },
  ];

  return (
    <div className="def-frame def-general sp-general">
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" /><col className="sp-col-speed" /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('sdetail.speed')}</th>
              <th scope="col">{t('sdetail.raw')}</th>
              <th scope="col">{t('sdetail.own')}</th>
              <th scope="col">{t('sdetail.withTeam')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ set, m }, i) => {
              const name = battleSpecies(set)?.name ?? set.species;
              return (
                <tr key={`${name}-${i}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {m
                    ? <>
                      <td className="sp-speed"><b>{m.speed}</b>{set.item.toLowerCase() === 'choice scarf' && <small className="sp-mark">{t('sdetail.mark.scarf')}</small>}</td>
                      <td><Bar value={points(m.raw)} unit="%" /></td>
                      <td><Bar value={points(m.own)} unit="%" reserve={ownColumn} gain={gainOf(m.raw, m.own, ownGains(m))} /></td>
                      <td><Bar value={points(m.total)} unit="%" total reserve={teamColumn} gain={gainOf(m.own, m.total, teamGains(m))} /></td>
                    </>
                    : <><td>—</td><td>—</td><td>—</td><td>—</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sp-lead">{t(meta ? 'sdetail.lead.meta' : 'sdetail.lead.tier')}</p>
      <div className="def-sum def-tiles sp-tiles">
        {tiles.map(tile => (
          <button key={tile.key} type="button" className={`def-tile ${tile.key === 'control' ? (tile.value > 0 ? 'good' : 'warn') : tone(tile.value)}`} onClick={() => ctx.open?.(tile.key)}>
            <span className="def-tile-head"><span>{tile.label}</span><b>{tile.key === 'control' ? `+${tile.value}` : tile.value}</b></span>
            <span className="def-tile-fact">{tile.fact}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
