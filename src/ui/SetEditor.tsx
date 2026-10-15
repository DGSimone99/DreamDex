import { useId, useMemo } from 'react';
import { getMove, getSpecies, natureNames } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';

const NATURES = natureNames();
const clampEv = (value: number) => Math.min(252, Math.max(0, Number.isFinite(value) ? value : 0));

interface Props {
  set: TeamSet;
  /** Limite di generazione: mosse e abilità legali fino a questa gen. */
  genLimit: number;
  onChange: (set: TeamSet) => void;
}

const CUSTOM_TOOLTIP = 'Permette qualunque mossa e abilità, anche non imparabili (pensato per le hackrom). Vale solo per questo Pokémon.';

export function SetEditor({ set, genLimit, onChange }: Props) {
  const listId = useId();
  const custom = !!set.customSkillset;
  const species = getSpecies(set.species);
  const standard = legalAbilities(set.species, genLimit)
    ?? (species ? (Object.values(species.abilities).filter(Boolean) as string[]) : []);
  // L'abilità attuale resta visibile anche se non legale (viene segnalata nello slot)
  const abilities = set.ability && !standard.includes(set.ability) ? [set.ability, ...standard] : standard;
  // Mosse proposte: solo quelle imparabili, tranne con Custom Skillset
  const moveOptions = useMemo(() => {
    const legal = custom ? null : legalMoves(set.species, genLimit);
    return legal ? [...legal].map(id => getMove(id)?.name ?? id).sort() : null;
  }, [custom, set.species, genLimit]);
  const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
  const update = (patch: Partial<TeamSet>) => onChange({ ...set, ...patch });

  return (
    <div className="set-editor">
      <label className="custom-toggle" title={CUSTOM_TOOLTIP}>
        <input
          type="checkbox"
          aria-label={`Custom Skillset ${set.species}`}
          checked={custom}
          onChange={e => update({ customSkillset: e.target.checked || undefined })}
        />{' '}
        Custom Skillset
      </label>
      <label>
        Strumento
        <input list="item-list" value={set.item} onChange={e => update({ item: e.target.value })} />
      </label>
      <label>
        Abilità
        {custom ? (
          <input list="ability-list" value={set.ability} onChange={e => update({ ability: e.target.value })} />
        ) : (
          <select value={set.ability} onChange={e => update({ ability: e.target.value })}>
            {abilities.map(ability => <option key={ability}>{ability}</option>)}
          </select>
        )}
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
            list={moveOptions ? listId : 'move-list'}
            value={move}
            onChange={e => {
              const next = [...moves];
              next[i] = e.target.value;
              update({ moves: next });
            }}
          />
        </label>
      ))}
      {moveOptions && (
        <datalist id={listId}>{moveOptions.map(name => <option key={name} value={name} />)}</datalist>
      )}
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
