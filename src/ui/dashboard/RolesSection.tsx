import { useId } from 'react';
import { needLabel } from '../../engine/needs';
import type { DashboardData, RoleChip } from '../../engine/overviewDashboard';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite } from '../Sprite';
import { DashCard } from './DashCard';
import { useFit } from './useFit';

const LEVELS = ['essential', 'important', 'minor'] as const;

/** Prima i mancanti, così un problema non finisce mai in fondo o nel "+N". */
const missingFirst = (chips: RoleChip[]) => [...chips].sort((a, b) => Number(a.covered) - Number(b.covered));

/** ✓ tenue se coperto, ✕ rosso pieno se manca (essenziali e importanti), tratteggiato se è un minore. */
const stateOf = (chip: RoleChip) => (chip.covered ? 'ok' : chip.soft ? 'soft' : 'bad');

/** Il nome accessibile di un ruolo: "Hazard, coperto da Garchomp" / "Rimozione Strumenti, mancante". */
function useRoleText(chip: RoleChip) {
  const t = useT();
  const lang = useLang();
  const label = needLabel(chip.need, lang);
  const detail = chip.covered ? t('dash.roleCoveredBy', { names: chip.owners.join(', ') }) : t('dash.roleMissing');
  return { label, detail };
}

/**
 * Il tooltip DreamDex di un ruolo: il nome col suo livello e solo le sprite di chi lo copre (niente percentuali);
 * se manca, "Nessuno lo copre" in rosso (in grigio se è un minore).
 */
function RoleTip({ chip }: { chip: RoleChip }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <div className={`role-tip-head ${stateOf(chip)}`}>
        <Icon name={chip.covered ? 'check' : 'close'} />
        <b>{needLabel(chip.need, lang)}</b>
        <small>{t(`rdetail.level.${chip.level}`)}</small>
      </div>
      {chip.covered
        ? <div className="role-tip-mons">{chip.owners.map(name => (
          <span key={name} className="role-tip-mon"><span className="ctip-plinth good"><Sprite species={name} size={56} /></span><span>{name}</span></span>
        ))}</div>
        : <p className={`role-tip-none ${chip.soft ? 'soft' : ''}`}>{t('roleTip.nobody')}</p>}
    </>
  );
}

/** I gestori del tooltip di un ruolo e il tooltip da rendere (uno per chip o riga). */
function useRoleTip(chip: RoleChip) {
  const tip = useFloatAnchor<RoleChip>();
  const bind = { onMouseEnter: (e: { currentTarget: Element }) => tip.open(chip, e.currentTarget), onMouseLeave: tip.close };
  const node = tip.anchor && (
    <FloatTip rect={tip.anchor.rect} tone={chip.covered ? 'var(--good)' : chip.soft ? 'var(--faint)' : 'var(--bad)'} className="role">
      <RoleTip chip={chip} />
    </FloatTip>
  );
  return { bind, node };
}

/** Stretto e normale: un chip col solo segno e nome, su una riga (chi lo copre è nel tooltip DreamDex). */
function RoleChipItem({ chip }: { chip: RoleChip }) {
  const { label, detail } = useRoleText(chip);
  const tip = useRoleTip(chip);
  return (
    <li data-fit className={`dash-role ${stateOf(chip)}${chip.level === 'minor' ? ' minor' : ''}`} {...tip.bind}>
      {tip.node}
      <span className="dash-role-tag">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span className="dash-role-name">{label}<span className="visually-hidden">, {detail}</span></span>
      </span>
    </li>
  );
}

