import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import type { Archetype } from '../engine/archetype';
import { formatRules, isOneType } from '../engine/formatRules';
import { ActiveFilters } from './ActiveFilters';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { rankKey } from '../engine/teamGain';
import { MAX } from '../engine/candidateRanking';
import { useRanking } from './useRanking';
import { PHONE, useBackClose } from './useBackClose';
import { useMediaQuery } from './useMediaQuery';
import { useSheet } from './useSheet';
import { battleName } from '../engine/dex';
import { PokemonIcon } from './PokemonName';
import { statsEntry } from '../engine/stats';
import { getSpecies } from '../engine/dex';
import { applyFavorites, isUserBanned, isUserFavorite } from '../engine/lists';
import { bannedNames } from '../engine/scoring';
import { EMPTY_FILTERS, filtersFor, isFiltering, searchPool, type CandidateFilters } from '../engine/filters';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { TeamTypePicker } from './TeamTypePicker';
import { conditionLabel, neededConditions, providesAll, viaName } from '../engine/synergy';
import { Sprite } from './Sprite';
import { Icon } from './icons';
import { EeveeMoment } from './EeveeMoment';
import { SuggestionDetail, type DetailTab } from './SuggestionDetail';
import { CandidateCard } from './CandidateCard';
import { BanMark, ExclusiveMark, reasonsOf, type CandidateProps, type Item } from './candidateParts';
import { useLang, useT } from '../i18n/react';
import { usePerPage } from './usePerPage';
import { useFitCount } from './useFit';
import { ModeSwitch } from './ModeSwitch';

/** Candidati in tutto: MAX (candidateRanking.ts). Per pagina: misurato (PAGE senza misura). */
export { MAX };

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
  /** Team nascosto: la lista ha più spazio, il numero per pagina resta quello a team aperto. */
  teamCollapsed?: boolean;
}

