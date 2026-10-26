import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import type { Archetype } from '../engine/archetype';
import { improveReplacements, keepersFirst, type Replacement } from '../engine/replace';
import { rankedChanges } from '../engine/coach';
import { rankedAdditions, rankedReplacements } from '../engine/coachFixes';
import { topReason } from '../engine/explain';
import { detectRoles } from '../engine/roles';
import { OFTEN_TOGETHER } from '../engine/scoring';
import { ActiveFilters } from './ActiveFilters';
import type { Suggestion } from '../engine/scoring';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { bestSwaps, rankByTeamGain, rankKey, SWAPS_PER_MEMBER, type SwapOption, type SwapReport, type TeamGain } from '../engine/teamGain';
import { battleName } from '../engine/dex';
import { PokemonIcon } from './PokemonName';
import { statsEntry } from '../engine/stats';
import { formatPercent } from '../i18n';
import { getSpecies } from '../engine/dex';
import { applyFavorites, isUserBanned, isUserFavorite, type EffectiveLists } from '../engine/lists';
import { bannedNames } from '../engine/scoring';
import { formatLabel } from '../engine/formats';
import { activeFilterCount, EMPTY_FILTERS, isFiltering, searchCandidates, searchPool, tierLabel, type CandidateFilters } from '../engine/filters';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { conditionLabel, neededConditions, providesAll, viaName } from '../engine/synergy';
import { Sprite, TypeChip } from './Sprite';
import { TypeIcons } from './typeIcons';
import { Icon } from './icons';
import { SuggestionDetail } from './SuggestionDetail';
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { t } from '../i18n';
import { useLang, useT } from '../i18n/react';

/** Candidati per pagina e in tutto; il voto del team si calcola sui primi POOL per punteggio. */
export const PAGE = 10;
export const MAX = 50;
const POOL = 100;

/**
 * Candidato in lista, col voto che darebbe al team (assente col primo Pokémon).
 * Nelle raccomandazioni libere anche il membro che sostituirebbe e gli altri possibili.
 */
type Item = (Suggestion | Replacement) & { teamGain?: TeamGain; replaces?: number; alternatives?: SwapOption[] };

/** Cosa mostra la lista: aggiunte, scambi liberi con tutto il team, o sostituti di un membro. */
type View = 'add' | 'all' | 'member';


interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  replaceIndex: number | null;
  onAdd: (set: TeamSet) => void;
  onReplaceWith: (index: number, set: TeamSet) => void;
  onCancelReplace: () => void;
  /** Voto del team attuale, per mostrare come cambia col candidato. */
  rating?: TeamRating | null;
  /** Sceglie il membro da sostituire (null: nessuno). */
  onTarget?: (index: number | null) => void;
  /** Cambia a ogni clic su uno slot vuoto: si torna ad Aggiungi con il cursore nella ricerca. */
  focusSearch?: number;
  /** Candidato da mostrare (dal Coaching): a ogni `nonce` nuovo si va alla sua pagina e lo si apre nel dettaglio. */
  focus?: CandidateFocus;
}

