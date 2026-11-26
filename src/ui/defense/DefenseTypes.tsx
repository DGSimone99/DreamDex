import { useEffect, useId, useState, type CSSProperties, type FocusEvent } from 'react';
import { AnalysisSheet } from '../AnalysisSheet';
import { SheetCoachLink } from '../CoachLink';
import { countClass } from '../CardsLegend';
import { GRID_CELLS, useRoving } from '../useRoving';
import { HELD_LEVEL } from '../../engine/coach';
import { dummyStats, holdBand, type HoldBand } from '../../engine/defense';
import { DEFAULT_FORMAT } from '../../engine/format';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import type { TypeName } from '../../engine/types';
import { weatherMitigations, type WeatherMitigation } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { formatMultiplier, mitigationNote, mitigationParts } from '../AnalysisTables';
import { CONDITION_TYPE } from '../dashboard/ConditionTip';
import { KoBadge } from '../KoBadge';
import { TipDmg, TipHead, TipRow, TipRows, TipSec, TipTypeIcon } from '../TipHead';
import { EffLegend, EffTag, effClass, effLabel, effWord } from '../effTag';
import { CategoryIcon } from '../CategoryIcon';
import type { DmgRange } from '../dmgText';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from './MemberMon';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { useMemberTip } from '../MemberCard';
import { TypeStatsTip } from '../TypeStatsTip';
import { HOLD_BANDS, HOLD_ORDER } from './holds';
import { FocusNote } from '../offense/KoBadges';
import { PokemonIcon } from '../PokemonName';
import { FLIP_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { AreaHero, HeroCount } from '../AreaHero';
import { SheetRow, FlipHead } from '../analysisRows';

/** Colore della riga Copertura, come nell'Offesa: rosso a 0, giallo sotto il livello retto (HELD_LEVEL), verde da lì. */
const levelTone = (level: number) => (level === 0 ? 'bad' : level < HELD_LEVEL ? 'warn' : 'good');
/** Il membro regge il colpo (3HKO o meglio): solo allora può essere "il migliore" del tipo. */
const holds = (band: HoldBand) => band === 'three' || band === 'four';
/** La soglia di un danno in % (le stesse della Difesa). */
const holdBandOf = (pct: number) => holdBand(pct / 100);

/**
 * Coverage tipi della Difesa: un membro per riga (nello stesso punto delle altre schede), i 18 tipi in colonna. In ogni
 * casella il danno di un colpo forte di quel tipo sul lato peggiore (fisico o speciale), colorato per quanto vale
 * col semaforo della Generale (OHKO rosso, 2HKO giallo, 3HKO verde chiaro, 4 o più verde), con l'etichetta di efficacia
 * in basso a sinistra quando il tipo non è neutro (×4, ×2, ×½, ×¼, 0); il suggerimento dà i due lati. L'interruttore "Solo
 * efficacia" (`ctx.effOnly`) spegne le caselle neutre. Col puntatore la colonna si accende e sotto l'icona compare il tipo.
 * In fondo Regge (chi regge del tutto il lato peggiore); la Copertura del tipo sta nel suggerimento della sua pillola.
 * Sotto la tabella una riga bassa in fondo al pannello: a sinistra la legenda dei colori, poi le note del meteo.
 * I tipi che nessuno regge hanno il filo rosso sotto l'icona.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const roomy = !!ctx.roomy;
  const narrow = useMediaQuery(FLIP_TABLES_QUERY);
  // Telefono e tablet: 18 tessere come nell'Offesa (quanto il team regge il tipo, chi lo regge meglio); il foglio coi membri
  const [sheetCol, setSheetCol] = useState<number | null>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  // Aperta da un pezzo della barra in Generale: la riga del membro e i tipi di quel pezzo accesi, il resto spento
  const focus = ctx.focus?.kind === 'dtypes' ? ctx.focus : null;
  const { rows, weak } = defense.coverageTypes;
  // Da una pillola della testata: la colonna (o la tessera) di quel tipo accesa, le altre spente; sulle carte anche il foglio
  const typeFocus = ctx.focus?.kind === 'type' && ctx.focus.side === 'defense' ? ctx.focus.type : null;
  const typeCol = typeFocus ? rows.findIndex(row => row.type === typeFocus) : -1;
  useEffect(() => {
    if (narrow && ctx.focus?.kind === 'type' && ctx.focus.side === 'defense' && ctx.focus.open && typeCol >= 0) setSheetCol(typeCol);
  }, [ctx.focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const multipliers = new Map(analysis.weakness.map(row => [row.type, row.multipliers]));
  // Il membro del motore per ogni posto del team (i Pokémon sconosciuti non ci sono)
  let next = 0;
  const slots = team.map(set => {
    const name = battleSpecies(set)?.name;
    if (!name || defense.typed[next]?.species !== name) return null;
    return next++;
  });
  /** Classi di una cella della colonna `col`: il puntatore accende riga e colonna. */
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;
  // Le note del meteo stanno sulla riga della legenda, dopo di lei; se non ci entrano si tagliano coi puntini e il testo intero è nel suggerimento
  const mitigations = weatherMitigations(team);
  const notes = mitigations.map(m => mitigationNote(m, lang));
  // Il tooltip DreamDex: sulla casella (slot >= 0) il colpo sui due lati, sul tipo in testata (slot -1) l'attaccante
  const tip = useFloatAnchor<{ slot: number; col: number }>();
  const card = useMemberTip(400, undefined, true);
  const formatId = ctx.formatId ?? DEFAULT_FORMAT.formatId;
  const attackerLabel = (type: string) => { const a = dummyStats(formatId, type); return `${t('stat.atk')} ${a.atk}, ${t('stat.spa')} ${a.spa}`; };
  // Chi regge meglio ogni tipo (danno più basso), solo se lo regge davvero (3HKO o meglio)
  const best = rows.map((_, i) => {
    let top: { slot: number; pct: number } | null = null;
    team.forEach((__, slot) => {
      const cell = slots[slot] === null ? null : defense.typed[slots[slot]!].cells[i];
      if (cell && holds(cell.band) && cell.pct < (top?.pct ?? Infinity)) top = { slot, pct: cell.pct };
    });
    return top as { slot: number; pct: number } | null;
  });
  const anchor = tip.anchor?.key ?? null;
  const openCell = anchor && anchor.slot >= 0 && slots[anchor.slot] !== null ? { ...defense.typed[slots[anchor.slot]!].cells[anchor.col], ...defense.typed[slots[anchor.slot]!].ranges?.[anchor.col] } : null;
  const openType = anchor ? rows[anchor.col].type : null;
  // Tastiera: la griglia è un posto solo nel giro del Tab, le frecce vanno di casella in casella; col fuoco la casella
  // accende riga e colonna come il puntatore e apre il suo tooltip
  const nav = useRoving<HTMLTableElement>(GRID_CELLS);
  const focusAt = (row: number, col: number, key?: { slot: number; col: number }) => ({
    onFocus: (e: FocusEvent<HTMLElement>) => { setHover({ row, col }); if (key && keyboardFocus(e.currentTarget)) tip.open(key, e.currentTarget); },
    onBlur: tip.close,
  });
  const leaveGrid = (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null); };
  const notesId = useId();
  // Per i lettori di schermo, prima della griglia: i tipi che nessuno regge (i fili rossi in testata), poi le note del meteo
  const summaryId = useId();
  const weakNames = rows.filter(row => weak.includes(row.type)).map(row => typeName(row.type as TypeName, lang));

  /** La testata di un tipo: in colonna sul computer, in riga sullo schermo stretto (tabella girata). */
  const typeHead = (row: (typeof rows)[number], i: number, scope: 'col' | 'row') => {
    const hole = weak.includes(row.type);
    return (
      <th key={row.type} scope={scope} className={colClass(i, `${hole ? 'sev-serious' : ''}${scope === 'row' ? ' ct-type-h' : ''}`)}
        onMouseEnter={e => { setHover({ row: -1, col: i }); tip.open({ slot: -1, col: i }, e.currentTarget); }} onMouseLeave={tip.close}
        {...focusAt(-1, i, { slot: -1, col: i })}>
        <TypeIcons types={[row.type]} />
        <span className="ct-flag" aria-hidden="true" />
        <span className="visually-hidden">{typeName(row.type as TypeName, lang)}{hole && ` ${t('analysis.shortfallSerious')}`}{` · ${attackerLabel(row.type)}`}</span>
      </th>
    );
  };
  /** La casella di un membro su un tipo: il danno del colpo forte sul lato peggiore, colorato per quanto regge. */
  const hitCell = (member: number, row: (typeof rows)[number], i: number) => {
    const s = slots[member];
    const cell = s === null ? null : defense.typed[s].cells[i];
    if (!cell) return <td key={`${member}-${row.type}`} className={colClass(i, `rob-cell ht-cell hold-none${ctx.effOnly ? ' eff-dim' : ''}${focus || typeFocus ? ' kf-dim' : ''}`)} {...focusAt(member, i)}>—</td>;
    const band = HOLD_BANDS[cell.band];
    const tag = effLabel(multipliers.get(row.type as TypeName)?.[member] ?? 1, 'defense');
    return (
      <td key={`${member}-${row.type}`} className={colClass(i, `rob-cell ht-cell ${band.cls}${effClass(tag, 'defense', ctx.effOnly)}${focus ? (member === focus.slot && cell.band === focus.band ? ' kf-hit' : ' kf-dim') : typeFocus ? (i === typeCol ? ' kf-hit' : ' kf-dim') : ''}`)}
        onMouseEnter={e => { setHover({ row: member, col: i }); tip.open({ slot: member, col: i }, e.currentTarget); }} onMouseLeave={tip.close}
        {...focusAt(member, i, { slot: member, col: i })}>
        <span className="ct-num">{cell.band !== 'ohko' && cell.pct >= 100 ? 99 : cell.pct}<i>%</i></span>
        <span className="visually-hidden"> {band.tag} · {t('ddetail.sides', { p: cell.physical, s: cell.special })}</span>
        <EffTag label={tag} side="defense" />
      </td>
    );
  };
  const levelCell = (row: (typeof rows)[number], i: number) => (
    <td key={`lv-${row.type}`} className={colClass(i, 'ct-level')} onMouseEnter={() => setHover({ row: -1, col: i })} {...focusAt(-1, i)}>
      <span className={`ct-pill ${levelTone(row.level)}`}>{row.level}%</span>
    </td>
  );
  const plate = (long: string, short: string) => (
    <span className="row-plate"><span className="plate-long">{long}</span><span className="plate-short" aria-hidden="true">{short}</span></span>
  );

  if (narrow) {
    const nameOf = (slot: number) => battleName(team[slot]);
    const held = rows.length - weak.length;
    // Aperta da un pezzo della barra in Generale: si accendono i tipi di quel pezzo per quel membro
    const lit = (i: number) => {
      if (typeFocus) return i === typeCol;
      if (!focus || slots[focus.slot] === null) return null;
      const cell = defense.typed[slots[focus.slot]!].cells[i];
      return !!cell && cell.band === focus.band;
    };
    const openRow = sheetCol === null ? null : rows[sheetCol];
    return (
      <div className="def-types ct-tiles-frame">
        <p id={summaryId} hidden>{weakNames.length ? t('sr.types.defense', { list: weakNames.join(', ') }) : t('sr.types.defenseNone')}</p>
        <AreaHero label={t('detail.level')}>
          <HeroCount n={held} of={rows.length} tone={countClass(held, rows.length)}>{t('ddetail.tiles.held')}</HeroCount>
        </AreaHero>
        <ul className="ct-tiles" aria-label={t('detail.coverageTypes')} aria-describedby={summaryId}>
          {rows.map((row, i) => {
            const top = best[i];
            const on = lit(i);
            return (
              <li key={row.type} className={`ct-tile ${levelTone(row.level)}${on === null ? '' : on ? ' kf-hit' : ' kf-dim'}`} style={{ '--tc': typeColor(row.type) } as CSSProperties}>
                <button type="button" className="ct-tile-open" onClick={() => setSheetCol(i)}
                  aria-label={`${typeName(row.type as TypeName, lang)}: ${t('detail.level')} ${row.level}%${top ? `, ${t('ddetail.tiles.bestHolder')} ${nameOf(top.slot)}` : `, ${t('analysis.shortfallSerious')}`}`}>
                  <span className="ct-tile-type" aria-hidden="true"><TypeIcons types={[row.type]} />{typeName(row.type as TypeName, lang)}</span>
                  <span className="ct-tile-pct" aria-hidden="true">{row.level}<i>%</i></span>
                  {top && <span className="ct-tile-best" aria-hidden="true"><PokemonIcon name={nameOf(top.slot)} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rob-legend ht-foot">
          {focus
            ? <FocusNote name={battleName(team[focus.slot])} band="two" text={t(`hold.focus.${focus.band}`, { name: battleName(team[focus.slot]) })} onClear={ctx.clearFocus} />
            : typeFocus ? <FocusNote name={typeFocus} band="two" text={t('kob.focusThreat', { name: typeName(typeFocus as TypeName, lang) })} onClear={ctx.clearFocus} />
            : <span className="area-legend" aria-hidden="true"><DefenseTypesLegend /></span>}
          {!focus && !typeFocus && notes.length > 0 && <NotesLine id={notesId} notes={notes} mitigations={mitigations} />}
        </div>
        {openRow && sheetCol !== null && (
          <AnalysisSheet title={typeName(openRow.type as TypeName, lang)} lead={<TypeIcons types={[openRow.type]} />} onClose={() => setSheetCol(null)} className="ct-sheet"
            foot={<SheetCoachLink ctx={ctx} subject={openRow.type} onClose={() => setSheetCol(null)} />}
            sub={`${t('detail.level')} ${openRow.level}%${best[sheetCol] ? ` · ${t('ddetail.tiles.bestHolder')}: ${nameOf(best[sheetCol]!.slot)}` : ''}`}>
            <ul className="ct-sheet-rows">
              {team.map((_, slot) => {
                const cell = slots[slot] === null ? null : defense.typed[slots[slot]!].cells[sheetCol];
                const tag = effLabel(multipliers.get(openRow.type as TypeName)?.[slot] ?? 1, 'defense');
                return (
                  <SheetRow key={`${nameOf(slot)}-${slot}`} className={`dt-sheet-row ${cell ? HOLD_BANDS[cell.band].cls : 'hold-none'}`} dim={ctx.effOnly && !tag} name={nameOf(slot)}>
                    {cell ? <>
                      <span className="dt-sheet-band">{HOLD_BANDS[cell.band].tag}</span>
                      <EffTag label={tag} side="defense" />
                      <span className="ct-sheet-pct">{cell.band !== 'ohko' && cell.pct >= 100 ? 99 : cell.pct}<i>%</i></span>
                    </> : null}
                  </SheetRow>
                );
              })}
            </ul>
            <span className="area-legend ct-sheet-legend" aria-hidden="true"><DefenseTypesLegend /><EffLegend side="defense" /></span>
          </AnalysisSheet>
        )}
      </div>
    );
  }

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}${narrow ? ' ct-flip' : ''}`}>
      <div className="ad-scroll">
        <p id={summaryId} hidden>{weakNames.length ? t('sr.types.defense', { list: weakNames.join(', ') }) : t('sr.types.defenseNone')}</p>
        {narrow ? (
          // Telefono e tablet piccolo: la tabella girata come nell'Offesa, i 18 tipi in riga e i membri in colonna, in fondo
          // a ogni riga la Copertura del tipo; niente "Il migliore" (è la casella migliore della riga)
          <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageTypes')}`} className="def-grid spaced ct-table ct-flip-table"
            aria-describedby={!focus && notes.length ? `${summaryId} ${notesId}` : summaryId}
            onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={leaveGrid}>
            <FlipHead corner={t('flip.type')} team={team} nameOf={set => battleName(set)} bind={set => card.bind(set)} focusSlot={focus?.slot}
              cellProps={member => focusAt(member, -1)} />
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.type}>
                  {typeHead(row, i, 'row')}
                  {team.map((_, member) => hitCell(member, row, i))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageTypes')}`} className="def-grid spaced ct-table"
          aria-describedby={!focus && notes.length ? `${summaryId} ${notesId}` : summaryId}
          onMouseLeave={e => { setHover(null); tip.close(e); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={leaveGrid}>
          <colgroup><col className="def-col-mon" />{rows.map(row => <col key={row.type} />)}</colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {rows.map((row, i) => typeHead(row, i, 'col'))}
            </tr>
          </thead>
          <tbody>
            {team.map((set, member) => (
              <tr key={member} className={[hover?.row === member && 'x-row', focus && (member === focus.slot ? 'kf-row' : 'kf-off')].filter(Boolean).join(' ') || undefined}>
                <th scope="row" onMouseEnter={() => { setHover({ row: member, col: -1 }); tip.close(); }} {...focusAt(member, -1)}><MemberMon name={battleName(set)} set={set} stats /></th>
                {rows.map((row, i) => hitCell(member, row, i))}
              </tr>
            ))}
            {/* In fondo, come nell'Offesa: la Copertura di ogni tipo e chi lo regge meglio */}
            <tr className="ct-sum ct-sum-first">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}>{plate(t('ddetail.level'), t('flip.team'))}</th>
              {rows.map((row, i) => levelCell(row, i))}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}>{plate(t('odetail.types.best'), t('flip.best'))}</th>
              {rows.map((row, i) => {
                const top = best[i];
                const who = top === null ? null : battleName(team[top.slot]);
                // Col fuoco sulla casella la carta del migliore (col mouse si apre sulla sprite)
                const cardFocus = top ? card.bind(team[top.slot]) : null;
                return (
                  <td key={row.type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}
                    onFocus={e => { setHover({ row: -1, col: i }); if (cardFocus && keyboardFocus(e.currentTarget)) cardFocus.onFocus(e); }} onBlur={cardFocus?.onBlur}>
                    {who
                      ? <span className="ct-best-mon" {...card.bind(team[top!.slot])}><Sprite species={who} size={34} /><span className="visually-hidden">{who}</span></span>
                      : <span className="ct-best-none" aria-label={t('analysis.shortfallSerious')}>—</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        )}
      </div>
      {card.tip}
      {tip.anchor && openType && anchor!.slot < 0 && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(openType)} className="tip-w-s tst">
          <TypeStatsTip type={openType} sub={t('ddetail.attackerTip')}
            stats={[[t('stat.atk'), dummyStats(formatId, openType).atk], [t('stat.spa'), dummyStats(formatId, openType).spa]]} />
        </FloatTip>
      )}
      {tip.anchor && openType && openCell && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(openType)} className="tip-w-m tht dht">
          <DefenseHitTip type={openType} species={battleName(team[anchor!.slot])} cell={openCell}
            mult={multipliers.get(openType as TypeName)?.[anchor!.slot] ?? 1} />
        </FloatTip>
      )}
      <div className="rob-legend ht-foot">
        {focus
          ? <FocusNote name={battleName(team[focus.slot])} band="two" text={t(`hold.focus.${focus.band}`, { name: battleName(team[focus.slot]) })} onClear={ctx.clearFocus} />
          : typeFocus ? <FocusNote name={typeFocus} band="two" text={t('kob.focusThreat', { name: typeName(typeFocus as TypeName, lang) })} onClear={ctx.clearFocus} />
          : <span className="area-legend" aria-hidden="true"><DefenseTypesLegend /></span>}
        {!focus && !typeFocus && notes.length > 0 && (
          <NotesLine id={notesId} notes={notes} mitigations={mitigations} />
        )}
      </div>
    </div>
  );
}

