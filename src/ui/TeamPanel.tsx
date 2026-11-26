import type { EngineData } from '../engine/data';
import { battleName, battleSpecies, isMega } from '../engine/dex';
import type { Format } from '../engine/format';
import { measuredSubRoles } from '../engine/subRoles';
import type { TeamSet } from '../engine/sets';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setEditing } from './editing';
import { bestPreset, bestPresetIndex } from '../engine/bestPreset';
import { ImproveSetsDialog } from './ImproveSetsDialog';
import { cancelPrepareFill, prepareFill, prepareImproveSets } from './useRanking';
import { ImportDialog } from './ImportDialog';
import type { ImportReview } from './importReview';
import { FillPanel } from './FillPanel';
import { handOffOpponent } from './duelHandoff';
import { hint as bubble } from './MoveTip';
import { duplicateSpecies, missingFormeItem } from '../engine/legalTeam';
import { SMALL, useBackClose } from './useBackClose';
import { Icon } from './icons';
import { useFitCount } from './useFit';
import { useMediaQuery } from './useMediaQuery';
import { draggedSet, dragStart, endSetDrag, onSetDrag } from './teamDrag';
import { t } from '../i18n';
import { useLang } from '../i18n/react';
import { animated } from './team/viewTransition';
import { ClearTeamButton, TeamMoreMenu } from './team/TeamHeadParts';
import { TypeTextContext, TYPE_STEPS, typesOverflow } from './team/typeFit';
import type { EditorGradeInfo, Lift, MoveProposal, SlotActions } from './team/slotTypes';

export type { EditorGradeInfo, MoveProposal } from './team/slotTypes';
import { SlotGhost } from './team/SlotGhost';
import { EmptySlot } from './team/EmptySlot';
import { TeamSlot } from './team/TeamSlot';


interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  /** Il voto del team (null senza voto): sul telefono un chip nell'editor dice di quanto cambia mentre modifichi. */
  grade?: EditorGradeInfo | null;
  onChange: (team: TeamSet[]) => void;
  onAdd: (set: TeamSet) => void;
  onReplace: (index: number) => void;
  /** Membro tolto con la ×: se manca, si aggiorna solo il team (senza Annulla). */
  onRemove?: (index: number) => void;
  /** Candidato trascinato dalla lista Pokémon: sopra un membro lo sostituisce (index), sopra uno slot vuoto lo aggiunge (null). */
  onDropSet?: (index: number | null, set: TeamSet) => void;
  onAllowMultipleMegas: () => void;
  /** Membro aperto nell'editor (null se nessuno). */
  onOpenChange?: (index: number | null) => void;
  /** Ogni cambio chiude l'editor aperto (es. si sceglie una sezione nella barra laterale). */
  closeSignal?: number;
  /** Ogni cambio apre la finestra Migliora i set (dal Coaching, quando nessuna sostituzione singola risolve i problemi). */
  improveSignal?: number;
  /** Team compresso: ogni carta diventa la sola icona del box (con il puntino degli avvisi). */
  collapsed?: boolean;
  /** Completa team aperto o chiuso: intanto la pagina spegne il suo magenta (resta solo l'azione migliore del pannello). */
  onFillOpenChange?: (open: boolean) => void;
  /** Set incollato al posto del membro (può essere un altro Pokémon); se manca, si aggiorna solo il team. */
  onPaste?: (index: number, set: TeamSet) => void;
  /** Set intero cambiato nell'editor (preset Smogon, I miei set, spread più usati), annullabile; se manca, si aggiorna solo il team. */
  onSetChange?: (index: number, set: TeamSet) => void;
  /** Applica di un consiglio della Sfida: il set nuovo e il cambio in parole (per l'avviso Annulla). */
  onTipApply?: (index: number, set: TeamSet, change: string) => void;
  /** Azioni sull'intero team, annullabili: preset migliori per tutti, Completa team, team da torneo caricato, svuota team. */
  onBulk?: (kind: 'presets' | 'fill' | 'clear' | 'tournament', team: TeamSet[]) => void;
  /** Clic su uno slot vuoto: porta alla ricerca dei Pokémon. */
  onAddClick?: () => void;
  /** Importa / Esporta: a destra nella testata, prima di Svuota team. */
  io?: ReactNode;
  /** Team salvati: una linguetta sua nella barra a destra, prima di Importa ed Esporta. */
  saved?: ReactNode;
  /** Sulla targa, dopo il numero: il nome del team salvato in uso. */
  plateName?: ReactNode;
  /** Proposta di mossa del coach: a ogni nonce nuovo apre l'editor del membro e la mostra con Applica / Annulla. */
  proposal?: MoveProposal | null;
  /** Proposta chiusa: applicata (true) o annullata (false). */
  onProposalDone?: (applied: boolean) => void;
}


