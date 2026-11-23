import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';
import { teamArchetype, type Archetype, type SinglesArchetype } from '../engine/archetype';
import type { Gap } from '../engine/coherence';
import type { EngineData } from '../engine/data';
import { battleAbility, battleName, battleSpecies } from '../engine/dex';
import { fillStylesFor, PROPOSALS_PER_ROUND, proposalOrder, type FavoriteMode, type FillChoice, type FillStyle, type Proposal } from '../engine/fillProposals';
import type { Format } from '../engine/format';
import { formatRules, isOneType } from '../engine/formatRules';
import { isUserFavorite } from '../engine/lists';
import { rateTeam } from '../engine/rating';
import { bannedInPool } from '../engine/scoring';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { rankTournamentTeams } from '../engine/tournamentTeams';
import { gameName, natureName, statShort, typeName } from '../i18n/game';
import type { Lang } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { FloatTip, useFloatAnchor } from './FloatTip';
import { Icon, type IconName } from './icons';
import { PokemonIcon } from './PokemonName';
import { Sprite, typeColor } from './Sprite';
import { EeveeMoment } from './EeveeMoment';
import type { CSSProperties } from 'react';
import { useMemberTip } from './MemberCard';
import { streamFill } from './useRanking';
import { TipGlyph, TipHead, TipSec } from './TipHead';

const ARCHETYPES: SinglesArchetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
/** Le voci dei tipi, in ordine: "Il migliore" (nessun tipo) e i cinque archetipi. */
const TYPES: (SinglesArchetype | null)[] = [null, ...ARCHETYPES];
const typeKey = (archetype: Archetype | null) => archetype ?? 'best';
const FAVORITE_MODES: FavoriteMode[] = ['off', 'priority', 'only'];
type Tab = 'proposals' | 'tournament';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onApply: (proposal: Proposal) => void;
  /** Team da torneo: prende il posto del team attuale. */
  onLoadTeam: (team: TeamSet[]) => void;
  onClose: () => void;
}

/** La proposta entra al suo posto nell'ordine finale (a pari posto dopo quelle già arrivate): le righe sopra non si muovono. */
function insertSorted(list: Proposal[], proposal: Proposal, mode: FavoriteMode): Proposal[] {
  const at = list.findIndex(other => proposalOrder(proposal, other, mode) < 0);
  return at === -1 ? [...list, proposal] : [...list.slice(0, at), proposal, ...list.slice(at)];
}

const evsText = (set: TeamSet, lang: Lang) =>
  STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ') || '—';

/**
 * Completa team: due schede. Proposte: tipo di team, condizione (meteo / Trick Room) e preferiti a scelta, i set dei
 * membri da tenere o lasciar cambiare, PROPOSALS_PER_ROUND completamenti per giro (nel primo nessun Pokémon nuovo in
 * comune; dopo i già mostrati possono tornare, ma ogni proposta cambia almeno metà dei nuovi rispetto a ognuna delle
 * precedenti); i giri già
 * calcolati si sfogliano con le frecce (‹ 1/3 ›) senza ricalcolarli. Le proposte arrivano una alla
 * volta dal calcolo in sottofondo e ognuna entra al suo posto; cambiando scelta il calcolo riparte. I tipi senza
 * proposte (per le altre scelte) si oscurano, e se quello scelto è vuoto si passa al primo che ne ha.
 * Team da torneo: i team della fonte per il formato, prima quelli con più Pokémon in comune.
 */
