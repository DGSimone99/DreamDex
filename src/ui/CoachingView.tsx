import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { CoachAdvice, Coaching, CoachProblem } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { areaOfProblem, areaValue, PROPOSAL_AREAS, proposalGroups, type Proposal, type ProposalArea, type ProposalGroup } from '../engine/coachProposals';
import { columnOf } from '../engine/coachSteps';
import { battleSpecies } from '../engine/dex';
import type { MoveFix } from '../engine/moveFixes';
import type { TeamRating } from '../engine/rating';
import { rolesPointsLabel } from '../engine/rolesArea';
import { areaSnapshot, type AreaSnapshot } from '../engine/teamGain';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { rolesValue } from './AreaDetail';
import { EeveeMoment } from './EeveeMoment';
import { Icon } from './icons';
import { useMemberTip } from './MemberCard';
import { isThreat, MoreProblems, problemEntries, ProblemChip, type ProblemEntry } from './ProblemPill';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { useFitCount } from './useFit';

/** Il voto in più di una proposta: "+3", a pari voto "±0" (mai "+0"). */
export const gainText = (gain: number) => (gain > 0 ? `+${gain}` : gain < 0 ? `−${-gain}` : '±0');

/** Quanto resta accesa la riga aperta dalla testata di un'area. */
export const FLASH_MS = 2000;

/** Righe per pagina al più (e senza misura: jsdom, telefono). */
export const ROWS_PER_PAGE = 4;

/** Le azioni sulle proposte: applicarle (Applica) e aprirle nella scheda Pokémon o nell'editor. */
interface RowActions {
  onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void; onApplyFix: (fix: CoachFix) => void; onApplyMove: (fix: MoveFix) => void;
}

/** Le debolezze in comune (un malus di Bonus/Malus) le dice già la Difesa ("0 reggono"): non si ripetono fra le pillole. */
const shown = (p: CoachProblem) => !p.key.startsWith('redundancy:sharedWeak:');

/** Il nome dell'area come nelle schede (Offesa, Difesa, Velocità, Ruoli, Bonus/Malus) e le Regole. */
const AREA_NAME: Record<ProposalArea, 'area.strength' | 'area.defense' | 'area.speed' | 'area.roles' | 'area.bonusMalus' | 'coach.area.rules'> = {
  strength: 'area.strength', defense: 'area.defense', speed: 'area.speed', roles: 'area.roles', bonusMalus: 'area.bonusMalus', rules: 'coach.area.rules',
};

/** Il valore di un'area da scrivere: Offesa, Difesa e Velocità arrotondate, Bonus/Malus col segno ("+6"), Ruoli "7/8 +2". */
function areaText(snapshot: AreaSnapshot, area: ProposalArea): string | null {
  if (area === 'rules') return null;
  if (area === 'roles') return [`${snapshot.roles.covered}/${snapshot.roles.total}`, rolesPointsLabel(snapshot.roles.points)].filter(Boolean).join(' ');
  if (area === 'bonusMalus') return gainText(snapshot.bonusMalus).replace('±0', '0');
  const v = snapshot[area];
  return v === null ? null : String(Math.round(v));
}

/** Una riga della zona centrale: l'area, quanto cambia ("75 → 80") e i problemi che la proposta risolve lì. */
interface AreaLine { area: ProposalArea; from: string | null; to: string | null; up: boolean; entries: ProblemEntry[] }

/** Righe di aree al più in una proposta: oltre, le aree che salgono senza problemi si mettono in fila in una riga sola. */
const MAX_LINES = 3;

/**
 * Cosa cambia con una proposta, per area: un'area compare se la proposta risolve lì dei problemi (le loro pillole) o se
 * il suo valore sale ("da → a" dai valori del voto di ora e del voto col cambio, `after`, letti dal voto già calcolato
 * nella classifica: niente conti in più). Le aree che scendono non hanno una riga loro (il +N è già il netto); con dei
 * problemi risolti la riga dice comunque quanto cambia. Prima le aree coi problemi, poi quelle che salgono.
 */
