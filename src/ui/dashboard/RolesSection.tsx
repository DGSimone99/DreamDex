import { useId } from 'react';
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

/** Le mini icone di chi copre il ruolo (al più due, poi "+N"); i nomi sono già nel testo nascosto della riga. */
function Owners({ owners }: { owners: string[] }) {
  if (!owners.length) return null;
  return (
    <span className="dash-owners" aria-hidden="true">
      {owners.slice(0, OWNERS).map(name => <PokemonIcon key={name} name={name} />)}
      {owners.length > OWNERS && <small>+{owners.length - OWNERS}</small>}
    </span>
  );
}

/**
 * Un ruolo, come chip col nome su una riga: ✓ tenue se coperto, ✕ rosso pieno se manca (essenziali e importanti),
 * tratteggiato se è un minore; accanto le mini icone di chi lo copre.
 * Si legge intero: "Hazard, coperto da Garchomp" / "Rimozione Strumenti, mancante".
 */
function RoleRow({ chip, owners }: { chip: RoleChip; owners: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const state = chip.covered ? 'ok' : chip.level === 'minor' ? 'soft' : 'bad';
  const detail = chip.covered ? t('dash.roleCoveredBy', { names: chip.owners.join(', ') }) : t('dash.roleMissing');
  return (
    <li data-fit className={`dash-role ${state}${chip.level === 'minor' ? ' minor' : ''}`} title={`${label}: ${chip.covered ? chip.owners.join(', ') : detail}`}>
      <span className="dash-role-tag">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span className="dash-role-name">{label}<span className="visually-hidden">, {detail}</span></span>
      </span>
      {owners && chip.covered && <Owners owners={chip.owners} />}
    </li>
  );
}

/** Una fascia (un livello): l'etichetta a sinistra, i ruoli in fila che vanno a capo; quelli che non stanno nel "+N" a fine fascia. */
function RoleBand({ title, chips, density }: { title: string; chips: RoleChip[]; density: Density }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  // La lingua cambia la larghezza delle etichette: si rimisura
  const { ref, shown } = useFit<HTMLUListElement>(`${density}|${lang}|${chips.map(c => `${c.need}${c.covered}${c.owners.length}`).join()}`, chips.length, { reserve: 1 });
  const hidden = chips.length - shown;
  return (
    <div className="dash-role-band">
      <span id={id} className="dash-level-name">{title}</span>
      <ul ref={ref} className="dash-fit dash-role-list" aria-labelledby={id}>
        {chips.slice(0, shown).map(chip => <RoleRow key={chip.need} chip={chip} owners={density !== 'tight'} />)}
        {hidden > 0 && <li className="dash-role more" title={t('dash.moreRoles', { n: hidden })}>+{hidden}</li>}
      </ul>
    </div>
  );
}

const LEVELS = ['essential', 'important', 'minor'] as const;

/**
 * Ruoli in tre fasce una sotto l'altra (Essenziali, Importanti, Minori) che si dividono l'altezza della card.
 * Stretto: solo segno e nome. Normale e ampio: anche le icone di chi copre il ruolo.
 */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important'), minor: t('dash.levelMinor') };
  // In ogni fascia prima i mancanti: se non stanno tutti, nel "+N" finiscono i coperti, mai un problema
  const bands = LEVELS.map(level => roles.chips.filter(c => c.level === level).sort((a, b) => Number(a.covered) - Number(b.covered)));
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      links={<DashLink area={t('area.roles')} onClick={() => onView('roles')} />}>
      <div className="dash-role-bands">
        {LEVELS.map((level, i) => <RoleBand key={level} title={titles[level]} chips={bands[i]} density={density} />)}
      </div>
    </DashCard>
  );
}
