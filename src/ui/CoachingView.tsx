import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { CoachAdvice, Coaching, CoachProblem } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import { areaValue, neutralAsAlternatives, PROPOSAL_AREAS, proposalGroups, type Proposal, type ProposalArea, type ProposalGroup } from '../engine/coachProposals';
import { columnOf } from '../engine/coachSteps';
import { battleSpecies } from '../engine/dex';
import type { MoveFix } from '../engine/moveFixes';
import { needLabel, type Need } from '../engine/needs';
import { gradeFor, type TeamRating } from '../engine/rating';
import type { LevelKey } from '../engine/roleLevels';
import { rolesPointsLabel } from '../engine/rolesArea';
import { areaSnapshot, type AreaSnapshot } from '../engine/teamGain';
import { exportShowdown } from '../engine/sets';
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
import { TypeIcons } from './typeIcons';
import { PokemonIcon } from './PokemonName';
import { hint } from './MoveTip';
import { MoreProblems, problemEntries, ProblemChip, ProblemPill, type ProblemEntry } from './ProblemPill';
import { Sprite, typeColor } from './Sprite';

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

/** Un'area che cambia con una proposta: il nome e "da → a" (su o giù). */
interface AreaMove { area: ProposalArea; from: string; to: string; up: boolean }

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
  const solved = problemEntries(problems.filter(x => solves.has(x.key) && shown(x) && !(x.category === 'meta' && self && x.subjects?.includes(self))));
  const after = p.fix.after ?? null;
  const moves: AreaMove[] = [];
  if (before && after) {
    for (const area of PROPOSAL_AREAS) {
      const was = areaValue(before, area);
      const now = areaValue(after, area);
      const from = areaText(before, area);
      const to = areaText(after, area);
      if (was === null || now === null || was === now || from === null || to === null) continue;
      moves.push({ area, from, to, up: now > was });
    }
  }
  return { solved, ups: moves.filter(m => m.up), downs: moves.filter(m => !m.up), lost: p.fix.lostHelpers ?? [] };
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

