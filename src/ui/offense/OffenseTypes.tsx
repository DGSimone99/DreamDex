import { useState } from 'react';
import { COVERED_LEVEL } from '../../engine/coach';
import { battleSpecies } from '../../engine/dex';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { STRONG_CREDIT } from '../../engine/offense';
import { typeAverage } from '../../engine/coverage';
import { DEFAULT_FORMAT } from '../../engine/format';
import { moveAttackMultiplier, teamField, TYPES } from '../../engine/types';
import { EffTag, effClass, effLabel } from '../effTag';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { TypeIcons, typeIconUrl } from '../typeIcons';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { useMemberTip } from '../MemberCard';
import { FocusNote, inBand, koBandOf } from './KoBadges';
import { TypeHitTip } from './TypeHitTip';
import { offenseSlots } from './slots';

/** Colore della riga Copertura: rosso a 0, giallo sotto il livello coperto (COVERED_LEVEL, 60), verde da lì. */
const coverTone = (value: number) => (value === 0 ? 'bad' : value < COVERED_LEVEL ? 'warn' : 'good');

/**
 * Il pacchetto dei tipi dell'Offesa: stessa griglia della Difesa (un membro per riga, 18 tipi in colonna) con, per ogni tipo,
 * il danno del colpo migliore del membro sul Pokémon medio (verde = dal 66%; giallo = dal 50%, KO in due colpi,
 * conta; vuota = non conta). Il filo sotto l'icona è rosso sui tipi che nessuno manda KO in due colpi (scoperti); in fondo la riga
 * Copertura. Chi il motore ha scartato resta con le caselle vuote. In basso a sinistra ×2 (o ×4) se è superefficace la mossa
 * che fa il danno della casella; "Solo superefficaci" (`ctx.effOnly`) spegne le altre caselle. Col puntatore la colonna si accende e sotto l'icona compare il tipo; sulla casella il tooltip DreamDex con la
 * mossa e quanti colpi servono. Le colonne dei tipi scoperti hanno un velo rosso. Sotto Copertura la riga "Il migliore": la
 * sprite di chi colpisce più forte ogni tipo. In alto a destra la legenda dei colori.
 */
