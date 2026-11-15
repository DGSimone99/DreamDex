import { useState } from 'react';
import { COVERED_LEVEL } from '../../engine/coach';
import { battleSpecies } from '../../engine/dex';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { bestAttackMultiplier, teamField, TYPES } from '../../engine/types';
import { EffTag, effClass, effLabel } from '../effTag';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { TypeIcons } from '../typeIcons';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { FocusNote, inBand, koBandOf } from './KoBadges';
import { TypeHitTip } from './TypeHitTip';
import { offenseSlots } from './slots';

/** Colore della riga Copertura: rosso a 0, giallo sotto il livello coperto (50), verde da lì. */
const coverTone = (value: number) => (value === 0 ? 'bad' : value < COVERED_LEVEL ? 'warn' : 'good');

/**
 * Il pacchetto dei tipi dell'Offesa: stessa griglia della Difesa (un membro per riga, 18 tipi in colonna) con, per ogni tipo,
 * il danno del colpo migliore del membro sul Pokémon medio (verde = oltre il 66%, vale almeno metà; giallo = oltre il 33%,
 * conta; vuota = non conta). Il filo sotto l'icona è rosso sui tipi che nessuno manda KO in due colpi (scoperti); in fondo la riga
 * Copertura. Chi il motore ha scartato resta con le caselle vuote. In basso a sinistra ×2 (o ×4) se il membro ha almeno una
 * mossa superefficace sul tipo, anche se il danno migliore viene da un'altra; "Solo superefficaci" (`ctx.effOnly`) spegne le
 * altre caselle. Col puntatore la colonna si accende e sotto l'icona compare il tipo; sulla casella il tooltip DreamDex con la
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
  const onceName = (m: MemberOffense) => (m.oneUse
    ? m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })
    : null);
  const memberAt = (slot: number) => (slots[slot] === null ? null : offense.members[slots[slot]!]);
  // Chi colpisce più forte ogni tipo (colpo semplice); niente sotto il 33%, dove il colpo non conta
  const best = TYPES.map(type => {
    let top: { slot: number; pct: number } | null = null;
    team.forEach((_, slot) => {
      const pct = memberAt(slot)?.hits.find(h => h.label === type)?.plainPct ?? 0;
      if (pct > (top?.pct ?? 33)) top = { slot, pct };
    });
    return top as { slot: number; pct: number } | null;
  });
  const open = tip.anchor ? { ...tip.anchor.key, member: memberAt(tip.anchor.key.slot) } : null;
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
                    onMouseEnter={() => setHover({ row: -1, col: i })}>
                    <TypeIcons types={[type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(type, lang)}{hole && ` ${t('odetail.types.hole')}`}</span>
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
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {TYPES.map((type, i) => {
                    if (slots[slot] === null) return <td key={type} className={colClass(i, `ct-cell${ctx.effOnly ? ' eff-dim' : ''}${focus ? ' kf-dim' : ''}`)} onMouseEnter={() => setHover({ row: slot, col: i })}>—</td>;
                    const tag = effLabel(bestAttackMultiplier(set, [type], '', field), 'offense');
                    const found = member?.hits.find(h => h.label === type);
                    const hit = found && found.credit > 0 ? found : undefined;
                    const strong = !!hit && hit.credit >= 0.5;
                    // Il triangolo del setup, come nella Generale: solo se la danza fa salire di fascia (fino al 2HKO o all'OHKO)
                    const rank = (pct: number | null | undefined) => { const b = pct == null ? null : koBandOf(pct); return b === 'ohko' ? 2 : b === 'two' ? 1 : 0; };
                    const lifted = !!found && found.setupPct !== null && rank(found.setupPct) > rank(found.plainPct);
                    return (
                      <td key={type} className={colClass(i, `ct-cell${hit ? (strong ? ' ok-full' : ' ok-half') : ''}${lifted ? ' has-setup' : ''}${effClass(tag, 'offense', ctx.effOnly)}${focus ? (slot === focus.slot && found && inBand(found.plainPct, focus.band) ? ' kf-hit' : ' kf-dim') : ''}`)}
                        onMouseEnter={e => { setHover({ row: slot, col: i }); if (hit) tip.open({ slot, type }, e.currentTarget); else tip.close(); }} onMouseLeave={tip.close}>
                        {hit && <>
                          <span className="ct-num">{hit.pct}<i>%</i></span>
                          <span className="visually-hidden"> {t(strong ? 'odetail.types.covers' : 'odetail.types.half')}</span>
                        </>}
                        <EffTag label={tag} side="offense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('detail.level')}</th>
              {TYPES.map((type, i) => {
                const level = byType.get(type)?.level ?? 0;
                return <td key={type} className={colClass(i)}><span className={`ct-pill ${coverTone(level)}`}>{level}%</span></td>;
              })}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row">{t('odetail.types.best')}</th>
              {TYPES.map((type, i) => {
                const top = best[i];
                const who = top === null ? null : battleSpecies(team[top.slot])?.name ?? team[top.slot].species;
                return (
                  <td key={type} className={colClass(i)}>
                    {who
                      ? <span className="ct-best-mon"><Sprite species={who} size={34} /><span className="visually-hidden">{who}</span></span>
                      : <span className="ct-best-none" aria-label={t('odetail.types.hole')}>—</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {open?.member && openHit && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(open.type)} className="tht">
          <TypeHitTip species={open.member.species} type={open.type} hit={openHit} setupMove={open.member.setupMove} onceName={onceName(open.member)} />
        </FloatTip>
      )}
      <div className="rob-legend ht-foot">{focus
        ? <FocusNote name={battleSpecies(ctx.team[focus.slot])?.name ?? ctx.team[focus.slot]?.species ?? ''} band={focus.band} onClear={ctx.clearFocus} />
        : <span className="area-legend" aria-hidden="true"><OffenseTypesLegend /></span>}</div>
    </div>
  );
}

/** La legenda dei colori della scheda dei tipi dell'Offesa, in alto a destra: forte, conta. */
function OffenseTypesLegend() {
  const t = useT();
  return (
    <>
      <span className="area-legend-swatch"><i className="ok-full" />{t('odetail.types.legendFull')}</span>
      <span className="area-legend-swatch"><i className="ok-half" />{t('odetail.types.legendHalf')}</span>
    </>
  );
}
