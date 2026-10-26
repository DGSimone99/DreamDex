import type { CellState, DashboardData } from '../../engine/overviewDashboard';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import { DashCard, DashLink } from './DashCard';

/** Prima lettera minuscola: il dettaglio segue "Terra, colpisce:". */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

// Icone ufficiali di Scarlatto/Violetto (PokeAPI sprites, types/generation-ix/scarlet-violet/small; grafica Nintendo),
// incluse nel bundle da Vite: niente rete a runtime
const TYPE_ICONS = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../assets/types/*.png', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** Icona del tipo, decorativa: il nome è nel testo nascosto e nel tooltip della testata. */
function TypeIcon({ type }: { type: string }) {
  return <img className="dash-type" src={TYPE_ICONS[type.toLowerCase()]} alt="" width={22} height={22} draggable={false} />;
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
                <TypeIcon type={cell.type} />
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