/** Un candidato scelto nel Coaching: in modalità Aggiungi o fra i sostituti del membro. */
export interface CandidateFocus {
  species: string;
  mode: 'add' | 'member';
  nonce: number;
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

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace, rating = null, onTarget, focusSearch, focus, teamCollapsed = false }: Props) {
  const tr = useT();
  const lang = useLang();
  const [pageState, setPage] = useState(0);
  // Quanti per pagina: dallo spazio della lista, come se il team fosse aperto
  const listRef = useRef<HTMLOListElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Linguetta del dettaglio a linguette (schermi bassi): resta cambiando candidato
  const [detailTab, setDetailTab] = useState<DetailTab>('brings');
  const { perPage, columns, tileHeight, reasons, listWidth } = usePerPage(listRef, pickerRef, teamCollapsed);
  const [chosenFilters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  // I ruoli scelti in un formato che questo non offre (singolo → doppio) qui non valgono: né accesi né contati
  const filterRules = useMemo(() => formatRules(format.formatId), [format.formatId]);
  const filters = useMemo(() => filtersFor(chosenFilters, filterRules), [chosenFilters, filterRules]);
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
  // "/" (fuori da un campo di testo e senza finestre aperte) porta il cursore nella ricerca, come in molti siti
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const active = event.target as HTMLElement | null;
      if (active?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]')) return;
      const input = searchRef.current;
      if (!input || input.closest('[hidden], [inert]') || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      input.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const view: View = replacing ? 'member' : team.length >= 2 && (scope === 'all' || team.length >= 6) ? 'all' : 'add';
  // Tipo di team per giudicare i cambi: Qualunque (il voto vero del team) finché non lo scegli a mano
  const [pickedType, setPickedType] = useState<Archetype | null>(null);
  // Doppio: un tipo di team solo, la scelta non c'è (e un tipo scelto prima di cambiare formato non conta)
  const oneType = isOneType(formatRules(format.formatId));
  const typeChoice = oneType ? null : pickedType;
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

  // Il voto del team per ogni candidato richiede un attimo: la lista si calcola in sottofondo (useRanking), così il
  // team si aggiorna subito e la lista resta attenuata finché non è pronta
  const source = useMemo(() => ({ team, replaceIndex, format, data: ranking, scope, archetype }), [team, replaceIndex, format, ranking, scope, archetype]);
  const listQuery = useMemo(() => ({ applied, filtering, lang }), [applied, filtering, lang]);
  const rankingInput = useMemo(() => ({ source, query: listQuery }), [source, listQuery]);
  const { result: rankingResult, pending: stale, input: shownInput } = useRanking(rankingInput);
  // Gli input della lista mostrata (con la lista ancora in calcolo, quelli di prima)
  const deferred = shownInput.source;
  // Quanti cambi ha escluso il tipo di team scelto nell'ultimo calcolo della lista
  const report = { excluded: rankingResult.excluded };
  const ranked: Item[] = rankingResult.items;
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
      setPage(Math.floor(index / perPage));
      setCursor(null);
      setSelectedName(focusing);
    }
    setFocusing(null);
  }, [focusing, items, stale, filtering, perPage]);
  // Cambia il numero per pagina (prima misura, Carte↔Menu, finestra): si resta sulla pagina del candidato
  // aperto, o della riga scelta con le frecce, o del primo che si vedeva
  const shownPerPage = useRef(perPage);
  useLayoutEffect(() => {
    const before = shownPerPage.current;
    if (before === perPage) return;
    shownPerPage.current = perPage;
    const open = selectedName ? items.findIndex(item => item.species === selectedName) : -1;
    const anchor = open >= 0 ? open : cursor ?? Math.min(pageState * before, Math.max(0, items.length - 1));
    setPage(Math.floor(anchor / perPage));
  }, [perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.ceil(items.length / perPage);
  // Il numero per pagina può cambiare (finestra): la pagina resta fra quelle che ci sono
  const page = Math.max(0, Math.min(pageState, pages - 1));
  const pageItems = items.slice(page * perPage, (page + 1) * perPage);
  // Fascia "Candidati": la pagina è sempre un numero ("3/9"); se titolo, suggerimento e paginazione non entrano su una riga
  // si toglie il suggerimento del doppio clic (1 = tutto, 0 = senza suggerimento)
  const headRef = useRef<HTMLDivElement>(null);
  const pickerListRef = useRef<HTMLDivElement>(null);
  const headFit = useFitCount(headRef, 1, `${lang}|${view}|${pages}`, pickerListRef, true);
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
  /** Frecce: passa al risultato successivo o precedente, nell'ordine della lista; oltre la pagina, a quella accanto. */
  const moveCursor = (delta: number) => {
    if (!fresh || !items.length) return;
    const first = page * perPage;
    const from = pickedIndex >= first && pickedIndex < first + perPage ? pickedIndex : first;
    const next = Math.min(items.length - 1, Math.max(0, from + delta));
    setCursor(next);
    setSelectedName(null);
    setPage(Math.floor(next / perPage));
  };
  const goToPage = (next: number) => {
    setPage(next);
    setCursor(null);
    setSelectedName(null);
  };
  const selected = pageItems.find(item => item.species === selectedName)
    ?? (pickedIndex >= page * perPage && pickedIndex < (page + 1) * perPage ? items[pickedIndex] : undefined)
    ?? pageItems[0];
  const selectedRank = selected ? items.indexOf(selected) + 1 : 0;
  // Nel gioco l'uso nel meta competitivo non dice niente: le schede a team vuoto non lo mostrano
  const usageOf = (species: string) => (format.game ? null : statsEntry(data.stats, species)?.usage ?? null);
  const act = (item: Item) => {
    if (item.replaces !== undefined) onReplaceWith(item.replaces, item.set);
    else if (replacing) onReplaceWith(replaceIndex, item.set);
    else onAdd(item.set);
    setSheetOpen(false);
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
  /** Modalità: aggiungere o migliorare (tutto il team o un membro). */
  const chooseMode = (next: 'add' | 'improve') => {
    if (next === 'add') {
      setScope('add');
      onCancelReplace();
      return;
    }
    if (view === 'add') setScope('all');
  };
  // Telefono: la scheda copre la lista e si apre solo toccando un candidato; Indietro (o il gesto) la chiude
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useBackClose(sheetOpen, () => setSheetOpen(false), PHONE);
  /** Apre il candidato nel dettaglio. */
  const select = (item: Item) => { setSelectedName(item.species); setSheetOpen(true); };
  // Sul telefono la scheda è una finestra: il fuoco ci entra, Esc la chiude, la lista sotto non si raggiunge
  const phone = useMediaQuery(PHONE);

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
  const sheetModal = phone && sheetOpen && !!selected && !full;
  useSheet(sheetModal, pickerRef, '.sheet-back, .detail', closeSheet);
  const search = full ? null : (
    <>
      <div className="search">
        <span className={`search-field${target ? ' has-hint' : ''}`}>
          <Icon name="search" />
          <input
            ref={searchRef}
            aria-label={tr('suggest.search')}
            aria-keyshortcuts="/"
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
      {!oneType && (
        <TeamTypePicker types={TEAM_TYPES} value={typeChoice ?? null} onChange={setPickedType} />
      )}
      <FilterBar filters={filters} onChange={setFilters} game={!!format.game} rules={filterRules} resultCount={items.length} />
    </>
  );

  const listVars = {
    '--cols': columns,
    '--tile-h': tileHeight !== undefined ? `${tileHeight}px` : undefined,
    '--reasons': reasons,
  } as CSSProperties;

  // Il numero di risultati, sopra la lista quando si cerca o si filtra
  const countText = `${items.length === 1 ? tr('suggest.resultsOne') : tr('suggest.resultsMany', { n: items.length })}${items.length === MAX ? tr('suggest.best') : ''}`;

  // La lista è vuota perché il tipo scelto ha escluso tutti i cambi: si propone Nessuno o un altro tipo
  const typeEmpty = !!deferred.archetype && report.excluded > 0 && items.length === 0 && !stale
    ? <p className="note type-empty">{tr(view === 'add' ? 'suggest.typeEmptyAdd' : 'suggest.typeEmpty', { type: tr(`archetype.${deferred.archetype}`) })}</p>
    : null;
  // Per i lettori di schermo, sempre nella pagina (un annuncio parte solo se la zona c'era già): quanti risultati, o nessuno
  const resultsText = full || !filtering ? '' : items.length === 0 ? tr('suggest.resultsNone') : tr('suggest.resultsAria', { text: countText });
  // Le frecce nella ricerca cambiano chi aggiunge Invio: si dice chi è
  const cursorText = cursor !== null && target ? `${tr('suggest.enter')} ${tr(replacing ? 'suggest.enterReplaces' : 'suggest.enterAdds')} ${target}` : '';
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
        <EeveeMoment pose="thinking" />
        <p>{tr('suggest.noMatch')}</p>
        {typeEmpty}
        {filters.query && <button type="button" onClick={() => setFilters({ ...filters, query: '' })}>{tr('suggest.clear')}</button>}
      </div>
    );
  } else {
    notes = (
      <>
        {setterNote && <p className="note">{setterNote}</p>}
        {typeEmpty}
        {/* Il numero dei risultati si vede una volta sola, nella fascia "Candidati (N)"; qui solo per i lettori di schermo */}
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
        {/* Le misure per le carte: colonne e altezza */}
        <ol className={`suggestions cards${stale ? ' stale' : ''}`} ref={listRef} aria-busy={stale || undefined} style={listVars}>
          {pageItems.map((item, i) => {
            const usage = emptyTeam ? usageOf(item.species) : null;
            const out = item.replaces !== undefined ? memberName(item.replaces) : undefined;
            const candidate: CandidateProps = {
              rank: page * perPage + i + 1,
              item,
              reasons: reasonsOf(item, reasons, usage, format, lang),
              sprite: animated => <Sprite species={item.species} item={item.set.item} size={96} animated={animated} />,
              usage,
              out,
              picked: page * perPage + i === pickedIndex,
              selected: item === selected,
              onSelect: () => select(item),
              actionLabel: actionLabelOf(item),
              onAction: () => act(item),
              format,
              lists: data.userLists,
            };
            return <CandidateCard key={item.species} {...candidate} />;
          })}
          {/* Prima lista in calcolo: le sagome delle carte al loro posto (la griglia vera), non un riquadro vuoto */}
          {stale && pageItems.length === 0 && Array.from({ length: perPage }, (_, i) => (
            <li key={`skel-${i}`} className="card card-skel" aria-hidden="true">
              <span className="card-skel-art" />
              <span className="card-skel-plate"><span className="card-skel-line" /><span className="card-skel-line short" /></span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  // Paginazione nella fascia "Candidati (N)", su una riga: ‹ un trattino per pagina ›
  const pager = pages > 1 && (
    <nav className="pager" aria-label={tr('suggest.pages')}>
      <button type="button" className="step" aria-label={tr('suggest.prev')} disabled={page === 0} onClick={() => goToPage(page - 1)}>
        <Icon name="prev" />
      </button>
      <span className="pager-count" role="status" aria-label={tr('suggest.page', { n: page + 1 })}>{page + 1}/{pages}</span>
      <button type="button" className="step" aria-label={tr('suggest.next')} disabled={page === pages - 1} onClick={() => goToPage(page + 1)}>
        <Icon name="next" />
      </button>
    </nav>
  );

  return (
    <section aria-label={tr('suggest.title')} className="suggestions-panel">
      <div className="toolbar">
        <ModeSwitch team={team} view={view} replacing={replacing} replaceIndex={replaceIndex}
          addDisabled={team.length >= 6} improveDisabled={team.length < 2 && !replacing}
          onAdd={() => chooseMode('add')} onImprove={() => chooseMode('improve')}
          onAll={() => { setScope('all'); onCancelReplace(); }} onTarget={index => onTarget?.(index)} />
        {search}
      </div>
      <p className="visually-hidden" aria-live="polite">{resultsText}</p>
      <p className="visually-hidden" aria-live="polite">{cursorText}</p>
      {!full && <ActiveFilters filters={filters} onChange={setFilters} />}
      {notes}
      <div className={`picker${!full ? ' has-detail' : ''}${sheetOpen && selected ? ' sheet-open' : ''}`} ref={pickerRef}
        style={listWidth ? { '--list-w': `${listWidth}px` } as CSSProperties : undefined}>
        <div className="picker-list" ref={pickerListRef}>
          {!full && items.length > 0 && (
            <div className="list-head" ref={headRef}>
              <h2 className="box-head">{tr('suggest.listHead', { n: items.length })}</h2>
              {headFit > 0 && <span className="dbl-hint">{tr(view === 'add' ? 'suggest.dblHint.add' : 'suggest.dblHint.replace')}</span>}
              {pager}
            </div>
          )}
          {body}
        </div>
        {/* Il dettaglio mostra sempre un candidato (quello aperto, se no il primo della pagina: il n°1 appena la lista
            c'è). Senza candidati resta lo scheletro: la pagina non si accorcia e non salta in alto; mentre la prima lista
            si calcola dice che arriva, non "scegli dalla lista" (la lista non c'è ancora) */}
        {!selected && !full && (
          <aside className={`detail detail-empty${stale ? ' is-loading' : ''}`} aria-hidden="true">
            <Icon name="search" />
            <p>{tr(stale ? 'suggest.detailLoading' : 'suggest.detailEmpty')}</p>
          </aside>
        )}
        {selected && !full && sheetOpen && (
          // Solo sul telefono (il CSS la nasconde altrove): torna alla lista
          <button type="button" className="sheet-back" onClick={closeSheet}>
            <Icon name="prev" /> {tr('suggest.backToList')}
          </button>
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
            banMark={<><BanMark species={selected.species} format={format} /><ExclusiveMark species={battleName(selected.set)} format={format} /></>}
            actionLabel={actionLabelOf(selected)}
            onAction={() => act(selected)}
            teamCollapsed={teamCollapsed}
            tab={detailTab}
            onTab={setDetailTab}
            sheet={sheetModal}
          />
        )}
      </div>
    </section>
  );
}
