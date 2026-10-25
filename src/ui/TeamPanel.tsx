import type { EngineData } from '../engine/data';
import { bannedTexts } from '../engine/coach';
import { battleAbility, battleName, battleSpecies, getSpecies, isMega, isSelectable, withinGen } from '../engine/dex';
import { formatLabel, isLegalIn, pokedexOf, teraAllowed } from '../engine/formats';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { detectRoles, roleLabel, roleShortLabel } from '../engine/roles';
import { cardRoles, weatherOf } from '../engine/archetype';
import { measuredSubRoles, rolesList, type SubRoleValues } from '../engine/subRoles';
import { conditionLabel, viaName } from '../engine/synergy';
import { exportShowdown, importShowdown, presetsForSet, type Preset, type TeamSet } from '../engine/sets';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { copyText } from './clipboard';
import { setEditing } from './editing';
import { bestPreset, bestPresets } from '../engine/bestPreset';
import { FillPanel } from './FillPanel';
import { SetEditor } from './SetEditor';
import { PokemonIcon } from './PokemonName';
import { describe } from './describe';
import { commonChoices, type CommonChoices } from '../engine/common';
import { speedTier, type SpeedTier } from '../engine/speed';
import { ItemIcon } from './ItemIcon';
import { AlertMark, type Alert } from './AlertMark';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { Icon } from './icons';
import { SmogonLink } from './SmogonLink';
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

