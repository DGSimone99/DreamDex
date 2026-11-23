import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { needLabel } from '../../engine/needs';
import type { DashboardData, RoleChip } from '../../engine/overviewDashboard';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';
import { hint } from '../MoveTip';
import type { Density } from '../OverviewDashboard';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { useRoving } from '../useRoving';
import { Sprite } from '../Sprite';
import { SPRITE_TIP } from '../spriteSizes';
import { DashCard } from './DashCard';
import { useFit } from './useFit';

const LEVELS = ['essential', 'important'] as const;

/** Prima i mancanti, così un problema non finisce mai in fondo o nel "+N". */
const missingFirst = (chips: RoleChip[]) => [...chips].sort((a, b) => Number(a.covered) - Number(b.covered));

/** ✓ tenue se coperto, ✕ rosso pieno se manca; tratteggiato se la mancanza non toglie punti (team incompleto). */
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
 * se manca, "Nessuno lo copre" in rosso (in grigio se non toglie punti).
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
          <span key={name} className="role-tip-mon"><span className="ctip-plinth good"><Sprite species={name} size={SPRITE_TIP} /></span><span>{name}</span></span>
        ))}</div>
        : <p className={`role-tip-none ${chip.soft ? 'soft' : ''}`}>{t('roleTip.nobody')}</p>}
    </>
  );
}

/** I gestori del tooltip di un ruolo e il tooltip da rendere (uno per chip o riga). */
function useRoleTip(chip: RoleChip) {
  const tip = useFloatAnchor<RoleChip>();
  const bind = tip.bind(chip);
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
    // Raggiungibile con le frecce (data-nav: le fasce sono un posto solo nel giro del Tab); col fuoco il tooltip
    <li data-fit data-nav="" data-tap-tip className={`dash-role ${stateOf(chip)}`} {...tip.bind}>
      {tip.node}
      <span className="dash-role-tag">
        <Icon name={chip.covered ? 'check' : 'close'} />
        <span className="dash-role-name">{label}<span className="visually-hidden">, {detail}</span></span>
      </span>
    </li>
  );
}

/**
 * Una fascia (un livello): l'etichetta a sinistra, i ruoli che vanno a capo; quelli che non stanno nel "+N" a fine fascia.
 * Almeno un ruolo c'è sempre (RoleBands); i nomi dei ruoli nascosti, coperti e mancanti, sono nel fumetto del "+N" e ai
 * lettori di schermo. Il "+N" si raggiunge con le frecce (col fuoco il fumetto).
 */
