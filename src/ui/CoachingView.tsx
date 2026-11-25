import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { CoachAdvice, Coaching, CoachProblem } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { areaValue, neutralAsAlternatives, PROPOSAL_AREAS, proposalGroups, proposalSeat, type Proposal, type ProposalArea, type ProposalGroup } from '../engine/coachProposals';
import { columnOf } from '../engine/coachSteps';
import { coachPlan, type PlanStep } from '../engine/coachPlan';
import type { EngineData } from '../engine/data';
import { battleSpecies, getMove } from '../engine/dex';
import type { MoveFix } from '../engine/moveFixes';
import { needLabel, type Need } from '../engine/needs';
import { gradeFor, type TeamRating } from '../engine/rating';
import type { LevelKey } from '../engine/roleLevels';
import { rolesPointsLabel } from '../engine/rolesArea';
import { areaSnapshot, type AreaSnapshot } from '../engine/teamGain';
import { exportShowdown, type TeamSet } from '../engine/sets';
import type { TypeName } from '../engine/types';
import { gameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { rolesValue } from './AreaDetail';
import { HelpButton } from './AnalysisTabs';
import { EeveeMoment } from './EeveeMoment';
import { ItemIcon } from './ItemIcon';
import { Icon } from './icons';
import { useMemberTip } from './MemberCard';
import { MovePill } from './MovePill';
import { copyText } from './clipboard';
import { TypeIcons, typeIconUrl } from './typeIcons';
import { PokemonIcon } from './PokemonName';
import { hint } from './MoveTip';
import { isMissingRoles, isThreat, MoreProblems, problemEntries, ProblemChip, ProblemPill, type ProblemEntry } from './ProblemPill';
import { useFitCount } from './useFit';
import { Sprite, typeColor } from './Sprite';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';

/** Il voto in più di una proposta: "+3", a pari voto "±0" (mai "+0"). */
export const gainText = (gain: number) => (gain > 0 ? `+${gain}` : gain < 0 ? `−${-gain}` : '±0');

/** Quanto resta accesa la riga aperta dalla testata di un'area. */
export const FLASH_MS = 2000;

/** Righe per pagina al più (e senza misura: jsdom, telefono). */
export const ROWS_PER_PAGE = 4;

/** Le azioni sulle proposte: applicarle (Applica) e aprirle nella scheda Pokémon o nell'editor. */
interface RowActions {
  onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void; onApplyFix: (fix: CoachFix) => void; onApplyMove: (fix: MoveFix) => void;
  /** Applica il piano: tutti i suoi passi in ordine, con un solo Annulla (`to`: il voto dopo l'ultimo passo, "A 84"). */
  onApplyPlan?: (steps: Proposal[], to: string) => void;
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

/** Un'area che cambia con una proposta: il nome e "da → a" (su o giù). */
interface AreaMove { area: ProposalArea; from: string; to: string; up: boolean; delta: number }

/** Cosa fa una proposta: i problemi che risolve (pillole), le aree che salgono e quelle che scendono, i ruoli d'aiuto persi. */
interface Effects { solved: ProblemEntry[]; ups: AreaMove[]; downs: AreaMove[]; lost: LevelKey[] }

/**
 * Cosa fa una proposta, per la carta grande e le righe: i problemi risolti (chi entra non "risolve" la minaccia che è lui
 * stesso), le aree che salgono e quelle che scendono ("da → a" dai valori del voto di ora e del voto col cambio, `after`,
 * già calcolati nella classifica) e i ruoli d'aiuto che il team perde (swapGuard.ts). Le Regole non hanno un valore: le
 * dice il problema risolto.
 */
function effectsOf(p: Proposal, problems: CoachProblem[], before: AreaSnapshot | null): Effects {
  const solves = new Set(p.fix.solves);
  const self = p.kind === 'fix' ? p.fix.species : null;
  // Un problema delle Regole (due Mega, un Pokémon bannato) viene per primo: Showdown rifiuta il team finché c'è
  const solved = problemEntries(problems.filter(x => solves.has(x.key) && shown(x) && !(x.category === 'meta' && self && x.subjects?.includes(self))))
    .sort((a, b) => Number(isRule(b)) - Number(isRule(a)));
  const after = p.fix.after ?? null;
  const moves: AreaMove[] = [];
  if (before && after) {
    for (const area of PROPOSAL_AREAS) {
      const was = areaValue(before, area);
      const now = areaValue(after, area);
      const from = areaText(before, area);
      const to = areaText(after, area);
      if (was === null || now === null || was === now || from === null || to === null) continue;
      // Di quanto cambia (Ruoli: i ruoli coperti se cambiano, se no i punti)
      const delta = area === 'roles'
        ? Math.abs(after.roles.covered - before.roles.covered) || Math.abs(after.roles.points - before.roles.points)
        : Math.abs(now - was);
      moves.push({ area, from, to, up: now > was, delta });
    }
  }
  // Le aree che scendono dalla più colpita: la prima è la stessa che la riga della classifica scrive in rosso ("−3 Dif")
  const downs = moves.filter(m => !m.up).sort((a, b) => b.delta - a.delta);
  return { solved, ups: moves.filter(m => m.up), downs, lost: p.fix.lostHelpers ?? [] };
}

/** "Difesa 75 → 80": il nome dell'area, il valore di prima tenue, quello dopo in verde (o rosso se scende); a parole per lo screen reader. */
function Change({ move }: { move: AreaMove }) {
  const tr = useT();
  return (
    <span className={`coach-change${move.up ? ' is-up' : ' is-down'}`}>
      <b>{tr(AREA_NAME[move.area])}</b>
      <span className="coach-from" aria-hidden="true">{move.from} →</span>
      <span className="coach-to" aria-hidden="true">{move.to}</span>
      <span className="visually-hidden">{tr('coach.row.change', { from: move.from, to: move.to })}</span>
    </span>
  );
}

/** Il nome corto di un'area per la riga della classifica ("Dif"), accanto al costo. */
const AREA_SHORT: Record<Exclude<ProposalArea, 'rules'>, 'coach.short.strength' | 'coach.short.defense' | 'coach.short.speed' | 'coach.short.roles' | 'coach.short.bonusMalus'> = {
  strength: 'coach.short.strength', defense: 'coach.short.defense', speed: 'coach.short.speed', roles: 'coach.short.roles', bonusMalus: 'coach.short.bonusMalus',
};

/** L'area che scende di più con una proposta (il costo da mostrare nella riga), o null se non scende niente. */
const biggestLoss = (downs: AreaMove[]): AreaMove | null =>
  downs.filter(m => m.area !== 'rules' && m.delta > 0).reduce<AreaMove | null>((best, m) => (!best || m.delta > best.delta ? m : best), null);

/** Le aree che scendono a parole, per lo screen reader: "Difesa scende di 3; Velocità scende di 2". */
const lossText = (downs: AreaMove[], tr: ReturnType<typeof useT>) =>
  downs.filter(m => m.area !== 'rules').map(m => tr('coach.cost.drops', { area: tr(AREA_NAME[m.area]), n: m.delta })).join('; ');

/** Un problema delle Regole (Showdown rifiuta il team): primo fra i risolti e in rosso. */
const isRule = (entry: ProblemEntry) => entry.problem.category === 'rules';

/** Un problema risolto: la spunta verde e il testo corto del problema (come la pillola, ma "fatto"); va a capo se è lungo. */
function Solved({ entry }: { entry: ProblemEntry }) {
  const lang = useLang();
  return (
    <li className={`coach-solved${isRule(entry) ? ' is-rule' : ''}`}>
      <Icon name="check" />
      {/* Un ruolo: solo il nome (la spunta verde dice già che ora è coperto, niente ×) */}
      {entry.role ? <span className="coach-prob-text">{needLabel(entry.role as Need, lang)}</span> : <ProblemPill problem={entry.problem} role={entry.role} />}
    </li>
  );
}

/** Il testo intero di un problema risolto (fumetti e lettori di schermo): il ruolo col suo nome, il resto col problema. */
const solvedText = (entry: ProblemEntry, lang: ReturnType<typeof useLang>) => (entry.role ? needLabel(entry.role as Need, lang) : entry.problem.text);

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

/** I tipi vicini al magenta: la loro luce nella carta farebbe concorrenza ad Applica (l'unico magenta della scheda). */
const NEAR_MAGENTA = new Set(['Psychic', 'Fairy']);

/**
 * La luce della fascia VS: il primo tipo; per Psico e Folletto il secondo tipo se c'è, altrimenti il colore del tipo
 * smorzato verso il grigio (resta riconoscibile ma non compete con Applica).
 */
function heroTone(p: Proposal): string {
  const types = (battleSpecies(p.fix.set)?.types ?? []) as string[];
  const calm = types.find(t => !NEAR_MAGENTA.has(t));
  return calm ? typeColor(calm) : `color-mix(in srgb, ${typeColor(types[0] ?? '')} 45%, var(--faint))`;
}

/** Chi entra (o il membro che cambia mossa): lo sprite della proposta. */
const subjectOf = (p: Proposal) => (p.kind === 'fix' ? p.fix.species : p.fix.member);

/** La lettera e il numero di un voto ("A 81") nel colore del voto (S magenta, A verde, B ciano, C giallo, D rosso). */
function GradeTag({ score, className = '' }: { score: number; className?: string }) {
  const lang = useLang();
  const { grade } = gradeFor(score, lang);
  return <b className={`coach-grade-tag grade-${grade}${className ? ` ${className}` : ''}`}>{grade} {score}</b>;
}

/**
 * La targhetta come nell'editor (STRUMENTO, ABILITÀ): l'etichetta chiara a sinistra col taglio obliquo, il valore a
 * destra ("STRUMENTO · Avanzi").
 */
function CardPlate({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={`coach-plate${className ? ` ${className}` : ''}`}>
      <span className="coach-plate-label">{label}</span>
      <span className="coach-plate-value">{children}</span>
    </span>
  );
}

/**
 * Il set della proposta, come lo vedrebbe chi gioca accanto a Showdown: strumento e abilità come targhette dell'editor, le
 * quattro mosse come pillole. In un cambio di mossa la mossa nuova ha l'anello ciano.
 */
function SetSummary({ p }: { p: Proposal }) {
  const tr = useT();
  const lang = useLang();
  const set = p.fix.set;
  const slot = p.kind === 'move' ? p.fix.slot : -1;
  return (
    <section className="coach-set" aria-label={tr('coach.hero.set')}>
      <h5 className="coach-head">{tr('coach.hero.set')}</h5>
      <div className="coach-set-kit">
        {set.item && <CardPlate label={tr('coach.plate.item')}><ItemIcon item={set.item} />{gameName('item', set.item, lang)}</CardPlate>}
        {set.ability && <CardPlate label={tr('coach.plate.ability')}>{gameName('ability', set.ability, lang)}</CardPlate>}
      </div>
      <ul className="coach-set-moves">
        {set.moves.filter(Boolean).map((move, i) => <li key={`${i}|${move}`} className={i === slot ? 'is-new' : undefined}><MovePill name={move} size="sm" /></li>)}
      </ul>
    </section>
  );
}

/**
 * La fascia "VS" in testa alla carta, da bordo a bordo: a sinistra chi esce (spento, sulla pedana grigia, "ESCE" e il nome
 * tenue; un posto libero tratteggiato per un'aggiunta; la mossa vecchia grigia e barrata per un cambio di mossa), al centro
 * il voto in più (+N) col voto prima → dopo (il dopo nel colore del voto), a destra chi entra in piedi sulla sua pedana col
 * nome (per una mossa: il membro, "Su X", e sotto la mossa nuova). La luce del primo tipo scende solo sulla metà di
 * destra. Il titolo visibile (`titleRef`) riceve il fuoco quando il pulsante usato sparisce.
 */
function VsBand({ p, fx, rating, headId, titleRef, bind }: {
  p: Proposal; fx: Effects; rating: TeamRating | null; headId: string; titleRef: RefObject<HTMLDivElement | null>; bind?: object;
}) {
  const tr = useT();
  const lang = useLang();
  const costs = fx.downs.length + fx.lost.length;
  const after = rating ? Math.max(0, Math.min(100, rating.overall + p.fix.gain)) : null;
  let out: ReactNode;
  if (p.kind === 'move') {
    out = (
      <>
        <span className="coach-vs-label">{tr('coach.pad.out')}</span>
        {p.fix.from
          ? <MovePill name={p.fix.from} className="coach-move-out" tip={false} />
          : <span className="coach-vs-free is-slot">{tr('coach.row.emptySlot')}</span>}
      </>
    );
  } else if (p.fix.kind === 'swap') {
    out = (
      <>
        <span className="coach-vs-stage is-out"><span className="coach-vs-disc" /><span className="coach-art-out"><Sprite species={p.fix.member ?? ''} size={96} /></span></span>
        <span className="coach-vs-label">{tr('coach.pad.out')}</span>
        <span className="coach-vs-out-name">{p.fix.member}</span>
      </>
    );
  } else {
    out = <span className="coach-vs-free">{tr('coach.vs.free')}</span>;
  }
  return (
    <div className={`coach-vs${p.kind === 'move' ? ' is-move' : p.fix.kind === 'add' ? ' is-add' : ' is-swap'}`}>
      <div className="coach-vs-side is-out" aria-hidden="true">{out}</div>
      <div className="coach-vs-mid">
        <span className="coach-vs-arrow" aria-hidden="true"><Icon name={p.kind === 'fix' && p.fix.kind === 'add' ? 'plus' : 'swap'} /></span>
        <b className="coach-gain">{gainText(p.fix.gain)}</b>
        {rating && after !== null && (
          <span className="coach-grade-change">
            <span className="visually-hidden">{tr('detail.gradeLabel')} </span>
            <span className="coach-grade-from">{rating.grade} {rating.overall}</span>
            <span className="coach-grade-arrow"> → </span>
            <GradeTag score={after} />
          </span>
        )}
        {/* Costa accanto al voto: cosa scende o cosa perdi, sempre in vista (mai sotto lo scorrimento della carta). In un
            posto libero (nessuno esce) che non costa niente la riga non c'è: "Costa: Niente" non direbbe nulla */}
        {(costs > 0 || p.kind === 'move' || p.fix.kind !== 'add') && (
          <section className={`coach-vs-cost${costs ? ' is-bad' : ''}`} aria-label={tr('coach.hero.costs')}>
            <h5 className="coach-head">{tr('coach.hero.costs')}</h5>
            {costs === 0 && <p className="coach-fact-none">{tr('coach.hero.nothing')}</p>}
            {fx.downs.length > 0 && <p className="coach-moves">{fx.downs.map(m => <Change key={m.area} move={m} />)}</p>}
            {fx.lost.length > 0 && <p className="coach-lost"><b>{tr('coach.row.lost')}</b> {fx.lost.map(key => needLabel(key, lang)).join(', ')}</p>}
          </section>
        )}
      </div>
      <div className="coach-vs-side is-in">
        <span className="coach-vs-stage is-in">
          <span className="pedana-disc" aria-hidden="true" />
          <span className="coach-art-in" {...bind}><Sprite species={subjectOf(p)} size={96} /></span>
        </span>
        {/* Il titolo visibile riceve il fuoco quando il pulsante usato sparisce (un'alternativa, "Torna alla migliore", "Mostra tutte") */}
        <div className="coach-hero-focus" ref={titleRef} tabIndex={-1} aria-labelledby={headId}>
          {p.kind === 'move' ? (
            <div className="coach-hero-title is-move">
              <b className="coach-hero-name">{tr('coach.vs.on', { member: p.fix.member })}</b>
              <MovePill name={p.fix.to} className="coach-move-in" />
              <span className="visually-hidden">{tr('coach.row.moveKind')}</span>
            </div>
          ) : (
            <div className="coach-hero-title"><b className="coach-hero-name">{p.fix.species}</b></div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Il nome scritto di una proposta (chi entra, o la mossa nuova): due proposte con lo stesso nome si distinguono con altSub. */
const shownName = (o: Proposal, lang: ReturnType<typeof useLang>) => (o.kind === 'move' ? gameName('move', o.fix.to, lang) : o.fix.species);

/**
 * La riga piccola di un'alternativa che ha lo stesso nome di un'altra proposta del posto (la carta compresa): cosa cambia.
 * Le alternative sono tutte per lo stesso posto (chi esce è lo stesso della carta): per un Pokémon lo strumento, se no
 * l'abilità; per una mossa la mossa che toglie. Nessuna riga se il nome è unico.
 */
function altSub(o: Proposal, options: Proposal[], tr: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): string | null {
  const twins = options.filter(x => x !== o && x.kind === o.kind && shownName(x, lang) === shownName(o, lang));
  if (twins.length === 0) return null;
  if (o.kind === 'move') {
    return twins.some(x => x.kind === 'move' && x.fix.from !== o.fix.from)
      ? (o.fix.from ? tr('coach.row.instead', { member: gameName('move', o.fix.from, lang) }) : tr('coach.row.emptySlot')) : null;
  }
  if (o.fix.set.item && twins.some(x => x.fix.set.item !== o.fix.set.item)) return gameName('item', o.fix.set.item, lang);
  if (o.fix.set.ability && twins.some(x => x.fix.set.ability !== o.fix.set.ability)) return gameName('ability', o.fix.set.ability, lang);
  return null;
}

/**
 * Vero quando la fila sa scorrere di lato e c'è ancora qualcosa a destra (o a sinistra): la fila Oppure col dito sfuma
 * sul bordo invece di tagliare una tessera di netto. Si ricontrolla scorrendo e cambiando misura.
 */
function useSideFade(ref: RefObject<HTMLElement | null>, key: string): { left: boolean; right: boolean } {
  const [fade, setFade] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
      const left = el.scrollLeft > 2;
      setFade(f => (f.left === left && f.right === right ? f : { left, right }));
    };
    const observer = new ResizeObserver(check);
    observer.observe(el);
    el.addEventListener('scroll', check, { passive: true });
    check();
    return () => { observer.disconnect(); el.removeEventListener('scroll', check); };
  }, [ref, key]);
  return fade;
}

/**
 * Il fuoco sul titolo della carta senza far saltare la pagina: resta dov'è; solo se il titolo è fuori dallo schermo la
 * pagina scorre quel tanto che basta per vederlo.
 */
function focusTitle(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  const box = el.getBoundingClientRect();
  if (box.bottom <= 0 || box.top >= window.innerHeight) el.scrollIntoView?.({ block: 'nearest' });
}

/** Dove il piede della carta si ferma: sotto i 1100 px (la pagina scorre). */
const PIN_QUERY = '(max-width: 1099px)';

/**
 * Vero quando il piede della carta può restare fermo in fondo allo schermo: sotto i 1100 px e con la fascia VS tutta sopra
 * la riga dove il piede si ferma (l'altezza dello schermo meno la barra delle sezioni e il piede stesso). Si ricontrolla
 * scorrendo e cambiando misura (una volta per fotogramma).
 */
function usePinnedFoot(ref: RefObject<HTMLElement | null>): boolean {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const card = ref.current;
    if (!card || typeof window.matchMedia !== 'function') return;
    const narrow = window.matchMedia(PIN_QUERY);
    let frame = 0;
    const check = () => {
      frame = 0;
      const vs = card.querySelector('.coach-vs');
      const foot = card.querySelector<HTMLElement>('.coach-hero-foot');
      if (!narrow.matches || !vs || !foot) { setPinned(false); return; }
      const line = window.innerHeight - (parseFloat(getComputedStyle(foot).bottom) || 0) - foot.offsetHeight;
      setPinned(vs.getBoundingClientRect().bottom <= line + 1);
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    // La carta cambia altezza (un'alternativa, "altre N"): si ricontrolla anche senza scorrere
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    observer?.observe(card);
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    narrow.addEventListener('change', soon);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
      narrow.removeEventListener('change', soon);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return pinned;
}

/** Il tablet (la carta in alto, la classifica sotto; la pagina scorre): fra il telefono e il desktop. */
const TABLET_QUERY = '(min-width: 600px) and (max-width: 1099px)';

/** Le alternative visibili subito in "Oppure"; le altre dietro "altre N". */
export const ALTS_SHOWN = 3;

/**
 * La carta grande: la proposta scelta. In alto la fascia VS (chi esce, il +N col voto prima → dopo, chi entra); sotto
 * "Risolve" (spunte verdi e le aree che salgono) accanto a "Costa" (aree che scendono, ruoli d'aiuto persi), poi il Set; in
 * fondo Applica (magenta: è l'azione migliore sullo schermo), il link alla scheda Pokémon o al set, Copia e, se il posto
 * ha altre proposte, "Oppure" con le piccole carte delle alternative (le prime tre col nome, le altre dietro "altre N").
 */
function Hero({ group, choice, onChoose, problems, before, rating, actions, flash, titleRef }: {
  group: ProposalGroup;
  choice: number; onChoose: (index: number) => void; problems: CoachProblem[];
  before: AreaSnapshot | null; rating: TeamRating | null; actions: RowActions; flash: boolean;
  /** Il titolo visibile della carta: riceve il fuoco quando il pulsante usato sparisce (un'alternativa scelta). */
  titleRef: RefObject<HTMLDivElement | null>;
}) {
  const tr = useT();
  const lang = useLang();
  const memberTip = useMemberTip();
  const headId = useId();
  const altsId = useId();
  const at = Math.min(choice, group.options.length - 1);
  const p = group.options[at];
  const fx = effectsOf(p, problems, before);
  const name = proposalName(p, tr, lang);
  const apply = () => (p.kind === 'fix' ? actions.onApplyFix(p.fix) : actions.onApplyMove(p.fix));
  const see = () => (p.kind === 'fix' ? actions.onFix(p.fix) : actions.onMoveFix(p.fix));
  // Copia set: per un attimo "Copiato" con la spunta, come nel dettaglio dei candidati
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 1500); return () => window.clearTimeout(timer); }, [copied]);
  // Oppure: le prime ALTS_SHOWN alternative, le altre dietro "altre N" (un clic le mostra tutte, un altro le richiude)
  const [allAlts, setAllAlts] = useState(false);
  // La sfumatura in fondo alla parte che scorre solo quando sotto c'è ancora qualcosa da vedere
  const scrollRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 2);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener('scroll', check, { passive: true });
    check();
    return () => { observer.disconnect(); el.removeEventListener('scroll', check); };
  }, []);
  // Sotto i 1100 px il piede (Applica e il resto) resta fermo in fondo allo schermo, ma solo da quando la fascia VS è
  // salita sopra di lui: così non copre mai il +N, il voto, Costa e i nomi (prima resta al suo posto, in fondo alla carta)
  const cardRef = useRef<HTMLElement>(null);
  const pinned = usePinnedFoot(cardRef);
  // Oppure: solo le alternative per lo stesso posto della carta (chi esce è lo stesso); quelle per un altro posto stanno
  // nella classifica
  const seat = proposalSeat(p);
  const alts = group.options.map((o, i) => ({ o, i })).filter(x => x.i !== at && proposalSeat(x.o) === seat);
  const shownAlts = allAlts ? alts : alts.slice(0, ALTS_SHOWN);
  // La fila Oppure che scorre col dito sfuma sul bordo dove c'è ancora qualcosa
  const altsRef = useRef<HTMLDivElement>(null);
  const altFade = useSideFade(altsRef, `${shownAlts.length}|${at}`);
  return (
    <article ref={cardRef} className={`coach-hero${p.kind === 'move' ? ' is-move' : ''}${flash ? ' is-flash' : ''}${pinned ? ' is-pinned' : ''}`} data-row={group.id} aria-labelledby={headId}
      style={{ '--t1': typeColor(firstType(p)), '--wash': heroTone(p) } as CSSProperties}>
      <h4 id={headId} className="visually-hidden">{name}</h4>
      <VsBand p={p} fx={fx} rating={rating} headId={headId} titleRef={titleRef} bind={p.kind === 'fix' ? memberTip.bind(p.fix.set) : undefined} />
      {/* La parte centrale scorre se è lunga; Applica e le altre azioni restano sempre in vista sotto (sul telefono e sul
          tablet in verticale il piede resta fermo in fondo allo schermo finché la carta è in vista) */}
      <div className="coach-hero-body">
        <div className={`coach-hero-scroll${more ? ' has-more' : ''}`} ref={scrollRef}>
          <div className="coach-hero-facts">
            <section className="coach-fact is-good" aria-label={tr('coach.hero.solves')}>
              <h5 className="coach-head">{tr('coach.hero.solves')}</h5>
              {fx.solved.length > 0
                ? <ul className="coach-solved-list">{fx.solved.map(entry => <Solved key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} />)}</ul>
                : <p className="coach-fact-none">{tr('coach.hero.raisesOnly')}</p>}
              {fx.ups.length > 0 && <p className="coach-moves">{fx.ups.map(m => <Change key={m.area} move={m} />)}</p>}
            </section>
            <SetSummary p={p} />
          </div>
        </div>
      </div>
      <div className="coach-hero-foot">
          <button type="button" className="coach-apply is-primary" aria-label={tr('coach.row.applyAria', { name })} onClick={apply}>{tr('coach.row.apply')}</button>
          <button type="button" className="coach-see" onClick={see} {...hint(tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet'))}
            aria-label={p.kind === 'fix' ? tr('coach.row.seeAria', { species: p.fix.species }) : tr('coach.row.openSetAria', { member: p.fix.member })}>
            <Icon name={p.kind === 'fix' ? 'team' : 'edit'} /><span aria-hidden="true">{tr(p.kind === 'fix' ? 'coach.row.seeShort' : 'coach.row.openSetShort')}</span>
          </button>
          <button type="button" className={`coach-see coach-copy${copied ? ' is-done' : ''}`} aria-label={tr('suggest.copySet')} {...hint(tr('suggest.copySet'))}
            onClick={async () => { if (await copyText(exportShowdown([p.fix.set]))) setCopied(true); }}>
            <Icon name={copied ? 'check' : 'copy'} /><span aria-hidden="true">{tr(copied ? 'team.copied' : 'suggest.copySet')}</span>
          </button>
          {copied && <span className="visually-hidden" role="status">{tr('team.copied')}</span>}
          {alts.length > 0 && (
            <div className={`coach-alts${altFade.right ? ' fade-right' : ''}${altFade.left ? ' fade-left' : ''}`} id={altsId} ref={altsRef} role="group" aria-label={tr('coach.alt.title', { n: alts.length })}>
              <span className="coach-alts-word" aria-hidden="true">{tr('coach.alt.or')}</span>
              {shownAlts.map(({ o, i }) => {
                const sub = altSub(o, [p, ...alts.map(x => x.o)], tr, lang);
                return (
                  <button key={i} type="button" className={`coach-alt-tile${o.kind === 'move' ? ' is-move' : ''}${sub ? ' has-sub' : ''}`} style={{ '--t1': typeColor(firstType(o)) } as CSSProperties}
                    aria-label={tr('coach.alt.pick', { name: proposalName(o, tr, lang) })} {...hint(proposalName(o, tr, lang))}
                    onClick={() => { onChoose(i); requestAnimationFrame(() => focusTitle(titleRef.current)); }}>
                    <PokemonIcon name={subjectOf(o)} />
                    <span className="coach-alt-who" aria-hidden="true">
                      <span className="coach-alt-name">{o.kind === 'move' ? gameName('move', o.fix.to, lang) : o.fix.species}</span>
                      {sub && <small className="coach-alt-sub">{sub}</small>}
                    </span>
                    <b aria-hidden="true">{gainText(o.fix.gain)}</b>
                  </button>
                );
              })}
              {alts.length > ALTS_SHOWN && (
                <button type="button" className="coach-alt-more" aria-expanded={allAlts} aria-controls={altsId}
                  aria-label={tr(allAlts ? 'coach.alt.lessAria' : 'coach.alt.moreAria', { n: alts.length - ALTS_SHOWN })} onClick={() => setAllAlts(v => !v)}>
                  <span aria-hidden="true">{allAlts ? tr('coach.alt.less') : tr('coach.alt.more', { n: alts.length - ALTS_SHOWN })}</span>
                </button>
              )}
            </div>
          )}
      </div>
      {memberTip.tip}
    </article>
  );
}

