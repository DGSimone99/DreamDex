import { useRef, useState, type ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import { CONTROL_CONDITIONS, type MemberSpeed, type TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { Icon } from '../icons';
import { offenseSlots } from '../offense/slots';
import { PokemonIcon } from '../PokemonName';
import { SpeedMemberDialog } from './SpeedMemberDialog';

/** Quanti rivali che nessuno supera si mostrano come icone nella tessera; gli altri vanno in "+N". */
const HOLE_ICONS = 6;
const points = (x: number) => Math.round(100 * x);

/**
 * La scheda della Velocità, nella cornice comune (`def-frame`): i membri dal più veloce, ognuno con una barra a segmenti
 * (velocità pura, i guadagni suoi, quelli del team) e il totale; la barra è un bottone che apre il modale del membro coi
 * rivali e i check "e se". Sotto, le tessere Velocità (chi nessuno supera) e Controllo velocità (le mosse che aiutano).
 * Le righe seguono il team dal più veloce; chi il motore non conosce resta con "—".
 */
export function SpeedGeneral({ speed, meta, ctx }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members, threats } = speed;
  const slots = offenseSlots(ctx.team, members);
  const rows = ctx.team
    .map((set, slot) => ({ set, m: slots[slot] === null ? null : members[slots[slot]!] }))
    .sort((a, b) => (b.m?.speed ?? -1) - (a.m?.speed ?? -1));
  const [open, setOpen] = useState<MemberSpeed | null>(null);
  const bars = useRef(new Map<string, HTMLButtonElement | null>());
  const tip = (m: MemberSpeed) => m.gains.map(g => `${t(`sdetail.cond.${g.condition}`)} (${g.source}${g.by ? `, ${g.by.join(', ')}` : ''}): +${points(g.gain)}`).join('\n');
  const close = () => {
    const back = open ? bars.current.get(open.species) : null;
    setOpen(null);
    back?.focus();
  };

  // Tessera Velocità: i rivali che nessuno supera da solo
  const holes = threats.filter(th => th.outsped === 0);
  const hiddenHoles = holes.slice(HOLE_ICONS).map(th => th.species).join(', ');
  const controls = speed.sources.filter(src => src.helped > 0);
  const tiles: { key: string; label: string; value: string; cls: string; fact: ReactNode }[] = [
    {
      key: 'speed', label: t('sdetail.speed'), value: String(speed.speed), cls: tone(speed.speed),
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
      key: 'control', label: t('sdetail.control'), value: `+${speed.control}`, cls: speed.control > 0 ? 'good' : 'warn',
      fact: controls.length
        ? <>
          <span className="def-cap"><em>{t('sdetail.tile.control')}</em><b>{t(controls.length === 1 ? 'sdetail.mates.one' : 'sdetail.mates.many', { n: controls.length })}</b></span>
          <span className="def-visual sp-controls">{controls.map(src => <span key={`${src.condition}-${src.move}`} className="sp-control-move" title={src.by.join(', ')}>{src.move}</span>)}</span>
        </>
        : <span className="def-visual def-faint">{t('sdetail.general.controlNone')}</span>,
    },
  ];

  return (
    <div className="def-frame def-general sp-general">
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('sdetail.bar')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ set, m }, i) => {
              const name = battleSpecies(set)?.name ?? set.species;
              return (
                <tr key={`${name}-${i}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  <td>
                    {m
                      ? <StackedBar m={m} title={tip(m)} label={t('sdetail.bar.open', { name: m.species })} onOpen={() => setOpen(m)}
                        refer={el => bars.current.set(m.species, el)} />
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="def-sum def-tiles sp-tiles">
        {tiles.map(tile => (
          <div key={tile.key} className={`def-tile sp-tile ${tile.cls}`}>
            <span className="def-tile-head"><span>{tile.label}</span><b>{tile.value}</b></span>
            <span className="def-tile-fact">{tile.fact}</span>
          </div>
        ))}
      </div>
      {open && <SpeedMemberDialog member={open} set={ctx.team.find(s => (battleSpecies(s)?.name ?? s.species) === open.species) ?? ctx.team[0]} team={ctx.team} meta={meta} onClose={close} />}
    </div>
  );
}

/**
 * La barra a segmenti del membro: la velocità pura (piena), i suoi guadagni (chiaro) e quelli del team (secondo accento),
 * col totale e il dettaglio "58 · +18 · +22". È un bottone: apre il modale del membro.
 */
function StackedBar({ m, title, label, onOpen, refer }: { m: MemberSpeed; title: string; label: string; onOpen: () => void; refer: (el: HTMLButtonElement | null) => void }) {
  const raw = points(m.raw);
  const own = points(m.own) - raw;
  const team = points(m.total) - points(m.own);
  const total = points(m.total);
  const cls = tone(total);
  return (
    <button ref={refer} type="button" className={`sp-bar-btn ${cls}`} aria-label={label} title={title || undefined} onClick={onOpen}>
      <span className="sp-stack" aria-hidden="true">
        <i className="sp-seg-raw" style={{ width: `${raw}%` }} />
        <i className="sp-seg-own" style={{ width: `${Math.max(0, own)}%` }} />
        <i className="sp-seg-team" style={{ width: `${Math.max(0, team)}%` }} />
      </span>
      <span className={`sp-total ${cls}`}>{total}%</span>
      <span className="sp-parts">
        <span>{raw}</span>
        {own > 0 && <span className="sp-part-own">+{own}</span>}
        {team > 0 && <span className="sp-part-team">+{team}</span>}
      </span>
      <Icon name="next" />
    </button>
  );
}

export { CONTROL_CONDITIONS };
