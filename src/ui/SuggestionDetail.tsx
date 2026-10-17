import { useMemo } from 'react';
import type { EngineData } from '../engine/data';
import { describeDiff } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { memberPower } from '../engine/power';
import { rateTeam, type TeamRating } from '../engine/rating';
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

/** Le parti del punteggio del candidato, sotto il numero: come si adatta al team, più le sue statistiche. */
const SCORE_PARTS = [
  { key: 'defense', label: 'suggest.col.defense' },
  { key: 'coverage', label: 'suggest.col.coverage' },
  { key: 'roles', label: 'suggest.col.roles' },
] as const;

/**
 * Il candidato selezionato nella lista: punteggio e sue parti, cosa cambia (in sostituzione),
 * come cambia il voto del team area per area, i motivi e il set.
 */
export function SuggestionDetail({ item, rank, team, replaceIndex, data, rating, emptyTeam, banMark, actionLabel, onAction }: {
  item: Suggestion | Replacement;
  rank: number;
  team: TeamSet[];
  /** Il membro che il candidato sostituirebbe, o null se si aggiunge. */
  replaceIndex: number | null;
  data: EngineData;
  /** Voto del team attuale. */
  rating: TeamRating | null;
  emptyTeam: boolean;
  banMark: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const set = item.set;
  const replacing = replaceIndex !== null;
  const after = useMemo(
    () => rateTeam(replacing ? team.map((member, i) => (i === replaceIndex ? set : member)) : [...team, set], data, lang),
    [team, replaceIndex, replacing, set, data, lang],
  );
  const before = team.length ? rating : null;
  const changes = 'diff' in item && item.diff ? describeDiff(item.diff, lang) : null;
  const types = getSpecies(item.species)?.types ?? [];
  const evs = STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
  const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '');

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}`} aria-label={tr('detail.region', { species: item.species })}>
      <header className="detail-hero">
        <Sprite species={item.species} item={set.item} size={128} />
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
        <div className="detail-score">
          <strong>{item.score}</strong>
          <span>{tr('detail.rank', { n: rank })}</span>
        </div>
        {/* Da cosa viene il punteggio */}
        <dl className="detail-parts">
          {!emptyTeam && SCORE_PARTS.map(part => (
            <div key={part.key}><dt>{tr(part.label)}</dt><dd>{Math.round(100 * item.components[part.key])}</dd></div>
          ))}
          <div><dt>{tr('suggest.col.stats')}</dt><dd>{memberPower(set)?.power ?? 0}</dd></div>
        </dl>
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
            <h4>{tr('detail.team')}</h4>
            <p className="detail-grade">
              <span>{tr('detail.grade')}</span>
              {before && <><span className={`grade-${before.grade}`}>{before.grade} {before.overall}</span><Icon name="arrow" /></>}
              <strong className={`grade-${after.grade}`}>{after.grade} {after.overall}</strong>
              {before && <span className={`gain${after.overall < before.overall ? ' worse' : after.overall === before.overall ? ' same' : ''}`}>{delta(after.overall - before.overall) || '±0'}</span>}
            </p>
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
