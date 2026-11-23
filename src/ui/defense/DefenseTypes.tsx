import { useId, useState, type FocusEvent } from 'react';
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
import { EffTag, effClass, effLabel, effWord } from '../effTag';
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
import { pieceOf } from './HoldBars';
import { FocusNote } from '../offense/KoBadges';

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
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  // Aperta da un pezzo della barra in Generale: la riga del membro e i tipi di quel pezzo accesi, il resto spento
  const focus = ctx.focus?.kind === 'dtypes' ? ctx.focus : null;
  const { rows, weak } = defense.coverageTypes;
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

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <p id={summaryId} hidden>{weakNames.length ? t('sr.types.defense', { list: weakNames.join(', ') }) : t('sr.types.defenseNone')}</p>
        <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageTypes')}`} className="def-grid spaced ct-table"
          aria-describedby={!focus && notes.length ? `${summaryId} ${notesId}` : summaryId}
          onMouseLeave={e => { setHover(null); tip.close(e); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={leaveGrid}>
          <colgroup><col className="def-col-mon" />{rows.map(row => <col key={row.type} />)}</colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {rows.map((row, i) => {
                const hole = weak.includes(row.type);
                return (
                  <th key={row.type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')}
                    onMouseEnter={e => { setHover({ row: -1, col: i }); tip.open({ slot: -1, col: i }, e.currentTarget); }} onMouseLeave={tip.close}
                    {...focusAt(-1, i, { slot: -1, col: i })}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(row.type as TypeName, lang)}{hole && ` ${t('analysis.shortfallSerious')}`}{` · ${attackerLabel(row.type)}`}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((set, member) => {
              const s = slots[member];
              const typed = s === null ? null : defense.typed[s];
              return (
                <tr key={member} className={[hover?.row === member && 'x-row', focus && (member === focus.slot ? 'kf-row' : 'kf-off')].filter(Boolean).join(' ') || undefined}>
                  <th scope="row" onMouseEnter={() => { setHover({ row: member, col: -1 }); tip.close(); }} {...focusAt(member, -1)}><MemberMon name={battleName(set)} set={set} stats /></th>
                  {rows.map((row, i) => {
                    const cell = typed?.cells[i];
                    if (!cell) return <td key={row.type} className={colClass(i, `rob-cell ht-cell hold-none${ctx.effOnly ? ' eff-dim' : ''}${focus ? ' kf-dim' : ''}`)} {...focusAt(member, i)}>—</td>;
                    const band = HOLD_BANDS[cell.band];
                    const tag = effLabel(multipliers.get(row.type as TypeName)?.[member] ?? 1, 'defense');
                    return (
                      <td key={row.type} className={colClass(i, `rob-cell ht-cell ${band.cls}${effClass(tag, 'defense', ctx.effOnly)}${focus ? (member === focus.slot && pieceOf(cell.band) === focus.band ? ' kf-hit' : ' kf-dim') : ''}`)}
                        onMouseEnter={e => { setHover({ row: member, col: i }); tip.open({ slot: member, col: i }, e.currentTarget); }} onMouseLeave={tip.close}
                        {...focusAt(member, i, { slot: member, col: i })}>
                        <span className="ct-num">{cell.pct}<i>%</i></span>
                        <span className="visually-hidden"> {band.tag} · {t('ddetail.sides', { p: cell.physical, s: cell.special })}</span>
                        <EffTag label={tag} side="defense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* In fondo, come nell'Offesa: la Copertura di ogni tipo e chi lo regge meglio */}
            <tr className="ct-sum ct-sum-first">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}><span className="row-plate">{t('ddetail.level')}</span></th>
              {rows.map((row, i) => (
                <td key={row.type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })} {...focusAt(-1, i)}>
                  <span className={`ct-pill ${levelTone(row.level)}`}>{row.level}%</span>
                </td>
              ))}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row" onMouseEnter={() => setHover(null)} onFocus={() => setHover(null)}><span className="row-plate">{t('odetail.types.best')}</span></th>
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
          : <span className="area-legend" aria-hidden="true"><DefenseTypesLegend /></span>}
        {!focus && notes.length > 0 && (
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

/** La legenda dei colori di Coverage tipi della Difesa, in alto a destra come nell'Offesa: le quattro soglie del colpo. */
function DefenseTypesLegend() {
  return (
    <>
      {HOLD_ORDER.map(b => <span key={b} className="area-legend-swatch"><i className={HOLD_BANDS[b].cls} />{HOLD_BANDS[b].tag}</span>)}
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
