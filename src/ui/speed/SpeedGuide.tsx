import { useId, useRef, useState, type ReactNode } from 'react';
import { dex, getMove } from '../../engine/dex';
import {
  CONDITION_QUOTA, PARADOX_SPEED, PARALYSIS, PRIORITY_FULL, SETUP_PLUS_ONE, SETUP_PLUS_TWO, SPEED_DROP, SPEED_FULL,
  SPEED_RANK_WEIGHTS, WEATHER_SPEED, type TeamSpeed,
} from '../../engine/speedArea';
import { SPEED_POOL } from '../../engine/speed';
import { useLang, useT } from '../../i18n/react';
import { Icon } from '../icons';

type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione di velocità, in percentuale (sommano 100). */
const MEMBER_WEIGHTS = SPEED_RANK_WEIGHTS;

/** Le tre fonti di velocità in più, ognuna con la sua quota (quella del motore, CONDITION_QUOTA). */
const GAINS = [
  { key: 'boost', quota: CONDITION_QUOTA.setup },
  { key: 'priority', quota: CONDITION_QUOTA.priority },
  { key: 'control', quota: CONDITION_QUOTA.web },
] as const;
type GainKey = typeof GAINS[number]['key'];

/** Esempi di mosse prioritarie (il motore non ha una lista: conta ogni mossa d'attacco con priorità). */
const PRIORITY_EXAMPLES = ['extremespeed', 'suckerpunch', 'aquajet', 'bulletpunch', 'iceshard', 'shadowsneak', 'machpunch', 'jetpunch'];

const moveNames = (ids: Iterable<string>) => [...ids].map(id => getMove(id)?.name ?? id).join(', ');
const abilityName = (id: string) => dex.abilities.get(id).name;

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

/** Una riga del dettaglio: cosa conta, quanto vale, e la lista o la regola. */
interface Row { label: string; value?: string; text: ReactNode }

/**
 * La guida della Velocità (una sezione, schematica): i rivali, le tre fonti in tessere con la quota, i pesi.
 * Ogni tessera si apre (una alla volta) e mostra tutto quello che conta in quella fonte, preso dalle tabelle del motore.
 */
