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

/** Un ruolo: coperto solo contorno, mancante rosso pieno (essenziali e importanti) o tratteggiato (minori); i minori più tenui. */
function Chip({ chip, fit = true }: { chip: RoleChip; fit?: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const state = chip.covered ? 'ok' : chip.level === 'minor' ? 'soft' : 'bad';
  return (
    <span data-fit={fit || undefined} className={`dash-chip ${state}${chip.level === 'minor' ? ' minor' : ''}`} title={chip.covered ? `${label}: ${chip.owners.join(', ')}` : `${label}: ${t('dash.roleMissing')}`}>
      <Icon name={chip.covered ? 'check' : 'close'} />
      {label}
      {!chip.covered && <span className="visually-hidden">, {t('dash.roleMissing')}</span>}
    </span>
  );
}

/** Le mini icone di chi copre il ruolo (al più due, poi "+N"), distanziate. */
function Owners({ owners }: { owners: string[] }) {
  if (!owners.length) return null;
  return (
    <span className="dash-owners" aria-hidden="true">
      {owners.slice(0, OWNERS).map(name => <PokemonIcon key={name} name={name} />)}
      {owners.length > OWNERS && <small>+{owners.length - OWNERS}</small>}
    </span>
  );
}

const LEVELS = ['essential', 'important', 'minor'] as const;

/**
 * Ruoli. Stretto: chip in fila, minori in coda finché stanno. Normale: per livello, minori compresi.
 * Ampio: una riga per ruolo con chi lo copre; le righe si allungano fino a riempire la sezione.
 */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important'), minor: t('dash.levelMinor') };
  // Anche in stretto tutti i livelli: i minori (tenui) quando stanno, il resto nel "+N"
  const chips = LEVELS.flatMap(level => roles.chips.filter(c => c.level === level));
  // La lingua cambia la larghezza delle etichette: si rimisura
  const { ref, shown } = useFit<HTMLDivElement>(`${density}|${lang}|${chips.map(c => `${c.need}${c.covered}`).join()}`, chips.length, { reserve: 1 });
  const hidden = chips.length - shown;
  const more = hidden > 0 && <span className="dash-chip more" title={t('dash.moreRoles', { n: hidden })}>+{hidden}</span>;
  const visible = chips.slice(0, shown);
  let body;
  if (density === 'tight') {
    body = <div className="dash-chips">{visible.map(chip => <Chip key={chip.need} chip={chip} />)}{more}</div>;
  } else if (density === 'normal') {
    body = <>
      {LEVELS.map(level => {
        const group = visible.filter(c => c.level === level);
        return group.length > 0 && (
          <div key={level} className="dash-level">
            <span className="dash-level-name">{titles[level]}</span>
            <div className="dash-chips">{group.map(chip => <Chip key={chip.need} chip={chip} />)}</div>
          </div>
        );
      })}
      {more && <div className="dash-chips">{more}</div>}
    </>;
  } else {
    body = <>
      {visible.map((chip, i) => (
        <div key={chip.need} data-fit className={`dash-role${i > 0 && visible[i - 1].level !== chip.level ? ' first' : ''}`}>
          <span className="dash-level-name">{i === 0 || visible[i - 1].level !== chip.level ? titles[chip.level] : ''}</span>
          <Chip chip={chip} fit={false} />
          <Owners owners={chip.covered ? chip.owners : []} />
        </div>
      ))}
      {more && <div className="dash-role"><span />{more}</div>}
    </>;
  }
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      links={<DashLink area={t('area.roles')} onClick={() => onView('roles')} />}>
      <div ref={ref} className={`dash-fit${density === 'roomy' ? ' dash-rows' : ''}`}>{body}</div>
    </DashCard>
  );
}
