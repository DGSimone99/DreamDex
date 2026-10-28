import type { ReactNode } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { RANK_WEIGHTS } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';

type Section = 'general' | 'robustness' | 'sustain' | 'coverageTypes' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** La scala della Sicurezza di un tipo: ogni punto di saldo vale 25%; le targhette hanno i colori della riga Sicurezza. */
const SCALE = [
  { balance: '−2', pct: 0, tag: 'serious', tone: 'bad' }, { balance: '−1', pct: 25, tag: 'minor', tone: 'bad' },
  { balance: '0', pct: 50, tag: 'even', tone: 'warn' }, { balance: '+1', pct: 75, tag: 'ok', tone: 'warn' },
  { balance: '+2', pct: 100, tag: 'safe', tone: 'good' },
] as const;

/** Punti di ogni soglia del colpo standard, dalla peggiore. */
const HOLD_POINTS = [
  { cls: 'hold-ohko', tag: 'OHKO', points: '0', note: 'rob.ohko' }, { cls: 'hold-2', tag: '2HKO', points: '0,5', note: 'rob.two' },
  { cls: 'hold-3', tag: '3HKO', points: '1', note: 'rob.three' }, { cls: 'hold-4', tag: '4HKO+', points: '1,5', note: 'rob.four' },
] as const;

/** Pesi dei membri nel valore di un lato, dal più robusto: quelli del motore, in percentuale. */
const MEMBER_WEIGHTS = RANK_WEIGHTS.map(w => Math.round(100 * w));

/** Tasti dei punti: il moltiplicatore (o chi) sopra, i punti sotto nel colore del segno. */
function Keys({ items }: { items: { label: string; value: string; title?: string }[] }) {
  const tone = (value: string) => (value.startsWith('+') ? 'good' : value.startsWith('−') ? 'bad' : 'even');
  return (
    <ul className="guide-keys">
      {items.map(item => <li key={item.label} className={tone(item.value)} title={item.title}><span>{item.label}{item.title && <span className="visually-hidden"> {item.title}</span>}</span><b>{item.value}</b></li>)}
    </ul>
  );
}

/** Righe termine / regola della guida; `stacked`: la regola sotto il termine. */
function Rows({ rows, stacked = false }: { rows: [ReactNode, ReactNode][]; stacked?: boolean }) {
  return (
    <dl className={`guide-rows${stacked ? ' stacked' : ''}`}>
      {rows.map(([term, rule], i) => <div key={i}><dt>{term}</dt><dd>{rule}</dd></div>)}
    </dl>
  );
}

/** Pillole di punti o valori: etichetta, numero e una nota. */
function Points({ items }: { items: { label: ReactNode; value?: ReactNode; note?: string }[] }) {
  return (
    <ul className="guide-points">
      {items.map((item, i) => (
        <li key={i}>{item.label}{item.value !== undefined && <b>{item.value}</b>}{item.note && <small>{item.note}</small>}</li>
      ))}
    </ul>
  );
}

