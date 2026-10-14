import { useState } from 'react';
import type { EngineData } from '../engine/data';
import { battleSpecies, getSpecies, isLegal, withinGen } from '../engine/dex';
import type { Format } from '../engine/format';
import { detectRoles, ROLE_LABELS } from '../engine/roles';
import { defaultSet, type TeamSet } from '../engine/sets';
import { SetEditor } from './SetEditor';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onChange: (team: TeamSet[]) => void;
  onAdd: (set: TeamSet) => void;
  onReplace: (index: number) => void;
}

function slotProblem(set: TeamSet, format: Format): string | null {
  const species = getSpecies(set.species);
  if (!species) return 'Pokémon sconosciuto';
  if (!isLegal(species)) return 'Non legale in National Dex OU';
  if (!withinGen(species, format)) return `Oltre la Gen ${format.genLimit}`;
  return null;
}

function TeamSlot({ set, format, onChange, onRemove, onReplace }: {
  set: TeamSet;
  format: Format;
  onChange: (set: TeamSet) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const species = battleSpecies(set);
  const problem = slotProblem(set, format);
  const roles = detectRoles(set).slice(0, 2).map(role => ROLE_LABELS[role]);
  return (
    <details className={`slot filled${problem ? ' invalid' : ''}`}>
      <summary>
        <strong>{set.species}</strong>
        <small>{species?.types.join('/') ?? '?'}{roles.length ? ` · ${roles.join(', ')}` : ''}</small>
        {problem && <small className="problem">{problem}</small>}
      </summary>
      <SetEditor set={set} onChange={onChange} />
      <div className="actions">
        <button type="button" aria-label={`Sostituisci ${set.species}`} onClick={onReplace}>⇄ Sostituisci</button>
        <button type="button" aria-label={`Rimuovi ${set.species}`} onClick={onRemove}>✕ Rimuovi</button>
      </div>
    </details>
  );
}

function SpeciesSearch({ onSelect }: { onSelect: (name: string) => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const species = getSpecies(value.trim());
    if (!species) return;
    onSelect(species.name);
    setValue('');
  };
  return (
    <div className="search">
      <input
        aria-label="Aggiungi Pokémon"
        list="species-list"
        placeholder="Cerca un Pokémon…"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      <button type="button" onClick={submit}>Aggiungi</button>
    </div>
  );
}

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace }: Props) {
  return (
    <section aria-label="Team">
      <h2>Team ({team.length}/6)</h2>
      <div className="slots">
        {team.map((set, i) => (
          <TeamSlot
            key={`${i}-${set.species}`}
            set={set}
            format={format}
            onChange={next => onChange(team.map((s, j) => (j === i ? next : s)))}
            onRemove={() => onChange(team.filter((_, j) => j !== i))}
            onReplace={() => onReplace(i)}
          />
        ))}
        {Array.from({ length: 6 - team.length }, (_, i) => (
          <div className="slot empty" key={`empty-${i}`}>vuoto</div>
        ))}
      </div>
      {team.length < 6 && <SpeciesSearch onSelect={name => onAdd(defaultSet(data, name))} />}
    </section>
  );
}
