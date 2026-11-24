import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { CoachProblem } from '../engine/coach';
import { needLabel, type Need } from '../engine/needs';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { FloatTip, HiddenText, TipGo, useFloatAnchor } from './FloatTip';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { Sprite } from './Sprite';
import { SPRITE_TIP_ROW } from './spriteSizes';
import { TipGlyph, TipHead, TipRow, TipRows, TipSec, TipTypeIcon } from './TipHead';
import { TypeIcons } from './typeIcons';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';
import { Typed } from './TypeText';
import { ThreatTip } from './dashboard/ThreatTip';

/** I tipi colorati; `plain`: senza colore (nella pillola l'icona del tipo è già davanti). */
export function ProblemText({ text, plain = false }: { text: string; plain?: boolean }) {
  return plain ? <>{text}</> : <Typed text={text} />;
}

/** Le minacce del meta: chi nessuno regge (Difesa) e chi nessuno manda KO (Offesa), con l'icona del Pokémon. */
export const isThreat = (p: CoachProblem) => p.category === 'meta' || p.category === 'metaHit';

/** I problemi "ruoli mancanti" (essenziali o importanti) coi ruoli come soggetti. */
export const isMissingRoles = (p: CoachProblem) => p.category === 'roles' && (p.key === 'roles:essential' || p.key === 'roles:important') && (p.subjects?.length ?? 0) > 0;

/**
 * Il testo intero di un problema per i tooltip: per i tipi della Difesa che qualcuno regge, anche quanti
 * ("solo 1 membro lo regge bene"); se nessuno lo regge lo dice già il testo.
 */
export function tipOf(p: CoachProblem, tr: ReturnType<typeof useT>): string {
  const held = p.counts?.held ?? 0;
  if (held === 0) return p.text;
  return `${p.text} · ${tr(held === 1 ? 'coach.pill.held1' : 'coach.pill.heldN', { n: held })}`;
}

/**
 * Il testo corto di un problema come pillola, uguale nelle righe del Coaching e nella testata delle aree: una minaccia con
 * l'icona e il nome del Pokémon; un ruolo mancante (`role`) con la × e il nome del ruolo; un tipo della Difesa con quanti
 * lo reggono ("Fuoco · 1 regge"); Difesa e Offesa con le icone dei tipi davanti e il testo senza colori; il resto col suo
 * testo. Ai lettori di schermo il testo intero dove la pillola lo accorcia.
 */
