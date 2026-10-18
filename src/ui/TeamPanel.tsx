import type { EngineData } from '../engine/data';
import { bannedTexts } from '../engine/coach';
import { battleAbility, battleName, battleSpecies, getSpecies, isMega, isSelectable, withinGen } from '../engine/dex';
import { formatLabel, isLegalIn, pokedexOf, teraAllowed } from '../engine/formats';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { detectRoles, roleLabel, roleShortLabel } from '../engine/roles';
import { cardRoles, weatherOf } from '../engine/archetype';
import { conditionLabel, viaName } from '../engine/synergy';
import { exportShowdown, presetsForSet, type Preset, type TeamSet } from '../engine/sets';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { copyText } from './clipboard';
import { useSlant } from './slant';
import { SetEditor } from './SetEditor';
import { describe } from './describe';
import { commonChoices, type CommonChoices } from '../engine/common';
import { speedTier, type SpeedTier } from '../engine/speed';
import { StatsBadge } from './StatsBadge';
import { ItemIcon } from './ItemIcon';
import { AlertMark, type Alert } from './AlertMark';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { Icon } from './icons';
import { illegalParts } from '../engine/learnsets';
import { t, type Lang } from '../i18n';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onChange: (team: TeamSet[]) => void;
  onAdd: (set: TeamSet) => void;
  onReplace: (index: number) => void;
  /** Membro tolto con la ×: se manca, si aggiorna solo il team (senza Annulla). */
  onRemove?: (index: number) => void;
  onAllowMultipleMegas: () => void;
  /** Membro aperto nell'editor (null se nessuno). */
  onOpenChange?: (index: number | null) => void;
}

/** Tutti i problemi di legalità del membro (possono essere più d'uno). */
function slotProblems(set: TeamSet, format: Format, lang: Lang): string[] {
  const species = getSpecies(set.species);
  if (!species) return [t(lang, 'team.unknown')];
  const forme = battleSpecies(set) ?? species;
  return [
    !isSelectable(species) || !isLegalIn(forme, format) ? t(lang, 'team.notLegal', { format: formatLabel(format, lang) }) : null,
    !withinGen(species, format) ? t(lang, 'team.beyondGen', { gen: format.genLimit }) : null,
    // Mosse, abilità e strumenti vietati dal formato
    ...bannedTexts(set, format, lang),
  ].filter((p): p is string => !!p);
}

/** Cambio di layout animato (card compatte, editor) con le View Transitions, dove ci sono e il movimento è ammesso. */
function animated(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || still) return update();
  doc.startViewTransition(() => flushSync(update));
}

