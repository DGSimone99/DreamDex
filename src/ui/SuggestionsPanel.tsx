import { useEffect, useMemo, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { improveReplacements, similarReplacements, type Replacement } from '../engine/replace';
import { suggest, type Suggestion } from '../engine/scoring';
import { exportShowdown, type TeamSet } from '../engine/sets';
import { getSpecies } from '../engine/dex';
import { EMPTY_FILTERS, isFiltering, searchCandidates, searchPool, tierLabel, type CandidateFilters } from '../engine/filters';
import { memberPower } from '../engine/power';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { CONDITION_LABELS, neededConditions, providesAll } from '../engine/synergy';
import { copyText } from './clipboard';

/** Barre mostrate sulle carte: come il candidato si adatta al team, più le sue statistiche. */
const FIT_BARS: { key: 'defense' | 'coverage' | 'roles'; label: string }[] = [
  { key: 'defense', label: 'Difesa' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'roles', label: 'Ruoli' },
];
const PAGE = 10;
const MAX = 20;

type ReplaceMode = 'improve' | 'similar';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  replaceIndex: number | null;
  onAdd: (set: TeamSet) => void;
  onReplaceWith: (index: number, set: TeamSet) => void;
  onCancelReplace: () => void;
}

function TierTag({ species }: { species: string }) {
  const { label, banned } = tierLabel(species);
  return banned
    ? <span className="tag banned">{label} · bannato in National Dex OU</span>
    : <span className="tag tier">{label}</span>;
}