/**
 * Il tooltip di una casella: il tipo in testata col badge dei colpi; il membro (sprite, nome, sotto l'efficacia a parole:
 * "debole ×2", "resiste ×½"), poi il colpo forte di quel tipo sui due lati, una riga di danno ciascuno (Fisica, Speciale:
 * il danno e la fascia).
 */
export function DefenseHitTip({ type, species, cell, mult }: { type: string; species: string; cell: { pct: number; physical: number; special: number; band: HoldBand; physicalRange?: DmgRange | null; specialRange?: DmgRange | null }; mult: number | null | undefined }) {
  const t = useT();
  const lang = useLang();
  const eff = effWord(t, mult, 'defense');
  const side = (category: 'Physical' | 'Special', pct: number, range: DmgRange | null | undefined) => (
    <TipRow className="dht-side" lead={<CategoryIcon category={category} />} title={t(category === 'Physical' ? 'tip.physical' : 'tip.special')}
      value={<TipDmg pct={pct} range={range} side="def" band={holdBandOf(pct)} immune={mult === 0} />} />
  );
  return (
    <>
      <TipHead lead={<TipTypeIcon type={type} />} title={typeName(type as TypeName, lang)} badge={<KoBadge side="def" band={cell.band} />} />
      <TipSec>
        <TipRows>
          <TipRow lead={<Sprite species={species} size={SPRITE_TIP_ROW} />} title={species} sub={eff ? <span className="tip-eff">{eff}</span> : undefined} />
          {side('Physical', cell.physical, cell.physicalRange)}
          {side('Special', cell.special, cell.specialRange)}
        </TipRows>
      </TipSec>
    </>
  );
}

