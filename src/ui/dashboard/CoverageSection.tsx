import type { CSSProperties } from 'react';
import type { CellState, DashboardData } from '../../engine/overviewDashboard';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import { inkFor, typeColor } from '../Sprite';
import { DashCard, DashLink } from './DashCard';

/** Prima lettera minuscola: il dettaglio segue "Terra, colpisce:". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/** Icona del tipo: un cerchio nel suo colore con l'iniziale (niente risorse esterne). */
function TypeBadge({ type, name }: { type: string; name: string }) {
  const color = typeColor(type);
  return <span className="dash-type" style={{ '--tc': color, color: inkFor(color) } as CSSProperties} aria-hidden="true">{name.charAt(0)}</span>;
}

/** Una casella: coperto appena visibile, minore in giallo, scoperto in rosso con la ✕. */
function Cell({ state, label }: { state: CellState; label: string }) {
  return (
    <td className={`dash-cell ${state}`} aria-label={label} title={label}>
      <Icon name={state === 'ok' ? 'check' : 'close'} />
    </td>
  );
}

/** Copertura: i 18 tipi, una riga per "Regge" e una per "Colpisce"; non si comprime mai. */
export function CoverageSection({ coverage, onView }: { coverage: DashboardData['coverage']; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const holds = t('dash.holds');
  const hits = t('dash.hits');
  const title = t('dash.coverage');
  const names = coverage.cells.map(cell => typeName(cell.type, lang));
  return (
    <DashCard className="dash-coverage" title={title}
      meta={<>{holds.toLocaleLowerCase()} <b>{coverage.defense}</b> · {hits.toLocaleLowerCase()} <b>{coverage.offense}</b></>}
      links={<>
        <DashLink label={t('area.defense')} area={t('area.defense')} onClick={() => onView('defense')} />
        <DashLink label={t('area.strength')} area={t('area.strength')} onClick={() => onView('strength')} />
      </>}>
      <table className="dash-matrix" aria-label={title}>
        <thead>
          <tr>
            <td />
            {coverage.cells.map((cell, i) => (
              <th key={cell.type} scope="col" title={names[i]}>
                <TypeBadge type={cell.type} name={names[i]} />
                <span className="visually-hidden">{names[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{holds}</th>
            {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.defense} label={`${names[i]}, ${holds.toLocaleLowerCase()}: ${lower(cell.defenseNote)}`} />)}
          </tr>
          <tr>
            <th scope="row">{hits}</th>
            {coverage.cells.map((cell, i) => <Cell key={cell.type} state={cell.offense} label={`${names[i]}, ${hits.toLocaleLowerCase()}: ${lower(cell.offenseNote)}`} />)}
          </tr>
        </tbody>
      </table>
    </DashCard>
  );
}
