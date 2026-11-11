// I pezzi comuni a ogni candidato della lista (Carte e Menu): voto o uso, segni, motivi, chi esce
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Format } from '../engine/format';
import { formatRules, type FormatRules } from '../engine/formatRules';
import type { Replacement } from '../engine/replace';
import { rankedChanges } from '../engine/coach';
import { detectRoles } from '../engine/roles';
import { OFTEN_TOGETHER, type Suggestion } from '../engine/scoring';
import type { ScoredArea, SwapOption, TeamGain } from '../engine/teamGain';
import type { TeamSet } from '../engine/sets';
import { isUserBanned, isUserFavorite, type EffectiveLists } from '../engine/lists';
import { formatLabel } from '../engine/formats';
import { tierLabel } from '../engine/filters';
import { battleName, getSpecies } from '../engine/dex';
import { PokemonIcon, TypeDot } from './PokemonName';
import { TypeChip } from './Sprite';
import type { ReasonSymbol } from '../engine/explain';
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { Icon } from './icons';
import { formatPercent, t, type Lang } from '../i18n';
import { useLang, useT } from '../i18n/react';

/**
 * Candidato in lista, col voto che darebbe al team (assente col primo Pokémon).
 * Nelle raccomandazioni libere anche il membro che sostituirebbe e gli altri possibili.
 */
export type Item = (Suggestion | Replacement) & { teamGain?: TeamGain; replaces?: number; alternatives?: SwapOption[] };

/** Sprite "Icona box": l'icona della forma da battaglia (Mega con la pietra), più grande col team nascosto. */
export function BoxIcon({ set, big = false }: { set: TeamSet; big?: boolean }) {
  return <span className={`box-icon${big ? ' big' : ''}`}><PokemonIcon name={battleName(set)} /></span>;
}

/** I motivi sotto il nome: bonus (col "+" verde) o, senza bonus, una frase sola. */
export interface ReasonSummary { pros: boolean; items: Bring[] }

/** Quello che serve a ogni candidato della lista, in qualunque stile. */
export interface CandidateProps {
  rank: number;
  item: Item;
  /** I motivi da mostrare sotto il nome (già tagliati al numero che entra). */
  reasons: ReasonSummary;
  /** Lo sprite: normale o icona del box (impostazioni); `animated` = la carta sotto il mouse (GIF di Showdown, solo sprite normale). */
  sprite: (animated: boolean) => ReactNode;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  /** Il membro che uscirebbe (raccomandazioni libere). */
  out?: string;
  actionLabel: string;
  /** Candidato scelto dalla ricerca (Invio lo aggiunge). */
  picked?: boolean;
  /** Candidato mostrato nel dettaglio. */
  selected: boolean;
  onSelect: () => void;
  onAction: () => void;
  format: Format;
  /** Liste dell'utente: ⊘ accanto al nome, ♥ sul voto (il preferito sale in classifica). */
  lists?: EffectiveLists;
}

/** Il #1 in magenta solo se migliora davvero il team (o col team vuoto): un −N o ±0 resta nei suoi colori. */
export const isLead = (rank: number, item: Item) => rank === 1 && !(item.teamGain && item.teamGain.gain <= 0);

/** +7, −3, ±0. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** L'area del voto di cui parla una ragione, per non ripetere i guadagni del cambio. */
const REASON_AREA: Partial<Record<string, ScoredArea>> = { defense: 'defense', coverage: 'strength', roles: 'roles' };

/** Una voce di "Porta": il testo lungo (dettaglio) e quello breve (caselle), o a segni (caselle, col testo lungo nascosto). */
export interface Bring { text: string; short: string; symbol?: ReasonSymbol; usedWith?: true }

/**
 * Tutto quello che il candidato porta, in un solo ordine per dettaglio e caselle: i guadagni del cambio (dal più pesante),
 * poi le ragioni dalla più pesante (l'uso nel meta non dice perché sceglierlo), col team vuoto i ruoli; "Usato con" per ultimo.
 * Il dettaglio le mostra tutte, le caselle le prime (senza "Usato con": lo dice il segno ciano).
 */
