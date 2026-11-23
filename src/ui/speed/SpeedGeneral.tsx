import { useEffect, useRef, useState, type ReactNode } from 'react';
import { battleSpecies, getMove } from '../../engine/dex';
import { laneNear, speedItem, type SpeedLane } from '../../engine/overviewDashboard';
import { speedNeighbours } from '../../engine/speed';
import type { TeamSet } from '../../engine/sets';
import {
  CONTROL_CONDITIONS, priorityMoves, roomShare, SHOWN_CONTROL, shownTotal, teamSpeedOf, type MemberSpeed, type TeamSpeed,
} from '../../engine/speedArea';
import { anyGameName, gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { familyAt, type AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { FloatTip, TipGo, useFloatAnchor } from '../FloatTip';
import { SpeedTip } from '../dashboard/SpeedTip';
import { Icon } from '../icons';
import { offenseSlots } from '../offense/slots';
import { linkTeamCard } from '../teamLink';
import { TIP_NEUTRAL, TipGlyph, TipHead, TipRow, TipRows, TipSec } from '../TipHead';
import { tileStyle, typeIconUrl } from '../typeIcons';
import { SpeedMemberDialog } from './SpeedMemberDialog';

const points = (x: number) => Math.round(100 * x);

/** I segni della scala sotto le barre (la metà, 50, è anche la riga tratteggiata in ogni barra). */
const TICKS = [0, 25, 50, 75, 100];

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

/** I numeri di una barra: la velocità pura, i guadagni suoi, il controllo del team mostrato e il totale (0-100). */
interface Parts { raw: number; own: number; team: number; total: number }

/**
 * La scheda della Velocità, nella cornice comune (`def-frame`) e con la stessa tabella delle altre aree: i membri
 * nell'ordine del team (come in Offesa e Difesa, così non cambiano posto), sotto il nome la Velocità vera ("Speed 300",
 * "· muro" per i muri) e l'etichetta "priorità" se il set ha una mossa d'attacco con priorità; ognuno con una barra a
 * tutta larghezza (velocità pura nel colore del voto, i guadagni suoi a righe ciano, il controllo del team a righe
 * neutre, la riga tratteggiata a metà del meta) e a destra il totale grande coi pezzi piccoli prima; sotto la scala
 * 0-100 e in fondo la riga del team. I muri non hanno colori di stato: per loro essere lenti va bene (grigio).
 * Trick Room non sta nel controllo del team: con l'interruttore in alto (`room`, solo se un membro lo porta) le barre
 * dicono prima di quanti del meta muove ogni membro in Trick Room (i lenti in alto; le spinte non contano).
 * Passando sulla barra la scala dei rivali vicini (come in Panoramica, in Trick Room nel suo ordine); la barra è un
 * bottone che apre il modale del membro coi rivali e i check "e se" (in Trick Room col check Trick Room acceso).
 * Chi il motore non conosce resta con "—". I muri: chi ha come famiglia principale i muri (`needs.primary`, la stessa
 * decisione dei ruoli sulla carta del team e dei bisogni: il verdetto degli EV, poi il valore migliore fra Attacco e muri).
 */
export function SpeedGeneral({ speed, meta, ctx, room = false }: { speed: TeamSpeed; meta: boolean; ctx: AreaContext; room?: boolean }) {
  const t = useT();
  const lang = useLang();
  const { members } = speed;
  const slots = offenseSlots(ctx.team, members);
  const [open, setOpen] = useState<{ m: MemberSpeed; set: TeamSet; slot: number } | null>(null);
  const bars = useRef(new Map<number, HTMLButtonElement | null>());
  const tip = useFloatAnchor<number>();
  const prio = useFloatAnchor<number>();
  // Uscendo dalla scheda nessuna carta resta accesa
  useEffect(() => () => linkTeamCard(null), []);
  const close = () => {
    const back = open ? bars.current.get(open.slot) : null;
    setOpen(null);
    back?.focus();
  };
  const memberAt = (slot: number) => {
    const index = slots[slot];
    return index === null || index === undefined ? null : members[index];
  };
  const shown = tip.anchor ? (() => { const m = memberAt(tip.anchor.key); return m ? laneOf(m, ctx.team[tip.anchor.key]) : null; })() : null;
  // Come ogni setup nei tooltip: il nome della mossa (o abilità, strumento) come titolo, sotto che cosa è ("Setup") e chi
  // la porta; una volta sola se coincidono ("Rete Vischiosa", non "Rete Vischiosa · Rete Vischiosa")
  const label = (condition: MemberSpeed['gains'][number]['condition'], source: string, by?: string[]) => {
    const name = t(`sdetail.cond.${condition}`);
    const from = anyGameName(source, lang);
    const sub = [name === from ? '' : name, by?.join(', ') ?? ''].filter(Boolean).join(' · ');
    return { title: from, sub: sub || undefined };
  };
  // Sotto la scala, cosa aggiunge ogni guadagno alla barra: "Dragodanza" (sotto "Setup") e a destra "+18", gli stessi punti
  // dei pezzi a righe della barra ("55 +18"); Distortozona no: ha il suo interruttore; in Distortozona nessuno, le spinte lì
  // non contano
  const gains = (m: MemberSpeed) => {
    const list = room ? [] : m.gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition) || SHOWN_CONTROL.includes(g.condition));
    return list.length
      ? (
        <TipSec label={t('sdetail.gains')} className="stip-gains">
          <TipRows>
            {list.map(g => (
              <TipRow key={`${g.condition}-${g.source}`} {...label(g.condition, g.source, g.by)}
                value={`+${points(g.gain)}`} tone="good" />
            ))}
          </TipRows>
        </TipSec>
      )
      : null;
  };
  /** I numeri della barra di un membro: in Trick Room solo la quota prima della quale muove, senza pezzi a righe. */
  const partsOf = (m: MemberSpeed): Parts => {
    if (room) { const share = points(roomShare(m)); return { raw: share, own: 0, team: 0, total: share }; }
    const raw = points(m.raw);
    const own = points(m.own);
    const total = points(shownTotal(m));
    return { raw, own: own - raw, team: total - own, total };
  };
  // La riga del team, come il voto (media dei membri, i tank a metà): la velocità sua e il controllo mostrato
  const teamParts: Parts = room
    ? (() => { const v = Math.round(teamSpeedOf(members, roomShare)); return { raw: v, own: 0, team: 0, total: v }; })()
    : (() => {
      const raw = Math.round(speed.speed);
      const total = Math.round(teamSpeedOf(members, shownTotal));
      return { raw, own: 0, team: Math.max(0, total - raw), total };
    })();
  const head = t(room ? (meta ? 'sdetail.head.roomMeta' : 'sdetail.head.roomTier') : meta ? 'sdetail.head.meta' : 'sdetail.head.tier');
  const prioOpen = prio.anchor ? priorityMoves(ctx.team[prio.anchor.key], ctx.team) : [];

  return (
    <div className={`def-frame def-general sp-general${room ? ' sp-room' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid def-members" aria-label={`${t('area.speed')}: ${t('detail.tab.general')}`}>
          <colgroup><col className="def-col-mon" /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col"><span className="sp-head"><span>{head}</span>{/* A destra la parola solo in Trick Room: fuori la testata dice già "Velocità" */}<span className="sp-head-val">{room ? t('area.speed') : null}</span></span></th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const m = memberAt(slot);
              const wall = familyAt(ctx, slot) === 'wall';
              const moves = m ? priorityMoves(set, ctx.team) : [];
              const prioTag = moves.length > 0 && (
                <span className="sp-prio" tabIndex={0} aria-label={t('sdetail.prio.label', { moves: moves.map(m => gameName('move', m, lang)).join(', ') })} {...prio.bind(slot)}>
                  {t('sdetail.prio')}
                </span>
              );
              const parts = m ? partsOf(m) : null;
              // I muri restano grigi (solo fuori da Trick Room): per loro la lentezza non è un difetto
              const cls = parts ? (wall && !room ? 'wall' : tone(parts.total)) : '';
              return (
                // Passando sulla riga si accende anche la carta del membro nel team in alto
                <tr key={`${name}-${slot}`} onMouseEnter={() => linkTeamCard(slot)} onMouseLeave={() => linkTeamCard(null)}>
                  <th scope="row">
                    <MemberMon name={name} set={set} stats="speed" nameTag={prioTag || undefined}>
                      {wall ? <span className="sp-wall">· {t('sdetail.wall')}</span> : undefined}
                    </MemberMon>
                  </th>
                  <td>
                    {m && parts
                      ? (
                        <button ref={el => { bars.current.set(slot, el); }} type="button" className={`sp-bar-btn ${cls}`}
                          aria-label={t('sdetail.bar.open', { name: m.species })} onClick={() => { tip.close(); setOpen({ m, set, slot }); }}
                          onMouseEnter={e => tip.open(slot, e.currentTarget)} onMouseLeave={tip.close}
                          onFocus={e => tip.open(slot, e.currentTarget)} onBlur={tip.close}>
                          <Stack {...parts} />
                          <Icon name="next" />
                        </button>
                      )
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {/* La scala sotto le barre: 0, 25, 50 (la metà del meta), 75, 100 */}
            <tr className="sp-scale" aria-hidden="true">
              <td />
              <td><span className="sp-scale-line"><span className="sp-scale-ticks">
                {TICKS.map(v => <span key={v} style={{ left: `${v}%` }}>{v}</span>)}
              </span></span></td>
            </tr>
            {/* Riempie lo spazio che resta: la riga del team sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={2} /></tr>
          </tbody>
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{t('sdetail.gen.total')}</span></th>
              <td>
                <span className={`sp-bar-btn sp-team ${tone(teamParts.total)}`}>
                  <Stack {...teamParts} bare />
                  <span aria-hidden="true" />
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* In alto a destra, come nelle altre aree: cosa sono i pezzi a righe della barra (in Trick Room una riga sola) */}
      <div className="rob-legend og-legend" aria-hidden="true"><span className="area-legend">
        {room
          ? <span className="sp-room-note">{t('sdetail.room.legend')}</span>
          : <>
            <span className="area-legend-swatch"><i className="sp-leg own" />{t('sdetail.legendOwn')}</span>
            <span className="area-legend-swatch"><i className="sp-leg team" />{t('guide.speed.gains.control')}</span>
            <span className="area-legend-swatch"><i className="sp-leg half" />{t('sdetail.legendHalf')}</span>
          </>}
      </span></div>
      {shown && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={room ? 'var(--room)' : TIP_NEUTRAL} className="tip-w-m speed" side="left">
          <SpeedTip lane={shown} vsMeta={meta} room={room} extra={gains(memberAt(tip.anchor.key)!)} />
          {/* Il clic apre la finestra coi rivali (non un'altra scheda): lo stesso piede col verbo "apri"; il nome del pulsante lo dice già */}
          <TipGo place={t('sdetail.bar.go')} verb="open" />
        </FloatTip>
      )}
      {prio.anchor && prioOpen.length > 0 && (
        <FloatTip rect={prio.anchor.rect} tone="var(--accent)" className="tip-w-s sp-prio-ftip">
          <TipHead lead={<TipGlyph icon="speed" />} title={t('sdetail.prio.title')} sub={t('sdetail.prio.sub')} />
          <TipSec>
            <TipRows>
              {prioOpen.map(name => {
                const move = getMove(name);
                // Scivolerba ha priorità 0 sulla carta: qui c'è perché col Campo Erboso arriva a +1
                return (
                  <TipRow key={name} title={gameName('move', name, lang)} value={<span className="mtip-prio">{`+${Math.max(1, move?.priority ?? 1)}`}</span>}
                    lead={move && <img className="ti-sq" style={tileStyle(move.type)} src={typeIconUrl(move.type)} alt="" draggable={false} />} />
                );
              })}
            </TipRows>
          </TipSec>
        </FloatTip>
      )}
      {open && <SpeedMemberDialog member={open.m} set={open.set} team={ctx.team} meta={meta} room={room} onClose={close} />}
    </div>
  );
}

/**
 * La barra a segmenti, a tutta larghezza e col lato destro inclinato come i pezzi di Offesa e Difesa: la velocità pura
 * (piena, nel colore del voto o grigia per i muri, con un filo di luce in alto), i guadagni propri (righe ciano) e quelli
 * del team (righe neutre); la riga tratteggiata a metà. A destra i pezzi piccoli ("55 +20") e il totale grande. Per i
 * membri sta in un bottone che apre il modale; nella riga del team senza il totale (`bare`: il voto della Velocità sta
 * nella testata dell'area).
 */
function Stack({ raw, own, team, total, bare = false }: Parts & { bare?: boolean }): ReactNode {
  return (
    <>
      <span className="sp-stack" aria-hidden="true">
        <i className="sp-seg-raw" style={{ width: `${raw}%` }} />
        {own > 0 && <i className="sp-seg-own" style={{ width: `${own}%` }} />}
        {team > 0 && <i className="sp-seg-team" style={{ width: `${team}%` }} />}
        <b className="sp-half" />
      </span>
      {/* `bare` (la riga del team): i pezzi sì, il totale no (il voto della Velocità sta già nella testata). Un membro
          senza guadagni (e in Trick Room) ha solo il totale: il pezzo ripeterebbe lo stesso numero */}
      <span className="sp-val">
        {(bare || own > 0 || team > 0) && <span className="sp-parts">
          <span>{raw}</span>
          {own > 0 && <span className="sp-part-own">+{own}</span>}
          {team > 0 && <span className="sp-part-team">+{team}</span>}
        </span>}
        <span className="sp-total">{bare ? null : `${total}%`}</span>
      </span>
    </>
  );
}

export { CONTROL_CONDITIONS };
