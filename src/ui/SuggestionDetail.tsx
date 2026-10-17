import { useMemo } from 'react';
import type { EngineData } from '../engine/data';
import { describeDiff } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import { withCandidate, type TeamGain } from '../engine/teamGain';
import { formatPercent } from '../i18n';
import type { Replacement } from '../engine/replace';
import type { Suggestion } from '../engine/scoring';
import { exportShowdown, STAT_IDS, type TeamSet } from '../engine/sets';
import { gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { copyText } from './clipboard';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { PokemonName } from './PokemonName';
import { ProsCons } from './ProsCons';
import { Sprite, TypeChip } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { MoveName, Typed } from './TypeText';

/**
 * Il candidato selezionato nella lista: come cambia il voto del team (in tutto e area per area),
 * cosa cambia (in sostituzione), i motivi e il set.
 */
export function SuggestionDetail({ item, rank, team, replaceIndex, data, rating, usage, banMark, actionLabel, onAction }: {
  item: (Suggestion | Replacement) & { teamGain?: TeamGain };
  rank: number;
  team: TeamSet[];
  /** Il membro che il candidato sostituirebbe, o null se si aggiunge. */
  replaceIndex: number | null;
  data: EngineData;
  /** Voto del team attuale. */
  rating: TeamRating | null;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  banMark: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const set = item.set;
  const replacing = replaceIndex !== null;
  const after = useMemo(() => rateTeam(withCandidate(team, set, replaceIndex), data, lang), [team, replaceIndex, set, data, lang]);
  // Senza altri membri non c'è un voto da confrontare
  const before = item.teamGain ? rating : null;
  const changes = 'diff' in item && item.diff ? describeDiff(item.diff, lang) : null;
  const types = getSpecies(item.species)?.types ?? [];
  const evs = STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
  const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '');
  const result = item.teamGain;

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}`} aria-label={tr('detail.region', { species: item.species })}>
      <header className="detail-hero">
        <Sprite species={item.species} item={set.item} size={88} />
        <div className="detail-id">
          <h3>
            <span>{item.species}</span>
            {banMark}
            <StatsBadge species={item.species} item={set.item} />
          </h3>
          <span className="types">{types.map(type => <TypeChip key={type} type={type} />)}</span>
          {item.tags.length > 0 && (
            <span className="tags">
              {item.tags.map(tag => (tag.startsWith('⚠')
                ? <span key={tag} className="tag warn"><Icon name="warning" />{tag.replace(/^⚠\s*/, '')}</span>
                : <span key={tag} className="tag">{tag}</span>))}
            </span>
          )}
        </div>
        {result && before ? (
          <div className="detail-score">
            <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{delta(result.gain) || '±0'}</strong>
            <span>{tr('detail.gradeChange', { from: `${before.grade} ${before.overall}`, to: `${result.grade} ${result.overall}` })}</span>
          </div>
        ) : usage !== null && (
          <div className="detail-score">
            <strong>{formatPercent(lang, usage)}</strong>
            <span>{tr('detail.usage')}</span>
          </div>
        )}
      </header>

      <div className="detail-body">
        {changes && replacing && (
          <section className="detail-sec wide">
            <h4>{tr('detail.changes')}</h4>
            <p className="swap-head replaces">
              <PokemonName name={team[replaceIndex].species} muted />
              <Icon name="arrow" />
              <span className="visually-hidden">{tr('coach.with')}</span>
              <PokemonName name={item.species} />
            </p>
            {'similarity' in item && item.similarity !== undefined && (
              <p className="note">{tr('suggest.similarity', { pct: Math.round(item.similarity * 100) })}</p>
            )}
            <ProsCons pros={changes.pros} cons={changes.cons} />
          </section>
        )}

        {after && (
          <section className="detail-sec">
            <h4>{tr(before ? 'detail.team' : 'detail.teamAlone')}</h4>
            <dl className="detail-areas">
              {after.areas.map(area => {
                const was = before?.areas.find(a => a.key === area.key)?.value;
                const change = area.value !== null && was != null ? area.value - was : 0;
                return (
                  <div key={area.key}>
                    <dt>{area.label}</dt>
                    <dd><meter min={0} max={100} value={area.value ?? 0} /></dd>
                    <dd className="value">{area.value ?? '–'}</dd>
                    <dd className={`change${change < 0 ? ' worse' : ''}`}>{delta(change)}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        <section className="detail-sec">
          <h4>{tr('detail.why')}</h4>
          <ul className="detail-reasons">
            {item.reasons.map(reason => <li key={reason.text}><Typed text={reason.text} /></li>)}
          </ul>
        </section>

        <section className="detail-sec wide set-sec">
          <h4>{tr('detail.set')}</h4>
          <dl className="detail-set">
            <dt>{tr('editor.item')}</dt>
            <dd>{set.item ? <><ItemIcon item={set.item} /> {gameName('item', set.item, lang)}</> : '—'}</dd>
            <dt>{tr('editor.ability')}</dt>
            <dd>{set.ability ? gameName('ability', set.ability, lang) : '—'}</dd>
            <dt>{tr('editor.nature')}</dt>
            <dd>{set.nature ? natureName(set.nature, lang) : '—'}</dd>
            <dt>{tr('editor.evs')}</dt>
            <dd>{evs || '—'}</dd>
            {set.teraType && <><dt>{tr('editor.tera')}</dt><dd>{typeName(set.teraType, lang)}</dd></>}
          </dl>
          <ul className="detail-moves" aria-label={tr('editor.moves')}>
            {set.moves.map(move => <li key={move}><MoveName move={move} /></li>)}
          </ul>
        </section>
      </div>

      <div className="detail-actions">
        <button type="button" className={rank === 1 ? 'primary' : 'go'} onClick={onAction}>{actionLabel}</button>
        <button type="button" onClick={() => copyText(exportShowdown([set]))}>{tr('suggest.copySet')}</button>
      </div>
    </aside>
  );
}
