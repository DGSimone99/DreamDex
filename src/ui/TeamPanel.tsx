import type { EngineData } from '../engine/data';
import { battleSpecies, getSpecies, isMega, isSelectable, withinGen } from '../engine/dex';
import { formatLabel, isBannedIn, meetsTeamRules } from '../engine/formats';
import type { Format } from '../engine/format';
import { detectRoles, ROLE_LABELS } from '../engine/roles';
import type { TeamSet } from '../engine/sets';
import { useState } from 'react';
import { SetEditor } from './SetEditor';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { Icon } from './icons';
import { illegalParts } from '../engine/learnsets';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onChange: (team: TeamSet[]) => void;
  onAdd: (set: TeamSet) => void;
  onReplace: (index: number) => void;
  onAllowMultipleMegas: () => void;
}

function slotProblem(set: TeamSet, format: Format): string | null {
  const species = getSpecies(set.species);
  if (!species) return 'Pokémon sconosciuto';
  const forme = battleSpecies(set) ?? species;
  if (!isSelectable(species) || isBannedIn(forme, format)) return `Non legale in ${formatLabel(format)}`;
  if (!meetsTeamRules(forme, format)) return `Non è di tipo ${format.monotype}`;
  if (!withinGen(species, format)) return `Oltre la Gen ${format.genLimit}`;
  return null;
}

const MEGA_WARNING = 'Seconda Mega: in National Dex ne è ammessa una sola';

function TeamSlot({ set, format, warning: megaWarning, open, onToggle, onIgnoreWarning, onChange, onRemove, onReplace }: {
  set: TeamSet;
  open: boolean;
  onToggle: (open: boolean) => void;
  format: Format;
  warning: string | null;
  onIgnoreWarning: () => void;
  onChange: (set: TeamSet) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const species = battleSpecies(set);
  const problem = slotProblem(set, format);
  const roles = detectRoles(set).slice(0, 2).map(role => ROLE_LABELS[role]);
  const illegal = illegalParts(set, format.genLimit);
  const warnings = [
    megaWarning,
    illegal.moves.length ? `Mosse non legali: ${illegal.moves.join(', ')}` : null,
    illegal.ability ? `Abilità non legale: ${illegal.ability}` : null,
  ].filter((w): w is string => !!w);
  return (
    <details
      className={`slot filled${problem ? ' invalid' : warnings.length ? ' warn' : ''}`}
      open={open}
      style={{ '--t1': typeColor(species?.types[0] ?? ''), '--t2': typeColor(species?.types[1] ?? species?.types[0] ?? '') } as React.CSSProperties}
      onToggle={e => onToggle(e.currentTarget.open)}
    >
      <summary>
        <Sprite species={set.species} item={set.item} />
        <button
          type="button"
          className="favorite"
          aria-label={`Preferito ${set.species}`}
          aria-pressed={!!set.favorite}
          title={set.favorite ? 'Preferito: il coaching non ne suggerisce la sostituzione' : 'Segna come preferito'}
          onClick={e => { e.preventDefault(); onChange({ ...set, favorite: !set.favorite }); }}
        >
          <Icon name="star" filled={!!set.favorite} />
        </button>
        <button
          type="button"
          className="remove"
          aria-label={`Rimuovi ${set.species}`}
          title="Rimuovi dal team"
          onClick={e => { e.preventDefault(); onRemove(); }}
        >
          <Icon name="close" />
        </button>
        <strong className="name">{set.species}</strong>
        <small className="held">{[set.item, set.ability].filter(Boolean).join(' · ') || 'Nessuno strumento'}</small>
        <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />) ?? <TypeChip type="?" />}</span>
        {roles.length > 0 && <small className="roles">{roles.join(' · ')}</small>}
        {problem && <small className="problem">{problem}</small>}
        {set.customSkillset && <small className="custom">Custom</small>}
        {warnings.map(w => <small key={w} className="warning">{w}</small>)}
      </summary>
      <div className="drawer">
      <SetEditor set={set} genLimit={format.genLimit} onChange={onChange} />
      <div className="actions">
        <button type="button" aria-label={`Sostituisci ${set.species}`} onClick={onReplace}><Icon name="swap" /> Sostituisci</button>
        {megaWarning && <button type="button" onClick={onIgnoreWarning}>Lo so, tengo un'altra Mega</button>}
      </div>
      </div>
    </details>
  );
}

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace, onAllowMultipleMegas }: Props) {
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const firstMega = team.findIndex(isMega);
  const warningFor = (set: TeamSet, i: number) =>
    !format.allowMultipleMegas && firstMega !== -1 && i > firstMega && isMega(set) ? MEGA_WARNING : null;
  return (
    <section aria-label="Team" className="team">
      <h2>Team ({team.length}/6)</h2>
      <div className="slots">
        {team.map((set, i) => (
          <TeamSlot
            key={`${i}-${set.species}`}
            set={set}
            format={format}
            warning={warningFor(set, i)}
            open={openIndex === i}
            onToggle={open => setOpenIndex(current => (open ? i : current === i ? null : current))}
            onIgnoreWarning={onAllowMultipleMegas}
            onChange={next => onChange(team.map((s, j) => (j === i ? next : s)))}
            onRemove={() => { setOpenIndex(null); onChange(team.filter((_, j) => j !== i)); }}
            onReplace={() => onReplace(i)}
          />
        ))}
        {Array.from({ length: 6 - team.length }, (_, i) => (
          <div className="slot empty" key={`empty-${i}`}>
            <span className="sprite missing" aria-hidden="true" />
            <span>Posto libero</span>
          </div>
        ))}
      </div>
    </section>
  );
}
