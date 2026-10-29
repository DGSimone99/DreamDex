import type { TeamOffense } from '../../engine/offense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MetaCount, MetaFrame, MetaHolders } from '../MetaFrame';
import { PokemonIcon } from '../PokemonName';

type Row = NonNullable<TeamOffense['coverageMeta']>['rows'][number];

/** Gruppo di un bersaglio: nessuno lo colpisce super efficace, solo a metà (colpi da 3HKO), coperto. */
const groupOf = (row: Row) => (row.coveredBy.length === 0 ? 'none' : row.coveredBy.every(c => c.partial) ? 'partial' : 'held');
/** Colore del livello, come Coverage tipi: rosso a 0, giallo sotto 80, verde da 80. */
const tone = (row: Row) => (row.level === 0 ? 'bad' : row.level < 80 ? 'warn' : 'good');

/**
 * Coverage meta dell'Offesa: i bersagli del meta a pagine da 8, dal meno coperto (a pari livello il più usato). Ogni
 * tessera ha icona e nome del bersaglio, il livello in pastiglia e chi lo colpisce super efficace, col danno del colpo
 * migliore (in giallo se solo a metà); a squadra chiusa anche la mossa. Cornice e pagine sono quelle della Difesa.
 */
export function OffenseMeta({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const rows = [...(offense.coverageMeta?.rows ?? [])].sort((a, b) => a.level - b.level || b.weight - a.weight);
  const count = (group: 'held' | 'partial' | 'none') => rows.filter(r => groupOf(r) === group).length;
  const summary = (
    <>
      <span>{t('odetail.cm.targets', { n: rows.length })}</span>
      <MetaCount n={count('held')} tone="good" label={t('odetail.cm.covered')} />
      <MetaCount n={count('partial')} tone="warn" label={t('odetail.cm.partial')} />
      <MetaCount n={count('none')} tone="bad" label={t('odetail.cm.none')} />
    </>
  );
  const tile = (row: Row) => {
    const hitters = row.coveredBy.map(c => `${c.species}: ${c.move} ${c.pct}%${c.partial ? ` (${t('detail.partial')})` : ''}`);
    const label = `${row.species}: ${row.level}%, ${hitters.length ? hitters.join('; ') : t('detail.nobody')}`;
    return (
      <li key={row.species} className={`cm-tile ${groupOf(row)}`} aria-label={label}>
        <span className="cm-head">
          <span className="def-box cm-threat"><PokemonIcon name={row.species} /></span>
          <b className="cm-name">{row.species}</b>
          <span className={`ct-pill ${tone(row)}`}>{row.level}%</span>
        </span>
        {row.coveredBy.length === 0 && <span className="cm-empty" aria-hidden="true">{t('odetail.cm.noHit')}</span>}
        <MetaHolders list={row.coveredBy} roomy={ctx.roomy} />
      </li>
    );
  };
  return <MetaFrame rows={rows} roomy={ctx.roomy} summary={summary} tile={tile}
    labels={{ pages: t('odetail.cm.pages'), prev: t('odetail.cm.prev'), next: t('odetail.cm.next'), page: (from, to) => t('odetail.cm.page', { from, to }) }} />;
}
