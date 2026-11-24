import { useEffect, useId, useState, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { SheetCoachLink } from '../CoachLink';
import { AnalysisSheet } from '../AnalysisSheet';
import { CardsLegend, countClass } from '../CardsLegend';
import { TypeIcons } from '../typeIcons';
import { HoldBars, type HoldTarget } from './HoldBars';
import { battleName, battleSpecies } from '../../engine/dex';
import { holdBand, type HoldBand, type TeamDefense } from '../../engine/defense';
import { THREATS } from '../../engine/attackers';
import { HOLD_LEGEND, type HoldPiece } from './HoldBars';

/** Telefono e tablet: quante minacce si vedono all'inizio e quante ne aggiunge "Altre". */
const CARDS_STEP = 12;
import { HOLD_BANDS } from './holds';
import { FLIP_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { FocusNote } from '../offense/KoBadges';
import { battleMoveType } from '../../engine/types';
import { useLang, useT } from '../../i18n/react';
import { gameName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MoveLine } from '../dashboard/CoverageTip';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { GRID_CELLS, useRoving } from '../useRoving';
import { useMemberTip } from '../MemberCard';
import { MetaFrame, MetaOrderSwitch, type MetaOrder } from '../MetaFrame';
import { byThreat, byUsage } from '../../engine/overviewDashboard';
import { HpLeft, HpLegend } from '../offense/OffenseMeta';
import { PokemonIcon } from '../PokemonName';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { KO_TAG, KoBadge } from '../KoBadge';
import { TipDmg, TipHead, TipRow, TipRows, TipSec } from '../TipHead';
import type { DmgRange } from '../dmgText';
import { MemberMon } from './MemberMon';
import { EffLegend, EffTag, effClass, effLabel, effWord, useColumnHover, EffSwitch } from '../effTag';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];
type Holder = Row['heldBy'][number];

/** Quanti membri la reggono del tutto: 0 rosso, 1 giallo, da 2 verde (come "Lo coprono" dell'Offesa). */
const countTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');
/** Le soglie con un numero, coi colori e i crediti di Coverage tipi: pieno sotto un terzo dei PS, metà sotto la metà, niente
 * se lo manda KO in due colpi; KO a parte. */
/**
 * Le fasce della legenda coi nomi della Generale (KO_TAG) e il danno fra parentesi: 4HKO+ sotto un terzo dei PS, 3HKO
 * fino a metà, 2HKO da metà in su (holdBand), poi il timbro OHKO. Dalla migliore alla peggiore, come la barra.
 */
const LEGEND = [{ cls: 'hold-4', band: 'four', pct: 'under' }, { cls: 'hold-3', band: 'three', pct: '33–49%' }, { cls: 'hold-2', band: 'two', pct: '50–99%' }] as const;

/**
 * Per ogni posto del team, cosa prende dal colpo migliore della minaccia: `null` se il motore non conosce il membro,
 * 'ko' se va KO in un colpo (il motore lo lascia fuori da `heldBy`), altrimenti la voce di `heldBy`. Le voci di `heldBy`
 * seguono l'ordine dei membri conosciuti, così anche due membri della stessa specie restano al loro posto.
 */
function cellsOf(row: Row, names: (string | null)[]): (Holder | 'ko' | null)[] {
  let next = 0;
  return names.map(name => {
    if (!name) return null;
    const h = row.heldBy[next];
    if (h && h.species === name) { next++; return h; }
    return 'ko';
  });
}

/**
 * Coverage meta della Difesa, con la grafica di quella dell'Offesa: i membri in riga (nello stesso punto delle altre
 * schede), le minacce del meta in colonna, 8 per pagina nell'ordine scelto sulla riga della legenda: Minaccia (prima quelle
 * che nessuno regge del tutto, poi quelle che regge uno solo, poi le altre, dentro la più usata: la regola della
 * Panoramica) o Uso (la più usata). In ogni casella
 * il danno che il membro prende dal colpo migliore della minaccia (corsivo, "%" piccolo) con la barra dei PS che gli
 * restano, coi colori di Coverage tipi (4HKO+ sotto un terzo dei PS, 3HKO sotto la metà, 2HKO); il timbro KO se va KO in un colpo. Sulla casella il
 * tooltip DreamDex (minaccia, membro, mossa, efficacia, danno); sulla sprite in testata la carta del Pokémon col suo set
 * più usato e sotto un filo col colore di quanti la reggono. In fondo la riga Team Coverage, come nell'Offesa: nelle
 * colonne quanti membri la reggono del tutto. Le pagine ("‹ 1/5 ›") stanno nella casella in alto a sinistra; in basso
 * la legenda corta. In basso a sinistra l'efficacia della mossa della minaccia quando non è neutra; "Solo superefficaci"
 * (`ctx.effOnly`) spegne le caselle neutre. Col puntatore la colonna si accende.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const hover = useColumnHover();
  const narrow = useMediaQuery(FLIP_TABLES_QUERY);
  // Telefono (sotto i 600 px): le minacce come righe basse e l'interruttore sulla riga di Ordine
  // Telefono e tablet: le minacce come carte, come nell'Offesa; la carta apre il foglio coi colpi su ogni membro
  const [shownCards, setShownCards] = useState(CARDS_STEP);
  const [sheet, setSheet] = useState<string | null>(null);
  const tip = useFloatAnchor<{ species: string; m: number }>();
  const card = useMemberTip(400, undefined, true);
  // Tastiera: la griglia è un posto solo nel giro del Tab, le frecce vanno di casella in casella (col fuoco la colonna e il tooltip)
  const nav = useRoving<HTMLTableElement>(GRID_CELLS);
  const names = ctx.team.map(set => battleSpecies(set)?.name ?? null);
  // Aperta da un pezzo della barra in Generale: la riga del membro e le minacce di quel pezzo accese, e prima nell'ordine
  // (così stanno nella prima pagina); il resto spento
  const focus = ctx.focus?.kind === 'dmeta' ? ctx.focus : null;
  const pieceAt = (row: Row, m: number): HoldPiece | null => {
    const c = cellsOf(row, names)[m];
    return c === null ? null : c === 'ko' ? 'ohko' : c.band;
  };
  const lit = (row: Row) => !!focus && pieceAt(row, focus.slot) === focus.band;
  // Aperta da una minaccia della Panoramica: la sua colonna per prima (prima pagina) e accesa, le altre spente
  const threat = ctx.focus?.kind === 'threat' && ctx.focus.side === 'defense' ? ctx.focus.species : null;
  // Da una pillola della testata, sulle carte: si apre anche il foglio della minaccia
  useEffect(() => { if (narrow && ctx.focus?.kind === 'threat' && ctx.focus.side === 'defense' && ctx.focus.open) setSheet(ctx.focus.species); }, [ctx.focus]); // eslint-disable-line react-hooks/exhaustive-deps
  // Quanti membri la reggono del tutto (la regola della Panoramica e del Coaching, il numero della riga Team Coverage)
  const held = (row: Row) => row.heldBy.filter(h => !h.partial).length;
  // Ordine scelto: Minaccia (prima quelle che nessuno regge, poi quelle che regge uno solo, come la Panoramica) o Uso
  const [order, setOrder] = useState<MetaOrder>('threat');
  const all = defense.coverageMeta?.rows ?? [];
  const sorted = order === 'usage' ? byUsage(all) : byThreat(all, held);
  // Per i lettori di schermo, prima della tabella: le minacce che nessuno regge (di tutte le pagine)
  const summaryId = useId();
  const open = sorted.filter(r => held(r) === 0).map(r => r.species);
  const rows = focus ? [...sorted.filter(lit), ...sorted.filter(r => !lit(r))]
    : threat ? [...sorted.filter(r => r.species === threat), ...sorted.filter(r => r.species !== threat)] : sorted;
  // Il posto fra i membri conosciuti dal motore (l'ordine di `mults`)
  let seen = 0;
  const knownIndex = names.map(name => (name ? seen++ : -1));

  const cell = (row: Row, c: Holder | 'ko' | null, m: number, k: number) => {
    const key = `${row.species}-${m}`;
    const kf = focus ? (m === focus.slot && lit(row) ? ' kf-hit' : ' kf-dim') : threat ? (row.species === threat ? ' kf-hit' : ' kf-dim') : '';
    const dim = (ctx.effOnly ? ' eff-dim' : '') + (focus || threat ? ' kf-dim' : '');
    if (c === null) return <td key={key} className={hover.cls(k, `rob-cell hold-none${dim}`)} {...hover.enter(k)}>—</td>;
    const tag = effLabel(row.mults?.[knownIndex[m]], 'defense');
    const eff = effClass(tag, 'defense', ctx.effOnly) + kf;
    const enter = (e: MouseEvent<HTMLElement>) => { hover.enter(k).onMouseEnter(); tip.open({ species: row.species, m }, e.currentTarget); };
    const focusIn = (e: FocusEvent<HTMLElement>) => { hover.enter(k).onFocus(); tip.focus({ species: row.species, m }).onFocus(e); };
    if (c === 'ko') {
      return (
        <td key={key} className={hover.cls(k, `rob-cell hold-ohko dm-cell${eff}`)} onMouseEnter={enter} onMouseLeave={tip.close} onFocus={focusIn} onBlur={tip.close}>
          <span className="cm-ko" aria-hidden="true">OHKO</span>
          <span className="visually-hidden">{row.species}: OHKO</span>
          <EffTag label={tag} side="defense" />
        </td>
      );
    }
    return (
      <td key={key} className={hover.cls(k, `rob-cell dm-cell ${HOLD_BANDS[c.band].cls}${eff}`)} onMouseEnter={enter} onMouseLeave={tip.close} onFocus={focusIn} onBlur={tip.close}>
        <span className="wall-pct ct-num">{c.pct}<i>%</i></span><HpLeft pct={c.pct} />
        <span className="visually-hidden"> {row.species}: {c.move ? `${gameName('move', c.move, lang)} ` : ''}{c.pct}%</span>
        <EffTag label={tag} side="defense" />
      </td>
    );
  };

  // Il tooltip della casella sotto il puntatore: la minaccia, il membro e il colpo che gli arriva
  const tipCell = (shown: Row[]) => {
    if (!tip.anchor) return null;
    const { species, m } = tip.anchor.key;
    const row = shown.find(r => r.species === species);
    const name = names[m];
    if (!row || !name) return null;
    const c = cellsOf(row, names)[m];
    if (c === null) return null;
    const types = battleSpecies(row.set)?.types ?? [];
    return (
      <FloatTip rect={tip.anchor.rect} tone={typeColor((types[0] as string | undefined) ?? '')} className="tht">
        <ThreatHitTip row={row} name={name} hit={c} mult={row.mults?.[knownIndex[m]]} koHit={row.hits?.[knownIndex[m]]} />
      </FloatTip>
    );
  };

  const body = (shown: Row[], pager: ReactNode) => {
    const cells = shown.map(r => cellsOf(r, names));
    return (
      <div className={`def-frame def-meta-grid cm-matrix${ctx.roomy ? ' roomy' : ''}${narrow ? ' ct-flip' : ''}`}>
        <div className="ad-scroll">
          <p id={summaryId} hidden>{open.length ? t('sr.cm.defense', { list: open.join(', ') }) : t('sr.cm.defenseNone')}</p>
          {narrow ? (
            // Telefono e tablet piccolo: la tabella girata come nell'Offesa, le minacce in riga e i membri in colonna, le
            // pagine sopra, in fondo a ogni riga quanti membri la reggono; nelle caselle il danno o il timbro KO
            <>
              <div className="cm-flip-pager">{pager}</div>
              <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageMeta')}`} aria-describedby={summaryId} className="def-grid spaced ct-table ct-flip-table"
                onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hover.clear(); }}>
                <thead>
                  <tr>
                    <th scope="col" className="def-mon-h"><span className="visually-hidden">{t('flip.target')}</span></th>
                    {ctx.team.map((set, m) => (
                      <th key={`${names[m] ?? set.species}-${m}`} scope="col" className={`ct-mon-h${focus && m === focus.slot ? ' kf-col' : ''}`}>
                        <span className="ct-mon-box" {...card.bind(set)}><PokemonIcon name={battleName(set)} /></span>
                        <span className="visually-hidden">{battleName(set)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, k) => (
                    <tr key={r.species}>
                      <th scope="row" aria-label={r.species} className={hover.cls(k, 'dm-h ct-type-h')} {...hover.enter(k)}>
                        <span className="def-box cm-head-mon" {...card.bind(r.set)}><PokemonIcon name={r.species} /></span>
                        <span className={`cm-flag ${countTone(held(r))}`} aria-hidden="true" />
                      </th>
                      {ctx.team.map((_, m) => cell(r, cells[k][m], m, k))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
          <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageMeta')}`} aria-describedby={summaryId} className="def-grid spaced ct-table"
            onMouseLeave={e => { hover.table.onMouseLeave(); tip.close(e); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hover.clear(); }}>
            <colgroup>
              <col className="def-col-mon" />
              {shown.map(r => <col key={r.species} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="def-mon-h cm-pager-h">{pager}</th>
                {shown.map((r, k) => (
                  <th key={r.species} scope="col" aria-label={r.species} className={hover.cls(k, 'dm-h')} {...hover.enter(k)}
                    onFocus={e => { hover.enter(k).onFocus(); if (keyboardFocus(e.currentTarget)) card.bind(r.set).onFocus(e); }} onBlur={card.bind(r.set).onBlur}>
                    {/* Sulla sprite la carta del Pokémon col suo set più usato; sotto un filo col colore di quanti la reggono */}
                    <span className="def-box cm-head-mon" {...card.bind(r.set)}><PokemonIcon name={r.species} /></span>
                    <span className="cm-head-name" aria-hidden="true">{r.species}</span>
                    <span className={`cm-flag ${countTone(held(r))}`} aria-hidden="true" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctx.team.map((set, m) => (
                <tr key={`${names[m] ?? set.species}-${m}`} className={focus ? (m === focus.slot ? 'kf-row' : 'kf-off') : undefined}>
                  <th scope="row" onMouseEnter={() => { hover.table.onMouseLeave(); tip.close(); }} onFocus={hover.clear}><MemberMon name={battleName(set)} set={set} stats /></th>
                  {shown.map((r, k) => cell(r, cells[k][m], m, k))}
                </tr>
              ))}
              {/* Riempie lo spazio che resta: la riga Team Coverage sta sempre in fondo, come nell'Offesa */}
              <tr className="og-fill" aria-hidden="true"><td colSpan={shown.length + 1} /></tr>
            </tbody>
            {/* In fondo la riga Team Coverage, come nell'Offesa e allo stesso posto: nelle colonne quanti membri la reggono */}
            <tfoot>
              <tr className="og-total cm-total">
                <th scope="row" onMouseEnter={hover.table.onMouseLeave} onFocus={hover.clear}>
                  <span className="og-plate">{t('odetail.gen.total')}</span>
                  <span className="visually-hidden">{t('ddetail.heldBy')}</span>
                </th>
                {shown.map((r, k) => (
                  <td key={r.species} className={hover.cls(k)} {...hover.enter(k)}>
                    <span className={`ct-pill ${countTone(held(r))}`}>{held(r)}<span className="visually-hidden"> {t('ddetail.heldBy')}</span></span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          )}
        </div>
        {tipCell(shown)}
        {card.tip}
        <div className="rob-legend cm-foot"><MetaOrderSwitch order={order} onChange={setOrder} />{focus
          ? <FocusNote name={names[focus.slot] ?? ''} band="two" text={t(`hold.focus.${focus.band}`, { name: names[focus.slot] ?? '' })} onClear={ctx.clearFocus} />
          : threat ? <FocusNote name={threat} band="two" text={t('kob.focusThreat', { name: threat })} onClear={ctx.clearFocus} />
          : <span className="area-legend" aria-hidden="true"><DefenseMetaLegend /></span>}</div>
      </div>
    );
  };

  if (narrow) {
    // Per ogni minaccia i membri come bersagli della barra: chi va KO in un colpo, in due, chi la regge (3HKO o meglio)
    const targetsOf = (row: Row): HoldTarget[] => cellsOf(row, names).flatMap((c, m) => (c === null ? []
      : [{ label: names[m]!, kind: 'mon' as const, band: c === 'ko' ? 'ohko' as const : c.band ?? holdBand(c.pct / 100) }]));
    const rank = new Map(byUsage(all).map((r, i) => [r.species, i + 1]));
    const allHeld = all.filter(r => held(r) > 0).length;
    const visible = rows.slice(0, shownCards);
    const openRow = sheet === null ? null : all.find(r => r.species === sheet) ?? null;
    return (
      <div className="def-meta-grid cm-cards-frame">
        <p id={summaryId} hidden>{open.length ? t('sr.cm.defense', { list: open.join(', ') }) : t('sr.cm.defenseNone')}</p>
        <section className="og-hero" aria-label={t('odetail.gen.total')}>
          <span className="og-plate">{t('odetail.gen.total')}</span>
          <p className="og-hero-line"><b className={countClass(allHeld, all.length)}>{allHeld}</b><small>/{all.length}</small> {t('ddetail.cards.threatsHeld')}
            {/* Quali sono: dei 40 più usati, quelli che attaccano (come la riga dell'Offesa; sulla stessa riga se ci sta) */}
            <span className="og-hero-note">{t('guide.off.targets.metaSub', { top: THREATS })}</span></p>
        </section>
        <div className="rob-legend cm-foot cm-cards-bar"><MetaOrderSwitch order={order} onChange={o => { setOrder(o); setShownCards(CARDS_STEP); }} />
          {/* Telefono e tablet: "Solo superefficaci" sulla riga di Ordine, a destra (in cima al pannello lascerebbe una riga in più) */}
          {ctx.setEffOnly && <span className="cm-bar-switch"><EffSwitch side="defense" on={!!ctx.effOnly} onChange={ctx.setEffOnly} /></span>}
          {focus
          ? <FocusNote name={names[focus.slot] ?? ''} band="two" text={t(`hold.focus.${focus.band}`, { name: names[focus.slot] ?? '' })} onClear={ctx.clearFocus} />
          : threat ? <FocusNote name={threat} band="two" text={t('kob.focusThreat', { name: threat })} onClear={ctx.clearFocus} />
          : <CardsLegend side="def" text={t('ddetail.cards.threatBar')} pieces={HOLD_LEGEND} />}</div>
        <ul className="og-cards cm-cards" aria-label={t('detail.coverageMeta')}>
          {visible.map(r => {
            const types = battleSpecies(r.set)?.types ?? [];
            const on = focus ? lit(r) : threat ? r.species === threat : null;
            return (
              <li key={r.species} className={`og-card pedana-face cm-card ${countTone(held(r))}${on === null ? '' : on ? ' kf-hit' : ' kf-dim'}`}
                style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
                <span className="pedana-stripe" aria-hidden="true" />
                <span className="pedana-stage" aria-hidden="true"><span className="pedana-disc" /></span>
                <button type="button" className="og-card-open" aria-label={t('odetail.cards.open', { name: r.species })} onClick={() => setSheet(r.species)}>
                  <span className="og-card-sprite" aria-hidden="true"><Sprite species={r.set.species} item={r.set.item} size={72} /></span>
                  <span className="og-card-name">{r.species}</span>
                </button>
                <span className="og-card-tag cm-card-rank" aria-label={t('odetail.cards.rank', { n: rank.get(r.species) ?? 0 })}>#{rank.get(r.species)}</span>
                <TypeIcons types={types} className="og-card-types" />
                <div className="og-card-row cm-card-row"><HoldBars targets={targetsOf(r)} who={r.species} mon={r.species} of={t('odetail.cards.ofTeam')} /></div>
              </li>
            );
          })}
        </ul>
        {rows.length > shownCards && (
          <button type="button" className="cm-cards-more" onClick={() => setShownCards(n => n + CARDS_STEP)}>
            {t('odetail.cards.more', { n: Math.min(CARDS_STEP, rows.length - shownCards), left: rows.length - shownCards })}
          </button>
        )}
        {openRow && (
          <AnalysisSheet title={openRow.species} lead={<Sprite species={openRow.set.species} item={openRow.set.item} size={56} />} onClose={() => setSheet(null)} className="cm-sheet"
            foot={<SheetCoachLink ctx={ctx} subject={openRow.species} onClose={() => setSheet(null)} />}
            sub={`#${rank.get(openRow.species)} · ${t('ddetail.cards.heldBy', { n: held(openRow), total: ctx.team.length })}`}>
            <ul className="ct-sheet-rows">
              {cellsOf(openRow, names).map((c, m) => {
                const tag = c === null ? null : effLabel(openRow.mults?.[knownIndex[m]], 'defense');
                const band = c === null ? null : c === 'ko' ? 'ohko' : c.band ?? holdBand(c.pct / 100);
                return (
                  <li key={`${names[m] ?? m}-${m}`} className={`ct-sheet-row cm-sheet-row dt-sheet-row ${band ? HOLD_BANDS[band].cls : 'hold-none'}${ctx.effOnly && !tag ? ' eff-dim' : ''}`}>
                    <PokemonIcon name={names[m] ?? ctx.team[m].species} />
                    <span className="ct-sheet-name">{names[m] ?? ctx.team[m].species}{(() => { const mv = c === null ? null : c === 'ko' ? openRow.hits?.[knownIndex[m]]?.move : c.move; return mv ? <small className="ct-sheet-sub">{gameName('move', mv, lang)}</small> : null; })()}</span>
                    {c === null ? <span className="ct-sheet-none">—</span>
                      : c === 'ko' ? <><span className="cm-ko small">OHKO</span><EffTag label={tag} side="defense" /><span className="ct-sheet-pct" /></>
                      : <><HpLeft pct={c.pct} /><EffTag label={tag} side="defense" /><span className="ct-sheet-pct">{c.pct}<i>%</i></span></>}
                  </li>
                );
              })}
            </ul>
            <span className="area-legend ct-sheet-legend" aria-hidden="true"><HpLegend /><DefenseMetaLegend /><EffLegend side="defense" /></span>
          </AnalysisSheet>
        )}
      </div>
    );
  }

  return <MetaFrame rows={rows} summary={null} body={body} resetKey={order}
    labels={{ pages: t('ddetail.cm.pages'), prev: t('ddetail.cm.prev'), next: t('ddetail.cm.next'), page: (from, to) => t('ddetail.cm.page', { from, to }) }} />;
}

