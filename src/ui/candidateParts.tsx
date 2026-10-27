// I pezzi comuni a ogni candidato della lista (Carte e Menu): voto o uso, segni, motivi, chi esce, pulsante rapido
import type { MouseEvent, ReactNode } from 'react';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import type { Replacement } from '../engine/replace';
import { rankedChanges } from '../engine/coach';
import { detectRoles } from '../engine/roles';
import { OFTEN_TOGETHER, type Suggestion } from '../engine/scoring';
import type { SwapOption, TeamGain } from '../engine/teamGain';
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
  /** Lo sprite: normale o icona del box (impostazioni). */
  sprite: ReactNode;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  /** Il membro che uscirebbe (raccomandazioni libere). */
  out?: string;
  quickLabel: string;
  actionLabel: string;
  replacing: boolean;
  /** Candidato scelto dalla ricerca (Invio lo aggiunge). */
  picked?: boolean;
  /** Candidato mostrato nel dettaglio. */
  selected: boolean;
  onSelect: () => void;
  onAction: () => void;
  format: Format;
  /** Liste dell'utente, per i segni ♥ e ⊘. */
  lists?: EffectiveLists;
}

/** Il #1 in magenta solo se migliora davvero il team (o col team vuoto): un −N o ±0 resta nei suoi colori. */
export const isLead = (rank: number, item: Item) => rank === 1 && !(item.teamGain && item.teamGain.gain <= 0);

/** +7, −3, ±0. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/**
 * I motivi sotto il nome, dal bonus che vale più punti voto in giù (al massimo `n`). Il malus resta nel dettaglio.
 * Col team vuoto i ruoli principali; senza bonus "nessuna differenza".
 */
export function reasonsOf(item: Item, n: number, usage: number | null, format: Format, lang: Lang): ReasonSummary {
  const diff = 'diff' in item ? item.diff : null;
  const changes = diff ? rankedChanges(diff, item.teamGain?.areaPoints, lang) : null;
  const pros = changes?.pros.slice(0, n).map(p => p.text) ?? [];
  if (pros.length) return { pros: true, texts: pros };
  // Con un cambio ma senza bonus: "nessuna differenza" (la ragione che pesa di più potrebbe essere un malus)
  if (changes) return { pros: false, texts: [t(lang, 'suggest.noDifference')] };
  // Col team vuoto l'uso sta già a destra: qui i ruoli principali del Pokémon
  if (usage !== null) return { pros: false, texts: [detectRoles(item.set, formatRules(format.formatId)).slice(0, 3).map(role => t(lang, `role.${role}`)).join(', ')] };
  // Da aggiungere: le ragioni che pesano di più, in forma breve (una riga ciascuna). L'uso nel meta non è un motivo
  // per sceglierlo; "usato con" lo dice già il segno ciano; un avviso (peso negativo) solo se è l'unica ragione
  const ranked = item.reasons.filter(r => r.component !== 'strength' && !r.usedWith).sort((a, b) => b.weight - a.weight);
  const texts = ranked.filter((r, i) => i === 0 || r.weight > 0).slice(0, n).map(r => r.short);
  // Col "+" verde se è un vero bonus; un avviso (peso negativo) o niente restano senza
  return { pros: texts.length > 0 && ranked[0].weight > 0, texts: texts.length ? texts : [''] };
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
export function BanMark({ species, format, floating = false }: { species: string; format: Format; floating?: boolean }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark floating={floating} alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

/** ♥ nei Preferiti dell'utente, ⊘ nella sua lista Ban (mostrato perché cercato per nome o con "mostra"). */
function ListMarks({ set, lists }: { set: TeamSet; lists?: EffectiveLists }) {
  const tr = useT();
  const banned = isUserBanned(set, lists && { ...lists, allow: undefined });
  const favorite = !banned && isUserFavorite(set, lists);
  if (!banned && !favorite) return null;
  return (
    <span className={`list-mark ${banned ? 'ban' : 'fav'}`} role="img" aria-label={tr(banned ? 'lists.bannedMark' : 'lists.favoriteMark')}
      title={tr(banned ? 'lists.bannedMark' : 'lists.favoriteMark')}><Icon name={banned ? 'ban' : 'heart'} /></span>
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

/** Il voto del team col candidato (+7); col primo Pokémon, il suo uso nel meta. */
export function ResultCell({ item, usage, className = '' }: { item: Item; usage: number | null; className?: string }) {
  const tr = useT();
  const lang = useLang();
  const result = item.teamGain;
  const cls = `result${className ? ` ${className}` : ''}`;
  if (!result) {
    return usage === null
      ? <span className={cls} aria-hidden="true" />
      : (
        <span className={cls} aria-label={tr('suggest.usageAria', { pct: formatPercent(lang, usage) })}>
          <strong>{formatPercent(lang, usage)}</strong><small>{tr('suggest.usageShort')}</small>
        </span>
      );
  }
  const gain = signed(result.gain);
  return (
    <span className={cls} aria-label={tr('suggest.teamGrade', { grade: result.grade, n: result.overall, gain })}>
      <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{gain}</strong>
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
      <PokemonIcon name={member} />
      <span className="visually-hidden">{tr('suggest.outFor', { member })}</span>
    </span>
  );
}

/** Il pulsante rapido "+" o scambio: compare passando sul candidato o col focus. */
export function QuickButton({ quickLabel, actionLabel, replacing, onAction }: Pick<CandidateProps, 'quickLabel' | 'actionLabel' | 'replacing' | 'onAction'>) {
  return (
    <button type="button" className="quick" aria-label={quickLabel} title={actionLabel} onClick={e => { e.stopPropagation(); onAction(); }}>
      <Icon name={replacing ? 'swap' : 'plus'} />
    </button>
  );
}

/**
 * Clic sul candidato = lo apre nel dettaglio; doppio clic = aggiunge o fa lo scambio
 * (non sui pulsanti: il pulsante rapido fa già la sua azione).
 */
export const candidateHandlers = ({ onSelect, onAction }: Pick<CandidateProps, 'onSelect' | 'onAction'>) => ({
  onClick: onSelect,
  onDoubleClick: (e: MouseEvent) => { if (!(e.target as Element).closest('button')) onAction(); },
});

/** Le classi di stato comuni: scelto nel dettaglio, scelto dalla ricerca, scambio. */
export const stateClasses = ({ selected, picked, out }: Pick<CandidateProps, 'selected' | 'picked' | 'out'>) =>
  [selected && 'selected', picked && 'picked', out && 'swap'].filter(Boolean).join(' ');
