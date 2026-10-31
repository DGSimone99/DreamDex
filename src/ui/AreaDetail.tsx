import type { ReactElement, ReactNode } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { TeamSet } from '../engine/sets';
import { MAX_BONUS, MAX_PENALTY, bonusMalusCatalog, type CatalogEntry, type TeamRating } from '../engine/rating';
import { ESSENTIAL_POINTS, type TeamRoles } from '../engine/rolesArea';
import { MISSING_BELOW } from '../engine/needs';
import type { Level, LevelKey } from '../engine/roleLevels';
import { FAMILIES, secondaryRoles, type Family, type SubRole, type SubRoleReason } from '../engine/subRoles';
import { useT } from '../i18n/react';
import type { Lang } from '../i18n';
import { Sprite } from './Sprite';
import { defenseTabs } from './defense/defenseTabs';
import { offenseTabs } from './offense/offenseTabs';
import { speedTabs } from './speed/speedTabs';

/** Una scheda del dettaglio: etichetta, valore e contenuto. */
export type T = ReturnType<typeof useT>;

export interface DetailTab { key: string; label: string; value: number | string | null; panel: ReactElement; help?: ReactNode }

/** Il contesto dell'area oltre al voto: il team e la sua analisi (lo ricevono la Difesa e l'Offesa). */
export interface AreaContext { team: TeamSet[]; analysis: TeamAnalysis; open?: (key: string) => void;
  /** Squadra chiusa: più spazio, la scheda Generale della Difesa mostra più colonne. */
  roomy?: boolean }

/**
 * Dettaglio di un'area (Offesa o Difesa): una scheda generale e una per sottostatistica, ognuna con come si calcola
 * e il valore di ogni membro. Stesso guscio del modale "Come funziona il voto", con le schede a sinistra.
 */
export type DetailArea = 'strength' | 'defense' | 'speed' | 'roles' | 'bonusMalus';
/** Le aree del voto che hanno una scheda in Analisi (lo stesso insieme di DetailArea). */
export type AreaKey = DetailArea;

/** Punti col segno tipografico (meno vero, non il trattino). */
export const signed = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

/** Le schede di un'area (sottostatistiche col loro valore e contenuto): le usano la finestra e la vista in Analisi. */
export function areaTabs(rating: TeamRating, area: AreaKey, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  if (area === 'bonusMalus') return catalogueTabs(rating, t, lang);
  const value = rating.areas.find(a => a.key === area)?.value ?? null;
  return area === 'strength' ? offenseTabs(rating, t, ctx)
    : area === 'defense' ? defenseTabs(rating.defense, !!rating.meta, t, ctx)
    : area === 'roles' ? rolesTabs(rating, value, t)
    : speedTabs(rating.speed, !!rating.meta, t, ctx);
}

/** Il valore di un'area per la testa: il netto per Bonus/Malus, altrimenti il valore dell'area. */
export const areaValue = (rating: TeamRating, area: AreaKey): number | string | null =>
  (area === 'bonusMalus' ? signed(rating.bonus.total - rating.penalty.total) : rating.areas.find(a => a.key === area)?.value ?? null);

