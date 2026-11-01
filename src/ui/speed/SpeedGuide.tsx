import { CONDITION_QUOTA, SPEED_FULL, SPEED_RANK_WEIGHTS, type TeamSpeed } from '../../engine/speedArea';
import { SPEED_ITEM_ONLY, SPEED_ITEM_SPLIT, SPEED_POOL } from '../../engine/speed';
import { useT } from '../../i18n/react';

type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione di velocità, in percentuale (sommano 100). */
const MEMBER_WEIGHTS = SPEED_RANK_WEIGHTS;

/** Le quattro fonti di velocità in più, ognuna con la sua quota (quella del motore, CONDITION_QUOTA). */
const GAINS = [
  { key: 'own', quota: CONDITION_QUOTA.setup },
  { key: 'priority', quota: CONDITION_QUOTA.setup },
  { key: 'control', quota: CONDITION_QUOTA.setup },
  { key: 'short', quota: CONDITION_QUOTA.tailwind },
] as const;

/** Una barra di pesi (come quella dell'Offesa): ogni posizione larga quanto pesa. */
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

/** La guida della Velocità (una sezione, schematica): i rivali, le quattro fonti in tessere con la quota, i pesi, la finestra. */
export function SpeedGuideSection({ speed, meta }: { speed: TeamSpeed; meta: boolean }) {
  const t = useT();
  const pctOf = (x: number) => Math.round(100 * x);
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.speed.${key}` as Key, params);
  const rivals = meta
    ? g('rivals.meta', { n: SPEED_POOL, split: pctOf(SPEED_ITEM_SPLIT), only: pctOf(SPEED_ITEM_ONLY) })
    : g('rivals.tier');
  void speed;

  return (
    <>
      <h5>{g('what')}</h5>
      <ul className="guide-lines">
        <li>{g('what.rule')}</li>
        <li>{rivals}</li>
      </ul>

      <h5>{g('gains')}</h5>
      <ul className="guide-tiles">
        {GAINS.map(gain => (
          <li key={gain.key}>
            <span className="guide-tile-head">
              <b>{g(`gains.${gain.key}`)}</b>
              <span className={`guide-pct${gain.quota < CONDITION_QUOTA.setup ? ' low' : ''}`}>{pctOf(gain.quota)}%</span>
            </span>
            <small>{g(`gains.${gain.key}.rule`)}</small>
          </li>
        ))}
      </ul>
      <p className="guide-foot">{g('gains.foot')}</p>

      <h5>{g('toteam')}</h5>
      <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
      <p className="guide-foot guide-scale">{g('scale', { pct: pctOf(SPEED_FULL) })}</p>

      <h5>{g('dialog')}</h5>
      <ul className="guide-lines">
        <li>{g('dialog.rule')}</li>
      </ul>
    </>
  );
}