export function bringsOf(item: Item, lang: Lang, rules: FormatRules): Bring[] {
  const diff = 'diff' in item ? item.diff : null;
  const changes = diff ? rankedChanges(diff, item.teamGain, lang) : null;
  // Una ragione che ripete un guadagno della stessa area ("Resiste a Volante" e "Resistente a Volante") si salta
  const covered = new Set(changes?.pros.map(p => p.area));
  const reasons = item.reasons
    // Gli avvisi (peso negativo: meteo in conflitto, mosse indebolite) vanno in Toglie, non qui
    .filter(reason => reason.weight >= 0 && reason.component !== 'strength' && !covered.has(REASON_AREA[reason.component] as ScoredArea))
    .map((reason, i) => ({ reason, i }))
    .sort((a, b) => b.reason.weight - a.reason.weight || a.i - b.i)
    .map(({ reason }): Bring => ({
      text: reason.text, short: reason.short ?? reason.text,
      ...(reason.symbol && { symbol: reason.symbol }), ...(reason.usedWith && { usedWith: true as const }),
    }));
  // Col team vuoto non c'è niente da confrontare: Porta dice cosa sa fare il Pokémon (i suoi ruoli)
  const roles = !item.teamGain && !changes ? detectRoles(item.set, rules).map(role => t(lang, `role.${role}`)) : [];
  const all: Bring[] = [
    ...(changes?.pros.map((p): Bring => ({ text: p.text, short: p.text, ...(p.symbol && { symbol: p.symbol }) })) ?? []),
    ...reasons,
    ...roles.map(text => ({ text, short: text })),
  ];
  // Una voce sola per testo; "Usato con X" sempre per ultimo
  const seen = new Set<string>();
  const unique = all.filter(b => !seen.has(b.text) && !!seen.add(b.text));
  return [...unique.filter(b => !b.usedWith), ...unique.filter(b => b.usedWith)];
}

const plain = (text: string): Bring => ({ text, short: text });

/**
 * I motivi sotto il nome: le prime `n` voci di Porta del dettaglio, in forma breve (stesso ordine, mai una voce che il
 * dettaglio non ha). Il malus resta nel dettaglio. Col team vuoto i ruoli principali. Senza voci, se il voto sale,
 * l'area che sale di più come la riga del dettaglio ("Offesa +13"); "nessuna differenza" solo se non cambia niente.
 */
