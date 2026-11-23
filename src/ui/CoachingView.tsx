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
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { rolesValue } from './AreaDetail';
import { HelpButton } from './AnalysisTabs';
import { EeveeMoment } from './EeveeMoment';
import { Icon } from './icons';
import { useMemberTip } from './MemberCard';
import { MovePill } from './MovePill';
import { PokemonIcon } from './PokemonName';
import { hint } from './MoveTip';
import { MoreProblems, problemEntries, ProblemChip, ProblemPill, type ProblemEntry } from './ProblemPill';
import { Sprite, typeColor } from './Sprite';
import { TypeIcons } from './typeIcons';

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

/** Di cosa parla un problema risolto, in piccolo: la minaccia (icona del Box), i tipi (icone), un ruolo (×); altrimenti niente. */
function SolvedSubject({ entry }: { entry: ProblemEntry }) {
  const subjects = entry.problem.subjects ?? [];
  if (entry.role) return <span className="coach-mark-role"><Icon name="close" /></span>;
  if ((entry.problem.category === 'meta' || entry.problem.category === 'metaHit') && subjects[0]) return <PokemonIcon name={subjects[0]} />;
  if ((entry.problem.category === 'defense' || entry.problem.category === 'coverage') && subjects.length > 0) return <TypeIcons types={subjects.slice(0, 2)} />;
  return null;
}

/**
 * I problemi risolti in una riga della lista, compatti: la spunta, quanti sono e le icone di cosa sono (minacce, tipi,
 * ruoli). Le parole nel fumetto e ai lettori di schermo.
 */
function SolvedMarks({ entries }: { entries: ProblemEntry[] }) {
  const tr = useT();
  const lang = useLang();
  const text = `${tr('coach.hero.solves')}: ${entries.map(e => solvedText(e, lang)).join('; ')}`;
  return (
    <span className="coach-marks" {...hint(text)}>
      <span className="coach-marks-n"><Icon name="check" />{entries.length}</span>
      <span className="coach-marks-icons" aria-hidden="true">
        {entries.slice(0, 6).map(e => <SolvedSubject key={`${e.problem.key}|${e.role ?? ''}`} entry={e} />)}
      </span>
      <span className="visually-hidden">{text}</span>
    </span>
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

/** I problemi risolti scritti per intero nella carta grande; gli altri in "+N altri" (col fumetto). */
const SOLVED_SHOWN = 3;

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
        : <span className="coach-hero-free">{tr('coach.row.free')}</span>}
    </div>
  );
}

/**
 * La carta grande: la proposta scelta. A sinistra la zona del Pokémon come le carte Pedana (la luce del primo tipo, chi
 * entra in piedi sulla pedana, chi esce piccolo e spento col ⇄); a destra il titolo, il voto prima → dopo col +N, poi
 * "Risolve" (spunte verdi), "Migliora" e "Costa" (aree che scendono, ruoli d'aiuto persi); in fondo Applica (magenta: è
 * l'azione migliore sullo schermo), il link alla scheda Pokémon o al set e, se il posto ha altre proposte, "Oppure" con le
 * piccole carte delle alternative (un clic la mette nella carta grande).
 */
