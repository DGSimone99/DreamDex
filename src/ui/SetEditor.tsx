import { getSpecies, natureNames } from '../engine/dex';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';

const NATURES = natureNames();
const clampEv = (value: number) => Math.min(252, Math.max(0, Number.isFinite(value) ? value : 0));

interface Props {
  set: TeamSet;
  onChange: (set: TeamSet) => void;
}

export function SetEditor({ set, onChange }: Props) {
  const species = getSpecies(set.species);
  const standard = species ? (Object.values(species.abilities).filter(Boolean) as string[]) : [];
  // Abilità fuori dalla lista ufficiale (hackrom, import): restano visibili e selezionate
  const abilities = set.ability && !standard.includes(set.ability) ? [set.ability, ...standard] : standard;
  const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
  const update = (patch: Partial<TeamSet>) => onChange({ ...set, ...patch });

  return (
    <div className="set-editor">
      <label>
        Strumento
        <input list="item-list" value={set.item} onChange={e => update({ item: e.target.value })} />
      </label>
      <label>
        Abilità
        <select value={set.ability} onChange={e => update({ ability: e.target.value })}>
          {abilities.map(ability => <option key={ability}>{ability}</option>)}
        </select>
      </label>
      <label>
        Natura
        <select value={set.nature} onChange={e => update({ nature: e.target.value })}>
          {NATURES.map(nature => <option key={nature}>{nature}</option>)}
        </select>
      </label>
      <label>
        Tera
        <select value={set.teraType ?? ''} onChange={e => update({ teraType: e.target.value || undefined })}>
          <option value="">—</option>
          {TYPES.map(type => <option key={type}>{type}</option>)}
        </select>
      </label>
      {moves.map((move, i) => (
        <label key={i}>
          Mossa {i + 1}
          <input
            list="move-list"
            value={move}
            onChange={e => {
              const next = [...moves];
              next[i] = e.target.value;
              update({ moves: next });
            }}
          />
        </label>
      ))}
      <fieldset>
        <legend>EV</legend>
        {STAT_IDS.map(stat => (
          <label key={stat}>
            {stat.toUpperCase()}
            <input
              type="number"
              min={0}
              max={252}
              step={4}
              value={set.evs[stat] ?? 0}
              onChange={e => update({ evs: { ...set.evs, [stat]: clampEv(Number(e.target.value)) } })}
            />
          </label>
        ))}
      </fieldset>
    </div>
  );
}