function TeamSlot({ index, set, presets, common, speed, format, warning: megaWarning, open, dragging, dropTarget, onToggle, onStep, onMove, onDrag, onIgnoreWarning, onChange, onRemove, onReplace }: {
  index: number;
  dragging: boolean;
  dropTarget: boolean;
  /** Alt + frecce: sposta il membro di una posizione. */
  onMove: (delta: number) => void;
  /** Trascinamento: inizio, passaggio sopra, rilascio, fine. */
  onDrag: (phase: 'start' | 'over' | 'drop' | 'end') => void;
  presets: Preset[];
  common: CommonChoices;
  speed: SpeedTier | null;
  set: TeamSet;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Frecce sulla card: apre il membro accanto. */
  onStep: (delta: number) => void;
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
  const [copied, setCopied] = useState(false);
  const problems = slotProblems(set, format, lang);
  // Ruolo principale e un supporto, affiancati con il nome breve (il completo nel tooltip); il meteo solo qui
  const rules = formatRules(format.formatId);
  const shownRoles = cardRoles(set, rules);
  const weather = weatherOf(set);
  const roles = shownRoles.map(role => (role === 'weather' ? tr('card.weather') : roleShortLabel(role, lang)));
  // Nel tooltip tutti i ruoli per esteso: prima i due mostrati, poi gli altri
  const allRoles = [...shownRoles, ...detectRoles(set, rules).filter(role => !shownRoles.includes(role))];
  const rolesTitle = allRoles.map(role => (role === 'weather' && weather
    ? tr('card.weatherTitle', { condition: conditionLabel(weather.condition, lang), via: viaName(weather.via, lang) })
    : role === 'weather' ? tr('card.weather') : roleLabel(role, lang))).join(' · ');
  const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
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
      className={`slot filled${problems.length ? ' invalid' : warnings.length ? ' warn' : ''}${dragging ? ' dragging' : ''}${dropTarget ? ' drop-target' : ''}`}
      open={open}
      style={{ '--t1': typeColor(species?.types[0] ?? ''), '--t2': typeColor(species?.types[1] ?? species?.types[0] ?? ''), '--vt': `slot-${index}` } as React.CSSProperties}
      // Solo se il details cambia da sé (es. ricerca nella pagina): le aperture normali sono già nello stato
      onToggle={e => { if (e.currentTarget.open !== open) onToggle(e.currentTarget.open); }}
      onKeyDown={e => {
        // Esc chiude l'editor e torna sulla card; le frecce sulla card passano al membro accanto
        if (e.key === 'Escape' && open) { e.preventDefault(); onToggle(false); card.current?.focus(); }
        else if (e.target === card.current && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault();
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          if (e.altKey) onMove(delta); else onStep(delta);
        }
      }}
    >
      <summary
        ref={card}
        draggable
        title={tr('team.dragTitle')}
        // Apertura e chiusura passano dall'animazione: il clic non apre da solo il details
        onClick={e => { e.preventDefault(); onToggle(!open); }}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); onDrag('start'); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDrag('over'); }}
        onDrop={e => { e.preventDefault(); onDrag('drop'); }}
        onDragEnd={() => onDrag('end')}
      >
        <span className="sprite-wrap">
          <Sprite species={set.species} item={set.item} animated={open} />
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
        <small className="held" title={describe.item(set.item, lang)}>
          <ItemIcon item={set.item} />
          <span>{set.item ? gameName('item', set.item, lang) : tr('team.noItem')}</span>
        </small>
        <small className="ability" title={describe.ability(ability, lang)}>{ability ? gameName('ability', ability, lang) : '—'}</small>
        <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />) ?? <TypeChip type="?" />}</span>
        {roles.length > 0 && <small className="roles" title={rolesTitle}>{roles.join(' · ')}</small>}
      </summary>
      <div className="drawer">
      <SetEditor set={set} presets={presets} common={common} genLimit={format.genLimit} pokedex={pokedexOf(format)}
        teraBannedIn={teraAllowed(format) ? undefined : formatLabel(format, lang)} speed={speed} onChange={onChange}
        title={open && (
          // Solo visivo: nome e tipi li annuncia già la card (il nome via CSS, così non è un secondo testo uguale)
          <div className="editor-title" aria-hidden="true">
            <strong data-name={name} />
            <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />)}</span>
          </div>
        )}
        actions={<>
          {megaWarning && <button type="button" onClick={onIgnoreWarning}>{tr('team.keepMega')}</button>}
          <button type="button" aria-label={tr('team.copySet')} title={tr('team.copySet')} onClick={async () => {
            if (await copyText(exportShowdown([set], { tera: teraAllowed(format) }))) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
          }}><Icon name={copied ? 'check' : 'copy'} /> <span className="btn-label">{tr(copied ? 'team.copied' : 'team.copySet')}</span></button>
          <button type="button" aria-label={tr('team.replace', { species: name })} title={tr('team.replaceButton')} onClick={onReplace}><Icon name="swap" /> <span className="btn-label">{tr('team.replaceButton')}</span></button>
        </>} />
      </div>
    </details>
  );
}

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace, onRemove, onAllowMultipleMegas, onOpenChange }: Props) {
  const lang = useLang();
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useEffect(() => { onOpenChange?.(openIndex); }, [openIndex]);
  const slotsRef = useRef<HTMLDivElement>(null);
  const focusCard = (i: number) => requestAnimationFrame(() => slotsRef.current?.querySelectorAll<HTMLElement>('.slot > summary')[i]?.focus());
  const step = (from: number, delta: number) => {
    const to = (from + delta + team.length) % team.length;
    if (openIndex !== null) animated(() => setOpenIndex(to));
    focusCard(to);
  };
  // Riordino: trascinando o con Alt + frecce; il membro aperto resta aperto nella nuova posizione
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= team.length || to === from) return;
    const next = [...team];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const follow = (i: number | null) => (i === null ? null : i === from ? to : from < i && i <= to ? i - 1 : to <= i && i < from ? i + 1 : i);
    animated(() => { onChange(next); setOpenIndex(follow); });
    focusCard(to);
  };
  // Chiave stabile per specie (e occorrenza): riordinando, le card non si ricreano
  const keys = team.map((set, i) => `${set.species}#${team.slice(0, i).filter(s => s.species === set.species).length}`);
  const firstMega = team.findIndex(isMega);
  const warningFor = (set: TeamSet, i: number) =>
    !format.allowMultipleMegas && firstMega !== -1 && i > firstMega && isMega(set) ? t(lang, 'team.secondMega') : null;
  return (
    <section aria-label={t(lang, 'team.region')} className="team">
      <h2>{t(lang, 'team.title', { n: team.length })}</h2>
      <div className={`slots${openIndex !== null ? ' editing' : ''}`} ref={slotsRef}>
        {team.map((set, i) => (
          <TeamSlot
            key={keys[i]}
            index={i}
            set={set}
            dragging={drag?.from === i}
            dropTarget={drag !== null && drag.over === i && drag.from !== i}
            onMove={delta => move(i, i + delta)}
            onDrag={phase => {
              if (phase === 'start') setDrag({ from: i, over: null });
              else if (phase === 'over') setDrag(d => (d && d.over !== i ? { ...d, over: i } : d));
              else if (phase === 'drop') { if (drag) move(drag.from, i); setDrag(null); }
              else setDrag(null);
            }}
            presets={presetsForSet(data, set)}
            common={commonChoices(data, set)}
            speed={speedTier(set, data)}
            format={format}
            warning={warningFor(set, i)}
            open={openIndex === i}
            onToggle={open => animated(() => setOpenIndex(current => (open ? i : current === i ? null : current)))}
            onStep={delta => step(i, delta)}
            onIgnoreWarning={onAllowMultipleMegas}
            onChange={next => onChange(team.map((s, j) => (j === i ? next : s)))}
            onRemove={() => { setOpenIndex(null); if (onRemove) onRemove(i); else onChange(team.filter((_, j) => j !== i)); }}
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
