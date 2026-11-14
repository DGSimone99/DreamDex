import type { TeamRating } from '../../engine/rating';
import { MISSING_BELOW } from '../../engine/needs';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS } from '../../engine/rolesArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { Icon } from '../icons';
import { holderReason, keyLabel, LevelTag, RoleMon } from './RoleParts';
import { roleLines, type RoleLine } from './rolesRows';

/** Oltre queste voci coperte la lista va su due colonne, oltre l'altra soglia su tre (mai scorrere la scheda). */
const ONE_COLUMN_MAX = 6;
const TWO_COLUMNS_MAX = 12;
/** Malus di una voce che manca in un team di 6: essenziale o importante. */
const missingPoints = (level: RoleLine['level']) => (level === 'essential' ? ESSENTIAL_POINTS : IMPORTANT_POINTS);

/**
 * La scheda Generale dei Ruoli, in una schermata: con che tipo di team si giudicano, quante voci sono coperte, malus e
 * bonus dei Ruoli, poi i ruoli che
 * mancano (essenziali in rosso, importanti in giallo), poi i ruoli che contano già coperti con chi li copre (icone, dal
 * migliore). Minori e voci che non contano stanno nei loro filtri.
 * `head` false: la testata (tipo di team e punti) sta fuori, sulla riga del filtro (Bonus/Malus → Ruoli).
 */
export function RolesGeneral({ rating, ctx, head = true }: { rating: TeamRating; ctx: AreaContext; head?: boolean }) {
  const t = useT();
  const { roles } = rating;
  const full = roles.members.length === 6;
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const lines = roleLines(rating).filter(l => l.level === 'essential' || l.level === 'important');
  const order = (a: RoleLine, b: RoleLine) => Number(b.level === 'essential') - Number(a.level === 'essential');
  const missing = lines.filter(l => l.missing).sort(order);
  const covered = lines.filter(l => !l.missing).sort(order);

  return (
    <div className="rl-frame rl-general">
      {head && <RolesHead rating={rating} />}
      <section className="rl-block" aria-label={t('rdetail.missingHead')}>
        <h4 className="rl-block-title">{t('rdetail.missingHead')}</h4>
        {missing.length === 0
          ? <p className="rl-allgood"><Icon name="check" />{t('rdetail.allCovered')}</p>
          : (
            <ul className="rl-missing">
              {missing.map(l => {
                const tone = l.level === 'essential' ? 'bad' : 'warn';
                return (
                  <li key={l.key} className={tone}>
                    <Icon name={tone === 'bad' ? 'close' : 'warning'} />
                    <span className="rl-name">{keyLabel(l.key, t)}</span>
                    <LevelTag level={l.level} t={t} />
                    {full && <b className="rl-malus" title={t('rdetail.missingTip', { n: missingPoints(l.level) })}>−{missingPoints(l.level)}</b>}
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      {covered.length > 0 && (
        <section className="rl-block rl-block-covered" aria-label={t('rdetail.coveredHead')}>
          <h4 className="rl-block-title">{t('rdetail.coveredHead')}</h4>
          <ul className={`rl-covered${covered.length > TWO_COLUMNS_MAX ? ' three' : covered.length > ONE_COLUMN_MAX ? ' two' : ''}`}>
            {covered.map(l => (
              <li key={l.key}>
                <span className="rl-name">{keyLabel(l.key, t)}<LevelTag level={l.level} t={t} /></span>
                <span className="rl-mons">
                  {l.by.map(h => <RoleMon key={h.slot} h={h} t={t} why={holderReason(l.key, h, roles, ctx.team, pool, t)} />)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** La testata dei Ruoli: con che tipo di team si giudicano e i punti dei Ruoli (coperti, malus e bonus). */
export function RolesHead({ rating }: { rating: TeamRating }) {
  const t = useT();
  const { roles, needs } = rating;
  const archetype = t(`archetype.${needs.archetype}`);
  const full = roles.members.length === 6;
  const malus = roles.failures.reduce((a, f) => a + f.points, 0);
  const bonus = roles.bonuses.reduce((a, f) => a + f.points, 0);
  const values = { essential: ESSENTIAL_POINTS, important: IMPORTANT_POINTS, minor: MINOR_POINTS };
  // Nel titolo la regola e poi le voci coi loro punti
  const malusTip = [
    t(!full ? 'rdetail.general.essentialIncomplete' : malus ? 'rdetail.general.malus' : 'rdetail.general.malusNone', values),
    ...roles.failures.map(f => `${f.text} (−${f.points})`),
  ].join('\n');
  const bonusTip = [
    t(bonus ? 'rdetail.general.bonus' : 'rdetail.general.bonusNone', values),
    ...roles.bonuses.map(f => `${f.text} (+${f.points})`),
  ].join('\n');

  return (
    <header className="rl-head">
      <p className="rl-judged" title={t(`archetype.${needs.archetype}.note`)}>
        {roles.members.length < 6 ? t('analysis.judgedIncomplete', { archetype }) : t('rdetail.judged', { archetype })}
      </p>
      <ul className="rl-score" aria-label={t('rdetail.score')}>
        <li title={t('rdetail.general.covered', { pct: Math.round(100 * MISSING_BELOW) })}>
          {t('rdetail.group.covered')} <b>{roles.covered}/{roles.total}</b>
        </li>
        <li title={malusTip}>Malus <b className={malus ? 'bad' : 'zero'}>{malus ? `−${malus}` : '0'}</b></li>
        <li title={bonusTip}>Bonus <b className={bonus ? 'good' : 'zero'}>{bonus ? `+${bonus}` : '0'}</b></li>
      </ul>
    </header>
  );
}
