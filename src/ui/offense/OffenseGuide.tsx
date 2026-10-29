import type { ReactNode } from 'react';
import type { TeamOffense } from '../../engine/offense';
import { COVERAGE_SHARE, OFFENSE_WEIGHTS, RANK_WEIGHTS, WALL_DEPTH } from '../../engine/offense';
import { COVERAGE_DEPTH } from '../../engine/coverage';
import { useLang, useT } from '../../i18n/react';
import { Rows } from '../guideParts';

export type OffenseSection = 'general' | 'coverageTypes' | 'power' | 'wallbreaking' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione nel team e profondità di Coverage e Wallbreaking: quelli del motore, in percentuale. */
const MEMBER_WEIGHTS = RANK_WEIGHTS.map(w => Math.round(100 * w));
const DEPTH = COVERAGE_DEPTH.map(w => Math.round(100 * w));
const WALL_WEIGHTS = WALL_DEPTH.map(w => Math.round(100 * w));

/** Una barra di pesi (come quella della Difesa): ogni posizione larga quanto pesa. */
function Bar({ label, weights, rank, from, to }: { label: string; weights: number[]; rank: (n: number) => string; from: string; to: string }) {
  return (
    <div className="guide-weights">
      <ol aria-label={label}>
        {weights.map((w, i) => <li key={i} style={{ flexGrow: w }}><span>{rank(i + 1)}</span><b>{w}%</b></li>)}
      </ol>
      <div className="guide-weights-axis" aria-hidden="true"><span>{from}</span><span>{to}</span></div>
    </div>
  );
}

/** Il contenuto della guida all'Offesa per una sezione: schematico e generico (niente valori del team). */
export function OffenseGuideSection({ section, offense, meta }: { section: OffenseSection; offense: TeamOffense; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(',', '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.off.${key}` as Key, params);
  const walls = offense.defenders.length;
  const targets = meta ? g('targets.meta', { n: offense.coverageMeta?.rows.length ?? 0 }) : g('targets.tier');
  const wallRule = g(offense.metaDefenders ? 'walls.meta' : 'walls.tier', { n: walls });
  const members = (
    <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
  );
  const pct = (n: number | string) => <span className="guide-pct">{n}%</span>;
  const lines = (items: ReactNode[]) => <ul className="guide-lines">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;

  if (section === 'general') {
    const own = Math.round(100 * (1 - COVERAGE_SHARE));
    const share = Math.round(100 * COVERAGE_SHARE);
    return (
      <>
        <h5>{g('what')}</h5>
        <Rows stacked rows={[
          [<>{t('detail.power')}<span className="guide-pct">{Math.round(100 * OFFENSE_WEIGHTS.power)}</span></>, g('what.power', { targets })],
          [<>{t('detail.wallbreaking')}<span className="guide-pct">{Math.round(100 * OFFENSE_WEIGHTS.wallbreaking)}</span></>, g('what.wall', { n: walls })],
          [<>{t('detail.coverageTypes')}{pct(meta ? dec(String(share / 2).replace('.', ',')) : share)}</>, g('what.types')],
          ...(meta ? [[<>{t('detail.coverageMeta')}{pct(dec(String(share / 2).replace('.', ',')))}</>, g('what.meta')] as [ReactNode, string]] : []),
        ]} />

        <h5>{g('test')}</h5>
        <Rows compact rows={[
          [g('test.damage'), g('test.damage.rule')],
          [g('test.targets'), targets],
          [g('test.walls'), wallRule],
        ]} />

        <h5>{g('toteam')}</h5>
        {lines([
          g('toteam.split', { own, share }),
          g('toteam.weights', { power: Math.round(100 * OFFENSE_WEIGHTS.power), wall: Math.round(100 * OFFENSE_WEIGHTS.wallbreaking) }),
        ])}
        <h6>{g('rank.weights')}</h6>
        {members}

        <h5>{g('rules')}</h5>
        {lines([
          g('rules.oneuse'), g('rules.setup'), g('rules.scale'), g('rules.attackers'),
          ...(meta ? [g('rules.split')] : []),
        ])}
      </>
    );
  }

  if (section === 'power') {
    return (
      <>
        <h5>{g('test')}</h5>
        <Rows compact rows={[
          [g('power.hit'), g('power.hit.rule', { targets })],
          [g('power.cap'), g('power.cap.rule')],
          [g('power.locked'), g('power.locked.rule')],
          [g('power.oneuse'), g('rules.oneuse')],
        ]} />

        <h5>{g('power.vote')}</h5>
        {lines([offense.referenceAttackers.length ? g('power.ref.meta', { list: offense.referenceAttackers.join(', ') }) : g('power.ref.fixed'), g('power.scale')])}

        <h5>{g('toteam')}</h5>
        {members}
      </>
    );
  }

  if (section === 'wallbreaking') {
    return (
      <>
        <h5>{g('test')}</h5>
        <Rows compact rows={[
          [g('test.walls'), wallRule],
          [g('wall.break'), g('wall.break.rule')],
        ]} />

        <h5>{g('wall.points')}</h5>
        <ul className="guide-holds three">
          <li><span className="ad-k ohko">OHKO</span><b>{dec('1,5')}</b><small>{g('wall.ohko')}</small></li>
          <li><span className="ad-k two">2HKO</span><b>1</b><small>{g('wall.two')}</small></li>
          <li><span className="ad-k three">3HKO</span><b>{dec('0,5')}</b><small>{g('wall.three')}</small></li>
        </ul>

        <h5>{g('wall.depth')}</h5>
        <Bar label={g('wall.depth')} weights={WALL_WEIGHTS} rank={n => g('wall.rank', { n })} from={g('wall.depth.one', { pct: WALL_WEIGHTS[0] })} to={g('wall.depth.all')} />
        {lines([g('wall.scale')])}

        <h5>{g('wall.setup')}</h5>
        {lines([
          offense.setters.length ? g('wall.setters', { list: offense.setters.map(s => `${s.species} (${s.move})`).join(', ') }) : t('detail.setup.none'),
          g('wall.legend'),
        ])}
      </>
    );
  }

  // Coverage di tipi e del meta: stesso test, cambiano i bersagli
  const isMeta = section === 'coverageMeta';
  const count = isMeta ? offense.coverageMeta?.rows.length ?? 0 : offense.coverageTypes.rows.length;
  return (
    <>
      <h5>{g('test')}</h5>
      <Rows compact rows={[
        [g('test.targets'), isMeta ? g('cov.targets.meta', { n: count }) : g('cov.targets.tier', { n: count })],
        [g('cov.hit'), g('cov.hit.rule')],
        [g('cov.half'), g('cov.half.rule')],
        [g('cov.hole'), g('cov.hole.rule')],
      ]} />

      <h5>{g('cov.depth')}</h5>
      <Bar label={g('cov.depth')} weights={DEPTH} rank={n => g('cov.rank', { n })} from={g('cov.depth.one', { pct: DEPTH[0] })} to={g('cov.depth.all')} />
      {lines([g('cov.scale'), meta ? g('cov.weight.meta') : g('cov.weight.tier')])}
    </>
  );
}
