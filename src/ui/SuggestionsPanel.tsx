import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { improveReplacements, similarity, similarReplacements, type Replacement } from '../engine/replace';
import { describeDiff, ratingGainOf, SIMILAR_THRESHOLD, type SwapPreview } from '../engine/coach';
import { suggest, type Suggestion } from '../engine/scoring';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { bestSwaps, rankByTeamGain, SWAPS_PER_MEMBER, type SwapOption, type TeamGain } from '../engine/teamGain';
import { battleName } from '../engine/dex';
import { PokemonIcon } from './PokemonName';
import { statsEntry } from '../engine/stats';
import { formatPercent } from '../i18n';
import { getSpecies } from '../engine/dex';
import { formatLabel } from '../engine/formats';
import { EMPTY_FILTERS, isFiltering, searchCandidates, searchPool, tierLabel, type CandidateFilters } from '../engine/filters';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { conditionLabel, neededConditions, providesAll, viaName } from '../engine/synergy';
import { Sprite, TypeChip } from './Sprite';
import { Icon } from './icons';
import { SuggestionDetail } from './SuggestionDetail';
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { t } from '../i18n';
import { useLang, useT } from '../i18n/react';

/** Candidati per pagina e in tutto; il voto del team si calcola sui primi POOL per punteggio. */
export const PAGE = 10;
export const MAX = 50;
const POOL = 100;

/**
 * Candidato in lista, col voto che darebbe al team (assente col primo Pokémon).
 * Nelle raccomandazioni libere anche il membro che sostituirebbe e gli altri possibili.
 */
type Item = (Suggestion | Replacement) & { teamGain?: TeamGain; replaces?: number; alternatives?: SwapOption[] };

/** Cosa mostra la lista: aggiunte, scambi liberi con tutto il team, o sostituti di un membro. */
type View = 'add' | 'all' | 'member';

type ReplaceMode = 'improve' | 'similar';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  replaceIndex: number | null;
  onAdd: (set: TeamSet) => void;
  onReplaceWith: (index: number, set: TeamSet) => void;
  onCancelReplace: () => void;
  /** Sostituto aperto (o chiuso) nella lista: il coaching mostra i suoi pro e contro. */
  onPreview?: (preview: SwapPreview, open: boolean) => void;
  /** Voto del team attuale, per mostrare come cambia col candidato. */
  rating?: TeamRating | null;
  /** Sceglie il membro da sostituire (null: nessuno). */
  onTarget?: (index: number | null) => void;
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
function BanMark({ species, format }: { species: string; format: Format }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

/** Il voto del team col candidato (+7, B 80); col primo Pokémon, il suo uso nel meta. */
function ResultCell({ item, usage }: { item: Item; usage: number | null }) {
  const tr = useT();
  const lang = useLang();
  const result = item.teamGain;
  if (!result) {
    return usage === null
      ? <span className="result" aria-hidden="true" />
      : (
        <span className="result" aria-label={tr('suggest.usageAria', { pct: formatPercent(lang, usage) })}>
          <strong>{formatPercent(lang, usage)}</strong><small>{tr('suggest.usageShort')}</small>
        </span>
      );
  }
  const gain = signed(result.gain);
  return (
    <span className="result" aria-label={tr('suggest.teamGrade', { grade: result.grade, n: result.overall, gain })}>
      <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{gain}</strong>
      <small>{result.grade} {result.overall}</small>
    </span>
  );
}

/** +7, −3, ±0. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

function SuggestionRow({ rank, item, usage, out, quickLabel, actionLabel, replacing, picked, selected, onSelect, onAction, format }: {
  /** Riga scelta dalla ricerca (Invio la aggiunge). */
  picked?: boolean;
  /** Riga mostrata nel dettaglio. */
  selected: boolean;
  onSelect: () => void;
  quickLabel: string;
  actionLabel: string;
  replacing: boolean;
  format: Format;
  rank: number;
  item: Item;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  /** Il membro che uscirebbe (raccomandazioni libere). */
  out?: string;
  onAction: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const diff = 'diff' in item ? item.diff : null;
  const changes = diff ? describeDiff(diff, lang) : null;
  // Senza differenze da dire, il primo motivo (o "nessuna differenza" se non ce ne sono)
  const diffText = changes
    ? [...changes.pros.map(p => `+${p}`), ...changes.cons.map(c => `−${c}`)].join(' · ') || (item.reasons[0] ? null : tr('suggest.noDifference'))
    : null;
  // La riga sotto il nome; le etichette uguali a questa riga non si ripetono
  const summaryText = diffText ?? item.reasons[0]?.text ?? '';
  const types = getSpecies(item.species)?.types ?? [];
  const tags = item.tags.filter(tag => tag !== summaryText);
  const className = ['suggestion', rank === 1 && 'first', selected && 'selected', picked && 'picked', out && 'swap'].filter(Boolean).join(' ');
  return (
    // Tutta la riga apre il dettaglio col mouse; da tastiera lo fa il nome
    <li className={className} onClick={onSelect}>
      <span className="rank" aria-hidden="true">{rank}</span>
      <Sprite species={item.species} item={item.set.item} size={48} />
      <span className="who">
        <span className="name-line">
          <button type="button" className="pick" aria-pressed={selected} onClick={e => { e.stopPropagation(); onSelect(); }}>
            <strong><span className="visually-hidden">{rank}. </span>{item.species}</strong>
          </button>
          <BanMark species={item.species} format={format} />
        </span>
        <span className="types">{types.map(type => <TypeChip key={type} type={type} />)}</span>
        <small><Typed text={summaryText} /></small>
        {tags.length > 0 && (
          <span className="tags">
            {tags.map(tag => (tag.startsWith('⚠')
              ? <span key={tag} className="tag warn"><Icon name="warning" /><span>{tag.replace(/^⚠\s*/, '')}</span></span>
              : <span key={tag} className="tag">{tag}</span>))}
          </span>
        )}
      </span>
      {out && (
        <span className="out" title={tr('suggest.outFor', { member: out })}>
          <Icon name="swap" />
          <PokemonIcon name={out} />
          <span className="visually-hidden">{tr('suggest.outFor', { member: out })}</span>
        </span>
      )}
      <ResultCell item={item} usage={usage} />
      <button
        type="button"
        className="quick"
        aria-label={quickLabel}
        title={actionLabel}
        onClick={e => { e.stopPropagation(); onAction(); }}
      >
        <Icon name={replacing ? 'swap' : 'plus'} />
      </button>
    </li>
  );
}

