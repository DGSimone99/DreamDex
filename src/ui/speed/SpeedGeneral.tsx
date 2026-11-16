import { useEffect, useRef, useState, type ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import { laneNear, speedItem, type SpeedLane } from '../../engine/overviewDashboard';
import { speedNeighbours } from '../../engine/speed';
import type { TeamSet } from '../../engine/sets';
import { CONTROL_CONDITIONS, type MemberSpeed, type TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { SpeedTip } from '../dashboard/SpeedTip';
import { Icon } from '../icons';
import { offenseSlots } from '../offense/slots';
import { linkTeamCard } from '../teamLink';
import { SpeedMemberDialog } from './SpeedMemberDialog';

const points = (x: number) => Math.round(100 * x);

/**
 * La scala dei vicini per il tooltip della barra, come in Panoramica: i rivali del gruppo del membro (la propria specie
 * esclusa) appena più veloci, appena più lenti e a pari velocità.
 */
function laneOf(m: MemberSpeed, set: TeamSet): SpeedLane {
  const rivals = m.cells.filter(c => c.weight > 0)
    .map(c => ({ species: c.species, value: c.speed, scarf: c.scarf, booster: c.booster, weight: c.weight }));
  return {
    species: m.species, speed: m.speed, share: m.raw, above: m.raw > 0.5,
    near: rivals.length ? laneNear(speedNeighbours(m.speed, rivals)) : null, item: speedItem(set),
  };
}

/**
 * La scheda della Velocità, nella cornice comune (`def-frame`) e con la stessa tabella delle altre aree: i membri
 * nell'ordine del team (come in Offesa e Difesa, così non cambiano posto), ognuno con una barra a segmenti (velocità
 * pura, i guadagni suoi, quelli del team) e il totale; in fondo la riga del team. Passando sulla barra la scala dei
 * rivali vicini (come in Panoramica); la barra è un bottone che apre il modale del membro coi rivali e i check "e se".
 * Chi il motore non conosce resta con "—".
 */
export function SpeedGeneral({ speed, meta, ctx }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members } = speed;
  const slots = offenseSlots(ctx.team, members);
  const [open, setOpen] = useState<{ m: MemberSpeed; set: TeamSet; slot: number } | null>(null);
  const bars = useRef(new Map<number, HTMLButtonElement | null>());
  const tip = useFloatAnchor<number>();
  // Uscendo dalla scheda nessuna carta resta accesa
  useEffect(() => () => linkTeamCard(null), []);
  const close = () => {
    const back = open ? bars.current.get(open.slot) : null;
    setOpen(null);
    back?.focus();
  };
  const lane = (slot: number) => {
    const index = slots[slot];
    return index === null || index === undefined ? null : laneOf(members[index], ctx.team[slot]);
  };
  const shown = tip.anchor ? lane(tip.anchor.key) : null;
  // Il nome del guadagno e la sua fonte, una volta sola se coincidono ("Sticky Web", non "Sticky Web · Sticky Web")
  const label = (condition: MemberSpeed['gains'][number]['condition'], source: string) => {
    const name = t(`sdetail.cond.${condition}`);
    return name === source ? source : `${name} · ${source}`;
  };
  // Sotto la scala, cosa aggiunge ogni guadagno: "Setup · Dragon Dance: +18"
  const gains = (m: MemberSpeed) => (m.gains.length
    ? <ul className="stip-gains">{m.gains.map(g => (
      <li key={`${g.condition}-${g.source}`}><span>{label(g.condition, g.source)}{g.by ? ` (${g.by.join(', ')})` : ''}</span><b>+{points(g.gain)}</b></li>
    ))}</ul>
    : null);
  const teamSpeed = Math.round(speed.speed);
  const teamControl = Math.max(0, Math.round(speed.value) - teamSpeed);

  return (
    <div className="def-frame def-general sp-general">
      <div className="ad-scroll">
        <table className="def-grid def-members" aria-label={`${t('area.speed')}: ${t('detail.tab.general')}`}>
          <colgroup><col className="def-col-mon" /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('area.speed')}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const index = slots[slot];
              const m = index === null || index === undefined ? null : members[index];
              return (
                // Passando sulla riga si accende anche la carta del membro nel team in alto
                <tr key={`${name}-${slot}`} onMouseEnter={() => linkTeamCard(slot)} onMouseLeave={() => linkTeamCard(null)}>
                  <th scope="row"><MemberMon name={name} set={set} stats="speed" /></th>
                  <td>
                    {m
                      ? (
                        <button ref={el => { bars.current.set(slot, el); }} type="button" className={`sp-bar-btn ${tone(points(m.total))}`}
                          aria-label={t('sdetail.bar.open', { name: m.species })} onClick={() => { tip.close(); setOpen({ m, set, slot }); }}
                          onMouseEnter={e => tip.open(slot, e.currentTarget)} onMouseLeave={tip.close}
                          onFocus={e => tip.open(slot, e.currentTarget)} onBlur={tip.close}>
                          <Stack raw={points(m.raw)} own={points(m.own) - points(m.raw)} team={points(m.total) - points(m.own)} total={points(m.total)} />
                          <Icon name="next" />
                        </button>
                      )
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {/* Riempie lo spazio che resta: la riga del team sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={2} /></tr>
          </tbody>
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{t('sdetail.gen.total')}</span></th>
              <td>
                <span className={`sp-bar-btn sp-team ${tone(Math.round(speed.value))}`}>
                  <Stack raw={teamSpeed} own={0} team={teamControl} total={Math.round(speed.value)} />
                  <span aria-hidden="true" />
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* In alto a destra, come nelle altre aree: cosa sono i pezzi a righe della barra */}
      <div className="rob-legend og-legend" aria-hidden="true"><span className="area-legend">
        <span className="area-legend-swatch"><i className="sp-leg own" />{t('sdetail.legendOwn')}</span>
        <span className="area-legend-swatch"><i className="sp-leg team" />{t('guide.speed.gains.control')}</span>
      </span></div>
      {shown && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className="speed" side="left">
          <SpeedTip lane={shown} vsMeta={meta} extra={gains(members[slots[tip.anchor.key]!])} />
        </FloatTip>
      )}
      {open && <SpeedMemberDialog member={open.m} set={open.set} team={ctx.team} meta={meta} onClose={close} />}
    </div>
  );
}

/**
 * La barra a segmenti: la velocità pura (piena, nel colore del voto), i guadagni propri (righe ciano) e quelli del
 * team (righe neutre), col totale e il dettaglio "58 · +18 · +22". Per i membri sta in un bottone che apre il modale.
 */
function Stack({ raw, own, team, total }: { raw: number; own: number; team: number; total: number }): ReactNode {
  const cls = tone(total);
  return (
    <>
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
    </>
  );
}

export { CONTROL_CONDITIONS };