function TeamSlot({ index, set, subRoles, data, format, warning: megaWarning, open, dragging, dropTarget, onToggle, onStep, onMove, onDrag, onPaste, onBest, onIgnoreWarning, onChange, onRemove, onReplace }: {
  index: number;
  /** Sotto-ruoli misurati del membro nel team (gli stessi del voto, già in cache): la carta li mostra. */
  subRoles?: SubRoleValues;
  dragging: boolean;
  dropTarget: boolean;
  /** Alt + frecce: sposta il membro di una posizione. */
  onMove: (delta: number) => void;
  /** Trascinamento: inizio, passaggio sopra, rilascio, fine. */
  onDrag: (phase: 'start' | 'over' | 'drop' | 'end') => void;
  onPaste: (set: TeamSet) => void;
  /** Preset con il voto del team più alto per questo membro (null se il membro non ne ha). */
  onBest: () => TeamSet | null;
  data: EngineData;
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
    onPaste: (next: TeamSet) => live.current.onPaste(next),
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
  const ability = battleAbility(set);
  const [copied, setCopied] = useState(false);
  // Incolla set: testo Showdown di un solo membro, applicato per intero
  const [paste, setPaste] = useState<{ text: string; error: string | null } | null>(null);
  const applyPaste = () => {
    if (!paste) return;
    const result = importShowdown(paste.text, lang);
    const next = result.sets[0];
    if (!next) { setPaste({ ...paste, error: result.errors[0] ?? tr('team.pasteEmpty') }); return; }
    setPaste(null);
    stable.onPaste({ ...next, favorite: set.favorite });
  };
  const problems = slotProblems(set, format, lang);
  // Ruolo principale e un supporto, affiancati con il nome breve (il completo nel tooltip); il meteo solo qui
  const rules = formatRules(format.formatId);
  const shownRoles = cardRoles(set, rules, subRoles);
  const weather = weatherOf(set);
  const roles = shownRoles.map(role => (role === 'weather' ? tr('card.weather') : roleShortLabel(role, lang)));
  // Nel tooltip tutti i ruoli per esteso: prima i due mostrati, poi gli altri
  const allRoles = [...shownRoles, ...(subRoles ? rolesList(subRoles) : detectRoles(set, rules)).filter(role => !shownRoles.includes(role))];
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
        onClick={e => {
          e.preventDefault();
          // Stella, ×, Stats: i loro clic non aprono né chiudono l'editor
          if ((e.target as HTMLElement).closest('button, a, [tabindex]:not(summary)') && e.target !== e.currentTarget) return;
          onToggle(!open);
        }}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); onDrag('start'); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDrag('over'); }}
        onDrop={e => { e.preventDefault(); onDrag('drop'); }}
        onDragEnd={() => onDrag('end')}
      >
        {/* Team compresso: solo l'icona del box, con un puntino se c'è un problema o un avviso */}
        <span className="mini-icon">
          <PokemonIcon name={name} />
          {(dangers.length > 0 || warns.length > 0) && (
            <span className={`mini-alert ${dangers.length ? 'danger' : 'warn'}`} title={[...dangers, ...warns].map(a => a.text).join(' · ')}>
              <span className="visually-hidden">{tr(dangers.length ? 'alert.danger' : 'alert.warn')}</span>
            </span>
          )}
        </span>
        <span className="sprite-wrap">
          <Sprite species={set.species} item={set.item} animated={open} />
          {(dangers.length > 0 || warns.length > 0) && (
            <span className="sprite-alerts">
              <AlertMark alerts={warns} className="on-sprite" />
              <AlertMark alerts={dangers} className="on-sprite" />
            </span>
          )}
        </span>
        {index === 0 && (
          // Il primo slot è quello che va in campo per primo
          <small className="slot-lead" title={tr('team.leadTitle')}>{tr('team.lead')}</small>
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
        {/* Lo strumento è la sua icona prima del nome: nome e descrizione nel tooltip (e per i lettori di schermo) */}
        <span className="name-line">
          <small className="held" title={set.item ? `${gameName('item', set.item, lang)} — ${describe.item(set.item, lang)}` : tr('team.noItem')}>
            <ItemIcon item={set.item} size={22} />
            <span className="visually-hidden">{set.item ? gameName('item', set.item, lang) : tr('team.noItem')}</span>
          </small>
          <strong className="name">{name}</strong>
        </span>
        <small className="ability" title={describe.ability(ability, lang)}>{ability ? gameName('ability', ability, lang) : '—'}</small>
        <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />) ?? <TypeChip type="?" />}</span>
        {/* Solo il ruolo principale; tutti i ruoli (e il meteo) nel tooltip */}
        {roles.length > 0 && <small className="roles" title={rolesTitle}>{roles[0]}</small>}
      </summary>
      <div className="drawer">
      <IdleSetEditor idle={!open} idleKey={`${lang}:${megaWarning ?? ''}`}
        set={set} presets={presets} common={common} genLimit={format.genLimit} pokedex={pokedexOf(format)}
        teraBannedIn={teraAllowed(format) ? undefined : formatLabel(format, lang)} speed={speed} onChange={stable.onChange}
        presetAction={
          <button type="button" className="best-preset" title={tr('team.bestPresetTitle')} onClick={applyBest}>
            <Icon name={best ? 'check' : 'spark'} /> {tr(best === 'same' ? 'team.bestPresetSame' : best === 'applied' ? 'team.bestPresetDone' : 'team.bestPreset')}
          </button>
        }
        title={open && (
          // Solo visivo: nome e tipi li annuncia già la card (il nome via CSS, così non è un secondo testo uguale)
          <div className="editor-title" aria-hidden="true">
            <strong data-name={name} />
            <span className="types">{species?.types.map(type => <TypeChip key={type} type={type} />)}</span>
          </div>
        )}
        actions={<>
          {megaWarning && <button type="button" onClick={stable.onIgnoreWarning}>{tr('team.keepMega')}</button>}
          <button type="button" aria-label={tr('team.pasteSet')} title={tr('team.pasteSet')} aria-expanded={!!paste}
            onClick={() => setPaste(p => (p ? null : { text: '', error: null }))}>
            <Icon name="paste" /> <span className="btn-label">{tr('team.pasteSet')}</span>
          </button>
          <button type="button" aria-label={tr('team.copySet')} title={tr('team.copySet')} onClick={async () => {
            if (await copyText(exportShowdown([set], { tera: teraAllowed(format) }))) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
          }}><Icon name={copied ? 'check' : 'copy'} /> <span className="btn-label">{tr(copied ? 'team.copied' : 'team.copySet')}</span></button>
          <SmogonLink species={name} format={format} presets={presets} />
          <button type="button" aria-label={tr('team.replace', { species: name })} title={tr('team.replaceButton')} onClick={stable.onReplace}><Icon name="swap" /> <span className="btn-label">{tr('team.replaceButton')}</span></button>
        </>} />
      {paste && (
        <div className="paste-panel" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setPaste(null); } }}>
          <textarea aria-label={tr('team.pasteText')} rows={7} autoFocus value={paste.text} placeholder={tr('team.pastePlaceholder')}
            onChange={e => setPaste({ text: e.target.value, error: null })} />
          <p className="paste-hint">{tr('team.pasteHint')}</p>
          {paste.error && <p className="paste-error" role="alert">{paste.error}</p>}
          <div className="paste-actions">
            <button type="button" className="apply" disabled={!paste.text.trim()} onClick={applyPaste}>{tr('team.pasteApply')}</button>
            <button type="button" onClick={() => setPaste(null)}>{tr('team.pasteCancel')}</button>
          </div>
        </div>
      )}
      </div>
    </details>
  );
}

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

