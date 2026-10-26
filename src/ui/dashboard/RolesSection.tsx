import { needLabel } from '../../engine/needs';
import type { DashboardData, RoleChip } from '../../engine/overviewDashboard';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';
import type { Density } from '../OverviewDashboard';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/** Membri mostrati accanto a un ruolo coperto (poi "+N"). */
const OWNERS = 2;

/** Un ruolo: coperto solo contorno, mancante rosso pieno (essenziali e importanti) o tratteggiato (minori). */
function Chip({ chip, owners }: { chip: RoleChip; owners: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const state = chip.covered ? 'ok' : chip.level === 'minor' ? 'soft' : 'bad';
  return (
    <span data-fit className={`dash-chip ${state}`} title={chip.covered ? `${label}: ${chip.owners.join(', ')}` : `${label}: ${t('dash.roleMissing')}`}>
      <Icon name={chip.covered ? 'check' : 'close'} />
      {label}
      {!chip.covered && <span className="visually-hidden">, {t('dash.roleMissing')}</span>}
      {owners && chip.covered && (
        <span className="dash-owners" aria-hidden="true">
          {chip.owners.slice(0, OWNERS).map(name => <PokemonIcon key={name} name={name} />)}
          {chip.owners.length > OWNERS && <small>+{chip.owners.length - OWNERS}</small>}
        </span>
      )}
    </span>
  );
}

/** Ruoli: chip dei ruoli contati; ampio: per livello, minori compresi, con le mini icone dei membri. */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const roomy = density === 'roomy';
  const chips = roomy ? roles.chips : roles.chips.filter(c => c.level !== 'minor');
  const { ref, shown } = useFit<HTMLDivElement>(`${density}|${chips.map(c => `${c.need}${c.covered}`).join()}`, chips.length, { reserve: 1 });
  const hidden = chips.length - shown;
  const more = hidden > 0 && <span className="dash-chip more" title={t('dash.moreRoles', { n: hidden })}>+{hidden}</span>;
  const levels = [
    { level: 'essential', title: t('analysis.essential') },
    { level: 'important', title: t('analysis.important') },
    { level: 'minor', title: t('dash.levelMinor') },
  ] as const;
  // Per livello, nell'ordine in cui si misurano: le prime `shown` restano
  let start = 0;
  const groups = levels.map(({ level, title }) => {
    const group = chips.filter(c => c.level === level);
    const first = start;
    start += group.length;
    return { level, title, visible: group.filter((_, i) => first + i < shown) };
  }).filter(g => g.visible.length > 0);
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      links={<DashLink area={t('area.roles')} onClick={() => onView('roles')} />}>
      <div ref={ref} className="dash-fit">
        {roomy
          ? <>
            {groups.map(({ level, title, visible }) => (
              <div key={level} className="dash-level">
                <span className="dash-level-name">{title}</span>
                <div className="dash-chips">{visible.map(chip => <Chip key={chip.need} chip={chip} owners />)}</div>
              </div>
            ))}
            {more && <div className="dash-chips">{more}</div>}
          </>
          : <div className="dash-chips">{chips.slice(0, shown).map(chip => <Chip key={chip.need} chip={chip} owners={false} />)}{more}</div>}
      </div>
    </DashCard>
  );
}
