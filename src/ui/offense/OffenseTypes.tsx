import { useEffect, useId, useState, type FocusEvent } from 'react';
import { GRID_CELLS, useRoving } from '../useRoving';
import { COVERED_LEVEL } from '../../engine/coach';
import { battleSpecies } from '../../engine/dex';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { STRONG_CREDIT } from '../../engine/offense';
import { typeAverage } from '../../engine/coverage';
import { DEFAULT_FORMAT } from '../../engine/format';
import { moveAttackMultiplier, teamField, TYPES } from '../../engine/types';
import { EffLegend, EffTag, effClass, effLabel } from '../effTag';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { TypeIcons } from '../typeIcons';
import { TypeStatsTip } from '../TypeStatsTip';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { useMemberTip } from '../MemberCard';
import { FocusNote, inBand, koBandOf } from './KoBadges';
import { TypeHitTip } from './TypeHitTip';
import { offenseSlots } from './slots';
import { PokemonIcon } from '../PokemonName';
import { FLIP_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { AnalysisSheet } from '../AnalysisSheet';
import { SheetCoachLink } from '../CoachLink';
import { countClass } from '../CardsLegend';
import type { CSSProperties } from 'react';
import { AreaHero, HeroCount } from '../AreaHero';
import { SheetRow } from '../analysisRows';

/** Da qui il danno si scrive anche se non conta (3HKO, la soglia di Coverage meta), in una casella grigia. */
const LOW_PCT = 34;

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
  // Telefono e tablet: 18 tessere, una per tipo (la coverage del team e chi colpisce più forte); toccandone una il foglio coi 6 membri
  const tiles = useMediaQuery(FLIP_TABLES_QUERY);
  const [sheetType, setSheetType] = useState<(typeof TYPES)[number] | null>(null);
  // Da una pillola della testata: la colonna (o la tessera) di quel tipo accesa, le altre spente; sulle carte anche il foglio
  const typeFocus = ctx.focus?.kind === 'type' && ctx.focus.side === 'offense' ? ctx.focus.type as (typeof TYPES)[number] : null;
  useEffect(() => {
    if (tiles && ctx.focus?.kind === 'type' && ctx.focus.side === 'offense' && ctx.focus.open && TYPES.includes(ctx.focus.type as (typeof TYPES)[number])) setSheetType(ctx.focus.type as (typeof TYPES)[number]);
  }, [ctx.focus]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // Tastiera: la griglia è un posto solo nel giro del Tab, le frecce vanno di casella in casella; col fuoco la casella
  // accende riga e colonna come il puntatore e apre il suo tooltip (se ce l'ha)
  const nav = useRoving<HTMLTableElement>(GRID_CELLS);
  const focusAt = (row: number, col: number, key?: { slot: number; type: string }) => ({
    onFocus: (e: FocusEvent<HTMLElement>) => { setHover({ row, col }); if (key && keyboardFocus(e.currentTarget)) tip.open(key, e.currentTarget); },
    onBlur: tip.close,
  });
  const leaveGrid = (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null); };
  // Per i lettori di schermo, prima della griglia: i tipi che nessuno manda KO in due colpi (i fili rossi in testata)
  const summaryId = useId();
  const holeNames = TYPES.filter(type => holes.includes(type)).map(type => typeName(type, lang));

  /** La testata di un tipo: in colonna sul computer, in riga sul telefono (tabella girata). */
  const typeHead = (type: (typeof TYPES)[number], i: number) => {
    const hole = holes.includes(type);
    return (
      <th key={type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')}
        onMouseEnter={e => { setHover({ row: -1, col: i }); tip.open({ slot: -1, type }, e.currentTarget); }} onMouseLeave={tip.close}
        {...focusAt(-1, i, { slot: -1, type })}>
        <TypeIcons types={[type]} />
        <span className="ct-flag" aria-hidden="true" />
        <span className="visually-hidden">{typeName(type, lang)}{hole && ` ${t('odetail.types.hole')}`}{` · ${statsLabel(averageOf(type))}`}</span>
      </th>
    );
  };
  /** La casella di un membro su un tipo: il danno del colpo migliore, colorato per soglia. */
  const hitCell = (slot: number, type: (typeof TYPES)[number], i: number) => {
    const set = team[slot];
    const member = memberAt(slot);
    if (slots[slot] === null) return <td key={`${slot}-${type}`} className={colClass(i, `ct-cell${ctx.effOnly ? ' eff-dim' : ''}${focus || typeFocus ? ' kf-dim' : ''}`)} onMouseEnter={() => setHover({ row: slot, col: i })} {...focusAt(slot, i)}>—</td>;
    // ×2 / ×4 solo se è superefficace la mossa che fa il danno della casella (Pixilate & co. compresi)
    const found = member?.hits.find(h => h.label === type);
    const tag = effLabel(found?.move ? moveAttackMultiplier(set, found.move, [type], '', field) : null, 'offense');
    const hit = found && found.credit > 0 ? found : undefined;
    // Dal 34% (3HKO, come Coverage meta) al 49%: non conta, ma il danno si vede in una casella grigia; sotto la casella è
    // vuota e senza ×2 (un ×2 senza numero non dice niente)
    const low = !hit && found && found.pct >= LOW_PCT ? found : undefined;
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
      <td key={`${slot}-${type}`} className={colClass(i, `ct-cell${hit ? (ohko ? ' ok-full ok-ohko' : strong ? ' ok-full' : ' ok-half') : low ? ' ok-low' : ''}${lifted || bothUp ? ' has-setup' : ''}${teamUp || bothUp ? ' has-team' : ''}${effClass(tag, 'offense', ctx.effOnly)}${focus ? (slot === focus.slot && found && inBand(found.plainPct, focus.band) ? ' kf-hit' : ' kf-dim') : typeFocus ? (type === typeFocus ? ' kf-hit' : ' kf-dim') : ''}`)}
        onMouseEnter={e => { setHover({ row: slot, col: i }); if (hit || low) tip.open({ slot, type }, e.currentTarget); else tip.leave(); }} onMouseLeave={tip.close}
        {...focusAt(slot, i, hit || low ? { slot, type } : undefined)}>
        {hit && <>
          <span className="ct-num">{hit.pct}<i>%</i></span>
          <span className="visually-hidden"> {ohko ? 'OHKO' : t(strong ? 'odetail.types.covers' : 'odetail.types.half')}</span>
        </>}
        {low && <span className="ct-num">{low.pct}<i>%</i></span>}
        {(hit || low) && <EffTag label={tag} side="offense" />}
      </td>
    );
  };
  /** La casella Team Coverage di un tipo: la pillola col livello. */
  const levelCell = (type: (typeof TYPES)[number], i: number) => {
    const level = byType.get(type)?.level ?? 0;
    return <td key={`lv-${type}`} className={colClass(i, 'ct-level')} onMouseEnter={() => setHover({ row: -1, col: i })} {...focusAt(-1, i)}><span className={`ct-pill ${coverTone(level)}`}>{level}%</span></td>;
  };
  const nameOf = (slot: number) => battleSpecies(team[slot])?.name ?? team[slot].species;

  if (tiles) {
    /** Il colpo di un membro su un tipo come nella casella del computer: la fascia, il danno, la mossa, l'efficacia. */
    const hitOf = (slot: number, type: (typeof TYPES)[number]) => {
      const member = memberAt(slot);
      const found = member?.hits.find(h => h.label === type);
      if (!found || slots[slot] === null) return null;
      const tag = effLabel(found.move ? moveAttackMultiplier(team[slot], found.move, [type], '', field) : null, 'offense');
      const hit = found.credit > 0;
      const cls = hit ? (found.pct >= 100 ? 'ok-full ok-ohko' : found.credit >= STRONG_CREDIT ? 'ok-full' : 'ok-half') : found.pct >= LOW_PCT ? 'ok-low' : 'ok-none';
      return { found, tag, hit, cls };
    };
    const covered = TYPES.length - holes.length;
    const ohkos = best.filter(b => b !== null && b.pct >= 100).length;
    // Aperta da una barra della Generale: si accendono i tipi che quel membro manda KO in quella fascia
    const lit = (type: (typeof TYPES)[number]) => {
      if (typeFocus) return type === typeFocus;
      if (!focus) return null;
      const pct = memberAt(focus.slot)?.hits.find(h => h.label === type)?.plainPct;
      return pct !== undefined && inBand(pct, focus.band);
    };
    const open = sheetType;
    const openIndex = open ? TYPES.indexOf(open) : -1;
    return (
      <div className="off-frame def-types ct-tiles-frame">
        <AreaHero label={t('detail.level')}>
          <HeroCount n={covered} of={TYPES.length} tone={countClass(covered, TYPES.length)}>{t('odetail.tiles.covered')} · <b>{ohkos}</b> {t('odetail.tiles.ohko')}</HeroCount>
        </AreaHero>
        <ul className="ct-tiles" aria-label={t('detail.coverageTypes')}>
          {TYPES.map((type, i) => {
            const level = byType.get(type)?.level ?? 0;
            const top = best[i];
            const on = lit(type);
            return (
              <li key={type} className={`ct-tile ${coverTone(level)}${on === null ? '' : on ? ' kf-hit' : ' kf-dim'}`} style={{ '--tc': typeColor(type) } as CSSProperties}>
                <button type="button" className="ct-tile-open" onClick={() => setSheetType(type)}
                  aria-label={`${typeName(type, lang)}: ${t('detail.level')} ${level}%${top ? `, ${t('odetail.types.best')} ${nameOf(top.slot)}` : `, ${t('odetail.types.hole')}`}`}>
                  <span className="ct-tile-type" aria-hidden="true"><TypeIcons types={[type]} />{typeName(type, lang)}</span>
                  <span className="ct-tile-pct" aria-hidden="true">{level}<i>%</i></span>
                  {top && <span className="ct-tile-best" aria-hidden="true"><PokemonIcon name={nameOf(top.slot)} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rob-legend ht-foot">{focus
          ? <FocusNote name={battleSpecies(ctx.team[focus.slot])?.name ?? ctx.team[focus.slot]?.species ?? ''} band={focus.band} onClear={ctx.clearFocus} />
          : typeFocus ? <FocusNote name={typeFocus} band="two" text={t('kob.focusThreat', { name: typeName(typeFocus, lang) })} onClear={ctx.clearFocus} />
          : <span className="area-legend" aria-hidden="true"><OffenseTypesLegend /></span>}</div>
        {open && (
          <AnalysisSheet title={typeName(open, lang)} lead={<TypeIcons types={[open]} />} onClose={() => setSheetType(null)} className="ct-sheet"
            foot={<SheetCoachLink ctx={ctx} subject={open} onClose={() => setSheetType(null)} />}
            sub={`${t('detail.level')} ${byType.get(open)?.level ?? 0}%${best[openIndex] ? ` · ${t('odetail.types.best')}: ${nameOf(best[openIndex]!.slot)}` : ''}`}>
            <ul className="ct-sheet-rows">
              {team.map((_, slot) => {
                const h = hitOf(slot, open);
                const show = h && (h.hit || h.cls === 'ok-low');
                const dim = ctx.effOnly && !h?.tag;
                return (
                  <SheetRow key={`${nameOf(slot)}-${slot}`} className={show ? h!.cls : 'ok-none'} dim={dim} name={nameOf(slot)}>
                    {show ? <>
                      <span className="ct-sheet-move">{h!.found.move ? gameName('move', h!.found.move, lang) : ''}</span>
                      <EffTag label={h!.tag} side="offense" />
                      <span className="ct-sheet-pct">{h!.found.pct}<i>%</i></span>
                    </> : null}
                  </SheetRow>
                );
              })}
            </ul>
            <span className="area-legend ct-sheet-legend" aria-hidden="true"><OffenseTypesLegend /><EffLegend side="offense" /></span>
          </AnalysisSheet>
        )}
      </div>
    );
  }

  return (
    <div className={`def-frame off-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <p id={summaryId} hidden>{holeNames.length ? t('sr.types.offense', { list: holeNames.join(', ') }) : t('sr.types.offenseNone')}</p>
        <table ref={nav.ref} aria-label={`${t('area.strength')}: ${t('detail.coverageTypes')}`} aria-describedby={summaryId} className="def-grid spaced ct-table"
          onMouseLeave={e => { setHover(null); tip.close(e); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={leaveGrid}>
          <colgroup><col className="def-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {TYPES.map((type, i) => typeHead(type, i))}
            </tr>
          </thead>
          <tbody>
            {team.map((set, slot) => {
              const name = nameOf(slot);
              return (
                <tr key={`${name}-${slot}`} className={[hover?.row === slot && 'x-row', focus && (slot === focus.slot ? 'kf-row' : 'kf-off')].filter(Boolean).join(' ') || undefined}>
                  <th scope="row" onMouseEnter={() => { setHover({ row: slot, col: -1 }); tip.close(); }} {...focusAt(slot, -1)}><MemberMon name={name} set={set} stats="offense" /></th>
                  {TYPES.map((type, i) => hitCell(slot, type, i))}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}><span className="row-plate"><span className="plate-long">{t('detail.level')}</span><span className="plate-short" aria-hidden="true">{t('flip.team')}</span></span></th>
              {TYPES.map((type, i) => levelCell(type, i))}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}><span className="row-plate"><span className="plate-long">{t('odetail.types.best')}</span><span className="plate-short" aria-hidden="true">{t('flip.best')}</span></span></th>
              {TYPES.map((type, i) => {
                const top = best[i];
                const who = top === null ? null : nameOf(top.slot);
                // Col fuoco sulla casella la carta del migliore (col mouse si apre sulla sprite)
                const cardFocus = top ? card.bind(team[top.slot]) : null;
                return (
                  <td key={type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}
                    onFocus={e => { setHover({ row: -1, col: i }); if (cardFocus && keyboardFocus(e.currentTarget)) cardFocus.onFocus(e); }} onBlur={cardFocus?.onBlur}>
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
        <FloatTip rect={tip.anchor.rect} tone={typeColor(headType)} className="tip-w-s tst">
          <TypeStatsTip type={headType} sub={t('guide.off.targets.tip')}
            stats={[[t('stat.hp'), averageOf(headType).hp], [t('stat.def'), averageOf(headType).def], [t('stat.spd'), averageOf(headType).spd]]} />
        </FloatTip>
      )}
      {open?.member && openHit && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(open.type)} className="tht">
          <TypeHitTip species={open.member.species} set={team[open.slot]} type={open.type} hit={openHit} setupMove={open.member.setupMove} onceName={onceName(open.member)} />
        </FloatTip>
      )}
      <div className="rob-legend ht-foot">{focus
        ? <FocusNote name={battleSpecies(ctx.team[focus.slot])?.name ?? ctx.team[focus.slot]?.species ?? ''} band={focus.band} onClear={ctx.clearFocus} />
        : typeFocus ? <FocusNote name={typeFocus} band="two" text={t('kob.focusThreat', { name: typeName(typeFocus, lang) })} onClear={ctx.clearFocus} />
        : <span className="area-legend" aria-hidden="true"><OffenseTypesLegend /></span>}</div>
    </div>
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
      <span className="area-legend-swatch"><i className="ok-low" />{t('odetail.types.legendLow')}</span>
      <span className="area-legend-swatch"><i className="kob-tri" />{t('kob.legendSetupShort')}</span>
      <span className="area-legend-swatch"><i className="kob-tri team" />{t('kob.legendTeam')}</span>
    </>
  );
}