export function SpeedGuideSection({ speed, meta }: { speed: TeamSpeed; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [open, setOpen] = useState<GainKey | null>(null);
  const tiles = useRef<Partial<Record<GainKey, HTMLButtonElement | null>>>({});
  const pctOf = (x: number) => Math.round(100 * x);
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.speed.${key}` as Key, params);
  const times = (x: number) => `×${String(x).replace('.', lang === 'it' ? ',' : '.')}`;
  const rivals = meta ? g('rivals.meta', { n: SPEED_POOL }) : g('rivals.tier');
  void speed;

  const close = () => { const was = open; setOpen(null); if (was) tiles.current[was]?.focus(); };

  const weather = Object.entries(WEATHER_SPEED).map(([ability, need]) =>
    `${abilityName(ability)} (${need.weather ? t(`conditionName.${need.weather}` as Key).toLowerCase() : t(`conditionName.${need.terrain}terrain` as Key)})`).join(', ');
  const details: Record<GainKey, { rows: (Row | string)[]; foot: string }> = {
    boost: {
      rows: [
        { label: g('d.boost.plus1'), value: times(1.5), text: `${moveNames(SETUP_PLUS_ONE)}, ${abilityName('speedboost')}` },
        { label: g('d.boost.plus2'), value: times(2), text: moveNames(SETUP_PLUS_TWO) },
        { label: g('d.boost.weather'), value: times(2), text: weather },
        { label: g('d.boost.paradox'), value: times(PARADOX_SPEED), text: g('d.boost.paradox.rule') },
        { label: abilityName('unburden'), value: times(2), text: g('d.boost.unburden.rule') },
      ],
      foot: g('d.quota', { pct: pctOf(CONDITION_QUOTA.setup) }),
    },
    priority: {
      rows: [
        { label: g('d.prio.how'), text: g('d.prio.how.rule', { pct: pctOf(PRIORITY_FULL) }) },
        { label: g('d.prio.moves'), text: g('d.prio.moves.rule', { list: moveNames(PRIORITY_EXAMPLES), glide: getMove('grassyglide')?.name ?? 'Grassy Glide' }) },
        { label: g('d.prio.field'), text: g('d.prio.field.rule') },
      ],
      foot: g('d.quota', { pct: pctOf(CONDITION_QUOTA.priority) }),
    },
    control: {
      rows: [
        g('d.ctrl.long', { pct: pctOf(CONDITION_QUOTA.web) }),
        { label: getMove('stickyweb')?.name ?? 'Sticky Web', value: '−1', text: g('d.ctrl.web.rule') },
        { label: getMove('trickroom')?.name ?? 'Trick Room', text: g('d.ctrl.room.rule') },
        g('d.ctrl.short', { pct: pctOf(CONDITION_QUOTA.tailwind) }),
        { label: getMove('tailwind')?.name ?? 'Tailwind', value: times(2), text: g('d.ctrl.tail.rule') },
        { label: g('d.ctrl.para'), value: '×½', text: g('d.ctrl.para.rule', { list: moveNames(PARALYSIS) }) },
        { label: g('d.ctrl.drop'), value: '×⅔', text: g('d.ctrl.drop.rule', { list: moveNames(SPEED_DROP) }) },
      ],
      foot: g('d.ctrl.foot'),
    },
  };
  const detail = open ? details[open] : null;
  const openGain = GAINS.find(x => x.key === open);

  return (
    <>
      <h5>{g('what')}</h5>
      <ul className="guide-lines">
        <li>{g('what.rule')}</li>
        <li>{rivals}</li>
      </ul>

      <h5>{g('gains')}</h5>
      <ul className={`guide-tiles sp-guide-tiles${open ? ' compact' : ''}`}>
        {GAINS.map(gain => (
          <li key={gain.key} className={open === gain.key ? 'on' : undefined}>
            <button type="button" ref={el => { tiles.current[gain.key] = el; }} aria-expanded={open === gain.key} aria-controls={open === gain.key ? `${id}-detail` : undefined}
              onClick={() => setOpen(o => (o === gain.key ? null : gain.key))}>
              <span className="guide-tile-head">
                <b>{g(`gains.${gain.key}`)}</b>
                <span className="guide-pct">{pctOf(gain.quota)}%</span>
              </span>
              {!open && <small>{g(`gains.${gain.key}.rule`)}</small>}
              {!open && gain.key === 'control' && (
                <span className="sp-guide-sub">
                  <small>{g('gains.control.short')}</small>
                  <span className="guide-pct low">{pctOf(CONDITION_QUOTA.tailwind)}%</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {detail && openGain && (
        <section id={`${id}-detail`} className="sp-gd" aria-label={g(`gains.${openGain.key}`)}>
          <div className="sp-gd-rows">
            {detail.rows.map((row, i) => (typeof row === 'string'
              ? <p key={i} className="sp-gd-group">{row}</p>
              : (
                <div key={i} className="sp-gd-row">
                  <b>{row.label}</b>
                  <span className="sp-gd-val">{row.value}</span>
                  <span className="sp-gd-text">{row.text}</span>
                </div>
              )))}
          </div>
          <p className="sp-gd-foot">{detail.foot}</p>
          <button type="button" className="help-close sp-gd-close" aria-label={t('help.close')} title={t('help.close')} onClick={close}><Icon name="close" /></button>
        </section>
      )}
      {!open && <p className="guide-foot">{g('gains.foot')}</p>}

      <h5>{g('toteam')}</h5>
      <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
      <p className="guide-foot guide-scale">{g('scale', { pct: pctOf(SPEED_FULL) })}</p>
    </>
  );
}
