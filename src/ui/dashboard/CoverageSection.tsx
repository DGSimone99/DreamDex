import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CellState, DashboardData, MetaThreat } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import type { KoFocus } from '../AreaDetail';
import { FloatTip, goText, keyboardFocus, TipGo, useFloatAnchor } from '../FloatTip';
import { Icon } from '../icons';
import { hint } from '../MoveTip';
import { PokemonIcon } from '../PokemonName';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { typeIconUrl, tileStyle } from '../typeIcons';
import { useRoving } from '../useRoving';
import { DefenseTip, OffenseTip } from './CoverageTip';
import { DashCard, DashLink } from './DashCard';
import { firstType, useReasonText } from './threatText';

/** Prima lettera minuscola: il dettaglio segue "Terra, colpisce:". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/** Icona del tipo, decorativa: il nome è nel testo nascosto e nel tooltip della testata. */
function TypeIcon({ type }: { type: string }) {
  return <img className="dash-type ti-sq" style={tileStyle(type)} src={typeIconUrl(type)} alt="" width={22} height={22} draggable={false} />;
}

/**
 * Una casella: coperto appena visibile, minore in giallo, scoperto in rosso con la ✕. Il dettaglio a parole è il suo
 * nome (screen reader); a vista, al passaggio, il tooltip DreamDex (FloatTip) al posto del tooltip del browser.
 */
function Cell({ state, label, onEnter, onLeave }: { state: CellState; label: string; onEnter: (el: Element) => void; onLeave: () => void }) {
  // Raggiungibile con le frecce (data-nav: la tabella è un posto solo nel giro del Tab); col fuoco da tastiera il tooltip
  return (
    <td className={`dash-cell ${state}`} aria-label={label} data-nav="" onMouseEnter={e => onEnter(e.currentTarget)} onMouseLeave={onLeave}
      onFocus={e => { if (keyboardFocus(e.currentTarget)) onEnter(e.currentTarget); }} onBlur={onLeave}>
      <Icon name={state === 'ok' ? 'check' : 'close'} />
    </td>
  );
}

/** Il lato di una minaccia e la sua scheda: l'Offesa si chiama "strength" fra le schede. */
type Side = 'offense' | 'defense';
const areaOf = (side: Side): AnalysisView => (side === 'defense' ? 'defense' : 'strength');
/** La larghezza minima di una piastrella della scheda Meta e lo stacco fra due: quante ne stanno in fila. */
const TILE_MIN = 96;
const TILE_GAP = 6;
/** Senza misura (test, scheda nascosta): sette piastrelle. */
const TILES_DEFAULT = 7;
/** Sotto questa larghezza del pannello (telefono) le piastrelle vanno su due file. */
const PHONE_PANEL = 480;

/**
 * Copertura, con due schede nel titolo (si apre su Tipi, o su Meta se i tipi sono tutti verdi e c'è il meta):
 * - Tipi: i 18 tipi, una riga per l'Offesa e una per la Difesa (l'ordine delle schede); non si comprime mai.
 * - Meta (solo col meta): le sole minacce del meta che il team gestisce peggio (regola di `metaThreats`), come piastrelle
 *   in fila: l'icona del Box su un piedistallo rosso (scoperta) o giallo (a fatica), il nome sotto e in alto a destra lo
 *   scudo (Difesa) e la spada (Offesa) nel colore di quel lato (rosso nessuno, giallo uno solo, verde due o più). Quelle
 *   che non stanno nel "+N". Senza minacce un segno verde. Le due schede sono alte uguali.
 * Al passaggio sulla minaccia il tooltip con i due lati e l'uso; il clic apre la Coverage meta del lato non coperto
 * (la Difesa se lo sono tutti e due) con la colonna della minaccia accesa.
 */