function RoleBand({ title, chips, shown }: { title: string; chips: RoleChip[]; shown: number }) {
  const t = useT();
  const id = useId();
  const lang = useLang();
  const hidden = chips.length - shown;
  const rest = chips.slice(shown);
  // I ruoli nascosti per nome, coi coperti e i mancanti: nel fumetto e ai lettori di schermo
  const names = rest.map(chip => `${needLabel(chip.need, lang)} (${t(chip.covered ? 'dash.roleCoveredBy' : 'dash.roleMissing', { names: chip.owners.join(', ') })})`).join(', ');
  const moreText = `${t(hidden === 1 ? 'dash.moreRolesOne' : 'dash.moreRoles', { n: hidden })}: ${names}`;
  return (
    <div className="dash-role-band">
      <span id={id} className="dash-level-name sum-sec-h">{title}</span>
      {/* Un ruolo solo e il "+N": sulla stessa riga, il nome si accorcia coi puntini se serve */}
      <ul className={`dash-role-list${shown === 1 && hidden > 0 ? ' one' : ''}`} aria-labelledby={id}>
        {chips.slice(0, shown).map(chip => <RoleChipItem key={chip.need} chip={chip} />)}
        {hidden > 0 && (
          <li data-fit-more data-nav="" className="dash-role more" {...hint(moreText)}>
            <span className="more-n" aria-hidden="true">+{hidden}</span><span className="visually-hidden">{moreText}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Stretto e normale: due fasce una sotto l'altra (Essenziali, Importanti), compatte in alto.
 * Quanti ruoli stanno si misura una volta per tutta la card, in ordine (essenziali, importanti; in ogni fascia
 * prima i mancanti): se manca spazio cedono prima gli importanti, mai un problema prima di un coperto, e ogni fascia
 * tagliata chiude col suo "+N", ma tiene sempre il suo primo ruolo. Mai un "+N" in una fascia mentre un'altra ha spazio vuoto.
 */
function RoleBands({ roles, density, titles }: { roles: DashboardData['roles']; density: Density; titles: Record<(typeof LEVELS)[number], string> }) {
  const lang = useLang();
  const bands = LEVELS.map(level => missingFirst(roles.chips.filter(c => c.level === level)));
  // La lingua cambia la larghezza delle etichette: si rimisura. Le fasce seguono il contenuto: si guarda anche la card
  // Ogni fascia mostra almeno un ruolo (il primo: un mancante se c'è) prima del suo "+N", mai il "+N" da solo
  const filled = bands.filter(chips => chips.length > 0).length;
  const { ref, shown } = useFit<HTMLDivElement>(
    `${density}|${lang}|${bands.flat().map(c => `${c.need}${c.covered}${c.owners.join('+')}`).join()}`, roles.chips.length,
    { more: true, min: filled, outer: '.dash-roles' },
  );
  const nav = useRoving<HTMLDivElement>();
  // Il primo di ogni fascia è garantito; il resto dei posti va in ordine (prima gli essenziali)
  let left = Math.max(0, shown - filled);
  const visible = bands.map(chips => {
    if (!chips.length) return 0;
    const n = Math.min(chips.length - 1, left);
    left -= n;
    return 1 + n;
  });
  return (
    <div ref={el => { ref(el); nav.ref.current = el; }} className="dash-role-bands dash-fit" onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
      {LEVELS.map((level, i) => <RoleBand key={level} title={titles[level]} chips={bands[i]} shown={visible[i]} />)}
    </div>
  );
}

/** Una riga della tabella: il ruolo e un pallino sotto ogni membro che lo copre. */
function RoleTableRow({ chip, members }: { chip: RoleChip; members: string[] }) {
  const { label, detail } = useRoleText(chip);
  return (
    // Col team ridotto la tabella dice già chi copre ogni ruolo (pallini sotto le sprite): niente tooltip, solo la riga che si accende
    <tr className={`dash-role-row ${stateOf(chip)}`}>
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
 * intestazioni tra le righe) e un pallino dove il membro lo copre; un essenziale o importante mancante è una riga rossa.
 * La tabella si stira fino in fondo alla card: con pochi ruoli le righe sono più alte.
 */
function RoleTable({ roles, titles }: { roles: DashboardData['roles']; titles: Record<(typeof LEVELS)[number], string> }) {
  const t = useT();
  const bands = LEVELS.map(level => missingFirst(roles.chips.filter(c => c.level === level)));
  return (
    <div className="dash-role-body dash-fit">
      {/* Righe alte al massimo come la riga piena (--rows, --seps in CSS): con tanto spazio la tabella resta in alto */}
      <table className="dash-role-grid" aria-label={t('area.roles')}
        style={{ '--rows': bands.reduce((n, band) => n + band.length, 0), '--seps': bands.filter(band => band.length > 0).length } as CSSProperties}>
        <thead>
          <tr>
            <td />
            {roles.members.map((member, i) => (
              <th key={`${member}-${i}`} scope="col" {...hint(member)}>
                <Sprite species={member} size={44} />
                <span className="visually-hidden">{member}</span>
              </th>
            ))}
          </tr>
        </thead>
        {LEVELS.map((level, i) => bands[i].length > 0 && (
          <tbody key={level}>
            <tr className="dash-role-sep"><th scope="rowgroup" colSpan={roles.members.length + 1}><span className="sum-sec-h">{titles[level]}</span></th></tr>
            {bands[i].map(chip => <RoleTableRow key={chip.need} chip={chip} members={roles.members} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * Altezza che la tabella dell'ampio chiede (px): testata con le sprite, una riga d'intestazione per fascia e una per ruolo
 * (come in CSS: 22px le intestazioni, 24px le righe), più la testata e i margini della card.
 */
export const roleTableNeed = (roles: DashboardData['roles']) => {
  const levels = LEVELS.filter(level => roles.chips.some(c => c.level === level)).length;
  return 52 + 22 * levels + 24 * roles.chips.length + 50;
};

/**
 * La testata dei Ruoli: "7/8" e i punti tolti scritti come punti ("−4 pt", "punti" per i lettori di schermo), così non si
 * leggono come un altro conteggio.
 */
function RolesHead({ roles }: { roles: DashboardData['roles'] }) {
  const t = useT();
  if (roles.count === undefined || !roles.points) return <b>{roles.count ?? roles.value}</b>;
  const pts = roles.points > 0 ? `+${roles.points}` : `−${-roles.points}`;
  return (
    <>
      <b>{roles.count}</b>{' '}
      <span className={`dash-pts${roles.points < 0 ? ' bad' : ''}`}>
        <b>{pts}</b><span aria-hidden="true"> {t('dash.pts')}</span><span className="visually-hidden"> {t('dash.ptsSr')}</span>
      </span>
    </>
  );
}

/**
 * Ruoli: chip in fasce nello stretto e nel normale, tabella ruoli × membri nell'ampio. Se nell'ampio la card è più bassa
 * di quanto la tabella chiede (schermi bassi col team ridotto, Minacce del meta sopra), si torna alle fasce, che sanno
 * stare nello spazio col loro "+N": mai righe tagliate.
 */
export function RolesSection({ roles: given, density, gentle = false, onView }: { roles: DashboardData['roles']; density: Density;
  /** Un membro solo: i ruoli mancanti tenui e tratteggiati, mai rossi (mancano per forza). */
  gentle?: boolean;
  onView: (v: AnalysisView) => void }) {
  const roles = gentle ? { ...given, chips: given.chips.map(chip => (chip.covered ? chip : { ...chip, soft: true })) } : given;
  const t = useT();
  const titles = { essential: t('analysis.essential'), important: t('analysis.important') };
  const card = useRef<HTMLDivElement>(null);
  // Altezza della card (0: non misurata, come nei test senza layout: la tabella)
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = card.current?.closest('.dash-roles');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => { if (el.clientHeight > 0) setHeight(el.clientHeight); };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const table = density === 'roomy' && (!height || height >= roleTableNeed(roles));
  return (
    <DashCard className="dash-roles" title={t('area.roles')} meta={<RolesHead roles={roles} />}
      onOpen={() => onView('roles')} openLabel={t('dash.openRoles')}>
      <span ref={card} hidden />
      {table ? <RoleTable roles={roles} titles={titles} /> : <RoleBands roles={roles} density={density} titles={titles} />}
    </DashCard>
  );
}