function areaLines(p: Proposal, problems: CoachProblem[], before: AreaSnapshot | null): { lines: AreaLine[]; merged: AreaLine[] } {
  const solves = new Set(p.fix.solves);
  // Chi entra non "risolve" la minaccia che è lui stesso (entrando nel team non la regge, la porta)
  const self = p.kind === 'fix' ? p.fix.species : null;
  const solved = problems.filter(x => solves.has(x.key) && shown(x) && !(x.category === 'meta' && self && x.subjects?.includes(self)));
  const after = p.fix.after ?? null;
  const all: AreaLine[] = PROPOSAL_AREAS.map(area => {
    const entries = problemEntries(solved.filter(x => areaOfProblem(x.category) === area));
    const was = before ? areaValue(before, area) : null;
    const now = after ? areaValue(after, area) : null;
    const changed = was !== null && now !== null && was !== now;
    return { area, entries, up: changed && now! > was!, from: changed ? areaText(before!, area) : null, to: changed ? areaText(after!, area) : null };
  }).filter(l => l.entries.length > 0 || l.up);
  const withChips = all.filter(l => l.entries.length > 0);
  const rising = all.filter(l => l.entries.length === 0);
  if (withChips.length + rising.length <= MAX_LINES) return { lines: [...withChips, ...rising], merged: [] };
  return { lines: withChips, merged: rising };
}

/** "75 → 80": il valore di prima tenue, la freccia, quello dopo in verde (o in rosso se scende); a parole per lo screen reader. */
function Change({ from, to, up }: { from: string; to: string; up: boolean }) {
  const tr = useT();
  return (
    <span className={`coach-change${up ? ' is-up' : ' is-down'}`}>
      <span className="coach-from" aria-hidden="true">{from} →</span>
      <span className="coach-to" aria-hidden="true">{to}</span>
      <span className="visually-hidden">{tr('coach.row.change', { from, to })}</span>
    </span>
  );
}

/** Una riga di area: nome, quanto cambia e le pillole dei problemi risolti (quelle che non stanno nel "+N", col tooltip). */
function AreaRow({ line }: { line: AreaLine }) {
  const tr = useT();
  const lang = useLang();
  const ref = useRef<HTMLSpanElement>(null);
  const key = `${lang}|${line.entries.map(e => `${e.problem.key}|${e.role ?? ''}`).join('#')}`;
  const fit = useFitCount(ref, line.entries.length, key, undefined, true);
  const hidden = line.entries.slice(fit);
  return (
    <div className="coach-ar">
      <span className="coach-ar-who">
        <b>{tr(AREA_NAME[line.area])}</b>
        {line.from !== null && line.to !== null && <Change from={line.from} to={line.to} up={line.up} />}
      </span>
      {line.entries.length > 0 && (
        <span ref={ref} className="coach-ar-chips">
          {line.entries.slice(0, fit).map(entry => <ProblemChip key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} as="span" />)}
          {hidden.length > 0 && <MoreProblems hidden={hidden} as="span" />}
        </span>
      )}
    </div>
  );
}

/** Le aree che salgono senza problemi, in fila in una riga sola quando le righe sarebbero troppe ("Offesa 91 → 93 · Velocità 51 → 58"). */
function MergedRow({ lines }: { lines: AreaLine[] }) {
  const tr = useT();
  return (
    <div className="coach-ar is-merged">
      {lines.map(line => (
        <span key={line.area} className="coach-ar-who">
          <b>{tr(AREA_NAME[line.area])}</b>
          {line.from !== null && line.to !== null && <Change from={line.from} to={line.to} up={line.up} />}
        </span>
      ))}
    </div>
  );
}

/** Il nome della proposta per lo screen reader (e per il pulsante Applica): "Ting-Lu al posto di Kingambit, voto +3". */
function proposalName(p: Proposal, tr: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): string {
  const gain = gainText(p.fix.gain);
  if (p.kind === 'move') {
    const to = gameName('move', p.fix.to, lang);
    return p.fix.from
      ? tr('coach.row.moveName', { to, from: gameName('move', p.fix.from, lang), member: p.fix.member, gain })
      : tr('coach.row.moveNameEmpty', { to, member: p.fix.member, gain });
  }
  return p.fix.kind === 'add' ? tr('coach.row.addName', { species: p.fix.species, gain }) : tr('coach.row.swapName', { species: p.fix.species, member: p.fix.member ?? '', gain });
}

/** Il primo tipo di chi entra (o del membro che cambia mossa): il colore della zona del Pokémon, come le carte del team. */
const firstType = (p: Proposal) => (battleSpecies(p.fix.set)?.types[0] as string | undefined) ?? '';

