import { useId } from 'react';
import type { MetaThreat } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import type { KoFocus } from '../AreaDetail';
import { goText, TipGo } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { firstType, useReasonText } from './threatText';
import type { CellState, DashboardData } from '../../engine/overviewDashboard';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { useRoving } from '../useRoving';
import { Icon } from '../icons';
import { typeIconUrl } from '../typeIcons';
import { DefenseTip, OffenseTip } from './CoverageTip';
import { DashCard, DashLink } from './DashCard';

/** Prima lettera minuscola: il dettaglio segue "Terra, colpisce:". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);


/** Icona del tipo, decorativa: il nome è nel testo nascosto e nel tooltip della testata. */
function TypeIcon({ type }: { type: string }) {
  return <img className="dash-type" src={typeIconUrl(type)} alt="" width={22} height={22} draggable={false} />;
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

/**
 * Copertura: i 18 tipi, una riga per l'Offesa e una per la Difesa (l'ordine delle schede); non si comprime mai. Col meta
 * una terza riga, META: le minacce del meta che il team gestisce peggio (regola di `metaThreats`), una per casella nella
 * stessa griglia, rossa se scoperta e gialla se a fatica; se sono più delle caselle l'ultima è "+N". Al passaggio il
 * tooltip con le ragioni e l'uso; il clic apre la Coverage meta con la colonna della minaccia accesa.
 */
export function CoverageSection({ coverage, threats, onView }: {
  coverage: DashboardData['coverage'];
  /** Le minacce del meta (solo col meta): la riga META. */
  threats?: DashboardData['threats'];
  onView: (v: AnalysisView, sub?: string, focus?: KoFocus) => void;
}) {
  const t = useT();
  const lang = useLang();
  const defense = t('dash.rowDefense');
  const offense = t('dash.rowOffense');
  const title = t('dash.coverage');
  const names = coverage.cells.map(cell => typeName(cell.type, lang));
  const tip = useFloatAnchor<{ side: 'offense' | 'defense'; i: number }>();
  // Riga META: le minacce nelle caselle; se non stanno tutte, l'ultima casella è "+N"
  const metaRow = t('dash.rowMeta');
  const reasonText = useReasonText();
  const thrTip = useFloatAnchor<string>();
  const moreTip = useFloatAnchor<true>();
  // Dove porta il clic: la Coverage meta della Difesa se la minaccia non è coperta in Difesa (anche se non lo è
  // nemmeno in Offesa: la Difesa ha la precedenza), altrimenti quella dell'Offesa
  const goIds = { defense: useId(), offense: useId() };
  const places = { defense: `${t('area.defense')} › ${t('dash.threatFoot')}`, offense: `${t('area.strength')} › ${t('dash.threatFoot')}` };
  const sideOf = (x: MetaThreat): 'defense' | 'offense' => (x.reasons.some(r => r.side === 'defense') ? 'defense' : 'offense');
  const list = threats?.list ?? [];
  const cols = coverage.cells.length;
  const shownThreats = list.length > cols ? list.slice(0, cols - 1) : list;
  const hiddenThreats = list.slice(shownThreats.length);
  const word = (x: MetaThreat) => t(x.status === 'open' ? 'dash.threatOpen' : 'dash.threatThin');
  const usage = (x: MetaThreat) => t('dash.threatUsage', { pct: formatPercent(lang, x.usage) });
  const openThreat = (x?: MetaThreat) => {
    if (!x) { onView('defense', 'coverageMeta'); return; }
    const side = sideOf(x);
    onView(side === 'defense' ? 'defense' : 'strength', 'coverageMeta', { kind: 'threat', side, species: x.species });
  };
  const tipThreat = thrTip.anchor ? list.find(x => x.species === thrTip.anchor!.key) : undefined;
  // Il clic da tastiera (Invio o spazio) su una casella della riga META
  const onKey = (go: () => void) => (e: { key: string; preventDefault: () => void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  const tipCell = tip.anchor ? coverage.cells[tip.anchor.key.i] : null;
  const nav = useRoving<HTMLTableElement>();
  // Per i lettori di schermo, prima delle 36 caselle: i tipi scoperti (rossi) di ogni riga, o nessuno
  const summaryId = useId();
  const open = (side: 'offense' | 'defense') => coverage.cells.flatMap((cell, i) => (cell[side] === 'bad' ? [names[i]] : []));
  const [openOff, openDef] = [open('offense'), open('defense')];
  const summary = openOff.length || openDef.length
    ? t('sr.coverage.some', { offense: openOff.join(', ') || t('sr.nobody'), defense: openDef.join(', ') || t('sr.nobody') })
    : t('sr.coverage.none');
  return (
    <DashCard className="dash-coverage" title={title}
      meta={<>{offense.toLocaleLowerCase()} <b>{coverage.offense}</b> · {defense.toLocaleLowerCase()} <b>{coverage.defense}</b></>}
      links={<>
        {/* Ognuno porta alla sua Coverage tipi, la stessa griglia per tipo */}
        <DashLink label={t('area.strength')} area={t('area.strength')} onClick={() => onView('strength', 'types')} />
        <DashLink label={t('area.defense')} area={t('area.defense')} onClick={() => onView('defense', 'coverageTypes')} />
        {/* Col meta: la Coverage meta (le minacce della riga META) */}
        {threats && <DashLink label={t('detail.coverageMeta')} area={metaRow} onClick={() => openThreat()} />}
      </>}>
      <p id={summaryId} hidden>{summary}</p>
      <table ref={nav.ref} className="dash-matrix" aria-label={title} aria-describedby={summaryId} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
        <thead>
          <tr>
            <td />
            {coverage.cells.map((cell, i) => (
              <th key={cell.type} scope="col" title={names[i]}>
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
          {threats && (
            <tr data-label={metaRow} className="dash-meta-row">
              <th scope="row">{metaRow}</th>
              {list.length === 0
                ? <td colSpan={cols} className="dash-meta-none"><Icon name="check" />{t('dash.threatsNone')}</td>
                : (
                  <>
                    {shownThreats.map(x => (
                      <td key={x.species} className={`dash-thr ${x.status}`} data-nav="" tabIndex={-1}
                        aria-label={t('dash.threatLabel', { species: x.species, word: word(x), reasons: reasonText(x).join('. '), usage: usage(x) })} aria-describedby={goIds[sideOf(x)]}
                        onClick={() => { thrTip.close(); openThreat(x); }} onKeyDown={onKey(() => openThreat(x))}
                        onMouseEnter={e => thrTip.open(x.species, e.currentTarget)} onMouseLeave={thrTip.close}
                        onFocus={e => { if (keyboardFocus(e.currentTarget)) thrTip.open(x.species, e.currentTarget); }} onBlur={thrTip.close}>
                        <Sprite species={x.species} size={30} />
                      </td>
                    ))}
                    {hiddenThreats.length > 0 && (
                      <td className="dash-thr more" data-nav="" tabIndex={-1}
                        aria-label={t('dash.threatsMoreSr', { n: hiddenThreats.length, list: hiddenThreats.map(x => `${x.species} (${word(x)})`).join(', ') })} aria-describedby={goIds.defense}
                        onClick={() => { moreTip.close(); openThreat(); }} onKeyDown={onKey(() => openThreat())}
                        onMouseEnter={e => moreTip.open(true, e.currentTarget)} onMouseLeave={moreTip.close}
                        onFocus={e => { if (keyboardFocus(e.currentTarget)) moreTip.open(true, e.currentTarget); }} onBlur={moreTip.close}>
                        <span aria-hidden="true">{t('dash.threatsMore', { n: hiddenThreats.length })}</span>
                      </td>
                    )}
                    {Array.from({ length: cols - shownThreats.length - (hiddenThreats.length ? 1 : 0) }, (_, i) => <td key={`empty${i}`} className="dash-thr empty" aria-hidden="true" />)}
                  </>
                )}
            </tr>
          )}
        </tbody>
      </table>
      {/* Dove porta il clic delle minacce, per i lettori di schermo */}
      {list.length > 0 && (['defense', 'offense'] as const).map(side => <span key={side} id={goIds[side]} hidden>{goText(t, places[side])}</span>)}
      {thrTip.anchor && tipThreat && (
        <FloatTip rect={thrTip.anchor.rect} tone={typeColor(firstType(tipThreat.species))} className="thr-tip">
          <div className="ftip-head">
            <Sprite species={tipThreat.species} size={SPRITE_TIP_ROW} />
            <b>{tipThreat.species}</b>
            <span className="thr-tip-use">{usage(tipThreat)}</span>
          </div>
          {/* Ogni ragione col suo lato: lo scudo per la Difesa (reggerla), la spada per l'Offesa (mandarla KO) */}
          <ul className="thr-tip-why sided">
            {reasonText(tipThreat).map((line, i) => {
              const side = tipThreat.reasons[i].side;
              return (
                <li key={line} className={tipThreat.reasons[i].by.length ? 'thin' : 'open'}>
                  <Icon name={side === 'defense' ? 'shield' : 'sword'} />
                  <b>{t(side === 'defense' ? 'area.defense' : 'area.strength')}</b> {line}
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
