import type { ReactNode } from 'react';
import { CONDITION_QUOTA, PARADOX_SPEED, SPEED_FULL, SPEED_RANK_WEIGHTS, type TeamSpeed } from '../../engine/speedArea';
import { SPEED_ITEM_ONLY, SPEED_ITEM_SPLIT, SPEED_POOL } from '../../engine/speed';
import { useLang, useT } from '../../i18n/react';
import { Rows } from '../guideParts';

type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione di velocità, in percentuale (sommano 100). */
const MEMBER_WEIGHTS = SPEED_RANK_WEIGHTS;

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

/** La guida della Velocità (una sezione): i rivali, cosa conta per ogni membro e con quale quota, i pesi, il modale. */
export function SpeedGuideSection({ speed, meta }: { speed: TeamSpeed; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  const num = (n: number) => (Number.isInteger(n) ? String(n) : String(n)).replace('.', lang === 'it' ? ',' : '.');
  const pctOf = (x: number) => Math.round(100 * x);
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.speed.${key}` as Key, params);
  const pct = (n: number | string) => <span className="guide-pct">{n}%</span>;
  const lines = (items: ReactNode[]) => <ul className="guide-lines">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  const half = pctOf(CONDITION_QUOTA.setup);
  const quarter = pctOf(CONDITION_QUOTA.tailwind);
  const rivals = meta
    ? g('rivals.meta', { n: SPEED_POOL, split: pctOf(SPEED_ITEM_SPLIT), only: pctOf(SPEED_ITEM_ONLY) })
    : g('rivals.tier');
  void speed;

  return (
    <>
      <h5>{g('what')}</h5>
      {lines([g('what.rule'), rivals, g('what.tie')])}

      <h5>{g('gains')}</h5>
      <Rows compact rows={[
        [<>{g('gains.own')}{pct(half)}</>, g('gains.own.rule', { x: num(PARADOX_SPEED) })],
        [<>{g('gains.priority')}{pct(half)}</>, g('gains.priority.rule')],
        [<>{g('gains.control')}{pct(half)}</>, g('gains.control.rule')],
        [<>{g('gains.short')}{pct(quarter)}</>, g('gains.short.rule')],
        [g('gains.room'), g('gains.room.rule')],
      ]} />

      <h5>{g('toteam')}</h5>
      <h6>{g('rank.weights')}</h6>
      <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
      {lines([g('scale', { pct: pctOf(SPEED_FULL) })])}

      <h5>{g('dialog')}</h5>
      {lines([g('dialog.rule'), g('dialog.versions'), g('dialog.grade')])}
    </>
  );
}
