import { type CSSProperties, type ReactNode, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { StatID } from '@pkmn/dex';
import type { EngineData } from '../engine/data';
import { getMove, getSpecies, itemNames, moveNames, toID } from '../engine/dex';
import { duelSpeed, editorDuel, worstThreat, type DuelHit, type EvTip } from '../engine/editorDuel';
import { metaThreats } from '../engine/attackers';
import { dexPool } from '../engine/coverage';
import type { Format } from '../engine/format';
import { isBannedName, pokedexOf } from '../engine/formats';
import { legalMoves } from '../engine/learnsets';
import { defaultSet, mostCommonSet, presetsFor, type TeamSet } from '../engine/sets';
import { usageOf } from '../engine/stats';
import { formatPercent } from '../i18n';
import { gameName, statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { PokemonIcon } from './PokemonName';
import { moveTint } from './MovePill';
import { Sprite, typeColor } from './Sprite';
import { StatIcon } from './StatIcon';
import { typeIconUrl } from './typeIcons';

/** Un set possibile dell'avversario: il più usato nel meta, i preset Smogon, o quello di base se non c'è altro. */
interface OppSet { key: string; label: string; set: TeamSet }

/** Quanto due set si somigliano: stesso strumento 2, stessa abilità 1, ogni mossa in comune 1. */
function likeness(a: TeamSet, b: TeamSet): number {
  const moves = new Set(b.moves.map(toID));
  return (toID(a.item) === toID(b.item) ? 2 : 0) + (toID(a.ability) === toID(b.ability) ? 1 : 0) + a.moves.filter(m => moves.has(toID(m))).length;
}

function oppSets(data: EngineData, species: string, genLimit: number, usageLabel: string, baseLabel: string): OppSet[] {
  const list: OppSet[] = [];
  const usage = mostCommonSet(data.stats, species);
  const presets = presetsFor(data, species);
  if (usage) {
    // Il set più usato col nome del preset Smogon che gli somiglia di più (almeno strumento e una mossa, o tre mosse)
    const near = presets.map(p => ({ p, score: likeness(usage, p.set) })).sort((a, b) => b.score - a.score)[0];
    list.push({ key: 'usage', label: near && near.score >= 3 ? near.p.name : usageLabel, set: usage });
  }
  for (const preset of presets) list.push({ key: `p:${preset.name}`, label: preset.name, set: preset.set });
  if (!list.length) list.push({ key: 'base', label: baseLabel, set: defaultSet(data, species, genLimit) });
  return list;
}

/** La tessera del tipo della mossa, come nelle pillole delle mosse. */
function TypeTile({ move }: { move: string }) {
  const type = getMove(move)?.type;
  return <span className="mvp-ic" style={{ '--c': moveTint(move) } as CSSProperties}>{type && <img src={typeIconUrl(type)} alt="" draggable={false} />}</span>;
}

/** Il sesso fisso della specie come in Champions (maschio azzurro, femmina rosa); niente se può essere entrambi o nessuno. */
function GenderMark({ species }: { species: string }) {
  const gender = getSpecies(species)?.gender;
  if (gender !== 'M' && gender !== 'F') return null;
  return (
    <svg className={`duel-gender ${gender === 'M' ? 'male' : 'female'}`} viewBox="0 0 24 24" aria-hidden="true">
      {gender === 'M'
        ? <path d="M10 20a6 6 0 1 1 0-12 6 6 0 0 1 0 12ZM14.3 9.7 20 4M14.5 4H20v5.5" />
        : <path d="M12 15a6 6 0 1 1 0-12 6 6 0 0 1 0 12ZM12 15v7M8.5 18.5h7" />}
    </svg>
  );
}

/** Le mosse fra cui cercare un colpo migliore: quelle imparabili (tutte col Custom Skillset), senza quelle vietate. */
function movePool(set: TeamSet, format: Format): string[] {
  const legal = set.customSkillset ? null : legalMoves(set.species, format.genLimit, format.game);
  const sv = pokedexOf(format) === 'sv';
  const names = legal ? [...legal].map(id => getMove(id)?.name ?? id) : moveNames();
  return names.filter(name => (!sv || !getMove(name)?.isNonstandard) && (format.ignoreBans || !isBannedName(format.formatId, 'moves', name)));
}

/**
 * La Sfida dell'editor, una scheda tagliata in diagonale: a sinistra l'avversario (di partenza, fra i più usati del meta,
 * quello che fa più male al membro) col nome grande, Set, Impostazioni (per ora segnaposto), sesso e sprite nel colore del
 * suo tipo; a destra tre righe col risultato grande: il tuo colpo migliore, il suo che ti fa più male (barra dei PS che
 * restano a chi lo prende) e la Velocità, ognuna coi suoi consigli (mossa migliore, EV). Si aggiorna mentre si cambia il set.
 */
export function EditorDuel({ set, data, format }: { set: TeamSet; data: EngineData; format: Format }) {
  const t = useT();
  const lang = useLang();
  const me = useDeferredValue(set);
  const [picked, setPicked] = useState<string | null>(null);
  const [setKey, setSetKey] = useState<string | null>(null);
  // Le Impostazioni dell'avversario: un pannello sotto l'ingranaggio accanto al nome (si chiude con Esc o cliccando fuori)
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Verso l'alto quando sotto l'ingranaggio non c'è posto (la Sfida sta in fondo al cassetto): niente barra di scorrimento
  const [settingsUp, setSettingsUp] = useState(true);
  const toggleSettings = (button: HTMLElement) => {
    if (!settingsOpen) {
      const box = button.closest('.drawer')?.getBoundingClientRect();
      const below = (box ? Math.min(box.bottom, window.innerHeight) : window.innerHeight) - button.getBoundingClientRect().bottom;
      setSettingsUp(below < 330);
    }
    setSettingsOpen(o => !o);
  };
  // Le modifiche all'avversario (strumento, EV): si azzerano cambiando Pokémon o set
  const [edit, setEdit] = useState<{ item?: string; evs?: Partial<Record<StatID, number>> }>({});
  const settingsRoot = useRef<HTMLDivElement>(null);
  const settingsId = useId();
  useEffect(() => {
    if (!settingsOpen) return;
    const away = (e: PointerEvent) => { if (!settingsRoot.current?.contains(e.target as Node)) setSettingsOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [settingsOpen]);

  const threats = useMemo(() => metaThreats(data).map(threat => threat.set), [data]);
  const auto = useMemo(() => (picked ? null : worstThreat(me, threats.filter(s => toID(s.species) !== toID(me.species)))), [picked, me, threats]);
  const species = picked ?? auto?.species ?? null;

  const speciesOptions = useMemo<ComboOption[]>(() => {
    const top = new Set(threats.map(s => s.species));
    return dexPool(format).map(s => ({
      value: s.name, label: s.name, icon: <PokemonIcon name={s.name} />,
      ...(top.has(s.name) ? { common: formatPercent(lang, usageOf(data.stats, s.name)) } : {}),
    }));
  }, [format, threats, data, lang]);

  const sets = useMemo(() => (species ? oppSets(data, species, format.genLimit, t('editor.duelUsageSet'), t('editor.duelBaseSet')) : []),
    [data, species, format.genLimit, t]);
  const chosen = sets.find(s => s.key === setKey) ?? sets[0] ?? null;
  const pool = useMemo(() => movePool(me, format), [me.species, me.customSkillset, format]); // eslint-disable-line react-hooks/exhaustive-deps
  // L'avversario in campo: il set scelto con le modifiche fatte nelle Impostazioni
  const opp = useMemo<TeamSet | null>(() => (chosen
    ? { ...chosen.set, ...(edit.item !== undefined ? { item: edit.item } : {}), evs: { ...chosen.set.evs, ...edit.evs } }
    : null), [chosen, edit]);
  const edited = edit.item !== undefined || Object.keys(edit.evs ?? {}).length > 0;
  const result = useMemo(() => (opp ? editorDuel(me, opp, pool) : null), [me, opp, pool]);
  const speed = useMemo(() => (opp ? duelSpeed(me, opp) : null), [me, opp]);
  const itemOptions = useMemo<ComboOption[]>(() => itemNames().map(name => ({
    value: name, label: gameName('item', name, lang), alias: name, icon: <ItemIcon item={name} />,
  })), [lang]);

  /** I colpi per il KO scritti grandi ("1", "2-3") con l'unità sotto ("colpo", "colpi"). */
  const hitsParts = (hit: DuelHit): { big: string; unit: string } => {
    if (!Number.isFinite(hit.hitsMaybe)) return { big: '—', unit: t('editor.duelNoDamage') };
    if (hit.hitsSure === hit.hitsMaybe || !Number.isFinite(hit.hitsSure)) {
      const n = Number.isFinite(hit.hitsSure) ? hit.hitsSure : hit.hitsMaybe;
      return { big: String(n), unit: t(n === 1 ? 'editor.duelHitUnit' : 'editor.duelHitsUnit') };
    }
    return { big: `${hit.hitsMaybe}-${hit.hitsSure}`, unit: t('editor.duelHitsUnit') };
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const evTotal = opp ? Object.values(opp.evs).reduce((acc, n) => acc + (n ?? 0), 0) : 0;
  const oppTypes = species ? getSpecies(species)?.types ?? [] : [];

  const free = 510 - Object.values(set.evs).reduce((acc, n) => acc + (n ?? 0), 0);
  const evText = (tip: EvTip | null) => {
    if (!tip) return null;
    // "+84 EV in PS e +20 in Dif"
    const parts = (Object.entries(tip.add) as [StatID, number][])
      .map(([stat, n], i) => t(i === 0 ? 'editor.duelTipEvs' : 'editor.duelTipEvsMore', { n, stat: statShort(stat, lang) })).join(' ');
    const text = tip.side === 'defense'
      ? t('editor.duelTipDef', { evs: parts, n: tip.hits })
      : t(tip.hits === 1 ? 'editor.duelTipAtkOne' : 'editor.duelTipAtk', { evs: parts, n: tip.hits });
    return tip.total > free ? `${text} ${t('editor.duelTipElsewhere')}` : text;
  };
  const moveTip = result?.moveTip;
  const moveText = moveTip
    ? t(moveTip.hits === 1 ? 'editor.duelTipMoveOne' : 'editor.duelTipMove', { move: gameName('move', moveTip.move, lang), n: moveTip.hits })
    : null;

  /**
   * Una riga della scheda: tessera (tipo della mossa o Velocità) e nome, sotto la barra o il dato e i consigli; a destra
   * il risultato grande con l'unità sotto. Chi colpisce si legge dalla tessera e dal titolo (Tu / Lui) per i lettori di schermo.
   */
  const line = (className: string, who: string, tile: ReactNode, label: ReactNode, big: string, unit: string, resultClass: string, sub: ReactNode, tips: (string | null)[]) => {
    const shown = tips.filter((x): x is string => !!x);
    return (
      <div className={`duel-row ${className}`}>
        <span className="duel-tile">{tile}</span>
        <span className="duel-label"><span className="visually-hidden">{who}: </span>{label}</span>
        <strong className={`duel-result ${resultClass}`}><span className="duel-big">{big}</span><span className="duel-unit">{unit}</span></strong>
        <span className="duel-sub">{sub}</span>
        {shown.length > 0 && <span className="duel-tips">{shown.map(x => <span key={x}>{x}</span>)}</span>}
      </div>
    );
  };
  const hitLine = (kind: 'mine' | 'theirs', hit: DuelHit | null, tips: (string | null)[]) => {
    const who = t(kind === 'mine' ? 'editor.duelMine' : 'editor.duelTheirs');
    if (!hit) return line(kind, who, <Icon name={kind === 'mine' ? 'sword' : 'shield'} />, <span className="duel-none">{t('editor.duelNoMove')}</span>, '—', '', 'none', null, []);
    const lo = Math.max(0, 1 - hit.max);
    const hi = Math.max(0, 1 - hit.min);
    const zone = hi > 0.5 ? 'high' : hi > 0.2 ? 'mid' : 'low';
    const { big, unit } = hitsParts(hit);
    const sub = (
      <span className="duel-hp" data-zone={zone} style={{ '--lo': lo, '--hi': hi } as CSSProperties}>
        <span className="duel-hp-bar" aria-hidden="true" />
        <span className="duel-range">{hit.max > 0 ? `−${pct(hit.min)}–${pct(hit.max)}` : '0%'}</span>
      </span>
    );
    const ko = hit.hitsSure === 1 ? (kind === 'mine' ? 'good' : 'bad') : 'plain';
    return line(kind, who, <TypeTile move={hit.move} />, gameName('move', hit.move, lang), big, unit, ko, sub, tips);
  };

  // La Velocità: le due velocità in lotta (Sciarpa e Booster comprese), chi muove prima e, se serve, gli EV per superarlo
  const speedTip = speed?.tip
    ? `${t('editor.duelTipSpe', { n: speed.tip.evs })}${speed.tip.evs > free ? ` ${t('editor.duelTipElsewhere')}` : ''}`
    : null;
  const speedLine = speed && line(
    'speed', t('editor.duelSpeed'), <span className="duel-stat"><StatIcon stat="spe" /></span>,
    <>{t('editor.duelSpeed')} <span className="duel-speed-vs">{t('editor.duelSpeedVs', { a: speed.mine, b: speed.theirs })}</span></>,
    speed.order === 'mine' ? '1°' : speed.order === 'theirs' ? '2°' : '=',
    t(speed.order === 'mine' ? 'editor.duelFirstMine' : speed.order === 'theirs' ? 'editor.duelFirstTheirs' : 'editor.duelSpeedTie'),
    speed.order === 'mine' ? 'good' : speed.order === 'theirs' ? 'bad' : 'warn', null, [speedTip],
  );

  return (
    <fieldset className="editor-group duel">
      <legend>{t('editor.duel')}</legend>
      {/* La scheda tagliata in diagonale (come le carte di Masters): a sinistra il colore del tipo dell'avversario col nome
          grande (dove lo si cerca), Set, Impostazioni e lo sprite che sborda in basso; a destra le tre righe */}
      <div className="duel-card" style={{ '--t1': typeColor(oppTypes[0] ?? ''), '--t2': typeColor(oppTypes[1] ?? oppTypes[0] ?? '') } as CSSProperties}>
        <div className="duel-art" aria-hidden="true">
          {species && <span className="duel-stage"><Sprite species={species} size={96} /></span>}
        </div>
        <div className="duel-head">
          {/* Il nome (dove si cerca l'avversario), il sesso e l'ingranaggio delle Impostazioni: lì si sceglie il Set Smogon
              (e, in arrivo, strumento, EV e potenziamenti) */}
          <div className="duel-name" ref={settingsRoot}
            onKeyDown={e => { if (e.key === 'Escape' && settingsOpen) { e.stopPropagation(); setSettingsOpen(false); } }}>
            <Combobox label={t('editor.duelOpponent')} value={species ?? ''} options={speciesOptions} restricted className={`duel-species${(species?.length ?? 0) > 16 ? " longer" : (species?.length ?? 0) > 11 ? " long" : ""}`}
              placeholder={t('editor.duelPick')} commonLabel={t('editor.duelCommon')}
              onChange={name => { setPicked(name || null); setSetKey(null); setEdit({}); }} />
            {species && <GenderMark species={species} />}
            {species && (
              <button type="button" className="duel-settings" aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls={settingsId}
                aria-label={t('editor.duelSettings')} title={t('editor.duelSettings')} onClick={e => toggleSettings(e.currentTarget)}>
                <Icon name="gear" />
              </button>
            )}
            {settingsOpen && (
              <div className={`duel-settings-pop${settingsUp ? ' up' : ''}`} id={settingsId} role="dialog" aria-label={t('editor.duelSettings')}>
                {sets.length > 0 && (
                  <div className="duel-settings-row">
                    <span className="duel-settings-label">{t('editor.set')}</span>
                    <Combobox label={t('editor.duelSet')} value={chosen?.key ?? ''} restricted disabled={sets.length < 2} className="duel-set"
                      options={sets.map(s => ({ value: s.key, label: s.label }))}
                      display={<span>{chosen?.label}</span>}
                      onChange={key => { setSetKey(key); setEdit({}); }} />
                  </div>
                )}
                {opp && (
                  <>
                    <div className="duel-settings-row">
                      <span className="duel-settings-label">{t('editor.item')}</span>
                      <Combobox label={t('editor.duelItem')} value={opp.item} options={itemOptions} className="duel-item"
                        leading={opp.item ? <ItemIcon item={opp.item} /> : undefined}
                        onChange={item => setEdit(e => ({ ...e, item }))} />
                    </div>
                    {/* Gli EV a coppie: PS e Velocità, i due attacchi, le due difese */}
                    <div className="duel-evs">
                      <span className="duel-settings-label">EV</span>
                      <span className={`duel-ev-total${evTotal > 510 ? ' over' : ''}`}>{evTotal} / 510</span>
                      {(['hp', 'spe', 'atk', 'spa', 'def', 'spd'] as StatID[]).map(stat => (
                        <label key={stat} className="duel-ev">
                          <span>{statShort(stat, lang)}</span>
                          <input type="number" inputMode="numeric" min={0} max={252} step={2} value={opp.evs[stat] ?? 0}
                            className={`ev-input${opp.evs[stat] ? '' : ' zero'}`}
                            aria-label={t('editor.duelEv', { stat: statShort(stat, lang) })}
                            onChange={e => {
                              const n = Math.min(252, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                              setEdit(prev => ({ ...prev, evs: { ...prev.evs, [stat]: n } }));
                            }} />
                        </label>
                      ))}
                    </div>
                    {edited && <button type="button" className="duel-reset" onClick={() => setEdit({})}>{t('editor.duelReset')}</button>}
                  </>
                )}
                <p className="duel-settings-soon">{t('editor.duelSettingsSoon')}</p>
              </div>
            )}
          </div>
        </div>
        {result ? (
          <div className="duel-rows">
            {hitLine('mine', result.mine, [moveText, evText(result.atkTip)])}
            {hitLine('theirs', result.theirs, [evText(result.defTip)])}
            {speedLine}
          </div>
        ) : <p className="duel-empty">{t('editor.duelEmpty')}</p>}
      </div>
    </fieldset>
  );
}
