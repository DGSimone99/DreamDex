import { useId } from 'react';
import { needLabel } from '../../engine/needs';
import type { DashboardData, RoleChip } from '../../engine/overviewDashboard';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/**
 * Un ruolo: ✓ tenue se coperto, ✕ rosso pieno se manca (essenziali e importanti), tratteggiato se è un minore.
 * Stretto e normale: un chip col solo segno e nome, su una riga (chi lo copre è nel tooltip). Ampio: una riga per ruolo
 * coi nomi di chi lo copre scritti, senza icone ("✓ Hazard: Garchomp, Great Tusk"); un ruolo scoperto è solo "✕ Rimozione Strumenti".
 * Si legge intero: "Hazard, coperto da Garchomp" / "Rimozione Strumenti, mancante".
 */
function RoleRow({ chip, density }: { chip: RoleChip; density: Density }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const state = chip.covered ? 'ok' : chip.level === 'minor' ? 'soft' : 'bad';
  const detail = chip.covered ? t('dash.roleCoveredBy', { names: chip.owners.join(', ') }) : t('dash.roleMissing');
  const line = density === 'roomy';
  return (
    <li data-fit className={`dash-role ${state}${chip.level === 'minor' ? ' minor' : ''}${line ? ' line' : ''}`} title={`${label}: ${chip.covered ? chip.owners.join(', ') : detail}`}>
      <span className="dash-role-tag">
        <Icon name={chip.covered ? 'check' : 'close'} />
        {/* I due punti solo a vista: il nome accessibile resta "Rimozione Strumenti, mancante" */}
        <span className="dash-role-name">{label}<span className="visually-hidden">, {detail}</span>{line && chip.covered && <span aria-hidden="true">:</span>}</span>
      </span>
      {line && chip.covered && <span className="dash-role-who" aria-hidden="true">{chip.owners.join(', ')}</span>}
    </li>
  );
}

/** Una fascia (un livello): l'etichetta a sinistra, i ruoli che vanno a capo; quelli che non stanno nel "+N" a fine fascia. */
function RoleBand({ title, chips, shown, density }: { title: string; chips: RoleChip[]; shown: number; density: Density }) {
  const t = useT();
  const id = useId();
  const hidden = chips.length - shown;
  return (
    <div className="dash-role-band">
      <span id={id} className="dash-level-name">{title}</span>
      <ul className="dash-role-list" aria-labelledby={id}>
        {chips.slice(0, shown).map(chip => <RoleRow key={chip.need} chip={chip} density={density} />)}
        {hidden > 0 && (
          <li data-fit-more className="dash-role more" title={t('dash.moreRoles', { n: hidden })}>
            <span aria-hidden="true">+{hidden}</span><span className="visually-hidden">{t('dash.moreRoles', { n: hidden })}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

const LEVELS = ['essential', 'important', 'minor'] as const;

/**
 * Ruoli in tre fasce una sotto l'altra (Essenziali, Importanti, Minori), compatte in alto: la card è alta quanto
 * il contenuto dentro la card, che si stira fino in fondo. Stretto e normale: chip col solo segno e nome; ampio: una riga per ruolo
 * coi nomi di chi lo copre.
 * Quanti ruoli stanno si misura una volta per tutta la card, in ordine (essenziali, importanti, minori; in ogni fascia
 * prima i mancanti): se manca spazio cedono prima i minori, mai un problema prima di un coperto, e ogni fascia
 * tagliata chiude col suo "+N". Mai un "+N" in una fascia mentre un'altra ha spazio vuoto.
 */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important'), minor: t('dash.levelMinor') };
  const bands = LEVELS.map(level => roles.chips.filter(c => c.level === level).sort((a, b) => Number(a.covered) - Number(b.covered)));
  const total = roles.chips.length;
  // La lingua cambia la larghezza delle etichette: si rimisura. Le fasce seguono il contenuto: si guarda anche la card
  const { ref, shown } = useFit<HTMLDivElement>(
    `${density}|${lang}|${bands.flat().map(c => `${c.need}${c.covered}${c.owners.join('+')}`).join()}`, total,
    { more: true, outer: '.dash-roles' },
  );
  let left = shown;
  const visible = bands.map(chips => {
    const n = Math.min(chips.length, Math.max(0, left));
    left -= n;
    return n;
  });
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      links={<DashLink area={t('area.roles')} onClick={() => onView('roles')} />}>
      <div ref={ref} className="dash-role-bands dash-fit">
        {LEVELS.map((level, i) => <RoleBand key={level} title={titles[level]} chips={bands[i]} shown={visible[i]} density={density} />)}
      </div>
    </DashCard>
  );
}