export function reasonsOf(item: Item, n: number, usage: number | null, format: Format, lang: Lang): ReasonSummary {
  const rules = formatRules(format.formatId);
  // Col team vuoto l'uso sta già a destra: qui i ruoli principali del Pokémon, col "+" come i bonus
  if (usage !== null) {
    const roles = detectRoles(item.set, rules).slice(0, n).map(role => plain(t(lang, `role.${role}`)));
    return { pros: roles.length > 0, items: roles };
  }
  const items = bringsOf(item, lang, rules).filter(b => !b.usedWith).slice(0, n);
  if (items.length) return { pros: true, items };
  const gain = item.teamGain;
  if (gain && gain.gain > 0) {
    const best = gain.areaGains?.[0];
    if (best) return { pros: false, items: [plain(`${best.label} +${best.change}`)] };
    if ((gain.extras ?? 0) > 0) return { pros: false, items: [plain(`${t(lang, 'detail.extras')} +${gain.extras}`)] };
  }
  return { pros: false, items: [plain(t(lang, 'suggest.noDifference'))] };
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
export function BanMark({ species, format, floating = false }: { species: string; format: Format; floating?: boolean }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark floating={floating} alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

/** Il candidato è nei Preferiti dell'utente (e non nella sua lista Ban): il voto lo dice col ♥. */
export const isFavoriteCandidate = (set: TeamSet, lists?: EffectiveLists) =>
  !isUserBanned(set, lists && { ...lists, allow: undefined }) && isUserFavorite(set, lists);

/** ⊘ nella lista Ban dell'utente (mostrato perché cercato per nome o con "mostra"); il ♥ dei Preferiti sta sul voto. */
function ListMarks({ set, lists }: { set: TeamSet; lists?: EffectiveLists }) {
  const tr = useT();
  if (!isUserBanned(set, lists && { ...lists, allow: undefined })) return null;
  return (
    <span className="list-mark ban" role="img" aria-label={tr('lists.bannedMark')} title={tr('lists.bannedMark')}><Icon name="ban" /></span>
  );
}

/** I segni del candidato: ban del formato, liste dell'utente, avvisi, "spesso usati insieme" (tooltip, non etichette). */
export function CandidateMarks({ item, format, lists }: { item: Item; format: Format; lists?: EffectiveLists }) {
  const tr = useT();
  const warnings = item.facts.clashes.map(text => ({ level: 'warn' as const, text: text.replace(/^⚠\s*/, '') }));
  const synergy = item.facts.synergy;
  const together = synergy && synergy.pct >= OFTEN_TOGETHER
    ? [{ level: 'info' as const, text: tr('tag.oftenTogether', { member: synergy.member, pct: Math.round(synergy.pct * 100) }) }]
    : [];
  return (
    <>
      {/* Tooltip flottanti: la casella nasconde ciò che sporge e la lista sta accanto alla scheda */}
      <BanMark species={item.species} format={format} floating />
      <ListMarks set={item.set} lists={lists} />
      <AlertMark alerts={warnings} floating />
      <AlertMark alerts={together} icon="spark" floating />
    </>
  );
}

/**
 * Il voto del team col candidato (+7); col primo Pokémon, il suo uso nel meta.
 * Un preferito ha il ♥ davanti e il bordo del colore dei Preferiti: è più in alto per quello (lo dice il tooltip).
 */
export function ResultCell({ item, usage, favorite = false, className = '' }: { item: Item; usage: number | null; favorite?: boolean; className?: string }) {
  const tr = useT();
  const lang = useLang();
  const result = item.teamGain;
  const cls = ['result', favorite && 'fav', className].filter(Boolean).join(' ');
  const boost = favorite ? tr('lists.favoriteBoost') : undefined;
  // Il motivo del ♥ anche per gli screen reader, in fondo all'etichetta del voto
  const label = (text: string) => (boost ? `${text} · ${boost}` : text);
  const heart = favorite && <span className="fav-heart" aria-hidden="true"><Icon name="heart" /></span>;
  if (!result) {
    if (usage === null) return favorite ? <span className={cls} aria-label={boost} title={boost}>{heart}</span> : <span className={cls} aria-hidden="true" />;
    return (
      <span className={cls} aria-label={label(tr('suggest.usageAria', { pct: formatPercent(lang, usage) }))} title={boost}>
        {heart}<strong>{formatPercent(lang, usage)}</strong><small>{tr('suggest.usageShort')}</small>
      </span>
    );
  }
  const gain = signed(result.gain);
  return (
    <span className={cls} aria-label={label(tr('suggest.teamGrade', { grade: result.grade, n: result.overall, gain }))} title={boost}>
      {heart}<strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{gain}</strong>
    </span>
  );
}

function More({ total, shown }: { total: number; shown: number }) {
  return total > shown ? <span className="sym-more">+{total - shown}</span> : null;
}

/**
 * Quanti elementi di una riga entrano: si parte da tutti e si toglie l'ultimo finché la riga non sborda più
 * (gli altri diventano "+N", subito dopo l'ultimo visibile). Si riparte da capo quando cambiano gli elementi (`key`),
 * quando cambia davvero la misura della riga o arriva il carattere. Si misura solo allora, non a ogni disegno della carta.
 * `v` conta le ripartenze: un passo vecchio (misurato prima di una ripartenza) non la cancella.
 */
function useFitLimit(count: number, key: string) {
  const row = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ key, limit: count, v: 0 });
  if (fit.key !== key) setFit(f => ({ key, limit: count, v: f.v + 1 }));
  const limit = fit.key === key ? Math.min(fit.limit, count) : count;
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || el.clientWidth === 0 || fit.key !== key) return;
    if (limit > 1 && el.scrollWidth - el.clientWidth > 1) setFit(f => (f.v === fit.v ? { ...f, limit: limit - 1 } : f));
  }, [fit, key, limit]);
  useEffect(() => {
    const box = row.current?.parentElement ?? row.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const restart = () => setFit(f => ({ key: f.key, limit: Number.MAX_SAFE_INTEGER, v: f.v + 1 }));
    // La misura di adesso è già quella misurata: si riparte solo se cambia (anche da nascosta a visibile)
    let last = `${box.clientWidth}x${box.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${box.clientWidth}x${box.clientHeight}`;
      if (size === last) return;
      last = size;
      restart();
    });
    observer.observe(box);
    let alive = true;
    if (document.fonts && document.fonts.status !== 'loaded') void document.fonts.ready.then(() => { if (alive) restart(); });
    return () => { alive = false; observer.disconnect(); };
  }, []);
  return { row, limit };
}