export function FillPanel({ team, format, data, onApply, onLoadTeam, onClose }: Props) {
  // Telefono: le impostazioni in un foglio unico che si apre dal basso (sopra le proposte resta il loro riassunto)
  // Telefono e tablet: il pannello a tutto schermo con le proposte prima e le impostazioni in un foglio
  // (Col mouse da 900 px, a mezzo schermo accanto a Showdown, è la finestra centrata del computer)
  const phone = useMediaQuery('(max-width: 1099px) and (not ((min-width: 900px) and (pointer: fine)))');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsSheet = useRef<HTMLDivElement>(null);
  useAnchoredPop(settingsButton, settingsSheet, phone && settingsOpen, { sheet: 'always', onDismiss: () => setSettingsOpen(false) });
  const t = useT();
  const lang = useLang();
  // Passando su un Pokémon di una proposta o di un team da torneo: la sua carta (set, statistiche, mosse)
  const memberTip = useMemberTip();
  const ids = useId();
  // Il tooltip DreamDex delle scelte con una spiegazione (tipi di team, Qualsiasi): nome e frase, col mouse e col fuoco
  const optionTip = useFloatAnchor<{ label: string; note: string; icon: IconName }>();
  const [tab, setTab] = useState<Tab>('proposals');
  const [pickState, setPick] = useState<{ archetype: Archetype | null; style: FillStyle | null }>({ archetype: null, style: null });
  const [favorites, setFavorites] = useState<FavoriteMode>('priority');
  // Il lucchetto "fissa il set" per membro, legato a questo team: si parte liberi (le proposte possono migliorare il set),
  // tranne i membri già fissati nel team; cambiando team si riparte da lì
  const startKeep = () => team.map(set => !!set.favorite);
  const [keepState, setKeepState] = useState(() => ({ team, keep: startKeep() }));
  const keep = keepState.team === team ? keepState.keep : startKeep();
  const keepKey = keep.map(k => (k ? 1 : 0)).join('');
  // Doppio: un tipo di team solo, quindi niente scelta del tipo (e un tipo rimasto nello stato non conta)
  const oneType = isOneType(formatRules(format.formatId));
  // Gli stili del formato: in doppio anche i campi e Tailwind (uno stile che il formato non offre non conta)
  const styles = fillStylesFor(formatRules(format.formatId));
  const pickedStyle = pickState.style && styles.includes(pickState.style) ? pickState.style : null;
  const choice = useMemo<FillChoice>(() => ({ ...pickState, style: pickedStyle, archetype: oneType ? null : pickState.archetype, favorites, keepSets: keep }),
    [pickState, pickedStyle, oneType, favorites, keepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0);
  // Le proposte di ogni giro già calcolato (l'ultimo può essere ancora in corso): le frecce le sfogliano senza ricalcolare
  const [pages, setPages] = useState<Proposal[][]>([[]]);
  const [page, setPage] = useState(0);
  const proposals = pages[round] ?? [];
  const shown = pages[page] ?? [];
  // Si guarda il giro in calcolo: solo lì ci sono gli scheletri
  const watching = page === round;
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  // Il giro è arrivato in fondo e i Pokémon nuovi sono finiti: "Altre proposte" non troverebbe niente (un giro più
  // corto fermato dai tentativi non conta: quello dopo, con più proposte nella storia e tentativi nuovi, può trovarne altre)
  const [exhausted, setExhausted] = useState(false);
  // Tipi con almeno una proposta per le altre scelte (undefined: ancora da verificare, o calcolo rotto)
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  // Il tipo l'ha scelto il giocatore: il pannello non lo cambia più da solo
  const chosenByHand = useRef(false);
  // Le proposte già mostrate per questa scelta e questo team (le forme dei nuovi di ognuna): "Altre proposte" ne tiene conto
  const shownSoFar = useRef<string[][]>([]);
  const resetKey = useMemo(() => ({}), [team, format, data, choice]);
  const lastReset = useRef(resetKey);
  // Tutto quello che cambia i controlli dei tipi (non il tipo scelto): partono dopo la prima proposta del calcolo
  // principale (o la sua fine), così non lo rallentano
  const checksKey = useMemo(() => ({}), [team, format, data, choice.style, choice.favorites, keepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [checksReady, setChecksReady] = useState<object | null>(null);
  const lastChecks = useRef(checksKey);
  // Chi è nella lista Ban dell'utente non entra nelle proposte: si dice quanti sono
  const banned = useMemo(() => bannedInPool(team, format, data), [team, format, data]);
  // Il voto del team attuale (già calcolato qui per il +N delle proposte): in testa al pannello, che copre la carta del voto
  const current = useMemo(() => (team.length ? rateTeam(team, data, lang) : null), [team, data, lang]);
  const before = current?.overall ?? null;
  const tournament = useMemo(() => rankTournamentTeams(data.tournamentTeams ?? [], team), [data.tournamentTeams, team]);
  const root = useRef<HTMLDivElement>(null);
  // Il tipo di ogni team da torneo: calcolato solo la prima volta che si apre la scheda (costa poco, ma sono 25 team)
  const [tournamentSeen, setTournamentSeen] = useState(false);
  if (tab === 'tournament' && !tournamentSeen) setTournamentSeen(true);
  const tournamentKinds = useMemo(() => {
    if (!tournamentSeen) return null;
    const rules = formatRules(format.formatId);
    return tournament.map(({ entry }) => {
      const found = teamArchetype(entry.team, rules);
      return found ? [t(`archetype.${found.archetype}`), ...found.styles.map(style => t(`teamStyle.${style}`))].join(' · ') : '';
    });
  }, [tournamentSeen, tournament, format.formatId, t]);

  // Le proposte del giro, dal calcolo in sottofondo: ognuna entra al suo posto nell'ordine finale
  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      shownSoFar.current = [];
    }
    // Un giro nuovo prende la pagina dopo le altre e la mostra; ripartendo (giro 0) le pagine di prima si buttano
    setPages(list => [...list.slice(0, round), []]);
    setPage(round);
    setBusy(true);
    setFailed(false);
    setExhausted(false);
    let live = true;
    let found = 0;
    const mode = choice.favorites ?? 'priority';
    const key = checksKey;
    const call = streamFill(team, choice, shownSoFar.current, format, data, proposal => {
      if (!live) return;
      found++;
      setPages(list => list.map((items, i) => (i === round ? insertSorted(items, proposal, mode) : items)));
      setChecksReady(key);
    });
    void call.done.then(done => {
      if (!live) return;
      setChecksReady(key);
      shownSoFar.current = done.shown;
      setBusy(false);
      setFailed(done.failed);
      setExhausted(done.exhausted);
      if (round === 0 && !done.failed) setAvailable(known => ({ ...known, [typeKey(choice.archetype)]: found > 0 }));
    });
    return () => { live = false; call.cancel(); };
  }, [resetKey, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verifica in sottofondo, un tipo alla volta, quali tipi hanno proposte con le altre scelte (una sola basta)
  useEffect(() => {
    if (lastChecks.current !== checksKey) {
      lastChecks.current = checksKey;
      setAvailable({});
    }
    if (checksReady !== checksKey || oneType) return;
    let live = true;
    let cancel: () => void = () => undefined;
    let index = 0;
    const next = () => {
      const archetype = TYPES[index++];
      if (!live || archetype === undefined) return;
      let found = false;
      const call = streamFill(team, { ...choice, archetype }, [], format, data, () => { found = true; }, { max: 1 });
      cancel = call.cancel;
      void call.done.then(done => {
        if (!live) return;
        // Calcolo rotto: non si sa, il tipo non si oscura
        if (!done.failed) setAvailable(known => ({ ...known, [typeKey(archetype)]: found }));
        next();
      });
    };
    next();
    return () => { live = false; cancel(); };
  }, [checksKey, checksReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tipo scelto vuoto: si passa al primo che ha proposte (finché il giocatore non sceglie da sé)
  useEffect(() => {
    if (chosenByHand.current || available[typeKey(pickState.archetype)] !== false) return;
    const first = TYPES.find(archetype => available[typeKey(archetype)] === true);
    if (first !== undefined) { setPick(c => ({ ...c, archetype: first })); setRound(0); }
  }, [available, pickState.archetype]);

  // Esc chiude anche col focus fuori dal pannello; clic fuori (pannello e pulsante esclusi) chiude
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      // I fogli fuori dal pannello (i dettagli di un Pokémon tenuto premuto, la loro ×) non contano come "fuori"
      if (target.closest?.('.tip-sheet, .tip-sheet-shade, .tip-sheet-close, .ftip, [data-sheet]')) return;
      if (!root.current?.contains(target) && !target.closest?.('[data-fill-toggle]')) onClose();
    };
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('pointerdown', away);
    // In cattura: Esc chiude il pannello e non arriva all'editor aperto sotto
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape, true); };
  }, [onClose]);
  // All'apertura il focus va sul tipo scelto
  useEffect(() => { root.current?.querySelector<HTMLElement>('.fill-types [aria-checked="true"], .fill-styles [aria-checked="true"]')?.focus(); }, []);

  const pick = (next: { archetype: Archetype | null; style: FillStyle | null }) => {
    if (next.archetype === pickState.archetype && next.style === pickState.style) return;
    if (next.archetype !== pickState.archetype) chosenByHand.current = true;
    if (next.style !== pickState.style) chosenByHand.current = false;
    setPick(next);
    setRound(0);
  };
  const toggleKeep = (index: number) => {
    setKeepState({ team, keep: keep.map((k, i) => (i === index ? !k : k)) });
    setRound(0);
  };
  const chooseFavorites = (mode: FavoriteMode) => {
    chosenByHand.current = false;
    setFavorites(mode);
    setRound(0);
  };
  // La migliore in assoluto (la prima del primo giro): bordo più chiaro e il suo Usa magenta, l'azione migliore
  const best = (i: number) => page === 0 && i === 0;
  const onlyFavorites = favorites === 'only';
  const setTitle = (set: TeamSet) => [
    battleName(set),
    set.item && gameName('item', set.item, lang),
    set.ability && gameName('ability', set.ability, lang),
    set.moves.filter(Boolean).map(move => gameName('move', move, lang)).join(', '),
  ].filter(Boolean).join(' · ');
  // Cosa cambia nel set di un membro: strumento, abilità, natura, EV, mosse (solo le parti diverse)
  const changeText = (was: TeamSet, now: TeamSet) => {
    const named = (kind: 'item' | 'ability', name: string) => (name ? gameName(kind, name, lang) : '—');
    const lines = [t('fill.changed', { name: battleName(now) })];
    if (was.item !== now.item) lines.push(`${t('editor.item')}: ${named('item', was.item)} → ${named('item', now.item)}`);
    const [ab1, ab2] = [battleAbility(was), battleAbility(now)];
    if (ab1 !== ab2) lines.push(`${t('editor.ability')}: ${named('ability', ab1)} → ${named('ability', ab2)}`);
    if (was.nature !== now.nature) lines.push(`${t('editor.nature')}: ${natureName(was.nature, lang)} → ${natureName(now.nature, lang)}`);
    if (evsText(was, lang) !== evsText(now, lang)) lines.push(`${t('editor.evs')}: ${evsText(was, lang)} → ${evsText(now, lang)}`);
    const moves = (set: TeamSet) => set.moves.filter(Boolean);
    if ([...moves(was)].sort().join() !== [...moves(now)].sort().join()) {
      lines.push(`${t('editor.moves')}: ${moves(now).map(move => gameName('move', move, lang)).join(', ')}`);
    }
    return lines.join('\n');
  };
  // Il perché di una proposta, in una riga corta: l'area che guadagna di più e i Ruoli coperti se salgono (altrimenti la
  // seconda area); col team vuoto le due aree più forti. Solo dai numeri che la proposta porta già, niente calcoli nuovi
  const why = (proposal: Proposal): { label: string; value: string; gain: boolean }[] => {
    const areas = proposal.areas.filter(area => !area.inactive && area.value !== null);
    if (!current) {
      return [...areas].sort((a, b) => b.value! - a.value!).slice(0, 2)
        .map(area => ({ label: t(`area.${area.key}`), value: String(area.value), gain: false }));
    }
    const gains = areas.flatMap(area => {
      const was = current.areas.find(other => other.key === area.key);
      const change = was?.value != null && !was.inactive ? area.value! - was.value : 0;
      return change > 0 ? [{ label: t(`area.${area.key}`), value: `+${change}`, gain: true, change }] : [];
    }).sort((a, b) => b.change - a.change);
    const parts = gains.slice(0, 1);
    const roles = proposal.roles.covered > current.roles.covered
      ? { label: t('area.roles'), value: `${proposal.roles.covered}/${proposal.roles.total}`, gain: false, change: 0 } : gains[1];
    return roles ? [...parts, roles] : parts;
  };
  const gapText = (gap: Gap) => gap.kind === 'weakness'
    ? t(gap.count > 3 ? 'fill.gap.weaknessMany' : 'fill.gap.weakness', { n: gap.count, type: typeName(gap.type, lang) })
    : t(`fill.gap.${gap.kind}`);
  // `icon`: il simbolo della testata del tooltip (il migliore la coppa, i tipi di team il team, senza stile la nuvola).
  // `note`: la spiegazione della scelta, non scritta sotto il nome (la colonna resta corta e le proposte partono più in
  // alto): nel tooltip DreamDex col mouse e col fuoco, e per i lettori di schermo nella descrizione (testo nascosto qui)
  const radio = (key: string, checked: boolean, label: string, onClick: () => void, note?: string, disabled = false, icon: IconName = 'team') => (
    <button key={key} type="button" role="radio" aria-checked={checked} disabled={disabled} aria-label={label}
      aria-describedby={note ? `${ids}-${key}` : undefined}
      className={`fill-option${disabled ? ' empty' : ''}`} onClick={onClick} {...(note ? optionTip.bind({ label, note, icon }) : {})}>
      <strong>{label}</strong>
      {note && <small id={`${ids}-${key}`} hidden>{note}</small>}
    </button>
  );
  const status = busy ? t('fill.busy')
    : failed ? t('fill.failed')
    : onlyFavorites && round === 0 && proposals.length === 0 ? t('fill.favoritesNone')
    : onlyFavorites && exhausted ? t('fill.favoritesFew')
    : proposals.length === 0 && round === 0 ? t('fill.none')
    : exhausted ? t('fill.noMore') : '';

  // Schede: frecce e Home/Fine passano dall'una all'altra
  const tabs: Tab[] = ['proposals', 'tournament'];
  const tabKeys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = tabs.indexOf(tab);
    const next = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? tabs[1 - at]
      : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[1] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    root.current?.querySelector<HTMLElement>(`#${CSS.escape(`${ids}-tab-${next}`)}`)?.focus();
  };
  // Il riassunto delle scelte sul telefono: "The best · Any · Favourites first", e quanti dei tuoi hai fissato (se ce n'è)
  const locked = keep.filter(Boolean).length;
  const summary = [
    // Doppio: un tipo solo, la riga non lo nomina
    ...(oneType ? [] : [pickState.archetype ? t(`archetype.${pickState.archetype}`) : t('fill.best')]),
    pickedStyle ? t(`teamStyle.${pickedStyle}`) : t('fill.noStyle'),
    t(`fill.fav.${favorites}`),
    ...(locked ? [t('fill.locked', { n: locked })] : []),
  ].join(' · ');
  const tabButton = (id: Tab, label: string, count?: number) => (
    <button type="button" role="tab" id={`${ids}-tab-${id}`} aria-selected={tab === id} aria-controls={`${ids}-panel-${id}`}
      tabIndex={tab === id ? 0 : -1} className="fill-tab" onClick={() => setTab(id)} onKeyDown={tabKeys}>
      {label}
      {count !== undefined && <span className="fill-tab-count">{count}</span>}
    </button>
  );

  return (
    <div className="fill-panel" role="dialog" aria-modal="false" aria-label={t('fill.title')} ref={root}>
      <div className="fill-top">
        {/* Telefono: il titolo e la × in testa (a tutto schermo non c'è un "fuori" da toccare per chiudere) */}
        <p className="fill-title" aria-hidden="true">{t('fill.title')}</p>
        <button type="button" className="fill-close" aria-label={t('combobox.close')} onClick={onClose}><Icon name="close" /></button>
        <div className="fill-tabs" role="tablist" aria-label={t('fill.title')}>
          {tabButton('proposals', t('fill.tabProposals'))}
          {tabButton('tournament', t('fill.tabTournament'), data.tournamentTeams?.length ?? 0)}
        </div>
        {/* Il pannello copre la carta del voto: il voto di adesso resta qui, da confrontare con quello delle proposte */}
        {current && (
          <p className="fill-now" title={t('fill.nowTitle', { grade: current.grade, n: current.overall })}>
            <span className="visually-hidden">{t('fill.nowTitle', { grade: current.grade, n: current.overall })}</span>
            <span aria-hidden="true">{t('fill.now')} <strong>{current.grade}</strong> {current.overall}</span>
          </p>
        )}
      </div>

      {/* Le proposte restano montate (e il calcolo va avanti) anche guardando i team da torneo */}
      <div className="fill-body" role="tabpanel" id={`${ids}-panel-proposals`} aria-labelledby={`${ids}-tab-proposals`} hidden={tab !== 'proposals'}>
        {/* Telefono: una riga che riassume le scelte e apre il foglio unico delle impostazioni (le proposte restano in vista) */}
        {phone && (
          <div className="fill-summary">
            <span className="fill-summary-text">{summary}</span>
            <button type="button" className="fill-settings-button" ref={settingsButton} aria-haspopup="dialog" aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(o => !o)}><Icon name="gear" />{t('fill.settings')}</button>
          </div>
        )}
        {/* Le impostazioni: sul computer accanto alle proposte come sempre (il contenitore non conta), sul telefono nel foglio */}
        <div className="fill-settings" ref={settingsSheet} role={phone ? 'dialog' : undefined} aria-label={phone ? t('fill.settings') : undefined}
          popover={phone && supportsPopover ? 'manual' : undefined}>
          {phone && (
            <div className="fill-settings-head">
              <strong>{t('fill.settings')}</strong>
              <button type="button" className="fill-close" aria-label={t('combobox.close')} onClick={() => setSettingsOpen(false)}><Icon name="close" /></button>
            </div>
          )}
          {team.length > 0 && (
            <fieldset className="fill-mine">
              <legend className="fill-head">{t('fill.mine')}</legend>
              <div className="fill-mine-row">
                {team.map((set, i) => (
                  <label key={`${set.species}#${i}`} className={`fill-keep${keep[i] ? ' is-locked' : ''}`} {...memberTip.bind(set)}>
                    {/* Una casella vera (tastiera, lettori di schermo), a vista il lucchetto chiuso o aperto */}
                    <input type="checkbox" className="visually-hidden" checked={keep[i]} aria-label={t('fill.keepN', { name: battleName(set) })} onChange={() => toggleKeep(i)} />
                    <PokemonIcon name={battleName(set)} />
                    <span className="fill-keep-name">{battleName(set)}</span>
                    <Icon name={keep[i] ? 'lock' : 'unlock'} filled={keep[i]} />
                  </label>
                ))}
              </div>
              <p className="fill-note">{t('fill.mineNote')}</p>
            </fieldset>
          )}

          <div className="fill-side">
            {!oneType && (
            <div className="fill-group">
              <span className="fill-head" aria-hidden="true">{t('fill.type')}</span>
              <div className="fill-types" role="radiogroup" aria-label={t('fill.type')}>
                {TYPES.map(archetype => radio(typeKey(archetype), pickState.archetype === archetype,
                  archetype ? t(`archetype.${archetype}`) : t('fill.best'),
                  () => pick({ ...pickState, archetype }),
                  archetype ? t(`archetype.${archetype}.note`) : t('fill.bestNote'),
                  available[typeKey(archetype)] === false && pickState.archetype !== archetype, archetype ? 'team' : 'trophy'))}
              </div>
            </div>
            )}
            <div className="fill-group">
              <span className="fill-head" aria-hidden="true">{t('fill.style')}</span>
              <div className="fill-styles" role="radiogroup" aria-label={t('fill.style')}>
                {radio('none', pickedStyle === null, t('fill.noStyle'), () => pick({ ...pickState, style: null }), t('fill.noStyleNote'), false, 'cloud')}
                {styles.map((style: FillStyle) => radio(style, pickedStyle === style, t(`teamStyle.${style}`), () => pick({ ...pickState, style })))}
              </div>
            </div>
            <div className="fill-group">
              <label className="fill-head" htmlFor={`${ids}-favorites`}>{t('fill.favorites')}</label>
              <select id={`${ids}-favorites`} className="fill-favorites" value={favorites} aria-describedby={`${ids}-favorites-note`}
                onChange={e => chooseFavorites(e.target.value as FavoriteMode)}>
                {FAVORITE_MODES.map(mode => <option key={mode} value={mode} title={t(`fill.fav.${mode}Note`)}>{t(`fill.fav.${mode}`)}</option>)}
              </select>
              <p className="fill-note" id={`${ids}-favorites-note`}>{t(`fill.fav.${favorites}Note`)}</p>
            </div>
          </div>
        </div>

        {optionTip.anchor && (
          <FloatTip rect={optionTip.anchor.rect} tone="var(--accent)" className="tip-w-s fill-option-tip" side>
            {/* La frase che spiega l'opzione è la riga sotto il titolo (niente corpo senza righe) */}
            <TipHead lead={<TipGlyph icon={optionTip.anchor.key.icon} />} title={optionTip.anchor.key.label} sub={optionTip.anchor.key.note} />
          </FloatTip>
        )}

        <div className="fill-main">
          <ol className="fill-proposals">
            {shown.map((proposal, i) => (
              <li key={proposal.added.map(s => `${s.species}@${s.item}`).join('|')} className={`fill-row fill-proposal arch-${proposal.archetype}${best(i) ? ' is-best' : ''}`}>
                <span className="fill-mons">
                  {proposal.team.map((set, j) => {
                    const mine = j < team.length;
                    const changed = mine && proposal.changed.includes(j);
                    const favorite = !mine && isUserFavorite(set, data.userLists);
                    const title = changed ? changeText(team[j], set) : setTitle(set);
                    return (
                      <span key={`${set.species}#${j}`} {...memberTip.bind(set, changed ? team[j] : undefined)}
                        // I colori dei tipi: sul telefono la casella di un Pokémon nuovo prende il colore del suo tipo, come le carte del team
                        style={{ '--t1': typeColor(battleSpecies(set)?.types[0] ?? ''), '--t2': typeColor(battleSpecies(set)?.types[1] ?? battleSpecies(set)?.types[0] ?? '') } as CSSProperties}
                        data-tap-tip
                        className={`fill-mon ${mine ? 'is-mine' : 'is-new'}${changed ? ' is-changed' : ''}${favorite ? ' is-favorite' : ''}`}>
                        <span className="fill-mon-sprite">
                          <Sprite species={set.species} item={set.item} size={48} />
                          {changed && <span className="fill-mon-mark is-edit" role="img" aria-label={title}><Icon name="edit" /></span>}
                          {favorite && <span className="fill-mon-mark is-fav" role="img" aria-label={t('fill.favorite', { name: battleName(set) })}><Icon name="heart" /></span>}
                        </span>
                        <span className="fill-mon-name">{battleName(set)}</span>
                      </span>
                    );
                  })}
                </span>
                <span className="fill-about">
                  <span className="fill-kind">
                    {[t(`archetype.${proposal.archetype}`), ...proposal.styles.map(style => t(`teamStyle.${style}`))].join(' · ')}
                  </span>
                  {why(proposal).length > 0 && (
                    <span className="fill-why" title={t(current ? 'fill.whyTitle' : 'fill.strongTitle')}>
                      {why(proposal).map((part, k) => (
                        <span key={part.label}>{k > 0 && <span className="visually-hidden">, </span>}{part.label} <b className={part.gain ? 'up' : undefined}>{part.value}</b></span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="fill-result">
                  <span className={`fill-grade grade-${proposal.grade}`}><strong>{proposal.grade}</strong> {proposal.overall}</span>
                  {before !== null && proposal.overall !== before && (
                    <span className={`fill-delta ${proposal.overall > before ? 'up' : 'down'}`}>
                      {proposal.overall > before ? '+' : '−'}{Math.abs(proposal.overall - before)}
                    </span>
                  )}
                </span>
                <button type="button" className={`fill-add${best(i) ? ' primary' : ''}`} aria-label={t('fill.useN', { n: i + 1 })} onClick={() => onApply(proposal)}>
                  {t('fill.use')}
                </button>
                {proposal.gaps.length > 0 && (
                  <p className="fill-gaps"><Icon name="warning" /> {proposal.gaps.map(gapText).join(' · ')}</p>
                )}
              </li>
            ))}
            {/* Sempre PROPOSALS_PER_ROUND posti: la lista non cambia altezza. Lo scheletro ha le parti di una riga vera (il
                tuo team già al suo posto, i nuovi ancora da arrivare) e ogni proposta che arriva ne prende il posto; finito il
                calcolo, e nelle pagine dei giri già finiti, righe vuote */}
            {Array.from({ length: Math.max(0, PROPOSALS_PER_ROUND - shown.length) }, (_, i) => (
              <li key={`slot-${i}`} aria-hidden="true" className={`fill-row ${busy && watching ? 'fill-skeleton' : 'fill-placeholder'}`}>
                <span className="fill-mons">
                  {Array.from({ length: 6 }, (_, j) => (
                    <span key={j} className={`fill-mon ${j < team.length ? 'is-mine' : 'is-new'}`}>
                      <span className="fill-mon-sprite">
                        {j < team.length ? <Sprite species={team[j].species} item={team[j].item} size={48} /> : <span className="fill-bone-mon" />}
                      </span>
                      <span className="fill-mon-name">{j < team.length ? battleName(team[j]) : <span className="fill-bone-text" />}</span>
                    </span>
                  ))}
                </span>
                <span className="fill-kind fill-bone">{'\u00a0'}</span>
                <span className="fill-result">
                  <span className="fill-grade"><strong className="fill-bone">{'\u00a0'}</strong></span>
                </span>
                <button type="button" className="fill-add fill-bone" tabIndex={-1} disabled>{'\u00a0'}</button>
              </li>
            ))}
          </ol>
          {/* Telefono: al posto delle righe vuote (nascoste), mentre calcola, una riga sola con Eevee che ci pensa */}
          {busy && watching && (
            <div className="fill-think" aria-hidden="true"><EeveeMoment pose="thinking" /><span>{t('fill.thinking')}</span></div>
          )}
          <div className="fill-foot">
            <p className="fill-status" role="status" aria-live="polite">{status}</p>
            {banned > 0 && <p className="banned-note">{t(banned === 1 ? 'lists.bannedExcludedOne' : 'lists.bannedExcluded', { n: banned })}</p>}
            {/* Giri già calcolati: ‹ 2/3 ›, come la paginazione dei candidati; le frecce non ricalcolano niente */}
            <nav className="pager fill-pager" aria-label={t('fill.pages')}>
              <button type="button" className="step" aria-label={t('fill.prev')} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <Icon name="prev" />
              </button>
              <span className="pager-count" aria-live="polite" aria-atomic="true">
                <span className="visually-hidden">{t('fill.page', { n: page + 1, total: pages.length })}</span>
                <span aria-hidden="true">{page + 1}/{pages.length}</span>
              </span>
              <button type="button" className="step" aria-label={t('fill.next')} disabled={page >= pages.length - 1} onClick={() => setPage(p => p + 1)}>
                <Icon name="next" />
              </button>
            </nav>
            <button type="button" className="fill-more" disabled={busy || exhausted} onClick={() => setRound(r => r + 1)}>{t('fill.more')}</button>
          </div>
        </div>
      </div>

      <div className="fill-tournament" role="tabpanel" id={`${ids}-panel-tournament`} aria-labelledby={`${ids}-tab-tournament`} hidden={tab !== 'tournament'}>
        {tournament.length === 0 ? <p className="fill-empty">{t('fill.tournamentNone')}</p> : <>
          <p className="fill-note">{t('fill.tournamentNote')}</p>
          <ul className="fill-cards">
            {tournament.map(({ entry, shared }, i) => {
              const kind = tournamentKinds?.[i];
              // Senza nome: quello dell'autore; senza nessuno dei due, un trattino
              const title = entry.name || (entry.author ? t('fill.teamBy', { author: entry.author }) : '');
              // Prima dei team senza Pokémon in comune, una riga che li separa da quelli che ne hanno
              const others = i > 0 && shared.length === 0 && tournament[i - 1].shared.length > 0;
              return [
                others && <li key="others" className="fill-cards-sep" aria-hidden="true"><span>{t('fill.otherTeams')}</span></li>,
                <li key={`${entry.name}#${i}`} className={`fill-card${shared.length ? ' has-shared' : ''}`}>
                  <span className="fill-card-head">
                    <strong className="fill-card-name" title={title}>{title || '—'}</strong>
                    {shared.length
                      ? <span className="fill-card-shared">{t('fill.shared', { n: shared.length })}</span>
                      : <span className="fill-card-none">{t('fill.sharedNone')}</span>}
                  </span>
                  <span className="fill-card-mons">
                    {entry.team.map((set, j) => {
                      const name = battleName(set);
                      const favorite = isUserFavorite(set, data.userLists);
                      return (
                        <span key={`${name}#${j}`} className={`fill-card-mon${shared.includes(j) ? ' is-shared' : ''}`} {...memberTip.bind(set)}
                          role="img" aria-label={favorite ? t('fill.favorite', { name }) : name}>
                          <Sprite species={set.species} item={set.item} size={48} />
                          {favorite && <span className="fill-mon-mark is-fav"><Icon name="heart" /></span>}
                        </span>
                      );
                    })}
                  </span>
                  <span className="fill-card-foot">
                    {kind && <span className="fill-kind">{kind}</span>}
                    {entry.author && <span className="fill-card-by">{t('fill.by', { author: entry.author })}</span>}
                    <button type="button" className="fill-load" aria-label={title ? t('fill.loadN', { name: title }) : t('fill.load')}
                      onClick={() => onLoadTeam(entry.team)}>{t('fill.load')}</button>
                  </span>
                </li>,
              ];
            })}
          </ul>
        </>}
      </div>
      {memberTip.tip}
    </div>
  );
}
