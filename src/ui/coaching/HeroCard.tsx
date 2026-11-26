import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { CoachProblem } from '../../engine/coach';
import { proposalSeat, type Proposal, type ProposalGroup } from '../../engine/coachProposals';
import { needLabel, type Need } from '../../engine/needs';
import { gradeFor, type TeamRating } from '../../engine/rating';
import type { AreaSnapshot } from '../../engine/teamGain';
import { exportShowdown } from '../../engine/sets';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { ItemIcon } from '../ItemIcon';
import { Icon } from '../icons';
import { useMemberTip } from '../MemberCard';
import { MovePill } from '../MovePill';
import { copyText } from '../clipboard';
import { PokemonIcon } from '../PokemonName';
import { hint } from '../MoveTip';
import { ProblemPill, type ProblemEntry } from '../ProblemPill';
import { Sprite, typeColor } from '../Sprite';
import { gainText } from './gainText';
import { type RowActions, AREA_NAME, type AreaMove, type Effects, effectsOf, isRule, proposalName, firstType, heroTone, subjectOf } from './effects';
import { useFlash } from '../useFlash';

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

/** La lettera e il numero di un voto ("A 81") nel colore del voto (S magenta, A verde, B ciano, C giallo, D rosso). */
export function GradeTag({ score, className = '' }: { score: number; className?: string }) {
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
export const shownName = (o: Proposal, lang: ReturnType<typeof useLang>) => (o.kind === 'move' ? gameName('move', o.fix.to, lang) : o.fix.species);

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
export function useSideFade(ref: RefObject<HTMLElement | null>, key: string): { left: boolean; right: boolean } {
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
export function focusTitle(el: HTMLElement | null) {
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

/** Le alternative visibili subito in "Oppure"; le altre dietro "altre N". */
const ALTS_SHOWN = 3;

/**
 * La carta grande: la proposta scelta. In alto la fascia VS (chi esce, il +N col voto prima → dopo, chi entra); sotto
 * "Risolve" (spunte verdi e le aree che salgono) accanto a "Costa" (aree che scendono, ruoli d'aiuto persi), poi il Set; in
 * fondo Applica (magenta: è l'azione migliore sullo schermo), il link alla scheda Pokémon o al set, Copia e, se il posto
 * ha altre proposte, "Oppure" con le piccole carte delle alternative (le prime tre col nome, le altre dietro "altre N").
 */
export function Hero({ group, choice, onChoose, problems, before, rating, actions, flash, titleRef }: {
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
  const [copied, setCopied] = useFlash(1500);
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