/**
 * I chip dei tipi (gli stessi del team, in versione compatta), su una riga sola: quelli che non entrano diventano "+N"
 * subito dopo l'ultimo chip (mai un chip tagliato a metà; la lista intera è nel tooltip).
 * Gli immuni per primi, con la parola "immune" attaccata all'ultimo.
 */
function ChipRow({ types, immune = [] }: { types: readonly string[]; immune?: readonly string[] }) {
  const tr = useT();
  const lang = useLang();
  const all = [...immune, ...types];
  // Nella chiave tutto quello che cambia la larghezza: i tipi, dove cade "immune" e la lingua
  const { row, limit } = useFitLimit(all.length, `${lang}|${immune.length}|${all.join()}`);
  return (
    <span className="sym-chips" ref={row}>
      {all.slice(0, limit).map((type, i) => (
        <span key={type} className="sym-chip">
          <TypeChip type={type} />
          {i === immune.length - 1 && <span className="sym-immune">{tr('reason.immune')}</span>}
        </span>
      ))}
      <More total={all.length} shown={limit} />
    </span>
  );
}

/**
 * Il primo Pokémon come nel dettaglio (pallino del tipo + nome), gli altri "+N" subito dopo (la lista intera è nel tooltip).
 * Se il nome non entra intero si accorcia coi puntini, ma il "+N" resta sempre visibile.
 */
function MonRow({ species }: { species: readonly string[] }) {
  const [first] = species;
  return (
    <span className="sym-mons">
      <span className="mon-ref sym-mon"><TypeDot name={first} /><strong>{first}</strong></span>
      <More total={species.length} shown={1} />
    </span>
  );
}

/** Il disegno di un segno (decorativo: la frase intera la legge lo screen reader e la mostra il tooltip). */
function SymbolView({ symbol }: { symbol: ReasonSymbol }) {
  switch (symbol.kind) {
    case 'coverage':
      return <><span className="sym-emoji">⚔️</span><ChipRow types={symbol.types} /></>;
    case 'defense':
      return <><span className="sym-emoji">🛡️</span><ChipRow types={symbol.resists} immune={symbol.immune} /></>;
    case 'threats':
      return <><span className="sym-vs">vs</span><MonRow species={symbol.species} /></>;
    case 'link':
      return <><span className="sym-emoji">🔗</span><MonRow species={[symbol.species]} /></>;
  }
}

