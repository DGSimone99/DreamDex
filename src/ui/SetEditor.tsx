import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { battleSpecies, dex, getMove, getSpecies, itemNames, moveNames, natureNames, toID } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { formatName, STAT_IDS, type Preset, type StatID, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';
import type { Pokedex } from '../engine/formats';
import type { GameId } from '../engine/games';
import type { CommonChoice, CommonChoices, CommonSpread } from '../engine/common';
import { formatPercent, type Lang } from '../i18n';
import { gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { hint, KitTipBody, kitTip, MoveTipBody } from './MoveTip';
import { describe } from './describe';
import { SpeedMeta } from './SpeedLine';
import type { SpeedTier } from '../engine/speed';
import { EV_TOTAL, evTotal, ivOf, statLines } from '../engine/statCalc';
import { TypeChip, typeColor } from './Sprite';
import { NatureArrow } from './NatureArrow';
import { ItemIcon } from './ItemIcon';
import { Icon } from './icons';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';
import { SetMenu } from './SetMenu';
import { EDITOR_TABS_QUERY, useMediaQuery } from './useMediaQuery';
import { useSwipeTabs } from './useSwipeTabs';
import { typeTextColor } from './TypeText';
import { MoveTail, moveTint } from './MovePill';
import { CategoryIcon } from './CategoryIcon';
import { StatIcon } from './StatIcon';
import { typeIconUrl } from './typeIcons';

function NatureEffect({ name }: { name: string }) {
  const lang = useLang();
  const t = useT();
  const { plus, minus } = dex.natures.get(name);
  if (!plus || !minus) return <span className="nature-fx neutral">{t('editor.neutral')}</span>;
  return (
    // Le freccette di Pokémon Champions (su verde, giù rossa); il segno resta nel testo per chi legge senza vedere
    <span className="nature-fx">
      <span className="up"><NatureArrow dir="up" /><span className="visually-hidden">+</span>{statShort(plus as StatID, lang)}</span>{' '}
      <span className="down"><NatureArrow dir="down" /><span className="visually-hidden">−</span>{statShort(minus as StatID, lang)}</span>
    </span>
  );
}


/** Casella IV (0–31): mentre scrivi tiene il testo (anche vuoto), lo applica subito; vuota torna a 31 uscendo. */
/**
 * La casella degli IV. A 31 (quasi sempre) è fuori dal giro del Tab, così il Tab passa da un EV all'altro: ci si arriva
 * con la freccia destra dalla casella EV della riga (e la sinistra riporta lì). Un IV diverso da 31 resta nel giro.
 */
/**
 * Una voce dell'intestazione con la sua spiegazione (EV, IV): sottolineata a puntini, il fumetto al passaggio del mouse.
 * Solo a vista: per i lettori di schermo le caselle hanno già il loro nome.
 */
function HeadHelp({ text, className, end = false, children }: { text: string; className: string; end?: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span className={`head-help ${className}${end ? ' end' : ''}`} aria-hidden="true" onPointerEnter={() => setShown(true)} onPointerLeave={() => setShown(false)}>
      {children}
      <span className="hint-bubble help-bubble" hidden={!shown}>{text}</span>
    </span>
  );
}

function IvInput({ value, label, tip, onChange }: { value: number; label: string; tip: string; onChange: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      // A 31 (il solito) il numero resta quieto, senza casella: si nota solo un IV cambiato
      className={`iv-input${value === 31 && draft === null ? ' max' : ''}`}
      min={0}
      max={31}
      value={draft ?? value}
      tabIndex={value === 31 && draft === null ? -1 : undefined}
      aria-label={label}
      aria-keyshortcuts="ArrowLeft"
      {...hint(tip)}
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        e.currentTarget.closest('.stat-row')?.querySelector<HTMLInputElement>('.ev-input')?.focus();
      }}
      onChange={e => { setDraft(e.target.value); if (e.target.value !== '') onChange(e.target.value); }}
      onBlur={() => { if (draft === '') onChange(''); setDraft(null); }}
    />
  );
}


/**
 * Categoria, potenza, precisione e tipo di una mossa. `inField`: nella testata del campo, dove categoria, potenza e tipo
 * li mostra già la pillola (tessera e coda): resta la precisione, categoria e potenza solo per i lettori di schermo.
 */
function MoveDetail({ name, inField = false }: { name: string; inField?: boolean }) {
  const t = useT();
  const move = getMove(name);
  if (!move) return null;
  const accuracy = move.accuracy === true ? null : move.accuracy;
  const category = t(`editor.category.${move.category}`);
  return (
    <span className="move-meta">
      <span className={`move-stat cat-${move.category.toLowerCase()}`} {...(inField ? {} : hint(category))}>
        {/* Nel campo il simbolo sta nella coda della pillola: qui resta solo per i lettori di schermo */}
        {!inField && <CategoryIcon category={move.category} />}
        {/* Mosse di stato (e a potenza variabile): solo l'icona della categoria, niente "—" */}
        {move.basePower > 0
          ? (inField
            ? <span className="visually-hidden">{category}, {t('editor.power')} {move.basePower}</span>
            : <><span className="visually-hidden">{category}, {t('editor.power')} </span>{move.basePower}</>)
          : <span className="visually-hidden">{category}</span>}
      </span>
      {/* Mosse che non mancano mai: niente precisione invece di "—" */}
      {accuracy !== null && (
        <span className="move-stat accuracy" {...(inField ? {} : hint(t('editor.accuracy')))}>
          <Icon name="target" />
          <span className="visually-hidden">{t('editor.accuracyShort')} </span>
          {`${accuracy}%`}
        </span>
      )}
      {!inField && <TypeChip type={move.type} />}
    </span>
  );
}