/** Chi lascia il posto, per il titolo della tendina: "Al posto di Kingambit", "In un posto libero", "Su Kingambit". */
function seatText(p: Proposal, tr: ReturnType<typeof useT>): string {
  if (p.kind === 'move') return tr('coach.alt.seatMove', { member: p.fix.member });
  return p.fix.kind === 'add' ? tr('coach.alt.seatAdd') : tr('coach.alt.seatSwap', { member: p.fix.member ?? '' });
}

/**
 * La nota corta di un'alternativa: quanti dei problemi principali della prima proposta del gruppo risolve ("3 minacce su
 * 4", "stessi problemi"). I problemi principali sono quelli che la prima proposta risolve e che possono guidare una
 * proposta (senza la coverage minore e le debolezze in comune). Un gruppo che alza solo il voto non ha nota.
 */
function coverNote(option: Proposal, best: Proposal, group: ProposalGroup, problems: CoachProblem[], tr: ReturnType<typeof useT>): string {
  if (!group.lead) return '';
  const byKey = new Map(problems.map(x => [x.key, x]));
  const mains = best.fix.solves.filter(k => byKey.has(k) && shown(byKey.get(k)!) && !(byKey.get(k)!.category === 'coverage' && byKey.get(k)!.severity === 'minor'));
  const m = mains.length;
  const n = mains.filter(k => option.fix.solves.includes(k)).length;
  if (m === 0 || n === m) return tr('coach.alt.noteSame');
  const threats = mains.every(k => isThreat(byKey.get(k)!));
  const key = threats ? (n === 1 ? 'coach.alt.noteThreats1' : 'coach.alt.noteThreatsN') : (n === 1 ? 'coach.alt.noteProblems1' : 'coach.alt.noteProblemsN');
  return tr(key, { n, m });
}

/**
 * La tendina delle alternative: un listbox sotto il pulsante "Altre N", sfondo Ground, con il titolo e le proposte del
 * gruppo (la scelta per prima, poi le altre dalla più utile). Frecce, Home/Fine per muoversi, Invio o Spazio per scegliere,
 * Esc (o Tab, o un clic fuori) per chiudere: il fuoco torna sul pulsante.
 */
