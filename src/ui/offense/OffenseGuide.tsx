import type { ReactNode } from 'react';
import type { TeamOffense } from '../../engine/offense';
import { OFFENSE_SHARES, POWER_FULL, RANK_WEIGHTS, THREE_HIT } from '../../engine/offense';
import { COVERAGE_DEPTH } from '../../engine/coverage';
import { useLang, useT } from '../../i18n/react';
import { Rows } from '../guideParts';

export type OffenseSection = 'general' | 'coverageTypes' | 'power' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione nel team e profondità della Coverage: quelli del motore, in percentuale. */
const MEMBER_WEIGHTS = RANK_WEIGHTS.map(w => Math.round(100 * w));
const DEPTH = COVERAGE_DEPTH.map(w => Math.round(100 * w));

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
  const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', lang === 'it' ? ',' : '.');
  const pctOf = (x: number) => Math.round(100 * x);
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.off.${key}` as Key, params);
  // La Potenza si misura sempre sui 18 Pokémon medi, con e senza meta
  const targets = g('targets.tier');
  const members = (
    <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
  );
  const pct = (n: number | string) => <span className="guide-pct">{n}%</span>;
  const lines = (items: ReactNode[]) => <ul className="guide-lines">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;

  if (section === 'general') {
    const power = pctOf(OFFENSE_SHARES.power);
    const share = pctOf(OFFENSE_SHARES.coverage);
    const coverageShare = meta ? share / 2 : share;
    return (
      <>
        <h5>{g('what')}</h5>
        <Rows stacked rows={[
          [<>{t('detail.power')}{pct(power)}</>, g('what.power', { targets })],
          [<>{t('detail.coverageTypes')}{pct(num(coverageShare))}</>, g('what.types')],
          ...(meta ? [[<>{t('detail.coverageMeta')}{pct(num(coverageShare))}</>, g('what.meta')] as [ReactNode, string]] : []),
        ]} />

        <h5>{g('test')}</h5>
        <Rows compact rows={[
          [g('test.damage'), g('test.damage.rule')],
          [g('test.targets'), targets],
          ...(meta ? [[g('test.meta'), g('targets.meta', { n: offense.coverageMeta?.rows.length ?? 0 })] as [ReactNode, string]] : []),
        ]} />

        <h5>{g('toteam')}</h5>
        {lines([g('toteam.split', { power, share })])}
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
          [g('power.setup'), g('rules.setup')],
          [g('power.oneuse'), g('rules.oneuse')],
        ]} />

        <h5>{g('power.vote')}</h5>
        {lines([offense.referenceAttackers.length ? g('power.ref.meta', { list: offense.referenceAttackers.join(', ') }) : g('power.ref.fixed', { pct: pctOf(POWER_FULL) }), g('power.scale')])}

        <h5>{g('toteam')}</h5>
        {members}
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
        [g('cov.hit'), isMeta ? g('cov.hit.rule.meta') : g('cov.hit.rule')],
        [g('cov.half'), isMeta ? g('cov.half.rule.meta') : g('cov.half.rule')],
        [g('cov.hole'), isMeta ? g('cov.hole.rule.meta') : g('cov.hole.rule', { pct: pctOf(THREE_HIT) })],
      ]} />

      <h5>{g('cov.depth')}</h5>
      <Bar label={g('cov.depth')} weights={DEPTH} rank={n => g('cov.rank', { n })} from={g('cov.depth.one', { pct: DEPTH[0] })} to={g('cov.depth.all')} />
      {lines([g('cov.scale'), meta ? g('cov.weight.meta', { pct: pctOf(OFFENSE_SHARES.coverage / 2), total: pctOf(OFFENSE_SHARES.coverage) }) : g('cov.weight.tier', { pct: pctOf(OFFENSE_SHARES.coverage) })])}
    </>
  );
}