/** La tessera del tipo nel campo di una mossa (vuota e neutra senza mossa o con una mossa inventata). */
function MoveTile({ name }: { name: string }) {
  const type = getMove(name)?.type;
  const icon = type ? typeIconUrl(type) : undefined;
  return <span className="mvp-ic" style={{ '--c': moveTint(name) } as CSSProperties}>{icon && <img src={icon} alt="" draggable={false} />}</span>;
}

// Voci dei menu, calcolate una volta per lingua
const moveOptionCache = new Map<string, ComboOption>();
function moveOption(name: string, lang: Lang): ComboOption {
  const key = `${lang}:${name}`;
  let option = moveOptionCache.get(key);
  if (!option) {
    const move = getMove(name);
    option = {
      value: name,
      label: gameName('move', name, lang),
      alias: name,
      detail: <MoveDetail name={name} />,
      description: describe.move(name, lang),
      color: move ? typeTextColor(move.type) : undefined,
    };
    moveOptionCache.set(key, option);
  }
  return option;
}
const ALL_MOVES = moveNames();
/** Il tooltip di una voce del menu di strumenti o abilità (di lato alla voce attiva), come quello delle mosse. */
const kitTipOf = (kind: 'item' | 'ability') => (option: ComboOption) =>
  (option.value ? { tone: 'var(--accent)', content: <KitTipBody kind={kind} name={option.value} />, className: 'move kit' } : null);
const itemTipOf = kitTipOf('item');
const abilityTipOf = kitTipOf('ability');
/** Il tooltip di una voce del menu delle mosse (di lato alla voce attiva). */
const moveTipOf = (option: ComboOption) => {
  const move = getMove(option.value);
  return move ? { tone: typeColor(move.type), content: <MoveTipBody name={move.name} />, className: 'move' } : null;
};
const ITEMS = itemNames();
const ALL_ABILITIES = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.name).sort();
const abilityOption = (name: string, lang: Lang): ComboOption =>
  ({ value: name, label: gameName('ability', name, lang), alias: name, description: describe.ability(name, lang) });

/** Natura ed EV come chiave, per riconoscere lo spread attuale. */
const spreadKey = (s: Pick<CommonSpread, 'nature' | 'evs'>) => `${s.nature}:${STAT_IDS.map(stat => s.evs[stat] ?? 0).join('/')}`;
/** "252 Att / 252 Vel / 4 PS": prima gli EV più alti. */
const spreadText = (s: Pick<CommonSpread, 'evs'>, lang: Lang) =>
  STAT_IDS.filter(stat => (s.evs[stat] ?? 0) > 0)
    .sort((a, b) => (s.evs[b] ?? 0) - (s.evs[a] ?? 0))
    .map(stat => `${s.evs[stat]} ${statShort(stat, lang)}`).join(' / ') || '—';

/** Passo degli EV nei campi e nel cursore. */
const EV_STEP = 2;

// EV interi tra 0 e 252: un numero con la virgola o fuori scala scritto a mano non entra nel set
const clampEv = (value: number) => Math.min(252, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0));

