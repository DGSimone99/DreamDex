import { useId } from 'react';
import type { CellState, DashboardData } from '../../engine/overviewDashboard';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { useRoving } from '../useRoving';
import { Icon } from '../icons';
import { typeColor } from '../Sprite';
import { typeIconUrl, tileStyle } from '../typeIcons';
import { DefenseTip, OffenseTip } from './CoverageTip';
import { DashCard, DashLink } from './DashCard';

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

/** Copertura: i 18 tipi, una riga per l'Offesa e una per la Difesa (l'ordine delle schede); non si comprime mai. */
export function CoverageSection({ coverage, onView }: { coverage: DashboardData['coverage']; onView: (v: AnalysisView, sub?: string) => void }) {
  const t = useT();
  const lang = useLang();
  const defense = t('dash.rowDefense');
  const offense = t('dash.rowOffense');
  const title = t('dash.coverage');
  const names = coverage.cells.map(cell => typeName(cell.type, lang));
  const tip = useFloatAnchor<{ side: 'offense' | 'defense'; i: number }>();
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
        </tbody>
      </table>
      {tip.anchor && tipCell && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(tipCell.type)} className={`tip-w-m cov-tip ${tip.anchor.key.side}`}>
          {tip.anchor.key.side === 'offense' ? <OffenseTip cell={tipCell} /> : <DefenseTip cell={tipCell} />}
        </FloatTip>
      )}
    </DashCard>
  );
}