/** La legenda di Coverage meta della Difesa: il timbro KO, poi le tre fasce col loro % (come Coverage tipi). */
/**
 * Il tooltip di un colpo di una minaccia su un membro (casella di Coverage meta, pastiglia della Generale): la minaccia
 * col badge dei colpi, il membro in una riga di danno (sprite, nome, sotto la mossa della minaccia e l'efficacia a parole,
 * "debole ×2"; a destra il danno e la fascia); KO in un colpo: la stessa riga col colpo trovato per il membro (la fascia OHKO).
 */
export function ThreatHitTip({ row, name, hit, mult, koHit }: { row: Row; name: string; hit: { move: string; pct: number; partial: boolean; band?: HoldBand; range?: DmgRange | null } | 'ko'; mult: number | null | undefined;
  /** KO in un colpo: il colpo che il motore ha trovato per il membro (mossa, danno e forbice), per la riga di danno. */
  koHit?: { move: string; pct: number; range?: DmgRange | null } }) {
  const t = useT();
  // La mossa del colpo: quella della casella, o (KO in un colpo) quella che il motore ha trovato per il membro
  const move = hit === 'ko' ? koHit?.move : hit.move;
  // La fascia del colpo, come nei colpi di tipo (4HKO+, 3HKO, 2HKO)
  const band = hit === 'ko' ? 'ohko' : hit.band ?? holdBand(hit.pct / 100);
  const eff = effWord(t, mult, 'defense');
  return (
    <>
      <TipHead sprite={row.species} title={row.species} badge={<KoBadge side="def" band={band} />} />
      <TipSec>
        <TipRows>
          <TipRow className="tht-row" lead={<Sprite species={name} size={SPRITE_TIP_ROW} />} title={name}
            sub={<>{move ? <MoveLine name={move} type={battleMoveType(row.set, move)} /> : <span className="tht-none">{t('ddetail.cm.koTip')}</span>}{eff && <span className="tip-eff">{eff}</span>}</>}
            value={hit === 'ko' ? (koHit?.pct ? <TipDmg pct={koHit.pct} range={koHit.range} side="def" band="ohko" /> : <KoBadge side="def" band="ohko" />)
              : <TipDmg pct={hit.pct} range={hit.range} side="def" band={band} immune={mult === 0} />} />
        </TipRows>
      </TipSec>
    </>
  );
}

function DefenseMetaLegend() {
  const t = useT();
  return (
    <>
      {LEGEND.map(l => <span key={l.cls} className={`hold-chip ${l.cls}`}>{KO_TAG[l.band]} <small>({l.pct === 'under' ? t('ddetail.legend.under33') : l.pct})</small></span>)}
      <span className="cm-ko small">OHKO</span>
    </>
  );
}
