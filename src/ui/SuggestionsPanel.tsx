import { useMemo, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { improveReplacements, similarReplacements, type Replacement } from '../engine/replace';
import { suggest, type Suggestion } from '../engine/scoring';
import { exportShowdown, type TeamSet } from '../engine/sets';
import { memberPower } from '../engine/power';
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
            {item.tags.length > 0 && (
              <span className="tags">{item.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</span>
            )}
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

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace }: Props) {
  const [mode, setMode] = useState<ReplaceMode>('improve');
  const [limit, setLimit] = useState(PAGE);
  const replacing = replaceIndex !== null && replaceIndex < team.length;
  /** Il team contro cui si valutano i candidati è vuoto: niente adattamento da mostrare. */
  const emptyTeam = (replacing ? team.length - 1 : team.length) === 0;

  const items: (Suggestion | Replacement)[] = useMemo(() => {
    if (!data.stats) return [];
    if (replacing) {
      return mode === 'improve'
        ? improveReplacements(team, replaceIndex, format, data, MAX)
        : similarReplacements(team, replaceIndex, format, data, MAX);
    }
    return suggest(team, format, data, MAX);
  }, [team, format, data, replacing, replaceIndex, mode]);

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

  let body;
  if (!data.stats) {
    body = <p>Servono i dati Smogon per i suggerimenti.</p>;
  } else if (!replacing && team.length >= 6) {
    body = <p>Team completo: usa ⇄ Sostituisci su un membro per cercare alternative.</p>;
  } else {
    body = (
      <>
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
      {body}
    </section>
  );
}