/** Un problema risolto: la spunta verde e il testo corto del problema (come la pillola, ma "fatto"); va a capo se è lungo. */
function Solved({ entry }: { entry: ProblemEntry }) {
  return (
    <li className="coach-solved">
      <Icon name="check" />
      <ProblemPill problem={entry.problem} role={entry.role} />
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



/** Chi entra (o il membro che cambia mossa): lo sprite della proposta. */
const subjectOf = (p: Proposal) => (p.kind === 'fix' ? p.fix.species : p.fix.member);

/**
 * La targhetta come nell'editor (STRUMENTO, ABILITÀ): l'etichetta chiara a sinistra col taglio obliquo, il valore a
 * destra ("AL POSTO DI · Gholdengo").
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
 * Il titolo della carta grande: per un cambio di Pokémon il nome di chi entra e "AL POSTO DI · X" (o "in un posto
 * libero"); per un cambio di mossa la mossa nuova è la protagonista (la pillola grande), poi "SU · membro" e "AL POSTO DI ·
 * mossa vecchia" in grigio.
 */
function HeroTitle({ p, bind }: { p: Proposal; bind?: object }) {
  const tr = useT();
  const lang = useLang();
  if (p.kind === 'move') {
    return (
      <div className="coach-hero-title is-move">
        <MovePill name={p.fix.to} className="coach-move-in" />
        <span className="coach-hero-plates">
          <CardPlate label={tr('coach.plate.on')}><PokemonIcon name={p.fix.member} />{p.fix.member}</CardPlate>
          {p.fix.from
            ? <CardPlate label={tr('coach.plate.instead')} className="is-out"><s>{gameName('move', p.fix.from, lang)}</s></CardPlate>
            : <span className="coach-hero-free">{tr('coach.row.emptySlot')}</span>}
        </span>
        <span className="visually-hidden">{tr('coach.row.moveKind')}</span>
      </div>
    );
  }
  return (
    <div className="coach-hero-title">
      <b className="coach-hero-name" {...bind}>{p.fix.species}</b>
      {p.fix.kind === 'swap'
        ? <CardPlate label={tr('coach.plate.instead')}><PokemonIcon name={p.fix.member ?? ''} />{p.fix.member}</CardPlate>
        : <CardPlate label={tr('coach.plate.add')}>{tr('coach.plate.freeSlot')}</CardPlate>}
    </div>
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
      <h5>{tr('coach.hero.set')}</h5>
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
 * La carta grande: la proposta scelta. A sinistra la zona del Pokémon come le carte Pedana (la luce del primo tipo, chi
 * entra in piedi sulla pedana, chi esce piccolo e spento col ⇄); a destra il titolo, il voto prima → dopo col +N, poi
 * "Risolve" (spunte verdi), "Migliora" e "Costa" (aree che scendono, ruoli d'aiuto persi); in fondo Applica (magenta: è
 * l'azione migliore sullo schermo), il link alla scheda Pokémon o al set e, se il posto ha altre proposte, "Oppure" con le
 * piccole carte delle alternative (un clic la mette nella carta grande).
 */
function Hero({ group, choice, onChoose, problems, before, rating, actions, flash, titleRef }: {
  group: ProposalGroup; choice: number; onChoose: (index: number) => void; problems: CoachProblem[];
  before: AreaSnapshot | null; rating: TeamRating | null; actions: RowActions; flash: boolean;
  /** Il titolo (nascosto) della carta: riceve il fuoco quando il pulsante usato sparisce (un'alternativa scelta). */
  titleRef: RefObject<HTMLDivElement | null>;
}) {
  const tr = useT();
  const lang = useLang();
  const memberTip = useMemberTip();
  const headId = useId();
  const at = Math.min(choice, group.options.length - 1);
  const p = group.options[at];
  const fx = effectsOf(p, problems, before);
  const name = proposalName(p, tr, lang);
  const after = rating ? Math.max(0, Math.min(100, rating.overall + p.fix.gain)) : null;
  const apply = () => (p.kind === 'fix' ? actions.onApplyFix(p.fix) : actions.onApplyMove(p.fix));
  const see = () => (p.kind === 'fix' ? actions.onFix(p.fix) : actions.onMoveFix(p.fix));
  const costs = fx.downs.length + fx.lost.length;
  // Copia set: per un attimo "Copiato" con la spunta, come nel dettaglio dei candidati
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 1500); return () => window.clearTimeout(timer); }, [copied]);
  return (
    <article className={`coach-hero${p.kind === 'move' ? ' is-move' : ''}${flash ? ' is-flash' : ''}`} data-row={group.id} aria-labelledby={headId}
      style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}>
      <h4 id={headId} className="visually-hidden">{name}</h4>
      {/* Lo scambio si vede: in alto chi esce (spento, "esce"), la freccia, sotto chi entra sulla pedana */}
      <div className={`coach-pad${p.kind === 'fix' && p.fix.kind === 'swap' ? ' has-out' : ''}`}>
        {p.kind === 'fix' && p.fix.kind === 'swap' && (
          <span className="coach-pad-out" aria-hidden="true">
            <Sprite species={p.fix.member ?? ''} size={64} /><small>{tr('coach.pad.out')}</small>
            <span className="coach-pad-swap"><Icon name="down" /></span>
          </span>
        )}
        {p.kind === 'fix' && p.fix.kind === 'add' && <span className="coach-pad-out is-add" aria-hidden="true"><span className="coach-pad-swap"><Icon name="plus" /></span></span>}
        <span className="coach-stage">
          <span className="pedana-disc" aria-hidden="true" />
          <span className="coach-art-in" {...(p.kind === 'fix' ? memberTip.bind(p.fix.set) : {})}><Sprite species={subjectOf(p)} size={96} /></span>
        </span>
      </div>
      <div className="coach-hero-body">
        <div className="coach-hero-head">
          {/* Il titolo visibile riceve il fuoco quando il pulsante usato sparisce (un'alternativa, "Torna alla migliore", "Mostra tutte") */}
          <div className="coach-hero-focus" ref={titleRef} tabIndex={-1} aria-labelledby={headId}>
            <HeroTitle p={p} bind={p.kind === 'fix' ? memberTip.bind(p.fix.set) : undefined} />
          </div>
          <div className="coach-hero-grade">
            <b className="coach-gain">{gainText(p.fix.gain)}</b>
            {rating && after !== null && (
              <span className="coach-grade-change">
                <span className="visually-hidden">{tr('detail.gradeLabel')} </span>
                {tr('detail.gradeChange', { from: `${rating.grade} ${rating.overall}`, to: `${gradeFor(after, lang).grade} ${after}` })}
              </span>
            )}
          </div>
        </div>
        {/* La parte centrale scorre se è lunga; Applica e le altre azioni restano sempre in vista sotto */}
        <div className="coach-hero-scroll">
        <div className="coach-hero-facts">
          <section className="coach-fact is-good" aria-label={tr('coach.hero.solves')}>
            <h5>{tr('coach.hero.solves')}</h5>
            {fx.solved.length > 0
              ? <ul className="coach-solved-list">{fx.solved.map(entry => <Solved key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} />)}</ul>
              : <p className="coach-fact-none">{tr('coach.hero.raisesOnly')}</p>}
            {fx.ups.length > 0 && <p className="coach-moves">{fx.ups.map(m => <Change key={m.area} move={m} />)}</p>}
          </section>
          <section className={`coach-fact${costs ? ' is-bad' : ''}`} aria-label={tr('coach.hero.costs')}>
            <h5>{tr('coach.hero.costs')}</h5>
            {costs === 0 && <p className="coach-fact-none">{tr('coach.hero.nothing')}</p>}
            {fx.downs.length > 0 && <p className="coach-moves">{fx.downs.map(m => <Change key={m.area} move={m} />)}</p>}
            {fx.lost.length > 0 && <p className="coach-lost"><b>{tr('coach.row.lost')}</b> {fx.lost.map(key => needLabel(key, lang)).join(', ')}</p>}
          </section>
        </div>
        <SetSummary p={p} />
        </div>
        <div className="coach-hero-foot">
          <button type="button" className="coach-apply is-primary" aria-label={tr('coach.row.applyAria', { name })} onClick={apply}>{tr('coach.row.apply')}</button>
          <button type="button" className="coach-see" onClick={see} {...hint(tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet'))}
            aria-label={p.kind === 'fix' ? tr('coach.row.seeAria', { species: p.fix.species }) : tr('coach.row.openSetAria', { member: p.fix.member })}>
            <Icon name="search" /><span aria-hidden="true">{tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet')}</span>
          </button>
          <button type="button" className={`coach-see coach-copy${copied ? ' is-done' : ''}`} aria-label={tr('suggest.copySet')} {...hint(tr('suggest.copySet'))}
            onClick={async () => { if (await copyText(exportShowdown([p.fix.set]))) setCopied(true); }}>
            <Icon name={copied ? 'check' : 'copy'} /><span aria-hidden="true">{tr(copied ? 'team.copied' : 'suggest.copySetShort')}</span>
          </button>
          {copied && <span className="visually-hidden" role="status">{tr('team.copied')}</span>}
          {group.options.length > 1 && (
            <div className="coach-alts" role="group" aria-label={tr('coach.alt.title', { n: group.options.length - 1 })}>
              <span className="coach-alts-word" aria-hidden="true">{tr('coach.alt.or')}</span>
              {group.options.map((o, i) => (i === at ? null : (
                <button key={i} type="button" className="coach-alt-tile" style={{ '--t1': typeColor(firstType(o)) } as CSSProperties}
                  aria-label={tr('coach.alt.pick', { name: proposalName(o, tr, lang) })} {...hint(proposalName(o, tr, lang))}
                  onClick={() => { onChoose(i); requestAnimationFrame(() => titleRef.current?.focus()); }}>
                  <PokemonIcon name={subjectOf(o)} />
                  {o.kind === 'move' && <span className="coach-alt-move" aria-hidden="true">{gameName('move', o.fix.to, lang)}</span>}
                  <b aria-hidden="true">{gainText(o.fix.gain)}</b>
                </button>
              )))}
            </div>
          )}
        </div>
      </div>
      {memberTip.tip}
    </article>
  );
}

/** La guida del Coaching (il "?" in testa alla diagnosi): come si legge la scheda, in quattro punti. */
function CoachingGuide() {
  const tr = useT();
  return (
    <div className="coach-guide">
      {(['diag', 'card', 'facts', 'apply'] as const).map(k => (
        <section key={k}>
          <h4>{tr(`coach.help.${k}.title`)}</h4>
          <p>{tr(`coach.help.${k}.text`)}</p>
        </section>
      ))}
    </div>
  );
}

/** Un problema risolto in piccolo per la riga della classifica: la minaccia (icona e nome), i tipi (icone e nome), un ruolo (×), il resto in testo corto. */
function SolvedPill({ entry }: { entry: ProblemEntry }) {
  const lang = useLang();
  const { problem, role } = entry;
  const subjects = problem.subjects ?? [];
  let body: ReactNode;
  if (role) body = <><Icon name="close" />{needLabel(role as Need, lang)}</>;
  else if ((problem.category === 'meta' || problem.category === 'metaHit') && subjects[0]) body = <><PokemonIcon name={subjects[0]} />{subjects[0]}</>;
  else if ((problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0) body = <><TypeIcons types={subjects.slice(0, 2)} />{subjects.slice(0, 2).map(t => typeName(t as TypeName, lang)).join(' / ')}</>;
  else body = problem.text;
  return <span className="coach-pill"><Icon name="check" /><span className="coach-pill-text">{body}</span></span>;
}

/** Quanti problemi risolti in piccolo stanno nella riga della classifica; gli altri in "+N". */
const PILLS = 2;

/**
 * La classifica: una riga per proposta, dalla più utile (+N più alto): l'icona del Box sul colore del tipo, il nome (o la
 * mossa nuova), "al posto di X", il +N e sotto i primi problemi che risolve in piccolo (tutti contano, anche quelli che
 * risolve anche un'altra proposta) con "+N". Un clic la apre nella carta grande (quella aperta ha l'anello ciano). Sopra la
 * lista il filtro per problema (una tendina: "Tutti i problemi" o un problema, col numero di proposte che lo risolvono);
 * in fondo "Restano N problemi" che nessun cambio singolo risolve (i nomi nel fumetto). A pagine come le altre liste.
 */
function RankRail({ groups, pickOf, problems, entries, stuck, filter, onFilter, onOpen, heroId, clean, busy }: {
  groups: ProposalGroup[]; pickOf: (g: ProposalGroup) => Proposal; problems: CoachProblem[]; entries: ProblemEntry[]; stuck: ProblemEntry[];
  filter: string | null; onFilter: (key: string | null) => void; onOpen: (groupId: string) => void; heroId: string | null; clean: ReactNode; busy: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const headId = useId();
  const filterId = useId();
  const box = useRef<HTMLDivElement>(null);
  const { perPage, rows } = useRowsPerPage(box, 12);
  const [start, setStart] = useState(0);
  const size = rows ? perPage : Math.max(1, groups.length);
  const pages = Math.max(1, Math.ceil(groups.length / size));
  const page = Math.min(Math.floor(start / size), pages - 1);
  const shown = groups.slice(page * size, (page + 1) * size);
  // Il filtro cambia la lista: si riparte dalla prima pagina
  useEffect(() => { setStart(0); }, [filter]);
  const solvable = entries.filter(e => !stuck.includes(e));
  const keys = [...new Set(solvable.map(e => e.problem.key))];
  const label = (key: string) => {
    const e = entries.find(x => x.problem.key === key)!;
    return e.role ? needLabel(e.role as Need, lang) : e.problem.text;
  };
  return (
    <aside className="coach-diag" aria-labelledby={headId}>
      <div className="coach-diag-top">
        <h3 id={headId} className="coach-diag-head">{tr('coach.rank.title')}{!busy && <span className="coach-diag-total">{tr('coach.rank.count', { n: groups.length })}</span>}</h3>
        <HelpButton title={tr('coach.help.title')} className="coach-help"><CoachingGuide /></HelpButton>
      </div>
      {keys.length > 0 && (
        <div className={`coach-filter${filter ? ' is-on' : ''}`}>
          <label htmlFor={filterId}>{tr('coach.rank.filter')}</label>
          <select id={filterId} value={filter ?? ''} onChange={e => onFilter(e.target.value || null)}>
            <option value="">{tr('coach.rank.allProblems')}</option>
            {keys.map(key => <option key={key} value={key}>{label(key)}</option>)}
          </select>
          {filter && <button type="button" className="coach-back" onClick={() => onFilter(null)}><Icon name="close" />{tr('coach.list.showAll')}</button>}
        </div>
      )}
      <div className="coach-diag-box" ref={box}>
        {busy ? (
          <ol className="coach-diag-list" aria-busy="true">
            {Array.from({ length: rows ? perPage : 4 }, (_, i) => <li key={i} className="coach-rank-skeleton" aria-hidden="true" />)}
          </ol>
        ) : (
          <ol className="coach-diag-list">
            {shown.map(group => {
              const pick = pickOf(group);
              const name = proposalName(pick, tr, lang);
              const fx = effectsOf(pick, problems, null);
              const seat = pick.kind === 'move'
                ? tr('coach.item.move', { member: pick.fix.member, from: pick.fix.from ? gameName('move', pick.fix.from, lang) : tr('coach.row.emptySlot') })
                : pick.fix.kind === 'swap' ? tr('coach.row.instead', { member: pick.fix.member ?? '' }) : tr('coach.row.free');
              const open = group.id === heroId;
              return (
                <li key={group.id}>
                  <button type="button" className={`coach-rank${open ? ' is-open' : ''}${pick.kind === 'move' ? ' is-move' : ''}`} aria-current={open ? 'true' : undefined}
                    style={{ '--t1': typeColor(firstType(pick)) } as CSSProperties} aria-label={tr('coach.rank.openAria', { name })}
                    aria-describedby={`${group.id}-solves`} onClick={() => onOpen(group.id)}>
                    <span className="coach-rank-mon" aria-hidden="true"><PokemonIcon name={subjectOf(pick)} /></span>
                    <span className="coach-rank-who" aria-hidden="true">
                      <b>{pick.kind === 'move' ? gameName('move', pick.fix.to, lang) : pick.fix.species}</b>
                      <small>{seat}</small>
                    </span>
                    <b className="coach-rank-gain" aria-hidden="true">{gainText(pick.fix.gain)}</b>
                    <span className="coach-rank-pills" aria-hidden="true">
                      {fx.solved.length > 0
                        ? <>{fx.solved.slice(0, PILLS).map(e => <SolvedPill key={`${e.problem.key}|${e.role ?? ''}`} entry={e} />)}
                            {fx.solved.length > PILLS && <span className="coach-pill-more">+{fx.solved.length - PILLS}</span>}</>
                        : <span className="coach-pill-none">{tr('coach.hero.raisesOnly')}</span>}
                    </span>
                    <span id={`${group.id}-solves`} className="visually-hidden">
                      {fx.solved.length ? `${tr('coach.hero.solves')}: ${fx.solved.map(e => solvedText(e, lang)).join('; ')}` : tr('coach.hero.raisesOnly')}
                    </span>
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
        {stuck.length > 0 && !filter && (
          <p className="coach-rank-stuck" tabIndex={0} {...hint(stuck.map(e => solvedText(e, lang)).join('; '))}>
            <Icon name="warning" />{tr(stuck.length === 1 ? 'coach.rank.stuck1' : 'coach.rank.stuckN', { n: stuck.length })}
            <span className="visually-hidden">: {stuck.map(e => solvedText(e, lang)).join('; ')}</span>
          </p>
        )}
      </div>
      {clean}
    </aside>
  );
}

/**
 * Quante righe stanno nell'altezza della lista (fino a ROWS_PER_PAGE), con l'altezza delle righe e lo spazio fra loro
 * dal CSS (--row-h, --row-gap); senza misura (jsdom) o con le righe alte quanto serve (telefono) ROWS_PER_PAGE.
 */
function useRowsPerPage(ref: RefObject<HTMLElement | null>, max = ROWS_PER_PAGE): { perPage: number; rows: number } {
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
      const rows = Math.max(1, Math.min(max, Math.floor((height + gap) / (row + gap))));
      setFit(f => (f.rows === rows && f.perPage === cols * rows ? f : { perPage: cols * rows, rows }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, max]);
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
  const heroTitle = useRef<HTMLDivElement>(null);
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
  const actions: RowActions = { onFix, onMoveFix, onApplyFix, onApplyMove };
  const choose = (groupId: string, i: number) => setPicks(s => ({ advice, chosen: { ...(s.advice === advice ? s.chosen : {}), [groupId]: i } }));
  const pickFilter = (key: string | null) => {
    setFilter(key); setHeroId(null);
    // "Mostra tutte" sparisce col filtro: il fuoco va sul titolo della carta (che ora mostra la migliore)
    if (key === null && document.activeElement?.classList.contains('coach-back')) requestAnimationFrame(() => heroTitle.current?.focus());
  };
  const open = (groupId: string) => { setHeroId(groupId); setFlash(f => ({ nonce: (f?.nonce ?? 0) - 1, id: groupId })); };
  const chosenNotBest = !!(hero && heroId && hero.id === heroId && hero !== visible[0]);
  return (
    <div className="coaching coach-cure" ref={root}>
      <RankRail groups={visible} pickOf={pickOf} problems={problems} entries={entries} stuck={stuck} filter={active} onFilter={pickFilter} onOpen={open}
        heroId={hero?.id ?? null} busy={!groups} clean={cleanLine ? <div className="coach-diag-clean">{cleanLine}</div> : null} />
      <section aria-labelledby={`${id}-list`} className="coach-main">
        <h3 className="visually-hidden" id={`${id}-list`}>{tr('coach.list.title')}</h3>
        <div className="coach-list-head coach-hero-band">
          <h4 className="coach-sec">{tr(chosenNotBest ? 'coach.hero.chosen' : 'coach.hero.best')}</h4>
          {chosenNotBest && (
            <button type="button" className="coach-back" onClick={() => { setHeroId(null); requestAnimationFrame(() => heroTitle.current?.focus()); }}>
              <Icon name="undo" />{tr('coach.hero.back')}
            </button>
          )}
        </div>
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
    </div>
  );
}
