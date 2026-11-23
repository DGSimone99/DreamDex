import { useId, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { battleName, battleSpecies } from '../../engine/dex';
import { holdBand, type HoldBand, type TeamDefense } from '../../engine/defense';
import { pieceOf, type HoldPiece } from './HoldBars';
import { HOLD_BANDS } from './holds';
import { FocusNote } from '../offense/KoBadges';
import { battleMoveType } from '../../engine/types';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MoveLine } from '../dashboard/CoverageTip';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { GRID_CELLS, useRoving } from '../useRoving';
import { useMemberTip } from '../MemberCard';
import { MetaFrame, MetaOrderSwitch, type MetaOrder } from '../MetaFrame';
import { byThreat, byUsage } from '../../engine/overviewDashboard';
import { HpLeft } from '../offense/OffenseMeta';
import { PokemonIcon } from '../PokemonName';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { KoBadge } from '../KoBadge';
import { TipHead, TipSec } from '../TipHead';
import { MemberMon } from './MemberMon';
import { EffTag, effClass, effLabel, useColumnHover } from '../effTag';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];
type Holder = Row['heldBy'][number];

/** Quanti membri la reggono del tutto: 0 rosso, 1 giallo, da 2 verde (come "Lo coprono" dell'Offesa). */
const countTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');
/** Le soglie con un numero, coi colori e i crediti di Coverage tipi: pieno sotto un terzo dei PS, metà sotto la metà, niente
 * se lo manda KO in due colpi; KO a parte. */
const LEGEND = [{ cls: 'hold-4', tag: '< 33%' }, { cls: 'hold-3', tag: '33–49%' }, { cls: 'hold-2', tag: '50–99%' }] as const;

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
 * la legenda corta. In basso a sinistra l'efficacia della mossa della minaccia quando non è neutra; "Solo efficacia"
 * (`ctx.effOnly`) spegne le caselle neutre. Col puntatore la colonna si accende.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const hover = useColumnHover();
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
    return c === null ? null : c === 'ko' ? 'ohko' : pieceOf(c.band);
  };
  const lit = (row: Row) => !!focus && pieceAt(row, focus.slot) === focus.band;
  // Aperta da una minaccia della Panoramica: la sua colonna per prima (prima pagina) e accesa, le altre spente
  const threat = ctx.focus?.kind === 'threat' && ctx.focus.side === 'defense' ? ctx.focus.species : null;
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
          <span className="cm-ko" aria-hidden="true">KO</span>
          <span className="visually-hidden">{row.species}: KO</span>
          <EffTag label={tag} side="defense" />
        </td>
      );
    }
    return (
      <td key={key} className={hover.cls(k, `rob-cell dm-cell ${HOLD_BANDS[c.band].cls}${eff}`)} onMouseEnter={enter} onMouseLeave={tip.close} onFocus={focusIn} onBlur={tip.close}>
        <span className="wall-pct ct-num">{c.pct}<i>%</i></span><HpLeft pct={c.pct} />
        <span className="visually-hidden"> {row.species}: {c.move ? `${c.move} ` : ''}{c.pct}%</span>
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
        <ThreatHitTip row={row} name={name} hit={c} mult={effLabel(row.mults?.[knownIndex[m]], 'defense')} koMove={row.hits?.[knownIndex[m]]?.move} />
      </FloatTip>
    );
  };

  const body = (shown: Row[], pager: ReactNode) => {
    const cells = shown.map(r => cellsOf(r, names));
    return (
      <div className={`def-frame def-meta-grid cm-matrix${ctx.roomy ? ' roomy' : ''}`}>
        <div className="ad-scroll">
          <p id={summaryId} hidden>{open.length ? t('sr.cm.defense', { list: open.join(', ') }) : t('sr.cm.defenseNone')}</p>
          <table ref={nav.ref} aria-label={`${t('area.defense')}: ${t('detail.coverageMeta')}`} aria-describedby={summaryId} className="def-grid spaced ct-table"
            onMouseLeave={() => { hover.table.onMouseLeave(); tip.close(); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hover.clear(); }}>
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

  return <MetaFrame rows={rows} summary={null} body={body} resetKey={order}
    labels={{ pages: t('ddetail.cm.pages'), prev: t('ddetail.cm.prev'), next: t('ddetail.cm.next'), page: (from, to) => t('ddetail.cm.page', { from, to }) }} />;
}

/** La legenda di Coverage meta della Difesa: il timbro KO, poi le tre fasce col loro % (come Coverage tipi). */
/**
 * Il tooltip di un colpo di una minaccia su un membro (casella di Coverage meta, pastiglia della Generale): la minaccia
 * col badge dei colpi, il membro, la mossa della minaccia con l'efficacia e il danno; "KO" se lo manda KO in un colpo.
 */
export function ThreatHitTip({ row, name, hit, mult, koMove }: { row: Row; name: string; hit: { move: string; pct: number; partial: boolean; band?: HoldBand } | 'ko'; mult: string | null; koMove?: string }) {
  const t = useT();
  // La mossa del colpo: quella della casella, o (KO in un colpo) quella che il motore ha trovato per il membro
  const move = hit === 'ko' ? koMove : hit.move;
  // La fascia del colpo, come nei colpi di tipo (4HKO+, 3HKO, 2HKO)
  const band = hit === 'ko' ? 'ohko' : hit.band ?? holdBand(hit.pct / 100);
  return (
    <>
      <TipHead sprite={row.species} title={row.species} badge={<KoBadge side="def" band={band} />} />
      <TipSec>
        <div className="tht-body">
          <Sprite species={name} size={SPRITE_TIP_ROW} />
          <span className="tht-text">
            <span className="tht-name">{name}</span>
            <span className="tht-move">
              {move ? <MoveLine name={move} type={battleMoveType(row.set, move)} /> : <span className="tht-none">{t('ddetail.cm.koTip')}</span>}
              {mult && <span className="tht-mult">{mult}</span>}
              {hit !== 'ko' && <b className="tht-pct">{hit.pct}<small>%</small></b>}
            </span>
          </span>
        </div>
      </TipSec>
    </>
  );
}

function DefenseMetaLegend() {
  return (
    <>
      <span className="cm-ko small">KO</span>
      {LEGEND.map(l => <span key={l.cls} className={`hold-chip ${l.cls}`}>{l.tag}</span>)}
    </>
  );
}