/** Una fascia (un livello): l'etichetta a sinistra, i ruoli che vanno a capo; quelli che non stanno nel "+N" a fine fascia. */
function RoleBand({ title, chips, shown }: { title: string; chips: RoleChip[]; shown: number }) {
  const t = useT();
  const id = useId();
  const hidden = chips.length - shown;
  return (
    <div className="dash-role-band">
      <span id={id} className="dash-level-name">{title}</span>
      <ul className="dash-role-list" aria-labelledby={id}>
        {chips.slice(0, shown).map(chip => <RoleChipItem key={chip.need} chip={chip} />)}
        {hidden > 0 && (
          <li data-fit-more className="dash-role more" title={t('dash.moreRoles', { n: hidden })}>
            <span aria-hidden="true">+{hidden}</span><span className="visually-hidden">{t('dash.moreRoles', { n: hidden })}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Stretto e normale: tre fasce una sotto l'altra (Essenziali, Importanti, Minori), compatte in alto.
 * Quanti ruoli stanno si misura una volta per tutta la card, in ordine (essenziali, importanti, minori; in ogni fascia
 * prima i mancanti): se manca spazio cedono prima i minori, mai un problema prima di un coperto, e ogni fascia
 * tagliata chiude col suo "+N". Mai un "+N" in una fascia mentre un'altra ha spazio vuoto.
 */
function RoleBands({ roles, density, titles }: { roles: DashboardData['roles']; density: Density; titles: Record<(typeof LEVELS)[number], string> }) {
  const lang = useLang();
  const bands = LEVELS.map(level => missingFirst(roles.chips.filter(c => c.level === level)));
  // La lingua cambia la larghezza delle etichette: si rimisura. Le fasce seguono il contenuto: si guarda anche la card
  const { ref, shown } = useFit<HTMLDivElement>(
    `${density}|${lang}|${bands.flat().map(c => `${c.need}${c.covered}${c.owners.join('+')}`).join()}`, roles.chips.length,
    { more: true, outer: '.dash-roles' },
  );
  let left = shown;
  const visible = bands.map(chips => {
    const n = Math.min(chips.length, Math.max(0, left));
    left -= n;
    return n;
  });
  return (
    <div ref={ref} className="dash-role-bands dash-fit">
      {LEVELS.map((level, i) => <RoleBand key={level} title={titles[level]} chips={bands[i]} shown={visible[i]} />)}
    </div>
  );
}

/** Una riga della tabella: il ruolo e un pallino sotto ogni membro che lo copre. */
function RoleTableRow({ chip, members }: { chip: RoleChip; members: string[] }) {
  const { label, detail } = useRoleText(chip);
  return (
    // Col team ridotto la tabella dice già chi copre ogni ruolo (pallini sotto le sprite): niente tooltip, solo la riga che si accende
    <tr className={`dash-role-row ${stateOf(chip)}${chip.level === 'minor' ? ' is-minor' : ''}`}>
      <th scope="row">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span>{label}<span className="visually-hidden">, {detail}</span></span>
      </th>
      {members.map((member, i) => (
        <td key={`${member}-${i}`}>
          {chip.owners.includes(member) && <span className="dash-dot" aria-hidden="true" />}
        </td>
      ))}
    </tr>
  );
}

/**
 * Ampio: tabella ruoli × membri con tutti i livelli. In testa gli sprite dei membri, una riga per ruolo (le fasce sono
 * intestazioni tra le righe) e un pallino dove il membro lo copre; un essenziale o importante mancante è una riga rossa,
 * i minori sono più tenui. La tabella si stira fino in fondo alla card: con pochi ruoli le righe sono più alte.
 */
function RoleTable({ roles, titles }: { roles: DashboardData['roles']; titles: Record<(typeof LEVELS)[number], string> }) {
  const t = useT();
  const bands = LEVELS.map(level => missingFirst(roles.chips.filter(c => c.level === level)));
  return (
    <div className="dash-role-body dash-fit">
      <table className="dash-role-grid" aria-label={t('area.roles')}>
        <thead>
          <tr>
            <td />
            {roles.members.map((member, i) => (
              <th key={`${member}-${i}`} scope="col" title={member}>
                <Sprite species={member} size={44} />
                <span className="visually-hidden">{member}</span>
              </th>
            ))}
          </tr>
        </thead>
        {LEVELS.map((level, i) => bands[i].length > 0 && (
          <tbody key={level}>
            <tr className="dash-role-sep"><th scope="rowgroup" colSpan={roles.members.length + 1}>{titles[level]}</th></tr>
            {bands[i].map(chip => <RoleTableRow key={chip.need} chip={chip} members={roles.members} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Ruoli: chip in fasce nello stretto e nel normale, tabella ruoli × membri nell'ampio. */
export function RolesSection({ roles, density, onView }: { roles: DashboardData['roles']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important'), minor: t('dash.levelMinor') };
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<b>{roles.value}</b>}
      onOpen={() => onView('roles')} openLabel={t('dash.openRoles')}>
      {density === 'roomy' ? <RoleTable roles={roles} titles={titles} /> : <RoleBands roles={roles} density={density} titles={titles} />}
    </DashCard>
  );
}
