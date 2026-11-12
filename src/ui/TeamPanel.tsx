import type { EngineData } from '../engine/data';
import { bannedTexts } from '../engine/coach';
import { battleAbility, battleName, battleSpecies, getSpecies, isMega, isSelectable, withinGen } from '../engine/dex';
import { formatLabel, illegalReason, pokedexOf, teraAllowed } from '../engine/formats';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { detectRoles, roleLabel } from '../engine/roles';
import { cardRoles, weatherOf } from '../engine/archetype';
import { measuredSubRoles, rolesList, type SubRoleValues } from '../engine/subRoles';
import { conditionLabel, viaName } from '../engine/synergy';
import { exportShowdown, importShowdown, presetsForSet, type Preset, type TeamSet } from '../engine/sets';
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { copyText } from './clipboard';
import { setEditing } from './editing';
import { bestPreset } from '../engine/bestPreset';
import { ImproveSetsDialog } from './ImproveSetsDialog';
import { ImportDialog } from './ImportDialog';
import { reviewImport, type ImportReview } from './importReview';
import { FillPanel } from './FillPanel';
import { SetEditor } from './SetEditor';
import { PokemonIcon } from './PokemonName';
import { describe } from './describe';
import { commonChoices, type CommonChoices } from '../engine/common';
import { speedTier, type SpeedTier } from '../engine/speed';
import { ItemIcon } from './ItemIcon';
import { useNameEm } from './nameWidth';
import { AlertMark, type Alert } from './AlertMark';
import { lockedStatusMoves } from '../engine/lockedMoves';
import { duplicateSpecies, missingFormeItem } from '../engine/legalTeam';
import { EV_TOTAL, evTotal } from '../engine/statCalc';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { gainText } from './CoachingView';
import { SMALL, useBackClose } from './useBackClose';
import { Icon } from './icons';
import { useFitCount } from './useFit';
import { typeIconUrl } from './typeIcons';
import { SmogonLink } from './SmogonLink';
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
  /** Membro tolto con la ×: se manca, si aggiorna solo il team (senza Annulla). */
  onRemove?: (index: number) => void;
  onAllowMultipleMegas: () => void;
  /** Membro aperto nell'editor (null se nessuno). */
  onOpenChange?: (index: number | null) => void;
  /** Ogni cambio chiude l'editor aperto (es. si sceglie una sezione nella barra laterale). */
  closeSignal?: number;
  /** Team compresso: ogni carta diventa la sola icona del box (con il puntino degli avvisi). */
  collapsed?: boolean;
  /** Set incollato al posto del membro (può essere un altro Pokémon); se manca, si aggiorna solo il team. */
  onPaste?: (index: number, set: TeamSet) => void;
  /** Azioni sull'intero team, annullabili: preset migliori per tutti, svuota team. */
  onBulk?: (kind: 'presets' | 'fill' | 'clear', team: TeamSet[]) => void;
  /** Clic su uno slot vuoto: porta alla ricerca dei Pokémon. */
  onAddClick?: () => void;
  /** Importa / Esporta: a destra nella testata, prima di Svuota team. */
  io?: ReactNode;
  /** Team salvati: subito dopo la targa del team (scegliere quale team si guarda). */
  saved?: ReactNode;
  /** Proposta di mossa del coach: a ogni nonce nuovo apre l'editor del membro e la mostra con Applica / Annulla. */
  proposal?: MoveProposal | null;
  /** Proposta chiusa: applicata (true) o annullata (false). */
  onProposalDone?: (applied: boolean) => void;
}

export interface MoveProposal { index: number; slot: number; from: string; to: string; gain: number; nonce: number }

/** Tutti i problemi di legalità del membro (possono essere più d'uno). */
function slotProblems(set: TeamSet, format: Format, lang: Lang): string[] {
  const species = getSpecies(set.species);
  if (!species) return [t(lang, 'team.unknown')];
  const forme = battleSpecies(set) ?? species;
  // La regola, non solo "non legale": il tier vietato, il ban per nome o il Pokédex del formato
  const reason = !isSelectable(species) ? { kind: 'notSelectable' as const } : illegalReason(forme, format);
  const where = formatLabel(format, lang);
  return [
    reason?.kind === 'tier' ? t(lang, 'team.notLegalTier', { species: forme.name, tier: reason.tier, format: where })
      : reason?.kind === 'banned' ? t(lang, 'team.notLegalBanned', { species: forme.name, format: where })
      : reason?.kind === 'notInPokedex' ? t(lang, 'team.notInPokedex', { species: forme.name, format: where })
      : reason ? t(lang, 'team.notLegal', { format: where }) : null,
    !withinGen(species, format) ? t(lang, 'team.beyondGen', { gen: format.genLimit }) : null,
    // Mosse, abilità e strumenti vietati dal formato
    ...bannedTexts(set, format, lang),
    // EV oltre il massimo: il voto è bloccato
    evTotal(set.evs) > EV_TOTAL ? t(lang, 'team.evOver', { n: evTotal(set.evs) }) : null,
  ].filter((p): p is string => !!p);
}