export function CoverageSection({ coverage, threats, onView }: {
  coverage: DashboardData['coverage'];
  /** Le minacce del meta (solo col meta): la scheda Meta. */
  threats?: DashboardData['threats'];
  onView: (v: AnalysisView, sub?: string, focus?: KoFocus) => void;
}) {
  const t = useT();
  const lang = useLang();
  const defense = t('dash.rowDefense');
  const offense = t('dash.rowOffense');
  const title = t('dash.coverage');
  const names = coverage.cells.map(cell => typeName(cell.type, lang));
  const tip = useFloatAnchor<{ side: Side; i: number }>();
  // Si apre su Tipi; con i tipi tutti verdi (Offesa e Difesa) e il meta, su Meta: lì c'è qualcosa da guardare. Dopo un clic
  // del giocatore vale la sua scelta finché la card resta
  const [chosen, setView] = useState<'types' | 'meta' | null>(null);
  const allGreen = coverage.cells.every(cell => cell.offense === 'ok' && cell.defense === 'ok');
  const view = chosen ?? (threats && allGreen ? 'meta' : 'types');
  const meta = view === 'meta' && !!threats;
  const reasonText = useReasonText();
  const thrTip = useFloatAnchor<string>();
  const moreTip = useFloatAnchor<true>();
  const goIds = { defense: useId(), offense: useId() };
  const places = { defense: `${t('area.defense')} › ${t('dash.threatFoot')}`, offense: `${t('area.strength')} › ${t('dash.threatFoot')}` };
  const list = threats?.list ?? [];

  // Quante piastrelle stanno in fila: dalla larghezza del pannello
  const panel = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const apply = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Sul telefono (pannello sotto PHONE_PANEL px) c'è altezza: due file
  const perRow = Math.max(3, Math.floor((width + TILE_GAP) / (TILE_MIN + TILE_GAP)));
  const slots = width > 0 ? perRow * (width < PHONE_PANEL ? 2 : 1) : TILES_DEFAULT;
  const shownThreats = list.length > slots ? list.slice(0, slots - 1) : list;
  const hiddenThreats = list.slice(shownThreats.length);
  const openCount = list.filter(x => x.status === 'open').length;
  const thinCount = list.length - openCount;

  const word = (x: MetaThreat) => t(x.status === 'open' ? 'dash.threatOpen' : 'dash.threatThin');
  const usage = (x: MetaThreat) => t('dash.threatUsage', { pct: formatPercent(lang, x.usage) });
  /** Lo stato di una minaccia su un lato: nessuno la gestisce (rosso), uno solo (giallo), due o più (verde). */
  const stateOf = (x: MetaThreat, side: Side): CellState => {
    const reason = x.reasons.find(r => r.side === side);
    return !reason ? 'ok' : reason.by.length ? 'minor' : 'bad';
  };
  /** La frase di un lato: la ragione se c'è, altrimenti "Lo gestiscono 2 o più membri". */
  const sideText = (x: MetaThreat, side: Side) => {
    const i = x.reasons.findIndex(r => r.side === side);
    return i >= 0 ? reasonText(x)[i] : t('dash.threatSideOk');
  };
  /** Il lato da aprire col clic: la Difesa se lì non è coperta (anche se non lo è nemmeno in Offesa), altrimenti l'Offesa. */
  const sideOf = (x: MetaThreat): Side => (x.reasons.some(r => r.side === 'defense') ? 'defense' : 'offense');
  const openThreat = (side: Side, x?: MetaThreat) =>
    (x ? onView(areaOf(side), 'coverageMeta', { kind: 'threat', side, species: x.species }) : onView(areaOf(side), 'coverageMeta'));
  const tipThreat = thrTip.anchor ? list.find(x => x.species === thrTip.anchor!.key) : undefined;
  const tipCell = tip.anchor ? coverage.cells[tip.anchor.key.i] : null;
  const nav = useRoving<HTMLTableElement>();

  // Per i lettori di schermo, prima delle caselle: i tipi scoperti (rossi) di ogni riga, o nessuno; nel meta quante minacce
  const summaryId = useId();
  const open = (side: Side) => coverage.cells.flatMap((cell, i) => (cell[side] === 'bad' ? [names[i]] : []));
  const [openOff, openDef] = [open('offense'), open('defense')];
  const summary = meta
    ? (list.length ? t('dash.metaSr', { open: openCount, thin: thinCount }) : t('dash.threatsNone'))
    : openOff.length || openDef.length
      ? t('sr.coverage.some', { offense: openOff.join(', ') || t('sr.nobody'), defense: openDef.join(', ') || t('sr.nobody') })
      : t('sr.coverage.none');

  // Le due schede: frecce destra e sinistra per passare dall'una all'altra
  const tabs = threats && (
    <span className="dash-tabs" role="tablist" aria-label={t('dash.tabsLabel')} data-view={view}
      onKeyDown={e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = view === 'types' ? 'meta' : 'types';
        setView(next);
        (e.currentTarget.querySelector(`[data-view="${next}"]`) as HTMLElement | null)?.focus();
      }}>
      {(['types', 'meta'] as const).map(v => (
        <button key={v} type="button" role="tab" data-view={v} aria-selected={view === v} tabIndex={view === v ? 0 : -1} onClick={() => setView(v)}>
          {/* Tipi: tre mini icone di tipo sovrapposte; Meta: il globo della sezione Meta della barra laterale */}
          {v === 'types'
            ? <span className="dash-tab-trio" aria-hidden="true">{(['Fire', 'Water', 'Grass'] as const).map(type => <img key={type} src={typeIconUrl(type)} alt="" draggable={false} />)}</span>
            : <Icon name="globe" />}
          {t(v === 'types' ? 'dash.tabTypes' : 'dash.tabMeta')}
          {v === 'meta' && openCount > 0 && <span className="dash-tab-n" aria-label={t('dash.tabMetaOpen', { n: openCount })}>{openCount}</span>}
        </button>
      ))}
    </span>
  );
  const typesMeta = <>{offense.toLocaleLowerCase()} <b>{coverage.offense}</b> · {defense.toLocaleLowerCase()} <b>{coverage.defense}</b></>;
  const threatsMeta = list.length > 0 && <>{t('dash.threatOpen')} <b className={openCount ? 'bad' : undefined}>{openCount}</b> · {t('dash.threatThin')} <b>{thinCount}</b></>;
  const sideMark = (x: MetaThreat, side: Side) => (
    <span className={`cov-side ${stateOf(x, side)}`}><Icon name={side === 'defense' ? 'shield' : 'sword'} /></span>
  );

  return (
    <DashCard className="dash-coverage" title={title} tabs={tabs}
      meta={meta ? threatsMeta : typesMeta}
      links={<>
        {/* Tipi: ognuno porta alla sua Coverage tipi; Meta: alla sua Coverage meta */}
        <DashLink label={t('area.strength')} area={t('area.strength')} onClick={() => (meta ? openThreat('offense') : onView('strength', 'types'))} />
        <DashLink label={t('area.defense')} area={t('area.defense')} onClick={() => (meta ? openThreat('defense') : onView('defense', 'coverageTypes'))} />
      </>}>
      <p id={summaryId} hidden>{summary}</p>
      <div ref={panel} role={threats ? 'tabpanel' : undefined} className="dash-cov-panel" aria-describedby={meta ? summaryId : undefined}>
        {meta
          ? list.length === 0
            ? <p className="dash-note good dash-meta-none"><Icon name="check" />{t('dash.threatsNone')}</p>
            : (
              <ul className="cov-tiles" aria-label={`${title}: ${t('dash.tabMeta')}`} style={{ '--n': width > 0 && width < PHONE_PANEL ? perRow : slots } as CSSProperties}>
                {shownThreats.map(x => (
                  <li key={x.species}>
                    <button type="button" className={`cov-tile ${x.status}`}
                      aria-label={t('dash.threatLabel', { species: x.species, word: word(x), reasons: (['defense', 'offense'] as const).map(side => `${t(side === 'defense' ? 'area.defense' : 'area.strength')}: ${sideText(x, side)}`).join('. '), usage: usage(x) })}
                      aria-describedby={goIds[sideOf(x)]}
                      onClick={() => { thrTip.close(); openThreat(sideOf(x), x); }}
                      onMouseEnter={e => thrTip.open(x.species, e.currentTarget)} onMouseLeave={thrTip.close}
                      onFocus={e => { if (keyboardFocus(e.currentTarget)) thrTip.open(x.species, e.currentTarget); }} onBlur={thrTip.close}>
                      <span className="cov-sides" aria-hidden="true">{sideMark(x, 'defense')}{sideMark(x, 'offense')}</span>
                      <span className="cov-mon" aria-hidden="true"><PokemonIcon name={x.species} /></span>
                      <b className="cov-name" aria-hidden="true">{x.species}</b>
                    </button>
                  </li>
                ))}
                {hiddenThreats.length > 0 && (
                  <li>
                    <button type="button" className="cov-tile more"
                      aria-label={t('dash.threatsMoreSr', { n: hiddenThreats.length, list: hiddenThreats.map(x => `${x.species} (${word(x)})`).join(', ') })}
                      aria-describedby={goIds.defense}
                      onClick={() => { moreTip.close(); openThreat('defense'); }}
                      onMouseEnter={e => moreTip.open(true, e.currentTarget)} onMouseLeave={moreTip.close}
                      onFocus={e => { if (keyboardFocus(e.currentTarget)) moreTip.open(true, e.currentTarget); }} onBlur={moreTip.close}>
                      <span aria-hidden="true">{t('dash.threatsMore', { n: hiddenThreats.length })}</span>
                    </button>
                  </li>
                )}
              </ul>
            )
          : (
            <table ref={nav.ref} className="dash-matrix" aria-label={title} aria-describedby={summaryId} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
              <thead>
                <tr>
                  <td />
                  {coverage.cells.map((cell, i) => (
                    <th key={cell.type} scope="col" {...hint(names[i])}>
                      <TypeIcon type={cell.type} />
                      <span className="visually-hidden">{names[i]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* data-label: sul telefono la tabella va su due file da 9 tipi e la seconda ripete il nome della riga */}
                <tr data-label={offense}>
                  <th scope="row">{offense}</th>
                  {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.offense} label={`${names[i]}, ${offense.toLocaleLowerCase()}: ${lower(cell.offenseNote)}`}
                    onEnter={el => tip.open({ side: 'offense', i }, el)} onLeave={tip.close} />)}
                </tr>
                <tr data-label={defense}>
                  <th scope="row">{defense}</th>
                  {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.defense} label={`${names[i]}, ${defense.toLocaleLowerCase()}: ${lower(cell.defenseNote)}`}
                    onEnter={el => tip.open({ side: 'defense', i }, el)} onLeave={tip.close} />)}
                </tr>
              </tbody>
            </table>
          )}
      </div>
      {/* Dove porta il clic sulle minacce, per i lettori di schermo */}
      {threats && (['defense', 'offense'] as const).map(side => <span key={side} id={goIds[side]} hidden>{goText(t, places[side])}</span>)}
      {thrTip.anchor && tipThreat && (
        <FloatTip rect={thrTip.anchor.rect} tone={typeColor(firstType(tipThreat.species))} className="thr-tip">
          <div className="ftip-head">
            <Sprite species={tipThreat.species} size={SPRITE_TIP_ROW} />
            <b>{tipThreat.species}</b>
            <span className="thr-tip-use">{usage(tipThreat)}</span>
          </div>
          {/* I due lati, quello che il clic apre per primo: lo scudo per la Difesa (reggerla), la spada per l'Offesa (mandarla KO) */}
          <ul className="thr-tip-why sided">
            {([sideOf(tipThreat), sideOf(tipThreat) === 'defense' ? 'offense' : 'defense'] as const).map(side => {
              const state = stateOf(tipThreat, side);
              return (
                <li key={side} className={state === 'bad' ? 'open' : state === 'minor' ? 'thin' : 'ok'}>
                  <Icon name={side === 'defense' ? 'shield' : 'sword'} />
                  <b>{t(side === 'defense' ? 'area.defense' : 'area.strength')}</b> {sideText(tipThreat, side)}
                </li>
              );
            })}
          </ul>
          <TipGo place={places[sideOf(tipThreat)]} />
        </FloatTip>
      )}
      {moreTip.anchor && (
        <FloatTip rect={moreTip.anchor.rect} tone={hiddenThreats.some(x => x.status === 'open') ? 'var(--bad)' : 'var(--warn)'} className="thr-tip">
          <div className="ftip-head"><b>{t('dash.threatsMoreHead', { n: hiddenThreats.length })}</b></div>
          <ul className="thr-tip-why">
            {hiddenThreats.map(x => <li key={x.species} className={x.status === 'open' ? 'open' : 'thin'}><b>{x.species}</b> {word(x)}</li>)}
          </ul>
          <TipGo place={places.defense} />
        </FloatTip>
      )}
      {tip.anchor && tipCell && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(tipCell.type)} className={tip.anchor.key.side}>
          {tip.anchor.key.side === 'offense' ? <OffenseTip cell={tipCell} /> : <DefenseTip cell={tipCell} />}
        </FloatTip>
      )}
    </DashCard>
  );
}
