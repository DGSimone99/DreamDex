import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { MetaCount, MetaFrame, MetaHolders } from '../MetaFrame';
import { PokemonIcon } from '../PokemonName';

type Row = NonNullable<TeamDefense['coverageMeta']>['rows'][number];

/** Gruppo di una minaccia: nessuno la regge, solo a metà (chi regge va KO in due colpi), retta. */
const groupOf = (row: Row) => (row.heldBy.length === 0 ? 'none' : row.heldBy.some(h => !h.partial) ? 'held' : 'partial');
/** Colore del livello, come le altre pastiglie: verde da 80, giallo sopra zero, rosso senza difensori. */
const tone = (row: Row) => (row.heldBy.length === 0 ? 'bad' : row.level >= 80 ? 'good' : 'warn');

/**
 * Coverage meta: le minacce del meta a pagine da 8, dalla meno coperta (a pari livello la più usata). Ogni tessera ha
 * l'icona e il nome della minaccia, il livello in pastiglia e chi la regge, col danno che prende dal colpo migliore della
 * minaccia (in giallo se regge solo a metà); a squadra chiusa anche la mossa di quel colpo. In alto le pagine, cosa dice il % e i
 * conteggi dei tre gruppi.
 */
export function DefenseMeta({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const rows = [...(defense.coverageMeta?.rows ?? [])].sort((a, b) => a.level - b.level || b.weight - a.weight);
  const count = (group: 'held' | 'partial' | 'none') => rows.filter(r => groupOf(r) === group).length;
  const summary = (
    <>
      <span className="cm-dmg">{t('ddetail.cm.damage')}</span>
      <span>{t('ddetail.cm.threats', { n: rows.length })}</span>
      <MetaCount n={count('held')} tone="good" label={t('ddetail.cm.held')} />
      <MetaCount n={count('partial')} tone="warn" label={t('ddetail.cm.partial')} />
      <MetaCount n={count('none')} tone="bad" label={t('ddetail.cm.none')} />
    </>
  );
  const tile = (row: Row) => {
    const holders = row.heldBy.map(h => `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`);
    const label = `${row.species}: ${row.level}%, ${holders.length ? holders.join('; ') : t('detail.nobody')}`;
    return (
      <li key={row.species} className={`cm-tile ${groupOf(row)}`} aria-label={label}>
        <span className="cm-head">
          <span className="def-box cm-threat"><PokemonIcon name={row.species} /></span>
          <b className="cm-name">{row.species}</b>
          <span className={`ct-pill ${tone(row)}`}>{row.heldBy.length ? `${row.level}%` : t('detail.nobody')}</span>
        </span>
        {row.heldBy.length === 0 && <span className="cm-empty" aria-hidden="true">{t('ddetail.cm.allKo')}</span>}
        <MetaHolders list={row.heldBy} roomy={ctx.roomy} />
      </li>
    );
  };
  return <MetaFrame rows={rows} roomy={ctx.roomy} summary={summary} tile={tile}
    labels={{ pages: t('ddetail.cm.pages'), prev: t('ddetail.cm.prev'), next: t('ddetail.cm.next'), page: (from, to) => t('ddetail.cm.page', { from, to }) }} />;
}
