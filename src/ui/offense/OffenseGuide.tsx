import type { ReactNode } from 'react';
import type { TeamOffense } from '../../engine/offense';
import { OFFENSE_DEPTH } from '../../engine/offense';
import { depthWeights } from '../../engine/coverage';
import { DEFAULT_FORMAT, type FormatId } from '../../engine/format';
import { pokedexOf, teraAllowed } from '../../engine/formats';
import { useT } from '../../i18n/react';
import { Rows } from '../guideParts';

type Key = Parameters<ReturnType<typeof useT>>[0];

/** Profondità del pacchetto dei tipi e della Coverage meta (oggi tutte e due 70/20/10): quelle del motore, in percentuale. */
const scaleOf = (d: number[]) => ({ one: d[0], two: d[0] + d[1], three: d[0] + d[1] + d[2] });
const depthOf = (meta: boolean): number[] => (meta ? depthWeights('meta') : OFFENSE_DEPTH).map(w => Math.round(100 * w));

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

/**
 * La guida all'Offesa: una pagina per le due Coverage, che hanno le stesse regole (colpo, cosa conta meno, pesi);
 * in fondo i bersagli, l'unica differenza. Schematica e generica (niente valori del team).
 */
export function OffenseGuide({ offense, formatId = DEFAULT_FORMAT.formatId }: { offense: TeamOffense; formatId?: FormatId }) {
  const t = useT();
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.off.${key}` as Key, params);
  const lines = (items: ReactNode[]) => <ul className="guide-lines">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  // Quello che conta meno, in una riga sola: Tera solo dove il formato lo ammette, mosse Z solo nel National Dex (in
  // Scarlatto/Violetto non esistono); il meteo del membro stesso conta pieno
  const format = { ...DEFAULT_FORMAT, formatId };
  const tera = teraAllowed(format);
  const z = pokedexOf(format) === 'natdex';
  const oneUse = tera && z ? g('less.oneuse') : tera ? g('less.tera') : z ? g('less.z') : null;
  const less = [g('less.locked'), g('less.field'), g('less.setup'), ...(oneUse ? [oneUse] : [])].join(', ');
  const count = offense.coverageMeta?.rows.length ?? 0;
  // I pesi sono gli stessi nelle due schede (70/20/10): la barra è una
  const depth = depthOf(false);
  return (
    <>
      <h5>{g('test')}</h5>
      <Rows compact rows={[
        [g('power.hit'), g('power.hit.rule')],
        [g('less'), `${less.charAt(0).toUpperCase()}${less.slice(1)}. ${g('less.own')}`],
        [g('eff'), g('eff.rule')],
      ]} />

      <h5>{g('cov.depth')}</h5>
      <Bar label={g('cov.depth')} weights={depth} rank={n => g('cov.rank', { n })} />
      {lines([g('cov.scale', scaleOf(depth))])}

      <h5>{g('test.targets')}</h5>
      <Rows compact rows={[
        [t('detail.coverageTypes'), g('targets.types')],
        ...(offense.coverageMeta ? [[t('detail.coverageMeta'), g('cov.targets.meta', { n: count })] as [ReactNode, string]] : []),
      ]} />
    </>
  );
}
