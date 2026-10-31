import { useRef, useState } from 'react';
import { battleSpecies } from '../../engine/dex';
import type { TeamSet } from '../../engine/sets';
import { CONTROL_CONDITIONS, type MemberSpeed, type TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { Icon } from '../icons';
import { offenseSlots } from '../offense/slots';
import { SpeedMemberDialog } from './SpeedMemberDialog';

const points = (x: number) => Math.round(100 * x);

/**
 * La scheda della Velocità, nella cornice comune (`def-frame`): i membri dal più veloce, ognuno con una barra a segmenti
 * (velocità pura, i guadagni suoi, quelli del team) e il totale; la barra è un bottone che apre il modale del membro coi
 * rivali e i check "e se". Niente tessere sotto (scelta dell'utente): la tabella basta.
 * Le righe seguono il team dal più veloce; chi il motore non conosce resta con "—".
 */
export function SpeedGeneral({ speed, meta, ctx }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members } = speed;
  const slots = offenseSlots(ctx.team, members);
  const rows = ctx.team
    .map((set, slot) => ({ set, m: slots[slot] === null ? null : members[slots[slot]!] }))
    .sort((a, b) => (b.m?.speed ?? -1) - (a.m?.speed ?? -1));
  const [open, setOpen] = useState<{ m: MemberSpeed; set: TeamSet; slot: number } | null>(null);
  const bars = useRef(new Map<number, HTMLButtonElement | null>());
  const tip = (m: MemberSpeed) => m.gains.map(g => `${t(`sdetail.cond.${g.condition}`)} (${g.source}${g.by ? `, ${g.by.join(', ')}` : ''}): +${points(g.gain)}`).join('\n');
  const close = () => {
    const back = open ? bars.current.get(open.slot) : null;
    setOpen(null);
    back?.focus();
  };

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
                  <th scope="row"><MemberMon name={name} set={set} stats="speed" /></th>
                  <td>
                    {m
                      ? <StackedBar m={m} title={tip(m)} label={t('sdetail.bar.open', { name: m.species })} onOpen={() => setOpen({ m, set, slot: i })}
                        refer={el => bars.current.set(i, el)} />
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <SpeedMemberDialog member={open.m} set={open.set} team={ctx.team} meta={meta} onClose={close} />}
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