/**
 * Disegno senza scheda grafica (accelerazione hardware spenta): Chrome ripiega su un renderer software
 * (SwiftShader, llvmpipe) o non offre WebGL. Le View Transitions lì scattano, quindi si saltano.
 */
let software: boolean | undefined;
function softwareRendering(): boolean {
  if (software !== undefined) return software;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return (software = true);
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    software = true;
  }
  return software;
}

/** Cambio di layout animato (card compatte, editor) con le View Transitions, dove ci sono, la grafica regge e il movimento è ammesso. */
function animated(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || still || softwareRendering()) return update();
  doc.startViewTransition(() => flushSync(update));
}

/**
 * Editor dei membri chiusi: resta nella pagina ma non si ridisegna finché il set non cambia,
 * così aprire e chiudere una card non ricalcola gli altri cinque editor.
 */
const IdleSetEditor = memo(
  (props: ComponentProps<typeof SetEditor> & { idle: boolean; idleKey: string }) => <SetEditor {...props} />,
  (a, b) => a.idle && b.idle && a.idleKey === b.idleKey && a.set === b.set && a.presets === b.presets && a.common === b.common
    && a.speed === b.speed && a.genLimit === b.genLimit && a.pokedex === b.pokedex && a.teraBannedIn === b.teraBannedIn,
);

/**
 * Azioni delle carte, una volta sola per tutto il team (prendono la posizione del membro): restano le stesse
 * a ogni disegno, così una carta si ridisegna solo quando cambia qualcosa di suo (memo).
 */
interface SlotActions {
  toggle: (index: number, open: boolean) => void;
  /** Frecce sulla card: apre il membro accanto. */
  step: (index: number, delta: number) => void;
  /** Alt + frecce: sposta il membro di una posizione. */
  move: (index: number, delta: number) => void;
  /** Trascinamento: inizio, passaggio sopra, rilascio, fine. */
  drag: (index: number, phase: 'start' | 'over' | 'drop' | 'end') => void;
  /** Set incollato; `review`: mosse non imparabili o nomi non trovati, da chiedere/dire dopo averlo applicato. */
  paste: (index: number, set: TeamSet, review?: ImportReview) => void;
  /** Preset con il voto del team più alto per questo membro (null se il membro non ne ha). */
  best: (index: number) => TeamSet | null;
  ignoreWarning: () => void;
  change: (index: number, set: TeamSet) => void;
  remove: (index: number) => void;
  replace: (index: number) => void;
  proposalDone: (applied: boolean) => void;
}