export function TeamPanel({ team, format, data, grade = null, onChange, onAdd, onReplace, onRemove, onDropSet, onAllowMultipleMegas, onOpenChange, closeSignal, improveSignal, collapsed = false, onFillOpenChange, onPaste, onSetChange, onTipApply, onBulk, onAddClick, proposal, onProposalDone, io, saved, plateName }: Props) {
  const lang = useLang();
  // Un solo membro aperto alla volta: il suo editor scende sotto la fila del team
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Sotto-ruoli misurati del membro aperto: l'editor dice quello che dice il voto (stessa cache dell'area Ruoli). Solo
  // lui: i ruoli si vedono nell'editor, e misurarli per tutti a ogni disegno costava (sul telefono un secondo all'avvio)
  const subRoles = useMemo(() => team.map((set, i) => (i === openIndex ? measuredSubRoles(set, team, data) : undefined)), [team, data, openIndex]);
  // Il voto di quando si è aperto un membro (il primo voto che arriva, se in quel momento non c'era): il chip
  // dell'editor sul telefono dice di quanto è cambiato. Resta anche se il voto sparisce un attimo (EV oltre 510)
  const [gradeFrom, setGradeFrom] = useState<number | null>(null);
  // "Lascialo a" della Sfida: il compagno si apre già sulla scheda Sfida (telefono)
  const [startTab, setStartTab] = useState<{ index: number; tab: 'duel'; key: number } | null>(null);
  useEffect(() => { setGradeFrom(openIndex === null ? null : grade?.overall ?? null); }, [openIndex]);
  useEffect(() => { if (openIndex !== null && gradeFrom === null && grade) setGradeFrom(grade.overall); }, [openIndex, gradeFrom, grade]);
  const editorGrade = grade ? { ...grade, from: gradeFrom ?? grade.overall } : null;
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
  const typeKey = `${lang}|${collapsed}|${team.map(set => battleSpecies(set)?.types.join('/') ?? '?').join(',')}`;
  const typeStep = useFitCount(slotsRef, 3, typeKey, undefined, true, typesOverflow);
  const focusCard = (i: number) => requestAnimationFrame(() => slotsRef.current?.querySelectorAll<HTMLElement>('.slot > .slot-card > .slot-toggle')[i]?.focus());
  const step = (from: number, delta: number) => {
    const to = (from + delta + team.length) % team.length;
    if (openIndex !== null) animated(() => setOpenIndex(to));
    focusCard(to);
  };
  // Editor aperto: i tasti 1-6 aprono il membro in quella posizione (fuoco sulla sua carta, come con le frecce). Non mentre
  // si scrive (campi, menu a tendina), con una finestra, un menu o una tendina aperti, né con Ctrl/Alt/Maiusc/Cmd
  const openKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  openKey.current = e => {
    if (openIndex === null || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing) return;
    const n = '123456'.indexOf(e.key);
    if (n < 0 || e.key.length !== 1) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target && (target.isContentEditable || target.closest('input, textarea, select, [role="combobox"], [role="textbox"], [contenteditable]'))) return;
    if (document.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], details.popover[open], details.spread-panel[open], dialog[open]')) return;
    if (n >= team.length) return;
    e.preventDefault();
    if (n !== openIndex) animated(() => setOpenIndex(n));
    focusCard(n);
  };
  const editorOpen = openIndex !== null;
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => openKey.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editorOpen]);
  // Riordino: trascinando o con Alt + frecce; il membro aperto resta aperto nella nuova posizione.
  // `from` -1: un candidato trascinato dalla lista Pokémon (teamDrag.ts); `over` oltre i membri = uno slot vuoto
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  // Il trascinamento dalla lista finisce fuori dal team (o annullato con Esc): niente slot evidenziato
  // La carta che segue il mouse trascinando: un membro del team (lift) o un candidato dalla lista, disegnato come carta del
  // team (grande come le carte del team aperto, presa più o meno al centro)
  const [ghost, setGhost] = useState<{ set: TeamSet; index: number; at: Lift } | null>(null);
  useEffect(() => onSetDrag(set => {
    if (!set) { setDrag(d => (d?.from === -1 ? null : d)); setGhost(g => (g?.index === -1 ? null : g)); return; }
    const point = dragStart();
    if (!point) return;
    const card = slotsRef.current?.querySelector<HTMLElement>('.band:not(.collapsed) .slot.filled > .slot-card, .band:not(.collapsed) .slot.empty');
    const box = card?.getBoundingClientRect();
    const w = box?.width || 150;
    const h = box?.height || 226;
    setGhost({ set, index: -1, at: { x: point.x, y: point.y, dx: w / 2, dy: h * 0.45, w, h, collapsed: false } });
  }), []);
  const dropSet = (i: number) => {
    const set = draggedSet();
    endSetDrag();
    setDrag(null);
    if (!set) return;
    // La stessa specie già in un altro slot non entra due volte (la lista può non essersi ancora aggiornata)
    if (team.some((s, j) => j !== i && s.species === set.species)) return;
    setOpenIndex(null);
    if (onDropSet) onDropSet(i < team.length ? i : null, set);
    else if (i < team.length) onChange(team.map((s, j) => (j === i ? set : s)));
    else onAdd(set);
  };
  const overSlot = (i: number) => setDrag(d => (d ? (d.over !== i ? { ...d, over: i } : d) : draggedSet() ? { from: -1, over: i } : d));
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
  // Aperta da fuori (il Coaching): chiudendo, il fuoco torna dove era (il pulsante del Coaching), non sul pulsante del team
  const reopenFocus = useRef<HTMLElement | null>(null);
  const closeConfirm = () => {
    setConfirmPresets(false);
    const back = reopenFocus.current;
    reopenFocus.current = null;
    (back?.isConnected ? back : presetsButton.current)?.focus();
  };
  const lastImprove = useRef(improveSignal);
  useEffect(() => {
    if (improveSignal === lastImprove.current) return;
    lastImprove.current = improveSignal;
    if (!team.length) return;
    reopenFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmPresets(true);
  }, [improveSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  // Team pieno e fermo da un secondo e mezzo: Migliora i set si prepara in sottofondo, al clic la finestra è già pronta
  useEffect(() => {
    if (team.length < 6 || !data.stats) return;
    const timer = setTimeout(() => prepareImproveSets(team, data, format.genLimit), 1500);
    return () => clearTimeout(timer);
  }, [team, data, format.genLimit]);
  // Team incompleto e fermo da un secondo e mezzo: le proposte di partenza di Completa team si preparano in sottofondo.
  // Appena il team cambia, la preparazione vecchia si ferma subito (non fa aspettare i voti della lista)
  useEffect(() => {
    cancelPrepareFill();
    if (team.length >= 6 || !data.stats) return;
    const timer = setTimeout(() => prepareFill(team, format, data), 1500);
    return () => clearTimeout(timer);
  }, [team, data, format]);
  // Completa team: pannello con le proposte e i team da torneo
  const [filling, setFilling] = useState(false);
  // Telefono e tablet: le azioni della testata in un solo menu (TeamMoreMenu)
  const phoneMenu = useMediaQuery('(max-width: 1099px)');
  const headRef = useRef<HTMLDivElement>(null);
  const fillToggle = useRef<HTMLButtonElement>(null);
  // Chiudendo il pannello il focus torna al pulsante
  const closeFill = useCallback(() => { setFilling(false); fillToggle.current?.focus(); }, []);
  const canFill = team.length < 6 && !!data.stats;
  // Team pieno o senza statistiche: il pannello si chiude (e non si riapre da solo dopo)
  useEffect(() => { if (!canFill) setFilling(false); }, [canFill]);
  const fillOpenChange = useRef(onFillOpenChange);
  fillOpenChange.current = onFillOpenChange;
  useEffect(() => { fillOpenChange.current?.(filling); }, [filling]);
  // Smontando il team col pannello aperto la pagina non resta spenta
  useEffect(() => () => fillOpenChange.current?.(false), []);
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
      else if (phase === 'over') overSlot(i);
      else if (phase === 'drop') { if (draggedSet()) dropSet(i); else { if (drag) move(drag.from, i); setDrag(null); } }
      else setDrag(null);
      if (phase === 'drop' || phase === 'end') setGhost(null);
    },
    lift: (i, at) => { if (team[i]) setGhost({ set: team[i], index: i, at }); },
    paste: (i, next, review) => {
      if (onPaste) onPaste(i, next); else onChange(team.map((s, j) => (j === i ? next : s)));
      if (review) setAsk({ index: i, review });
    },
    best: i => { const found = bestPreset(team, i, data, format.genLimit); return found.index === null ? null : found.set; },
    bestIndex: i => bestPresetIndex(team, i, data, format.genLimit),
    ignoreWarning: onAllowMultipleMegas,
    change: (i, next) => onChange(team.map((s, j) => (j === i ? next : s))),
    setChange: (i, next) => { if (onSetChange) onSetChange(i, next); else onChange(team.map((s, j) => (j === i ? next : s))); },
    tip: (i, next, change) => {
      if (onTipApply) onTipApply(i, next, change);
      else if (onSetChange) onSetChange(i, next);
      else onChange(team.map((s, j) => (j === i ? next : s)));
    },
    openWith: (i, opponent) => {
      const member = team[i];
      if (!member) return;
      handOffOpponent(member.species, opponent);
      setStartTab({ index: i, tab: 'duel', key: Date.now() });
      animated(() => setOpenIndex(i));
      focusCard(i);
    },
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
    lift: (i, at) => live.current.lift(i, at),
    paste: (i, next, review) => live.current.paste(i, next, review),
    best: i => live.current.best(i),
    bestIndex: i => live.current.bestIndex(i),
    ignoreWarning: () => live.current.ignoreWarning(),
    change: (i, next) => live.current.change(i, next),
    setChange: (i, next) => live.current.setChange(i, next),
    tip: (i, next, change) => live.current.tip(i, next, change),
    openWith: (i, opponent) => live.current.openWith(i, opponent),
    remove: i => live.current.remove(i),
    replace: i => live.current.replace(i),
    proposalDone: applied => live.current.proposalDone(applied),
  }), []);
  // Il titolo della targa: la parola Team e quanti sono (i lettori di schermo sentono "Team (n/6)")
  const title = t(lang, 'team.title', { n: team.length });
  return (
    <section aria-label={t(lang, 'team.region')} className={`team${collapsed ? ' collapsed' : ''}`}>
      <div className="team-head" ref={headRef}>
        {/* La targa del team: la parola Team, quanti sono e il nome del team salvato in uso (i team salvati hanno la loro
            linguetta a destra) */}
        <div className="team-plate">
          <h2>
            <span aria-hidden="true">Team</span>
            <span className="team-count" aria-hidden="true"><b key={team.length}>{team.length}</b>/6</span>
            <span className="visually-hidden">{title}</span>
          </h2>
          {plateName}
        </div>
        {/* Una striscia sola, tutto alto e inclinato uguale: Team salvati accanto alla targa, poi la guida; a destra Importa,
            Esporta e il link in un gruppo, e il cestino */}
        {saved && <div className="team-saved">{saved}</div>}
        {/* La guida: Completa team finché mancano Pokémon, Migliora i set col team pieno */}
        <div className="team-guide-slot">
          {canFill ? (
            // Anche a team vuoto: propone team interi del tipo scelto; il pannello si apre sotto il pulsante
            <span className="fill-anchor">
              <button type="button" className="team-guide" data-fill-toggle aria-expanded={filling} aria-haspopup="dialog" ref={fillToggle}
                {...bubble(t(lang, 'team.fillTitle'))} onClick={() => setFilling(open => !open)}
                // Il calcolo parte già quando ci si avvicina al pulsante: al clic le proposte sono spesso già pronte
                onPointerEnter={() => prepareFill(team, format, data)} onFocus={() => prepareFill(team, format, data)}>
                <Icon name="spark" /> <span className="btn-label">{t(lang, 'team.fill')}</span>
              </button>
              {filling && (
                <FillPanel team={team} format={format} data={data} onClose={closeFill} onApply={proposal => {
                  setFilling(false);
                  setOpenIndex(null);
                  if (onBulk) onBulk('fill', proposal.team); else onChange(proposal.team);
                }} onLoadTeam={next => {
                  setFilling(false);
                  setOpenIndex(null);
                  if (onBulk) onBulk('tournament', next); else onChange(next);
                }} />
              )}
            </span>
          ) : team.length > 0 && (
            <button type="button" className="team-guide" ref={presetsButton}
              aria-haspopup="dialog" {...bubble(t(lang, 'team.bestPresetsTitle'))} onClick={() => setConfirmPresets(true)}
              // Il calcolo parte già quando ci si avvicina al pulsante: al clic la finestra è spesso già pronta
              onPointerEnter={() => prepareImproveSets(team, data, format.genLimit)} onFocus={() => prepareImproveSets(team, data, format.genLimit)}>
              <Icon name="spark" /> <span className="btn-label">{t(lang, 'team.bestPresets')}</span>
            </button>
          )}
        </div>
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
        {phoneMenu && <TeamMoreMenu headRef={headRef} saved={!!saved} io={!!io} canClear={team.length > 0} />}
        {/* Scorciatoie, sempre allo stesso posto a destra: Importa, Esporta e il link in un gruppo, poi Svuota a parte */}
        <div className="team-quick">
          {io && <div className="team-io">{io}</div>}
          {/* Svuota: il cestino, staccato da Importa ed Esporta da una barretta; il fumetto come quello di Esporta */}
          {team.length > 0 && (
            <ClearTeamButton onClear={() => {
              setOpenIndex(null);
              if (onBulk) onBulk('clear', []); else onChange([]);
            }} />
          )}
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">{moveNote}</p>
      {ghost && (
        <SlotGhost at={ghost.at}>
          <TypeTextContext.Provider value={typeStep > 0}>
            <TeamSlot index={Math.max(ghost.index, 0)} total={team.length} set={ghost.set} subRoles={ghost.index >= 0 ? subRoles[ghost.index] : undefined}
              dragging={false} dropTarget={false} data={data} format={format} warning={null} open={false} actions={actions} collapsed={ghost.at.collapsed} />
          </TypeTextContext.Provider>
        </SlotGhost>
      )}
      <div className={`slots types-${TYPE_STEPS[typeStep]}${openIndex !== null ? ' editing' : ''}`} ref={slotsRef}
        // Uscendo dalla fila del team lo slot evidenziato si spegne
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(d => (d && d.over !== null ? { ...d, over: null } : d)); }}>
        <TypeTextContext.Provider value={typeStep > 0}>
        {team.map((set, i) => (
          <TeamSlot
            key={keys[i]}
            index={i}
            total={team.length}
            set={set}
            team={openIndex === i ? team : undefined}
            proposal={proposal?.index === i ? proposal : null}
            subRoles={subRoles[i]}
            dragging={drag?.from === i}
            dropTarget={drag !== null && drag.over === i && drag.from !== i}
            data={data}
            format={format}
            warning={warningFor(set, i)}
            repeated={repeated.includes(i)}
            open={openIndex === i}
            grade={openIndex === i ? editorGrade : null}
            startTab={startTab?.index === i ? startTab : null}
            actions={actions}
            collapsed={collapsed}
          />
        ))}
        </TypeTextContext.Provider>
        {Array.from({ length: 6 - team.length }, (_, i) => (
          <EmptySlot key={`empty-${i}`} quiet={i > 0} onClick={() => { setOpenIndex(null); onAddClick?.(); }}
            dropTarget={drag?.from === -1 && drag.over === team.length + i}
            onDragOver={() => overSlot(team.length + i)} onDrop={() => dropSet(team.length + i)} />
        ))}
      </div>
    </section>
  );
}
