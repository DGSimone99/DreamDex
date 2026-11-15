import type { ReactNode } from 'react';
import type { TeamOffense } from '../../engine/offense';
import { OFFENSE_DEPTH } from '../../engine/offense';
import { depthWeights } from '../../engine/coverage';
import { DEFAULT_FORMAT, type FormatId } from '../../engine/format';
import { pokedexOf, teraAllowed } from '../../engine/formats';
import { useT } from '../../i18n/react';
import { Rows } from '../guideParts';

export type OffenseSection = 'types' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Profondità del pacchetto dei tipi e della Coverage meta (oggi tutte e due 70/20/10): quelle del motore, in percentuale. */
const scaleOf = (d: number[]) => ({ one: d[0], two: d[0] + d[1], three: d[0] + d[1] + d[2] });
const depthOf = (meta: boolean) => (meta ? depthWeights('meta') : OFFENSE_DEPTH).map(w => Math.round(100 * w));

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

/** Il contenuto della guida all'Offesa per una sezione: schematico e generico (niente valori del team). */
export function OffenseGuideSection({ section, offense, formatId = DEFAULT_FORMAT.formatId }: {
  section: OffenseSection; offense: TeamOffense; formatId?: FormatId;
}) {
  const t = useT();
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.off.${key}` as Key, params);
  const lines = (items: ReactNode[]) => <ul className="guide-lines">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  // Quello che conta meno, in una riga sola (uguale nei tipi e nel meta): Tera solo dove il formato lo ammette, mosse Z
  // solo nel National Dex (in Scarlatto/Violetto non esistono); il meteo del membro stesso conta pieno
  const format = { ...DEFAULT_FORMAT, formatId };
  const tera = teraAllowed(format);
  const z = pokedexOf(format) === 'natdex';
  const oneUse = tera && z ? g('less.oneuse') : tera ? g('less.tera') : z ? g('less.z') : null;
  const less = [g('less.locked'), g('less.field'), g('less.setup'), ...(oneUse ? [oneUse] : [])].join(', ');
  const lessRow: [ReactNode, string] = [g('less'), `${less.charAt(0).toUpperCase()}${less.slice(1)}. ${g('less.own')}`];
  const depth = (meta: boolean) => (
    <>
      <h5>{g('cov.depth')}</h5>
      <Bar label={g('cov.depth')} weights={depthOf(meta)} rank={n => g('cov.rank', { n })} />
      {lines([g('cov.scale', scaleOf(depthOf(meta)))])}
    </>
  );

  if (section === 'types') {
    return (
      <>
        <h5>{g('test')}</h5>
        <Rows compact rows={[
          // I 18 bersagli valgono sempre, con e senza meta; le loro statistiche medie nel tooltip sul tipo della tabella
          [g('power.hit'), g('power.hit.rule', { targets: g('targets.tier') })],
          lessRow,
          [g('eff'), g('eff.rule')],
        ]} />
        {depth(false)}
      </>
    );
  }

  // Coverage del meta: i Pokémon più usati mandati KO in due colpi
  const count = offense.coverageMeta?.rows.length ?? 0;
  return (
    <>
      <h5>{g('test')}</h5>
      <Rows compact rows={[
        [g('test.targets'), g('cov.targets.meta', { n: count })],
        [g('meta.hit'), g('cov.hit.rule.meta')],
        lessRow,
        [g('eff'), g('eff.rule')],
      ]} />
      {depth(true)}
    </>
  );
}