/** Il valore si aggiorna solo dopo `delay` ms senza modifiche (per non ricalcolare a ogni lettera). */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export const SEARCH_DELAY = 200;

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace, onPreview, rating = null, onTarget }: Props) {
  const tr = useT();
  const lang = useLang();
  const [mode, setMode] = useState<ReplaceMode>('improve');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  // La lista si ricalcola sui filtri "stabili"; l'input mostra subito quello che scrivi
  const applied = useDebounced(filters, SEARCH_DELAY);
  const filtering = isFiltering(applied);
  const replacing = replaceIndex !== null && replaceIndex < team.length;
  // Aggiungere o migliorare il team con scambi liberi; a team completo si migliora
  const [scope, setScope] = useState<'add' | 'all'>('add');
  const view: View = replacing ? 'member' : team.length >= 2 && (scope === 'all' || team.length >= 6) ? 'all' : 'add';
  /** Il team contro cui si valutano i candidati è vuoto: niente adattamento da mostrare. */
  const emptyTeam = (replacing ? team.length - 1 : team.length) === 0;

  // Il voto del team per ogni candidato richiede un attimo: la lista si ricalcola senza bloccare il resto
  // (il team si aggiorna subito, la lista resta attenuata finché non è pronta)
  const source = useMemo(() => ({ team, replaceIndex, format, data, scope }), [team, replaceIndex, format, data, scope]);
  const deferred = useDeferredValue(source);
  const stale = deferred !== source;
  const items: Item[] = useMemo(() => {
    const { team, format, data } = deferred;
    const replaceIndex = deferred.replaceIndex !== null && deferred.replaceIndex < team.length ? deferred.replaceIndex : null;
    // Prima i candidati migliori per punteggio, poi ordinati per il voto che darebbero al team
    const rank = (list: (Suggestion | Replacement)[], sort = true) => rankByTeamGain(list, team, replaceIndex, data, lang, sort).slice(0, MAX);
    if (replaceIndex === null && team.length >= 2 && (deferred.scope === 'all' || team.length >= 6)) {
      // Raccomandazioni libere: per ogni candidato, il membro che conviene di più sostituire
      const pool = filtering ? searchPool(team, format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      const similar = mode === 'similar';
      return bestSwaps(team, data, lang, index => (similar
        ? similarReplacements(team, index, format, data, 3 * SWAPS_PER_MEMBER, pool, lang)
        : improveReplacements(team, index, format, data, SWAPS_PER_MEMBER, pool, lang)), { similar, threshold: SIMILAR_THRESHOLD }).slice(0, MAX);
    }
    if (replaceIndex !== null) {
      // Con ricerca o filtri i sostituti vengono da tutto il Pokédex, non solo dalle statistiche
      const pool = filtering ? searchPool(team.filter((_, i) => i !== replaceIndex), format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      // Sostituto simile: l'ordine resta per somiglianza, il voto si mostra soltanto
      return mode === 'improve'
        ? rank(improveReplacements(team, replaceIndex, format, data, POOL, pool, lang))
        : rank(similarReplacements(team, replaceIndex, format, data, MAX, pool, lang), false);
    }
    if (filtering) return rank(searchCandidates(team, format, data, applied, POOL, lang));
    return data.stats ? rank(suggest(team, format, data, POOL, lang)) : [];
  }, [deferred, mode, applied, filtering, lang]);

  const query = filters.query.trim();
  // I risultati valgono solo se la lista è già aggiornata su quello che hai scritto
  const fresh = !!query && applied.query.trim() === query;
  const exact = getSpecies(query);
  // Riga scelta con le frecce; null: il nome esatto se c'è, altrimenti il primo risultato
  const [cursor, setCursor] = useState<number | null>(null);
  // Riga aperta nel dettaglio col clic; null: quella scelta dalla ricerca o la prima della pagina
  const [selectedName, setSelectedName] = useState<string | null>(null);
  // Una lista nuova riparte dalla prima pagina; il candidato aperto resta finché c'è ancora
  useEffect(() => {
    setCursor(null);
    setPage(0);
    setSelectedName(name => (name && items.some(item => item.species === name) ? name : null));
  }, [items]);
  const pages = Math.ceil(items.length / PAGE);
  const pageItems = items.slice(page * PAGE, (page + 1) * PAGE);
  const chosen = fresh && cursor !== null ? items[cursor] : undefined;
  const fallback = fresh ? items[0] : undefined;
  const pickedIndex = !fresh ? -1
    : cursor ?? (exact ? items.findIndex(item => item.species === exact.name) : 0);
  /** Invio: la riga scelta con le frecce, altrimenti il nome esatto, altrimenti il primo risultato. */
  const pickFromSearch = () => {
    if (view === 'all') {
      // Negli scambi liberi serve sapere chi esce: si usa la riga della lista
      const item = chosen ?? (exact ? items.find(i => i.species === exact.name) : undefined) ?? fallback;
      if (!item) return;
      act(item);
    } else {
      const set = chosen?.set ?? (exact ? defaultSet(data, exact.name, format.genLimit) : fallback?.set);
      if (!set) return;
      if (replacing) onReplaceWith(replaceIndex, set);
      else onAdd(set);
    }
    setFilters({ ...filters, query: '' });
  };
  const target = chosen?.species ?? exact?.name ?? fallback?.species;
  const listRef = useRef<HTMLOListElement>(null);
  /** Frecce: passa al risultato successivo o precedente, tenendolo in vista. */
  const moveCursor = (delta: number) => {
    const first = page * PAGE;
    const last = Math.min(items.length, first + PAGE) - 1;
    if (!fresh || last < first) return;
    const next = Math.min(last, Math.max(first, Math.max(pickedIndex, first) + delta));
    setCursor(next);
    setSelectedName(null);
    listRef.current?.children[next - first]?.scrollIntoView?.({ block: 'nearest' });
  };
  const goToPage = (next: number) => {
    setPage(next);
    setCursor(null);
    setSelectedName(null);
  };
  const selected = pageItems.find(item => item.species === selectedName)
    ?? (pickedIndex >= page * PAGE && pickedIndex < (page + 1) * PAGE ? items[pickedIndex] : undefined)
    ?? pageItems[0];
  const selectedRank = selected ? items.indexOf(selected) + 1 : 0;
  const usageOf = (species: string) => statsEntry(data.stats, species)?.usage ?? null;
  const act = (item: Item) => (item.replaces !== undefined ? onReplaceWith(item.replaces, item.set)
    : replacing ? onReplaceWith(replaceIndex, item.set) : onAdd(item.set));
  /** Chi uscirebbe col candidato, o null se si aggiunge. */
  const outOf = (item: Item) => (item.replaces !== undefined ? item.replaces : replacing ? replaceIndex : null);
  // Il nome dal team per cui la lista è stata calcolata: per un attimo può essere quello di prima (es. team appena svuotato)
  const memberName = (index: number) => { const member = deferred.team[index] ?? team[index]; return member ? battleName(member) : ''; };
  const actionLabelOf = (item: Item) => (item.replaces !== undefined
    ? tr('suggest.swapAction', { member: memberName(item.replaces) })
    : tr(replacing ? 'suggest.replaceWith' : 'suggest.add'));
  const quickLabelOf = (item: Item) => (item.replaces !== undefined
    ? tr('suggest.swapQuick', { species: item.species, member: memberName(item.replaces) })
    : replacing ? tr('suggest.replaceQuick', { species: item.species }) : tr('suggest.addQuick', { species: item.species }));
  /** Modalità: aggiungere, migliorare (tutto il team o un membro), sostituto simile. */
  const chooseMode = (next: 'add' | ReplaceMode) => {
    if (next === 'add') {
      setScope('add');
      onCancelReplace();
      return;
    }
    setMode(next);
    if (view === 'add') setScope('all');
  };
  /** Apre il candidato nel dettaglio; in sostituzione il coaching mostra il sostituto scelto. */
  const select = (item: Item) => {
    setSelectedName(item.species);
    if (replacing && 'diff' in item && onPreview) {
      onPreview({
        index: replaceIndex,
        replacement: item.species,
        set: item.set,
        score: item.score,
        similar: similarity(team[replaceIndex], item.set, formatRules(format.formatId)) >= SIMILAR_THRESHOLD,
        ratingGain: ratingGainOf(team, replaceIndex, item.set, data),
        diff: item.diff,
      }, true);
    }
  };

  const title = replacing ? tr('suggest.replaceTitle', { species: team[replaceIndex].species })
    : view === 'all' ? tr('suggest.improveTitle') : tr('suggest.title');

  // Sostituendo un setter di cui altri membri hanno bisogno, si mostrano solo setter della stessa condizione
  let setterNote: string | null = null;
  if (replacing) {
    const needed = neededConditions(team, replaceIndex);
    if (needed.length) {
      const labels = needed.map(n => conditionLabel(n.condition, lang)).join(` ${tr('suggest.and')} `);
      const who = [...new Set(needed.flatMap(n => n.beneficiaries.map(b => b.species)))].join(', ');
      setterNote = items.length > 0 && items.every(item => providesAll(item.set, needed))
        ? tr('suggest.setterOnly', { conditions: labels, who })
        : tr('suggest.setterNone', {
          conditions: labels,
          species: team[replaceIndex].species,
          losses: needed.flatMap(n => n.beneficiaries.map(b => tr('suggest.loses', { species: b.species, via: viaName(b.via, lang) }))).join(', '),
        });
    }
  }

  const full = view === 'add' && team.length >= 6;
  const search = full ? null : (
    <>
      <div className="search">
        <span className={`search-field${target ? ' has-hint' : ''}`}>
          <Icon name="search" />
          <input
            aria-label={tr('suggest.search')}
            aria-describedby={target ? 'search-hint' : undefined}
            placeholder={tr('suggest.searchPlaceholder')}
            value={filters.query}
            onChange={e => { setFilters({ ...filters, query: e.target.value }); setSelectedName(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter') pickFromSearch();
              else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
              else if (e.key === 'Escape') setFilters({ ...filters, query: '' });
            }}
          />
          {target && (
            // Dentro il campo, a destra: comparendo non sposta il resto
            <span id="search-hint" className="search-hint">
              <kbd>{tr('suggest.enter')}</kbd> {tr(replacing ? 'suggest.enterReplaces' : 'suggest.enterAdds')} <strong>{target}</strong>
            </span>
          )}
          {filters.query && (
            <button type="button" className="clear" aria-label={tr('suggest.clear')} onClick={() => setFilters({ ...filters, query: '' })}>
              <Icon name="close" />
            </button>
          )}
        </span>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
    </>
  );

  // Il numero di risultati, sopra la lista quando si cerca o si filtra
  const countText = `${items.length === 1 ? tr('suggest.resultsOne') : tr('suggest.resultsMany', { n: items.length })}${items.length === MAX ? tr('suggest.best') : ''}`;

  // Note sopra (a tutta larghezza); sotto, lista e dettaglio partono alla stessa altezza
  let notes = null;
  let body;
  if (full) {
    body = <p>{tr('suggest.full')}</p>;
  } else if (!data.stats && !filtering) {
    body = <p>{tr('suggest.needData')}</p>;
  } else if (filtering && items.length === 0) {
    body = (
      <div className="list-empty">
        <Icon name="search" />
        <p>{tr('suggest.noMatch')}</p>
        {filters.query && <button type="button" onClick={() => setFilters({ ...filters, query: '' })}>{tr('suggest.clear')}</button>}
      </div>
    );
  } else {
    notes = (
      <>
        {filtering && <p className="visually-hidden" aria-live="polite">{tr('suggest.resultsAria', { text: countText })}</p>}
        {setterNote && <p className="note">{setterNote}</p>}
        {emptyTeam && (
          <p className="note">{tr('suggest.emptyTeam')}</p>
        )}
        {filtering && <p className="list-count">{countText}</p>}
      </>
    );
    body = (
      <>
        <ol className={`suggestions${stale ? ' stale' : ''}`} ref={listRef} aria-busy={stale || undefined}>
          {pageItems.map((item, i) => (
            <SuggestionRow
              key={item.species}
              picked={page * PAGE + i === pickedIndex}
              selected={item === selected}
              onSelect={() => select(item)}
              rank={page * PAGE + i + 1}
              item={item}
              usage={emptyTeam ? usageOf(item.species) : null}
              out={item.replaces !== undefined ? memberName(item.replaces) : undefined}
              actionLabel={actionLabelOf(item)}
              quickLabel={quickLabelOf(item)}
              replacing={view !== 'add'}
              onAction={() => act(item)}
              format={format}
            />
          ))}
        </ol>
        {pages > 1 && (
          <nav className="pager" aria-label={tr('suggest.pages')}>
            <button type="button" className="step" aria-label={tr('suggest.prev')} disabled={page === 0} onClick={() => goToPage(page - 1)}>
              <Icon name="prev" />
            </button>
            {Array.from({ length: pages }, (_, n) => (
              <button key={n} type="button" aria-label={tr('suggest.page', { n: n + 1 })} aria-current={n === page ? 'page' : undefined}
                onClick={() => goToPage(n)}>
                {n + 1}
              </button>
            ))}
            <button type="button" className="step" aria-label={tr('suggest.next')} disabled={page === pages - 1} onClick={() => goToPage(page + 1)}>
              <Icon name="next" />
            </button>
          </nav>
        )}
      </>
    );
  }

  return (
    <section aria-label={tr('suggest.title')} className="suggestions-panel">
      <h2>{title}</h2>
      <div className="modes">
        <div className="segmented" role="group" aria-label={tr('suggest.mode')}>
          <button type="button" aria-pressed={view === 'add'} disabled={team.length >= 6} onClick={() => chooseMode('add')}>
            <Icon name="plus" />{tr('suggest.addMode')}
          </button>
          <button type="button" aria-pressed={view !== 'add' && mode === 'improve'} disabled={team.length < 2 && !replacing}
            onClick={() => chooseMode('improve')}>{tr('suggest.improve')}</button>
          <button type="button" aria-pressed={view !== 'add' && mode === 'similar'} disabled={team.length < 2 && !replacing}
            onClick={() => chooseMode('similar')}>{tr('suggest.similar')}</button>
        </div>
        {view !== 'add' && (
          // Chi sostituire: tutti (il motore sceglie per ogni candidato) o un membro preciso
          <div className="targets" role="group" aria-label={tr('suggest.target')}>
            <span className="targets-label" aria-hidden="true">{tr('suggest.targetLabel')}</span>
            <button type="button" aria-pressed={view === 'all'} onClick={() => { setScope('all'); onCancelReplace(); }}>{tr('suggest.targetAll')}</button>
            {team.map((member, index) => (
              <button key={index} type="button" aria-pressed={replacing && replaceIndex === index}
                aria-label={tr('suggest.targetMember', { member: battleName(member) })}
                title={member.favorite ? tr('suggest.targetFavorite') : undefined}
                onClick={() => onTarget?.(index)}>
                <PokemonIcon name={battleName(member)} />
                <span>{battleName(member)}</span>
                {member.favorite && <Icon name="star" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {search}
      {notes}
      <div className={`picker${selected && !full ? ' has-detail' : ''}`}>
        <div className="picker-list">{body}</div>
        {selected && !full && (
          <SuggestionDetail
            key={selected.species}
            item={selected}
            rank={selectedRank}
            // Il team per cui il suggerimento è stato calcolato (gli indici dei membri si riferiscono a quello)
            team={deferred.team}
            replaceIndex={outOf(selected)}
            data={data}
            rating={rating}
            usage={emptyTeam ? usageOf(selected.species) : null}
            banMark={<BanMark species={selected.species} format={format} />}
            actionLabel={actionLabelOf(selected)}
            onAction={() => act(selected)}
          />
        )}
      </div>
    </section>
  );
}