/** Il contenuto della guida alla Difesa per una sezione: schematico e generico (niente valori del team). */
export function DefenseGuideSection({ section, defense, meta }: { section: Section; defense: TeamDefense; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(',', '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.def.${key}` as Key, params);
  const metaRows = defense.coverageMeta?.rows.length ?? 0;
  const physicalCount = defense.matrix.filter(row => row.physical).length;

  if (section === 'general') {
    // Cosa misura ogni parte e quanto pesa nella Difesa (Robustezza e Sostenibilità insieme)
    const pct = (n: number) => <span className="guide-pct">{n}%</span>;
    return (
      <>
        <h5>{g('what')}</h5>
        <Rows stacked rows={[
          [<>{t('detail.coverageTypes')}{pct(meta ? 25 : 50)}</>, g('what.types')],
          [<>{t('ddetail.robustness')} + {t('ddetail.sustain')}{pct(50)}</>, g('what.robustness', { n: physicalCount })],
          ...(meta ? [[<>{t('detail.coverageMeta')}{pct(25)}</>, g('what.meta', { n: metaRows })] as [ReactNode, string]] : []),
        ]} />
      </>
    );
  }

  if (section === 'robustness') {
    return (
      <>
        <h5>{g('rob.test')}</h5>
        <Rows rows={[
          [g('rob.attackers'), g('rob.attackers.rule', { n: physicalCount })],
          [g('rob.count'), g('rob.count.rule')],
        ]} />

        <h5>{g('rob.points')}</h5>
        <ul className="guide-holds">
          {HOLD_POINTS.map(h => (
            <li key={h.cls}><span className={`hold-chip ${h.cls}`}>{h.tag}</span><b>{dec(h.points)}</b><small>{g(h.note)}</small></li>
          ))}
        </ul>

        <h5>{g('rob.toteam')}</h5>
        <div className="guide-weights">
          <h6>{g('rob.weights')}</h6>
          <ol aria-label={g('rob.weights')}>
            {MEMBER_WEIGHTS.map((w, i) => (
              <li key={i} style={{ flexGrow: w }}><span>{g('rob.rank', { n: i + 1 })}</span><b>{w}%</b></li>
            ))}
          </ol>
          <div className="guide-weights-axis" aria-hidden="true"><span>{g('rob.best')}</span><span>{g('rob.worst')}</span></div>
        </div>
        <p className="guide-sum">
          <span><b>40%</b> {t('ddetail.physical')}</span>+<span><b>40%</b> {t('ddetail.special')}</span>+<span><b>20%</b> {t('ddetail.sustain')}</span>
          =<span className="out">{t('ddetail.robustness')}</span>
        </p>
      </>
    );
  }

  if (section === 'sustain') {
    return (
      <>
        <h5>{g('sus.count')}</h5>
        <Rows rows={[
          [g('sus.lead'), g('sus.lead.rule')],
          [g('sus.recovery'), g('sus.recovery.rule')],
          [g('sus.ability'), g('sus.ability.rule')],
          [g('sus.rocks'), g('sus.rocks.rule')],
          [g('sus.orb'), g('sus.orb.rule')],
        ]} />
        <h5>{g('sus.tovote')}</h5>
        <Rows rows={[
          [g('sus.half'), g('sus.half.rule')],
          [g('sus.scale'), g('sus.scale.rule')],
        ]} />
      </>
    );
  }

  if (section === 'coverageTypes') {
    return (
      <>
        <h5>{g('types.two')}</h5>
        <div className="guide-two">
          <div>
            <h6>{g('types.weighted')}</h6>
            <Keys items={[
              { label: '×0', title: g('types.immune'), value: '+2' }, { label: '×¼', value: dec('+1,5') }, { label: '×½', value: '+1' },
              { label: '×1', title: g('types.neutral'), value: '0' }, { label: '×2', value: '−1' }, { label: '×4', value: '−2' },
            ]} />
          </div>
          <div>
            <h6>{g('types.members')}</h6>
            <Keys items={[
              { label: g('types.resists'), value: '+1' }, { label: g('types.neutral'), value: '0' }, { label: g('types.weakOne'), value: '−1' },
            ]} />
          </div>
        </div>
        <h5>{g('types.tosafety')}</h5>
        <ol className="guide-scale" aria-label={g('types.tosafety')}>
          {SCALE.map(step => (
            <li key={step.balance}>
              <span>{g('types.balance')} {step.balance}</span><b className={`ct-pill ${step.tone}`}>{step.pct}%</b><small>{g(`types.tag.${step.tag}`)}</small>
            </li>
          ))}
        </ol>

        <h5>{g('types.example')}</h5>
        <div className="guide-example">
          <span className="guide-mults" aria-hidden="true">
            {['×½', '×½', '×½', '×2', '×2', '×4'].map((m, i) => <i key={i} className={i < 3 ? 'res' : i === 5 ? 'x4' : 'weak'}>{m}</i>)}
          </span>
          <span className="guide-res"><small>{g('types.ex.weighted')}</small><b>+3 −4 = −1</b></span>
          <span className="guide-res"><small>{g('types.ex.members')}</small><b>+3 −3 = 0</b></span>
          <span className="guide-res"><small>{g('types.balance')}</small><b>{dec('−0,5')}</b></span>
          <span className="guide-arrow" aria-hidden="true">→</span>
          <span className="guide-verdict"><b className="ct-pill bad">38%</b>{g('types.tag.minor')}</span>
        </div>

        <h5>{g('types.vote')}</h5>
        <ul className="guide-lines">
          <li><b>{g('types.average')}</b> = {g('types.average.rule')}</li>
        </ul>
      </>
    );
  }

  return (
    <>
      <h5>{g('meta.test')}</h5>
      <Rows rows={[
        [g('meta.threats'), g('meta.threats.rule', { n: metaRows })],
        [g('meta.hit'), g('meta.hit.rule')],
        [g('meta.holds'), g('meta.holds.rule')],
      ]} />
      <h5>{g('meta.toteam')}</h5>
      <Points items={[
        { label: g('meta.one'), value: '70%' }, { label: g('meta.two'), value: '90%' }, { label: g('meta.three'), value: '100%' },
      ]} />
      <Rows rows={[[g('types.split'), g('types.split.rule')]]} />
    </>
  );
}
