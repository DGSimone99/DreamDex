import type { EngineData } from '../../engine/data';
import { battleAbility, battleName, battleSpecies } from '../../engine/dex';
import { bannedParts, formatLabel, pokedexOf, teraAllowed } from '../../engine/formats';
import type { Format } from '../../engine/format';
import { formatRules } from '../../engine/formatRules';
import { detectRoles, roleDescription, roleLabel, shownRoles } from '../../engine/roles';
import { cardRoles, weatherOf } from '../../engine/archetype';
import { rolesListFor, type SubRoleValues } from '../../engine/subRoles';
import { conditionLabel, viaName } from '../../engine/synergy';
import { exportShowdown, presetsForSet, type Preset, type TeamSet } from '../../engine/sets';
import { memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { copyText } from '../clipboard';
import { type ImportReview } from '../importReview';
import { SetEditor } from '../SetEditor';
import { EditorDuel } from '../EditorDuel';
import { PokemonIcon } from '../PokemonName';
import { hint as bubble, kitTip } from '../MoveTip';
import { commonChoices, type CommonChoices } from '../../engine/common';
import { speedTier, type SpeedTier } from '../../engine/speed';
import { ItemIcon } from '../ItemIcon';
import { useNameEm } from '../nameWidth';
import { AlertMark } from '../AlertMark';
import { useMemberTip } from '../MemberCard';
import { Sprite, TypeChip, typePair } from '../Sprite';
import { Icon } from '../icons';
import { useFitCount } from '../useFit';
import { TypeTile } from '../typeIcons';
import { useMediaQuery } from '../useMediaQuery';
import { TOUCH_QUERY } from '../TouchTips';
import { useAnchoredPop } from '../useAnchoredPop';
import { SmogonLink } from '../SmogonLink';
import { Hint } from '../Hint';
import { draggedSet, hideDragImage } from '../teamDrag';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { slotAlerts } from './slotAlerts';
import { MemberMenu } from './MemberMenu';
import { EditorTitle, MoveProposalNote } from './EditorTitle';
import { useSetText } from './SetTextPanel';
import { TypeTextContext, nameCut } from './typeFit';
import type { EditorGradeShown, MoveProposal, SlotActions } from './slotTypes';
import { useFlash } from '../useFlash';

/**
 * Editor dei membri chiusi: resta nella pagina ma non si ridisegna finché il set non cambia,
 * così aprire e chiudere una card non ricalcola gli altri cinque editor.
 */
const IdleSetEditor = memo(
  (props: ComponentProps<typeof SetEditor> & { idle: boolean; idleKey: string }) => <SetEditor {...props} />,
  (a, b) => a.idle && b.idle && a.idleKey === b.idleKey && a.set === b.set && a.presets === b.presets && a.common === b.common
    && a.speed === b.speed && a.genLimit === b.genLimit && a.pokedex === b.pokedex && a.teraBannedIn === b.teraBannedIn,
);

export const TeamSlot = memo(function TeamSlot({ index, total, set, team, subRoles, proposal, data, format, warning: megaWarning, repeated = false, open, dragging, dropTarget, actions, collapsed = false, grade = null, startTab = null }: {
  index: number;
  /** Telefono: la scheda dell'editor da aprire (la Sfida, arrivando da "lascialo a" di un compagno). */
  startTab?: { tab: 'duel'; key: number } | null;
  /** Il voto del team, solo per la carta aperta: il chip del telefono nella testata dell'editor. */
  grade?: EditorGradeShown | null;
  /** Team ridotto: la carta del Pokémon si apre su tutta la carta del team, non solo sulla sprite. */
  collapsed?: boolean;
  /** Membri nel team: la carta dice la sua posizione ("posizione 2 di 6"). */
  total: number;
  /** Il team intero, solo per la carta aperta (la Sfida ne usa meteo, campi e Ventoincoda). */
  team?: TeamSet[];
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
  const [flash, setFlash] = useState(false);
  const onStep = (delta: number) => actions.step(index, delta);
  const onMove = (delta: number) => actions.move(index, delta);
  const onDrag = (phase: 'start' | 'over' | 'drop' | 'end') => actions.drag(index, phase);
  const onPaste = (next: TeamSet, review?: ImportReview) => actions.paste(index, next, review);
  const onBest = () => actions.best(index);
  const onIgnoreWarning = actions.ignoreWarning;
  const onChange = (next: TeamSet) => actions.change(index, next);
  const onSetChange = (next: TeamSet) => actions.setChange(index, next);
  const onTip = (next: TeamSet, change: string) => actions.tip(index, next, change);
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
  const onBestIndex = () => actions.bestIndex(index);
  // Apre il riquadro del testo del set (assegnato più sotto, dove c'è il suo stato)
  const textOpen = useRef<() => void>(() => undefined);
  const live = useRef({ onChange, onSetChange, onTip, onReplace, onPaste, onIgnoreWarning, onBest, onBestIndex });
  live.current = { onChange, onSetChange, onTip, onReplace, onPaste, onIgnoreWarning, onBest, onBestIndex };
  const stable = useMemo(() => ({
    onChange: (next: TeamSet) => live.current.onChange(next),
    onSetChange: (next: TeamSet) => live.current.onSetChange(next),
    onTip: (next: TeamSet, change: string) => live.current.onTip(next, change),
    onReplace: () => live.current.onReplace(),
    onPaste: (next: TeamSet, review?: ImportReview) => live.current.onPaste(next, review),
    onIgnoreWarning: () => live.current.onIgnoreWarning(),
    onBest: () => live.current.onBest(),
    onBestIndex: () => live.current.onBestIndex(),
    // Il preset migliore del menu Set: completato e ritoccato, come faceva il pulsante "Preset migliore"
    applyBest: () => {
      const next = live.current.onBest();
      if (next) live.current.onSetChange(next);
    },
    openText: () => textOpen.current(),
  }), []);
  const species = battleSpecies(set);
  // Con la megapietra il membro è la Mega: nome e abilità della forma in battaglia (il set resta quello di Showdown)
  const name = battleName(set);
  // Tipi: chip col nome finché entrano in tutte le carte, sennò le icone tonde dei tipi (il nome nel tooltip e per i
  // lettori). Lo decide la fila del team (TypeTextContext), uguale per tutte le carte
  const typeList = species?.types ?? ['?'];
  const typeText = useContext(TypeTextContext);
  // Nome: va a capo solo agli spazi e ai trattini; la larghezza vera della parte più lunga (in em) decide se e quanto si
  // rimpicciolisce (CSS --name-em)
  // Il nome prima si rimpicciolisce (CSS); se intero verrebbe tagliato anche così, la carta mostra il nome senza forma
  // ("Urshifu" per Urshifu-Rapid-Strike, "Charizard" per Charizard-Mega-X; un soprannome non si accorcia), e se nemmeno
  // quello entra, una riga sola coi puntini. Il nome intero resta nel tooltip. Nel team aperto il nome sta sempre su una
  // riga sul computer (carte alte uguali): andare a capo conta come non entrare, e conta la misura del nome intero
  // (--name-em-whole; --name-em, la parte più lunga, serve dove il nome può andare a capo)
  // Si misura sulla carta (watch): la sua misura non dipende dal nome mostrato
  const nameRef = useRef<HTMLElement>(null);
  const shortName = !set.name && species && species.baseSpecies !== name ? species.baseSpecies : null;
  const nameSteps = shortName ? 2 : 1;
  const nameStep = useFitCount(nameRef, nameSteps, `${set.name ?? ''}|${name}|${collapsed}`, card, false, nameCut);
  const shownName = set.name || (shortName && nameStep < nameSteps ? shortName : name);
  const nameDots = nameStep === 0;
  const nameEm = useNameEm(shownName);
  const nameEmWhole = useNameEm(shownName, true);
  const ability = battleAbility(set);
  const [copied, setCopied] = useFlash(1500);
  // Incolla set: il riquadro col testo del set (Set › Incolla testo)
  const setText = useSetText(set, format, stable.onPaste);
  textOpen.current = setText.open;
  // Nell'editor gli EV di troppo li dice già "EV usati" (590 / 510 · 80 di troppo: voto bloccato): l'avviso li salta
  const memberTip = useMemberTip(500, '.slot-card');
  // Col dito: tenendo premuta la carta si apre dal basso il menu del membro (modifica, blocca, sposta, sostituisci,
  // togli) al posto dei pulsantini sulla carta; il suggerimento del trascinamento (col dito non si trascina) non serve
  const touch = useMediaQuery(TOUCH_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => { if (!open) setShrunk(false); }, [open]);
  const menuRef = useRef<HTMLDivElement>(null);
  const hold = useRef<{ x: number; y: number; timer: number } | null>(null);
  const held = useRef(false);
  useAnchoredPop(card, menuRef, menuOpen, { sheet: true, width: 280, onDismiss: () => setMenuOpen(false) });
  const endHold = () => { if (hold.current) window.clearTimeout(hold.current.timer); hold.current = null; };
  const menuDo = (run: () => void) => { setMenuOpen(false); run(); };
  // La punta sotto la carta aperta: al centro della carta, misurato (le carte cambiano larghezza con la finestra)
  const pointer = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const tip = pointer.current;
      const box = card.current?.getBoundingClientRect();
      const base = (tip?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
      if (!tip || !box || !base) return;
      tip.style.left = `${box.left + box.width / 2 - base.left}px`;
    };
    place();
    window.addEventListener('resize', place);
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    if (card.current) watch?.observe(card.current);
    return () => { window.removeEventListener('resize', place); watch?.disconnect(); };
  }, [open, collapsed, index, total]);
  // Ruolo principale e un supporto, affiancati con il nome breve (il completo nel tooltip); il meteo solo qui
  const rules = formatRules(format.formatId);
  const onCard = cardRoles(set, rules, subRoles);
  const weather = weatherOf(set);
  // Nel tooltip tutti i ruoli per esteso: prima i due mostrati, poi gli altri (in doppio quelli del doppio)
  const allRoles = [...onCard, ...shownRoles(subRoles ? rolesListFor(subRoles, rules) : detectRoles(set, rules), rules).filter(role => !onCard.includes(role))];
  const roleLabels = allRoles.map(role => (role === 'weather' && weather
    ? tr('card.weatherTitle', { condition: conditionLabel(weather.condition, lang), via: viaName(weather.via, lang) })
    : role === 'weather' ? tr('card.weather') : roleLabel(role, lang)));
  // Il ruolo mostrato spiegato in una frase, poi gli altri per nome
  const roleTips = allRoles.map(role => (role === 'weather' ? undefined : roleDescription(role, lang)));
  const itemBannedIn = useCallback((name: string) => !!bannedParts({ moves: [], ability: '', item: name }, format).item, [format]);
  const { fieldFlags, dangers, warns, warnings } = slotAlerts({ set, species, format, common, megaWarning, repeated, lang });
  return (
    // La carta non è un <details>: il clic apre l'editor (stato del team), e lucchetto, × e avvisi stanno accanto al
    // pulsante della carta, non dentro (niente controlli dentro un altro controllo)
    <div
      className={`slot filled${open ? ' open' : ''}${dangers.length ? ' invalid' : warnings.length ? ' warn' : ''}${dragging ? ' dragging' : ''}${dropTarget ? ' drop-target' : ''}`}
      style={{ ...typePair(species?.types), '--vt': `slot-${index}` } as React.CSSProperties}
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
        className={`slot-card pedana-face${open ? ' beam-on' : ''}${flash ? ' beam-flash' : ''}`}
        onAnimationEnd={e => { if (e.animationName === 'beam-flash') setFlash(false); }}
        // Schermi touch: niente trascinamento (col dito si tiene premuto per il menu del membro)
        draggable={!touch}
        // Team ridotto: la carta del Pokémon su tutta la carta (al posto del fumetto "Trascina…"). Carta aperta: niente
        // fumetto (col mouse ancora sopra, ridisegnando la pagina si riapriva sopra l'editor)
        {...(open || collapsed || touch ? {} : bubble(`${tr('team.dragTitle')}
${tr('team.slotKey', { n: index + 1 })}`))}
        {...(collapsed && !open && !touch ? memberTip.bind(set, undefined, [...dangers, ...warns].map(a => ({ level: a.level === 'danger' ? 'danger' : 'warn', text: a.text }))) : {})}
        data-own-hold={touch || undefined}
        onPointerDown={e => {
          if (!touch || e.pointerType === 'mouse' || (e.target as Element).closest('button:not(.slot-toggle), a, input')) return;
          held.current = false;
          endHold();
          hold.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { held.current = true; hold.current = null; setMenuOpen(true); }, 450) };
        }}
        onPointerMove={e => { if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) endHold(); }}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        // Clic su tutta la carta (il pulsante della carta lo prende da tastiera e dai lettori di schermo)
        onClick={e => {
          // Dopo il tocco lungo (menu del membro) il clic non apre l'editor
          if (held.current) { held.current = false; e.preventDefault(); return; }
          // Stella, × e avvisi: i loro clic non aprono né chiudono l'editor
          const hit = (e.target as HTMLElement).closest('button, a, input, [tabindex]');
          if (hit && hit !== card.current) return;
          // Aprendo, la luce dall'alto si accende forte e si assesta (CSS .beam-flash)
          if (!open) setFlash(true);
          onToggle(!open);
          // Come prima col <summary>: dopo il clic il fuoco è sulla carta (Esc e frecce partono da lì), senza anello
          card.current?.focus({ preventScroll: true, focusVisible: false });
        }}
        onDragStart={e => {
          // Segue il mouse una copia piena della carta (SlotGhost), non quella sfumata del browser; al suo posto lo slot vuoto
          hideDragImage(e);
          const box = e.currentTarget.getBoundingClientRect();
          actions.lift(index, { x: e.clientX, y: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top, w: box.width, h: box.height, collapsed });
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); }
          onDrag('start');
        }}
        // La carta trascinata entra da un lato: questa, che sta per essere sostituita o spostata, si fa da parte dall'altro
        // (si sposta e si inclina, CSS .drop-target[data-lean]); il lato si decide entrando, non a ogni movimento
        onDragEnter={e => {
          const el = e.currentTarget;
          if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
          const box = el.getBoundingClientRect();
          el.dataset.lean = e.clientX < box.left + box.width / 2 ? 'right' : 'left';
        }}
        onDragOver={e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = draggedSet() ? 'copy' : 'move'; onDrag('over'); }}
        onDrop={e => { e.preventDefault(); onDrag('drop'); }}
        onDragEnd={() => onDrag('end')}
      >
        <button
          type="button"
          className="slot-toggle"
          ref={card}
          aria-expanded={open}
          aria-controls={drawerId}
          // Un nome breve per la carta: nome, tipi, strumento, problemi, posizione
          aria-label={[
            set.name ? `${set.name} (${name})` : name,
            species?.types.map(type => typeName(type, lang)).join('/'),
            set.item ? gameName('item', set.item, lang) : tr('team.noItem'),
            dangers.length ? tr(dangers.length === 1 ? 'team.cardProblem' : 'team.cardProblems', { n: dangers.length }) : null,
            warnings.length ? tr(warnings.length === 1 ? 'team.cardWarning' : 'team.cardWarnings', { n: warnings.length }) : null,
            tr('team.position', { n: index + 1, total }),
          ].filter(Boolean).join(', ')}
          aria-keyshortcuts={`${index + 1} Alt+ArrowLeft Alt+ArrowRight`}
          {...(open ? {} : bubble(`${tr('team.dragTitle')}
${tr('team.slotKey', { n: index + 1 })}`))}
        />
        {/* Team compresso: solo l'icona del box, con un puntino se c'è un problema o un avviso */}
        <span className="mini-icon" aria-hidden="true">
          <PokemonIcon name={name} />
          {(dangers.length > 0 || warns.length > 0) && (
            // Il perché sta nella carta del Pokémon che si apre passandoci sopra
            <span className={`mini-alert ${dangers.length ? 'danger' : 'warn'}`}>
              <span className="visually-hidden">{tr(dangers.length ? 'alert.danger' : 'alert.warn')}</span>
            </span>
          )}
        </span>
        {/* Sulla sprite, a carta chiusa: dopo mezzo secondo la carta del Pokémon sotto la carta del team (il set intero senza aprirlo) */}
        {/* data-hint vuoto: sullo sprite niente fumetto "Trascina…", lì si apre la carta del Pokémon (si sovrapponevano) */}
        {/* Carta Pedana (pedana.css): la riga dei tipi in cima, la luce dall'alto solo sulla carta aperta, la pedana sotto lo sprite */}
        <span className="pedana-stripe" aria-hidden="true" />
        <span className="sprite-wrap" {...(open || collapsed ? {} : { ...memberTip.bind(set), 'data-hint': '' })}>
          {/* La luce sta nel riquadro dello sprite: finisce sempre sulla pedana, qualunque sia l'altezza della carta
              (fuori, con un'altezza fissa, sul telefono e sul tablet scendeva sul nome) */}
          <span className="pedana-beam" aria-hidden="true" />
          <span className="pedana-disc" aria-hidden="true" />
          <Sprite species={set.species} item={set.item} animated={open} shiny={!!set.shiny} />
        </span>
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
          {...bubble(tr(set.favorite ? 'team.favoriteOn' : 'team.favoriteOff'))}
          onClick={() => onChange({ ...set, favorite: !set.favorite })}
        >
          <Icon name="lock" filled={!!set.favorite} />
        </button>
        <button
          type="button"
          className="remove"
          aria-label={tr('team.remove', { species: name })}
          {...bubble(tr('team.removeTitle'))}
          onClick={onRemove}
        >
          <Icon name="close" />
        </button>
        {/* Lo strumento è la sua icona prima del nome: nome e descrizione nel tooltip (e per i lettori di schermo) */}
        {/* Strumento e nome li dice già il pulsante della carta; gli avvisi in fondo alla riga del nome restano leggibili */}
        <span className="name-line">
          <small className="held" aria-hidden="true" {...(set.item ? kitTip('item', set.item) : bubble(tr('team.noItem')))}>
            <ItemIcon item={set.item} size={20} />
            <span className="visually-hidden">{set.item ? gameName('item', set.item, lang) : tr('team.noItem')}</span>
          </small>
          {/* Il soprannome, se c'è (la specie nel tooltip) */}
        {/* Il nome intero nel tooltip: nella barra compressa si taglia con i puntini */}
        <strong className={`name${nameDots ? ' dots' : ''}`} ref={nameRef} aria-hidden="true" {...bubble(set.name ? `${set.name} (${name})` : name)} style={{ '--name-em': nameEm.toFixed(3), '--name-em-whole': nameEmWhole.toFixed(3) } as CSSProperties}>{shownName}</strong>
        {/* Avvisi in fondo alla riga del nome, sotto lo sprite: non lo coprono */}
        {(dangers.length > 0 || warns.length > 0) && (
          <span className="slot-alerts">
            {/* Il fumetto va sopra la pagina e resta dentro lo schermo (sul tablet le carte di destra lo tagliavano) */}
            <AlertMark alerts={warns} className="on-card" floating />
            <AlertMark alerts={dangers} className="on-card" floating />
          </span>
        )}
        </span>
        <small className="ability" {...kitTip('ability', ability)} aria-hidden="true">{ability ? gameName('ability', ability, lang) : '—'}</small>
        <span className={`types${typeText ? '' : ' as-icons'}`} aria-hidden="true">
          {typeText || !species ? typeList.map(type => <TypeChip key={type} type={type} />) : typeList.map(type => (
            <span key={type} className="type-dot" {...bubble(typeName(type, lang))}>
              <TypeTile type={type} />
              <span className="visually-hidden">{typeName(type, lang)}</span>
            </span>
          ))}
        </span>
        {/* Solo il ruolo principale; tutti i ruoli (e il meteo) nel tooltip */}
      </div>
      {menuOpen && (
        <MemberMenu set={set} name={name} index={index} total={total} menuRef={menuRef} run={menuDo}
          onEscape={() => { setMenuOpen(false); card.current?.focus(); }}
          onEdit={() => onToggle(true)} onLock={() => onChange({ ...set, favorite: !set.favorite })}
          onMove={onMove} onReplace={onReplace} onRemove={onRemove} />
      )}
      {/* La punta magenta sotto la carta aperta: indica l'editor (sul suo filo magenta), segue la carta in ogni posto */}
      {open && <span className="slot-pointer" ref={pointer} aria-hidden="true" />}
      {/* Gli editor chiusi restano montati (alti 0) ma inerti: niente fuoco né lettori di schermo dentro */}
      {/* Telefono: scorrendo l'editor la testata (il riepilogo del membro) si stringe a una riga */}
      <div className={`drawer${shrunk ? ' shrunk' : ''}`} id={drawerId} inert={!open} onScroll={e => {
        const el = e.currentTarget;
        const top = el.scrollTop;
        // Soglie diverse per stringere e riallargare: la testata che cambia altezza non fa tremare la scelta. Si stringe
        // solo se resta da scorrere anche dopo (la testata stretta è circa 200 px più bassa), se no torna subito su
        if (!shrunk && top > 80 && el.scrollHeight - el.clientHeight > 260) setShrunk(true);
        else if (shrunk && top < 8) setShrunk(false);
      }}>
      <IdleSetEditor idle={!open} idleKey={`${lang}:${megaWarning ?? ''}`}
        duel={open ? <EditorDuel set={set} team={team ?? [set]} data={data} format={format} onApply={stable.onTip} onOpenMember={actions.openWith} /> : undefined}
        set={set} presets={presets} common={common} genLimit={format.genLimit} pokedex={pokedexOf(format)} game={format.game} roles={roleLabels} roleTips={roleTips}
        teraBannedIn={teraAllowed(format) ? undefined : formatLabel(format, lang)} speed={speed} onChange={stable.onChange} onSetChange={stable.onSetChange}
        bestIndex={stable.onBestIndex}
        onBest={stable.applyBest}
        onText={stable.openText}
        onCopy={() => copyText(exportShowdown([set], { tera: teraAllowed(format) }))}
        smogonLink={<SmogonLink species={name} format={format} presets={presets} />}
        title={open && <EditorTitle set={set} name={name} types={species?.types} grade={grade} onChange={stable.onChange} />}
        memberAction={
          <button type="button" className="member-replace" aria-label={tr('team.replace', { species: name })} onClick={stable.onReplace}>
            <Icon name="swap" /> <span className="btn-label">{tr('team.replaceButton')}</span>
          </button>
        }
        proposedSlot={open && proposal ? proposal.slot : undefined}
        flags={open ? fieldFlags : undefined}
        itemBanned={open ? itemBannedIn : undefined}
        startTab={startTab}
        notice={open && proposal && <MoveProposalNote proposal={proposal} applyRef={applyRef} onDone={onProposalDone} />}
        textPanel={setText.panel}
        actions={<>
          {/* Copia il set a un clic, senza aprire niente (il testo intero si incolla o si guarda da Set › Incolla testo) */}
          <Hint label={tr('team.copySet')} done={copied ? tr('team.copied') : undefined}>
            <button type="button" className="member-copy" aria-label={tr(copied ? 'team.copied' : 'team.copySet')}
              onClick={async () => {
                if (await copyText(exportShowdown([set], { tera: teraAllowed(format) }))) setCopied(true);
              }}><Icon name={copied ? 'check' : 'copy'} /></button>
          </Hint>
          {megaWarning && <button type="button" onClick={stable.onIgnoreWarning}>{tr('team.keepMega')}</button>}
          <Hint label={tr('team.closeEditor')} end>
            <button type="button" className="editor-close" aria-label={tr('team.closeEditor')}
              onClick={() => { onToggle(false); card.current?.focus(); }}><Icon name="close" /></button>
          </Hint>
        </>} />
      </div>
      {!open && memberTip.tip}
    </div>
  );
});
