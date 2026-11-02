import type { TeamRating } from '../../engine/rating';
import { ESSENTIAL_POINTS } from '../../engine/rolesArea';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { Icon } from '../icons';
import { holderReason, keyLabel, LevelTag, RoleMon } from './RoleParts';
import { points, roleLines, type RoleLine } from './rolesRows';

/** Oltre queste voci coperte la lista va su due colonne, oltre l'altra soglia su tre (mai scorrere la scheda). */
const ONE_COLUMN_MAX = 6;
const TWO_COLUMNS_MAX = 12;

/**
 * La scheda Generale dei Ruoli, in una schermata: con che tipo di team si giudicano e i punti dell'area, poi i ruoli che
 * mancano (essenziali in rosso, importanti in giallo), poi i ruoli che contano già coperti con chi li copre (icone, dal
 * migliore). Minori e voci che non contano stanno nelle loro sottoschede.
 */
export function RolesGeneral({ rating, ctx }: { rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const { roles, needs } = rating;
  const archetype = t(`archetype.${needs.archetype}`);
  const full = roles.members.length === 6;
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const lines = roleLines(rating).filter(l => l.level === 'essential' || l.level === 'important');
  const order = (a: RoleLine, b: RoleLine) => Number(b.level === 'essential') - Number(a.level === 'essential');
  const missing = lines.filter(l => l.missing).sort(order);
  const covered = lines.filter(l => !l.missing).sort(order);
  const malus = roles.failures.reduce((a, f) => a + f.points, 0);
  const hasImportant = lines.some(l => l.level === 'important');
  const essentialTip = [
    t(!full ? 'rdetail.general.essentialIncomplete' : malus ? 'rdetail.general.essentialMissing' : 'rdetail.general.essentialOk'),
    ...roles.failures.map(f => `${f.text} (−${f.points})`),
  ].join('\n');

  return (
    <div className="rl-frame rl-general">
      <header className="rl-head">
        <p className="rl-judged" title={t(`archetype.${needs.archetype}.note`)}>
          {roles.members.length < 6 ? t('analysis.judgedIncomplete', { archetype }) : t('rdetail.judged', { archetype })}
        </p>
        <ul className="rl-score" aria-label={t('rdetail.score')}>
          <li title={t(hasImportant ? 'rdetail.general.important' : 'rdetail.general.importantNone')}>
            {t('rdetail.group.important')} <b>{points(roles.base)}</b>
          </li>
          <li title={t('rdetail.general.minor')}>{t('rdetail.group.minor')} <b className="good">+{points(roles.extra)}</b></li>
          <li title={essentialTip}>
            {t('rdetail.group.essential')} <b className={malus ? 'bad' : 'zero'}>{malus ? `−${malus}` : '0'}</b>
          </li>
        </ul>
      </header>

      <section className="rl-block" aria-label={t('rdetail.missingHead')}>
        <h5>{t('rdetail.missingHead')}</h5>
        {missing.length === 0 && !needs.needStyle
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
                    {full && l.level === 'essential' && <b className="rl-malus" title={t('rdetail.missingTip', { n: ESSENTIAL_POINTS })}>−{ESSENTIAL_POINTS}</b>}
                  </li>
                );
              })}
              {needs.needStyle && (
                <li className="bad">
                  <Icon name="close" />
                  <span className="rl-name">{t('analysis.unbalanced', { style: t(`analysis.style.${needs.needStyle}`) })}</span>
                </li>
              )}
            </ul>
          )}
      </section>

      {covered.length > 0 && (
        <section className="rl-block rl-block-covered" aria-label={t('rdetail.coveredHead')}>
          <h5>{t('rdetail.coveredHead')}</h5>
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
