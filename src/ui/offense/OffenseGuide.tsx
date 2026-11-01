import type { ReactNode } from 'react';
import type { TeamOffense } from '../../engine/offense';
import { OFFENSE_SHARES, RANK_WEIGHTS, THREE_HIT } from '../../engine/offense';
import { COVERAGE_DEPTH, typeAverage } from '../../engine/coverage';
import { DEFAULT_FORMAT, type FormatId } from '../../engine/format';
import { pokedexOf, teraAllowed } from '../../engine/formats';
import { TYPES } from '../../engine/types';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { Rows } from '../guideParts';
import { Icon } from '../icons';
import { TypeIcons } from '../typeIcons';

export type OffenseSection = 'general' | 'coverageTypes' | 'power' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Pesi per posizione nel team e profondità della Coverage: quelli del motore, in percentuale. */
const MEMBER_WEIGHTS = RANK_WEIGHTS.map(w => Math.round(100 * w));
const DEPTH = COVERAGE_DEPTH.map(w => Math.round(100 * w));

/** Una barra di pesi (come quella della Difesa): ogni posizione larga quanto pesa; le scritte agli estremi sono facoltative. */
function Bar({ label, weights, rank, from, to }: { label: string; weights: number[]; rank: (n: number) => string; from?: string; to?: string }) {
  return (
    <div className="guide-weights">
      <ol aria-label={label}>
        {weights.map((w, i) => <li key={i} style={{ flexGrow: w }}><span>{rank(i + 1)}</span><b>{w}%</b></li>)}
      </ol>
      {from && to && <div className="guide-weights-axis" aria-hidden="true"><span>{from}</span><span>{to}</span></div>}
    </div>
  );
}

/** I 18 bersagli della Potenza: le difese base medie di ogni tipo nel Pokédex del formato (quelle che usa il motore). */
function TypeTargets({ formatId }: { formatId: FormatId }) {
  const t = useT();
  const lang = useLang();
  return (
    <details className="guide-more">
      <summary><Icon name="next" />{t('guide.off.targets.stats')}</summary>
      <div className="guide-targets-cols">
        {[TYPES.slice(0, 6), TYPES.slice(6, 12), TYPES.slice(12)].map((half, col) => (
          <table key={col} className="guide-targets">
            <thead>
              <tr>
                <th scope="col">{t('guide.off.targets.type')}</th>
                <th scope="col">{t('stat.hp')}</th>
                <th scope="col">{t('stat.def')}</th>
                <th scope="col">{t('stat.spd')}</th>
              </tr>
            </thead>
            <tbody>
              {half.map(type => {
                const avg = typeAverage(type, { stats: null, sets: null, formatId });
                return (
                  <tr key={type}>
                    <th scope="row"><TypeIcons types={[type]} />{typeName(type, lang)}</th>
                    <td>{avg.hp}</td><td>{avg.def}</td><td>{avg.spd}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </details>
  );
}

/** Il contenuto della guida all'Offesa per una sezione: schematico e generico (niente valori del team). */
export function OffenseGuideSection({ section, offense, meta, formatId = DEFAULT_FORMAT.formatId }: {
  section: OffenseSection; offense: TeamOffense; meta: boolean; formatId?: FormatId;
}) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', lang === 'it' ? ',' : '.');
  const pctOf = (x: number) => Math.round(100 * x);
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.off.${key}` as Key, params);
  // La Potenza si misura sempre sui 18 Pokémon medi, con e senza meta
  const targets = g('targets.tier');
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
          [<>{t('detail.power')}{pct(power)}</>, <>{g('what.power', { targets })}<TypeTargets formatId={formatId} /></>],
          [<>{t('detail.coverageTypes')}{pct(num(coverageShare))}</>, g('what.types')],
          ...(meta ? [[<>{t('detail.coverageMeta')}{pct(num(coverageShare))}</>, g('what.meta')] as [ReactNode, string]] : []),
        ]} />
      </>
    );
  }

  if (section === 'power') {
    // Tera solo dove il formato lo ammette, mosse Z solo nel National Dex (in Scarlatto/Violetto non esistono)
    const format = { ...DEFAULT_FORMAT, formatId };
    const tera = teraAllowed(format);
    const z = pokedexOf(format) === 'natdex';
    const oneUse: [ReactNode, string] | null = tera && z ? [g('power.oneuse'), g('rules.oneuse')]
      : tera ? [g('power.tera'), g('power.tera.rule')]
      : z ? [g('power.z'), g('power.z.rule')]
      : null;
    return (
      <>
        <h5>{g('test')}</h5>
        <Rows compact rows={[
          [g('power.hit'), g('power.hit.rule', { targets })],
          [g('power.locked'), g('power.locked.rule')],
          [g('power.weather'), g('power.weather.rule')],
          [g('power.setup'), g('rules.setup')],
          ...(oneUse ? [oneUse] : []),
        ]} />

        <h5>{g('toteam')}</h5>
        <Bar label={g('rank.weights')} weights={MEMBER_WEIGHTS} rank={n => g('rank', { n })} from={g('rank.best')} to={g('rank.worst')} />
      </>
    );
  }

  // Coverage di tipi e del meta: stesso test, cambiano i bersagli
  const isMeta = section === 'coverageMeta';
  const count = isMeta ? offense.coverageMeta?.rows.length ?? 0 : offense.coverageTypes.rows.length;
  // Accanto ai termini le stesse caselle della tabella Coverage tipi (verde copre, gialla a metà, vuota buco)
  const swatch = (cls: string, term: string) => <><span className={`guide-swatch ${cls}`} aria-hidden="true" />{term}</>;
  return (
    <>
      <h5>{g('test')}</h5>
      <Rows compact rows={isMeta ? [
        [g('test.targets'), g('cov.targets.meta', { n: count })],
        [g('cov.hit'), g('cov.hit.rule.meta')],
        [g('cov.hole'), g('cov.hole.rule.meta')],
      ] : [
        [g('test.targets'), g('cov.targets.tier', { n: count })],
        [swatch('ok-full', g('cov.hit')), g('cov.hit.rule')],
        [swatch('ok-half', g('cov.half')), g('cov.half.rule')],
        [swatch('empty', g('cov.hole')), g('cov.hole.rule', { pct: pctOf(THREE_HIT) })],
      ]} />

      <h5>{g('cov.depth')}</h5>
      <Bar label={g('cov.depth')} weights={DEPTH} rank={n => g('cov.rank', { n })} />
      {lines([g('cov.scale')])}
    </>
  );
}
