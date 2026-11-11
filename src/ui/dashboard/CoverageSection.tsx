import type { CellState, DashboardData } from '../../engine/overviewDashboard';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import { typeIconUrl } from '../typeIcons';
import { DashCard, DashLink } from './DashCard';

/** Prima lettera minuscola: il dettaglio segue "Terra, colpisce:". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);


/** Icona del tipo, decorativa: il nome è nel testo nascosto e nel tooltip della testata. */
function TypeIcon({ type }: { type: string }) {
  return <img className="dash-type" src={typeIconUrl(type)} alt="" width={22} height={22} draggable={false} />;
}

/** Una casella: coperto appena visibile, minore in giallo, scoperto in rosso con la ✕. */
function Cell({ state, label }: { state: CellState; label: string }) {
  return (
    <td className={`dash-cell ${state}`} aria-label={label} title={label}>
      <Icon name={state === 'ok' ? 'check' : 'close'} />
    </td>
  );
}

/** Copertura: i 18 tipi, una riga per l'Offesa e una per la Difesa (l'ordine delle schede); non si comprime mai. */
export function CoverageSection({ coverage, onView }: { coverage: DashboardData['coverage']; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const defense = t('dash.rowDefense');
  const offense = t('dash.rowOffense');
  const title = t('dash.coverage');
  const names = coverage.cells.map(cell => typeName(cell.type, lang));
  return (
    <DashCard className="dash-coverage" title={title}
      meta={<>{offense.toLocaleLowerCase()} <b>{coverage.offense}</b> · {defense.toLocaleLowerCase()} <b>{coverage.defense}</b></>}
      links={<>
        <DashLink label={t('area.strength')} area={t('area.strength')} onClick={() => onView('strength')} />
        <DashLink label={t('area.defense')} area={t('area.defense')} onClick={() => onView('defense')} />
      </>}>
      <table className="dash-matrix" aria-label={title}>
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
            {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.offense} label={`${names[i]}, ${offense.toLocaleLowerCase()}: ${lower(cell.offenseNote)}`} />)}
          </tr>
          <tr data-label={defense}>
            <th scope="row">{defense}</th>
            {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.defense} label={`${names[i]}, ${defense.toLocaleLowerCase()}: ${lower(cell.defenseNote)}`} />)}
          </tr>
        </tbody>
      </table>
    </DashCard>
  );
}