function SuggestionItem({ rank, item, actionLabel, onAction, emptyTeam }: {
  emptyTeam: boolean;
  rank: number;
  item: Suggestion | Replacement;
  actionLabel: string;
  onAction: () => void;
}) {
  const diff = 'diff' in item ? item.diff : null;
  const diffText = diff ? [...diff.gains, ...diff.losses].join(' · ') || 'Nessuna differenza rilevante' : null;
  const setText = exportShowdown([item.set]);
  return (
    <li>
      <details className="suggestion">
        <summary>
          <span>
            <strong>{rank}. {item.species}</strong>
            <small>{diffText ?? item.reasons[0]?.text ?? ''}</small>
            <span className="tags">
              <TierTag species={item.species} />
              {item.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
            </span>
          </span>
          <span className="score" aria-label={`Punteggio ${item.score}`}>{item.score}</span>
        </summary>
        {'similarity' in item && item.similarity !== undefined && (
          <p>Somiglianza: {Math.round(item.similarity * 100)}%</p>
        )}
        <dl className="bars">
          {(emptyTeam ? [] : FIT_BARS).map(bar => (
            <div key={bar.key}>
              <dt>{bar.label}</dt>
              <dd><meter min={0} max={1} value={item.components[bar.key]} /></dd>
            </div>
          ))}
          <div>
            <dt>Statistiche</dt>
            <dd><meter min={0} max={100} value={memberPower(item.set)?.power ?? 0} /></dd>
          </div>
        </dl>
        <ul>{item.reasons.map(reason => <li key={reason.text}>{reason.text}</li>)}</ul>
        <pre className="set">{setText}</pre>
        <div className="actions">
          <button type="button" onClick={onAction}>{actionLabel}</button>
          <button type="button" onClick={() => copyText(setText)}>Copia set</button>
        </div>
      </details>
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

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace }: Props) {
  const [mode, setMode] = useState<ReplaceMode>('improve');
  const [limit, setLimit] = useState(PAGE);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  // La lista si ricalcola sui filtri "stabili"; l'input mostra subito quello che scrivi
  const applied = useDebounced(filters, SEARCH_DELAY);
  const filtering = isFiltering(applied);
  const replacing = replaceIndex !== null && replaceIndex < team.length;
  /** Il team contro cui si valutano i candidati è vuoto: niente adattamento da mostrare. */
  const emptyTeam = (replacing ? team.length - 1 : team.length) === 0;

  const items: (Suggestion | Replacement)[] = useMemo(() => {
    if (replacing) {
      // Con ricerca o filtri i sostituti vengono da tutto il Pokédex, non solo dalle statistiche
      const pool = filtering ? searchPool(team.filter((_, i) => i !== replaceIndex), format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      return mode === 'improve'
        ? improveReplacements(team, replaceIndex, format, data, MAX, pool)
        : similarReplacements(team, replaceIndex, format, data, MAX, pool);
    }
    if (filtering) return searchCandidates(team, format, data, applied, MAX);
    return data.stats ? suggest(team, format, data, MAX) : [];
  }, [team, format, data, replacing, replaceIndex, mode, applied, filtering]);

  /** Invio su un nome esatto: aggiunge (o sostituisce) subito con il set di riferimento. */
  const pickExact = () => {
    const species = getSpecies(filters.query.trim());
    if (!species) return;
    const set = defaultSet(data, species.name);
    if (replacing) onReplaceWith(replaceIndex, set);
    else onAdd(set);
    setFilters({ ...filters, query: '' });
  };

  const title = replacing ? `Sostituisci ${team[replaceIndex].species}` : 'Suggerimenti';

  // Sostituendo un setter di cui altri membri hanno bisogno, si mostrano solo setter della stessa condizione
  let setterNote: string | null = null;
  if (replacing) {
    const needed = neededConditions(team, replaceIndex);
    if (needed.length) {
      const labels = needed.map(n => CONDITION_LABELS[n.condition]).join(' e ');
      const who = [...new Set(needed.flatMap(n => n.beneficiaries.map(b => b.species)))].join(', ');
      setterNote = items.length > 0 && items.every(item => providesAll(item.set, needed))
        ? `Mostro solo chi porta ${labels}: ${who} ne ha bisogno`
        : `Nessun altro Pokémon porta ${labels}: se sostituisci ${team[replaceIndex].species}, ${needed.flatMap(n => n.beneficiaries.map(b => `${b.species} perde ${b.via}`)).join(', ')}`;
    }
  }

  const full = !replacing && team.length >= 6;
  const search = full ? null : (
    <>
      <div className="search">
        <input
          aria-label="Aggiungi Pokémon"
          list="species-list"
          placeholder="Cerca un Pokémon…"
          value={filters.query}
          onChange={e => { setFilters({ ...filters, query: e.target.value }); setLimit(PAGE); }}
          onKeyDown={e => { if (e.key === 'Enter') pickExact(); }}
        />
        <button type="button" onClick={pickExact}>Aggiungi</button>
      </div>
      <FilterBar filters={filters} onChange={next => { setFilters(next); setLimit(PAGE); }} />
    </>
  );

  let body;
  if (full) {
    body = <p>Team completo: usa ⇄ Sostituisci su un membro per cercare alternative.</p>;
  } else if (!data.stats && !filtering) {
    body = <p>Servono i dati Smogon per i suggerimenti. Puoi comunque cercare un Pokémon per nome.</p>;
  } else if (filtering && items.length === 0) {
    body = <p className="note">Nessun Pokémon corrisponde ai filtri</p>;
  } else {
    body = (
      <>
        {filtering && (
          <p className="note">
            {items.length === 1 ? '1 risultato' : `${items.length} risultati`}{items.length === MAX ? ' (i migliori per il team)' : ''}
          </p>
        )}
        {setterNote && <p className="note">{setterNote}</p>}
        {emptyTeam && (
          <p className="note">Aggiungi un Pokémon per vedere come si adatta al team — per ora ordinati per uso nel meta</p>
        )}
        <ol className="suggestions">
          {items.slice(0, limit).map((item, i) => (
            <SuggestionItem
              key={item.species}
              rank={i + 1}
              item={item}
              actionLabel={replacing ? 'Sostituisci con questo' : 'Aggiungi al team'}
              onAction={() => (replacing ? onReplaceWith(replaceIndex, item.set) : onAdd(item.set))}
              emptyTeam={emptyTeam}
            />
          ))}
        </ol>
        {items.length > limit && (
          <button type="button" onClick={() => setLimit(MAX)}>
            Mostra altri ({limit + 1}–{Math.min(MAX, items.length)})
          </button>
        )}
      </>
    );
  }

  return (
    <section aria-label="Suggerimenti">
      <h2>{title}</h2>
      {replacing && (
        <div className="actions" role="group" aria-label="Modalità sostituzione">
          <button type="button" aria-pressed={mode === 'improve'} onClick={() => setMode('improve')}>Migliora team</button>
          <button type="button" aria-pressed={mode === 'similar'} onClick={() => setMode('similar')}>Sostituto simile</button>
          <button type="button" onClick={onCancelReplace}>Annulla</button>
        </div>
      )}
      {search}
      {body}
    </section>
  );
}