const TeamSlot = memo(function TeamSlot({ index, total, set, subRoles, proposal, data, format, warning: megaWarning, repeated = false, open, dragging, dropTarget, actions }: {
  index: number;
  /** Membri nel team: la carta dice la sua posizione ("posizione 2 di 6"). */
  total: number;
  /** Proposta di mossa per questo membro (si mostra solo con il suo editor aperto). */
  proposal?: MoveProposal | null;
  /** Sotto-ruoli misurati del membro nel team (gli stessi del voto, già in cache): la carta li mostra. */
  subRoles?: SubRoleValues;
  dragging: boolean;
  dropTarget: boolean;
  data: EngineData;
  set: TeamSet;
  open: boolean;
  format: Format;
  warning: string | null;
  /** La specie c'è già prima nel team (Species Clause): problema rosso, voto bloccato. */
  repeated?: boolean;
  actions: SlotActions;
}) {
  const onToggle = (next: boolean) => actions.toggle(index, next);
  const onStep = (delta: number) => actions.step(index, delta);
  const onMove = (delta: number) => actions.move(index, delta);
  const onDrag = (phase: 'start' | 'over' | 'drop' | 'end') => actions.drag(index, phase);
  const onPaste = (next: TeamSet, review?: ImportReview) => actions.paste(index, next, review);
  const onBest = () => actions.best(index);
  const onIgnoreWarning = actions.ignoreWarning;
  const onChange = (next: TeamSet) => actions.change(index, next);
  const onRemove = () => actions.remove(index);
  const onReplace = () => actions.replace(index);
  const onProposalDone = actions.proposalDone;
  const lang = useLang();
  const tr = useT();
  const card = useRef<HTMLButtonElement>(null);
  const drawerId = useId();
  // Una proposta del coach apre l'editor: il fuoco va su Applica (l'azione che si cerca)
  const applyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open && proposal) applyRef.current?.focus(); }, [open, proposal?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // Calcoli del membro (il confronto di Velocità prova 40 rivali): solo quando cambia il set
  // Preset resi legali fino al limite di generazione: menu e Preset migliore propongono lo stesso set
  const presets = useMemo<Preset[]>(() => presetsForSet(data, set, format.genLimit), [data, set, format.genLimit]);
  const common = useMemo<CommonChoices>(() => commonChoices(data, set), [data, set]);
  const speed = useMemo<SpeedTier | null>(() => speedTier(set, data), [data, set]);
  // Gestori sempre aggiornati anche dentro l'editor memorizzato
  const live = useRef({ onChange, onReplace, onPaste, onIgnoreWarning, onBest });
  live.current = { onChange, onReplace, onPaste, onIgnoreWarning, onBest };
  const stable = useMemo(() => ({
    onChange: (next: TeamSet) => live.current.onChange(next),
    onReplace: () => live.current.onReplace(),
    onPaste: (next: TeamSet, review?: ImportReview) => live.current.onPaste(next, review),
    onIgnoreWarning: () => live.current.onIgnoreWarning(),
    onBest: () => live.current.onBest(),
  }), []);
  // Esito del pulsante Preset migliore, per un attimo: applicato o era già quello
  const [best, setBest] = useState<'applied' | 'same' | null>(null);
  const applyBest = () => {
    const next = stable.onBest();
    if (!next) return;
    const same = JSON.stringify(next) === JSON.stringify(set);
    if (!same) stable.onChange(next);
    setBest(same ? 'same' : 'applied');
    setTimeout(() => setBest(null), 1600);
  };
  const species = battleSpecies(set);
  // Con la megapietra il membro è la Mega: nome e abilità della forma in battaglia (il set resta quello di Showdown)
  const name = battleName(set);
  // Tipi: due chip col nome se entrano nella carta, sennò le icone tonde dei tipi (il nome nel tooltip e per i lettori)
  const typeList = species?.types ?? ['?'];
  const typesRef = useRef<HTMLSpanElement>(null);
  const typeText = useFitCount(typesRef, 1, `${lang}|${typeList.join('/')}`, undefined, true) > 0;
  // Nome: va a capo solo agli spazi e ai trattini; la larghezza vera della parte più lunga (in em) decide se e quanto si
  // rimpicciolisce (CSS --name-em)
  const shownName = set.name || name;
  const nameEm = useNameEm(shownName);
  const ability = battleAbility(set);
  const [copied, setCopied] = useState(false);
  // Soprannome: si scrive cliccando il nome nell'editor; vuoto = il nome della specie
  const [naming, setNaming] = useState(false);
  const commitName = (value: string) => {
    setNaming(false);
    const next = value.trim();
    if (next !== (set.name ?? '')) stable.onChange({ ...set, name: next || undefined });
  };
  // Incolla set: testo Showdown di un solo membro, applicato per intero
  // `blocked`: cosa ferma l'incolla (detto in una finestra); il testo resta nel riquadro da correggere
  const [paste, setPaste] = useState<{ text: string; original: string; blocked: ImportReview | null } | null>(null);
  const pasteArea = useRef<HTMLTextAreaElement>(null);
  // Importa / Esporta: il riquadro si apre sotto il pulsante e si chiude cliccando fuori
  const ioRef = useRef<HTMLSpanElement>(null);
  const ioOpen = !!paste;
  useEffect(() => {
    if (!ioOpen) return;
    // Un testo già modificato non si butta con un clic fuori: si chiude solo con Annulla o Esc
    const away = (e: PointerEvent) => { if (!ioRef.current?.contains(e.target as Node)) setPaste(p => (p && p.text !== p.original ? p : null)); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [ioOpen]);
  const applyPaste = () => {
    if (!paste) return;
    const result = importShowdown(paste.text, lang);
    const review = reviewImport(result, format, lang, { single: true });
    if (review.blocking.length) { setPaste({ ...paste, blocked: review }); return; }
    setPaste(null);
    stable.onPaste({ ...result.sets[0], favorite: set.favorite }, review.skill.length || review.info.length ? review : undefined);
  };
  const problems = [...slotProblems(set, format, lang), ...(repeated ? [tr('team.duplicateSpecies')] : [])];
  // Ruolo principale e un supporto, affiancati con il nome breve (il completo nel tooltip); il meteo solo qui
  const rules = formatRules(format.formatId);
  const shownRoles = cardRoles(set, rules, subRoles);
  const weather = weatherOf(set);
  const roles = shownRoles.map(role => (role === 'weather' ? tr('card.weather') : roleLabel(role, lang)));
  // Nel tooltip tutti i ruoli per esteso: prima i due mostrati, poi gli altri
  const allRoles = [...shownRoles, ...(subRoles ? rolesList(subRoles) : detectRoles(set, rules)).filter(role => !shownRoles.includes(role))];
  const roleLabels = allRoles.map(role => (role === 'weather' && weather
    ? tr('card.weatherTitle', { condition: conditionLabel(weather.condition, lang), via: viaName(weather.via, lang) })
    : role === 'weather' ? tr('card.weather') : roleLabel(role, lang)));
  const rolesTitle = roleLabels.join(' · ');
  const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
  // Choice o Assault Vest con mosse di stato: non si usano (anche un malus nel voto)
  const locked = lockedStatusMoves(set);
  const missing = missingFormeItem(set);
  const illegalMovesText = illegal.moves.length ? tr('team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') }) : null;
  const illegalAbilityText = illegal.ability ? tr('team.illegalAbility', { name: gameName('ability', illegal.ability, lang) }) : null;
  const warnings = [
    megaWarning,
    // Forma senza il suo strumento (Zacian-Crowned senza Rusted Sword): il voto la conta come la forma base
    missing ? tr('team.formeItem', { item: gameName('item', missing.item, lang), base: missing.base.name }) : null,
    illegalMovesText,
    illegalAbilityText,
    locked.length ? tr('team.lockedStatus', { item: gameName('item', set.item, lang), moves: locked.map(m => gameName('move', m, lang)).join(', ') }) : null,
  ].filter((w): w is string => !!w);
  // Problemi di legalità in rosso, avvisi in giallo: due triangoli distinti sullo sprite, il dettaglio nei tooltip
  const dangers: Alert[] = problems.map(text => ({ level: 'danger', text }));
  // Mosse o abilità non legali: come risolvere sta nel tooltip della riga, non nel testo
  const hint = (text: string) => (text === illegalMovesText ? tr('team.illegalMovesHint') : text === illegalAbilityText ? tr('team.illegalAbilityHint') : undefined);
  const warns: Alert[] = warnings.map(text => ({ level: 'warn', text, title: hint(text) }));
  return (
    // La carta non è un <details>: il clic apre l'editor (stato del team), e stella, × e avvisi stanno accanto al
    // pulsante della carta, non dentro (niente controlli dentro un altro controllo)
    <div
      className={`slot filled${open ? ' open' : ''}${problems.length ? ' invalid' : warnings.length ? ' warn' : ''}${dragging ? ' dragging' : ''}${dropTarget ? ' drop-target' : ''}`}
      style={{ '--t1': typeColor(species?.types[0] ?? ''), '--t2': typeColor(species?.types[1] ?? species?.types[0] ?? ''), '--vt': `slot-${index}` } as React.CSSProperties}
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
      <div
        className="slot-card"
        draggable
        title={tr('team.dragTitle')}
        // Clic su tutta la carta (il pulsante della carta lo prende da tastiera e dai lettori di schermo)
        onClick={e => {
          // Stella, × e avvisi: i loro clic non aprono né chiudono l'editor
          const hit = (e.target as HTMLElement).closest('button, a, input, [tabindex]');
          if (hit && hit !== card.current) return;
          onToggle(!open);
          // Come prima col <summary>: dopo il clic il fuoco è sulla carta (Esc e frecce partono da lì), senza anello
          card.current?.focus({ preventScroll: true, focusVisible: false });
        }}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); onDrag('start'); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDrag('over'); }}
        onDrop={e => { e.preventDefault(); onDrag('drop'); }}
        onDragEnd={() => onDrag('end')}
      >
        <button
          type="button"
          className="slot-toggle"
          ref={card}
          aria-expanded={open}
          aria-controls={drawerId}
          // Un nome breve per la carta: nome, lead, tipi, strumento, problemi, posizione
          aria-label={[
            set.name ? `${set.name} (${name})` : name,
            index === 0 ? tr('team.lead') : null,
            species?.types.map(type => typeName(type, lang)).join('/'),
            set.item ? gameName('item', set.item, lang) : tr('team.noItem'),
            problems.length ? tr(problems.length === 1 ? 'team.cardProblem' : 'team.cardProblems', { n: problems.length }) : null,
            warnings.length ? tr(warnings.length === 1 ? 'team.cardWarning' : 'team.cardWarnings', { n: warnings.length }) : null,
            tr('team.position', { n: index + 1, total }),
          ].filter(Boolean).join(', ')}
          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
          title={tr('team.dragTitle')}
        />
        {/* Team compresso: solo l'icona del box, con un puntino se c'è un problema o un avviso */}
        <span className="mini-icon" aria-hidden="true">
          <PokemonIcon name={name} />
          {(dangers.length > 0 || warns.length > 0) && (
            <span className={`mini-alert ${dangers.length ? 'danger' : 'warn'}`} title={[...dangers, ...warns].map(a => a.text).join(' · ')}>
              <span className="visually-hidden">{tr(dangers.length ? 'alert.danger' : 'alert.warn')}</span>
            </span>
          )}
        </span>
        <span className="sprite-wrap">
          <Sprite species={set.species} item={set.item} animated={open} shiny={!!set.shiny} />
          {(dangers.length > 0 || warns.length > 0) && (
            <span className="sprite-alerts">
              <AlertMark alerts={warns} className="on-sprite" />
              <AlertMark alerts={dangers} className="on-sprite" />
            </span>
          )}
        </span>
        {index === 0 && (
          // Il primo slot è quello che va in campo per primo
          <small className="slot-lead" title={tr('team.leadTitle')} aria-hidden="true">{tr('team.lead')}</small>
        )}
        {set.customSkillset && (
          // Non è un problema: piccolo, nell'angolo in alto a sinistra
          <AlertMark icon="unlock" className="slot-custom"
            alerts={[{ level: 'info', text: tr('team.customMark') }]} />
        )}
        <button
          type="button"
          className="favorite"
          aria-label={tr('team.favorite', { species: name })}
          aria-pressed={!!set.favorite}
          title={tr(set.favorite ? 'team.favoriteOn' : 'team.favoriteOff')}
          onClick={() => onChange({ ...set, favorite: !set.favorite })}
        >
          <Icon name="star" filled={!!set.favorite} />
        </button>
        <button
          type="button"
          className="remove"
          aria-label={tr('team.remove', { species: name })}
          title={tr('team.removeTitle')}
          onClick={onRemove}
        >
          <Icon name="close" />
        </button>
        {/* Lo strumento è la sua icona prima del nome: nome e descrizione nel tooltip (e per i lettori di schermo) */}
        <span className="name-line" aria-hidden="true">
          <small className="held" title={set.item ? `${gameName('item', set.item, lang)}: ${describe.item(set.item, lang)}` : tr('team.noItem')}>
            <ItemIcon item={set.item} size={20} />
            <span className="visually-hidden">{set.item ? gameName('item', set.item, lang) : tr('team.noItem')}</span>
          </small>
          {/* Il soprannome, se c'è (la specie nel tooltip) */}
        {/* Il nome intero nel tooltip: nella barra compressa si taglia con i puntini */}
        <strong className="name" title={set.name ? `${set.name} (${name})` : name} style={{ '--name-em': nameEm.toFixed(3) } as CSSProperties}>{shownName}</strong>
        </span>
        <small className="ability" title={describe.ability(ability, lang)} aria-hidden="true">{ability ? gameName('ability', ability, lang) : '—'}</small>
        <span className={`types${typeText ? '' : ' as-icons'}`} ref={typesRef} aria-hidden="true">
          {typeText || !species ? typeList.map(type => <TypeChip key={type} type={type} />) : typeList.map(type => (
            <span key={type} className="type-dot" title={typeName(type, lang)}>
              <img src={typeIconUrl(type)} alt="" draggable={false} />
              <span className="visually-hidden">{typeName(type, lang)}</span>
            </span>
          ))}
        </span>
        {/* Solo il ruolo principale; tutti i ruoli (e il meteo) nel tooltip */}
        {roles.length > 0 && <small className="roles" title={rolesTitle} aria-hidden="true">{roles[0]}</small>}
      </div>
      <div className="drawer" id={drawerId}>
      <IdleSetEditor idle={!open} idleKey={`${lang}:${megaWarning ?? ''}`}
        set={set} presets={presets} common={common} genLimit={format.genLimit} pokedex={pokedexOf(format)} roles={roleLabels}
        teraBannedIn={teraAllowed(format) ? undefined : formatLabel(format, lang)} speed={speed} onChange={stable.onChange}
        presetAction={
          <button type="button" className="best-preset" title={tr('team.bestPresetTitle')} onClick={applyBest}
            aria-label={tr(best === 'same' ? 'team.bestPresetSame' : best === 'applied' ? 'team.bestPresetDone' : 'team.bestPreset')}>
            <Icon name={best ? 'check' : 'spark'} /> <span className="btn-label">{tr(best === 'same' ? 'team.bestPresetSame' : best === 'applied' ? 'team.bestPresetDone' : 'team.bestPreset')}</span>
          </button>
        }
        title={open && (
          <div className="editor-title">
            {/* Con un soprannome, la specie resta sopra come piccola etichetta (come Statistiche, Set e Mosse) */}
            {set.name && !naming && <span className="species-tag">{name}</span>}
            {naming ? (
              <input className="nickname-input" autoFocus aria-label={tr('team.nickname', { species: name })} maxLength={18}
                placeholder={name} defaultValue={set.name ?? ''}
                onBlur={e => commitName(e.currentTarget.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitName(e.currentTarget.value); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNaming(false); }
                }} />
            ) : (
              // Il nome arriva via CSS (data-name): non è un secondo testo uguale a quello della carta
              <button type="button" className="nickname" aria-label={tr('team.nickname', { species: name })} title={tr('team.nicknameTitle')}
                onClick={() => setNaming(true)}>
                <strong data-name={set.name || name} />
              </button>
            )}
            <span className="types" aria-hidden="true">{species?.types.map(type => <TypeChip key={type} type={type} />)}</span>
            <button type="button" className="shiny-toggle" aria-pressed={!!set.shiny} aria-label={tr('team.shiny')} title={tr('team.shiny')}
              onClick={() => stable.onChange({ ...set, shiny: set.shiny ? undefined : true })}>
              <Icon name="shiny" filled={!!set.shiny} />
            </button>
          </div>
        )}
        memberAction={
          <button type="button" className="member-replace" aria-label={tr('team.replace', { species: name })} title={tr('team.replaceButton')} onClick={stable.onReplace}>
            <Icon name="swap" /> <span className="btn-label">{tr('team.replaceButton')}</span>
          </button>
        }
        proposedSlot={open && proposal ? proposal.slot : undefined}
        notice={<>{open && proposal && (
          <div className="move-proposal" role="note">
            <Icon name="spark" />
            <span>{proposal.from
              ? tr('team.moveProposal', { to: gameName('move', proposal.to, lang), from: gameName('move', proposal.from, lang), n: gainText(proposal.gain) })
              : tr('team.moveProposalEmpty', { to: gameName('move', proposal.to, lang), n: gainText(proposal.gain) })}</span>
            <button type="button" className="apply" ref={applyRef} onClick={() => onProposalDone?.(true)}>{tr('team.moveProposalApply')}</button>
            <button type="button" onClick={() => onProposalDone?.(false)}>{tr('team.moveProposalCancel')}</button>
          </div>
        )}{open && problems.length > 0 && (
          // I problemi di legalità detti per esteso, con la via d'uscita
          <div className="member-problems" role="note">
            <Icon name="warning" />
            <span>{problems.join(' · ')}</span>
            <button type="button" onClick={stable.onReplace}>{tr('team.findReplacement')}</button>
          </div>
        )}</>}
        smogonAction={<SmogonLink species={name} format={format} presets={presets} iconOnly />}
        ioAction={
          <span className="io-anchor" ref={ioRef}>
            <button type="button" className="member-io" aria-expanded={!!paste} title={tr('team.memberIOTitle')} aria-label={tr('team.memberIOName')}
              onClick={() => setPaste(p => {
                if (p) return null;
                const text = exportShowdown([set], { tera: teraAllowed(format) });
                return { text, original: text, blocked: null };
              })}>
              <Icon name="paste" /> <span className="btn-label">{tr('team.memberIO')}</span>
            </button>
            <button type="button" className="member-copy" aria-label={tr(copied ? 'team.copied' : 'team.copySet')} title={tr('team.copySet')}
              onClick={async () => {
                if (await copyText(exportShowdown([set], { tera: teraAllowed(format) }))) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
              }}><Icon name={copied ? 'check' : 'copy'} /></button>
  {paste && (
    <div className="paste-panel" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setPaste(null); } }}>
      <textarea aria-label={tr('team.pasteText')} rows={12} autoFocus ref={pasteArea} value={paste.text} placeholder={tr('team.pastePlaceholder')}
        onChange={e => setPaste({ text: e.target.value, original: paste.original, blocked: null })} />
      <p className="paste-hint">{tr('team.pasteHint')}</p>
      {paste.blocked && <ImportDialog review={paste.blocked} onYes={() => {}}
        onClose={() => { setPaste(p => (p ? { ...p, blocked: null } : p)); pasteArea.current?.focus(); }} />}
      <div className="paste-actions">
        <button type="button" className="apply" disabled={!paste.text.trim()} onClick={applyPaste}>{tr('team.pasteApply')}</button>
        <button type="button" onClick={() => setPaste(null)}>{tr('team.pasteCancel')}</button>
      </div>
    </div>
  )}
          </span>
        }
        actions={<>
          {megaWarning && <button type="button" onClick={stable.onIgnoreWarning}>{tr('team.keepMega')}</button>}
          <button type="button" className="editor-close" aria-label={tr('team.closeEditor')} title={tr('team.closeEditor')}
            onClick={() => { onToggle(false); card.current?.focus(); }}><Icon name="close" /></button>
        </>} />
      </div>
    </div>
  );
});