export function TeamPanel({ team, format, data, onChange, onAdd, onReplace, onRemove, onAllowMultipleMegas, onOpenChange, closeSignal, collapsed = false, onPaste, onBulk, onAddClick }: Props) {
  const lang = useLang();
  // Sotto-ruoli misurati di ogni membro: la carta dice quello che dice il voto (stessa cache dell'area Ruoli)
  const subRoles = useMemo(() => team.map(set => measuredSubRoles(set, team, data)), [team, data]);
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useEffect(() => { setEditing(openIndex); onOpenChange?.(openIndex); }, [openIndex]);
  useEffect(() => () => setEditing(null), []);
  // Il team si accorcia da fuori (import, Annulla, team salvato): un membro aperto che non c'è più si chiude
  useEffect(() => { if (openIndex !== null && openIndex >= team.length) setOpenIndex(null); }, [team.length, openIndex]);
  const lastClose = useRef(closeSignal);
  useEffect(() => {
    if (closeSignal === lastClose.current) return;
    lastClose.current = closeSignal;
    setOpenIndex(null);
  }, [closeSignal]);
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
  // Preset migliori: qualche decimo di secondo, il pulsante dice che sta calcolando
  const [busy, setBusy] = useState(false);
  const runPresets = () => {
    setBusy(true);
    setTimeout(() => {
      const next = bestPresets(team, data, format.genLimit);
      setBusy(false);
      if (onBulk) onBulk('presets', next); else onChange(next);
    }, 30);
  };
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
  const firstMega = team.findIndex(isMega);
  const warningFor = (set: TeamSet, i: number) =>
    !format.allowMultipleMegas && firstMega !== -1 && i > firstMega && isMega(set) ? t(lang, 'team.secondMega') : null;
  return (
    <section aria-label={t(lang, 'team.region')} className={`team${collapsed ? ' collapsed' : ''}`}>
      <div className="team-head">
        <h2>{t(lang, 'team.title', { n: team.length })}</h2>
        {team.length > 0 && (
          <button type="button" className="team-action" disabled={busy} aria-busy={busy || undefined}
            title={t(lang, 'team.bestPresetsTitle')} onClick={runPresets}>
            <Icon name="spark" /> {t(lang, busy ? 'team.bestPresetsBusy' : 'team.bestPresets')}
          </button>
        )}
        {canFill && (
          // Anche a team vuoto: propone team interi del tipo scelto; il pannello si apre sotto il pulsante
          <span className="fill-anchor">
            <button type="button" className="team-action" data-fill-toggle aria-expanded={filling} aria-haspopup="dialog" ref={fillToggle}
              title={t(lang, 'team.fillTitle')} onClick={() => setFilling(open => !open)}>
              <Icon name="plus" /> {t(lang, 'team.fill')}
            </button>
            {filling && (
              <FillPanel team={team} format={format} data={data} onClose={closeFill} onApply={proposal => {
                setFilling(false);
                setOpenIndex(null);
                if (onBulk) onBulk('fill', proposal.team); else onChange(proposal.team);
              }} />
            )}
          </span>
        )}
        {team.length > 0 && <>
          {/* In fondo a destra, dove finisce l'ultima card */}
          <button type="button" className="team-action clear-team" onClick={() => {
            setOpenIndex(null);
            if (onBulk) onBulk('clear', []); else onChange([]);
          }}><Icon name="close" /> {t(lang, 'team.clear')}</button>
        </>}
      </div>
      <div className={`slots${openIndex !== null ? ' editing' : ''}`} ref={slotsRef}>
        {team.map((set, i) => (
          <TeamSlot
            key={keys[i]}
            index={i}
            set={set}
            subRoles={subRoles[i]}
            dragging={drag?.from === i}
            dropTarget={drag !== null && drag.over === i && drag.from !== i}
            onMove={delta => move(i, i + delta)}
            onPaste={next => (onPaste ? onPaste(i, next) : onChange(team.map((s, j) => (j === i ? next : s))))}
            onBest={() => { const found = bestPreset(team, i, data, format.genLimit); return found.index === null ? null : found.set; }}
            onDrag={phase => {
              if (phase === 'start') setDrag({ from: i, over: null });
              else if (phase === 'over') setDrag(d => (d && d.over !== i ? { ...d, over: i } : d));
              else if (phase === 'drop') { if (drag) move(drag.from, i); setDrag(null); }
              else setDrag(null);
            }}
            data={data}
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
          <EmptySlot key={`empty-${i}`} onClick={() => { setOpenIndex(null); onAddClick?.(); }} />
        ))}
      </div>
    </section>
  );
}
