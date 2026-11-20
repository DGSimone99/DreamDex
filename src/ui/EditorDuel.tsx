import { type CSSProperties, type ReactNode, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';
import type { StatID } from '@pkmn/dex';
import type { EngineData } from '../engine/data';
import { getMove, getSpecies, itemNames, moveNames, toID } from '../engine/dex';
import { attackBuffs, buffedHit, defenseBuffs, duelSpeed, editorDuel, matchup, mergeEffects, orderOf, rankMatchups, speedBuffs, type DuelBuff, type MatchupVerdict, type DuelHit } from '../engine/editorDuel';
import { metaThreats } from '../engine/attackers';
import { dexPool } from '../engine/coverage';
import type { Format } from '../engine/format';
import { isBannedName, pokedexOf } from '../engine/formats';
import { legalMoves } from '../engine/learnsets';
import { defaultSet, mostCommonSet, presetsFor, type TeamSet } from '../engine/sets';
import { usageOf } from '../engine/stats';
import { formatPercent, type Lang } from '../i18n';
import { gameName, statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox, type ComboOption } from './Combobox';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { PokemonIcon } from './PokemonName';
import { useMemberTip } from './MemberCard';
import { DuelTips, type QuickTip } from './DuelTips';
import { useDuelTips } from './useDuelTips';
import { MovePill } from './MovePill';
import { StatIcon } from './StatIcon';
import { Sprite, typeColor } from './Sprite';
import { typeIconUrl } from './typeIcons';

/** Un set possibile dell'avversario: il più usato nel meta, i preset Smogon, o quello di base se non c'è altro. */
interface OppSet { key: string; label: string; set: TeamSet; usage?: boolean }

/**
 * I set possibili dell'avversario. Il primo è quello ricostruito dalle statistiche d'uso (strumento, abilità, EV e mosse
 * più usati): non è per forza un preset Smogon, si chiama col suo strumento e porta il badge Più usato. Poi i preset.
 */
function oppSets(data: EngineData, species: string, genLimit: number, lang: Lang, usageLabel: string, baseLabel: string): OppSet[] {
  const list: OppSet[] = [];
  const usage = mostCommonSet(data.stats, species);
  if (usage) list.push({ key: 'usage', label: usage.item ? gameName('item', usage.item, lang) : usageLabel, set: usage, usage: true });
  for (const preset of presetsFor(data, species)) list.push({ key: `p:${preset.name}`, label: preset.name, set: preset.set });
  if (!list.length) list.push({ key: 'base', label: baseLabel, set: defaultSet(data, species, genLimit) });
  return list;
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
export function EditorDuel({ set, team, data, format, onApply }: {
  set: TeamSet; team: TeamSet[]; data: EngineData; format: Format;
  /** Applica di un consiglio: il set nuovo e il cambio in parole (per l'avviso Annulla). */
  onApply?: (next: TeamSet, change: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const me = useDeferredValue(set);
  // L'avversario scelto, per il membro aperto: all'inizio la sfida peggiore, poi resta quello (anche se cambi il set)
  // finché non ne scegli un altro
  const [choice, setChoice] = useState<{ owner: string; name: string } | null>(null);
  const picked = choice && choice.owner === set.species ? choice.name : null;
  const setPicked = (name: string | null) => setChoice(name ? { owner: set.species, name } : null);
  const [setKey, setSetKey] = useState<string | null>(null);
  // Le Impostazioni dell'avversario: un pannello sotto l'ingranaggio accanto al nome (si chiude con Esc o cliccando fuori)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = () => setSettingsOpen(o => !o);
  // Le modifiche all'avversario (strumento, EV): si azzerano cambiando Pokémon o set
  const [edit, setEdit] = useState<{ item?: string; evs?: Partial<Record<StatID, number>> }>({});
  // I potenziamenti accesi (per id); si spengono cambiando avversario
  const [active, setActive] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setActive(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const settingsRoot = useRef<HTMLDivElement>(null);
  const settingsPop = useRef<HTMLDivElement>(null);
  // Il nome dell'avversario sempre intero (Charizard-Mega-Y: si vede se è la X o la Y): se non ci sta si rimpicciolisce
  // un po' alla volta, fino a 13px
  useLayoutEffect(() => {
    const root = settingsRoot.current;
    const input = root?.querySelector<HTMLInputElement>('.duel-species input');
    if (!root || !input) return;
    // Il testo si misura a parte (un campo che si adatta al contenuto non dice quando il testo esce): lo spazio è quello
    // della riga del nome meno sesso, ingranaggio e i margini interni del campo
    // Una tela fuori dalla pagina (nei test, dove non c'è, il nome resta com'è)
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
    const fit = () => {
      input.style.fontSize = '';
      if (!canvas || !input.value) return;
      const cs = getComputedStyle(input);
      const others = [...root.children].filter(child => !child.contains(input))
        .reduce((sum, child) => sum + (child as HTMLElement).getBoundingClientRect().width, 0);
      const gap = parseFloat(getComputedStyle(root).columnGap) || 0;
      const room = root.clientWidth - others - gap * (root.children.length - 1) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
      if (room <= 0) return;
      let size = parseFloat(cs.fontSize);
      const width = (px: number) => { canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`; return canvas.measureText(input.value).width; };
      while (width(size) > room && size > 13) size -= 0.5;
      if (size !== parseFloat(cs.fontSize)) input.style.fontSize = `${size}px`;
    };
    fit();
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    watch?.observe(root);
    // Anche quando la Sfida torna visibile (sul telefono sta in una scheda): da nascosta non si può misurare
    watch?.observe(input);
    return () => watch?.disconnect();
  });
  // Sotto il nome, allineato a sinistra; sopra se sotto non c'è posto (la Sfida sta in fondo al cassetto), sempre nella finestra
  useAnchoredPop(settingsRoot, settingsPop, settingsOpen, { width: 320, gap: 6, sheet: true, onDismiss: () => setSettingsOpen(false) });
  const settingsId = useId();
  // Passando sullo sprite dell'avversario, la carta del suo set (come sulle carte del team)
  const memberTip = useMemberTip(250, undefined, true);
  // Scegliendo una voce di un elenco del pannello, l'elenco si chiude già alla pressione del tasto: il clic che segue
  // e il rilascio che lo precede finirebbero sul campo sotto (lo Strumento sotto il Set, che selezionerebbe il testo). Li si ferma qui.
  const pickedAt = useRef(0);
  useEffect(() => {
    if (!settingsOpen) return;
    const away = (e: PointerEvent) => { if (!settingsRoot.current?.contains(e.target as Node)) setSettingsOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [settingsOpen]);

  const threats = useMemo(() => metaThreats(data).map(threat => threat.set), [data]);
  // Le minacce del meta dalla sfida peggiore alla migliore (seguono il set mentre lo cambi)
  const ranked = useMemo(() => rankMatchups(me, threats.filter(s => toID(s.species) !== toID(me.species))), [me, threats]);
  const worst = ranked[0]?.set.species ?? null;
  const species = picked ?? worst;
  // La sfida peggiore si carica una volta sola: da lì in poi l'avversario resta fisso
  useEffect(() => { if (!picked && worst) setPicked(worst); }, [picked, worst]); // eslint-disable-line react-hooks/exhaustive-deps

  const verdictShort: Record<MatchupVerdict, string> = {
    bad: t('editor.duelVerdictBadShort'), even: t('editor.duelVerdictEvenShort'), good: t('editor.duelVerdictGoodShort'),
  };
  const speciesOptions = useMemo<ComboOption[]>(() => {
    // Prima le minacce del meta, dalla sfida peggiore (col giudizio accanto), poi tutti gli altri in ordine
    const pool = dexPool(format);
    const byName = new Set<string>(pool.map(s => s.name));
    const metaFirst = ranked.filter(r => byName.has(r.set.species)).map(({ set: threat, matchup: m }) => ({
      value: threat.species, label: threat.species, icon: <PokemonIcon name={threat.species} />,
      detail: <span className={`duel-verdict-chip ${m.verdict}`}>{verdictShort[m.verdict]}</span>,
      common: formatPercent(lang, usageOf(data.stats, threat.species)),
    }));
    const inMeta = new Set(metaFirst.map(o => o.value));
    return [...metaFirst, ...pool.filter(s => !inMeta.has(s.name)).map(s => ({ value: s.name, label: s.name, icon: <PokemonIcon name={s.name} /> }))];
  }, [format, ranked, data, lang, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const sets = useMemo(() => (species ? oppSets(data, species, format.genLimit, lang, t('editor.duelUsageSet'), t('editor.duelBaseSet')) : []),
    [data, species, format.genLimit, lang, t]);
  const chosen = sets.find(s => s.key === setKey) ?? sets[0] ?? null;
  const pool = useMemo(() => movePool(me, format), [me.species, me.customSkillset, format]); // eslint-disable-line react-hooks/exhaustive-deps
  // L'avversario in campo: il set scelto con le modifiche fatte nelle Impostazioni
  const opp = useMemo<TeamSet | null>(() => (chosen
    ? { ...chosen.set, ...(edit.item !== undefined ? { item: edit.item } : {}), evs: { ...chosen.set.evs, ...edit.evs } }
    : null), [chosen, edit]);
  const edited = edit.item !== undefined || Object.keys(edit.evs ?? {}).length > 0;
  const result = useMemo(() => (opp ? editorDuel(me, opp, pool) : null), [me, opp, pool]);
  // Il giudizio sull'avversario in campo (col set e le modifiche scelte); "peggiore" se è la prima sfida della classifica
  const verdict = useMemo(() => (opp ? matchup(me, opp).verdict : null), [me, opp]);
  const isWorst = !!species && species === worst && !edited && chosen?.key === sets[0]?.key;
  // Il team con il membro com'è adesso nell'editor (la Sfida segue le modifiche prima che arrivino al team)
  const squad = useMemo(() => team.map(member => (member.species === set.species ? me : member)), [team, set.species, me]);
  const buffs = useMemo(() => (opp && result ? {
    attack: attackBuffs(me, opp, squad, result.mine),
    defense: defenseBuffs(me, opp, squad, result.theirs),
    speed: speedBuffs(me, opp, squad),
  } : null), [me, opp, squad, result]);
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
    return { big: `${hit.hitsMaybe}–${hit.hitsSure}`, unit: t('editor.duelHitsUnit') };
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const oppTypes = species ? getSpecies(species)?.types ?? [] : [];
  const usageBadge = <span className="duel-usage-badge">{t('editor.duelUsageSet')}</span>;
  const evTotal = opp ? Object.values(opp.evs).reduce((acc, n) => acc + (n ?? 0), 0) : 0;

  /** L'etichetta corta di un consiglio di EV, per il chip: "+32 DifSp", "+84 PS +28 DifSp". */
  const evShort = (add: Partial<Record<StatID, number>>) => (Object.entries(add) as [StatID, number][])
    .map(([stat, n]) => `+${n} ${statShort(stat, lang)}`).join(' ');
  // I chip dei consigli subito (dal calcolo della Sfida); i consigli completi arrivano dal calcolo in sottofondo
  const quick: QuickTip[] = [
    ...(result?.defTip ? [{ id: 'def' as const, label: evShort(result.defTip.add) }] : []),
    ...(result?.atkTip ? [{ id: 'atk' as const, label: evShort(result.atkTip.add) }] : []),
    ...(speed?.tip ? [{ id: 'spe' as const, label: evShort({ spe: speed.tip.evs }) }] : []),
    ...(result?.moveTip ? [{ id: 'move' as const, label: gameName('move', result.moveTip.move, lang) }] : []),
  ];
  const meIndex = squad.findIndex(member => member.species === set.species);
  const full = useDuelTips(meIndex >= 0 ? squad : [me], Math.max(0, meIndex), opp, pool, data);

  /** Il nome di chi dà un potenziamento: una mossa (Swords Dance) o un'abilità (Drought); "Sun + Terrain" diviso. */
  const sourceName = (source: string) => source.split(' + ')
    .map(part => (getMove(part) ? gameName('move', part, lang) : gameName('ability', part, lang))).join(' + ');
  const resultText = (buff: DuelBuff) => (buff.first
    ? t(buff.first === 'mine' ? 'editor.duelResultFirstMine' : buff.first === 'theirs' ? 'editor.duelResultFirstTheirs' : 'editor.duelResultTie')
    : buff.hits === 1 ? t('editor.duelResultOne') : t('editor.duelResultHits', { n: buff.hits !== undefined && Number.isFinite(buff.hits) ? buff.hits : '—' }));
  /**
   * Gli interruttori dei potenziamenti accanto alla mossa: acceso, la riga si ricalcola subito (barra, danno, colpi).
   * Verde la danza del set, azzurro il team, rosso quello dell'avversario; cosa fa da solo nel tooltip.
   */
  const buffToggles = (list: DuelBuff[] | undefined) => (list ?? []).map(buff => {
    const source = sourceName(buff.source);
    const on = active.has(buff.id);
    const text = t(buff.against ? 'editor.duelBuffAgainst' : buff.kind === 'team' ? 'editor.duelBuffTeam' : 'editor.duelBuffSetup',
      { source, by: buff.by ?? '', result: resultText(buff) });
    return (
      <button key={buff.id} type="button" className={`duel-buff tip ${buff.against ? 'against' : buff.kind}${on ? ' on' : ''}`}
        aria-pressed={on} data-tip={text} onClick={() => toggle(buff.id)}>
        <span className="duel-check" aria-hidden="true">{on && <Icon name="check" />}</span><span>{source}</span>
      </button>
    );
  });
  const effectOf = (list: DuelBuff[] | undefined) => {
    const on = (list ?? []).filter(b => active.has(b.id));
    return on.length ? mergeEffects(on.map(b => b.apply)) : null;
  };
  /**
   * La Velocità sta sui colpi, non in una riga sua. Una danza che alza colpo e velocità (Eledanza, Danza Drago) è un solo
   * interruttore: acceso, alza tutte e due. Quelle che alzano solo la velocità (Agilità) e il Ventoincoda del team hanno
   * il loro interruttore nella riga di chi ne approfitta.
   */
  const twin = (buff: DuelBuff) => [...(buffs?.attack ?? []), ...(buffs?.defense ?? [])]
    .find(b => b.kind === 'setup' && buff.kind === 'setup' && !!b.against === !!buff.against && b.source === buff.source);
  const speedOnly = (against: boolean) => (buffs?.speed ?? []).filter(b => !!b.against === against && !twin(b));
  const speedOn = (buffs?.speed ?? []).filter(b => active.has(b.id) || (twin(b) && active.has(twin(b)!.id)));
  const speedEffect = speedOn.length ? mergeEffects(speedOn.map(b => b.apply)) : null;
  const speeds = speed ? { mine: Math.floor(speed.mine * (speedEffect?.mine ?? 1)), theirs: Math.floor(speed.theirs * (speedEffect?.theirs ?? 1)) } : null;
  const order = speeds ? orderOf(speeds.mine, speeds.theirs) : null;
  /** L'etichetta della Velocità sul colpo: "» 1° · 328" verde per chi muove prima, rossa per l'altro, gialla se pari. */
  const speedChip = (kind: 'mine' | 'theirs') => {
    if (!speeds || !order) return null;
    const value = kind === 'mine' ? speeds.mine : speeds.theirs;
    // A parole (Primo, Secondo, Pari), non col numero ordinale: si legge senza il tooltip
    const place = t(order === 'tie' ? 'editor.duelSpeedEven' : order === kind ? 'editor.duelSpeedFirst' : 'editor.duelSpeedSecond');
    const tone = order === 'tie' ? 'tie' : order === kind ? 'first' : 'second';
    const said = t(order === 'mine' ? 'editor.duelFirstMine' : order === 'theirs' ? 'editor.duelFirstTheirs' : 'editor.duelSpeedTie');
    return (
      // Solo testo (niente fermata del Tab): il tooltip al passaggio del mouse, per i lettori di schermo la frase intera nascosta
      <span className={`duel-speed tip ${tone}`}
        data-tip={`${t('editor.duelSpeed')}: ${t('editor.duelSpeedVs', { a: speeds.mine, b: speeds.theirs })} · ${said}`}>
        <StatIcon stat="spe" /><b>{place}</b><span>{value}</span>
        <span className="visually-hidden">{`, ${t('editor.duelSpeedVs', { a: speeds.mine, b: speeds.theirs })} · ${said}`}</span>
      </span>
    );
  };

  /**
   * Una riga della scheda: il titolo col simbolo (spada, scudo, Velocità); sotto la mossa nella sua pillola (o le due
   * velocità) con gli interruttori dei potenziamenti; poi la barra dei PS che restano (col timbro KO sopra se va KO in un
   * colpo), il danno e di fianco i colpi; a destra, ferma, la Velocità; in fondo i consigli.
   */
  const line = (className: string, title: ReactNode, label: ReactNode, big: string, unit: string, resultClass: string, sub: ReactNode, tips: ReactNode, chip?: ReactNode) => (
    <div className={`duel-row ${className}`}>
      <span className="duel-title">{title}</span>
      {chip}
      <span className="duel-label">{label}</span>
      {/* I colpi di fianco alla barra, poco dopo la percentuale */}
      <span className="duel-sub">{sub}<strong className={`duel-result ${resultClass}`}><span className="duel-big">{big}</span><span className="duel-unit">{unit}</span></strong></span>
      {tips}
    </div>
  );
  const hitLine = (kind: 'mine' | 'theirs', base: DuelHit | null) => {
    const title = <><Icon name={kind === 'mine' ? 'sword' : 'shield'} /><span className="duel-title-text">{t(kind === 'mine' ? 'editor.duelMineTitle' : 'editor.duelTheirsTitle')}</span></>;
    // La riga dei consigli è una sola, in fondo (sotto il suo colpo); sotto il tuo resta lo spazio vuoto di prima
    const tips = kind === 'theirs' && opp
      ? <DuelTips me={me} opp={opp} quick={quick} result={full} onApply={onApply} />
      : <span className="duel-tips-gap" aria-hidden="true">{' '}</span>;
    const chip = speedChip(kind);
    const list = kind === 'mine' ? buffs?.attack : buffs?.defense;
    const effect = effectOf(list);
    // Coi potenziamenti accesi il colpo si ricalcola (tuo su di lui, o suo su di te)
    const hit = effect && opp ? (kind === 'mine' ? buffedHit(me, opp, effect) : buffedHit(opp, me, effect)) : base;
    const toggles = <>{buffToggles(list)}{buffToggles(speedOnly(kind === 'theirs'))}</>;
    if (!hit) return line(kind, title, <><span className="duel-none">{t('editor.duelNoMove')}</span>{toggles}</>, '—', '', 'none', null, tips, chip);
    const { big, unit } = hitsParts(hit);
    const left = Math.max(0, 100 - Math.round(hit.max * 100));
    const tone = left > 50 ? 'good' : left > 20 ? 'warn' : 'bad';
    // Come in Meta Coverage: la barra dei PS che restano; se va KO in un colpo la barra resta (vuota) col timbro KO sopra
    const sub = (
      <>
        <span className="cm-hp duel-bar" aria-hidden="true" data-hp={t('common.hpBar')}>
          <span className="cm-hp-bar"><i className={tone} style={{ width: `${left}%` }} /></span>
          {hit.hitsSure === 1 && <span className="cm-ko small duel-ko">KO</span>}
        </span>
        <span className="duel-range">{hit.max > 0 ? `${Math.round(hit.min * 100)}–${pct(hit.max)}` : '0%'}</span>
      </>
    );
    const ko = hit.hitsSure === 1 ? (kind === 'mine' ? 'good' : 'bad') : 'plain';
    return line(kind, title, <><MovePill name={hit.move} size="sm" className="duel-mvp" />{toggles}</>, big, unit, ko, sub, tips, chip);
  };

  return (
    <fieldset className="editor-group duel">
      <legend>{t('editor.duel')}</legend>
      {/* La scheda tagliata in diagonale (come le carte di Masters): a sinistra il colore del tipo dell'avversario col nome
          grande (dove lo si cerca), Set, Impostazioni e lo sprite che sborda in basso; a destra le tre righe */}
      <div className="duel-card" style={{ '--t1': typeColor(oppTypes[0] ?? ''), '--t2': typeColor(oppTypes[1] ?? oppTypes[0] ?? '') } as CSSProperties}>
        <div className="duel-art" aria-hidden="true" />
        {/* Lo sprite fuori dallo sfondo ritagliato e sopra le righe: se è largo può sbordare un po' */}
        {species && <span className="duel-stage" aria-hidden="true" {...(opp ? memberTip.bind(opp) : {})}><Sprite species={species} size={96} /></span>}
        {memberTip.tip}
        <div className="duel-head">
          {/* Il nome (dove si cerca l'avversario), il sesso e l'ingranaggio delle Impostazioni: lì si sceglie il Set Smogon
              (e, in arrivo, strumento, EV e potenziamenti) */}
          {verdict && (
            <span className={`duel-verdict tip ${isWorst ? 'worst' : verdict}`} data-tip={t('editor.duelVerdictTip')}>
              {t(isWorst ? 'editor.duelVerdictWorst' : verdict === 'bad' ? 'editor.duelVerdictBad' : verdict === 'even' ? 'editor.duelVerdictEven' : 'editor.duelVerdictGood')}
              <span className="visually-hidden">. {t('editor.duelVerdictTip')}</span>
            </span>
          )}
          <div className="duel-name" ref={settingsRoot}
            onKeyDown={e => { if (e.key === 'Escape' && settingsOpen) { e.stopPropagation(); setSettingsOpen(false); } }}>
            <Combobox label={t('editor.duelOpponent')} value={species ?? ''} options={speciesOptions} restricted searchable className={`duel-species${(species?.length ?? 0) > 16 ? " longer" : (species?.length ?? 0) > 11 ? " long" : ""}`}
              placeholder={t('editor.duelPick')} commonLabel={t('editor.duelCommonRanked')} menuMinWidth={280}
              onChange={name => { setPicked(name || null); setSetKey(null); setEdit({}); setActive(new Set()); }} />
            {species && <GenderMark species={species} />}
            {species && (
              <button type="button" className="duel-settings" aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls={settingsId}
                aria-label={t('editor.duelSettings')} title={t('editor.duelSettings')} onClick={toggleSettings}>
                <Icon name="gear" />
              </button>
            )}
            {settingsOpen && (
              <div className="duel-settings-pop" ref={settingsPop} popover={supportsPopover ? 'manual' : undefined} id={settingsId} role="dialog" aria-label={t('editor.duelSettings')}
                onMouseDownCapture={e => { if ((e.target as Element).closest('[role="option"]')) pickedAt.current = Date.now(); }}
                onMouseUpCapture={e => {
                  if (Date.now() - pickedAt.current < 600 && !(e.target as Element).closest('[role="option"]')) { e.stopPropagation(); e.preventDefault(); }
                }}
                onClickCapture={e => {
                  if (Date.now() - pickedAt.current < 600 && !(e.target as Element).closest('[role="option"]')) {
                    e.stopPropagation();
                    e.preventDefault();
                    pickedAt.current = 0;
                  }
                }}>
                {sets.length > 0 && (
                  <div className="duel-settings-row">
                    <span className="duel-settings-label">{t('editor.set')}</span>
                    <Combobox label={t('editor.duelSet')} value={chosen?.key ?? ''} restricted disabled={sets.length < 2} className="duel-set"
                      options={sets.map(s => ({ value: s.key, label: s.label, ...(s.usage ? { detail: usageBadge } : {}) }))}
                      display={<><span>{chosen?.label}</span>{chosen?.usage && usageBadge}</>}
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
                          <span className="duel-ev-name"><StatIcon stat={stat} />{statShort(stat, lang)}</span>
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
              </div>
            )}
          </div>
        </div>
        {result ? (
          <div className="duel-rows">
            {hitLine('mine', result.mine)}
            {hitLine('theirs', result.theirs)}
          </div>
        ) : <p className="duel-empty">{t('editor.duelEmpty')}</p>}
      </div>
    </fieldset>
  );
}