/** Slot libero: cerchio tratteggiato al posto dello sprite; il clic porta alla ricerca, col cursore già dentro. */
function EmptySlot({ onClick }: { onClick: () => void }) {
  const tr = useT();
  const card = useRef<HTMLButtonElement>(null);
  return (
    <button type="button" className="slot empty" ref={card} title={tr('team.emptyAddTitle')} onClick={onClick}>
      <span className="empty-ring" aria-hidden="true"><Icon name="plus" /></span>
      <span className="empty-label">{tr('team.emptyAdd')}</span>
    </button>
  );
}

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace, onRemove, onAllowMultipleMegas, onOpenChange, closeSignal, collapsed = false, onPaste, onBulk, onAddClick, proposal, onProposalDone, io, saved }: Props) {
  const lang = useLang();
  // Sotto-ruoli misurati di ogni membro: la carta dice quello che dice il voto (stessa cache dell'area Ruoli)
  const subRoles = useMemo(() => team.map(set => measuredSubRoles(set, team, data)), [team, data]);
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useEffect(() => { setEditing(openIndex); onOpenChange?.(openIndex); }, [openIndex]);
  useEffect(() => () => setEditing(null), []);
  // Il team si accorcia da fuori (import, Annulla, team salvato): un membro aperto che non c'è più si chiude
  useEffect(() => { if (openIndex !== null && openIndex >= team.length) setOpenIndex(null); }, [team.length, openIndex]);
  // Telefono e tablet: l'editor copre lo schermo, il tasto o il gesto "indietro" lo chiude
  useBackClose(openIndex !== null, () => setOpenIndex(null), SMALL);
  const lastClose = useRef(closeSignal);
  useEffect(() => {
    if (closeSignal === lastClose.current) return;
    lastClose.current = closeSignal;
    setOpenIndex(null);
  }, [closeSignal]);
  // Proposta nuova: apre il membro (dichiarato dopo il segnale di chiusura, così vince l'apertura)
  const lastNonce = useRef(proposal?.nonce);
  useEffect(() => {
    if (!proposal || proposal.nonce === lastNonce.current) return;
    lastNonce.current = proposal.nonce;
    animated(() => setOpenIndex(proposal.index));
    // Conta solo il nonce: la proposta cambia a ogni modifica, ma si apre una volta per nonce (lastNonce)
  }, [proposal?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotsRef = useRef<HTMLDivElement>(null);
  const focusCard = (i: number) => requestAnimationFrame(() => slotsRef.current?.querySelectorAll<HTMLElement>('.slot > .slot-card > .slot-toggle')[i]?.focus());
  const step = (from: number, delta: number) => {
    const to = (from + delta + team.length) % team.length;
    if (openIndex !== null) animated(() => setOpenIndex(to));
    focusCard(to);
  };
  // Riordino: trascinando o con Alt + frecce; il membro aperto resta aperto nella nuova posizione
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  // Per i lettori di schermo: dove è finito il membro spostato
  const [moveNote, setMoveNote] = useState('');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= team.length || to === from) return;
    const next = [...team];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const follow = (i: number | null) => (i === null ? null : i === from ? to : from < i && i <= to ? i - 1 : to <= i && i < from ? i + 1 : i);
    animated(() => { onChange(next); setOpenIndex(follow); });
    setMoveNote(t(lang, 'team.moved', { name: moved.name ? `${moved.name} (${battleName(moved)})` : battleName(moved), n: to + 1, total: team.length }));
    focusCard(to);
  };
  // Migliora i set: una finestra che calcola i set nuovi, li mostra e chiede conferma
  const [confirmPresets, setConfirmPresets] = useState(false);
  // Dopo un Incolla set: mosse non imparabili (Custom Skillset?) o nomi non trovati del membro incollato
  const [ask, setAsk] = useState<{ index: number; review: ImportReview } | null>(null);
  const presetsButton = useRef<HTMLButtonElement>(null);
  const closeConfirm = () => { setConfirmPresets(false); presetsButton.current?.focus(); };
  // Completa team: pannello con tipi di team e proposte
  const [filling, setFilling] = useState(false);
  const fillToggle = useRef<HTMLButtonElement>(null);
  // Chiudendo il pannello il focus torna al pulsante
  const closeFill = useCallback(() => { setFilling(false); fillToggle.current?.focus(); }, []);
  const canFill = team.length < 6 && !!data.stats;
  // Team pieno o senza statistiche: il pannello si chiude (e non si riapre da solo dopo)
  useEffect(() => { if (!canFill) setFilling(false); }, [canFill]);
  // Chiave stabile per specie (e occorrenza): riordinando, le card non si ricreano
  const keys = team.map((set, i) => `${set.species}#${team.slice(0, i).filter(s => s.species === set.species).length}`);
  // Una forma senza il suo strumento non è Mega (legalTeam.ts)
  const repeated = duplicateSpecies(team, format.formatId);
  const firstMega = team.findIndex(set => !missingFormeItem(set) && isMega(set));
  const warningFor = (set: TeamSet, i: number) =>
    !format.allowMultipleMegas && firstMega !== -1 && i > firstMega && !missingFormeItem(set) && isMega(set) ? t(lang, 'team.secondMega') : null;
  // Azioni delle carte: chiamano sempre la versione aggiornata (live), ma l'oggetto resta lo stesso (memo delle carte)
  const live = useRef<SlotActions>(null!);
  live.current = {
    toggle: (i, open) => animated(() => setOpenIndex(current => (open ? i : current === i ? null : current))),
    step,
    move: (i, delta) => move(i, i + delta),
    drag: (i, phase) => {
      if (phase === 'start') setDrag({ from: i, over: null });
      else if (phase === 'over') setDrag(d => (d && d.over !== i ? { ...d, over: i } : d));
      else if (phase === 'drop') { if (drag) move(drag.from, i); setDrag(null); }
      else setDrag(null);
    },
    paste: (i, next, review) => {
      if (onPaste) onPaste(i, next); else onChange(team.map((s, j) => (j === i ? next : s)));
      if (review) setAsk({ index: i, review });
    },
    best: i => { const found = bestPreset(team, i, data, format.genLimit); return found.index === null ? null : found.set; },
    ignoreWarning: onAllowMultipleMegas,
    change: (i, next) => onChange(team.map((s, j) => (j === i ? next : s))),
    remove: i => {
      setOpenIndex(null);
      if (onRemove) onRemove(i); else onChange(team.filter((_, j) => j !== i));
      // Il focus non si perde: va alla carta che prende il posto (o all'ultima, o al primo slot vuoto)
      requestAnimationFrame(() => {
        const cards = slotsRef.current?.querySelectorAll<HTMLElement>('.slot > .slot-card > .slot-toggle');
        (cards?.[Math.min(i, cards.length - 1)] ?? slotsRef.current?.querySelector<HTMLElement>('.slot.empty'))?.focus();
      });
    },
    replace: i => onReplace(i),
    proposalDone: applied => onProposalDone?.(applied),
  };
  const actions = useMemo<SlotActions>(() => ({
    toggle: (i, open) => live.current.toggle(i, open),
    step: (i, delta) => live.current.step(i, delta),
    move: (i, delta) => live.current.move(i, delta),
    drag: (i, phase) => live.current.drag(i, phase),
    paste: (i, next, review) => live.current.paste(i, next, review),
    best: i => live.current.best(i),
    ignoreWarning: () => live.current.ignoreWarning(),
    change: (i, next) => live.current.change(i, next),
    remove: i => live.current.remove(i),
    replace: i => live.current.replace(i),
    proposalDone: applied => live.current.proposalDone(applied),
  }), []);
  return (
    <section aria-label={t(lang, 'team.region')} className={`team${collapsed ? ' collapsed' : ''}`}>
      <div className="team-head">
        {/* La targa del team porta la guida: Completa team finché mancano Pokémon, Migliora i set col team pieno */}
        <div className="team-plate">
          <h2>{t(lang, 'team.title', { n: team.length })}</h2>
          {canFill ? (
            // Anche a team vuoto: propone team interi del tipo scelto; il pannello si apre sotto il pulsante
            <span className="fill-anchor">
              <button type="button" className="team-guide" data-fill-toggle aria-expanded={filling} aria-haspopup="dialog" ref={fillToggle}
                title={t(lang, 'team.fillTitle')} onClick={() => setFilling(open => !open)}>
                <Icon name="spark" /> <span className="btn-label">{t(lang, 'team.fill')}</span>
              </button>
              {filling && (
                <FillPanel team={team} format={format} data={data} onClose={closeFill} onApply={proposal => {
                  setFilling(false);
                  setOpenIndex(null);
                  if (onBulk) onBulk('fill', proposal.team); else onChange(proposal.team);
                }} />
              )}
            </span>
          ) : team.length > 0 && (
            <button type="button" className="team-guide" ref={presetsButton}
              aria-haspopup="dialog" title={t(lang, 'team.bestPresetsTitle')} onClick={() => setConfirmPresets(true)}>
              <Icon name="spark" /> <span className="btn-label">{t(lang, 'team.bestPresets')}</span>
            </button>
          )}
        </div>
        {saved}
        {confirmPresets && (
          <ImproveSetsDialog team={team} data={data} genLimit={format.genLimit} onCancel={closeConfirm} onApply={next => {
            closeConfirm();
            if (onBulk) onBulk('presets', next); else onChange(next);
          }} />
        )}
        {ask && (
          <ImportDialog review={ask.review} onClose={() => setAsk(null)} onYes={() => {
            const member = team[ask.index];
            if (member) onChange(team.map((s, j) => (j === ask.index ? { ...member, customSkillset: true } : s)));
            setAsk(null);
          }} />
        )}
        {/* Scorciatoie, sempre allo stesso posto a destra: porta dentro un team, ricomincia da zero */}
        <div className="team-quick">
          {io}
          {team.length > 0 && <>
            <span className="team-sep" aria-hidden="true" />
            <button type="button" className="team-action clear-team" title={t(lang, 'team.clear')} onClick={() => {
              setOpenIndex(null);
              if (onBulk) onBulk('clear', []); else onChange([]);
            }}><Icon name="close" /> <span className="btn-label">{t(lang, 'team.clear')}</span></button>
          </>}
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">{moveNote}</p>
      <div className={`slots${openIndex !== null ? ' editing' : ''}`} ref={slotsRef}>
        {team.map((set, i) => (
          <TeamSlot
            key={keys[i]}
            index={i}
            total={team.length}
            set={set}
            proposal={proposal?.index === i ? proposal : null}
            subRoles={subRoles[i]}
            dragging={drag?.from === i}
            dropTarget={drag !== null && drag.over === i && drag.from !== i}
            data={data}
            format={format}
            warning={warningFor(set, i)}
            repeated={repeated.includes(i)}
            open={openIndex === i}
            actions={actions}
          />
        ))}
        {Array.from({ length: 6 - team.length }, (_, i) => (
          <EmptySlot key={`empty-${i}`} onClick={() => { setOpenIndex(null); onAddClick?.(); }} />
        ))}
      </div>
    </section>
  );
}
