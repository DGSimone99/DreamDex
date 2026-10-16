import { useMemo } from 'react';
import { battleSpecies, dex, getMove, getSpecies, itemNames, moveNames, natureNames } from '../engine/dex';
import { legalAbilities, legalMoves } from '../engine/learnsets';
import { formatName, sameSet, STAT_IDS, type Preset, type StatID, type TeamSet } from '../engine/sets';
import { TYPES } from '../engine/types';
import type { CommonChoice, CommonChoices, CommonSpread } from '../engine/common';
import { formatPercent, type Lang } from '../i18n';
import { gameDesc, gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { describe } from './describe';
import { SpeedLine } from './SpeedLine';
import { speedStat, type SpeedTier } from '../engine/speed';
import { TypeChip } from './Sprite';
import { ItemIcon } from './ItemIcon';
import { Icon } from './icons';
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
        <span className="visually-hidden">{category}, {t('editor.power')} </span>
        {move.basePower || '—'}
      </span>
      <span className="move-stat accuracy" title={t('editor.accuracy')}>
        <Icon name="target" />
        <span className="visually-hidden">{t('editor.accuracyShort')} </span>
        {accuracy === null ? '—' : `${accuracy}%`}
      </span>
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

const clampEv = (value: number) => Math.min(252, Math.max(0, Number.isFinite(value) ? value : 0));

interface Props {
  set: TeamSet;
  /** Set con nome delle analisi Smogon (al massimo 5). */
  presets?: Preset[];
  /** Limite di generazione: mosse e abilità legali fino a questa gen. */
  genLimit: number;
  /** Scelte più usate del membro, mostrate in cima ai menu. */
  common?: CommonChoices;
  /** Nome del formato se vieta il Tera: campo disattivato con la nota (il valore resta salvato). */
  teraBannedIn?: string;
  /** Velocità del membro tra i più usati del meta (null senza statistiche). */
  speed?: SpeedTier | null;
  onChange: (set: TeamSet) => void;
}

/** Voce del menu dei preset per un set che non coincide con nessun preset. */
const CUSTOM_PRESET = 'custom';

export function SetEditor({ set, presets = [], genLimit, common, teraBannedIn, speed, onChange }: Props) {
  const t = useT();
  const lang = useLang();
  // Le più usate vanno in cima al menu, con la quota d'uso (o "Preset" se vengono dalle analisi)
  const withCommon = (options: ComboOption[], choices: CommonChoice[] | undefined): ComboOption[] => {
    if (!choices?.length) return options;
    const byValue = new Map(options.map(o => [o.value, o]));
    const top = choices.flatMap(c => {
      const option = byValue.get(c.name);
      return option ? [{ ...option, common: c.share === null ? t('combobox.preset') : formatPercent(lang, c.share, 0) }] : [];
    });
    const picked = new Set(top.map(o => o.value));
    return [...top, ...options.filter(o => !picked.has(o.value))];
  };
  const commonKey = JSON.stringify(common ?? null);
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
    const names = legal ? [...legal].map(id => getMove(id)?.name ?? id).sort() : ALL_MOVES;
    return withCommon(names.map(name => moveOption(name, lang)), common?.moves);
  }, [custom, set.species, genLimit, lang, commonKey]);
  const itemOptions = useMemo<ComboOption[]>(() => withCommon(ITEMS.map(name => ({
    value: name, label: gameName('item', name, lang), description: describe.item(name, lang), icon: <ItemIcon item={name} />,
  })), common?.items), [lang, commonKey]);
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
  const update = (patch: Partial<TeamSet>) => onChange({ ...set, ...patch });
  // Preset: la chiave è la posizione. Se il set coincide con un preset è selezionato quello,
  // altrimenti (appena modifichi qualcosa) la voce "Custom"
  const presetOptions: ComboOption[] = [
    ...presets.map((preset, i) => ({
      value: String(i),
      label: preset.name,
      detail: <span className="preset-format">{formatName(preset.format)}</span>,
      description: preset.set.moves.map(move => gameName('move', move, lang)).join(' · '),
    })),
    { value: CUSTOM_PRESET, label: t('editor.customPreset'), detail: <span className="preset-format">{t('editor.customPresetTag')}</span>, description: t('editor.customPresetDesc') },
  ];
  const appliedIndex = presets.findIndex(p => sameSet(p.set, set));
  const applyPreset = (key: string) => {
    const preset = presets[Number(key)];
    if (preset) onChange({ ...preset.set, species: set.species, favorite: set.favorite, customSkillset: set.customSkillset });
  };
  const itemDesc = describe.item(set.item, lang);
  // Con la megapietra l'abilità è quella della Mega: si mostra bloccata, quella del set torna togliendo la pietra
  const forme = battleSpecies(set);
  const megaAbility = forme && species && forme.name !== species.name ? forme.abilities[0] : null;
  const shownAbility = megaAbility ?? set.ability;
  const abilityDesc = describe.ability(shownAbility, lang);

  return (
    <div className="set-editor">
      <div className="editor-head">
        <div className="field preset-field">
          <Combobox
            label={t('editor.presets')}
            value={presets.length === 0 ? '' : appliedIndex >= 0 ? String(appliedIndex) : CUSTOM_PRESET}
            options={presetOptions}
            restricted
            disabled={presets.length === 0}
            placeholder={presets.length ? t('editor.presetsPlaceholder') : t('editor.noPresets')}
            display={presets.length === 0 ? undefined : appliedIndex >= 0
              ? <><span>{presets[appliedIndex].name}</span><span className="preset-format">{formatName(presets[appliedIndex].format)}</span></>
              : <><span>{t('editor.customPreset')}</span><span className="preset-format">{t('editor.customPresetTag')}</span></>}
            onChange={applyPreset}
          />
        </div>
        <label className="custom-toggle" title={t('editor.customTooltip')}>
          <input
            type="checkbox"
            aria-label={t('editor.custom', { species: set.species })}
            checked={custom}
            onChange={e => update({ customSkillset: e.target.checked || undefined })}
          />{' '}
          {t('editor.customLabel')}
        </label>
      </div>
      <fieldset className="editor-group">
        <legend>{t('editor.set')}</legend>
        <div className="field" data-tip={itemDesc}>
          <span className="field-head">{t('editor.item')}</span>
          <Combobox label={t('editor.item')} value={set.item} options={itemOptions} description={itemDesc}
            leading={set.item ? <ItemIcon item={set.item} /> : undefined}
            onChange={item => update({ item })} />
        </div>
        <div className="field" data-tip={abilityDesc}>
          <span className="field-head">{t('editor.ability')}</span>
          {megaAbility ? (
            <span title={t('editor.megaAbility')}>
              <Combobox label={t('editor.ability')} value={megaAbility} options={[abilityOption(megaAbility, lang)]} restricted disabled
                description={abilityDesc} onChange={() => undefined} />
            </span>
          ) : (
            <Combobox label={t('editor.ability')} value={set.ability} options={abilityOptions} restricted={!custom}
              description={abilityDesc} onChange={ability => update({ ability })} />
          )}
        </div>
        <div className="field">
          <span className="field-head">{t('editor.nature')}</span>
          <Combobox label={t('editor.nature')} value={set.nature} options={natureOptions} restricted
            display={<><span>{natureName(set.nature, lang)}</span>{set.nature && <NatureEffect name={set.nature} />}</>}
            onChange={nature => update({ nature })} />
        </div>
        <div className="field">
          <span className="field-head">
            {t('editor.tera')}
            {teraBannedIn && <small className="field-note">{t('editor.teraBanned', { format: teraBannedIn })}</small>}
          </span>
          <Combobox label={t('editor.tera')} value={set.teraType ?? ''} options={teraOptions} restricted disabled={!!teraBannedIn}
            display={set.teraType ? <TypeChip type={set.teraType} /> : <span className="faint">{t('editor.none')}</span>}
            onChange={tera => update({ teraType: tera || undefined })} />
        </div>
      </fieldset>
      <fieldset className="editor-group moves">
        <legend>{t('editor.moves')}</legend>
        {moves.map((move, i) => (
          <div key={i} className="field" data-tip={describe.move(move, lang)}>
            <span className="field-head">
              {t('editor.move', { n: i + 1 })}
              <MoveDetail name={move} />
            </span>
            <Combobox
              label={t('editor.move', { n: i + 1 })}
              value={move}
              options={moveOptions}
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
      <fieldset className="evs">
        <legend>{t('editor.evs')}</legend>
        {!!common?.spreads.length && (
          // Chiuso di norma
          <details className="spread-panel">
          <summary>{t('editor.spreads')}</summary>
          <div className="spread-presets" role="group" aria-label={t('editor.spreads')}>
            {common.spreads.map(spread => (
              <button
                key={spreadKey(spread)}
                type="button"
                aria-pressed={spreadKey(spread) === spreadKey(set)}
                onClick={() => update({ nature: spread.nature, evs: { ...spread.evs } })}
              >
                <strong>{natureName(spread.nature, lang)}</strong>
                <span className="spread-evs">{spreadText(spread, lang)}</span>
                <span className="common-share">{shareLabel(spread)}</span>
              </button>
            ))}
          </div>
          </details>
        )}
        {STAT_IDS.map(stat => (
          <label key={stat}>
            {statShort(stat, lang).toUpperCase()}
            <input
              type="number"
              min={0}
              max={252}
              step={4}
              value={set.evs[stat] ?? 0}
              onChange={e => update({ evs: { ...set.evs, [stat]: clampEv(Number(e.target.value)) } })}
            />
          </label>
        ))}
        {speed && <SpeedLine name={battleSpecies(set)?.name ?? set.species} tier={speed} scarf={speedStat(set).scarf} />}
      </fieldset>
    </div>
  );
}
