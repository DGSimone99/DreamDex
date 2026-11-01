import type { ReactNode } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { COVERAGE_DEPTH } from '../../engine/coverage';
import { DEFENSE_SHARES, DEFENSE_SHARES_NO_META, dummyStats } from '../../engine/defense';
import { DEFAULT_FORMAT, type FormatId } from '../../engine/format';
import { useLang, useT } from '../../i18n/react';
import { Keys, Rows } from '../guideParts';

type Section = 'general' | 'sustain' | 'coverageTypes' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Quanto vale ogni soglia del colpo di tipo, dalla peggiore: il credito del membro. */
const HOLD_POINTS = [
  { cls: 'hold-ohko', tag: 'OHKO', points: '0', note: 'types.ohko' }, { cls: 'hold-2', tag: '2HKO', points: '0', note: 'types.two' },
  { cls: 'hold-3', tag: '3HKO', points: '0,5', note: 'types.three' }, { cls: 'hold-4', tag: '4HKO+', points: '1', note: 'types.four' },
] as const;

/** Quanto vale chi regge una minaccia, dal primo al terzo: quelli del motore (COVERAGE_DEPTH), in percentuale. */
const DEPTH = COVERAGE_DEPTH.map(w => Math.round(100 * w));

/**
 * Il contenuto della guida alla Difesa per una sezione: schematico e generico (niente valori del team). `formatId` dà
 * l'Attacco e l'Attacco Speciale dell'attaccante finto di Coverage tipi.
 */
export function DefenseGuideSection({ section, defense, meta, formatId = DEFAULT_FORMAT.formatId }: {
  section: Section; defense: TeamDefense; meta: boolean; formatId?: FormatId;
}) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(',', '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.def.${key}` as Key, params);
  const metaRows = defense.coverageMeta?.rows.length ?? 0;

  if (section === 'general') {
    // Cosa misura ogni parte e quanto pesa nella Difesa
    const pct = (n: number) => <span className="guide-pct">{n}%</span>;
    const share = (x: number) => Math.round(100 * x);
    const types = meta ? DEFENSE_SHARES.types : DEFENSE_SHARES_NO_META.types;
    const sustain = meta ? DEFENSE_SHARES.sustain : DEFENSE_SHARES_NO_META.sustain;
    return (
      <>
        <h5>{g('what')}</h5>
        <Rows stacked rows={[
          [<>{t('detail.coverageTypes')}{pct(share(types))}</>, g('what.types')],
          ...(meta ? [[<>{t('detail.coverageMeta')}{pct(share(DEFENSE_SHARES.meta))}</>, g('what.meta', { n: metaRows })] as [ReactNode, string]] : []),
          [<>{t('ddetail.sustain')}{pct(share(sustain))}</>, g('what.sustain')],
        ]} />
      </>
    );
  }

  if (section === 'sustain') {
    return (
      <>
        <div className="guide-two even">
          <div>
            <h6>{t('ddetail.sus.gain')}</h6>
            <Keys items={[
              { label: g('sus.k.recover'), value: '+50%' }, { label: 'Regenerator', value: '+33%' }, { label: 'Rest', value: '+33%' },
              { label: 'Wish', value: '+25%' }, { label: 'Pain Split', value: '+25%' }, { label: g('sus.k.drain'), value: dec('+12,5%') },
              { label: 'Poison Heal', value: dec('+12,5%') }, { label: 'Leftovers', value: '+6%' }, { label: g('sus.k.weather'), value: '+6%' },
            ]} />
          </div>
          <div>
            <h6>{t('ddetail.sus.loss')}</h6>
            <Keys items={[
              { label: 'Stealth Rock', value: dec('−12,5%'), title: g('sus.k.rocks') }, { label: 'Life Orb', value: '−10%' },
              { label: 'Toxic Orb', value: dec('−12,5%') }, { label: 'Black Sludge', value: dec('−12,5%'), title: g('sus.k.sludge') },
              { label: 'Flame Orb', value: '−6%' }, { label: 'Sticky Barb', value: '−6%' },
            ]} />
          </div>
        </div>
        <p className="guide-foot">{g('sus.k.rocks')} · {g('sus.k.sludge')}</p>

        <h5>{g('sus.except')}</h5>
        <Rows compact rows={[
          ['Heavy-Duty Boots', g('sus.x.boots')],
          [g('sus.x.removal'), g('sus.x.removal.rule')],
          ['Magic Guard', g('sus.x.guard')],
          [g('sus.x.status'), g('sus.x.status.rule')],
        ]} />
      </>
    );
  }

  if (section === 'coverageTypes') {
    return (
      <>
        <h5>{g('types.test')}</h5>
        <Rows compact rows={[
          [g('types.attacker'), g('types.attacker.rule', dummyStats(formatId))],
          [g('types.hits'), g('types.hits.rule')],
          [g('types.setup'), g('types.setup.rule')],
        ]} />

        <h5>{g('types.points')}</h5>
        <ul className="guide-holds">
          {HOLD_POINTS.map(h => (
            <li key={h.cls}><span className={`hold-chip ${h.cls}`}>{h.tag}</span><b>{dec(h.points)}</b><small>{g(h.note)}</small></li>
          ))}
        </ul>

        <h5>{g('types.depth')}</h5>
        <div className="guide-weights">
          <ol aria-label={g('types.depth')}>
            {DEPTH.map((w, i) => (
              <li key={i} style={{ flexGrow: w }}><span>{g('meta.rank', { n: i + 1 })}</span><b>+{w}%</b></li>
            ))}
          </ol>
        </div>
      </>
    );
  }

  return (
    <>
      <h5>{g('meta.test')}</h5>
      <Rows compact rows={[
        [g('meta.threats'), g('meta.threats.rule', { n: metaRows })],
        [g('meta.hit'), g('meta.hit.rule')],
      ]} />

      <h5>{g('meta.holds')}</h5>
      <ul className="guide-holds three">
        <li><span className="hold-chip hold-4">38%</span><b>{g('meta.hold.full')}</b><small>{g('meta.hold.full.rule')}</small></li>
        <li><span className="hold-chip hold-3">72%</span><b>{g('meta.hold.half')}</b><small>{g('meta.hold.half.rule')}</small></li>
        <li><span className="hold-chip hold-ohko">KO</span><b>{g('meta.hold.ko')}</b><small>{g('meta.hold.ko.rule')}</small></li>
      </ul>

      <h5>{g('meta.depth')}</h5>
      <div className="guide-weights">
        <ol aria-label={g('meta.depth')}>
          {DEPTH.map((w, i) => (
            <li key={i} style={{ flexGrow: w }}><span>{g('meta.rank', { n: i + 1 })}</span><b>+{w}%</b></li>
          ))}
        </ol>
      </div>
    </>
  );
}