function AlternativesMenu({ id, group, current, problems, onChoose, onClose, button }: {
  id: string; group: ProposalGroup; current: number; problems: CoachProblem[];
  onChoose: (index: number) => void; onClose: (refocus: boolean) => void; button: RefObject<HTMLButtonElement | null>;
}) {
  const tr = useT();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const best = group.options[0];
  // La scelta per prima, poi le altre nell'ordine del gruppo (dalla più utile)
  const order = [current, ...group.options.map((_, i) => i).filter(i => i !== current)];
  const options = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  useLayoutEffect(() => {
    options()[0]?.focus();
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || button.current?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose, button]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = options();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); }
    else if (e.key === 'Tab') onClose(false);
    else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) { e.preventDefault(); onChoose(order[at]); }
  };
  // Posti diversi nella stessa tendina (lo stesso Pokémon in un altro posto): il titolo non nomina il posto, lo dice ogni voce
  const seat = (p: Proposal) => seatText(p, tr);
  const mixed = group.options.some(p => seat(p) !== seat(best));
  const reason = tr(group.lead ? 'coach.alt.same' : 'coach.alt.gainOnly');
  const title = mixed ? `${reason.charAt(0).toLocaleUpperCase()}${reason.slice(1)} · ${tr('coach.alt.order')}` : `${seat(best)}, ${reason} · ${tr('coach.alt.order')}`;
  const titleId = `${id}-title`;
  return (
    <div ref={ref} className="coach-menu" onKeyDown={onKey}>
      <p id={titleId} className="coach-menu-title">{title}</p>
      <div id={id} role="listbox" aria-labelledby={titleId} className="coach-menu-list">
        {order.map(i => {
          const option = group.options[i];
          const chosen = i === current;
          const note = coverNote(option, best, group, problems, tr);
          const types = option.kind === 'fix' ? ((battleSpecies(option.fix.set)?.types ?? []) as string[]) : [];
          return (
            <div key={i} role="option" tabIndex={-1} aria-selected={chosen} className={`coach-opt${chosen ? ' is-chosen' : ''}`}
              aria-label={[proposalName(option, tr, lang), note].filter(Boolean).join(' · ')} onClick={() => onChoose(i)}>
              <Sprite species={option.kind === 'fix' ? option.fix.species : option.fix.member} size={48} />
              <span className="coach-opt-name">
                <b>{option.kind === 'fix' ? option.fix.species : gameName('move', option.fix.to, lang)}</b>
                {types.length > 0 && <span className="coach-opt-types">{types.map(type => <TypeChip key={type} type={type} />)}</span>}
                {option.kind === 'move' && option.fix.from && <small>{tr('coach.row.insteadMove', { from: gameName('move', option.fix.from, lang) })}</small>}
                {mixed && option.kind === 'fix' && <small>{seat(option)}</small>}
              </span>
              <span className="coach-opt-note">{note}</span>
              <span className="coach-opt-gain">{gainText(option.fix.gain)}</span>
              <span className="coach-opt-use" aria-hidden="true">{tr(chosen ? 'coach.alt.chosen' : 'coach.alt.choose')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** La zona del Pokémon di un cambio: chi esce piccolo e spento, ⇄, chi entra grande (la sua carta col perché), il nome. */
function SwapArt({ fix, children }: { fix: CoachFix; children?: ReactNode }) {
  const tr = useT();
  const memberTip = useMemberTip();
  const gain = gainText(fix.gain);
  const why = fix.kind === 'swap' ? tr('mcard.inFor', { member: fix.member ?? '', gain }) : tr('mcard.added', { gain });
  return (
    <>
      {fix.kind === 'swap'
        ? <><span className="coach-art-out"><Sprite species={fix.member ?? ''} size={48} /></span><span className="coach-art-arrow" aria-hidden="true"><Icon name="swap" /></span></>
        : <span className="coach-art-add" aria-hidden="true"><Icon name="plus" /></span>}
      <span className="coach-art-in" {...memberTip.bind(fix.set, why)}><Sprite species={fix.species} size={96} /></span>
      <span className="coach-art-text">
        <b className="coach-art-name" {...memberTip.bind(fix.set, why)}>{fix.species}</b>
        <small>{fix.kind === 'swap' ? tr('coach.row.instead', { member: fix.member ?? '' }) : tr('coach.row.free')}</small>
        {children}
      </span>
      {memberTip.tip}
    </>
  );
}

/** La zona del Pokémon di un cambio di mossa: il membro, "Su Kingambit", ~~mossa vecchia~~ → mossa nuova, "cambio di mossa". */
function MoveArt({ fix, children }: { fix: MoveFix; children?: ReactNode }) {
  const tr = useT();
  const lang = useLang();
  return (
    <>
      <span className="coach-art-in is-member"><Sprite species={fix.member} size={80} /></span>
      <span className="coach-art-text is-move">
        <span className="coach-art-on">{tr('coach.row.on', { member: fix.member })}</span>
        <span className="coach-art-moves">
          {fix.from ? <s>{gameName('move', fix.from, lang)}</s> : <span className="coach-art-empty">{tr('coach.row.emptySlot')}</span>}
          <span aria-hidden="true">→</span>
          <b>{gameName('move', fix.to, lang)}</b>
        </span>
        <small>{tr('coach.row.moveKind')}</small>
        {children}
      </span>
    </>
  );
}

/**
 * Una riga della lista: a sinistra la zona del Pokémon (colore del primo tipo di chi entra, la lama di luce, il taglio
 * obliquo) con "Altre N ▾" se il gruppo ha alternative; al centro cosa cambia, per area; a destra il voto in più,
 * Applica (applica subito, annullabile) e il link alla scheda Pokémon (o al set per una mossa). `primary`: la prima riga
 * della prima pagina, l'unico Applica magenta della scheda.
 */
function ProposalRow({ group, choice, onChoose, primary, problems, before, actions, flash }: {
  group: ProposalGroup; choice: number; onChoose: (index: number) => void; primary: boolean; problems: CoachProblem[];
  before: AreaSnapshot | null; actions: RowActions; flash: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const p = group.options[Math.min(choice, group.options.length - 1)];
  const { lines, merged } = areaLines(p, problems, before);
  const name = proposalName(p, tr, lang);
  const alternatives = group.options.length - 1;
  const close = (refocus: boolean) => { setOpen(false); if (refocus) button.current?.focus(); };
  const altButton = alternatives > 0 && (
    <button ref={button} type="button" className="coach-alt" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(o => !o)}>
      {tr('coach.alt.button', { n: alternatives })}<span className="coach-alt-caret" aria-hidden="true">▾</span>
    </button>
  );
  const apply = () => (p.kind === 'fix' ? actions.onApplyFix(p.fix) : actions.onApplyMove(p.fix));
  const see = () => (p.kind === 'fix' ? actions.onFix(p.fix) : actions.onMoveFix(p.fix));
  return (
    <li className={`coach-row${p.kind === 'move' ? ' is-move' : ''}${open ? ' is-open' : ''}${flash ? ' is-flash' : ''}`} data-row={group.id} aria-label={name}>
      <div className="coach-art" style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}>
        {p.kind === 'fix' ? <SwapArt fix={p.fix}>{altButton}</SwapArt> : <MoveArt fix={p.fix}>{altButton}</MoveArt>}
      </div>
      <div className="coach-solves">
        {lines.map(line => <AreaRow key={line.area} line={line} />)}
        {merged.length > 0 && <MergedRow lines={merged} />}
      </div>
      <div className="coach-act">
        <span className="coach-gain"><small>{tr('coach.row.gain')}</small><b>{gainText(p.fix.gain)}</b></span>
        <button type="button" className={`coach-apply${primary ? ' is-primary' : ''}`} aria-label={tr('coach.row.applyAria', { name })} onClick={apply}>
          {tr('coach.row.apply')}
        </button>
        <button type="button" className="coach-see" onClick={see}
          aria-label={p.kind === 'fix' ? tr('coach.row.seeAria', { species: p.fix.species }) : tr('coach.row.openSetAria', { member: p.fix.member })}>
          <Icon name="search" />{tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet')}
        </button>
      </div>
      {open && <AlternativesMenu id={menuId} group={group} current={choice} problems={problems} button={button} onClose={close}
        onChoose={i => { onChoose(i); close(true); }} />}
    </li>
  );
}

/**
 * Quante righe stanno nell'altezza della lista (fino a ROWS_PER_PAGE), con l'altezza delle righe e lo spazio fra loro
 * dal CSS (--row-h, --row-gap); senza misura (jsdom) o con le righe alte quanto serve (telefono) ROWS_PER_PAGE.
 */
function useRowsPerPage(ref: RefObject<HTMLElement | null>): number {
  const [rows, setRows] = useState(ROWS_PER_PAGE);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = el.clientHeight;
      const style = getComputedStyle(el);
      const row = parseFloat(style.getPropertyValue('--row-h'));
      const gap = parseFloat(style.getPropertyValue('--row-gap')) || 0;
      if (!height || !row) { setRows(ROWS_PER_PAGE); return; }
      setRows(Math.max(1, Math.min(ROWS_PER_PAGE, Math.floor((height + gap) / (row + gap)))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return rows;
}

/** Le pagine: "‹ 1/3 ›" come in Coverage meta, coi nomi per lo screen reader. */
function Pager({ page, pages, from, to, onPage }: { page: number; pages: number; from: number; to: number; onPage: (page: number) => void }) {
  const tr = useT();
  if (pages <= 1) return null;
  return (
    <nav className="cm-pages coach-pages" aria-label={tr('coach.list.pages')}>
      <button type="button" className="cm-step" aria-label={tr('coach.list.prev')} title={tr('coach.list.prev')} disabled={page === 0} onClick={() => onPage(page - 1)}>
        <Icon name="prev" />
      </button>
      <span className="cm-at" aria-live="polite">
        <span aria-hidden="true">{page + 1}/{pages}</span>
        <span className="visually-hidden">{tr('coach.list.page', { from, to })}</span>
      </span>
      <button type="button" className="cm-step" aria-label={tr('coach.list.next')} title={tr('coach.list.next')} disabled={page === pages - 1} onClick={() => onPage(page + 1)}>
        <Icon name="next" />
      </button>
    </nav>
  );
}

/**
 * La scheda Coaching: una lista sola di proposte (cambi di Pokémon e di mossa), una riga per proposta, dalla più utile
 * (+N più alto); le proposte quasi uguali stanno in una riga con le loro alternative ("Altre N", proposalGroups).
 * In cima la riga verde delle aree senza problemi. Quattro righe per pagina (meno se l'altezza non basta), le pagine a destra
 * del titolo. Senza problemi: Eevee contento e il team da esportare; con problemi che nessuna proposta risolve: Eevee
 * pensieroso, i problemi e Migliora i set. `advice` null: i consigli si stanno calcolando (lo scheletro delle righe).
 * `focus`: un problema scelto nella testata di un'area (`nonce` cambia a ogni clic): si va alla pagina della prima riga
 * che lo risolve, che si porta in vista e si accende per un attimo.
 */
export function CoachingView({ coaching, advice, members, rating, onFix, onMoveFix, onApplyFix, onApplyMove, onExport, onImproveSets, onOverview, focus = null }: {
  coaching: Coaching; advice: CoachAdvice | null; members: number; rating: TeamRating | null;
  focus?: { key: string; nonce: number } | null;
  /** Nessun problema: copia il team per Showdown (vero se è andata). */
  onExport?: () => Promise<boolean>;
  /** Problemi senza proposte: apre Migliora i set. */
  onImproveSets?: () => void;
  /** Nessun problema: apre la Panoramica. */
  onOverview?: () => void;
} & RowActions) {
  const tr = useT();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLDivElement>(null);
  const perPage = useRowsPerPage(listBox);
  const { problems, bannedCount = 0 } = coaching;
  const groups = useMemo(() => (advice ? proposalGroups(problems, advice) : null), [problems, advice]);
  // La scelta fatta nella tendina di ogni riga, solo per i consigli con cui è nata (cambiano i consigli: si riparte dalla migliore)
  const [picks, setPicks] = useState<{ advice: CoachAdvice | null; chosen: Record<string, number> }>({ advice: null, chosen: {} });
  const chosen = picks.advice === advice ? picks.chosen : {};
  // La prima riga mostrata (non il numero di pagina): se cambia quante ne stanno, la pagina resta quella con quella riga
  const [start, setStart] = useState(0);
  const [flash, setFlash] = useState<{ nonce: number; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const handled = useRef<number | null>(null);
  useEffect(() => {
    // Una volta per clic, e solo coi consigli pronti (mentre si calcolano si aspetta)
    if (!focus || !groups || handled.current === focus.nonce) return;
    handled.current = focus.nonce;
    const solves = (p: Proposal) => p.fix.solves.includes(focus.key);
    let i = groups.findIndex(g => solves(g.options[Math.min(chosen[g.id] ?? 0, g.options.length - 1)]));
    if (i < 0) i = groups.findIndex(g => g.options.some(solves));
    if (i < 0) return;
    setStart(i);
    setFlash({ nonce: focus.nonce, id: groups[i].id });
  }, [focus, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!flash) return;
    const el = [...(root.current?.querySelectorAll('[data-row]') ?? [])].find(x => x.getAttribute('data-row') === flash.id);
    // Senza animazioni (prefers-reduced-motion) lo scorrimento è immediato
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
    const timer = window.setTimeout(() => setFlash(f => (f?.nonce === flash.nonce ? null : f)), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Sotto i 2 membri il coach non cerca problemi: l'invito ad aggiungere, non "nessun problema"
  if (members < 2) return <div className="coaching"><p className="coach-note coach-top">{tr('coach.addTwo')}</p></div>;

  const mapped = problems.filter(shown);
  // Le aree come nella riga verde: Offesa, Difesa, Ruoli (coi Bonus/Malus del Coaching). Niente Velocità: il Coaching
  // non ne dà mai problemi, quindi "nessun problema" lì non direbbe niente (anche con la Velocità bassa)
  const columns = [
    { key: 'offense', name: tr('area.strength'), value: rating?.areas.find(a => a.key === 'strength')?.value },
    { key: 'defense', name: tr('area.defense'), value: rating?.areas.find(a => a.key === 'defense')?.value },
    { key: 'roles', name: tr('area.roles'), text: rating ? rolesValue(rating) : '' },
  ].map(c => ({ ...c, text: 'text' in c ? c.text : c.value == null ? '' : String(Math.round(c.value)) }));
  const clean = columns.filter(c => !mapped.some(p => columnOf(p.category) === c.key));
  const banned = bannedCount > 0 && <p className="coach-note">{tr(bannedCount === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: bannedCount })}</p>;
  const cleanLine = clean.length > 0 && (
    <p className="coach-clean"><Icon name="check" />{tr('coach.clean.in')}{' '}
      <b>{clean.map(c => [c.name, c.text].filter(Boolean).join(' ')).join(' · ')}</b>
    </p>
  );

  // Nessun problema: il team è a posto
  if (problems.length === 0) {
    return (
      <div className="coaching" ref={root}>
        <div className="coach-empty is-clear">
          <EeveeMoment pose="happy" />
          <div className="coach-empty-text">
            <h3>{tr('coach.clear.title')}</h3>
            <p>{tr('coach.clear.text')}</p>
            {rating && (
              <p className="coach-empty-areas"><Icon name="check" />
                <span>{columns.map((c, i) => <span key={c.key}>{i > 0 && ' · '}{c.name} <b>{c.text}</b></span>)}</span>
              </p>
            )}
            <div className="coach-empty-actions">
              {onExport && (
                <button type="button" className="coach-btn" onClick={async () => setCopied(await onExport())}>
                  <Icon name={copied ? 'check' : 'copy'} />{tr('coach.clear.export')}
                </button>
              )}
              {onOverview && <button type="button" className="coach-link" onClick={onOverview}>{tr('coach.clear.overview')}<span aria-hidden="true"> ›</span></button>}
              {/* "Team copiato per Showdown" lo dice l'avviso dell'app (DoneToast, lo stesso di Esporta nella barra del team) */}
            </div>
          </div>
        </div>
        {banned}
      </div>
    );
  }

  // Problemi che nessuna proposta risolve (nessun cambio di Pokémon né di mossa)
  if (groups && groups.length === 0) {
    const entries = problemEntries(mapped);
    const SHOWN = 8;
    return (
      <div className="coaching" ref={root}>
        {cleanLine}
        <div className="coach-empty is-stuck">
          <EeveeMoment pose="thinking" />
          <div className="coach-empty-text">
            <h3>{tr('coach.stuck.title')}</h3>
            <p>{tr('coach.stuck.text')}</p>
            <ul className="coach-empty-chips" aria-label={tr('coach.stuck.problems')}>
              {entries.slice(0, SHOWN).map(entry => <ProblemChip key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} />)}
              {entries.length > SHOWN && <MoreProblems hidden={entries.slice(SHOWN)} />}
            </ul>
            <p className="coach-empty-hint">{tr('coach.stuck.hint')}</p>
            {onImproveSets && (
              <div className="coach-empty-actions">
                <button type="button" className="coach-btn" aria-haspopup="dialog" onClick={onImproveSets}><Icon name="spark" />{tr('team.bestPresets')}</button>
              </div>
            )}
          </div>
        </div>
        {banned}
      </div>
    );
  }

  const before = rating ? areaSnapshot(rating) : null;
  const total = groups?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.floor(start / perPage), pages - 1);
  const rows = groups ? groups.slice(page * perPage, (page + 1) * perPage) : [];
  const actions: RowActions = { onFix, onMoveFix, onApplyFix, onApplyMove };
  return (
    <div className="coaching" ref={root}>
      {cleanLine}
      <section aria-labelledby={`${id}-list`} className="coach-list">
        <div className="coach-list-head">
          {/* Il nome della sezione è il titolo, senza il numero (che i lettori di schermo sentono dopo, nel titolo) */}
          <h3 className="coach-sec"><span id={`${id}-list`}>{tr('coach.list.title')}</span>{groups && <span className="coach-count">{total}</span>}</h3>
          {groups && <Pager page={page} pages={pages} from={page * perPage + 1} to={Math.min(total, (page + 1) * perPage)} onPage={n => setStart(n * perPage)} />}
        </div>
        <div className="coach-list-box" ref={listBox}>
          {groups ? (
            <ol className="coach-rows">
              {rows.map((group, j) => (
                <ProposalRow key={group.id} group={group} choice={chosen[group.id] ?? 0} problems={problems} before={before} actions={actions}
                  primary={page === 0 && j === 0} flash={flash?.id === group.id}
                  onChoose={i => setPicks(s => ({ advice, chosen: { ...(s.advice === advice ? s.chosen : {}), [group.id]: i } }))} />
              ))}
            </ol>
          ) : (
            <>
              <ol className="coach-rows" aria-busy="true">
                {Array.from({ length: perPage }, (_, i) => <li key={i} className="coach-row skeleton" aria-hidden="true" />)}
              </ol>
              <p className="visually-hidden" role="status">{tr('coach.computing')}</p>
            </>
          )}
        </div>
      </section>
      {banned}
    </div>
  );
}
