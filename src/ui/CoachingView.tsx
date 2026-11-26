import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CoachAdvice, Coaching } from '../engine/coach';
import { neutralAsAlternatives, proposalGroups, type Proposal, type ProposalGroup } from '../engine/coachProposals';
import { columnOf } from '../engine/coachSteps';
import { coachPlan, type PlanStep } from '../engine/coachPlan';
import type { EngineData } from '../engine/data';
import type { TeamRating } from '../engine/rating';
import { areaSnapshot } from '../engine/teamGain';
import type { TeamSet } from '../engine/sets';
import { useLang, useT } from '../i18n/react';
import { rolesValue } from './AreaDetail';
import { EeveeMoment } from './EeveeMoment';
import { Icon } from './icons';
import { MoreProblems, problemEntries, ProblemChip } from './ProblemPill';
import { PHONE_QUERY, useMediaQuery, reducedMotion } from './useMediaQuery';
import { type RowActions, shown, proposalName } from './coaching/effects';
import { GradeTag, shownName, focusTitle, Hero } from './coaching/HeroCard';
import { RankRail } from './coaching/RankRail';
import { PlanStrip } from './coaching/PlanStrip';
import { useFlash } from './useFlash';

/** Quanto resta accesa la riga aperta dalla testata di un'area. */
export const FLASH_MS = 2000;

/** Il tablet (la carta in alto, la classifica sotto; la pagina scorre): fra il telefono e il desktop. */
const TABLET_QUERY = '(min-width: 600px) and (max-width: 1099px)';

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
  const [copied, setCopied] = useFlash(1800);
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
    const still = reducedMotion();
    el?.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
    const timer = window.setTimeout(() => setFlash(f => (f?.nonce === flash.nonce ? null : f)), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

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
    const still = reducedMotion();
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
