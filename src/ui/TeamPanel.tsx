import type { EngineData } from '../engine/data';
import { battleAbility, battleName, battleSpecies, getSpecies, isMega, isSelectable, withinGen } from '../engine/dex';
import { formatLabel, isBannedIn, meetsTeamRules } from '../engine/formats';
import type { Format } from '../engine/format';
import { detectRoles, roleLabel } from '../engine/roles';
import { presetsFor, type Preset, type TeamSet } from '../engine/sets';
import { useRef, useState } from 'react';
import { useSlant } from './slant';
import { SetEditor } from './SetEditor';
import { commonChoices, type CommonChoices } from '../engine/common';
import { StatsBadge } from './StatsBadge';
import { ItemIcon } from './ItemIcon';
import { AlertMark, type Alert } from './AlertMark';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { Icon } from './icons';
import { illegalParts } from '../engine/learnsets';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onChange: (team: TeamSet[]) => void;
  onAdd: (set: TeamSet) => void;
  onReplace: (index: number) => void;
  onAllowMultipleMegas: () => void;
}

/** Tutti i problemi di legalità del membro (possono essere più d'uno). */
function slotProblems(set: TeamSet, format: Format, lang: Lang): string[] {
  const species = getSpecies(set.species);
  if (!species) return [t(lang, 'team.unknown')];
  const forme = battleSpecies(set) ?? species;
  return [
    !isSelectable(species) || isBannedIn(forme, format) ? t(lang, 'team.notLegal', { format: formatLabel(format, lang) }) : null,
    !meetsTeamRules(forme, format) ? t(lang, 'team.notType', { type: typeName(format.monotype ?? '', lang) }) : null,
    !withinGen(species, format) ? t(lang, 'team.beyondGen', { gen: format.genLimit }) : null,
  ].filter((p): p is string => !!p);
}

function TeamSlot({ set, presets, common, format, warning: megaWarning, open, onToggle, onIgnoreWarning, onChange, onRemove, onReplace }: {
  presets: Preset[];
  common: CommonChoices;
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
  const lang = useLang();
  const tr = useT();
  const card = useRef<HTMLElement>(null);
  useSlant(card);
  const species = battleSpecies(set);
  // Con la megapietra il membro è la Mega: nome e abilità della forma in battaglia (il set resta quello di Showdown)
  const name = battleName(set);
  const ability = battleAbility(set);
  const problems = slotProblems(set, format, lang);
  const roles = detectRoles(set).slice(0, 2).map(role => roleLabel(role, lang));
  const illegal = illegalParts(set, format.genLimit);
  const warnings = [
    megaWarning,
    illegal.moves.length ? tr('team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') }) : null,
    illegal.ability ? tr('team.illegalAbility', { name: gameName('ability', illegal.ability, lang) }) : null,
  ].filter((w): w is string => !!w);
  // Problemi di legalità in rosso, avvisi in giallo: due triangoli distinti sullo sprite, il dettaglio nei tooltip
  const dangers: Alert[] = problems.map(text => ({ level: 'danger', text }));
  const warns: Alert[] = warnings.map(text => ({ level: 'warn', text }));
  return (
    <details
      className={`slot filled${problems.length ? ' invalid' : warnings.length ? ' warn' : ''}`}
      open={open}
      style={{ '--t1': typeColor(species?.types[0] ?? ''), '--t2': typeColor(species?.types[1] ?? species?.types[0] ?? '') } as React.CSSProperties}
      onToggle={e => onToggle(e.currentTarget.open)}
    >
      <summary ref={card}>
        <span className="sprite-wrap">
          <Sprite species={set.species} item={set.item} />
          {(dangers.length > 0 || warns.length > 0) && (
            <span className="sprite-alerts">
              <AlertMark alerts={warns} className="on-sprite" />
              <AlertMark alerts={dangers} className="on-sprite" />
            </span>
          )}
        </span>
        {set.customSkillset && (
          // Non è un problema: piccolo, nell'angolo in alto a sinistra
          <AlertMark icon="unlock" className="slot-custom"
            alerts={[{ level: 'info', text: tr('team.customMark') }]} />
        )}
        <span className="slot-stats"><StatsBadge species={set.species} item={set.item} /></span>
        <button
          type="button"
          className="favorite"
          aria-label={tr('team.favorite', { species: name })}
          aria-pressed={!!set.favorite}
          title={tr(set.favorite ? 'team.favoriteOn' : 'team.favoriteOff')}
          onClick={e => { e.preventDefault(); onChange({ ...set, favorite: !set.favorite }); }}
        >
          <Icon name="star" filled={!!set.favorite} />
        </button>
        <button
          type="button"
          className="remove"
          aria-label={tr('team.remove', { species: name })}
          title={tr('team.removeTitle')}
          onClick={e => { e.preventDefault(); onRemove(); }}
        >
          <Icon name="close" />
        </button>
        <strong className="name">{name}</strong>
        {/* Strumento (con icona) e abilità su due righe: le card restano allineate */}
        <small className="held" title={set.item || undefined}>
          <ItemIcon item={set.item} />
          <span>{set.item ? gameName('item', set.item, lang) : tr('team.noItem')}</span>
        </small>
        <small className="ability" title={ability || undefined}>{ability ? gameName('ability', ability, lang) : '—'}</small>
        <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />) ?? <TypeChip type="?" />}</span>
        {roles.length > 0 && <small className="roles">{roles.join(' · ')}</small>}
      </summary>
      <div className="drawer">
      <SetEditor set={set} presets={presets} common={common} genLimit={format.genLimit} onChange={onChange} />
      <div className="actions">
        <button type="button" aria-label={tr('team.replace', { species: name })} onClick={onReplace}><Icon name="swap" /> {tr('team.replaceButton')}</button>
        {megaWarning && <button type="button" onClick={onIgnoreWarning}>{tr('team.keepMega')}</button>}
      </div>
      </div>
    </details>
  );
}

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace, onAllowMultipleMegas }: Props) {
  const lang = useLang();
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const firstMega = team.findIndex(isMega);
  const warningFor = (set: TeamSet, i: number) =>
    !format.allowMultipleMegas && firstMega !== -1 && i > firstMega && isMega(set) ? t(lang, 'team.secondMega') : null;
  return (
    <section aria-label={t(lang, 'team.region')} className="team">
      <h2>{t(lang, 'team.title', { n: team.length })}</h2>
      <div className="slots">
        {team.map((set, i) => (
          <TeamSlot
            key={`${i}-${set.species}`}
            set={set}
            presets={presetsFor(data, set.species)}
            common={commonChoices(data, set)}
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
            <span>{t(lang, 'team.empty')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