interface Props {
  set: TeamSet;
  /** Set con nome delle analisi Smogon (al massimo 5). */
  presets?: Preset[];
  /** Limite di generazione: mosse e abilità legali fino a questa gen. */
  genLimit: number;
  /** Pokédex del formato: con Scarlatto/Violetto ('sv') solo mosse e strumenti che esistono lì. */
  pokedex?: Pokedex;
  /** Gioco scelto: solo le mosse che nel gioco si imparano. */
  game?: GameId | null;
  /** Scelte più usate del membro, mostrate in cima ai menu. */
  common?: CommonChoices;
  /** Nome del formato se vieta il Tera: niente lastra del Tera, la Natura prende la riga (il valore resta salvato). */
  teraBannedIn?: string;
  /** Velocità del membro tra i più usati del meta (null senza statistiche). */
  speed?: SpeedTier | null;
  /** Nome e tipi del membro, a sinistra nella riga in testa. */
  title?: ReactNode;
  /** Pulsanti a destra nella riga in testa, dopo il pulsante Set (Copia il set, Chiudi). */
  actions?: ReactNode;
  /** Quale preset dà al team il voto più alto (posizione in `presets`), chiesto aprendo il menu Set. */
  bestIndex?: () => number | null;
  /** Applica il preset migliore completato e ritoccato (come faceva "Preset migliore"). */
  onBest?: () => void;
  /** Apre il riquadro del testo Showdown del set (Incolla testo nel menu Set). */
  onText?: () => void;
  /** Il link alla pagina Smogon, in fondo al menu Set. */
  smogonLink?: ReactNode;
  /** Accanto ai ruoli, in basso a destra (Sostituisci). */
  memberAction?: ReactNode;
  /** Sotto la testata: i problemi del membro detti per esteso, con la via d'uscita. */
  notice?: ReactNode;
  /** Il riquadro del Testo del set, aperto: copre le Statistiche, così Set e Mosse restano in vista per confrontare. */
  textPanel?: ReactNode;
  /** Copia il set negli appunti (testo Showdown): sul telefono sta nel menu Set; vero se è riuscito. */
  onCopy?: () => Promise<boolean>;
  /** Sotto le Mosse, la Sfida contro un avversario scelto (EditorDuel). */
  duel?: ReactNode;
  /** Tutti i ruoli del membro, il principale per primo: il riquadro in fondo all'editor. */
  roles?: string[];
  /** La spiegazione di ogni ruolo (stesso ordine di `roles`), nel tooltip. */
  roleTips?: (string | undefined)[];
  /** Slot di mossa evidenziato perché il coach propone di cambiarlo. */
  proposedSlot?: number;
  /** Strumento, abilità e mosse fuori regola: segnati sul loro campo, non solo sulla carta. */
  flags?: FieldFlags;
  /** Strumento vietato nel formato: nel menu in fondo, con l'etichetta Vietato. */
  itemBanned?: (name: string) => boolean;
  /** Telefono: apre l'editor su questa scheda (la Sfida, arrivando da "lascialo a"); `key` cambia a ogni richiesta. */
  startTab?: { tab: 'set' | 'stats' | 'duel'; key: number } | null;
  onChange: (set: TeamSet) => void;
  /** Set cambiato per intero (preset, I miei set, spread più usati): chi lo riceve offre Annulla; se manca, va a `onChange`. */
  onSetChange?: (set: TeamSet) => void;
}

/** Un campo fuori regola (vietato dal formato o non legale per la specie), segnato in rosso:
 *  `label` la parola breve sul campo, `text` la frase intera per i lettori di schermo. */
export type FieldFlag = { label: string; text: string; /** Sulle mosse: la mossa da mettere al posto (un clic la scambia). */ swap?: string };
/** I campi fuori regola del membro: strumento, abilità e le quattro mosse (per posizione). */
export type FieldFlags = { item?: FieldFlag; ability?: FieldFlag; moves?: (FieldFlag | undefined)[] };

