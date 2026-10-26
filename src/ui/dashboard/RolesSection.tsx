import { useId } from 'react';
import { needLabel } from '../../engine/needs';
import type { DashboardData, RoleChip } from '../../engine/overviewDashboard';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/** Sprite dei membri in testa alle colonne. */
const SPRITE: Record<Density, number> = { tight: 22, normal: 32, roomy: 44 };

/** Prima i mancanti, così un problema non finisce mai in fondo o nel "+N". */
const missingFirst = (chips: RoleChip[]) => [...chips].sort((a, b) => Number(a.covered) - Number(b.covered));

/**
 * Una riga della tabella: il ruolo (✓ coperto, ✕ rosso se manca) e un pallino sotto ogni membro che lo copre.
 * Si legge intera: "Hazard, coperto da Garchomp" / "Rimozione Strumenti, mancante".
 */
function RoleRow({ chip, members }: { chip: RoleChip; members: string[] }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const detail = chip.covered ? t('dash.roleCoveredBy', { names: chip.owners.join(', ') }) : t('dash.roleMissing');
  return (
    <tr className={`dash-role-row ${chip.covered ? 'ok' : 'bad'}`} title={`${label}: ${chip.covered ? chip.owners.join(', ') : detail}`}>
      <th scope="row">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span>{label}<span className="visually-hidden">, {detail}</span></span>
      </th>
      {members.map((member, i) => (
        <td key={`${member}-${i}`} title={`${label}: ${member}`}>
          {chip.owners.includes(member) && <span className="dash-dot" aria-hidden="true" />}
        </td>
      ))}
    </tr>
  );
}

/** Un ruolo minore: chip col solo segno e nome, tenue (chi lo copre è nel tooltip). */
function MinorChip({ chip }: { chip: RoleChip }) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const detail = chip.covered ? t('dash.roleCoveredBy', { names: chip.owners.join(', ') }) : t('dash.roleMissing');
  return (
    <li data-fit className={`dash-role ${chip.covered ? 'ok' : 'soft'}`} title={`${label}: ${chip.covered ? chip.owners.join(', ') : detail}`}>
      <span className="dash-role-tag">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span className="dash-role-name">{label}<span className="visually-hidden">, {detail}</span></span>
      </span>
    </li>
  );
}

const MAIN = ['essential', 'important'] as const;

/**
 * Ruoli come tabella ruoli × membri: in testa gli sprite dei membri, una riga per ogni ruolo essenziale e importante
 * (le fasce sono intestazioni tra le righe) e un pallino dove il membro lo copre; un ruolo mancante è una riga rossa vuota.
 * Le righe si vedono sempre tutte; i minori sono chip tenui in fondo (non nello stretto), e quelli che non stanno finiscono nel "+N".
 */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important') };
  const bands = MAIN.map(level => missingFirst(roles.chips.filter(c => c.level === level)));
  const minors = missingFirst(roles.chips.filter(c => c.level === 'minor'));
  const { ref, shown } = useFit<HTMLDivElement>(
    `${density}|${lang}|${roles.members.join()}|${roles.chips.map(c => `${c.need}${c.covered}${c.owners.join('+')}`).join()}`,
    minors.length, { more: true },
  );
  const hidden = minors.length - shown;
  const minorsId = useId();
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      links={<DashLink area={t('area.roles')} onClick={() => onView('roles')} />}>
      <div ref={ref} className="dash-role-body dash-fit">
        <table className="dash-role-grid" aria-label={t('area.roles')}>
          <thead>
            <tr>
              <td />
              {roles.members.map((member, i) => (
                <th key={`${member}-${i}`} scope="col" title={member}>
                  <Sprite species={member} size={SPRITE[density]} />
                  <span className="visually-hidden">{member}</span>
                </th>
              ))}
            </tr>
          </thead>
          {MAIN.map((level, i) => bands[i].length > 0 && (
            <tbody key={level}>
              <tr className="dash-role-sep"><th scope="rowgroup" colSpan={roles.members.length + 1}>{titles[level]}</th></tr>
              {bands[i].map(chip => <RoleRow key={chip.need} chip={chip} members={roles.members} />)}
            </tbody>
          ))}
        </table>
        {/* Stretto: le righe prendono tutto lo spazio, i minori restano nella scheda Ruoli */}
        {density !== 'tight' && minors.length > 0 && (
          <div className="dash-role-minors">
            <span id={minorsId} className="dash-level-name">{t('dash.levelMinor')}</span>
            <ul className="dash-role-list" aria-labelledby={minorsId}>
              {minors.slice(0, shown).map(chip => <MinorChip key={chip.need} chip={chip} />)}
              {hidden > 0 && (
                <li data-fit-more className="dash-role more" title={t('dash.moreRoles', { n: hidden })}>
                  <span aria-hidden="true">+{hidden}</span><span className="visually-hidden">{t('dash.moreRoles', { n: hidden })}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </DashCard>
  );
}