/** La legenda dei colori di Coverage tipi della Difesa: dalla fascia migliore (4HKO+) alla peggiore (OHKO), come le barre e Coverage meta. */
function DefenseTypesLegend() {
  return (
    <>
      {[...HOLD_ORDER].reverse().map(b => <span key={b} className="area-legend-swatch"><i className={HOLD_BANDS[b].cls} />{HOLD_BANDS[b].tag}</span>)}
    </>
  );
}

/**
 * Le note del meteo sulla riga della legenda: se non ci stanno si tagliano coi puntini e il testo intero è nel tooltip
 * DreamDex (col mouse e col fuoco, prima era il title del browser); per lo screen reader il testo intero c'è sempre e la
 * griglia lo usa come descrizione (`id`).
 */
function NotesLine({ id, notes, mitigations }: { id: string; notes: string[]; mitigations: WeatherMitigation[] }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<true>();
  const name = (m: WeatherMitigation) => t(`conditionName.${m.condition}` as Parameters<typeof t>[0]);
  const parts = mitigations.map(m => mitigationParts(m, lang));
  const one = mitigations.length === 1;
  // Un cambio per riga: il tipo (tessera e nome), sotto per chi vale, a destra il moltiplicatore prima → dopo (verde se
  // migliora, rosso se peggiora)
  const rows = (m: WeatherMitigation) => {
    const groups = new Map<string, { from: number; to: number; names: string[] }>();
    for (const x of m.members) {
      const key = `${x.from}|${x.to}`;
      const g = groups.get(key) ?? { from: x.from, to: x.to, names: [] };
      g.names.push(x.species);
      groups.set(key, g);
    }
    return [...groups.values()].map(g => (
      <TipRow key={`${g.from}|${g.to}`} lead={<TipTypeIcon type={m.type} />} title={typeName(m.type, lang)}
        sub={t('tip.weather.for', { list: g.names.join(', ') })} tone={g.to < g.from ? 'good' : 'bad'}
        value={`${formatMultiplier(g.from)} → ${formatMultiplier(g.to) || '×1'}`} />
    ));
  };
  const type = CONDITION_TYPE[mitigations[0]?.condition ?? ''];
  return (
    <>
      <span id={id} className="ht-notes note" tabIndex={0} {...tip.bind(true)}>
        <Typed text={notes.join(' · ')} />
      </span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={type ? typeColor(type) : 'var(--accent)'} className="tip-w-m weather-tip">
          {/* Come il fumetto di Meteo e campo: la tessera del tipo della condizione; sotto il titolo l'avvertenza */}
          <TipHead lead={type ? <TipTypeIcon type={type} /> : undefined} title={mitigations.map(name).join(' · ')} sub={t('tip.weather.notAlways')} />
          {mitigations.map((m, i) => (
            <TipSec key={m.condition} label={one ? parts[i].source : `${name(m)} · ${parts[i].source}`}>
              <TipRows>{rows(m)}</TipRows>
            </TipSec>
          ))}
        </FloatTip>
      )}
    </>
  );
}