export function OffenseTypes({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  // Aperta da una tessera della Generale: la riga del membro e i tipi di quella fascia accesi, il resto spento
  const focus = ctx.focus?.kind === 'types' ? ctx.focus : null;
  const t = useT();
  const lang = useLang();
  const { team } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const { rows, holes } = offense.types;
  const byType = new Map(rows.map(row => [row.label, row]));
  const slots = offenseSlots(team, offense.members);
  const field = teamField(team);
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col', holes.includes(TYPES[col]) && 'ct-hole'].filter(Boolean).join(' ') || undefined;
  const tip = useFloatAnchor<{ slot: number; type: string }>();
  // Sulla sprite del migliore la carta del Pokémon col suo set
  const card = useMemberTip(400, undefined, true);
  const onceName = (m: MemberOffense) => (m.oneUse
    ? m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })
    : null);
  const memberAt = (slot: number) => (slots[slot] === null ? null : offense.members[slots[slot]!]);
  // Chi colpisce più forte ogni tipo (colpo semplice); niente sotto il 50%, dove il colpo non conta
  const best = TYPES.map(type => {
    let top: { slot: number; pct: number } | null = null;
    team.forEach((_, slot) => {
      const pct = memberAt(slot)?.hits.find(h => h.label === type)?.plainPct ?? 0;
      if (pct > (top?.pct ?? 49)) top = { slot, pct };
    });
    return top as { slot: number; pct: number } | null;
  });
  // slot -1: il tooltip del tipo in testata (le statistiche medie del bersaglio)
  const open = tip.anchor && tip.anchor.key.slot >= 0 ? { ...tip.anchor.key, member: memberAt(tip.anchor.key.slot) } : null;
  const headType = tip.anchor && tip.anchor.key.slot < 0 ? tip.anchor.key.type : null;
  const formatId = ctx.formatId ?? DEFAULT_FORMAT.formatId;
  const averageOf = (type: string) => typeAverage(type as (typeof TYPES)[number], { stats: null, sets: null, formatId });
  const statsLabel = (a: { hp: number; def: number; spd: number }) => `${t('stat.hp')} ${a.hp}, ${t('stat.def')} ${a.def}, ${t('stat.spd')} ${a.spd}`;
  const openHit = open?.member?.hits.find(h => h.label === open.type);

  return (
    <div className={`def-frame off-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => { setHover(null); tip.close(); }}>
          <colgroup><col className="def-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {TYPES.map((type, i) => {
                const hole = holes.includes(type);
                return (
                  <th key={type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')}
                    onMouseEnter={e => { setHover({ row: -1, col: i }); tip.open({ slot: -1, type }, e.currentTarget); }} onMouseLeave={tip.close}>
                    <TypeIcons types={[type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(type, lang)}{hole && ` ${t('odetail.types.hole')}`}{` · ${statsLabel(averageOf(type))}`}</span>
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
                <tr key={`${name}-${slot}`} className={[hover?.row === slot && 'x-row', focus && (slot === focus.slot ? 'kf-row' : 'kf-off')].filter(Boolean).join(' ') || undefined}>
                  <th scope="row" onMouseEnter={() => { setHover({ row: slot, col: -1 }); tip.close(); }}><MemberMon name={name} set={set} stats="offense" /></th>
                  {TYPES.map((type, i) => {
                    if (slots[slot] === null) return <td key={type} className={colClass(i, `ct-cell${ctx.effOnly ? ' eff-dim' : ''}${focus ? ' kf-dim' : ''}`)} onMouseEnter={() => setHover({ row: slot, col: i })}>—</td>;
                    // ×2 / ×4 solo se è superefficace la mossa che fa il danno della casella (Pixilate & co. compresi)
                    const found = member?.hits.find(h => h.label === type);
                    const tag = effLabel(found?.move ? moveAttackMultiplier(set, found.move, [type], '', field) : null, 'offense');
                    const hit = found && found.credit > 0 ? found : undefined;
                    const strong = !!hit && hit.credit >= STRONG_CREDIT;
                    // Il 100%: un verde a parte, più acceso (come i pezzi OHKO della Generale)
                    const ohko = !!hit && hit.pct >= 100;
                    // Il triangolo del setup, come nella Generale: solo se la danza fa salire di fascia (fino al 2HKO o all'OHKO)
                    const rank = (pct: number | null | undefined) => { const b = pct == null ? null : koBandOf(pct); return b === 'ohko' ? 2 : b === 'two' ? 1 : 0; };
                    const lifted = !!found && found.setupPct !== null && rank(found.setupPct) > rank(found.plainPct);
                    // Il triangolo azzurro: il meteo o il campo di un compagno lo fa salire di fascia
                    const teamUp = !!found && found.teamPct !== null && rank(found.teamPct) > rank(found.plainPct);
                    // Solo coi due insieme (setup e meteo del team): tutti e due i triangoli, il tooltip dice che servono entrambi
                    const bothUp = !!found && !lifted && !teamUp && found.comboPct !== null && rank(found.comboPct) > rank(found.plainPct);
                    return (
                      <td key={type} className={colClass(i, `ct-cell${hit ? (ohko ? ' ok-full ok-ohko' : strong ? ' ok-full' : ' ok-half') : ''}${lifted || bothUp ? ' has-setup' : ''}${teamUp || bothUp ? ' has-team' : ''}${effClass(tag, 'offense', ctx.effOnly)}${focus ? (slot === focus.slot && found && inBand(found.plainPct, focus.band) ? ' kf-hit' : ' kf-dim') : ''}`)}
                        onMouseEnter={e => { setHover({ row: slot, col: i }); if (hit) tip.open({ slot, type }, e.currentTarget); else tip.close(); }} onMouseLeave={tip.close}>
                        {hit && <>
                          <span className="ct-num">{hit.pct}<i>%</i></span>
                          <span className="visually-hidden"> {ohko ? 'OHKO' : t(strong ? 'odetail.types.covers' : 'odetail.types.half')}</span>
                        </>}
                        <EffTag label={tag} side="offense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row" onMouseEnter={() => setHover(null)}>{t('detail.level')}</th>
              {TYPES.map((type, i) => {
                const level = byType.get(type)?.level ?? 0;
                return <td key={type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}><span className={`ct-pill ${coverTone(level)}`}>{level}%</span></td>;
              })}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row" onMouseEnter={() => setHover(null)}>{t('odetail.types.best')}</th>
              {TYPES.map((type, i) => {
                const top = best[i];
                const who = top === null ? null : battleSpecies(team[top.slot])?.name ?? team[top.slot].species;
                return (
                  <td key={type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}>
                    {who
                      ? <span className="ct-best-mon" {...card.bind(team[top!.slot])}><Sprite species={who} size={34} /><span className="visually-hidden">{who}</span></span>
                      : <span className="ct-best-none" aria-label={t('odetail.types.hole')}>—</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {card.tip}
      {headType && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(headType)} className="tst">
          <TypeTargetTip type={headType} stats={averageOf(headType)} />
        </FloatTip>
      )}
      {open?.member && openHit && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(open.type)} className="tht">
          <TypeHitTip species={open.member.species} set={team[open.slot]} type={open.type} hit={openHit} setupMove={open.member.setupMove} onceName={onceName(open.member)} />
        </FloatTip>
      )}
      <div className="rob-legend ht-foot">{focus
        ? <FocusNote name={battleSpecies(ctx.team[focus.slot])?.name ?? ctx.team[focus.slot]?.species ?? ''} band={focus.band} onClear={ctx.clearFocus} />
        : <span className="area-legend" aria-hidden="true"><OffenseTypesLegend /></span>}</div>
    </div>
  );
}

/**
 * Il tooltip del tipo in testata: le statistiche base medie del Pokémon medio di quel tipo nel Pokédex del formato,
 * il bersaglio su cui si misurano i colpi della colonna (prima stavano nella guida, sotto una freccina).
 */
function TypeTargetTip({ type, stats }: { type: string; stats: { hp: number; def: number; spd: number } }) {
  const t = useT();
  const lang = useLang();
  const cells: [string, number][] = [[t('stat.hp'), stats.hp], [t('stat.def'), stats.def], [t('stat.spd'), stats.spd]];
  return (
    <>
      <div className="ftip-head">
        <img src={typeIconUrl(type)} alt="" draggable={false} />
        <b>{typeName(type as (typeof TYPES)[number], lang)}</b>
      </div>
      <div className="tst-stats">
        {cells.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}
      </div>
      <p className="ftip-foot">{t('guide.off.targets.tip')}</p>
    </>
  );
}

/** La legenda dei colori della scheda dei tipi dell'Offesa, in alto a destra: OHKO, forte, medio. */
function OffenseTypesLegend() {
  const t = useT();
  return (
    <>
      <span className="area-legend-swatch"><i className="ok-full ok-ohko" />OHKO</span>
      <span className="area-legend-swatch"><i className="ok-full" />{t('odetail.types.legendFull')}</span>
      <span className="area-legend-swatch"><i className="ok-half" />{t('odetail.types.legendHalf')}</span>
      <span className="area-legend-swatch"><i className="kob-tri" />{t('kob.legendSetupShort')}</span>
      <span className="area-legend-swatch"><i className="kob-tri team" />{t('kob.legendTeam')}</span>
    </>
  );
}
