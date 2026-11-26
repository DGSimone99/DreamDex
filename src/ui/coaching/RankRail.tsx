import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { CoachProblem } from '../../engine/coach';
import type { ProposalArea, ProposalGroup } from '../../engine/coachProposals';
import { needLabel, type Need } from '../../engine/needs';
import type { AreaSnapshot } from '../../engine/teamGain';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { HelpButton } from '../AnalysisTabs';
import { Icon } from '../icons';
import { TypeIcons } from '../typeIcons';
import { PokemonIcon } from '../PokemonName';
import { hint } from '../MoveTip';
import { isMissingRoles, isThreat, type ProblemEntry } from '../ProblemPill';
import { useFitCount } from '../useFit';
import { typeColor } from '../Sprite';
import { gainText } from './gainText';
import { type Effects, effectsOf, AREA_SHORT, biggestLoss, lossText, isRule, solvedText, proposalName, firstType, subjectOf } from './effects';
import { CoachingGuide, ExportLink } from './CoachingGuide';
import { Pager } from '../Pager';

/** Righe per pagina al più (e senza misura: jsdom, telefono). */
const ROWS_PER_PAGE = 4;

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
export function RankRail({ groups, problems, before, entries, stuck, filter, onFilter, onOpen, heroId, clean, busy, headRef, onExport }: {
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
        <Pager page={page} pages={pages} onPage={n => setStart(n * size)} className="coach-pages"
          label={tr('coach.list.pages')} prev={tr('coach.list.prev')} next={tr('coach.list.next')} pageText={tr('coach.rank.page', { from: page + 1, to: pages })} />
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