/** Catalogo di bonus e malus: due schede, ogni voce con quando scatta e quanto vale; quelle attive ora sono evidenziate. */
function catalogueTabs(rating: TeamRating, t: T, lang: Lang): DetailTab[] {
  const catalog = bonusMalusCatalog(lang, rating.teraCap);
  const panelOf = (kind: CatalogEntry['kind']) => {
    const items = kind === 'malus' ? rating.penalty.items : rating.bonus.items;
    // Punti attuali di una voce del catalogo: somma delle voci del voto con la sua chiave
    const nowOf = (entry: CatalogEntry) => items.filter(i => i.catalog === entry.key).reduce((n, i) => n + i.points, 0);
    const cap = kind === 'malus' ? MAX_PENALTY : MAX_BONUS;
    const capText = signed(kind === 'malus' ? -cap : cap);
    // Somma grezza delle voci attive: se supera il tetto, il totale mostrato è limitato
    const raw = items.reduce((n, i) => n + i.points, 0);
    return (
      <>
        <h4>{t(`catalogue.${kind}`)}{raw > cap && <small className="ad-limited"> {t('catalogue.limited', { cap: capText })}</small>}</h4>
        <div className="ad-scroll">
          <table className="ad-t ad-catalog">
            <thead>
              <tr>
                <th scope="col" className="left">{t('catalogue.col.name')}</th>
                <th scope="col" className="left">{t('catalogue.col.when')}</th>
                <th scope="col" className="left">{t('catalogue.col.points')}</th>
                <th scope="col">{t('catalogue.col.now')}</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filter(e => e.kind === kind).map(entry => {
                const now = entry.applies ? nowOf(entry) : 0;
                const active = now > 0;
                return (
                  <tr key={entry.key} className={active ? 'active' : entry.applies ? undefined : 'na'} aria-current={active ? 'true' : undefined}>
                    <th scope="row" className="left">
                      {entry.name}
                      {!entry.applies && <small className="ad-src" title={t('catalogue.naTip')}> {t('catalogue.na')}</small>}
                    </th>
                    <td className="left">{entry.when}</td>
                    <td className="left">{entry.points}</td>
                    <td className="total">{active ? (kind === 'malus' ? `−${now}` : `+${now}`) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ad-cap">{t(kind === 'malus' ? 'catalogue.capMalus' : 'catalogue.capBonus', { max: capText })}</p>
      </>
    );
  };
  return [
    { key: 'malus', label: t('catalogue.malus'), value: signed(-rating.penalty.total), panel: panelOf('malus') },
    { key: 'bonus', label: t('catalogue.bonus'), value: signed(rating.bonus.total), panel: panelOf('bonus') },
  ];
}

const points = (x: number) => Math.round(100 * x);
const ROLE_LEVELS_SHOWN = ['essential', 'important', 'minor'] as const;
const FAMILY_TABS: Family[] = ['attack', 'defense', 'field', 'disruption'];
const thousands = (n: number) => `${Math.round(n / 1000)}k`;

/** Il motivo di un sotto-ruolo in parole: quota del gruppo per Taunt, Encore e stati, indice per i muri, colpo per l'Attacco. */
function reasonText(r: SubRoleReason, pool: string, t: T): string {
  const pct = Math.round(100 * (r.share ?? 0));
  if (r.role === 'taunt' || r.role === 'encore') return t(r.prankster ? 'rdetail.reason.prankster' : 'rdetail.reason.outspeed', { move: r.source, pct, pool });
  if ((r.role === 'dot' || r.role === 'debuff') && r.share !== undefined) return t('rdetail.reason.status', { move: r.source, pct, pool });
  if ((r.role === 'physicalWall' || r.role === 'specialWall') && r.index !== undefined) {
    return t(r.role === 'physicalWall' ? 'rdetail.reason.wall.physical' : 'rdetail.reason.wall.special', { index: thousands(r.index), threshold: thousands(r.threshold ?? 0) });
  }
  if (FAMILIES.attack.includes(r.role)) return t('rdetail.reason.attack', { move: r.source });
  // 'set': fonte generica del solo set, senza una mossa da nominare
  return r.source === 'set' || r.source === 'wall' ? '—' : r.source;
}

/** Le schede dei Ruoli: Generale (livelli, base, extra, mancanze) e una per famiglia coi sotto-ruoli di ogni membro. */
function rolesTabs(rating: TeamRating, value: number | null, t: T): DetailTab[] {
  const roles: TeamRoles = rating.roles;
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const archetype = t(`archetype.${rating.teamType}`);
  const full = roles.members.length === 6;
  const levelOf = (key: LevelKey): Level => roles.rows.find(r => r.key === key)?.level ?? 'ignored';
  const keyLabel = (key: LevelKey) => (key === 'attacker' || key === 'fieldSetup' ? t(`need.${key}`) : t(`role.${key}`));
  const malus = roles.failures.reduce((a, f) => a + f.points, 0);
  const base = points(roles.base);
  const extra = points(roles.extra);
  const hasImportant = roles.rows.some(r => r.level === 'important');
  const essentialTip = !full ? t('rdetail.general.essentialIncomplete')
    : malus ? t('rdetail.general.essentialMissing') : t('rdetail.general.essentialOk');
  // Fonte e valore di chi porta la voce: le fonti generiche (set, muro: l'indice è nella scheda Difesa) non si mostrano,
  // il valore solo se non pieno
  // il valore solo se non pieno; il secondario (famiglia non principale) col suo segno
  const byNote = (source: string, v: number, secondary?: boolean) =>
    [secondary && t('rdetail.secondary'), source !== 'set' && source !== 'wall' && source, v < 1 && points(v)].filter(Boolean).join(' · ');

  const general = (
    <>
      <h4>{t('rdetail.title')}</h4>
      <p>{t('rdetail.lead', { archetype })}</p>
      <dl className="ad-subs">
        <div className="ad-sub">
          <dt>{t('rdetail.important')}</dt>
          <dd>
            <meter min={0} max={100} value={base} aria-hidden="true" />
            <strong>{base}</strong>
            <span>{t(hasImportant ? 'rdetail.general.important' : 'rdetail.general.importantNone')}</span>
          </dd>
        </div>
        {/* Minori ed essenziali non sono 0–100: un plus e un malus in punti, senza barra */}
        <div className="ad-sub">
          <dt>{t('rdetail.minor')}</dt>
          <dd>
            <strong className="ad-plus">+{extra}</strong>
            <span>{t('rdetail.general.minor')}</span>
          </dd>
        </div>
        <div className="ad-sub">
          <dt>{t('rdetail.essential')}</dt>
          <dd>
            <strong className={malus ? 'ad-minus' : 'ad-zero'}>{malus ? `−${malus}` : '0'}</strong>
            <span>{essentialTip}</span>
          </dd>
        </div>
      </dl>
      {roles.failures.length > 0 && (
        <ul className="ad-failures">
          {roles.failures.map(f => <li key={f.text}>{f.text} (−{f.points})</li>)}
        </ul>
      )}
      <div className="ad-scroll">
        <table className="ad-t ad-roles">
          <thead>
            <tr>
              <th scope="col">{t('rdetail.role')}</th>
              <th scope="col">{t('rdetail.value')}</th>
              <th scope="col" className="left gap">{t('rdetail.by')}</th>
            </tr>
          </thead>
          {ROLE_LEVELS_SHOWN.map(level => {
            const rows = roles.rows.filter(r => r.level === level);
            if (!rows.length) return null;
            return (
              <tbody key={level}>
                <tr className="ad-group"><th scope="rowgroup" colSpan={3}>{t(`rdetail.group.${level}`)}</th></tr>
                {rows.map(row => {
                  // Essenziale che manca in un team di 6: al posto del valore il suo malus
                  const missing = full && level === 'essential' && row.value < MISSING_BELOW;
                  return (
                    <tr key={row.key}>
                      <th scope="row">{keyLabel(row.key)}</th>
                      <td className="total">
                        {missing ? <span className="ad-minus" title={t('rdetail.missingTip', { n: ESSENTIAL_POINTS })}>−{ESSENTIAL_POINTS}</span> : points(row.value)}
                      </td>
                      <td className="left gap ad-by">
                        {row.by.length
                          ? row.by.map((b, i) => {
                            const note = byNote(b.source, b.value, b.secondary);
                            return (
                              <span key={`${b.species}-${i}`} className="ad-mon">
                                <Sprite species={b.species} size={28} />{b.species}
                                {note && <small className="ad-src"> ({note})</small>}
                              </span>
                            );
                          })
                          : <span className="ad-k none">{t('rdetail.nobody')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </>
  );

  const familyTab = (family: Family): DetailTab => {
    const subs: SubRole[] = FAMILIES[family];
    // Valore col credito del secondario (come i valori di team), e il segno per chi lo porta da secondario
    const holdersOf = (role: SubRole) => roles.members
      .map(m => ({
        species: m.species, value: (m.credited ?? m.values)[role] ?? 0, reason: m.reasons.find(r => r.role === role),
        secondary: !!m.values[role] && secondaryRoles(m.primary).includes(role),
      }))
      // Anche un secondario che nell'archetipo vale 0 (stall) resta in tabella, col segno
      .filter(h => h.value > 0 || h.secondary)
      .sort((a, b) => b.value - a.value);
    // Coperto con la stessa soglia di carte, Analisi e bisogni (MISSING_BELOW); la tabella mostra anche i valori parziali
    const covered = subs.filter(role => (holdersOf(role)[0]?.value ?? 0) >= MISSING_BELOW).length;
    const panel = (
      <>
        <h4>{t(`family.${family}`)}</h4>
        <div className="ad-how">
          <p>{t(`rdetail.how.${family}`, { pool })}</p>
          <p>{t('rdetail.how.levels', { archetype })}</p>
        </div>
        <div className="ad-scroll">
          <table className="ad-t ad-roles">
            <thead>
              <tr>
                <th scope="col">{t('detail.member')}</th>
                <th scope="col" className="left gap">{t('rdetail.reason')}</th>
                <th scope="col">{t('rdetail.value')}</th>
              </tr>
            </thead>
            {subs.map(role => {
              const level = levelOf(role);
              const holders = holdersOf(role);
              return (
                <tbody key={role} className={level === 'ignored' ? 'ad-ignored' : undefined}>
                  <tr className="ad-group">
                    <th scope="rowgroup" colSpan={3}>
                      {t(`role.${role}`)}
                      <span className={`ad-level ${level}`}> {t(`rdetail.level.${level}`)} · {t('rdetail.teamValue', { n: points(holders[0]?.value ?? 0) })}</span>
                    </th>
                  </tr>
                  {holders.length ? holders.map((h, i) => (
                    <tr key={`${h.species}-${i}`}>
                      <th scope="row">
                        <span className="ad-mon"><Sprite species={h.species} size={32} />{h.species}</span>
                        {h.secondary && <small className="ad-src"> ({t('rdetail.secondary')})</small>}
                      </th>
                      <td className="left gap ad-reason">{h.reason ? reasonText(h.reason, pool, t) : '—'}</td>
                      <td className="total">{points(h.value)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="left"><span className="ad-k none">{t('rdetail.nobody')}</span></td></tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </>
    );
    return { key: family, label: t(`family.${family}`), value: `${covered}/${subs.length}`, panel };
  };

  return [
    { key: 'general', label: t('detail.tab.general'), value, panel: general },
    ...FAMILY_TABS.map(familyTab),
  ];
}