/** Un motivo: a segni (con la frase intera nascosta e nel tooltip) o la forma breve a parole. */
function ReasonBody({ bring }: { bring: Bring }) {
  if (!bring.symbol) return <Typed text={bring.short} />;
  // Le due forme: le parole sulle carte larghe (schermi grandi), i segni sulle altre; il CSS ne mostra una sola,
  // per tutta la lista (le carte e le pillole di una lista hanno la stessa larghezza)
  return (
    <>
      <span className="words"><Typed text={bring.short} /></span>
      <span className="syms">
        <span className="visually-hidden">{bring.text}</span>
        <span className="sym" aria-hidden="true"><SymbolView symbol={bring.symbol} /></span>
      </span>
    </>
  );
}

/** I motivi: "+" verde davanti ai bonus (letto anche dagli screen reader), il resto in grigio; i segni col tooltip. */
export function Reasons({ reasons }: { reasons: ReasonSummary }) {
  return (
    <small>
      {reasons.items.map((bring, i) => {
        const title = bring.symbol ? bring.text : undefined;
        const cls = `reason ${reasons.pros ? 'gain' : 'plain'}${bring.symbol ? ' has-sym' : ''}`;
        return reasons.pros
          ? <span key={i} className={cls} title={title}><b aria-hidden="true">+</b><span className="visually-hidden">+</span><ReasonBody bring={bring} /></span>
          : <span key={i} className={cls} title={title}><ReasonBody bring={bring} /></span>;
      })}
    </small>
  );
}

/** Il nome: apre il candidato nel dettaglio (via da tastiera); il posto in classifica solo per gli screen reader. */
/**
 * Il nome diviso in specie base e forma ("Charizard-Mega-Y" → "Charizard" + "Mega Y"), o null se non ha una forma:
 * sulla carta il nome base non si taglia mai e la forma è un'etichetta che distingue Mega X da Mega Y, le maschere…
 */
export function formeParts(species: string): { base: string; forme: string } | null {
  const found = getSpecies(species);
  if (!found || !found.forme || found.baseSpecies === found.name) return null;
  return { base: found.baseSpecies, forme: found.forme.replace(/-/g, ' ') };
}

export function PickButton({ rank, species, selected, onSelect }: { rank: number; species: string; selected: boolean; onSelect: () => void }) {
  const parts = formeParts(species);
  return (
    <button type="button" className="pick" aria-pressed={selected} title={parts ? species : undefined} onClick={e => { e.stopPropagation(); onSelect(); }}>
      {/* Il nome intero per lettori di schermo (e test); a vista la specie base e la forma come etichetta */}
      <strong className={parts ? 'visually-hidden' : undefined}><span className="visually-hidden">{rank}. </span>{species}</strong>
      {parts && <span className="pick-name" aria-hidden="true"><b>{parts.base}</b><i className="forme">{parts.forme}</i></span>}
    </button>
  );
}

/** Chi esce: solo la sua icona; il nome nel tooltip e per gli screen reader. */
export function OutMark({ member }: { member: string }) {
  const tr = useT();
  return (
    <span className="out" title={tr('suggest.outFor', { member })}>
      <Icon name="swap" />
      <PokemonIcon name={member} />
      <span className="visually-hidden">{tr('suggest.outFor', { member })}</span>
    </span>
  );
}

/**
 * Clic sul candidato = lo apre nel dettaglio; doppio clic = aggiunge o fa lo scambio
 * (non sul nome: il suo pulsante apre soltanto).
 */
export const candidateHandlers = ({ onSelect, onAction }: Pick<CandidateProps, 'onSelect' | 'onAction'>) => ({
  onClick: onSelect,
  onDoubleClick: (e: MouseEvent) => { if (!(e.target as Element).closest('button')) onAction(); },
});

/** Le classi di stato comuni: scelto nel dettaglio, scelto dalla ricerca, scambio. */
export const stateClasses = ({ selected, picked, out }: Pick<CandidateProps, 'selected' | 'picked' | 'out'>) =>
  [selected && 'selected', picked && 'picked', out && 'swap'].filter(Boolean).join(' ');