/** Un candidato scelto nel Coaching: in modalità Aggiungi o fra i sostituti del membro. */
export interface CandidateFocus {
  species: string;
  mode: 'add' | 'member';
  nonce: number;
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
function BanMark({ species, format }: { species: string; format: Format }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

/** Il voto del team col candidato (+7, B 80); col primo Pokémon, il suo uso nel meta. */
function ResultCell({ item, usage }: { item: Item; usage: number | null }) {
  const tr = useT();
  const lang = useLang();
  const result = item.teamGain;
  if (!result) {
    return usage === null
      ? <span className="result" aria-hidden="true" />
      : (
        <span className="result" aria-label={tr('suggest.usageAria', { pct: formatPercent(lang, usage) })}>
          <strong>{formatPercent(lang, usage)}</strong><small>{tr('suggest.usageShort')}</small>
        </span>
      );
  }
  const gain = signed(result.gain);
  return (
    <span className="result" aria-label={tr('suggest.teamGrade', { grade: result.grade, n: result.overall, gain })}>
      <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{gain}</strong>
    </span>
  );
}

/** +7, −3, ±0. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

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

function SuggestionRow({ rank, item, usage, out, quickLabel, actionLabel, replacing, picked, selected, onSelect, onAction, format, lists }: {
  /** Liste dell'utente, per i segni ♥ e ⊘. */
  lists?: EffectiveLists;
  /** Riga scelta dalla ricerca (Invio la aggiunge). */
  picked?: boolean;
  /** Riga mostrata nel dettaglio. */
  selected: boolean;
  onSelect: () => void;
  quickLabel: string;
  actionLabel: string;
  replacing: boolean;
  format: Format;
  rank: number;
  item: Item;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  /** Il membro che uscirebbe (raccomandazioni libere). */
  out?: string;
  onAction: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const diff = 'diff' in item ? item.diff : null;
  // Una riga sola: il bonus che vale più punti e il malus che ne toglie di più (aggiungendo, la ragione che pesa di più)
  const changes = diff ? rankedChanges(diff, item.teamGain?.areaPoints, lang) : null;
  const bonus = changes?.pros[0]?.text ?? null;
  const malus = changes?.cons[0]?.text ?? null;
  const summaryText = changes
    ? (item.reasons[0] ? topReason(item.reasons)!.text : tr('suggest.noDifference'))
    // L'uso nel meta non è un motivo per sceglierlo: resta solo col team vuoto, dove è l'unico criterio
    // Col team vuoto l'uso sta già a destra: qui i ruoli principali del Pokémon
    : (usage !== null ? detectRoles(item.set, formatRules(format.formatId)).slice(0, 3).map(role => tr(`role.${role}`)).join(', ') : topReason(item.reasons.filter(r => r.component !== 'strength'))?.text) ?? '';
  const types = getSpecies(item.species)?.types ?? [];
  // Avvisi e "spesso usati insieme" come segni con tooltip, non più etichette lunghe che vanno a capo
  const warnings = item.facts.clashes.map(text => ({ level: 'warn' as const, text: text.replace(/^⚠\s*/, '') }));
  const synergy = item.facts.synergy;
  const together = synergy && synergy.pct >= OFTEN_TOGETHER
    ? [{ level: 'info' as const, text: tr('tag.oftenTogether', { member: synergy.member, pct: Math.round(synergy.pct * 100) }) }]
    : [];
  const className = ['suggestion', rank === 1 && 'first', selected && 'selected', picked && 'picked', out && 'swap'].filter(Boolean).join(' ');
  return (
    // Tutta la riga apre il dettaglio col mouse; da tastiera lo fa il nome
    // Doppio clic: aggiunge o fa lo scambio (il pulsante a destra resta la via visibile e da tastiera)
    <li className={className} onClick={onSelect} onDoubleClick={e => { if (!(e.target as Element).closest('button')) onAction(); }}>
      <span className="rank" aria-hidden="true">{rank}</span>
      <Sprite species={item.species} item={item.set.item} size={48} />
      <span className="who">
        <span className="name-line">
          <button type="button" className="pick" aria-pressed={selected} onClick={e => { e.stopPropagation(); onSelect(); }}>
            <strong><span className="visually-hidden">{rank}. </span>{item.species}</strong>
          </button>
          {/* Il tipo subito dopo il nome, poi i segni (ban, liste, avvisi, usato insieme) */}
          <span className="types">
            {types.map(type => <TypeChip key={type} type={type} />)}
            {/* Righe strette: al posto dei chip le icone dei tipi (il nome del candidato ha la precedenza) */}
            <TypeIcons types={types} className="types-compact" />
          </span>
          <BanMark species={item.species} format={format} />
          <ListMarks set={item.set} lists={lists} />
          <AlertMark alerts={warnings} />
          <AlertMark alerts={together} icon="spark" />
        </span>
        {/* Bonus e malus principali; il colore solo sui segni */}
        <small>
          {bonus || malus
            ? <>{bonus && <span className="gain"><b aria-hidden="true">+</b><span className="visually-hidden">+</span><Typed text={bonus} /></span>}{malus && <span className="loss"><b aria-hidden="true">−</b><span className="visually-hidden">−</span><Typed text={malus} /></span>}</>
            : <span className="plain"><Typed text={summaryText} /></span>}
        </small>
      </span>
      {/* Chi esce: solo la sua icona accanto al voto (con 6 membri basta); il nome nel tooltip e per gli screen reader */}
      {out && (
        <span className="out" title={tr('suggest.outFor', { member: out })}>
          <PokemonIcon name={out} />
          <span className="visually-hidden">{tr('suggest.outFor', { member: out })}</span>
        </span>
      )}
      <ResultCell item={item} usage={usage} />
      <button
        type="button"
        className="quick"
        aria-label={quickLabel}
        title={actionLabel}
        onClick={e => { e.stopPropagation(); onAction(); }}
      >
        <Icon name={replacing ? 'swap' : 'plus'} />
      </button>
    </li>
  );
}

/** Il valore si aggiorna solo dopo `delay` ms senza modifiche (per non ricalcolare a ogni lettera). */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export const SEARCH_DELAY = 200;

/** I tipi di team che si possono scegliere per giudicare i cambi, dopo Nessuno. */
const TEAM_TYPES: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace, rating = null, onTarget, focusSearch, focus }: Props) {
  const tr = useT();
  const lang = useLang();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  // La lista si ricalcola sui filtri "stabili"; l'input mostra subito quello che scrivi
  const applied = useDebounced(filters, SEARCH_DELAY);
  const filtering = isFiltering(applied);
  const replacing = replaceIndex !== null && replaceIndex < team.length;
  // Aggiungere o migliorare il team con scambi liberi; a team completo si migliora
  const [scope, setScope] = useState<'add' | 'all'>('add');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusSearch) return;
    setScope('add');
    // Dopo il cambio di scheda: lo scorrimento lo fa già la barra delle schede
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  }, [focusSearch]);
  const view: View = replacing ? 'member' : team.length >= 2 && (scope === 'all' || team.length >= 6) ? 'all' : 'add';
  // Tipo di team per giudicare i cambi: Qualunque (il voto vero del team) finché non lo scegli a mano
  const [pickedType, setPickedType] = useState<Archetype | null>(null);
  const typeChoice = pickedType;
  // Vale in tutte le modalità: aggiungendo cerca chi aiuta a costruire quel tipo, migliorando chi lo raggiunge o lo mantiene
  const archetype = typeChoice ?? undefined;
  /** Il team contro cui si valutano i candidati è vuoto: niente adattamento da mostrare. */
  const emptyTeam = (replacing ? team.length - 1 : team.length) === 0;

  // Bannati dall'utente: fuori dalla lista, tranne quello cercato col nome esatto e, con "mostra", tutti
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [team, format.formatId]);
  const exactQuery = getSpecies(applied.query.trim())?.name ?? null;
  const ranking = useMemo(() => {
    const lists = data.userLists;
    if (!lists?.bans.size) return data;
    const allow = new Set<string>([...(exactQuery ? [exactQuery] : []), ...(revealed ? lists.bans : [])]);
    // Nessuno ammesso: gli stessi dati del Coaching (le classifiche già calcolate si riusano)
    if (!allow.size) return data;
    return { ...data, userLists: { ...lists, allow } };
  }, [data, exactQuery, revealed]);

  // Il voto del team per ogni candidato richiede un attimo: la lista si ricalcola senza bloccare il resto
  // (il team si aggiorna subito, la lista resta attenuata finché non è pronta)
  const source = useMemo(() => ({ team, replaceIndex, format, data: ranking, scope, archetype }), [team, replaceIndex, format, ranking, scope, archetype]);
  const deferred = useDeferredValue(source);
  const stale = deferred !== source;
  // Quanti cambi ha escluso il tipo di team scelto nell'ultimo calcolo della lista
  const report = useMemo<SwapReport>(() => ({ excluded: 0 }), [deferred, applied, filtering, lang]);
  const ranked: Item[] = useMemo(() => {
    const { team, format, data, archetype } = deferred;
    const replaceIndex = deferred.replaceIndex !== null && deferred.replaceIndex < team.length ? deferred.replaceIndex : null;
    // Prima i candidati migliori per punteggio, poi ordinati per il voto che darebbero al team
    const rank = (list: (Suggestion | Replacement)[], sort = true) => rankByTeamGain(list, team, replaceIndex, data, lang, sort, archetype, report).slice(0, MAX);
    if (replaceIndex === null && team.length >= 2 && (deferred.scope === 'all' || team.length >= 6)) {
      // Raccomandazioni libere: per ogni candidato, il membro che conviene di più sostituire
      const pool = filtering ? searchPool(team, format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      return bestSwaps(team, data, lang, index => improveReplacements(team, index, format, data, SWAPS_PER_MEMBER, pool, lang, archetype), { archetype, report }).slice(0, MAX);
    }
    if (replaceIndex !== null) {
      // Con ricerca o filtri i sostituti vengono da tutto il Pokédex, non solo dalle statistiche
      const pool = filtering ? searchPool(team.filter((_, i) => i !== replaceIndex), format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      // Senza filtri: la classifica condivisa col Coaching. Chi porta il meteo/campo necessario resta in cima
      return keepersFirst(pool ? rank(improveReplacements(team, replaceIndex, format, data, POOL, pool, lang, archetype))
        : rankedReplacements(team, replaceIndex, format, data, POOL, lang, archetype, report).slice(0, MAX));
    }
    if (filtering) return rank(searchCandidates(team, format, data, applied, POOL, lang));
    return data.stats ? rankedAdditions(team, format, data, POOL, lang, archetype, report).slice(0, MAX) : [];
  }, [deferred, applied, filtering, lang, report]);
  // Preferiti dell'utente: a voto quasi pari passano davanti
  const items: Item[] = useMemo(() => {
    const lists = deferred.data.userLists;
    if (!lists?.favorites.size) return ranked;
    // Col tipo scelto la penalità per le voci perse vale anche qui: un preferito penalizzato non risale
    const value = (item: Item) => (item.teamGain ? rankKey(item.teamGain) : 100 * (statsEntry(deferred.data.stats, item.species)?.usage ?? 0));
    return applyFavorites(ranked, item => isUserFavorite(item.set, lists), value);
  }, [ranked, deferred]);
  // Quanti bannati restano fuori (non contano quelli ammessi), contro il team per cui si cercano i candidati:
  // aggiungendo il team intero, sostituendo un membro gli altri cinque, negli scambi liberi ognuno dei sei
  const hiddenCount = useMemo(() => {
    if (revealed || !ranking.userLists?.bans.size) return 0;
    const banned = (rest: TeamSet[]) => (filtering
      ? searchPool(rest, format, ranking, applied).filter(set => isUserBanned(set, ranking.userLists)).map(set => battleName(set))
      : bannedNames(rest, format, ranking));
    if (view === 'add') return banned(team).length;
    if (view === 'member') return banned(team.filter((_, i) => i !== replaceIndex)).length;
    return new Set(team.flatMap((_, i) => banned(team.filter((_, j) => j !== i)))).size;
  }, [revealed, ranking, view, filtering, team, format, applied, replaceIndex]);

  const query = filters.query.trim();
  // I risultati valgono solo se la lista è già aggiornata su quello che hai scritto
  const fresh = !!query && applied.query.trim() === query;
  const exact = getSpecies(query);
  // Riga scelta con le frecce; null: il nome esatto se c'è, altrimenti il primo risultato
  const [cursor, setCursor] = useState<number | null>(null);
  // Riga aperta nel dettaglio col clic; null: quella scelta dalla ricerca o la prima della pagina
  const [selectedName, setSelectedName] = useState<string | null>(null);
  // Una lista nuova riparte dalla prima pagina; il candidato aperto resta finché c'è ancora
  useEffect(() => {
    setCursor(null);
    setPage(0);
    setSelectedName(name => (name && items.some(item => item.species === name) ? name : null));
  }, [items]);
  // Candidato dal Coaching: dopo l'effetto qui sopra, appena la lista aggiornata lo contiene (o non lo contiene più)
  const [focusing, setFocusing] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    if (focus.mode === 'add') setScope('add');
    // Impostazioni predefinite, come il Coaching: niente ricerca né filtri, tipo di team riconosciuto (stesso +N)
    setFilters(EMPTY_FILTERS);
    setPickedType(null);
    setFocusing(focus.species);
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Aspetta che la ricerca azzerata arrivi alla lista (dopo il ritardo) e che la lista sia aggiornata
    if (!focusing || stale || filtering) return;
    const index = items.findIndex(item => item.species === focusing);
    // Non c'è (filtri attivi): resta la lista com'è
    if (index >= 0) {
      setPage(Math.floor(index / PAGE));
      setCursor(null);
      setSelectedName(focusing);
    }
    setFocusing(null);
  }, [focusing, items, stale, filtering]);
  const pages = Math.ceil(items.length / PAGE);
  const pageItems = items.slice(page * PAGE, (page + 1) * PAGE);
  const chosen = fresh && cursor !== null ? items[cursor] : undefined;
  const fallback = fresh ? items[0] : undefined;
  const pickedIndex = !fresh ? -1
    : cursor ?? (exact ? items.findIndex(item => item.species === exact.name) : 0);
  /** Invio: la riga scelta con le frecce, altrimenti il nome esatto, altrimenti il primo risultato. */
  const pickFromSearch = () => {
    if (view === 'all') {
      // Negli scambi liberi serve sapere chi esce: si usa la riga della lista
      const item = chosen ?? (exact ? items.find(i => i.species === exact.name) : undefined) ?? fallback;
      if (!item) return;
      act(item);
    } else {
      const set = chosen?.set ?? (exact ? defaultSet(data, exact.name, format.genLimit) : fallback?.set);
      if (!set) return;
      if (replacing) onReplaceWith(replaceIndex, set);
      else onAdd(set);
    }
    setFilters({ ...filters, query: '' });
  };
  const target = chosen?.species ?? exact?.name ?? fallback?.species;
  const listRef = useRef<HTMLOListElement>(null);
  /** Frecce: passa al risultato successivo o precedente, tenendolo in vista. */
  const moveCursor = (delta: number) => {
    const first = page * PAGE;
    const last = Math.min(items.length, first + PAGE) - 1;
    if (!fresh || last < first) return;
    const next = Math.min(last, Math.max(first, Math.max(pickedIndex, first) + delta));
    setCursor(next);
    setSelectedName(null);
    listRef.current?.children[next - first]?.scrollIntoView?.({ block: 'nearest' });
  };
  const goToPage = (next: number) => {
    setPage(next);
    setCursor(null);
    setSelectedName(null);
  };
  const selected = pageItems.find(item => item.species === selectedName)
    ?? (pickedIndex >= page * PAGE && pickedIndex < (page + 1) * PAGE ? items[pickedIndex] : undefined)
    ?? pageItems[0];
  const selectedRank = selected ? items.indexOf(selected) + 1 : 0;
  const usageOf = (species: string) => statsEntry(data.stats, species)?.usage ?? null;
  const act = (item: Item) => {
    if (item.replaces !== undefined) onReplaceWith(item.replaces, item.set);
    else if (replacing) onReplaceWith(replaceIndex, item.set);
    else onAdd(item.set);
    // Il nome cercato ha fatto il suo lavoro: la ricerca riparte vuota (i filtri restano)
    setFilters(f => ({ ...f, query: '' }));
  };
  /** Chi uscirebbe col candidato, o null se si aggiunge. */
  const outOf = (item: Item) => (item.replaces !== undefined ? item.replaces : replacing ? replaceIndex : null);
  // Il nome dal team per cui la lista è stata calcolata: per un attimo può essere quello di prima (es. team appena svuotato)
  const memberName = (index: number) => { const member = deferred.team[index] ?? team[index]; return member ? battleName(member) : ''; };
  const actionLabelOf = (item: Item) => (item.replaces !== undefined
    ? tr('suggest.swapAction', { member: memberName(item.replaces) })
    : tr(replacing ? 'suggest.replaceWith' : 'suggest.add'));
  const quickLabelOf = (item: Item) => (item.replaces !== undefined
    ? tr('suggest.swapQuick', { species: item.species, member: memberName(item.replaces) })
    : replacing ? tr('suggest.replaceQuick', { species: item.species }) : tr('suggest.addQuick', { species: item.species }));
  /** Modalità: aggiungere o migliorare (tutto il team o un membro). */
  const chooseMode = (next: 'add' | 'improve') => {
    if (next === 'add') {
      setScope('add');
      onCancelReplace();
      return;
    }
    if (view === 'add') setScope('all');
  };
  /** Apre il candidato nel dettaglio. */
  const select = (item: Item) => setSelectedName(item.species);

  // Sostituendo un setter di cui altri membri hanno bisogno, si mostrano solo setter della stessa condizione
  let setterNote: string | null = null;
  if (replacing) {
    const needed = neededConditions(team, replaceIndex);
    if (needed.length) {
      const labels = needed.map(n => conditionLabel(n.condition, lang)).join(` ${tr('suggest.and')} `);
      const who = [...new Set(needed.flatMap(n => n.beneficiaries.map(b => b.species)))].join(', ');
      // Chi porta la condizione sta in cima, gli altri seguono per voto
      setterNote = items.some(item => providesAll(item.set, needed))
        ? tr('suggest.setterOnly', { conditions: labels, who })
        : tr('suggest.setterNone', {
          conditions: labels,
          species: team[replaceIndex].species,
          losses: needed.flatMap(n => n.beneficiaries.map(b => tr('suggest.loses', { species: b.species, via: viaName(b.via, lang) }))).join(', '),
        });
    }
  }

  const full = view === 'add' && team.length >= 6;
  const search = full ? null : (
    <>
      <div className="search">
        <span className={`search-field${target ? ' has-hint' : ''}`}>
          <Icon name="search" />
          <input
            ref={searchRef}
            aria-label={tr('suggest.search')}
            aria-describedby={target ? 'search-hint' : undefined}
            placeholder={tr('suggest.searchPlaceholder')}
            value={filters.query}
            onChange={e => { setFilters({ ...filters, query: e.target.value }); setSelectedName(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter') pickFromSearch();
              else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
              else if (e.key === 'Escape') setFilters({ ...filters, query: '' });
            }}
          />
          {target && (
            // Dentro il campo, a destra: comparendo non sposta il resto
            <span id="search-hint" className="search-hint">
              <kbd>{tr('suggest.enter')}</kbd> {tr(replacing ? 'suggest.enterReplaces' : 'suggest.enterAdds')} <strong>{target}</strong>
            </span>
          )}
          {filters.query && (
            <button type="button" className="clear" aria-label={tr('suggest.clear')} onClick={() => setFilters({ ...filters, query: '' })}>
              <Icon name="close" />
            </button>
          )}
        </span>
      </div>
      {/* Tipo di team: un'impostazione, non un filtro (niente chip, Azzera non lo tocca) */}
      <label className="team-type" title={typeChoice ? tr(`archetype.${typeChoice}.note`) : tr('suggest.anyTypeNote')}>
        <span aria-hidden="true">{tr('suggest.teamTypeShort')}</span>
        <select aria-label={tr('suggest.teamType')} value={typeChoice ?? ''} onChange={e => setPickedType((e.target.value || null) as Archetype | null)}>
          <option value="">{tr('suggest.anyType')}</option>
          {TEAM_TYPES.map(type => <option key={type} value={type}>{tr(`archetype.${type}`)}</option>)}
        </select>
      </label>
      <FilterBar filters={filters} onChange={setFilters} />
    </>
  );

  // Il numero di risultati, sopra la lista quando si cerca o si filtra
  const countText = `${items.length === 1 ? tr('suggest.resultsOne') : tr('suggest.resultsMany', { n: items.length })}${items.length === MAX ? tr('suggest.best') : ''}`;

  // La lista è vuota perché il tipo scelto ha escluso tutti i cambi: si propone Nessuno o un altro tipo
  const typeEmpty = !!deferred.archetype && report.excluded > 0 && items.length === 0 && !stale
    ? <p className="note type-empty">{tr(view === 'add' ? 'suggest.typeEmptyAdd' : 'suggest.typeEmpty', { type: tr(`archetype.${deferred.archetype}`) })}</p>
    : null;
  // Note sopra (a tutta larghezza); sotto, lista e dettaglio partono alla stessa altezza
  let notes = null;
  let body;
  if (full) {
    body = <p>{tr('suggest.full')}</p>;
  } else if (!data.stats && !filtering) {
    body = <p>{tr('suggest.needData')}</p>;
  } else if (filtering && items.length === 0) {
    body = (
      <div className="list-empty">
        <Icon name="search" />
        <p>{tr('suggest.noMatch')}</p>
        {typeEmpty}
        {filters.query && <button type="button" onClick={() => setFilters({ ...filters, query: '' })}>{tr('suggest.clear')}</button>}
      </div>
    );
  } else {
    notes = (
      <>
        {filtering && <p className="visually-hidden" aria-live="polite">{tr('suggest.resultsAria', { text: countText })}</p>}
        {setterNote && <p className="note">{setterNote}</p>}
        {typeEmpty}
        {emptyTeam && (
          <p className="note">{tr('suggest.emptyTeam')}</p>
        )}
        {/* Con filtri attivi il numero sta sulla riga dei chip; con la sola ricerca qui */}
        {filtering && activeFilterCount(filters) === 0 && <p className="list-count">{countText}</p>}
        {hiddenCount > 0 && (
          <p className="note hidden-note">
            {tr(hiddenCount === 1 ? 'lists.hiddenOne' : 'lists.hidden', { n: hiddenCount })}{' '}
            <button type="button" className="link" onClick={() => setRevealed(true)}>{tr('lists.show')}</button>
          </p>
        )}
      </>
    );
    body = (
      <>
        <ol className={`suggestions${stale ? ' stale' : ''}`} ref={listRef} aria-busy={stale || undefined}>
          {pageItems.map((item, i) => (
            <SuggestionRow
              key={item.species}
              picked={page * PAGE + i === pickedIndex}
              selected={item === selected}
              onSelect={() => select(item)}
              rank={page * PAGE + i + 1}
              item={item}
              usage={emptyTeam ? usageOf(item.species) : null}
              out={item.replaces !== undefined ? memberName(item.replaces) : undefined}
              actionLabel={actionLabelOf(item)}
              quickLabel={quickLabelOf(item)}
              replacing={view !== 'add'}
              onAction={() => act(item)}
              format={format}
              lists={data.userLists}
            />
          ))}
        </ol>
        {pages > 1 && (
          <nav className="pager" aria-label={tr('suggest.pages')}>
            <button type="button" className="step" aria-label={tr('suggest.prev')} disabled={page === 0} onClick={() => goToPage(page - 1)}>
              <Icon name="prev" />
            </button>
            {Array.from({ length: pages }, (_, n) => (
              <button key={n} type="button" aria-label={tr('suggest.page', { n: n + 1 })} aria-current={n === page ? 'page' : undefined}
                onClick={() => goToPage(n)}>
                {n + 1}
              </button>
            ))}
            <button type="button" className="step" aria-label={tr('suggest.next')} disabled={page === pages - 1} onClick={() => goToPage(page + 1)}>
              <Icon name="next" />
            </button>
          </nav>
        )}
      </>
    );
  }

  return (
    <section aria-label={tr('suggest.title')} className="suggestions-panel">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label={tr('suggest.mode')}>
          <button type="button" aria-pressed={view === 'add'} disabled={team.length >= 6} onClick={() => chooseMode('add')}>
            <Icon name="plus" />{tr('suggest.addMode')}
          </button>
          <button type="button" aria-pressed={view !== 'add'} disabled={team.length < 2 && !replacing}
            onClick={() => chooseMode('improve')}>{tr('suggest.improve')}</button>
        </div>
        {search}
      </div>
      {!full && <ActiveFilters filters={filters} onChange={setFilters} count={filtering && items.length > 0 ? countText : undefined} />}
      {view !== 'add' && (
        <div className="subbar">
          {/* Chi sostituire: tutti (il motore sceglie per ogni candidato) o un membro preciso */}
          <div className="targets" role="group" aria-label={tr('suggest.target')}>
            <span className="targets-label" aria-hidden="true">{tr('suggest.targetLabel')}</span>
            <button type="button" aria-pressed={view === 'all'} onClick={() => { setScope('all'); onCancelReplace(); }}>{tr('suggest.targetAll')}</button>
            {team.map((member, index) => (
              <button key={index} type="button" aria-pressed={replacing && replaceIndex === index}
                aria-label={tr('suggest.targetMember', { member: battleName(member) })}
                title={member.favorite ? tr('suggest.targetFavorite') : undefined}
                onClick={() => onTarget?.(index)}>
                <PokemonIcon name={battleName(member)} />
                <span>{battleName(member)}</span>
                {member.favorite && <Icon name="star" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {notes}
      <div className={`picker${!full ? ' has-detail' : ''}`}>
        <div className="picker-list">
          {!full && items.length > 0 && <div className="list-head"><h2 className="box-head">{tr('suggest.listHead', { n: items.length })}</h2></div>}
          {body}
        </div>
        {/* Senza candidati resta lo scheletro del dettaglio: la pagina non si accorcia e non salta in alto */}
        {!selected && !full && (
          <aside className="detail detail-empty" aria-hidden="true">
            <Icon name="search" />
            <p>{tr('suggest.detailEmpty')}</p>
          </aside>
        )}
        {selected && !full && (
          <SuggestionDetail
            key={selected.species}
            item={selected}
            rank={selectedRank}
            // Il team per cui il suggerimento è stato calcolato (gli indici dei membri si riferiscono a quello)
            team={deferred.team}
            replaceIndex={outOf(selected)}
            data={data}
            format={format}
            rating={rating}
            archetype={deferred.archetype}
            usage={emptyTeam ? usageOf(selected.species) : null}
            banMark={<BanMark species={selected.species} format={format} />}
            actionLabel={actionLabelOf(selected)}
            onAction={() => act(selected)}
          />
        )}
      </div>
    </section>
  );
}