/** La guida del Coaching (il "?" in testa alla diagnosi): come si legge la scheda, in cinque punti (il Piano a sé). */
function CoachingGuide() {
  const tr = useT();
  return (
    <div className="coach-guide">
      {(['diag', 'card', 'plan', 'facts', 'apply'] as const).map(k => (
        <section key={k}>
          <h4>{tr(`coach.help.${k}.title`)}</h4>
          <p>{tr(`coach.help.${k}.text`)}</p>
        </section>
      ))}
    </div>
  );
}

/**
 * Esporta per Showdown in fondo alla classifica, anche coi problemi che restano: secondario (un collegamento leggero con
 * l'icona), per un attimo la spunta quando il team è copiato (l'avviso dell'app dice "Team copiato").
 */
function ExportLink({ onExport }: { onExport: () => Promise<boolean> }) {
  const tr = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 1800); return () => window.clearTimeout(timer); }, [copied]);
  return (
    <button type="button" className="coach-link coach-export" aria-label={tr('coach.clear.export')} {...hint(tr('coach.clear.export'))} onClick={async () => setCopied(await onExport())}>
      <Icon name={copied ? 'check' : 'copy'} /><span aria-hidden="true">{tr('coach.rank.export')}</span>
    </button>
  );
}

/** Un problema risolto in piccolo per la riga della classifica: la minaccia (icona e nome), i tipi (icone e nome), un ruolo (×), il resto in testo corto. */
function SolvedPill({ entry }: { entry: ProblemEntry }) {
  const lang = useLang();
  const { problem, role } = entry;
  const subjects = problem.subjects ?? [];
  let body: ReactNode;
  // Un ruolo: solo il nome (la spunta verde dice già che ora è coperto)
  if (role) body = needLabel(role as Need, lang);
  else if ((problem.category === 'meta' || problem.category === 'metaHit') && subjects[0]) body = <><PokemonIcon name={subjects[0]} />{subjects[0]}</>;
  else if ((problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0) body = <><TypeIcons types={subjects.slice(0, 2)} />{subjects.slice(0, 2).map(t => typeName(t as TypeName, lang)).join(' / ')}</>;
  // Il resto in breve: la parte prima dei due punti ("3 membri di tipo Acciaio"; una regola prima della parentesi: "Più Mega
  // nel team", così sta nella riga anche se viene per prima), il testo intero è nella descrizione della riga
  else body = problem.text.split(problem.category === 'rules' ? /[:(]/ : ':')[0].trim();
  return <span className={`coach-pill${isRule(entry) ? ' is-rule' : ''}`}><Icon name="check" /><span className="coach-pill-text">{body}</span></span>;
}

/** Quanti problemi risolti in piccolo stanno nella riga della classifica al più; gli altri in "+N". */
const PILLS = 2;

/**
 * I problemi risolti in piccolo sotto una riga della classifica: al più PILLS, e solo quelli che stanno interi nella riga
 * (una pillola che non sta non si taglia a metà parola: si toglie e conta nel "+N"). Senza problemi risolti lo dice in tenue.
 */
function RankPills({ solved, sharedOnly = false }: { solved: ProblemEntry[]; sharedOnly?: boolean }) {
  const tr = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const top = solved.slice(0, PILLS);
  const n = useFitCount(ref, top.length, top.map(e => `${e.problem.key}|${e.role ?? ''}`).join(','), undefined, true);
  // L'unico problema risolto è quello scritto sopra la lista (comune a più righe): la riga resta senza pillole
  if (sharedOnly) return <span className="coach-rank-pills" aria-hidden="true" />;
  if (solved.length === 0) return <span className="coach-rank-pills" aria-hidden="true"><span className="coach-pill-none">{tr('coach.hero.raisesOnly')}</span></span>;
  return (
    <span className="coach-rank-pills" ref={ref} aria-hidden="true">
      {top.slice(0, n).map(e => <SolvedPill key={`${e.problem.key}|${e.role ?? ''}`} entry={e} />)}
      {solved.length > n && <span className="coach-pill-more">+{solved.length - n}</span>}
    </span>
  );
}

/**
 * Il nome corto di un problema per la tendina del filtro (sta su una riga): la minaccia "Zapdos: scoperta", un tipo della
 * Difesa "Fuoco: nessuno lo regge", un buco dell'Offesa "Acqua: nessuno lo manda KO", i ruoli mancanti i loro nomi; il
 * resto col suo testo.
 */
function shortProblem(problem: CoachProblem, tr: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): string {
  const subjects = problem.subjects ?? [];
  if (isThreat(problem) && subjects[0]) return tr(problem.category === 'metaHit' ? 'coach.filter.threatHit' : 'coach.filter.threat', { species: subjects[0] });
  const types = subjects.slice(0, 2).map(t => typeName(t as TypeName, lang)).join(' / ');
  if (problem.category === 'defense' && subjects.length) return tr('coach.filter.notHeld', { type: types });
  if (problem.category === 'coverage' && subjects.length) return tr('coach.filter.uncovered', { type: types });
  if (isMissingRoles(problem)) return subjects.map(role => needLabel(role as Need, lang)).join(', ');
  return problem.text;
}

/**
 * La classifica: una riga per proposta, dalla più utile (+N più alto): l'icona del Box sul colore del tipo, il nome (o la
 * mossa nuova), "al posto di X", il +N e sotto i primi problemi che risolve in piccolo (tutti contano, anche quelli che
 * risolve anche un'altra proposta) con "+N". Un clic la apre nella carta grande (quella aperta ha l'anello ciano). Sopra la
 * lista il filtro per problema (una tendina: "Tutti i problemi" o un problema, col numero di proposte che lo risolvono);
 * in fondo "Restano N problemi" che nessun cambio singolo risolve (i nomi nel fumetto). A pagine come le altre liste.
 */
function RankRail({ groups, problems, before, entries, stuck, filter, onFilter, onOpen, heroId, clean, busy, headRef, onExport }: {
  groups: ProposalGroup[]; problems: CoachProblem[]; before: AreaSnapshot | null; entries: ProblemEntry[]; stuck: ProblemEntry[];
  filter: string | null; onFilter: (key: string | null) => void; onOpen: (groupId: string) => void; heroId: string | null; clean: ReactNode; busy: boolean;
  /** Copia il team per Showdown anche coi problemi che restano (secondario, sulla riga delle pagine a destra). */
  onExport?: () => Promise<boolean>;
  /** Il titolo della classifica: riceve il fuoco da "Tutte le proposte" (telefono e tablet, la carta sta sopra). */
  headRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const tr = useT();
  const lang = useLang();
  const headId = useId();
  const filterId = useId();
  // L'id della descrizione di ogni riga: dal prefisso di useId e dall'indice (le chiavi dei gruppi hanno spazi)
  const descBase = useId();
  const box = useRef<HTMLDivElement>(null);
  const { perPage, rows } = useRowsPerPage(box, 12, busy ? 0 : groups.length);
  const [start, setStart] = useState(0);
  const size = rows ? perPage : Math.max(1, groups.length);
  const pages = Math.max(1, Math.ceil(groups.length / size));
  const page = Math.min(Math.floor(start / size), pages - 1);
  const shown = groups.slice(page * size, (page + 1) * size);
  // Il filtro cambia la lista: si riparte dalla prima pagina
  useEffect(() => { setStart(0); }, [filter]);
  const solvable = entries.filter(e => !stuck.includes(e));
  const keys = [...new Set(solvable.map(e => e.problem.key))];
  const label = (key: string) => shortProblem(entries.find(x => x.problem.key === key)!.problem, tr, lang);
  // Ogni riga mostra sempre la migliore del suo posto (la prima): un'alternativa scelta cambia solo la carta
  const items = shown.map(group => ({ group, pick: group.options[0], fx: effectsOf(group.options[0], problems, before) }));
  // Lo stesso primo problema risolto in almeno tre proposte: si dice una volta sopra la lista e si toglie da quelle righe.
  // Si conta su tutte le proposte del filtro (non solo la pagina in vista), così la classifica è uguale a ogni misura
  const leadKey = (fx: Effects) => (fx.solved[0] ? `${fx.solved[0].problem.key}|${fx.solved[0].role ?? ''}` : null);
  const allFx = useMemo(() => groups.map(g => effectsOf(g.options[0], problems, before)), [groups, problems, before]);
  const counts = new Map<string, number>();
  for (const fx of allFx) { const k = leadKey(fx); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  const [sharedKey, sharedN] = [...counts].reduce<[string | null, number]>((best, [k, n]) => (n > best[1] ? [k, n] : best), [null, 0]);
  // Con un problema scelto nel filtro la riga non serve: direbbe di nuovo il problema scelto
  const shared = !busy && !filter && sharedN >= 3 ? allFx.find(fx => leadKey(fx) === sharedKey)!.solved[0] : null;
  // "Restano N problemi": un clic (o un tocco) apre l'elenco sotto la riga
  const [stuckOpen, setStuckOpen] = useState(false);
  const stuckId = useId();
  const filterLabel = filter ? label(filter) : tr('coach.rank.allProblems');
  // Il posto di ogni riga ("al posto di X") non si taglia mai: se non sta su una riga va a capo (seatWrap)
  const listRef = useRef<HTMLOListElement>(null);
  const wraps = useSeatWrap(listRef, items.map(r => `${r.group.id}|${r.pick.kind}`).join('\n') + lang);
  return (
    <aside className="coach-diag" aria-labelledby={headId}>
      <div className="coach-diag-top">
        <h4 id={headId} className="coach-diag-head" ref={headRef} tabIndex={headRef ? -1 : undefined}>{tr('coach.rank.title')}{!busy && <span className="coach-diag-total">{tr(groups.length === 1 ? 'coach.rank.count1' : 'coach.rank.count', { n: groups.length })}</span>}</h4>
        <HelpButton title={tr('coach.help.title')} className="coach-help"><CoachingGuide /></HelpButton>
      </div>
      {/* Sotto il titolo la riga che spiega; quando tre righe o più hanno lo stesso primo problema risolto, quel problema
          è detto una volta sola sopra le righe (il riassunto delle righe, non un filtro) al posto di questa riga: stessa
          altezza, le righe per pagina non cambiano */}
      {!shared && <p className="coach-diag-sub">{tr('coach.rank.sub')}</p>}
      {keys.length > 0 && (
        <div className={`coach-filter${filter ? ' is-on' : ''}`}>
          <label htmlFor={filterId} className="coach-head">{tr('coach.rank.filter')}</label>
          {/* La tendina vera (per tastiera, tocco e lettori di schermo) col testo scelto ricopiato sopra: così un nome lungo
              finisce coi puntini invece di tagliarsi a metà parola */}
          <span className="coach-filter-box">
            <select id={filterId} value={filter ?? ''} onChange={e => onFilter(e.target.value || null)}>
              <option value="">{tr('coach.rank.allProblems')}</option>
              {keys.map(key => <option key={key} value={key}>{label(key)}</option>)}
            </select>
            <span className="coach-filter-shown" aria-hidden="true">{filterLabel}</span>
          </span>
          {filter && <button type="button" className="coach-back" onClick={() => onFilter(null)}><Icon name="close" />{tr('coach.list.showAll')}</button>}
        </div>
      )}
      {shared && (
        <p className="coach-diag-sub coach-rank-lead">
          <span>{tr(sharedN === groups.length ? 'coach.rank.sharedAll' : 'coach.rank.sharedSome', { n: sharedN })}</span>
          <span aria-hidden="true"><SolvedPill entry={shared} /></span>
          <span className="visually-hidden">{solvedText(shared, lang)}</span>
        </p>
      )}
      <div className="coach-diag-box" ref={box}>
        {busy ? (
          <ol className="coach-diag-list" aria-busy="true">
            {Array.from({ length: rows ? perPage : 4 }, (_, i) => <li key={i} className="coach-rank-skeleton" aria-hidden="true" />)}
          </ol>
        ) : (
          <ol className="coach-diag-list" ref={listRef}>
            {items.map(({ group, pick, fx }, row) => {
              const name = proposalName(pick, tr, lang);
              // Il nome intero del membro, come nella carta ("al posto di Garchomp-Mega")
              const seat = pick.kind === 'move'
                ? tr('coach.item.move', { member: pick.fix.member, from: pick.fix.from ? gameName('move', pick.fix.from, lang) : tr('coach.row.emptySlot') })
                : pick.fix.kind === 'swap' ? tr('coach.row.instead', { member: pick.fix.member ?? '' }) : tr('coach.row.free');
              const open = group.id === heroId;
              // Il costo: l'area che scende di più ("−3 Dif", rosso accanto al +N); tutte a parole nella descrizione
              const loss = biggestLoss(fx.downs);
              const pills = shared ? fx.solved.filter(e => e !== fx.solved[0] || leadKey(fx) !== sharedKey) : fx.solved;
              const desc = [fx.solved.length ? `${tr('coach.hero.solves')}: ${fx.solved.map(e => solvedText(e, lang)).join('; ')}` : tr('coach.hero.raisesOnly'),
                ...(fx.downs.length ? [`${tr('coach.hero.costs')}: ${lossText(fx.downs, tr)}`] : [])].join('. ');
              return (
                <li key={group.id}>
                  <button type="button" className={`coach-rank${open ? ' is-open' : ''}${pick.kind === 'move' ? ' is-move' : ''}${wraps.has(group.id) ? ' is-wrap' : ''}`} aria-current={open ? 'true' : undefined}
                    data-group={group.id}
                    style={{ '--t1': typeColor(firstType(pick)) } as CSSProperties} aria-label={tr('coach.rank.openAria', { name })}
                    aria-describedby={`${descBase}-${row}`} onClick={() => onOpen(group.id)}>
                    {/* L'icona di chi entra e, piccola e grigia nell'angolo, quella di chi esce (un posto libero: un quadratino
                        tratteggiato); così due righe con lo stesso Pokémon si distinguono a colpo d'occhio */}
                    <span className={`coach-rank-mon${pick.kind === 'fix' ? ` is-${pick.fix.kind}` : ''}`} aria-hidden="true">
                      <PokemonIcon name={subjectOf(pick)} />
                      {pick.kind === 'fix' && (pick.fix.kind === 'swap'
                        ? <span className="coach-rank-out"><PokemonIcon name={pick.fix.member ?? ''} /></span>
                        : <span className="coach-rank-out is-free" />)}
                    </span>
                    <span className="coach-rank-who" aria-hidden="true">
                      <b>{pick.kind === 'move' ? gameName('move', pick.fix.to, lang) : pick.fix.species}</b>
                      <small>{seat}</small>
                    </span>
                    {/* A destra, una sotto l'altra: il +N verde e, se un'area scende, il costo in rosso ("−3 DIF") */}
                    <span className="coach-rank-end" aria-hidden="true">
                      <b className="coach-rank-gain">{gainText(pick.fix.gain)}</b>
                      {loss && <small className="coach-rank-cost">−{loss.delta}{' '}<span className="coach-rank-area">{tr(AREA_SHORT[loss.area as Exclude<ProposalArea, 'rules'>])}</span></small>}
                    </span>
                    <RankPills solved={pills} sharedOnly={pills.length === 0 && fx.solved.length > 0} />
                    <span id={`${descBase}-${row}`} className="visually-hidden">{desc}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="coach-diag-foot">
        <Pager page={page} pages={pages} from={page + 1} to={pages} onPage={n => setStart(n * size)}
          labels={{ pages: tr('coach.list.pages'), prev: tr('coach.list.prev'), next: tr('coach.list.next'), page: 'coach.rank.page' }} />
        {/* Esporta per Showdown sulla riga delle pagine, a destra: non toglie righe alla classifica */}
        {onExport && !busy && <ExportLink onExport={onExport} />}
        {stuck.length > 0 && !filter && (
          <div className="coach-stuck">
            {/* Un pulsante che apre l'elenco sotto (col dito il fumetto non c'è); col mouse il fumetto resta */}
            <button type="button" className={`coach-rank-stuck${stuckOpen ? ' is-open' : ''}`} aria-expanded={stuckOpen} aria-controls={stuckId}
              onClick={() => setStuckOpen(v => !v)} {...hint(stuck.map(e => solvedText(e, lang)).join('; '))}>
              <Icon name="warning" /><span className="coach-stuck-text">{tr(stuck.length === 1 ? 'coach.rank.stuck1' : 'coach.rank.stuckN', { n: stuck.length })}</span>
              <Icon name="down" />
            </button>
            {stuckOpen && (
              <ul className="coach-stuck-list" id={stuckId}>
                {stuck.map(e => <li key={`${e.problem.key}|${e.role ?? ''}`}>{solvedText(e, lang)}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
      {clean && <div className="coach-diag-clean">{clean}</div>}
    </aside>
  );
}

/**
 * Il Piano, sopra la carta grande: i cambi migliori da fare insieme (coachPlan: uno per posto, ognuno alza il voto vero
 * del team coi cambi prima di lui). Ogni passo è una piccola carta (il numero, l'icona del Box, chi entra o la mossa nuova
 * e il posto); un clic la apre nella carta grande. In fondo il voto vero dopo ogni passo ("B 70 → A 81 → A 84"), il dopo
 * nel colore del voto, e "dopo N cambi"; poi "Applica il piano", che fa tutti i passi insieme (un solo Annulla). È un
 * pulsante secondario (bordo, niente magenta): l'unico magenta resta Applica della carta.
 */
function PlanStrip({ steps, start, onOpen, onApply, compact = false }: {
  steps: PlanStep[]; start: TeamRating; onOpen: (groupId: string) => void;
  /** Applica tutti i passi del piano insieme; senza, niente pulsante. */
  onApply?: () => void;
  /** Telefono: i passi piccoli (numero, l'icona e il nome corto; per una mossa l'icona del tipo e la mossa) in una fila che
   *  scorre di lato, il voto di ora → quello finale con "N cambi" e "Applica il piano" sotto. */
  compact?: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const path = [`${start.grade} ${start.overall}`, ...steps.map(st => `${st.grade} ${st.overall}`)].join(' → ');
  const last = steps[steps.length - 1];
  const stepsRef = useRef<HTMLOListElement>(null);
  const fade = useSideFade(stepsRef, `${steps.length}|${compact}`);
  return (
    <nav className={`coach-plan${compact ? ' is-compact' : ''}`} aria-label={tr('coach.plan.region')}>
      <span className="coach-plan-title coach-head" aria-hidden="true">{tr('coach.plan.title')}</span>
      <ol className={`coach-plan-steps${fade.right ? ' fade-right' : ''}${fade.left ? ' fade-left' : ''}`} ref={stepsRef}>
        {steps.map((st, i) => {
          const p = st.proposal;
          // Il nome intero del membro, come nella carta e nella classifica
          const seat = p.kind === 'move' ? tr('coach.vs.on', { member: p.fix.member })
            : p.fix.kind === 'swap' ? tr('coach.row.instead', { member: p.fix.member ?? '' }) : tr('coach.row.free');
          return (
            <li key={st.groupId}>
              {i > 0 && <span className="coach-plan-arrow" aria-hidden="true">→</span>}
              <button type="button" className={`coach-plan-step${p.kind === 'move' ? ' is-move' : ''}`} style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}
                aria-label={tr('coach.plan.stepAria', { n: i + 1, name: proposalName(p, tr, lang), grade: `${st.grade} ${st.overall}` })} {...hint(proposalName(p, tr, lang))}
                onClick={() => onOpen(st.groupId)}>
                <span className="coach-plan-n" aria-hidden="true">{i + 1}</span>
                {compact && p.kind === 'move'
                  ? <PlanMoveIcon move={p.fix.to} />
                  : <PokemonIcon name={subjectOf(p)} />}
                <span className="coach-plan-who" aria-hidden="true">
                  <b>{p.kind === 'move' ? gameName('move', p.fix.to, lang) : p.fix.species}</b>
                  {!compact && <small>{seat}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <span className="coach-plan-grade">
        <span className="visually-hidden">{tr('coach.plan.gradeAria', { path })}</span>
        <span className="coach-plan-path" aria-hidden="true">
          <span className="coach-grade-from">{start.grade} {start.overall}</span>
          {(compact ? steps.slice(-1) : steps).map(st => <span key={st.groupId}><span className="coach-grade-arrow"> → </span><GradeTag score={st.overall} className={st === steps[steps.length - 1] ? 'is-last' : ''} /></span>)}
        </span>
        <small className="coach-plan-after" aria-hidden={compact || undefined}>{compact ? `· ${tr('coach.rank.count', { n: steps.length })}` : tr('coach.plan.after', { n: steps.length })}</small>
      </span>
      {onApply && last && (
        <button type="button" className="coach-plan-apply" onClick={onApply}
          aria-label={tr('coach.plan.applyAria', { n: steps.length, grade: `${last.grade} ${last.overall}` })}>
          <span aria-hidden="true">{tr('coach.plan.apply')}</span>
        </button>
      )}
    </nav>
  );
}

/** Un passo di mossa del Piano sul telefono: l'icona del tipo della mossa nuova (così non sembra un cambio di Pokémon). */
function PlanMoveIcon({ move }: { move: string }) {
  const type = getMove(move)?.type;
  const url = type ? typeIconUrl(type) : undefined;
  return <span className="coach-plan-mv" aria-hidden="true">{url && <img src={url} alt="" draggable={false} />}</span>;
}

/**
 * Le righe della classifica il cui posto ("al posto di X", "su X, al posto di Y") non sta intero su una riga: lì il posto
 * va a capo su due righe invece di tagliarsi (e sul desktop, dove le righe sono alte uguali, le pillole lasciano il
 * posto). Misura il testo senza a capo con un pezzetto nascosto dentro la riga stessa (stesso carattere); si rifà quando
 * cambia la larghezza della lista o le righe (`key`). Senza misura (jsdom) nessuna riga va a capo.
 */
function useSeatWrap(ref: RefObject<HTMLElement | null>, key: string): Set<string> {
  const [ids, setIds] = useState('');
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const out: string[] = [];
      for (const row of list.querySelectorAll<HTMLElement>('.coach-rank')) {
        const seat = row.querySelector<HTMLElement>('.coach-rank-who small');
        if (!seat || !seat.clientWidth) continue;
        const probe = document.createElement('span');
        probe.className = 'coach-rank-probe';
        probe.textContent = seat.textContent;
        seat.appendChild(probe);
        const wide = probe.getBoundingClientRect().width;
        probe.remove();
        if (wide > seat.clientWidth + 0.5 && row.dataset.group) out.push(row.dataset.group);
      }
      const next = out.join('\n');
      setIds(was => (was === next ? was : next));
    };
    const observer = new ResizeObserver(check);
    observer.observe(list);
    check();
    return () => observer.disconnect();
  }, [ref, key]);
  return useMemo(() => new Set(ids ? ids.split('\n') : []), [ids]);
}

/**
 * Quante righe stanno nell'altezza della lista (fino a ROWS_PER_PAGE), con l'altezza delle righe e lo spazio fra loro
 * dal CSS (--row-h, --row-gap); senza misura (jsdom) o con le righe alte quanto serve (telefono) ROWS_PER_PAGE.
 */
function useRowsPerPage(ref: RefObject<HTMLElement | null>, max = ROWS_PER_PAGE, total = 0): { perPage: number; rows: number } {
  const [fit, setFit] = useState({ perPage: ROWS_PER_PAGE, rows: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = el.clientHeight;
      const style = getComputedStyle(el);
      const row = parseFloat(style.getPropertyValue('--row-h'));
      const gap = parseFloat(style.getPropertyValue('--row-gap')) || 0;
      // Le carte stanno in --cols colonne: per pagina righe × colonne
      const cols = Math.max(1, parseInt(style.getPropertyValue('--cols'), 10) || 1);
      if (!height || !row) { setFit(f => (f.perPage === ROWS_PER_PAGE && f.rows === 0 ? f : { perPage: ROWS_PER_PAGE, rows: 0 })); return; }
      // Il margine interno della lista (sopra e sotto) conta: senza, l'ultima riga può finire sotto il fondo del riquadro
      const list = el.firstElementChild;
      const pad = list ? (parseFloat(getComputedStyle(list).paddingTop) || 0) + (parseFloat(getComputedStyle(list).paddingBottom) || 0) : 0;
      let rows = Math.max(1, Math.min(max, Math.floor((height - pad + gap) / (row + gap))));
      // Le pagine ("‹ 1/2 ›") prendono posto: se senza di loro ci stanno tutte le righe, una pagina sola (così la lista
      // non resta a pagine solo perché le pagine ci sono già)
      const pager = el.parentElement?.querySelector<HTMLElement>('.coach-pages');
      // (con Esporta sulla stessa riga la riga resta anche senza le pagine: niente spazio in più)
      if (total && rows < total && pager && !pager.parentElement?.querySelector('.coach-export')) {
        const foot = pager.parentElement;
        const footGap = foot && foot.childElementCount > 1 ? parseFloat(getComputedStyle(foot).rowGap) || 0 : 0;
        const all = Math.floor((height + pager.offsetHeight + footGap - pad + gap) / (row + gap));
        if (all >= total) rows = Math.min(max, total);
      }
      setFit(f => (f.rows === rows && f.perPage === cols * rows ? f : { perPage: cols * rows, rows }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, max, total]);
  return fit;
}

/** Le pagine: "‹ 1/3 ›" come in Coverage meta, coi nomi per lo screen reader. */
function Pager({ page, pages, from, to, onPage, labels }: {
  page: number; pages: number; from: number; to: number; onPage: (page: number) => void;
  labels?: { pages: string; prev: string; next: string; page: 'coach.rank.page' };
}) {
  const tr = useT();
  if (pages <= 1) return null;
  const prev = labels?.prev ?? tr('coach.list.prev');
  const next = labels?.next ?? tr('coach.list.next');
  return (
    <nav className="cm-pages coach-pages" aria-label={labels?.pages ?? tr('coach.list.pages')}>
      <button type="button" className="cm-step" aria-label={prev} {...hint(prev)} disabled={page === 0} onClick={() => onPage(page - 1)}>
        <Icon name="prev" />
      </button>
      <span className="cm-at" aria-live="polite">
        <span aria-hidden="true">{page + 1}/{pages}</span>
        <span className="visually-hidden">{tr(labels?.page ?? 'coach.list.page', { from, to })}</span>
      </span>
      <button type="button" className="cm-step" aria-label={next} {...hint(next)} disabled={page === pages - 1} onClick={() => onPage(page + 1)}>
        <Icon name="next" />
      </button>
    </nav>
  );
}

/**
 * La scheda Coaching, "Diagnosi → Cura": a sinistra la classifica delle proposte (dalla più utile, ognuna coi problemi
 * che è la prima a risolvere; un clic su una proposta la apre, su un problema mostra solo le proposte che lo risolvono);
 * a destra la carta grande della proposta aperta (all'inizio la migliore), alta quanto la colonna. Le proposte quasi uguali
 * stanno insieme (proposalGroups) e quelle che non alzano il voto vanno fra le alternative (neutralAsAlternatives).
 * Senza problemi: Eevee contento e il team da esportare; con problemi che nessuna proposta risolve: Eevee sdraiato a terra, i
 * problemi e Migliora i set. `advice` null: i consigli si stanno calcolando (lo scheletro). `focus`: un problema scelto
 * nella testata di un'area (`nonce` cambia a ogni clic): la lista si filtra su quel problema e la carta grande si accende.
 */
export function CoachingView({ coaching, advice, members, rating, team, data, onFix, onMoveFix, onApplyFix, onApplyMove, onApplyPlan, onExport, onImproveSets, onOverview, focus = null }: {
  coaching: Coaching; advice: CoachAdvice | null; members: number; rating: TeamRating | null;
  /** Il team e i dati del voto: servono al Piano (il voto vero coi cambi fatti insieme); senza, niente Piano. */
  team?: TeamSet[]; data?: EngineData;
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
  const heroTitle = useRef<HTMLDivElement>(null);
  const railHead = useRef<HTMLHeadingElement>(null);
  const lang = useLang();
  const { problems, bannedCount = 0 } = coaching;
  const groups = useMemo(() => (advice ? neutralAsAlternatives(proposalGroups(problems, advice)) : null), [problems, advice]);
  // Il problema scelto a sinistra (null: tutti) e la proposta nella carta grande (null: la prima della lista)
  const [filter, setFilter] = useState<string | null>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  // L'alternativa scelta di ogni posto, solo per i consigli con cui è nata (cambiano i consigli: si riparte dalla migliore)
  const [picks, setPicks] = useState<{ advice: CoachAdvice | null; chosen: Record<string, number> }>({ advice: null, chosen: {} });
  const chosen = picks.advice === advice ? picks.chosen : {};
  const [flash, setFlash] = useState<{ nonce: number; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const handled = useRef<number | null>(null);
  // Telefono (una colonna, sotto i 600 px come phone-analysis.css) e tablet (600–1099 px, col team a sinistra o sopra):
  // la carta a tutta larghezza in alto, la classifica sotto. La carta viene prima anche nel codice, così il Tab segue
  // l'ordine che si vede; il titolo dice quale proposta è ("1 di 5") e "Tutte le proposte ↓" porta alla classifica
  const oneColumn = useMediaQuery(PHONE_QUERY);
  const tablet = useMediaQuery(TABLET_QUERY);
  const stacked = oneColumn || tablet;
  // Il Piano: si calcola dopo il primo disegno (rifà il voto del team qualche volta, ~150 ms su un team lungo) e si
  // rifà quando cambiano i consigli o il team; fino ad allora resta quello di prima (o niente). Usa la migliore di ogni
  // posto, come le righe della classifica
  const [plan, setPlan] = useState<{ groups: ProposalGroup[]; steps: PlanStep[] } | null>(null);
  useEffect(() => {
    if (!groups || !team || !data || !rating || groups.length < 2) return;
    const timer = window.setTimeout(() => {
      setPlan({ groups, steps: coachPlan(groups, g => g.options[0], team, data, lang, rating.overall) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [groups, team, data, rating, lang]);
  const planSteps = plan && plan.groups === groups ? plan.steps : [];
  useEffect(() => {
    // Una volta per clic, e solo coi consigli pronti (mentre si calcolano si aspetta)
    if (!focus || !groups || handled.current === focus.nonce) return;
    handled.current = focus.nonce;
    const solves = (p: Proposal) => p.fix.solves.includes(focus.key);
    const hit = groups.find(g => g.options.some(solves));
    if (!hit) return;
    setFilter(focus.key);
    setHeroId(hit.id);
    setFlash({ nonce: focus.nonce, id: hit.id });
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

  // Il voto di prima dell'ultimo Applica fatto qui (team: quello di allora; after: il team subito dopo). Vale solo finché
  // il team resta quello uscito da quell'Applica: un altro cambio (o Annulla) lo dimentica
  const teamKey: unknown = team ?? coaching;
  const [applied, setApplied] = useState<{ from: TeamRating; key: unknown; after?: unknown } | null>(null);
  const markApply = () => { if (rating) setApplied({ from: rating, key: teamKey }); };
  useEffect(() => {
    setApplied(a => {
      if (!a) return a;
      if (a.after === undefined) return a.key === teamKey ? a : { ...a, after: teamKey };
      return a.after === teamKey ? a : null;
    });
  }, [teamKey]);
  const justApplied = !!applied && (applied.after === teamKey || (applied.after === undefined && applied.key !== teamKey));
  const wasGrade = justApplied && rating && applied!.from.overall !== rating.overall ? applied!.from : null;

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

  // Nessun problema: il team è a posto. Con un posto libero però le aggiunte alzano il voto: si mostra la classifica
  // (anche mentre si calcola); "a posto" solo se nessuna aggiunta lo alza
  if (problems.length === 0 && (members >= 6 || groups?.length === 0)) {
    return (
      <div className="coaching" ref={root}>
        <div className="coach-empty is-clear">
          <EeveeMoment pose="happy" />
          <div className="coach-empty-text">
            <h3>{tr('coach.clear.title')}</h3>
            {/* Il voto grande (lettera e numero nel colore del voto) e, subito dopo un Applica fatto qui, quello di prima */}
            {rating && (
              <p className="coach-clear-grade">
                <span className="visually-hidden">{tr('coach.clear.gradeAria', { grade: `${rating.grade} ${rating.overall}` })}{wasGrade ? `, ${tr('coach.clear.was', { grade: `${wasGrade.grade} ${wasGrade.overall}` })}` : ''}</span>
                <span aria-hidden="true"><GradeTag score={rating.overall} className="is-big" /></span>
                {wasGrade && <span className="coach-clear-was" aria-hidden="true">{tr('coach.clear.was', { grade: `${wasGrade.grade} ${wasGrade.overall}` })}</span>}
              </p>
            )}
            {/* Onesto: "nessun cambio singolo alza il voto" solo quando è vero (nessuna proposta); se no, niente problemi */}
            <p>{tr(groups?.length === 0 ? 'coach.clear.text' : 'coach.clear.textNoProblems')}</p>
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
          <EeveeMoment pose="down" />
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
  const solvesKey = (g: ProposalGroup, key: string) => g.options.some(o => o.fix.solves.includes(key));
  const pickOf = (g: ProposalGroup) => g.options[Math.min(chosen[g.id] ?? 0, g.options.length - 1)];
  const entries = problemEntries(mapped);
  // Un filtro su un problema che dopo un cambio non c'è più (o che nessuno risolve più) vale come "tutti"
  const active = filter && groups?.some(g => solvesKey(g, filter)) && mapped.some(x => x.key === filter) ? filter : null;
  const visible = groups ? (active ? groups.filter(g => solvesKey(g, active)) : groups) : [];
  const hero = visible.find(g => g.id === heroId) ?? visible[0] ?? null;
  const heroPick = hero ? pickOf(hero) : null;
  // I problemi che nessun cambio singolo risolve: in fondo alla classifica
  const stuck = entries.filter(e => !groups?.some(g => solvesKey(g, e.problem.key)));
  // Applica (e Applica il piano): si ricorda il voto di prima, per "prima B 70" se il team arriva a posto
  const actions: RowActions = {
    onFix, onMoveFix,
    onApplyFix: fix => { markApply(); onApplyFix(fix); },
    onApplyMove: fix => { markApply(); onApplyMove(fix); },
    onApplyPlan: onApplyPlan && ((steps, to) => { markApply(); onApplyPlan(steps, to); }),
  };
  const choose = (groupId: string, i: number) => setPicks(s => ({ advice, chosen: { ...(s.advice === advice ? s.chosen : {}), [groupId]: i } }));
  /** Dimentica l'alternativa scelta di questi posti (tornano alla loro migliore). */
  const forget = (...ids: string[]) => setPicks(s => {
    const kept = { ...(s.advice === advice ? s.chosen : {}) };
    for (const groupId of ids) delete kept[groupId];
    return { advice, chosen: kept };
  });
  const pickFilter = (key: string | null) => {
    setFilter(key); setHeroId(null);
    // "Mostra tutte" sparisce col filtro: il fuoco va sul titolo della carta (che ora mostra la migliore)
    if (key === null && document.activeElement?.classList.contains('coach-back')) requestAnimationFrame(() => focusTitle(heroTitle.current));
  };
  // Una riga mostra la migliore del suo posto: aprirla mette nella carta quella (l'alternativa scelta prima si dimentica)
  const open = (groupId: string) => { forget(groupId); setHeroId(groupId); setFlash(f => ({ nonce: (f?.nonce ?? 0) - 1, id: groupId })); };
  // Un passo del Piano fuori dal filtro: il filtro si toglie, così la proposta si vede nella classifica e nella carta
  const openStep = (groupId: string) => { if (!visible.some(g => g.id === groupId)) setFilter(null); open(groupId); };
  // "La proposta scelta": nella carta c'è un altro posto della prima riga, o un'alternativa al posto della migliore
  const chosenNotBest = !!(hero && (hero !== visible[0] || Math.min(chosen[hero.id] ?? 0, hero.options.length - 1) !== 0));
  const backToBest = () => {
    if (hero) forget(hero.id, ...(visible[0] ? [visible[0].id] : []));
    setHeroId(null);
    requestAnimationFrame(() => focusTitle(heroTitle.current));
  };
  const rail = (
    <RankRail key="rail" groups={visible} problems={problems} before={before} entries={entries} stuck={stuck} filter={active} onFilter={pickFilter} onOpen={open}
      heroId={hero?.id ?? null} busy={!groups} clean={cleanLine || null} headRef={stacked ? railHead : undefined} onExport={onExport} />
  );
  // Sul telefono e sul tablet la classifica sta sotto la carta: il titolo dice quale proposta è ("1 di 5"; con un'alternativa aperta
  // "alternativa a X", X la migliore di quel posto) e un tasto porta alla lista
  const at = hero ? visible.indexOf(hero) + 1 : 0;
  const altOpen = !!hero && Math.min(chosen[hero.id] ?? 0, hero.options.length - 1) !== 0;
  const toRanking = () => {
    const head = railHead.current;
    if (!head) return;
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    head.scrollIntoView?.({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    head.focus({ preventScroll: true });
  };
  const main = (
    <section key="main" aria-labelledby={`${id}-list`} className="coach-main">
      <div className={`coach-list-head coach-hero-band${oneColumn ? ' is-phone' : tablet ? ' is-stacked' : ''}`}>
        <h4 className="coach-sec">{tr(chosenNotBest ? 'coach.hero.chosen' : 'coach.hero.best')}
          {stacked && at > 0 && hero && (
            <span className="coach-hero-of">{altOpen ? tr('coach.hero.altOf', { name: shownName(hero.options[0], lang) }) : tr('coach.hero.of', { n: at, total: visible.length })}</span>
          )}
        </h4>
        {((stacked && groups && visible.length > 1) || chosenNotBest) && (
          <div className="coach-hero-acts">
            {stacked && groups && visible.length > 1 && (
              <button type="button" className="coach-back coach-to-rank" onClick={toRanking}>{tr('coach.hero.all')}<span className="coach-to-arrow" aria-hidden="true">↓</span></button>
            )}
            {chosenNotBest && (
              <button type="button" className="coach-back" onClick={backToBest}>
                <Icon name="undo" />{tr('coach.hero.back')}
              </button>
            )}
          </div>
        )}
      </div>
      {groups && rating && planSteps.length >= 2 && (
        <PlanStrip steps={planSteps} start={rating} onOpen={openStep} compact={oneColumn}
          onApply={actions.onApplyPlan ? () => { const last = planSteps[planSteps.length - 1]; actions.onApplyPlan!(planSteps.map(st => st.proposal), `${last.grade} ${last.overall}`); } : undefined} />
      )}
      {groups ? (
        hero && <Hero key={hero.id} group={hero} choice={chosen[hero.id] ?? 0} onChoose={i => choose(hero.id, i)} problems={problems} before={before}
          rating={rating} actions={actions} flash={flash?.id === hero.id} titleRef={heroTitle} />
      ) : (
        <>
          <div className="coach-hero skeleton" aria-hidden="true" />
          <p className="visually-hidden" role="status">{tr('coach.computing')}</p>
        </>
      )}
      {/* Cosa c'è nella carta, detto a chi usa il lettore di schermo quando cambia (proposta aperta, alternativa, filtro) */}
      <p className="visually-hidden" aria-live="polite">{heroPick ? tr('coach.hero.now', { name: proposalName(heroPick, tr, lang) }) : ''}</p>
      {banned}
    </section>
  );
  return (
    <div className="coaching coach-cure" ref={root}>
      {/* Un solo titolo di livello 3 per la scheda (nascosto): sotto, la classifica e la carta coi loro titoli di livello 4 */}
      <h3 className="visually-hidden" id={`${id}-list`}>{tr('coach.list.title')}</h3>
      {stacked ? [main, rail] : [rail, main]}
    </div>
  );
}
