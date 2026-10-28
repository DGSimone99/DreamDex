// I pezzi comuni a ogni candidato della lista (Carte e Menu): voto o uso, segni, motivi, chi esce
import type { MouseEvent, ReactNode } from 'react';
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
import { battleName } from '../engine/dex';
import { PokemonIcon } from './PokemonName';
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
export interface ReasonSummary { pros: boolean; texts: string[] }

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
  /** Menu: distanza (con segno, al massimo ±3) dalla selezionata nella pagina, per il rullo; 0 senza selezionata. */
  depth?: number;
}

/** Il #1 in magenta solo se migliora davvero il team (o col team vuoto): un −N o ±0 resta nei suoi colori. */
export const isLead = (rank: number, item: Item) => rank === 1 && !(item.teamGain && item.teamGain.gain <= 0);

/** +7, −3, ±0. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** L'area del voto di cui parla una ragione, per non ripetere i guadagni del cambio. */
const REASON_AREA: Partial<Record<string, ScoredArea>> = { defense: 'defense', coverage: 'strength', roles: 'roles' };

/** Una voce di "Porta": il testo lungo (dettaglio) e quello breve (caselle). */
export interface Bring { text: string; short: string; usedWith?: true }

/**
 * Tutto quello che il candidato porta, in un solo ordine per dettaglio e caselle: i guadagni del cambio (dal più pesante),
 * poi le ragioni dalla più pesante (l'uso nel meta non dice perché sceglierlo), col team vuoto i ruoli; "Usato con" per ultimo.
 * Il dettaglio le mostra tutte, le caselle le prime (senza "Usato con": lo dice il segno ciano).
 */
export function bringsOf(item: Item, lang: Lang, rules: FormatRules): Bring[] {
  const diff = 'diff' in item ? item.diff : null;
  const changes = diff ? rankedChanges(diff, item.teamGain?.areaPoints, lang) : null;
  // Una ragione che ripete un guadagno della stessa area ("Resiste a Volante" e "Resistente a Volante") si salta
  const covered = new Set(changes?.pros.map(p => p.area));
  const reasons = item.reasons
    // Gli avvisi (peso negativo: meteo in conflitto, mosse indebolite) vanno in Toglie, non qui
    .filter(reason => reason.weight >= 0 && reason.component !== 'strength' && !covered.has(REASON_AREA[reason.component] as ScoredArea))
    .map((reason, i) => ({ reason, i }))
    .sort((a, b) => b.reason.weight - a.reason.weight || a.i - b.i)
    .map(({ reason }): Bring => ({ text: reason.text, short: reason.short ?? reason.text, ...(reason.usedWith && { usedWith: true as const }) }));
  // Col team vuoto non c'è niente da confrontare: Porta dice cosa sa fare il Pokémon (i suoi ruoli)
  const roles = !item.teamGain && !changes ? detectRoles(item.set, rules).map(role => t(lang, `role.${role}`)) : [];
  const all: Bring[] = [
    ...(changes?.pros.map(p => ({ text: p.text, short: p.text })) ?? []),
    ...reasons,
    ...roles.map(text => ({ text, short: text })),
  ];
  // Una voce sola per testo; "Usato con X" sempre per ultimo
  const seen = new Set<string>();
  const unique = all.filter(b => !seen.has(b.text) && !!seen.add(b.text));
  return [...unique.filter(b => !b.usedWith), ...unique.filter(b => b.usedWith)];
}

/**
 * I motivi sotto il nome: le prime `n` voci di Porta del dettaglio, in forma breve (stesso ordine, mai una voce che il
 * dettaglio non ha). Il malus resta nel dettaglio. Col team vuoto i ruoli principali; senza bonus "nessuna differenza".
 */
export function reasonsOf(item: Item, n: number, usage: number | null, format: Format, lang: Lang): ReasonSummary {
  const rules = formatRules(format.formatId);
  // Col team vuoto l'uso sta già a destra: qui i ruoli principali del Pokémon, in una riga
  if (usage !== null) return { pros: false, texts: [detectRoles(item.set, rules).slice(0, 3).map(role => t(lang, `role.${role}`)).join(', ')] };
  const texts = bringsOf(item, lang, rules).filter(b => !b.usedWith).slice(0, n).map(b => b.short);
  return texts.length ? { pros: true, texts } : { pros: false, texts: [t(lang, 'suggest.noDifference')] };
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

/** I motivi: "+" verde davanti ai bonus (letto anche dagli screen reader), il resto in grigio. */
export function Reasons({ reasons }: { reasons: ReasonSummary }) {
  return (
    <small>
      {reasons.texts.map((text, i) => (reasons.pros
        ? <span key={i} className="reason gain"><b aria-hidden="true">+</b><span className="visually-hidden">+</span><Typed text={text} /></span>
        : <span key={i} className="reason plain"><Typed text={text} /></span>))}
    </small>
  );
}

/** Il nome: apre il candidato nel dettaglio (via da tastiera); il posto in classifica solo per gli screen reader. */
export function PickButton({ rank, species, selected, onSelect }: { rank: number; species: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="pick" aria-pressed={selected} onClick={e => { e.stopPropagation(); onSelect(); }}>
      <strong><span className="visually-hidden">{rank}. </span>{species}</strong>
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