export function ProblemPill({ problem, role }: { problem: CoachProblem; role?: string }) {
  const tr = useT();
  const lang = useLang();
  const subjects = problem.subjects ?? [];
  const threat = isThreat(problem) && subjects.length > 0 ? subjects[0] : null;
  // Difesa e coverage: le icone dei tipi davanti, il testo senza colori (il tipo non si legge due volte)
  const typed = (problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0;
  const counts = problem.category === 'defense' && subjects.length === 1 ? problem.counts : undefined;
  if (threat) {
    return (
      <span className="coach-prob-text is-threat">
        <PokemonIcon name={threat} /><span className="coach-threat-name" aria-hidden="true">{threat}</span><span className="visually-hidden">{problem.text}</span>
      </span>
    );
  }
  if (role) return <span className="coach-prob-text coach-miss"><Icon name="close" />{needLabel(role as Need, lang)}</span>;
  if (counts) {
    return (
      <span className="coach-prob-text">
        <TypeIcons types={subjects} /><span aria-hidden="true">{typeName(subjects[0], lang)}{' '}
          <span className="coach-counts">· <span className={counts.held ? 'count-resist' : 'count-weak'}>{tr(counts.held === 0 ? 'coach.pill.held0' : counts.held === 1 ? 'coach.pill.held1' : 'coach.pill.heldN', { n: counts.held })}</span></span>
        </span><span className="visually-hidden">{problem.text}</span>
      </span>
    );
  }
  return (
    <span className="coach-prob-text">
      {typed && <TypeIcons types={subjects} />}
      <ProblemText text={problem.text} plain={typed} />
    </span>
  );
}

/**
 * Di cosa parla un problema, per la testata del suo tooltip e per le righe del "+N": una minaccia è il Pokémon (la sua
 * sprite), un ruolo mancante il ruolo, un problema di uno o due tipi i tipi; il resto la gravità ("Problema serio").
 */
function problemSubject({ problem, role }: ProblemEntry, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): { species?: string; lead?: ReactNode; title: string; plain: boolean } {
  const subjects = problem.subjects ?? [];
  if (isThreat(problem) && subjects.length > 0) return { species: subjects[0], title: subjects[0], plain: false };
  if (role) return { lead: <TipGlyph icon="roles" />, title: needLabel(role as Need, lang), plain: false };
  if ((problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0 && subjects.length <= 2) {
    return { lead: <TipTypeIcon type={subjects[0]} />, title: subjects.map(type => typeName(type, lang)).join(' / '), plain: false };
  }
  return { lead: <TipGlyph icon="warning" />, title: t(problem.severity === 'serious' ? 'tip.problem.serious' : 'tip.problem.minor'), plain: true };
}

/** Una pillola: un problema, o un ruolo mancante (`role`: una pillola per ruolo, possono riempirli Pokémon diversi). */
export type ProblemEntry = { problem: CoachProblem; role?: string };

/** I problemi come pillole: i ruoli mancanti una per ruolo, gli altri una per problema (nell'ordine dato). */
export const problemEntries = (problems: CoachProblem[]): ProblemEntry[] =>
  problems.flatMap(problem => (isMissingRoles(problem) ? problem.subjects!.map(role => ({ problem, role })) : [{ problem }]));

/** Il testo intero di una pillola (tooltip e lettori di schermo): il ruolo mancante col suo nome, il resto col problema. */
const fullText = ({ problem, role }: ProblemEntry, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>) =>
  (role ? needLabel(role as Need, lang) : tipOf(problem, t));

/**
 * Una pillola di problema, uguale nella testata delle aree e nelle righe del Coaching: il testo corto (ProblemPill) nel
 * colore della gravità. Mouse e fuoco: il tooltip DreamDex col problema intero. `onOpen`: la pillola è un pulsante (nella
 * testata: il Coaching ha una proposta per lei; il tooltip finisce con "Clic: vai a Coaching", TipGo); senza, si raggiunge col Tab solo per il tooltip. `as`: l'elemento
 * esterno (li in una lista, span altrove).
 */
export function ProblemChip({ entry, onOpen, go, as: Tag = 'li' }: { entry: ProblemEntry; onOpen?: () => void; as?: 'li' | 'span';
  /** Dove porta il clic (es. "Coverage meta"); senza, il Coaching. */
  go?: string }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<true>();
  const descId = useId();
  const { problem, role } = entry;
  const subject = problemSubject(entry, t, lang);
  // Il problema intero (anche per un ruolo mancante: la frase con tutti i ruoli che mancano)
  const full = tipOf(problem, t);
  const props = { className: `area-chip ${problem.severity}${onOpen ? ' is-link' : ''}`, 'data-key': problem.key, 'aria-describedby': descId, ...tip.bind(true) };
  const content = <><Icon name="warning" /><ProblemPill problem={problem} role={role} /></>;
  return (
    <Tag className="area-chip-item">
      {onOpen
        ? <button type="button" {...props} onClick={onOpen}>{content}</button>
        : <span tabIndex={0} {...props}>{content}</span>}
      {/* Il tooltip è solo visivo: le stesse parole ai lettori di schermo, e dove porta il pulsante */}
      <HiddenText id={descId}>{[full, onOpen ? (go ? t('area.problems.goTo', { place: go }) : t('overview.fix.go')) : ''].filter(Boolean).join(' · ')}</HiddenText>
      {/* Una minaccia del meta: lo stesso tooltip delle minacce della Panoramica (ThreatTip, scheda Meta della Copertura: la sprite, "Minaccia senza check"
          sotto il nome, l'uso nel meta, la ragione "Nessuno lo regge bene" o "Nessuno lo manda KO in due colpi") */}
      {tip.anchor && subject.species && (
        <ThreatTip rect={tip.anchor.rect} species={subject.species} status="open" usage={problem.usage}
          reasons={[{ text: t(problem.category === 'metaHit' ? 'dash.threatOffNone' : 'dash.threatDefNone'), state: 'open' }]}
          go={onOpen ? go ?? t('analysis.view.coaching') : undefined} />
      )}
      {tip.anchor && !subject.species && (
        <FloatTip rect={tip.anchor.rect} tone={problem.severity === 'serious' ? 'var(--bad)' : 'var(--warn)'} className="tip-w-m area-chip-tip">
          <TipHead lead={subject.lead} title={subject.title}
            sub={subject.plain ? undefined : t(problem.severity === 'serious' ? 'tip.problem.serious' : 'tip.problem.minor')} />
          <TipSec><p><Typed text={full} tip /></p></TipSec>
          {onOpen && <TipGo place={go ?? t('analysis.view.coaching')} />}
        </FloatTip>
      )}
    </Tag>
  );
}

/**
 * Il "+N" in fondo alle pillole: quelle che non stanno in riga, nel tooltip DreamDex col mouse e col fuoco; per lo screen
 * reader sono scritte nel testo nascosto. `onPick` (testata delle aree): il "+N" è un pulsante che apre una tendina con
 * le pillole nascoste, ognuna un pulsante che porta dove porta la sua pillola (`placeOf`: dove; null: da nessuna parte);
 * sul telefono la tendina è un foglio dal basso.
 */
export function MoreProblems({ hidden, as: Tag = 'li', onPick, placeOf }: { hidden: ProblemEntry[]; as?: 'li' | 'span';
  onPick?: (entry: ProblemEntry) => void; placeOf?: (entry: ProblemEntry) => string | null }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<true>();
  const serious = hidden.some(e => e.problem.severity === 'serious');
  const texts = hidden.map(e => fullText(e, t, lang));
  const title = t(hidden.length === 1 ? 'tip.problems.moreOne' : 'tip.problems.moreMany', { n: hidden.length });
  const subjects = hidden.map(e => problemSubject(e, t, lang));
  const srText = `${t(hidden.length === 1 ? 'area.problems.moreOne' : 'area.problems.moreMany', { n: hidden.length })} ${texts.join('; ')}`;
  const tipEl = tip.anchor && (
    <FloatTip rect={tip.anchor.rect} tone={serious ? 'var(--bad)' : 'var(--warn)'} className="tip-w-m area-more-tip">
      <TipHead lead={<TipGlyph icon="warning" />} title={title} />
      <TipSec>
        <TipRows>
          {hidden.map((e, i) => (
            <TipRow key={`${e.problem.key}|${e.role ?? ''}`} className={`prob-${e.problem.severity}`}
              lead={leadOf(subjects[i])} title={subjects[i].title} sub={<Typed text={texts[i]} tip />} />
          ))}
        </TipRows>
      </TipSec>
    </FloatTip>
  );
  if (onPick) {
    return <MoreMenu hidden={hidden} texts={texts} subjects={subjects} title={title} srText={srText} tip={tip} tipEl={tipEl}
      onPick={onPick} placeOf={placeOf} as={Tag} />;
  }
  return (
    <Tag className="area-chips-more" tabIndex={0} {...tip.bind(true)}>
      <span aria-hidden="true">+{hidden.length}</span>
      <span className="visually-hidden">{srText}</span>
      {tipEl}
    </Tag>
  );
}

/** La testa di una riga del "+N": la sprite della minaccia, o l'icona del tipo, del ruolo, della gravità. */
const leadOf = (subject: ReturnType<typeof problemSubject>) => (subject.species ? <Sprite species={subject.species} size={SPRITE_TIP_ROW} /> : subject.lead);

/**
 * Il "+N" come pulsante con la sua tendina (vedi MoreProblems): col mouse il tooltip resta finché la tendina è chiusa.
 * Frecce, Home e Fine fra le voci; Esc (il fuoco torna al "+N"), Tab o un clic fuori chiudono.
 */
function MoreMenu({ hidden, texts, subjects, title, srText, tip, tipEl, onPick, placeOf, as: Tag }: {
  hidden: ProblemEntry[]; texts: string[]; subjects: ReturnType<typeof problemSubject>[]; title: string; srText: string;
  tip: ReturnType<typeof useFloatAnchor<true>>; tipEl: ReactNode;
  onPick: (entry: ProblemEntry) => void; placeOf?: (entry: ProblemEntry) => string | null; as: 'li' | 'span';
}) {
  const t = useT();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = (refocus: boolean) => { setOpen(false); if (refocus) button.current?.focus(); };
  useAnchoredPop(button, pop, open, { sheet: true, width: 320, align: 'end', gap: 6, onDismiss: () => setOpen(false) });
  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (pop.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = [...(pop.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close(false);
  };
  return (
    <Tag className="area-chip-item">
      <button ref={button} type="button" className="area-chips-more is-link" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} {...(open ? {} : tip.bind(true))} onClick={() => { tip.close(); setOpen(o => !o); }}>
        <span aria-hidden="true">+{hidden.length}</span>
        <span className="visually-hidden">{srText}</span>
      </button>
      {!open && tipEl}
      {open && (
        <div ref={pop} id={menuId} className="more-probs-menu" role="menu" aria-label={title} onKeyDown={onKey}
          popover={supportsPopover ? 'manual' : undefined}>
          <p className="more-probs-title" aria-hidden="true">{title}</p>
          {hidden.map((e, i) => {
            const place = placeOf?.(e) ?? null;
            return (
              <button key={`${e.problem.key}|${e.role ?? ''}`} type="button" role="menuitem" className={`more-probs-item prob-${e.problem.severity}`}
                disabled={!place} onClick={() => { setOpen(false); onPick(e); }}>
                <span className="more-probs-lead" aria-hidden="true">{leadOf(subjects[i])}</span>
                <span className="more-probs-text">
                  <b>{subjects[i].title}</b>
                  <small><Typed text={texts[i]} tip /></small>
                </span>
                {place && <span className="more-probs-go" aria-hidden="true">{place}<Icon name="next" /></span>}
                {place && <span className="visually-hidden">{` · ${t('area.problems.goTo', { place })}`}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Tag>
  );
}
