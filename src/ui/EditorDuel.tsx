import { type CSSProperties, useDeferredValue, useMemo, useState } from 'react';
import type { StatID } from '@pkmn/dex';
import type { EngineData } from '../engine/data';
import { getMove, getSpecies, toID } from '../engine/dex';
import { editorDuel, worstThreat, type DuelHit } from '../engine/editorDuel';
import { metaThreats } from '../engine/attackers';
import { dexPool } from '../engine/coverage';
import type { Format } from '../engine/format';
import { defaultSet, mostCommonSet, presetsFor, type TeamSet } from '../engine/sets';
import { usageOf } from '../engine/stats';
import { formatPercent } from '../i18n';
import { gameName, statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
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

/**
 * La Sfida dell'editor, sotto le Mosse: si sceglie un avversario (di partenza, fra i più usati del meta, quello che fa più
 * male al membro) e il suo set; due righe col colpo migliore del membro e con quello che gli fa più male, il danno in
 * quota dei PS e quanti colpi servono; sotto, se c'è, quanti EV in più spostano una soglia. Si aggiorna mentre si
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
  const result = useMemo(() => (chosen ? editorDuel(me, chosen.set) : null), [me, chosen]);

  const hitsText = (hit: DuelHit) => {
    if (!Number.isFinite(hit.hitsMaybe)) return t('editor.duelNoDamage');
    if (hit.hitsSure === hit.hitsMaybe || !Number.isFinite(hit.hitsSure)) {
      const n = Number.isFinite(hit.hitsSure) ? hit.hitsSure : hit.hitsMaybe;
      return n === 1 ? t('editor.duelOneHit') : t('editor.duelHits', { n });
    }
    return t('editor.duelHitsRange', { a: hit.hitsMaybe, b: hit.hitsSure });
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const oppType = species ? getSpecies(species)?.types[0] : undefined;
  // PS che restano all'avversario dopo il tuo colpo migliore (da quello peggiore a quello migliore per lui)
  const left = result?.mine ? (() => {
    const lo = Math.max(0, 1 - result.mine.max), hi = Math.max(0, 1 - result.mine.min);
    const zone = hi > 0.5 ? 'high' : hi > 0.2 ? 'mid' : 'low';
    const text = Math.round(lo * 100) === Math.round(hi * 100) ? pct(hi) : `${Math.round(lo * 100)}–${pct(hi)}`;
    return { lo, hi, zone, text };
  })() : null;
  const row = (kind: 'mine' | 'theirs', hit: DuelHit | null) => (
    <div className={`duel-row ${kind}`}>
      <span className="duel-who">{t(kind === 'mine' ? 'editor.duelMine' : 'editor.duelTheirs')}</span>
      {hit ? (
        <>
          <span className="duel-move"><TypeTile move={hit.move} /><span>{gameName('move', hit.move, lang)}</span></span>
          <span className="duel-bar" aria-hidden="true" style={{ '--lo': Math.min(hit.min, 1), '--hi': Math.min(hit.max, 1) } as CSSProperties} />
          <span className="duel-range">{hit.max > 0 ? `${pct(hit.min)}–${pct(hit.max)}` : '0%'}</span>
          <strong className={`duel-hits${hit.hitsSure === 1 ? ' ko' : ''}`}>{hitsText(hit)}</strong>
        </>
      ) : <span className="duel-none">{t('editor.duelNoMove')}</span>}
    </div>
  );

  const tip = result?.tip;
  const free = 510 - Object.values(set.evs).reduce((acc, n) => acc + (n ?? 0), 0);
  const tipText = tip && (() => {
    // "+84 EV in PS e +20 in Dif"
    const parts = (Object.entries(tip.add) as [StatID, number][])
      .map(([stat, n], i) => t(i === 0 ? 'editor.duelTipEvs' : 'editor.duelTipEvsMore', { n, stat: statShort(stat, lang) })).join(' ');
    const text = tip.side === 'defense'
      ? t('editor.duelTipDef', { evs: parts, n: tip.hits })
      : t(tip.hits === 1 ? 'editor.duelTipAtkOne' : 'editor.duelTipAtk', { evs: parts, n: tip.hits });
    return tip.total > free ? `${text} ${t('editor.duelTipElsewhere')}` : text;
  })();

  return (
    <fieldset className="editor-group duel">
      <legend>{t('editor.duel')}</legend>
      {/* L'avversario come la barra della lotta di Champions: il riquadro con lo sprite e, attaccata in alto, la linguetta
          con Pokémon e Set; sotto la linguetta i PS che gli restano dopo il tuo colpo migliore */}
      <div className="duel-card" style={{ '--tc': typeColor(oppType ?? '') } as CSSProperties}>
        <div className="duel-portrait" aria-hidden="true">{species && <Sprite species={species} size={96} />}</div>
        <div className="duel-tongue">
          <Combobox label={t('editor.duelOpponent')} value={species ?? ''} options={speciesOptions} restricted className="duel-species"
            placeholder={t('editor.duelPick')} commonLabel={t('editor.duelCommon')}
            onChange={name => { setPicked(name || null); setSetKey(null); }} />
          {sets.length > 0 && (
            <Combobox label={t('editor.duelSet')} value={chosen?.key ?? ''} restricted disabled={sets.length < 2} className="duel-set"
              options={sets.map(s => ({ value: s.key, label: s.label }))}
              display={<span>{chosen?.label}</span>}
              onChange={key => setSetKey(key)} />
          )}
        </div>
        {left && (
          <div className="duel-hp" style={{ '--lo': left.lo, '--hi': left.hi } as CSSProperties} data-zone={left.zone}>
            <span className="duel-hp-tag" aria-hidden="true">PS</span>
            <span className="duel-hp-bar" aria-hidden="true" />
            <span className="duel-hp-num">{left.text}</span>
          </div>
        )}
      </div>
      {result ? (
        <>
          {row('mine', result.mine)}
          {row('theirs', result.theirs)}
          {tipText && <p className="duel-tip">{tipText}</p>}
        </>
      ) : <p className="duel-empty">{t('editor.duelEmpty')}</p>}
    </fieldset>
  );
}