function Hero({ group, choice, onChoose, problems, before, rating, actions, flash }: {
  group: ProposalGroup; choice: number; onChoose: (index: number) => void; problems: CoachProblem[];
  before: AreaSnapshot | null; rating: TeamRating | null; actions: RowActions; flash: boolean;
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
  return (
    <article className={`coach-hero${p.kind === 'move' ? ' is-move' : ''}${flash ? ' is-flash' : ''}`} data-row={group.id} aria-labelledby={headId}
      style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}>
      <h4 id={headId} className="visually-hidden">{name}</h4>
      <div className="coach-pad">
        {p.kind === 'fix' && p.fix.kind === 'swap' && (
          <span className="coach-pad-out" aria-hidden="true"><Sprite species={p.fix.member ?? ''} size={48} /><span className="coach-pad-swap"><Icon name="swap" /></span></span>
        )}
        {p.kind === 'fix' && p.fix.kind === 'add' && <span className="coach-pad-out" aria-hidden="true"><span className="coach-pad-swap"><Icon name="plus" /></span></span>}
        <span className="coach-stage">
          <span className="pedana-disc" aria-hidden="true" />
          <span className="coach-art-in" {...(p.kind === 'fix' ? memberTip.bind(p.fix.set) : {})}><Sprite species={subjectOf(p)} size={96} /></span>
        </span>
      </div>
      <div className="coach-hero-body">
        <div className="coach-hero-head">
          <HeroTitle p={p} bind={p.kind === 'fix' ? memberTip.bind(p.fix.set) : undefined} />
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
        <div className="coach-hero-facts">
          <section className="coach-fact is-good" aria-label={tr('coach.hero.solves')}>
            <h5>{tr('coach.hero.solves')}</h5>
            {fx.solved.length > 0
              ? (
                <ul className="coach-solved-list">
                  {fx.solved.slice(0, SOLVED_SHOWN).map(entry => <Solved key={`${entry.problem.key}|${entry.role ?? ''}`} entry={entry} />)}
                  {fx.solved.length > SOLVED_SHOWN && (
                    <li className="coach-solved-more" tabIndex={0} {...hint(fx.solved.slice(SOLVED_SHOWN).map(e => solvedText(e, lang)).join('; '))}>
                      {tr(fx.solved.length - SOLVED_SHOWN === 1 ? 'coach.hero.more1' : 'coach.hero.more', { n: fx.solved.length - SOLVED_SHOWN })}
                      <span className="visually-hidden">: {fx.solved.slice(SOLVED_SHOWN).map(e => solvedText(e, lang)).join('; ')}</span>
                    </li>
                  )}
                </ul>
              )
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
        <div className="coach-hero-foot">
          <button type="button" className="coach-apply is-primary" aria-label={tr('coach.row.applyAria', { name })} onClick={apply}>{tr('coach.row.apply')}</button>
          <button type="button" className="coach-see" onClick={see} {...hint(tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet'))}
            aria-label={p.kind === 'fix' ? tr('coach.row.seeAria', { species: p.fix.species }) : tr('coach.row.openSetAria', { member: p.fix.member })}>
            <Icon name="search" /><span aria-hidden="true">{tr(p.kind === 'fix' ? 'coach.row.see' : 'coach.row.openSet')}</span>
          </button>
          {group.options.length > 1 && (
            <div className="coach-alts" role="group" aria-label={tr('coach.alt.title', { n: group.options.length - 1 })}>
              <span className="coach-alts-word" aria-hidden="true">{tr('coach.alt.or')}</span>
              {group.options.map((o, i) => (i === at ? null : (
                <button key={i} type="button" className="coach-alt-tile" style={{ '--t1': typeColor(firstType(o)) } as CSSProperties}
                  aria-label={tr('coach.alt.pick', { name: proposalName(o, tr, lang) })} {...hint(proposalName(o, tr, lang))} onClick={() => onChoose(i)}>
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

/**
 * Una riga compatta della lista sotto la carta grande (stile Box): chi entra, il +N, "al posto di X", i primi problemi che
 * risolve (spunte verdi) e la freccia. Un clic la porta nella carta grande.
 */
function ProposalItem({ group, choice, problems, before, onOpen }: {
  group: ProposalGroup; choice: number; problems: CoachProblem[]; before: AreaSnapshot | null; onOpen: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const p = group.options[Math.min(choice, group.options.length - 1)];
  const fx = effectsOf(p, problems, before);
  const seat = p.kind === 'move'
    ? tr('coach.item.move', { member: p.fix.member, from: p.fix.from ? gameName('move', p.fix.from, lang) : tr('coach.row.emptySlot') })
    : p.fix.kind === 'swap' ? tr('coach.row.instead', { member: p.fix.member ?? '' }) : tr('coach.row.free');
  return (
    <li className={`coach-item${p.kind === 'move' ? ' is-move' : ''}`} data-row={group.id} style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}>
      <button type="button" className="coach-item-btn" onClick={onOpen} aria-label={tr('coach.item.open', { name: proposalName(p, tr, lang) })}>
        <span className="coach-item-mon" aria-hidden="true"><PokemonIcon name={subjectOf(p)} /></span>
        <b className="coach-item-gain" aria-hidden="true">{gainText(p.fix.gain)}</b>
        <span className="coach-item-who" aria-hidden="true">
          {p.kind === 'move' ? <MovePill name={p.fix.to} size="sm" /> : <strong>{p.fix.species}</strong>}
          <small>{seat}</small>
        </span>
        <span className="coach-item-solves">
          {fx.solved.length > 0 ? <SolvedMarks entries={fx.solved} /> : fx.ups[0] && <Change move={fx.ups[0]} />}
          {fx.downs.length + fx.lost.length > 0 && (
            <span className="coach-item-cost"><b>{tr('coach.hero.costs')}</b>
              {[...fx.downs.map(m => tr(AREA_NAME[m.area])), ...fx.lost.map(key => needLabel(key, lang))].join(', ')}</span>
          )}
        </span>
        <span className="coach-item-go" aria-hidden="true"><Icon name="next" /></span>
      </button>
    </li>
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

/** Un blocco della diagnosi: i problemi che hanno la stessa proposta migliore (`cure`, null: nessun cambio singolo li risolve). */
interface RailBlock { cure: ProposalGroup | null; pick: Proposal | null; entries: ProblemEntry[] }

/** Una riga della colonna a pagine: la testata di un blocco (chi li risolve) o un problema. */
type RailRow = { kind: 'cure'; block: RailBlock } | { kind: 'entry'; block: RailBlock; entry: ProblemEntry };

/**
 * La colonna della diagnosi: i problemi del team, una volta sola, ognuno col numero di proposte che lo risolvono (un clic
 * mostra solo quelle; di nuovo: tutte). I problemi con la stessa proposta migliore stanno in un blocco, con in testa chi li
 * risolve tutti ("Raging Bolt +11 · li risolve tutti e 3"; un clic la apre nella carta grande). A pagine come le altre
 * liste: un blocco non si spezza se sta in una pagina. In fondo le aree senza problemi.
 */
function ProblemRail({ blocks, counts, filter, onFilter, onCure, heroId, total, clean, cured }: {
  blocks: RailBlock[]; counts: Map<string, number>; filter: string | null; onFilter: (key: string | null) => void;
  onCure: (groupId: string) => void; heroId: string | null; total: number; clean: ReactNode;
  /** I problemi che la proposta nella carta grande risolve: la riga si accende di verde. */
  cured: Set<string>;
}) {
  const tr = useT();
  const lang = useLang();
  const headId = useId();
  const box = useRef<HTMLDivElement>(null);
  const { perPage, rows } = useRowsPerPage(box, 16);
  const [start, setStart] = useState(0);
  const count = blocks.reduce((n, b) => n + b.entries.length, 0);
  // Le righe: ogni blocco di 2 o più problemi con la sua testata. Le pagine si riempiono a blocchi interi (la prima riga di
  // ogni pagina è "Tutte le proposte"); senza misura (jsdom, telefono) tutto in una pagina
  const room = rows ? Math.max(2, perPage - 1) : Number.POSITIVE_INFINITY;
  const pageRows: RailRow[][] = [[]];
  for (const block of blocks) {
    const rowsOf: RailRow[] = [...(block.cure && block.entries.length > 1 ? [{ kind: 'cure' as const, block }] : []), ...block.entries.map(entry => ({ kind: 'entry' as const, block, entry }))];
    let cur = pageRows[pageRows.length - 1];
    // Un blocco che non sta va alla pagina dopo, se lì sta intero e qui resterebbero meno di 3 righe; altrimenti si spezza
    // e la sua testata si ripete in cima alla pagina dopo
    if (cur.length > 0 && cur.length + rowsOf.length > room && rowsOf.length <= room && room - cur.length < 3) pageRows.push((cur = []));
    for (const row of rowsOf) {
      if (cur.length >= room) {
        pageRows.push((cur = []));
        if (row.kind === 'entry' && rowsOf[0].kind === 'cure') cur.push(rowsOf[0]);
      }
      cur.push(row);
    }
  }
  const pages = pageRows.length;
  const page = Math.min(start, pages - 1);
  const firstOn = (n: number) => pageRows.slice(0, n).reduce((sum, rs) => sum + rs.filter(r => r.kind === 'entry').length, 0);
  const entryButton = (entry: ProblemEntry, inBlock: boolean) => {
    const key = entry.problem.key;
    const n = counts.get(key) ?? 0;
    return (
      <button type="button" className={`coach-diag-item ${entry.problem.severity}${inBlock ? ' in-block' : ''}${filter === key ? ' is-on' : ''}${cured.has(key) ? ' is-cured' : ''}`} aria-pressed={filter === key}
        disabled={n === 0} onClick={() => onFilter(filter === key ? null : key)} {...hint(n === 0 ? tr('coach.diag.noFix') : null)}>
        <Icon name={cured.has(key) ? 'check' : 'warning'} />
        <span className="coach-diag-text"><ProblemPill problem={entry.problem} role={entry.role} />{cured.has(key) && <span className="visually-hidden"> · {tr('coach.diag.cured')}</span>}</span>
        <span className="coach-diag-n" aria-label={tr('coach.diag.countAria', { n })}>{n || '–'}</span>
      </button>
    );
  };
  return (
    <aside className="coach-diag" aria-labelledby={headId}>
      <div className="coach-diag-top">
        <h3 id={headId} className="coach-diag-head">{tr('coach.diag.title')}<span className="coach-count">{count}</span></h3>
        <HelpButton title={tr('coach.help.title')} className="coach-help"><CoachingGuide /></HelpButton>
        <Pager page={page} pages={pages} from={firstOn(page) + 1} to={firstOn(page) + pageRows[page].filter(r => r.kind === 'entry').length} onPage={setStart}
          labels={{ pages: tr('coach.diag.pages'), prev: tr('coach.diag.prev'), next: tr('coach.diag.next'), page: 'coach.diag.page' }} />
      </div>
      <div className="coach-diag-box" ref={box}>
        <ul className="coach-diag-list">
          <li>
            <button type="button" className={`coach-diag-item is-all${filter === null ? ' is-on' : ''}`} aria-pressed={filter === null} onClick={() => onFilter(null)}>
              <span className="coach-diag-text">{tr('coach.diag.all')}</span>
              <span className="coach-diag-n" aria-label={tr('coach.diag.countAria', { n: total })}>{total}</span>
            </button>
          </li>
          {pageRows[page].map((row, i) => {
            if (row.kind === 'entry') {
              const last = pageRows[page][i + 1]?.block !== row.block;
              return <li key={`${row.entry.problem.key}|${row.entry.role ?? ''}`} className={row.block.cure && row.block.entries.length > 1 ? `in-block${last ? ' is-last' : ''}` : undefined}>{entryButton(row.entry, row.block.entries.length > 1)}</li>;
            }
            const { cure, pick } = row.block;
            if (!cure || !pick) return null;
            const name = proposalName(pick, tr, lang);
            return (
              <li key={`cure|${cure.id}`} className="in-block is-head">
                <button type="button" className={`coach-diag-cure${heroId === cure.id ? ' is-open' : ''}`} style={{ '--t1': typeColor(firstType(pick)) } as CSSProperties}
                  aria-label={tr('coach.diag.cureAria', { name, n: row.block.entries.length })} onClick={() => onCure(cure.id)}>
                  <span className="coach-diag-cure-mon" aria-hidden="true"><PokemonIcon name={subjectOf(pick)} /></span>
                  <span className="coach-diag-cure-text" aria-hidden="true">
                    <b>{pick.kind === 'move' ? gameName('move', pick.fix.to, lang) : pick.fix.species}</b>
                    <small>{tr('coach.diag.cureAll', { n: row.block.entries.length })}</small>
                  </span>
                  <b className="coach-diag-cure-gain" aria-hidden="true">{gainText(pick.fix.gain)}</b>
                </button>
              </li>
            );
          })}
        </ul>
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
  labels?: { pages: string; prev: string; next: string; page: 'coach.diag.page' };
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
 * La scheda Coaching, "Diagnosi → Cura": a sinistra i problemi del team, una volta sola, col numero di proposte che li
 * risolvono (un clic mostra solo quelle); a destra la carta grande della proposta scelta (all'inizio la migliore) e sotto
 * le altre in righe compatte, dalla più utile (+N più alto; un clic la porta nella carta grande). Le proposte quasi uguali
 * stanno insieme (proposalGroups) e quelle che non alzano il voto vanno fra le alternative (neutralAsAlternatives).
 * Senza problemi: Eevee contento e il team da esportare; con problemi che nessuna proposta risolve: Eevee pensieroso, i
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
  const listBox = useRef<HTMLDivElement>(null);
  // Le file della pagina si dividono l'altezza (--rows): le carte la riempiono tutta, anche nell'ultima pagina più corta
  const { perPage, rows: fileRows } = useRowsPerPage(listBox, 10);
  const rowsStyle = fileRows ? ({ '--rows': fileRows } as CSSProperties) : undefined;
  const { problems, bannedCount = 0 } = coaching;
  const groups = useMemo(() => (advice ? neutralAsAlternatives(proposalGroups(problems, advice)) : null), [problems, advice]);
  // Il problema scelto a sinistra (null: tutti) e la proposta nella carta grande (null: la prima della lista)
  const [filter, setFilter] = useState<string | null>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  // L'alternativa scelta di ogni posto, solo per i consigli con cui è nata (cambiano i consigli: si riparte dalla migliore)
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
    const hit = groups.find(g => g.options.some(solves));
    if (!hit) return;
    setFilter(focus.key);
    setHeroId(hit.id);
    setStart(0);
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
  const solvesKey = (g: ProposalGroup, key: string) => g.options.some(o => o.fix.solves.includes(key));
  // Un filtro su un problema che dopo un cambio non c'è più (o che nessuno risolve più) vale come "tutti"
  const active = filter && groups?.some(g => solvesKey(g, filter)) && mapped.some(x => x.key === filter) ? filter : null;
  const visible = groups ? (active ? groups.filter(g => solvesKey(g, active)) : groups) : [];
  const hero = visible.find(g => g.id === heroId) ?? visible[0] ?? null;
  const others = visible.filter(g => g !== hero);
  const heroPick = hero ? hero.options[Math.min(chosen[hero.id] ?? 0, hero.options.length - 1)] : null;
  const cured = new Set(heroPick?.fix.solves ?? []);
  const pages = Math.max(1, Math.ceil(others.length / perPage));
  const page = Math.min(Math.floor(start / perPage), pages - 1);
  const rows = others.slice(page * perPage, (page + 1) * perPage);
  const entries = problemEntries(mapped);
  const counts = new Map(entries.map(e => [e.problem.key, groups ? groups.filter(g => solvesKey(g, e.problem.key)).length : 0]));
  // I blocchi della diagnosi: i problemi con la stessa proposta migliore (la prima della lista che li risolve) insieme,
  // nell'ordine dei problemi; quelli che nessun cambio risolve in coda
  const pickOf = (g: ProposalGroup) => g.options[Math.min(chosen[g.id] ?? 0, g.options.length - 1)];
  const blocks: RailBlock[] = [];
  const byCure = new Map<string, RailBlock>();
  const stuck: RailBlock = { cure: null, pick: null, entries: [] };
  for (const entry of entries) {
    // La cura è la proposta che si vede (quella scelta del posto), non una sua alternativa
    const cure = groups?.find(g => pickOf(g).fix.solves.includes(entry.problem.key)) ?? null;
    if (!cure) { stuck.entries.push(entry); continue; }
    let block = byCure.get(cure.id);
    if (!block) {
      block = { cure, pick: pickOf(cure), entries: [] };
      byCure.set(cure.id, block);
      blocks.push(block);
    }
    block.entries.push(entry);
  }
  if (stuck.entries.length) blocks.push(stuck);
  const actions: RowActions = { onFix, onMoveFix, onApplyFix, onApplyMove };
  const choose = (groupId: string, i: number) => setPicks(s => ({ advice, chosen: { ...(s.advice === advice ? s.chosen : {}), [groupId]: i } }));
  const pickFilter = (key: string | null) => { setFilter(key); setHeroId(null); setStart(0); };
  const open = (groupId: string) => { setHeroId(groupId); setFlash(f => ({ nonce: (f?.nonce ?? 0) - 1, id: groupId })); };
  return (
    <div className="coaching coach-cure" ref={root}>
      <ProblemRail blocks={blocks} counts={counts} filter={active} onFilter={pickFilter} onCure={id => { setFilter(null); setStart(0); open(id); }}
        heroId={hero?.id ?? null} total={groups?.length ?? 0} cured={cured}
        clean={cleanLine ? <div className="coach-diag-clean">{cleanLine}</div> : null} />
      <section aria-labelledby={`${id}-list`} className="coach-main">
        <h3 className="visually-hidden" id={`${id}-list`}>{tr('coach.list.title')}</h3>
        <div className="coach-list-head coach-hero-band">
          <h4 className="coach-sec">{tr(hero && heroId && hero.id === heroId && hero !== visible[0] ? 'coach.hero.chosen' : 'coach.hero.best')}</h4>
          {hero && heroId && hero.id === heroId && hero !== visible[0] && (
            <button type="button" className="coach-back" onClick={() => setHeroId(null)}><Icon name="undo" />{tr('coach.hero.back')}</button>
          )}
        </div>
        {groups ? (
          hero && <Hero key={hero.id} group={hero} choice={chosen[hero.id] ?? 0} onChoose={i => choose(hero.id, i)} problems={problems} before={before}
            rating={rating} actions={actions} flash={flash?.id === hero.id} />
        ) : (
          <>
            <div className="coach-hero skeleton" aria-hidden="true" />
            <p className="visually-hidden" role="status">{tr('coach.computing')}</p>
          </>
        )}
        <div className="coach-list">
          <div className="coach-list-head">
            <h4 className="coach-sec">{tr(active ? 'coach.list.othersFor' : 'coach.list.others')}{groups && <span className="coach-count">{others.length}</span>}
              {active && <button type="button" className="coach-back" onClick={() => pickFilter(null)}><Icon name="close" />{tr('coach.list.showAll')}</button>}</h4>
            {groups && <Pager page={page} pages={pages} from={page * perPage + 1} to={Math.min(others.length, (page + 1) * perPage)} onPage={n => setStart(n * perPage)} />}
          </div>
          <div className="coach-list-box" ref={listBox}>
            {groups ? (
              others.length > 0
                ? <ol className="coach-rows" style={rowsStyle}>
                    {rows.map(group => <ProposalItem key={group.id} group={group} choice={chosen[group.id] ?? 0} problems={problems} before={before} onOpen={() => open(group.id)} />)}
                  </ol>
                : <p className="coach-list-empty">{tr(active ? 'coach.list.noneFor' : 'coach.list.none')}</p>
            ) : (
              <ol className="coach-rows" aria-busy="true" style={rowsStyle}>
                {Array.from({ length: perPage }, (_, i) => <li key={i} className="coach-item skeleton" aria-hidden="true" />)}
              </ol>
            )}
          </div>
        </div>
        {banned}
      </section>
    </div>
  );
}