export function SetEditor({ set, presets = [], genLimit, pokedex = 'natdex', game = null, common, teraBannedIn, speed, title, actions, bestIndex, onBest, onText, onCopy, smogonLink, memberAction, notice, textPanel, duel, roles, roleTips, proposedSlot, flags, startTab, itemBanned, onChange, onSetChange = onChange }: Props) {
  const t = useT();
  const lang = useLang();
  // Le più usate vanno in cima al menu, con la quota d'uso (o "Preset" se vengono dalle analisi)
  const withCommon = (options: ComboOption[], choices: CommonChoice[] | undefined): ComboOption[] => {
    if (!choices?.length) return options;
    const byValue = new Map(options.map(o => [o.value, o]));
    const top = choices.flatMap(c => {
      const option = byValue.get(c.name);
      return option ? [{
        ...option,
        common: c.share === null ? t('combobox.preset') : formatPercent(lang, c.share, 0),
        ...(c.share === null ? { commonTitle: t('combobox.presetTitle') } : {}),
      }] : [];
    });
    const picked = new Set(top.map(o => o.value));
    return [...top, ...options.filter(o => !picked.has(o.value))];
  };
  const commonKey = JSON.stringify(common ?? null);
  // Quote da un altro formato (es. Pokémon vietato): l'intestazione dice da quale
  const sourceLabel = common?.source ? t('combobox.commonIn', { format: formatName(common.source) }) : undefined;
  // Senza statistiche le scelte in cima vengono dai preset Smogon: l'intestazione lo dice (non "Più usati")
  const commonLabel = (choices?: { share: number | null }[]) =>
    sourceLabel ?? (choices?.length && choices.every(c => c.share === null) ? t('combobox.fromPresets') : undefined);
  const shareLabel = (c: { share: number | null }) => (c.share === null ? t('combobox.preset') : formatPercent(lang, c.share, 0));
  const custom = !!set.customSkillset;
  const species = getSpecies(set.species);
  const standard = legalAbilities(set.species, genLimit)
    ?? (species ? (Object.values(species.abilities).filter(Boolean) as string[]) : []);
  // L'abilità attuale resta visibile anche se non legale (viene segnalata nello slot)
  const abilities = set.ability && !standard.includes(set.ability) ? [set.ability, ...standard] : standard;
  const abilityOptions = useMemo(
    () => withCommon((custom ? ALL_ABILITIES : abilities).map(name => abilityOption(name, lang)), common?.abilities),
    [custom, abilities.join(), lang, commonKey],
  );
  // Mosse proposte: solo quelle imparabili, tranne con Custom Skillset
  const moveOptions = useMemo(() => {
    const legal = custom ? null : legalMoves(set.species, genLimit, game);
    const names = (legal ? [...legal].map(id => getMove(id)?.name ?? id).sort() : ALL_MOVES)
      .filter(name => pokedex !== 'sv' || !getMove(name)?.isNonstandard);
    return withCommon(names.map(name => moveOption(name, lang)), common?.moves);
  }, [custom, set.species, genLimit, pokedex, game, lang, commonKey]);
  // Strumenti: in ordine alfabetico nella lingua scelta; niente Megapietre, cristalli Z e strumenti di altri Pokémon
  // (con Custom Skillset sì, e quello già nel set resta); quelli vietati nel formato in fondo, con l'etichetta Vietato
  const forOthers = (name: string) => {
    const users = dex.items.get(name).itemUser;
    const me = getSpecies(set.species);
    if (!users?.length || !me) return false;
    return !users.some(user => user === me.name || getSpecies(user)?.baseSpecies === me.baseSpecies);
  };
  const itemOptions = useMemo<ComboOption[]>(() => {
    const options = ITEMS
      .filter(name => (pokedex !== 'sv' || !dex.items.get(name).isNonstandard) && (custom || name === set.item || !forOthers(name)))
      .map(name => {
        const banned = !!itemBanned?.(name);
        return {
          value: name, label: gameName('item', name, lang), alias: name, description: describe.item(name, lang), icon: <ItemIcon item={name} />,
          ...(banned ? { detail: <span className="opt-banned">{t('editor.flagBannedItem')}</span> } : {}), banned,
        };
      })
      .sort((a, b) => Number(a.banned) - Number(b.banned) || a.label.localeCompare(b.label, lang))
      .map(({ banned: _banned, ...option }) => option);
    return withCommon(options, common?.items);
  }, [pokedex, lang, commonKey, set.species, custom, set.item, itemBanned]); // eslint-disable-line react-hooks/exhaustive-deps
  const natureOptions = useMemo<ComboOption[]>(() => withCommon(natureNames().map(name => {
    const { plus, minus } = dex.natures.get(name);
    const label = natureName(name, lang);
    return {
      value: name,
      label,
      alias: name,
      detail: <NatureEffect name={name} />,
      ariaLabel: plus && minus
        ? `${label} (+${statShort(plus as StatID, lang)}, −${statShort(minus as StatID, lang)})`
        : `${label} (${t('editor.neutral')})`,
    };
  }), common?.natures), [lang, t, commonKey]);
  const teraOptions = useMemo<ComboOption[]>(() => withCommon([
    { value: '', label: t('editor.none'), ariaLabel: t('editor.none') },
    ...TYPES.map(type => ({ value: type, label: typeName(type, lang), alias: type, content: <TypeChip type={type} />, ariaLabel: typeName(type, lang) })),
  ], common?.teraTypes), [lang, t, commonKey]);
  const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
  // Una mossa già scelta in un altro slot resta nel menu, grigia e non selezionabile
  const movesKey = moves.join('|');
  const moveOptionsFor = useMemo(() => moves.map((_, slot) => {
    const others = new Set(moves.filter((move, i) => i !== slot && move).map(toID));
    return others.size ? moveOptions.map(option => (others.has(toID(option.value)) ? { ...option, disabled: true } : option)) : moveOptions;
  }), [moveOptions, movesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (patch: Partial<TeamSet>) => onChange({ ...set, ...patch });
  const [evMax, setEvMax] = useState(false);
  const evMaxTimer = useRef(0);
  const flashEvMax = () => { setEvMax(true); window.clearTimeout(evMaxTimer.current); evMaxTimer.current = window.setTimeout(() => setEvMax(false), 2500); };
  useEffect(() => () => window.clearTimeout(evMaxTimer.current), []);
  const itemDesc = describe.item(set.item, lang);
  // Con la megapietra l'abilità è quella della Mega: si mostra bloccata, quella del set torna togliendo la pietra
  const forme = battleSpecies(set);
  const megaAbility = forme && species && forme.name !== species.name ? forme.abilities[0] : null;
  const shownAbility = megaAbility ?? set.ability;
  const abilityDesc = describe.ability(shownAbility, lang);
  const uid = useId();
  // Tendina degli spread: sopra l'editor (non ne cambia l'altezza); si chiude scegliendo, con Esc o cliccando fuori
  const spreadMenu = useRef<HTMLDetailsElement>(null);
  const closeSpreads = () => { if (spreadMenu.current) spreadMenu.current.open = false; };
  const spreadToggle = useRef<HTMLElement>(null);
  const spreadList = useRef<HTMLDivElement>(null);
  const [spreadsOpen, setSpreadsOpen] = useState(false);
  // Sotto la targhetta Spread, allineato a destra e largo quanto serve agli EV; sopra se sotto non c'è posto
  useAnchoredPop(spreadToggle, spreadList, spreadsOpen, { width: 'content', minWidth: 340, align: 'end', gap: 6, sheet: true, onDismiss: () => closeSpreads() });
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!spreadMenu.current?.contains(e.target as Node)) closeSpreads(); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);
  const lines = statLines(set, 100);
  // IV: 31 se non indicato; nel set restano solo quelli diversi da 31
  const changeIv = (stat: StatID, raw: string) => {
    const value = Math.min(31, Math.max(0, Number.isFinite(Number(raw)) && raw !== '' ? Math.floor(Number(raw)) : 31));
    const ivs = { ...set.ivs };
    if (value === 31) delete ivs[stat]; else ivs[stat] = value;
    update({ ivs: Object.keys(ivs).length ? ivs : undefined });
  };
  const used = evTotal(set.evs);
  // Lo Spread in uso: "Il più usato · 34%", "3° · 12%" (senza quota se viene dai preset) o Personalizzato
  const spreadAt = common?.spreads.findIndex(spread => spreadKey(spread) === spreadKey(set)) ?? -1;
  // Nel riquadro stretto la parte lunga ("Il più usato", "2° più usato") lascia il posto a "1°", "2°": la pastiglia sulla
  // fascia non tocca il titolo
  const spreadShare = spreadAt < 0 || !common || common.spreads[spreadAt].share === null ? '' : ` · ${formatPercent(lang, common.spreads[spreadAt].share!, 0)}`;
  // Il posto in breve: "2nd" in inglese, "2°" in italiano
  const ordinal = (n: number) => (lang === 'en' ? `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}` : t('editor.spreadRankShort', { n }));
  const spreadLabel = spreadAt < 0 || !common ? t(used === 0 ? 'editor.spreadNone' : 'editor.spreadOwn') : (
    <>
      <span className="sp-wide">{spreadAt === 0 ? t('editor.spreadTop') : t('editor.spreadRank', { n: lang === 'en' ? ordinal(spreadAt + 1) : spreadAt + 1 })}</span>
      <span className="sp-narrow" aria-hidden="true">{ordinal(spreadAt + 1)}</span>
      {spreadShare}
    </>
  );

  const customHint = t('editor.customTooltip');
  const customHintId = `${uid}-custom`;
  const [customShown, setCustomShown] = useState(false);
  const [natureHelp, setNatureHelp] = useState(false);
  // Telefono e tablet in verticale: l'editor in tre schede (Set, Statistiche, Sfida) sotto la testata fissa, una cosa alla volta
  const phone = useMediaQuery(EDITOR_TABS_QUERY);
  const [phoneTab, setPhoneTab] = useState<'set' | 'stats' | 'duel'>('set');
  useEffect(() => { if (startTab) setPhoneTab(startTab.tab); }, [startTab?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabsId = useId();
  const phoneTabs: { id: 'set' | 'stats' | 'duel'; label: string }[] = [
    { id: 'set', label: t('editor.set') }, { id: 'stats', label: t('editor.stats') }, ...(duel ? [{ id: 'duel' as const, label: t('editor.duel') }] : []),
  ];
  const pickTab = (id: 'set' | 'stats' | 'duel', focus = false) => {
    setPhoneTab(id);
    // La scheda nuova parte dall'alto (sotto la testata)
    const drawer = document.getElementById(`${tabsId}-tabs`)?.closest('.drawer');
    if (drawer) drawer.scrollTop = 0;
    if (focus) requestAnimationFrame(() => document.getElementById(`${tabsId}-tab-${id}`)?.focus());
  };
  // Strisciare col dito a destra o a sinistra cambia scheda: la vecchia esce nel verso del dito, la nuova entra
  // dall'altro lato (useSwipeTabs); la testata resta ferma
  const editorRef = useRef<HTMLDivElement>(null);
  const tabAt = phoneTabs.findIndex(tab => tab.id === phoneTab);
  useSwipeTabs(editorRef, {
    enabled: phone, hasPrev: tabAt > 0, hasNext: tabAt < phoneTabs.length - 1, parts: ':scope > :not(.editor-head)',
    onSwipe: dir => { const next = phoneTabs[tabAt + dir]; if (next) pickTab(next.id); },
  });
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = phoneTabs.findIndex(tab => tab.id === phoneTab);
    const next = e.key === 'ArrowRight' ? (at + 1) % phoneTabs.length : e.key === 'ArrowLeft' ? (at - 1 + phoneTabs.length) % phoneTabs.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? phoneTabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    pickTab(phoneTabs[next].id, true);
  };
  // Vuota (niente strumento, abilità o natura): filo ed etichetta gialli, come i segni "da controllare" del team
  // Fuori regola (vietato o non legale): filo ed etichetta rossi
  const plate = (label: string, control: ReactNode, empty = false, flag?: FieldFlag) => (
    // La targhetta intera (etichetta compresa) fa da campo: il menu si apre largo quanto lei
    <div className={`set-plate${empty ? ' empty' : ''}${flag ? ' flagged' : ''}`} data-pop-anchor>
      <span className="field-label" aria-hidden="true">{label}</span>{control}
    </div>
  );

  /**
   * La testa di un campo fuori regola, uguale per mosse, strumento e abilità: ⚠ e la parola breve (Vietata, Non legale)
   * e, se c'è, ⇄ con cosa mettere al posto (un clic lo mette nel set; passandoci sopra il suo tooltip).
   */
  const flagHead = (kind: 'move' | 'item' | 'ability', flag: FieldFlag, current: string, apply: (to: string) => void) => (
    <span className="field-flags">
      <span className="field-flag" aria-hidden="true"><Icon name="warning" />{flag.label}</span>
      {flag.swap && (
        <button type="button" className="field-swap"
          {...(kind === 'move' ? { 'data-move-tip': flag.swap } : kitTip(kind, flag.swap))}
          aria-label={t('editor.swapMove', { to: gameName(kind, flag.swap, lang), from: gameName(kind, current, lang) })}
          onClick={() => apply(flag.swap!)}>
          <Icon name="swap" /><span>{gameName(kind, flag.swap, lang)}</span>
        </button>
      )}
    </span>
  );

  const flagCount = (flags?.item ? 1 : 0) + (flags?.ability ? 1 : 0) + (flags?.moves?.filter(Boolean).length ?? 0);

  return (
    <div className="set-editor" ref={editorRef} data-tab={phone ? phoneTab : undefined}>
      <div className="editor-head">
        <div className="editor-top">
          {title}
          {/* La Tera accanto a nome e tipi: cambia il tipo, quindi sta coi tipi (solo nei formati che la usano) */}
          {!teraBannedIn && (
            <div className="editor-tera set-plates">
              {plate(t('editor.tera'), (
                <Combobox label={t('editor.tera')} commonLabel={commonLabel(common?.teraTypes)} value={set.teraType ?? ''} options={teraOptions} restricted
                  display={set.teraType ? <TypeChip type={set.teraType} /> : <span className="faint">{t('editor.none')}</span>}
                  onChange={tera => update({ teraType: tera || undefined })} />
              ))}
            </div>
          )}
          {/* A destra: il menu Set (preset Smogon e I miei set), poi Copia il set e Chiudi */}
          <div className="editor-actions">
            <SetMenu set={set} presets={presets} bestIndex={bestIndex} onBest={onBest} onChange={onSetChange} onText={onText} onCopy={onCopy} smogonLink={smogonLink} />
            {actions}
          </div>
        </div>
        {phone && (
          <div className="editor-tabs" role="tablist" id={`${tabsId}-tabs`} aria-label={t('editor.sections')}>
            {phoneTabs.map(tab => (
              <button key={tab.id} type="button" role="tab" id={`${tabsId}-tab-${tab.id}`} aria-selected={phoneTab === tab.id}
                tabIndex={phoneTab === tab.id ? 0 : -1} onClick={() => pickTab(tab.id)} onKeyDown={onTabKey}>{tab.label}</button>
            ))}
          </div>
        )}
      </div>
      {notice}
      {/* Sul telefono il riquadro del testo del set sta sopra le schede, visibile in ognuna */}
      {phone && textPanel}
      {/* Le Statistiche e, sopra di loro, il riquadro del Testo del set quando è aperto */}
      <div className="stats-cell">
      <fieldset className="evs">
        <legend>{t('editor.stats')}</legend>
        {/* Spread sulla fascia delle Statistiche, a destra (come Custom Skillset su quella del Set): dice a quale degli spread
            più usati corrisponde il set (o Personalizzato) e apre l'elenco; uno spread è natura più EV */}
        {!!common?.spreads.length && (
          <details className="spread-panel" ref={spreadMenu} onToggle={e => setSpreadsOpen(e.currentTarget.open)}
            onKeyDown={e => { if (e.key === 'Escape' && spreadMenu.current?.open) { e.stopPropagation(); closeSpreads(); spreadMenu.current.querySelector('summary')?.focus(); } }}>
            <summary className="spread-toggle" ref={spreadToggle} {...hint(t('editor.spreadTip'))}>
              <span className="spread-name">{t('editor.spread')}<span className="visually-hidden">:</span></span>
              <span className="spread-value">{spreadLabel}</span>
            </summary>
            <div className="spread-presets" ref={spreadList} popover={supportsPopover ? 'manual' : undefined} role="group" aria-label={t('editor.spreads')}>
              {common.spreads.map(spread => (
                <button
                  key={spreadKey(spread)}
                  type="button"
                  aria-pressed={spreadKey(spread) === spreadKey(set)}
                  onClick={() => { onSetChange({ ...set, nature: spread.nature, evs: { ...spread.evs } }); closeSpreads(); }}
                >
                  <Icon name="check" />
                  <strong>{natureName(spread.nature, lang)}</strong>
                  <span className="spread-evs">{spreadText(spread, lang)}</span>
                  <span className="common-share" {...hint(spread.share === null ? t('combobox.presetTitle') : undefined)}>{shareLabel(spread)}</span>
                </button>
              ))}
            </div>
          </details>
        )}
        <div className="stat-rows">
          {/* Intestazione delle colonne: niente titolo sopra i valori (il numero grande si spiega da solo); EV sopra i
              cursori, il totale 508 / 510 sopra le caselle degli EV, IV sopra gli IV. EV e IV hanno la loro spiegazione al
              passaggio del mouse. Oltre 510 compare il messaggio (quanti di troppo, voto bloccato) */}
          <div className="stat-row stat-head">
            <span />
            <span />
            <span />
            {/* Oltre 510 rosso; 8 o più EV ancora da spendere (2 punti di statistica) giallo, col tooltip che lo dice */}
            <p className={`stat-head-ev ev-total${used > EV_TOTAL ? ' over' : EV_TOTAL - used >= 8 ? ' under' : ''}`}
              {...hint(used > EV_TOTAL ? t('editor.evOver', { n: used - EV_TOTAL }) : EV_TOTAL - used >= 8 ? t('editor.evUnder', { n: EV_TOTAL - used }) : undefined)}>
              <HeadHelp className="ev-head" text={t('editor.evHelp')}>{t('editor.evs')}</HeadHelp>
              <span className="visually-hidden">{t('editor.evTotal')}</span>
              <span className="ev-used"><strong>{used}</strong><span className="ev-of">/ {EV_TOTAL}</span></span>
              {used > EV_TOTAL && <span className="ev-left">{t('editor.evOverShort', { n: used - EV_TOTAL })}</span>}
              {evMax && used <= EV_TOTAL && <span className="ev-left ev-max" role="status">{t('editor.evMax')}</span>}
            </p>
            <HeadHelp className="stat-head-num" text={t('editor.ivHelp')} end>{t('editor.ivHead')}</HeadHelp>
          </div>
          {lines.map(line => (
            <div key={line.stat} className={`stat-row${line.nature ? ` nature-${line.nature}` : ''}`}>
              <label className="stat-name" htmlFor={`ev-${uid}-${line.stat}`}>
                <StatIcon stat={line.stat} />{statShort(line.stat, lang).toUpperCase()}
              </label>
              {/* La freccetta della natura attaccata al numero, come nel riepilogo di Champions (solo disegnata); la colonna
                  stretta prima resta vuota, così le righe restano in colonna */}
              <span className="stat-arrow" />
              <strong className="stat-final" data-testid={`final-${line.stat}`}>{line.nature && <NatureArrow dir={line.nature} />}{line.value}</strong>
              <input
                type="range"
                className="ev-slider"
                // Fuori dal giro del Tab: è un doppione del numero accanto (che con le frecce fa lo stesso); col mouse funziona come sempre
                tabIndex={-1}
                min={0}
                max={252}
                step={EV_STEP}
                value={line.ev}
                aria-label={t('editor.evSlider', { stat: statShort(line.stat, lang) })}
                style={{ '--fill': `${(line.ev / 252) * 100}%` } as CSSProperties}
                onChange={e => update({ evs: { ...set.evs, [line.stat]: clampEv(Number(e.target.value)) } })}
              />
              <input
                id={`ev-${uid}-${line.stat}`}
                type="number"
                inputMode="numeric"
                // A 0 il numero è spento: a colpo d'occhio si vedono solo gli EV messi
                className={`ev-input${line.ev ? '' : ' zero'}`}
                min={0}
                max={252}
                step={EV_STEP}
                value={line.ev}
                aria-label={t('editor.evFor', { stat: statShort(line.stat, lang).toUpperCase() })}
                aria-keyshortcuts="ArrowRight"
                {...hint(t('editor.evToIv'))}
                onKeyDown={e => {
                  // Freccia destra: all'IV della riga (fuori dal Tab quando vale 31)
                  if (e.key !== 'ArrowRight' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
                  e.preventDefault();
                  e.currentTarget.closest('.stat-row')?.querySelector<HTMLInputElement>('.iv-input')?.focus();
                }}
                onChange={e => {
                  // Oltre 252 il numero si ferma a 252: per un attimo la testa degli EV dice perché
                  if (Number(e.target.value) > 252) flashEvMax();
                  update({ evs: { ...set.evs, [line.stat]: clampEv(Number(e.target.value)) } });
                }}
              />
              <IvInput value={ivOf(set, line.stat)} label={t('editor.ivFor', { stat: statShort(line.stat, lang).toUpperCase() })} tip={t('editor.ivToEv')}
                onChange={raw => changeIv(line.stat, raw)} />
            </div>
          ))}
        </div>
        {/* La Natura sotto le righe, centrata, a rombo come in Champions: cambia le statistiche di sopra (le freccette) */}
        {/* La spiegazione della natura sta fuori dalla testa (che è ritagliata a rombo e la taglierebbe) */}
        <div className="nature-diamond set-plates">
          <div className={`set-plate${set.nature ? '' : ' empty'}`} data-pop-anchor>
            <span className="field-label" aria-hidden="true" onPointerEnter={() => setNatureHelp(true)} onPointerLeave={() => setNatureHelp(false)}>{t('editor.nature')}</span>
            <Combobox label={t('editor.nature')} commonLabel={commonLabel(common?.natures)} value={set.nature} options={natureOptions} restricted menuJoined={2}
              display={<><span>{natureName(set.nature, lang)}</span>{set.nature && <NatureEffect name={set.nature} />}</>}
              onChange={nature => update({ nature })} />
          </div>
          <span className="hint-bubble help-bubble" aria-hidden="true" hidden={!natureHelp}>{t('editor.natureHelp')}</span>
        </div>
        {/* Il posto della Velocità nel meta, sotto le righe; passandoci sopra il tooltip della scheda Velocità */}
        {speed && <SpeedMeta set={set} tier={speed} />}
      </fieldset>
      {!phone && textPanel}
      </div>
      <div className={`editor-side${duel ? ' with-duel' : ''}`}>
      <fieldset className="editor-group set-box">
        {/* Campi fuori regola: sulla fascia del Set il triangolo rosso e quanti sono, come sulla carta (da dove partire) */}
        <legend>{t('editor.set')}{flagCount > 0 && (
          <span className="legend-flag"><Icon name="warning" />{flagCount}<span className="visually-hidden"> {t('editor.setFlags', { n: flagCount })}</span></span>
        )}</legend>
        {/* Custom Skillset a destra nella fascia del Set: cosa fa solo nel fumetto e per i lettori di schermo */}
        <label className={`custom-toggle${custom ? ' on' : ''}`}
          onPointerEnter={() => setCustomShown(true)} onPointerLeave={() => setCustomShown(false)}>
          <span className="custom-text">{t('editor.customLabel')}</span>
          <input
            type="checkbox"
            className="switch"
            aria-label={t('editor.custom', { species: set.species })}
            aria-describedby={customHintId}
            checked={custom}
            onFocus={() => setCustomShown(true)}
            onBlur={() => setCustomShown(false)}
            onKeyDown={e => { if (e.key === 'Escape') setCustomShown(false); }}
            onChange={e => update({ customSkillset: e.target.checked || undefined })}
          />
          <span className="hint-bubble" id={customHintId} hidden={!customShown}>{customHint}</span>
        </label>
        <div className="editor-group set-plates">
        <div className="field" {...kitTip('item', set.item)}>
          {/* Fuori regola: sopra la targhetta la parola breve e ⇄ lo strumento da mettere al posto, come sulle mosse */}
          {/* La riga sopra c'è sempre (vuota se va tutto bene): quando compare l'avviso niente si sposta */}
          <span className="field-head">{flags?.item && flagHead('item', flags.item, set.item, item => update({ item }))}</span>
          {plate(t('editor.item'), (
            <Combobox label={t('editor.item')} commonLabel={commonLabel(common?.items)} value={set.item} options={itemOptions} description={itemDesc} descriptionFooter optionTip={itemTipOf}
              leading={set.item ? <ItemIcon item={set.item} /> : undefined} invalid={flags?.item?.text}
              onChange={item => update({ item })} />
          ), !set.item, flags?.item)}
        </div>
        <div className="field" {...kitTip('ability', shownAbility)}>
          <span className="field-head">{!megaAbility && flags?.ability && flagHead('ability', flags.ability, set.ability, ability => update({ ability }))}</span>
          {plate(t('editor.ability'), megaAbility ? (
            <span className="plate-lock" {...hint(t('editor.megaAbility'))}>
              <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={megaAbility} options={[abilityOption(megaAbility, lang)]} restricted disabled
                description={abilityDesc} onChange={() => undefined} />
            </span>
          ) : (
            <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={set.ability} options={abilityOptions} restricted={!custom} optionTip={abilityTipOf}
              description={abilityDesc} invalid={flags?.ability?.text} onChange={ability => update({ ability })} />
          ), !megaAbility && !set.ability, megaAbility ? undefined : flags?.ability)}
        </div>
        </div>
        {/* Le mosse nello stesso riquadro Set (un gruppo col suo nome per i lettori di schermo) */}
        <div className="editor-group moves" role="group" aria-label={t('editor.moves')}>
        {moves.map((move, i) => (
          <div key={i} className={`field${proposedSlot === i ? ' is-proposed' : ''}${move ? '' : ' empty'}${flags?.moves?.[i] ? ' flagged' : ''}`} data-move-tip={move || undefined}>
            <span className="field-head">
              {t('editor.move', { n: i + 1 })}
              {/* Fuori regola: al posto di potenza e precisione (stanno nel tooltip) la parola breve, nel colore del problema */}
              {flags?.moves?.[i] ? (
                flagHead('move', flags.moves[i]!, move, to => { const next = [...moves]; next[i] = to; update({ moves: next }); })
              ) : <MoveDetail name={move} inField />}
            </span>
            <Combobox
              className="move-combo"
              descriptionFooter
              leading={<MoveTile name={move} />}
              trailing={<MoveTail name={move} titled={false} />}
              label={t('editor.move', { n: i + 1 })}
              value={move}
              options={moveOptionsFor[i]}
              commonLabel={commonLabel(common?.moves)}
              description={describe.move(move, lang)}
              optionTip={moveTipOf}
              invalid={flags?.moves?.[i]?.text}
              onChange={value => {
                const next = [...moves];
                next[i] = value;
                update({ moves: next });
              }}
            />
          </div>
        ))}
        </div>
      </fieldset>
      {duel}
      </div>
      {(!!roles?.length || memberAction) && (
        // Ruoli e, in basso a destra, l'azione sul membro (Sostituisci)
        <div className="editor-foot">
          {!!roles?.length && (
            <fieldset className="editor-roles">
              {/* Il titolo resta per i lettori di schermo; a vista una piccola etichetta e i ruoli come linguette, non pulsanti */}
              <legend className="visually-hidden">{t('editor.roles')}</legend>
              <span className="roles-label" aria-hidden="true">{t('editor.roles')}</span>
              <ul>
                {roles.map((role, i) => <li key={role} className={i === 0 ? 'main-role' : undefined} {...hint(roleTips?.[i])}>{role}</li>)}
              </ul>
            </fieldset>
          )}
          {memberAction}
        </div>
      )}
    </div>
  );
}
