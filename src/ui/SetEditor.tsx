import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { battleSpecies, dex, getMove, getSpecies, itemNames, moveNames, natureNames, toID } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { formatName, STAT_IDS, type Preset, type StatID, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';
import type { Pokedex } from '../engine/formats';
import type { GameId } from '../engine/games';
import type { CommonChoice, CommonChoices, CommonSpread } from '../engine/common';
import { formatPercent, type Lang } from '../i18n';
import { gameDesc, gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { describe } from './describe';
import { SpeedMeta } from './SpeedLine';
import type { SpeedTier } from '../engine/speed';
import { EV_TOTAL, evTotal, ivOf, statLines } from '../engine/statCalc';
import { TypeChip } from './Sprite';
import { NatureArrow } from './NatureArrow';
import { ItemIcon } from './ItemIcon';
import { Icon } from './icons';
import { SetMenu } from './SetMenu';
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
function IvInput({ value, label, onChange }: { value: number; label: string; onChange: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      className="iv-input"
      min={0}
      max={31}
      value={draft ?? value}
      aria-label={label}
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
      <span className={`move-stat cat-${move.category.toLowerCase()}`} title={category}>
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
        <span className="move-stat accuracy" title={t('editor.accuracy')}>
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
  /** Tutti i ruoli del membro, il principale per primo: il riquadro in fondo all'editor. */
  roles?: string[];
  /** La spiegazione di ogni ruolo (stesso ordine di `roles`), nel tooltip. */
  roleTips?: (string | undefined)[];
  /** Slot di mossa evidenziato perché il coach propone di cambiarlo. */
  proposedSlot?: number;
  onChange: (set: TeamSet) => void;
}

export function SetEditor({ set, presets = [], genLimit, pokedex = 'natdex', game = null, common, teraBannedIn, speed, title, actions, bestIndex, onBest, onText, smogonLink, memberAction, notice, textPanel, roles, roleTips, proposedSlot, onChange }: Props) {
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
  const itemOptions = useMemo<ComboOption[]>(() => withCommon(ITEMS
    .filter(name => pokedex !== 'sv' || !dex.items.get(name).isNonstandard)
    .map(name => ({
      value: name, label: gameName('item', name, lang), alias: name, description: describe.item(name, lang), icon: <ItemIcon item={name} />,
    })), common?.items), [pokedex, lang, commonKey]);
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

  const customHint = t('editor.customTooltip');
  const customHintId = `${uid}-custom`;
  const [customShown, setCustomShown] = useState(false);
  const plate = (label: string, control: ReactNode) => (
    <div className="set-plate"><span className="field-label" aria-hidden="true">{label}</span>{control}</div>
  );

  return (
    <div className="set-editor">
      <div className="editor-head">
        <div className="editor-top">
          {title}
          {/* A destra: il menu Set (preset Smogon e I miei set), poi Copia il set e Chiudi */}
          <div className="editor-actions">
            <SetMenu set={set} presets={presets} bestIndex={bestIndex} onBest={onBest} onChange={onChange} onText={onText} smogonLink={smogonLink} />
            {actions}
          </div>
        </div>
      </div>
      {notice}
      {/* Le Statistiche e, sopra di loro, il riquadro del Testo del set quando è aperto */}
      <div className="stats-cell">
      <fieldset className="evs">
        <legend>{t('editor.stats')}</legend>
        {/* EV usati a sinistra (barra, 508 / 510, quanti ne restano), "Spread più usati" a destra, sulla stessa riga */}
        <div className="stats-toolbar">
        <p className={`ev-total${used > EV_TOTAL ? ' over' : ''}`}>
          <span>{t('editor.evTotal')}</span>
          <span className="ev-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (used / EV_TOTAL) * 100)}%` }} /></span>
          <span className="ev-used"><strong>{used}</strong><span className="ev-of">/ {EV_TOTAL}</span></span>
          <span className="ev-left">{used > EV_TOTAL ? t('editor.evOver', { n: used - EV_TOTAL }) : t('editor.evLeft', { n: EV_TOTAL - used })}</span>
        </p>
        {!!common?.spreads.length && (
          // Chiuso di norma
          <details className="spread-panel" ref={spreadMenu}
            onKeyDown={e => { if (e.key === 'Escape' && spreadMenu.current?.open) { e.stopPropagation(); closeSpreads(); spreadMenu.current.querySelector('summary')?.focus(); } }}>
          <summary>{t('editor.spreads')}</summary>
          <div className="spread-presets" role="group" aria-label={t('editor.spreads')}>
            {common.spreads.map(spread => (
              <button
                key={spreadKey(spread)}
                type="button"
                aria-pressed={spreadKey(spread) === spreadKey(set)}
                onClick={() => { update({ nature: spread.nature, evs: { ...spread.evs } }); closeSpreads(); }}
              >
                <Icon name="check" />
                <strong>{natureName(spread.nature, lang)}</strong>
                <span className="spread-evs">{spreadText(spread, lang)}</span>
                <span className="common-share" title={spread.share === null ? t('combobox.presetTitle') : undefined}>{shareLabel(spread)}</span>
              </button>
            ))}
          </div>
          </details>
        )}
        </div>
        <div className="stat-rows">
          {/* Intestazione delle colonne: il valore della statistica dove c'era la base, poi EV (barra e numero) e IV */}
          <div className="stat-row stat-head" aria-hidden="true">
            <span />
            <span />
            <span className="stat-head-value">{t('editor.statsHead')}</span>
            <span className="stat-head-ev">{t('editor.evs')}</span>
            <span className="stat-head-num">{t('editor.ivHead')}</span>
          </div>
          {lines.map(line => (
            <div key={line.stat} className={`stat-row${line.nature ? ` nature-${line.nature}` : ''}`}>
              <label className="stat-name" htmlFor={`ev-${uid}-${line.stat}`}>
                <StatIcon stat={line.stat} />{statShort(line.stat, lang).toUpperCase()}
              </label>
              {/* La freccetta della natura accanto al numero, come nel riepilogo di Champions (solo disegnata) */}
              <span className="stat-arrow">{line.nature && <NatureArrow dir={line.nature} />}</span>
              <strong className="stat-final" data-testid={`final-${line.stat}`}>{line.value}</strong>
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
                className="ev-input"
                min={0}
                max={252}
                step={EV_STEP}
                value={line.ev}
                onChange={e => update({ evs: { ...set.evs, [line.stat]: clampEv(Number(e.target.value)) } })}
              />
              <IvInput value={ivOf(set, line.stat)} label={t('editor.ivFor', { stat: statShort(line.stat, lang).toUpperCase() })}
                onChange={raw => changeIv(line.stat, raw)} />
            </div>
          ))}
        </div>
        {/* Il posto della Velocità nel meta, sotto le righe; passandoci sopra il tooltip della scheda Velocità */}
        {speed && <SpeedMeta set={set} tier={speed} />}
      </fieldset>
      {textPanel}
      </div>
      <div className="editor-side">
      <fieldset className="editor-group set-plates">
        <legend>{t('editor.set')}</legend>
        <div className="field" data-tip={itemDesc}>
          {plate(t('editor.item'), (
            <Combobox label={t('editor.item')} commonLabel={commonLabel(common?.items)} value={set.item} options={itemOptions} description={itemDesc}
              leading={set.item ? <ItemIcon item={set.item} /> : undefined}
              onChange={item => update({ item })} />
          ))}
        </div>
        <div className="field" data-tip={abilityDesc}>
          {megaAbility && <span className="field-head"><small className="field-note">{t('editor.megaAbilityNote')}</small></span>}
          {plate(t('editor.ability'), megaAbility ? (
            <span className="plate-lock" title={t('editor.megaAbility')}>
              <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={megaAbility} options={[abilityOption(megaAbility, lang)]} restricted disabled
                description={abilityDesc} onChange={() => undefined} />
            </span>
          ) : (
            <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={set.ability} options={abilityOptions} restricted={!custom}
              description={abilityDesc} onChange={ability => update({ ability })} />
          ))}
        </div>
        {/* Senza Tera nel formato (es. National Dex) la Natura prende tutta la riga e il Tera non c'è (il valore resta salvato) */}
        <div className={`field${teraBannedIn ? ' full' : ''}`}>
          {plate(t('editor.nature'), (
            <Combobox label={t('editor.nature')} commonLabel={commonLabel(common?.natures)} value={set.nature} options={natureOptions} restricted
              display={<><span>{natureName(set.nature, lang)}</span>{set.nature && <NatureEffect name={set.nature} />}</>}
              onChange={nature => update({ nature })} />
          ))}
        </div>
        {!teraBannedIn && (
          <div className="field">
            {plate(t('editor.tera'), (
              <Combobox label={t('editor.tera')} commonLabel={commonLabel(common?.teraTypes)} value={set.teraType ?? ''} options={teraOptions} restricted
                display={set.teraType ? <TypeChip type={set.teraType} /> : <span className="faint">{t('editor.none')}</span>}
                onChange={tera => update({ teraType: tera || undefined })} />
            ))}
          </div>
        )}
      </fieldset>
      <fieldset className="editor-group moves">
        <legend>{t('editor.moves')}</legend>
        {/* Custom Skillset a destra nella fascia delle Mosse: cosa fa solo nel fumetto e per i lettori di schermo */}
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
        {moves.map((move, i) => (
          <div key={i} className={`field${proposedSlot === i ? ' is-proposed' : ''}`} data-tip={describe.move(move, lang)}>
            <span className="field-head">
              {t('editor.move', { n: i + 1 })}
              <MoveDetail name={move} inField />
            </span>
            <Combobox
              className="move-combo"
              leading={<MoveTile name={move} />}
              trailing={<MoveTail name={move} />}
              label={t('editor.move', { n: i + 1 })}
              value={move}
              options={moveOptionsFor[i]}
              commonLabel={commonLabel(common?.moves)}
              description={describe.move(move, lang)}
              onChange={value => {
                const next = [...moves];
                next[i] = value;
                update({ moves: next });
              }}
            />
          </div>
        ))}
      </fieldset>
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
                {roles.map((role, i) => <li key={role} className={i === 0 ? 'main-role' : undefined} title={roleTips?.[i]}>{role}</li>)}
              </ul>
            </fieldset>
          )}
          {memberAction}
        </div>
      )}
    </div>
  );
}
