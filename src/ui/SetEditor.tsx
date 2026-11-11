import { presetSet } from '../engine/bestPreset';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { battleSpecies, dex, getMove, getSpecies, itemNames, moveNames, natureNames, toID } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { formatName, sameSet, STAT_IDS, type Preset, type StatID, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';
import type { Pokedex } from '../engine/formats';
import type { CommonChoice, CommonChoices, CommonSpread } from '../engine/common';
import { formatPercent, type Lang } from '../i18n';
import { gameDesc, gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { describe } from './describe';
import { SpeedLine } from './SpeedLine';
import { speedStat, type SpeedTier } from '../engine/speed';
import { EV_TOTAL, evTotal, ivOf, statLines } from '../engine/statCalc';
import { setViewLevel, useViewLevel } from './viewLevel';
import { TypeChip } from './Sprite';
import { ItemIcon } from './ItemIcon';
import { Icon } from './icons';
import { MySetsField } from './MySetsField';
import { typeTextColor } from './TypeText';

function NatureEffect({ name }: { name: string }) {
  const lang = useLang();
  const t = useT();
  const { plus, minus } = dex.natures.get(name);
  if (!plus || !minus) return <span className="nature-fx neutral">{t('editor.neutral')}</span>;
  return (
    <span className="nature-fx">
      <span className="up">+{statShort(plus as StatID, lang)}</span>, <span className="down">−{statShort(minus as StatID, lang)}</span>
    </span>
  );
}

const CATEGORY_ICONS = { Physical: 'physical', Special: 'special', Status: 'status' } as const;

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


function MoveDetail({ name }: { name: string }) {
  const t = useT();
  const move = getMove(name);
  if (!move) return null;
  const accuracy = move.accuracy === true ? null : move.accuracy;
  const category = t(`editor.category.${move.category}`);
  return (
    <span className="move-meta">
      <span className={`move-stat cat-${move.category.toLowerCase()}`} title={category}>
        <Icon name={CATEGORY_ICONS[move.category]} filled={move.category === 'Physical'} />
        {/* Mosse di stato (e a potenza variabile): solo l'icona della categoria, niente "—" */}
        {move.basePower > 0
          ? <><span className="visually-hidden">{category}, {t('editor.power')} </span>{move.basePower}</>
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
      <TypeChip type={move.type} />
    </span>
  );
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
  ({ value: name, label: gameName('ability', name, lang), description: describe.ability(name, lang) });

/** Natura ed EV come chiave, per riconoscere lo spread attuale. */
const spreadKey = (s: Pick<CommonSpread, 'nature' | 'evs'>) => `${s.nature}:${STAT_IDS.map(stat => s.evs[stat] ?? 0).join('/')}`;
/** "252 Att / 252 Vel / 4 PS": prima gli EV più alti. */
const spreadText = (s: Pick<CommonSpread, 'evs'>, lang: Lang) =>
  STAT_IDS.filter(stat => (s.evs[stat] ?? 0) > 0)
    .sort((a, b) => (s.evs[b] ?? 0) - (s.evs[a] ?? 0))
    .map(stat => `${s.evs[stat]} ${statShort(stat, lang)}`).join(' / ') || '—';

/** Colore della statistica base, dal rosso (bassa) al verde-azzurro (altissima), come nei teambuilder. */
const baseColor = (base: number) => `hsl(${Math.min(180, Math.max(0, (base - 30) * 1.2))} 80% 58%)`;

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
  /** Scelte più usate del membro, mostrate in cima ai menu. */
  common?: CommonChoices;
  /** Nome del formato se vieta il Tera: campo disattivato con la nota (il valore resta salvato). */
  teraBannedIn?: string;
  /** Velocità del membro tra i più usati del meta (null senza statistiche). */
  speed?: SpeedTier | null;
  /** Nome e tipi del membro, a sinistra nella riga in testa. */
  title?: React.ReactNode;
  /** Pulsanti a destra nella riga in testa (Copia set, Sostituisci). */
  actions?: React.ReactNode;
  /** Pulsante accanto al menu dei preset (Preset migliore). */
  presetAction?: React.ReactNode;
  /** Accanto al nome (Sostituisci), attaccato ai preset Smogon (link), accanto a I miei set (Importa / Esporta). */
  memberAction?: React.ReactNode;
  /** Sotto la testata: i problemi del membro detti per esteso, con la via d'uscita. */
  notice?: React.ReactNode;
  smogonAction?: React.ReactNode;
  ioAction?: React.ReactNode;
  /** Tutti i ruoli del membro, il principale per primo: il riquadro in fondo all'editor. */
  roles?: string[];
  /** Slot di mossa evidenziato perché il coach propone di cambiarlo. */
  proposedSlot?: number;
  onChange: (set: TeamSet) => void;
}

export function SetEditor({ set, presets = [], genLimit, pokedex = 'natdex', common, teraBannedIn, speed, title, actions, presetAction, memberAction, notice, smogonAction, ioAction, roles, proposedSlot, onChange }: Props) {
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
    const legal = custom ? null : legalMoves(set.species, genLimit);
    const names = (legal ? [...legal].map(id => getMove(id)?.name ?? id).sort() : ALL_MOVES)
      .filter(name => pokedex !== 'sv' || !getMove(name)?.isNonstandard);
    return withCommon(names.map(name => moveOption(name, lang)), common?.moves);
  }, [custom, set.species, genLimit, pokedex, lang, commonKey]);
  const itemOptions = useMemo<ComboOption[]>(() => withCommon(ITEMS
    .filter(name => pokedex !== 'sv' || !dex.items.get(name).isNonstandard)
    .map(name => ({
      value: name, label: gameName('item', name, lang), description: describe.item(name, lang), icon: <ItemIcon item={name} />,
    })), common?.items), [pokedex, lang, commonKey]);
  const natureOptions = useMemo<ComboOption[]>(() => withCommon(natureNames().map(name => {
    const { plus, minus } = dex.natures.get(name);
    const label = natureName(name, lang);
    return {
      value: name,
      label,
      detail: <NatureEffect name={name} />,
      ariaLabel: plus && minus
        ? `${label} (+${statShort(plus as StatID, lang)}, −${statShort(minus as StatID, lang)})`
        : `${label} (${t('editor.neutral')})`,
    };
  }), common?.natures), [lang, t, commonKey]);
  const teraOptions = useMemo<ComboOption[]>(() => withCommon([
    { value: '', label: t('editor.none'), ariaLabel: t('editor.none') },
    ...TYPES.map(type => ({ value: type, label: typeName(type, lang), content: <TypeChip type={type} />, ariaLabel: typeName(type, lang) })),
  ], common?.teraTypes), [lang, t, commonKey]);
  const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
  // Una mossa già scelta in un altro slot resta nel menu, grigia e non selezionabile
  const movesKey = moves.join('|');
  const moveOptionsFor = useMemo(() => moves.map((_, slot) => {
    const others = new Set(moves.filter((move, i) => i !== slot && move).map(toID));
    return others.size ? moveOptions.map(option => (others.has(toID(option.value)) ? { ...option, disabled: true } : option)) : moveOptions;
  }), [moveOptions, movesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (patch: Partial<TeamSet>) => onChange({ ...set, ...patch });
  // Preset: la chiave è la posizione. Se il set coincide con un preset è selezionato quello, altrimenti il campo resta vuoto
  const presetOptions: ComboOption[] = presets.map((preset, i) => ({
    value: String(i),
    label: preset.name,
    detail: <span className="preset-format">{formatName(preset.format)}</span>,
    description: preset.set.moves.map(move => gameName('move', move, lang)).join(' · '),
  }));

  const appliedIndex = presets.findIndex(p => sameSet(p.set, set));
  const applyPreset = (key: string) => {
    const preset = presets[Number(key)];
    if (preset) onChange(presetSet(set, preset.set));
  };
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
  const level = useViewLevel();
  const lines = statLines(set, level);
  // IV: 31 se non indicato; nel set restano solo quelli diversi da 31
  const changeIv = (stat: StatID, raw: string) => {
    const value = Math.min(31, Math.max(0, Number.isFinite(Number(raw)) && raw !== '' ? Math.floor(Number(raw)) : 31));
    const ivs = { ...set.ivs };
    if (value === 31) delete ivs[stat]; else ivs[stat] = value;
    update({ ivs: Object.keys(ivs).length ? ivs : undefined });
  };
  const used = evTotal(set.evs);

  return (
    <div className="set-editor">
      <div className="editor-head">
        {(title || actions) && (
          <div className="editor-top">
            {title}
            {actions && <div className="editor-actions">{actions}</div>}
          </div>
        )}
        <div className="head-group">
        <div className="field preset-field preset-group">
          <span className="field-head">{t('editor.presets')}</span>
          <div className="joined">
          <Combobox
            label={t('editor.presets')}
            value={appliedIndex >= 0 ? String(appliedIndex) : ''}
            options={presetOptions}
            restricted
            disabled={presets.length === 0}
            placeholder={presets.length ? t('editor.presetsPlaceholder') : t('editor.noPresets')}
            display={appliedIndex >= 0
              ? <><span>{presets[appliedIndex].name}</span><span className="preset-format">{formatName(presets[appliedIndex].format)}</span></>
              : undefined}
            onChange={applyPreset}
          />
          {smogonAction}
          </div>
        </div>
        {presets.length > 0 && presetAction}
        </div>
        <div className="head-group">
        <MySetsField set={set} onApply={saved => onChange(presetSet(set, saved))} />
        {ioAction}
        </div>
        {/* Fuori dai riquadri: cambia le scelte sia del Set sia delle Mosse */}
        <label className={`custom-toggle${custom ? ' on' : ''}`} title={t('editor.customTooltip')}>
          <span className="custom-text">
            <b>{t('editor.customLabel')}</b>
            <small>{custom ? t('editor.customOn') : t('editor.customOff')}</small>
          </span>
          <input
            type="checkbox"
            className="switch"
            aria-label={t('editor.custom', { species: set.species })}
            checked={custom}
            onChange={e => update({ customSkillset: e.target.checked || undefined })}
          />
        </label>
      </div>
      {notice}
      <fieldset className="evs">
        <legend>{t('editor.stats')}</legend>
        {/* Livello a sinistra (due mezze pillole unite), "Spread più usati" a destra, sulla stessa riga */}
        <div className="stats-toolbar">
        <div className="level-toggle" role="group" aria-label={t('editor.level')}>
          <span className="level-toggle-label" aria-hidden="true">{t('editor.levelShort')}</span>
          {([50, 100] as const).map(n => (
            <button key={n} type="button" aria-pressed={level === n} aria-label={t('editor.levelN', { n })}
              onClick={() => setViewLevel(n)}>{n}</button>
          ))}
        </div>
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
          {/* Intestazione delle colonne */}
          <div className="stat-row stat-head">
            <span />
            <span>{t('editor.baseHead')}</span>
            <span />
            <span className="stat-head-num">{t('editor.evs')}</span>
            <span className="stat-head-num">{t('editor.ivHead')}</span>
            <span className="stat-head-final">{t('editor.finalHead')}</span>
          </div>
          {lines.map(line => (
            <div key={line.stat} className={`stat-row${line.nature ? ` nature-${line.nature}` : ''}`}>
              <label className="stat-name" htmlFor={`ev-${uid}-${line.stat}`}>{statShort(line.stat, lang).toUpperCase()}</label>
              <span className="stat-base" title={t('editor.base', { n: line.base })}>
                <span className="stat-base-n">{line.base}</span>
                <span className="stat-base-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, line.base / 1.8)}%`, background: baseColor(line.base) }} />
                </span>
              </span>
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
                style={{ '--fill': `${(line.ev / 252) * 100}%` } as React.CSSProperties}
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
              <strong className="stat-final" data-testid={`final-${line.stat}`} title={t('editor.finalAt', { n: level })}>{line.value}</strong>
            </div>
          ))}
        </div>
        <p className={`ev-total${used > EV_TOTAL ? ' over' : ''}`}>
          <span>{t('editor.evTotal')}</span>
          <span className="ev-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (used / EV_TOTAL) * 100)}%` }} /></span>
          <span className="ev-used"><strong>{used}</strong><span className="ev-of">/ {EV_TOTAL}</span></span>
          <span className="ev-left">{used > EV_TOTAL ? t('editor.evOver', { n: used - EV_TOTAL }) : t('editor.evLeft', { n: EV_TOTAL - used })}</span>
        </p>
        {speed && <SpeedLine name={battleSpecies(set)?.name ?? set.species} tier={speed} scarf={speedStat(set).scarf} />}
      </fieldset>
      <div className="editor-side">
      <fieldset className="editor-group">
        <legend>{t('editor.set')}</legend>
        <div className="field" data-tip={itemDesc}>
          <span className="field-head">{t('editor.item')}</span>
          <Combobox label={t('editor.item')} commonLabel={commonLabel(common?.items)} value={set.item} options={itemOptions} description={itemDesc}
            leading={set.item ? <ItemIcon item={set.item} /> : undefined}
            onChange={item => update({ item })} />
        </div>
        <div className="field" data-tip={abilityDesc}>
          <span className="field-head">
            {t('editor.ability')}
            {megaAbility && <small className="field-note">{t('editor.megaAbilityNote')}</small>}
          </span>
          {megaAbility ? (
            <span title={t('editor.megaAbility')}>
              <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={megaAbility} options={[abilityOption(megaAbility, lang)]} restricted disabled
                description={abilityDesc} onChange={() => undefined} />
            </span>
          ) : (
            <Combobox label={t('editor.ability')} commonLabel={commonLabel(common?.abilities)} value={set.ability} options={abilityOptions} restricted={!custom}
              description={abilityDesc} onChange={ability => update({ ability })} />
          )}
        </div>
        <div className="field">
          <span className="field-head">{t('editor.nature')}</span>
          <Combobox label={t('editor.nature')} commonLabel={commonLabel(common?.natures)} value={set.nature} options={natureOptions} restricted
            display={<><span>{natureName(set.nature, lang)}</span>{set.nature && <NatureEffect name={set.nature} />}</>}
            onChange={nature => update({ nature })} />
        </div>
        <div className="field">
          <span className="field-head">
            {t('editor.tera')}
            {teraBannedIn && <small className="field-note">{t('editor.teraBanned', { format: teraBannedIn })}</small>}
          </span>
          <Combobox label={t('editor.tera')} commonLabel={commonLabel(common?.teraTypes)} value={set.teraType ?? ''} options={teraOptions} restricted disabled={!!teraBannedIn}
            display={set.teraType ? <TypeChip type={set.teraType} /> : <span className="faint">{t('editor.none')}</span>}
            onChange={tera => update({ teraType: tera || undefined })} />
        </div>
      </fieldset>
      <fieldset className="editor-group moves">
        <legend>{t('editor.moves')}</legend>
        {moves.map((move, i) => (
          <div key={i} className={`field${proposedSlot === i ? ' is-proposed' : ''}`} data-tip={describe.move(move, lang)}>
            <span className="field-head">
              {t('editor.move', { n: i + 1 })}
              <MoveDetail name={move} />
            </span>
            <Combobox
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
        // Ruoli e, fuori dal riquadro in basso a destra, l'azione sul membro (Sostituisci)
        <div className="editor-foot">
          {!!roles?.length && (
            <fieldset className="editor-roles">
              <legend>{t('editor.roles')}</legend>
              <ul>
                {roles.map((role, i) => <li key={role} className={i === 0 ? 'main' : undefined}>{role}</li>)}
              </ul>
            </fieldset>
          )}
          {memberAction}
        </div>
      )}
    </div>
  );
}
