import { type CSSProperties, useDeferredValue, useMemo, useState } from 'react';
import type { StatID } from '@pkmn/dex';
import type { EngineData } from '../engine/data';
import { getMove, getSpecies, moveNames, toID } from '../engine/dex';
import { editorDuel, worstThreat, type DuelHit, type EvTip } from '../engine/editorDuel';
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
import { PokemonIcon } from './PokemonName';
import { moveTint } from './MovePill';
import { Sprite, typeColor } from './Sprite';
import { typeIconUrl } from './typeIcons';

/** Un set possibile dell'avversario: il più usato nel meta, i preset Smogon, o quello di base se non c'è altro. */
interface OppSet { key: string; label: string; set: TeamSet }

function oppSets(data: EngineData, species: string, genLimit: number, usageLabel: string, baseLabel: string): OppSet[] {
  const list: OppSet[] = [];
  const usage = mostCommonSet(data.stats, species);
  if (usage) list.push({ key: 'usage', label: usageLabel, set: usage });
  for (const preset of presetsFor(data, species)) list.push({ key: `p:${preset.name}`, label: preset.name, set: preset.set });
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
 * La Sfida dell'editor, come la barra della lotta di Champions: a sinistra il riquadro alto con lo sprite
 * dell'avversario (di partenza, fra i più usati del meta, quello che fa più male al membro); in alto la linguetta con
 * Pokémon, Set, Impostazioni (per ora segnaposto) e sesso; sotto due righe, la spada col tuo colpo migliore e lo scudo
 * col suo che ti fa più male, ognuna con la barra dei PS che restano a chi lo prende e i colpi per il KO, e sotto il
 * consiglio di quella riga (una mossa migliore da mettere nel set, gli EV che spostano una soglia). Si aggiorna mentre si
 * cambiano EV, mosse o strumento.
 */
export function EditorDuel({ set, data, format }: { set: TeamSet; data: EngineData; format: Format }) {
  const t = useT();
  const lang = useLang();
  const me = useDeferredValue(set);
  const [picked, setPicked] = useState<string | null>(null);
  const [setKey, setSetKey] = useState<string | null>(null);

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
  const result = useMemo(() => (chosen ? editorDuel(me, chosen.set, pool) : null), [me, chosen, pool]);

  const hitsText = (hit: DuelHit) => {
    if (!Number.isFinite(hit.hitsMaybe)) return t('editor.duelNoDamage');
    if (hit.hitsSure === hit.hitsMaybe || !Number.isFinite(hit.hitsSure)) {
      const n = Number.isFinite(hit.hitsSure) ? hit.hitsSure : hit.hitsMaybe;
      return n === 1 ? t('editor.duelOneHit') : t('editor.duelHits', { n });
    }
    return t('editor.duelHitsRange', { a: hit.hitsMaybe, b: hit.hitsSure });
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`;
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

  // Una riga: simbolo, mossa (sotto i consigli), barra dei PS che restano a chi prende il colpo, colpi per il KO
  const row = (kind: 'mine' | 'theirs', hit: DuelHit | null, tips: (string | null)[]) => {
    const lo = hit ? Math.max(0, 1 - hit.max) : 1;
    const hi = hit ? Math.max(0, 1 - hit.min) : 1;
    const zone = hi > 0.5 ? 'high' : hi > 0.2 ? 'mid' : 'low';
    const shown = tips.filter((x): x is string => !!x);
    const who = t(kind === 'mine' ? 'editor.duelMine' : 'editor.duelTheirs');
    return (
      <div className={`duel-row ${kind}`}>
        <span className="duel-sym" title={who}>
          <Icon name={kind === 'mine' ? 'sword' : 'shield'} />
          <span className="visually-hidden">{who}</span>
        </span>
        {hit ? (
          <>
            <span className="duel-move"><TypeTile move={hit.move} /><span>{gameName('move', hit.move, lang)}</span></span>
            <span className="duel-hp" data-zone={zone} style={{ '--lo': lo, '--hi': hi } as CSSProperties}>
              <span className="duel-hp-bar" aria-hidden="true" />
              <span className="duel-range">{hit.max > 0 ? `−${pct(hit.min)}–${pct(hit.max)}` : '0%'}</span>
            </span>
            <strong className={`duel-hits${hit.hitsSure === 1 ? ' ko' : ''}`}>{hitsText(hit)}</strong>
          </>
        ) : <span className="duel-none">{t('editor.duelNoMove')}</span>}
        {shown.length > 0 && <span className="duel-tips">{shown.map(x => <span key={x}>{x}</span>)}</span>}
      </div>
    );
  };

  return (
    <fieldset className="editor-group duel">
      <legend>{t('editor.duel')}</legend>
      <div className="duel-card" style={{ '--t1': typeColor(oppTypes[0] ?? ''), '--t2': typeColor(oppTypes[1] ?? oppTypes[0] ?? '') } as CSSProperties}>
        {/* Il riquadro come le carte del team (Masters EX): colore del tipo, riflesso, striscia dei tipi in fondo; in alto il
            nome (dove si cerca l'avversario), sotto lo sprite sulla pedana della lotta */}
        <div className="duel-portrait">
          <Combobox label={t('editor.duelOpponent')} value={species ?? ''} options={speciesOptions} restricted className="duel-species"
            placeholder={t('editor.duelPick')} commonLabel={t('editor.duelCommon')}
            onChange={name => { setPicked(name || null); setSetKey(null); }} />
          {species && <span className="duel-stage" aria-hidden="true"><Sprite species={species} size={96} /></span>}
        </div>
        <div className="duel-tongue">
          {sets.length > 0 && (
            <Combobox label={t('editor.duelSet')} value={chosen?.key ?? ''} restricted disabled={sets.length < 2} className="duel-pill duel-set"
              options={sets.map(s => ({ value: s.key, label: s.label }))}
              display={<span>{chosen?.label}</span>}
              onChange={key => setSetKey(key)} />
          )}
          <button type="button" className="duel-pill duel-settings" aria-disabled="true" title={t('editor.duelSettingsSoon')}>
            {t('editor.duelSettings')}
          </button>
          {species && <GenderMark species={species} />}
        </div>
        {result ? (
          <div className="duel-rows">
            {row('mine', result.mine, [moveText, evText(result.atkTip)])}
            {row('theirs', result.theirs, [evText(result.defTip)])}
          </div>
        ) : <p className="duel-empty">{t('editor.duelEmpty')}</p>}
      </div>
    </fieldset>
  );
}
