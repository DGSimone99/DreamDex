import { useMemo } from 'react';
import { dex, getMove, getSpecies, itemNames, moveNames, natureNames } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';
import { Combobox, type ComboOption } from './Combobox';
import { TypeChip } from './Sprite';
import { Icon } from './icons';
import { typeTextColor } from './TypeText';

const STAT_SHORT: Record<string, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
function NatureEffect({ name }: { name: string }) {
  const { plus, minus } = dex.natures.get(name);
  if (!plus || !minus) return <span className="nature-fx neutral">neutra</span>;
  return (
    <span className="nature-fx">
      <span className="up">+{STAT_SHORT[plus]}</span>, <span className="down">−{STAT_SHORT[minus]}</span>
    </span>
  );
}
/** "Modest (+SpA, −Atk)", "Hardy (neutra)" */
const NATURE_OPTIONS: ComboOption[] = natureNames().map(name => {
  const { plus, minus } = dex.natures.get(name);
  return {
    value: name,
    detail: <NatureEffect name={name} />,
    ariaLabel: plus && minus ? `${name} (+${STAT_SHORT[plus]}, −${STAT_SHORT[minus]})` : `${name} (neutra)`,
  };
});
const TERA_OPTIONS: ComboOption[] = [
  { value: '', label: 'Nessuno', ariaLabel: 'Nessuno' },
  ...TYPES.map(type => ({ value: type, content: <TypeChip type={type} />, ariaLabel: type })),
];
const CATEGORY_LABELS: Record<string, string> = { Physical: 'Fisica', Special: 'Speciale', Status: 'Stato' };
const CATEGORY_ICONS = { Physical: 'physical', Special: 'special', Status: 'status' } as const;

/** Descrizioni dei dati di Showdown (in inglese), mostrate al passaggio del mouse. */
const describe = {
  item: (name: string) => (name ? dex.items.get(name) : null)?.shortDesc || undefined,
  ability: (name: string) => (name ? dex.abilities.get(name) : null)?.shortDesc || undefined,
  move: (name: string) => {
    const move = getMove(name);
    return move ? move.shortDesc || move.desc || undefined : undefined;
  },
};

function MoveDetail({ name }: { name: string }) {
  const move = getMove(name);
  if (!move) return null;
  const accuracy = move.accuracy === true ? null : move.accuracy;
  return (
    <span className="move-meta">
      <span className={`move-stat cat-${move.category.toLowerCase()}`} title={CATEGORY_LABELS[move.category]}>
        <Icon name={CATEGORY_ICONS[move.category]} filled={move.category === 'Physical'} />
        <span className="visually-hidden">{CATEGORY_LABELS[move.category]}, potenza </span>
        {move.basePower || '—'}
      </span>
      <span className="move-stat accuracy" title="Precisione">
        <Icon name="target" />
        <span className="visually-hidden">precisione </span>
        {accuracy === null ? '—' : `${accuracy}%`}
      </span>
      <TypeChip type={move.type} />
    </span>
  );
}

// Voci dei menu, calcolate una volta sola
const moveOptionCache = new Map<string, ComboOption>();
function moveOption(name: string): ComboOption {
  let option = moveOptionCache.get(name);
  if (!option) {
    const move = getMove(name);
    option = { value: name, detail: <MoveDetail name={name} />, description: describe.move(name), color: move ? typeTextColor(move.type) : undefined };
    moveOptionCache.set(name, option);
  }
  return option;
}
const ALL_MOVES = moveNames();
const ITEM_OPTIONS: ComboOption[] = itemNames().map(name => ({ value: name, description: describe.item(name) }));
const ALL_ABILITIES = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.name).sort();
const abilityOption = (name: string): ComboOption => ({ value: name, description: describe.ability(name) });

const clampEv = (value: number) => Math.min(252, Math.max(0, Number.isFinite(value) ? value : 0));

interface Props {
  set: TeamSet;
  /** Limite di generazione: mosse e abilità legali fino a questa gen. */
  genLimit: number;
  onChange: (set: TeamSet) => void;
}

const CUSTOM_TOOLTIP = 'Permette qualunque mossa e abilità, anche non imparabili (pensato per le hackrom). Vale solo per questo Pokémon.';

export function SetEditor({ set, genLimit, onChange }: Props) {
  const custom = !!set.customSkillset;
  const species = getSpecies(set.species);
  const standard = legalAbilities(set.species, genLimit)
    ?? (species ? (Object.values(species.abilities).filter(Boolean) as string[]) : []);
  // L'abilità attuale resta visibile anche se non legale (viene segnalata nello slot)
  const abilities = set.ability && !standard.includes(set.ability) ? [set.ability, ...standard] : standard;
  const abilityOptions = useMemo(() => (custom ? ALL_ABILITIES : abilities).map(abilityOption), [custom, abilities.join()]);
  // Mosse proposte: solo quelle imparabili, tranne con Custom Skillset
  const moveOptions = useMemo(() => {
    const legal = custom ? null : legalMoves(set.species, genLimit);
    const names = legal ? [...legal].map(id => getMove(id)?.name ?? id).sort() : ALL_MOVES;
    return names.map(moveOption);
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
      <fieldset className="editor-group">
        <legend>Set</legend>
        <div className="field" data-tip={describe.item(set.item)}>
          <span className="field-head">Strumento</span>
          <Combobox label="Strumento" value={set.item} options={ITEM_OPTIONS} description={describe.item(set.item)}
            onChange={item => update({ item })} />
        </div>
        <div className="field" data-tip={describe.ability(set.ability)}>
          <span className="field-head">Abilità</span>
          <Combobox label="Abilità" value={set.ability} options={abilityOptions} restricted={!custom}
            description={describe.ability(set.ability)} onChange={ability => update({ ability })} />
        </div>
        <div className="field">
          <span className="field-head">Natura</span>
          <Combobox label="Natura" value={set.nature} options={NATURE_OPTIONS} restricted
            display={<><span>{set.nature}</span>{set.nature && <NatureEffect name={set.nature} />}</>}
            onChange={nature => update({ nature })} />
        </div>
        <div className="field">
          <span className="field-head">Tera</span>
          <Combobox label="Tera" value={set.teraType ?? ''} options={TERA_OPTIONS} restricted
            display={set.teraType ? <TypeChip type={set.teraType} /> : <span className="faint">Nessuno</span>}
            onChange={tera => update({ teraType: tera || undefined })} />
        </div>
      </fieldset>
      <fieldset className="editor-group moves">
        <legend>Mosse</legend>
        {moves.map((move, i) => (
          <div key={i} className="field" data-tip={describe.move(move)}>
            <span className="field-head">
              Mossa {i + 1}
              <MoveDetail name={move} />
            </span>
            <Combobox
              label={`Mossa ${i + 1}`}
              value={move}
              options={moveOptions}
              description={describe.move(move)}
              onChange={value => {
                const next = [...moves];
                next[i] = value;
                update({ moves: next });
              }}
            />
          </div>
        ))}
      </fieldset>
      <fieldset className="evs">
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
