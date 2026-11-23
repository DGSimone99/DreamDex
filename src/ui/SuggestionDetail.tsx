import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EngineData } from '../engine/data';
import { rankedChanges } from '../engine/coach';
import { battleSpecies, getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import type { Archetype } from '../engine/archetype';
import { areaDrops, extrasDelta, rolesDelta, withCandidate, type SwapOption, type TeamGain } from '../engine/teamGain';
import { rulesOf } from '../engine/formatRules';
import { roleLabel } from '../engine/roles';
import { formatPercent } from '../i18n';
import type { Replacement } from '../engine/replace';
import type { Suggestion } from '../engine/scoring';
import { exportShowdown, presetsFor, type TeamSet } from '../engine/sets';
import { SmogonLink } from './SmogonLink';
import type { Format } from '../engine/format';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { copyText } from './clipboard';
import { Icon } from './icons';
import { useFitCount } from './useFit';
import { hint } from './MoveTip';
import { bringsOf, formeParts, kindOfArea, type Bring, type BringKind } from './candidateParts';
import { PokemonIcon } from './PokemonName';
import { battleName, toID } from '../engine/dex';
import { statsEntry } from '../engine/stats';
import { Sprite, typeColor } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { Typed } from './TypeText';
import { MemberKit, MemberMoves, MemberRoles, StatHex } from './MemberCard';
import { typeIconUrl, tileStyle } from './typeIcons';
import type { TypeName } from '../engine/types';


/** L'ordine dei gruppi di Porta e Toglie, e il segno di ognuno (gli stessi delle carte della lista). */
const KINDS: BringKind[] = ['roles', 'defense', 'offense', 'threats', 'synergy', 'warning', 'other'];
const SHORT_KINDS = new Set<BringKind>(['defense', 'offense', 'threats']);

/**
 * Porta o Toglie a gruppi, sempre nello stesso ordine (ruoli, difesa, offesa, minacce, sinergie, avvisi), mostrati come
 * una lista sola: ogni voce una riga col + verde (Porta), il − rosso (Toglie) o il ! giallo (avvisi), come le righe
 * delle carte della lista. Il nome del gruppo resta per i lettori di schermo; i ruoli tutti su una riga.
 */
function BringGroups({ items, side, none }: { items: Bring[]; side: 'gain' | 'loss'; none: string }) {
  const tr = useT();
  if (!items.length) return <p className="bring-none">{none}</p>;
  return (
    <div className={`bring-groups ${side}`}>
      {KINDS.map(kind => {
        const group = items.filter(item => (item.kind ?? 'other') === kind);
        if (!group.length) return null;
        return (
          <div key={kind} className={`bring-group ${kind}`}>
            <span className="visually-hidden">{tr(`detail.group.${kind}`)}</span>
            {kind === 'roles' ? (
              <ul className="bring-items">
                <li><span className="visually-hidden">{side === 'gain' ? '+' : '−'}</span>{group.map(item => item.text).join(' · ')}</li>
              </ul>
            ) : (
              <ul className="bring-items">
                {group.map(item => {
                  // Difesa, Offesa e Minacce: la forma breve ("Colpisce Ghiaccio, Psico"), il gruppo dice già il resto
                  const text = SHORT_KINDS.has(kind) ? item.short : item.text;
                  return <li key={item.text} {...hint(text !== item.text ? item.text : undefined)}><Typed text={text} /></li>;
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Il candidato selezionato nella lista, disegnato come la carta del tooltip: testata nei colori dei tipi coi ruoli e quanto
 * sale il voto, cosa porta e cosa toglie, l'effetto sul team area per area (una riga), il set consigliato (griglia,
 * esagono, pillole delle mosse), le azioni.
 */
export type DetailTab = 'brings' | 'loses' | 'set';
/** Sotto questa altezza del dettaglio intero (portatile basso col team aperto): testata bassa e set su una riga. Si misura
 *  il dettaglio, non il corpo: il corpo cambia proprio passando a basso (la testata si abbassa), e lì sfarfallerebbe. */
const LOW_DETAIL = 400;
/** Solo con lista e dettaglio affiancati il dettaglio ha un'altezza sua (sotto è un foglio che scorre). */
const wideScreen = () => typeof matchMedia !== 'function' || matchMedia('(min-width: 1100px)').matches;

export function SuggestionDetail({ item, rank, team, replaceIndex, data, format, rating, archetype, usage, banMark, actionLabel, onAction, teamCollapsed = false, sheet = false, tab: tabProp, onTab }: {
  item: (Suggestion | Replacement) & { teamGain?: TeamGain; alternatives?: SwapOption[] };
  rank: number;
  team: TeamSet[];
  /** Il membro che il candidato sostituirebbe, o null se si aggiunge. */
  replaceIndex: number | null;
  data: EngineData;
  format: Format;
  /** Voto del team attuale. */
  rating: TeamRating | null;
  /** Tipo di team scelto per giudicare i cambi: prima e dopo si votano come quel tipo, come nella lista. */
  archetype?: Archetype;
  /** Uso nel meta, mostrato al posto del voto col primo Pokémon. */
  usage: number | null;
  banMark: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Lo sprite della lista: il dettaglio mostra l'altro (lista Normale → icona box, lista Icona box → sprite animato). */
  /** Team chiuso: il dettaglio è più alto (si rimisura quando cambia). */
  teamCollapsed?: boolean;
  /** Linguetta aperta quando il dettaglio è a linguette (la tiene il pannello, così resta cambiando candidato). */
  tab?: DetailTab;
  onTab?: (tab: DetailTab) => void;
  /** Telefono: il dettaglio copre la lista come una finestra (il resto della pagina è inerte finché è aperto). */
  sheet?: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const set = item.set;
  const replacing = replaceIndex !== null;
  // Il voto vero del team, come nella card del voto (il tipo scelto decide solo chi compare)
  const after = useMemo(() => rateTeam(withCandidate(team, set, replaceIndex), data, lang), [team, replaceIndex, set, data, lang]);
  // Senza altri membri non c'è un voto da confrontare
  const before = item.teamGain ? rating : null;
  const changes = 'diff' in item && item.diff ? rankedChanges(item.diff, item.teamGain, lang) : null;
  const types = getSpecies(item.species)?.types ?? [];
  const forme = formeParts(item.species);
  const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '');
  const result = item.teamGain;

  // Risolve: tutto, nello stesso ordine delle caselle della lista (che ne mostrano le prime voci). I ruoli no: stanno nel
  // set, una volta sola, coi nuovi per il team in verde ("Usato con X nel N% dei team" no: c'è "Spesso con" qui sotto)
  // Col team vuoto non c'è niente da risolvere: Risolve dice cosa sa fare il Pokémon (i suoi ruoli), come le carte
  const alone = team.length === 0;
  const brings = bringsOf(item, lang, rulesOf(data)).filter(bring => !bring.usedWith && (alone || (bring.kind !== 'roles' && !bring.roles?.length)))
    .flatMap((bring): Bring[] => (bring.roles?.length ? bring.roles.map(text => ({ text, short: text, kind: 'roles' })) : [bring]))
    .filter((bring, i, all) => all.findIndex(other => other.text === bring.text) === i);
  const freshRoles = item.facts.roles?.filled ?? [];
  // Spesso con: fra i 5 compagni più frequenti nel meta, quelli già nel team (senza meta niente: giochi, No Format)
  const statsOf = data.ignoreMeta || format.game ? undefined : statsEntry(data.stats, item.species);
  const inTeam = new Set(team.filter((_, i) => i !== replaceIndex).map(member => toID(battleSpecies(member)?.baseSpecies ?? member.species)));
  const mates = statsOf ? Object.entries(statsOf.teammates).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name]) => name).filter(name => inTeam.has(toID(getSpecies(name)?.baseSpecies ?? name))) : [];
  // Chi esce (Sostituisci): i ruoli che il team perde stanno nella sua striscia, non in Costa
  const out = replaceIndex !== null ? team[replaceIndex] : undefined;
  const lostRoles = 'diff' in item && item.diff ? item.diff.losses.roles.map(role => roleLabel(role, lang)) : [];
  // Costa: le perdite del cambio e gli avvisi (meteo in conflitto, mosse indebolite)
  const loses: Bring[] = [
    ...(changes?.cons.map((c): Bring => ({ text: c.text, short: c.text, kind: kindOfArea(c.area) })) ?? [])
      .filter(c => !(c.kind === 'roles' && lostRoles.includes(c.text))),
    ...(item.facts.clashes ?? []).map((text): Bring => { const clean = text.replace(/^⚠\s*/, ''); return { text: clean, short: clean, kind: 'warning' }; }),
  ];
  // Senza perdite da elencare ma con aree in calo (anche aggiungendo), Costa dice quali (mai frecce rosse senza perché)
  if (!loses.length && !lostRoles.length && before && after) loses.push(...areaDrops(before, after).map((drop): Bring => { const text = tr('detail.areaDown', { area: drop.label }); return { text, short: text, kind: 'other' }; }));
  // Problemi risolti o nuovi e meteo: la parte del voto che le aree non spiegano
  const extras = before && after ? extrasDelta(before, after) : 0;
  // I punti dei Ruoli a parte, come nella carta del voto (Bonus/Malus non li conta)
  const rolesChange = before && after ? rolesDelta(before, after) : 0;
  // Le aree nella testata, sotto "B 79 → A 88": solo il verso (sale, uguale, scende), quanto lo dice il +N
  const areaMarks = before && after ? [
    ...after.areas.filter(area => !area.inactive).map(area => {
      const prev = before.areas.find(a => a.key === area.key);
      const change = area.value !== null && prev?.value != null && !prev.inactive ? area.value - prev.value : 0;
      return { key: area.key as string, short: tr(`area.${area.key}Short`), label: area.label, change };
    }),
    ...(rolesChange !== 0 ? [{ key: 'roles', short: tr('area.roles'), label: tr('area.roles'), change: rolesChange }] : []),
    ...(extras !== 0 ? [{ key: 'extras', short: tr('detail.extrasShort'), label: tr('detail.extras'), change: extras }] : []),
  ] : [];

  // Due colonne (Perché | Set) o una, la decide il CSS dalla larghezza del dettaglio. Dalla sua altezza (non dal
  // candidato): basso, testata bassa e il set su una riga senza esagono; e se anche così il corpo non entra (portatile
  // basso in Sostituisci), due linguette (Perché · Set). Sui fogli (tablet, telefono) il dettaglio scorre: niente linguette
  const bodyRef = useRef<HTMLDivElement>(null);
  // Azioni su una riga: se «Metti al posto di …» (nome lungo, inglese) non lascia posto, Copia set e Smogon restano icone
  const actionsRef = useRef<HTMLDivElement>(null);
  // Copia set e Smogon: coi nomi interi se c'è posto (2), coi nomi brevi "Copia" / "Smogon" (1), sennò solo icone (0)
  const actionsFit = useFitCount(actionsRef, 2, `${lang}|${actionLabel}`, undefined, true);
  const asideRef = useRef<HTMLElement>(null);
  const [low, setLow] = useState(false);
  // Copia set: per un attimo "Copiato" con la spunta (come la carta del team), detto anche ai lettori di schermo
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 1500); return () => window.clearTimeout(timer); }, [copied]);
  useEffect(() => setCopied(false), [item.species]);
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (aside.clientHeight > 0) setLow(wideScreen() && aside.clientHeight < LOW_DETAIL); });
    observer.observe(aside);
    return () => observer.disconnect();
  }, []);
  const [tabs, setTabs] = useState(false);
  // Se il corpo non entra, prima il set su due righe di testo (come sul dettaglio basso); solo se non basta, le linguette
  const [tight, setTight] = useState(false);
  const [ownTab, setOwnTab] = useState<DetailTab>('brings');
  const tab = tabProp ?? ownTab;
  const chooseTab = onTab ?? setOwnTab;
  const fitKey = `${item.species}|${replaceIndex}|${set.moves.join(',')}|${brings.length}|${loses.length}|${teamCollapsed}|${low}`;
  useLayoutEffect(() => { setTabs(false); setTight(false); }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (tabs || !body || !wideScreen()) return;
    if (body.scrollHeight - body.clientHeight > 1) {
      if (!low && !tight) setTight(true);
      else setTabs(true);
    }
  });
  useEffect(() => {
    const reset = () => { setTabs(false); setTight(false); };
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  // Costa senza perdite: la riga "Niente…" su telefono e tablet (la scheda scorre) e, sul computer, solo se sta nel vuoto
  // sotto Perché accanto a un set più alto: non allunga mai il dettaglio (non lo fa passare alla versione bassa)
  const noneWanted = loses.length === 0 && !!before && !lostRoles.length && !low && !tight && !tabs;
  const [noneFits, setNoneFits] = useState(false);
  useLayoutEffect(() => {
    if (!noneWanted) return;
    if (!wideScreen()) { if (!noneFits) setNoneFits(true); return; }
    const why = bodyRef.current?.querySelector<HTMLElement>('.detail-why');
    const run = bodyRef.current?.querySelector<HTMLElement>('.detail-run');
    if (!why || !run || why.offsetTop !== run.offsetTop) { if (noneFits) setNoneFits(false); return; }
    // Le colonne si allungano alla più alta: si misura fin dove arriva il contenuto di ciascuna (la riga stessa esclusa)
    const bottom = (col: HTMLElement) => Math.max(col.getBoundingClientRect().top,
      ...[...col.children].filter(el => !el.classList.contains('why-none-part')).map(el => el.getBoundingClientRect().bottom));
    const fits = bottom(run) - bottom(why) >= 52;
    if (fits !== noneFits) setNoneFits(fits);
  });
  const shownTab: DetailTab = tab === 'set' ? 'set' : 'brings';
  const showWhy = !tabs || shownTab === 'brings';
  const showSet = !tabs || shownTab === 'set';
  const tabKeys: DetailTab[] = ['brings', 'set'];

  return (
    <aside ref={asideRef} className={`detail${rank === 1 ? ' first' : ''}${low || tight ? ' compact' : ''}${tabs ? ' tabbed' : ''}`} aria-label={tr('detail.region', { species: item.species })}
      {...(sheet ? { role: 'dialog', tabIndex: -1 } : {})}>
      {/* Testata come la carta del tooltip: diagonale nei colori dei tipi, sprite grande, nome in corsivo con le icone dei
          tipi; a destra quanto sale il voto e, sotto, il verso di ogni area */}
      <header className="detail-hero mcard-head" style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
        {/* Il candidato aperto si muove (idle animato), come il membro aperto nel team */}
        <span className="mcard-mon detail-mon">
          <Sprite species={battleName(set)} item={set.item} size={96} />
        </span>
        <div className="detail-id">
          <h3>
            {/* Come sulle carte: la specie base e la forma come etichetta ("Charizard" + MEGA Y); il nome intero ufficiale
                per i lettori di schermo e nel tooltip */}
            {forme ? (
              <span className="detail-name" {...hint(item.species)}>
                <span className="visually-hidden">{item.species}</span>
                <span aria-hidden="true">{forme.base}</span>
                <i className="forme" aria-hidden="true">{forme.forme}</i>
              </span>
            ) : <span>{item.species}</span>}
            <span className="detail-types" aria-label={types.map(type => typeName(type as TypeName, lang)).join(', ')}>
              {types.map(type => <img key={type} className="ti-sq" style={tileStyle(type)} src={typeIconUrl(type)} alt="" draggable={false} {...hint(typeName(type as TypeName, lang))} />)}
            </span>
            {banMark}
            <StatsBadge species={item.species} item={set.item} compare={out} side={<>
              <StatHex set={set} compare={out} />
              {out && <span className="hx-legend"><i aria-hidden="true" />{tr('suggest.outShort', { member: out.species })}</span>}
            </>} />
          </h3>
        </div>
        {result && before ? (
          <div className="detail-score">
            <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{delta(result.gain) || '±0'}</strong>
            {/* Solo "B 78 → A 86": che è il voto del team lo dice il posto; per i lettori di schermo resta la parola */}
            <span><span className="visually-hidden">{tr('detail.gradeLabel')} </span>{tr('detail.gradeChange', { from: `${before.grade} ${before.overall}`, to: `${result.grade} ${result.overall}` })}</span>
            {areaMarks.length > 0 && (
              <ul className="detail-area-marks" aria-label={tr('detail.team')}>
                {areaMarks.map(mark => {
                  const way = mark.change > 0 ? 'up' : mark.change < 0 ? 'down' : 'same';
                  const said = tr(`detail.area.${way}`, { area: mark.label });
                  return (
                    <li key={mark.key} className={way} {...hint(said)}>
                      <span aria-hidden="true">{mark.short}</span><AreaArrow way={way} />
                      <span className="visually-hidden">{said}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : result && team.length === 0 ? (
          // Primo Pokémon (nel gioco): il voto che mette da solo, "+36" e la sua lettera
          <div className="detail-score">
            <strong>{delta(result.gain) || '±0'}</strong>
            <span><span className="visually-hidden">{tr('detail.gradeLabel')} </span>{`${result.grade} ${result.overall}`}</span>
          </div>
        ) : usage !== null && (
          <div className="detail-score">
            <strong>{formatPercent(lang, usage)}</strong>
            <span>{tr('detail.usage')}</span>
          </div>
        )}
      </header>

      {/* Sostituendo: la striscia di chi esce, ingrigito, coi ruoli che il team perde */}
      {out && (
        <div className="detail-swap">
          <span className="detail-swap-mark" aria-hidden="true"><Icon name="swap" /></span>
          <span className="detail-swap-mon" aria-hidden="true"><Sprite species={battleName(out)} item={out.item} size={96} /></span>
          <p className="detail-swap-text">
            <small>{tr('detail.out')}</small>
            <span>
              <b>{battleName(out)}</b>
              {lostRoles.length > 0 && <em>{tr('detail.outLoses', { roles: lostRoles.join(' · ') })}</em>}
            </span>
          </p>
        </div>
      )}

      <div className="detail-body" ref={bodyRef}>
        {/* Il corpo non entra: Perché da una parte, il set dall'altra, una alla volta */}
        {tabs && (
          <div className="detail-tabs" role="tablist" aria-label={tr('detail.region', { species: item.species })}>
            {tabKeys.map(key => (
              <button key={key} type="button" role="tab" id={`detail-tab-${key}`} aria-selected={shownTab === key} aria-controls="detail-tabpanel"
                tabIndex={shownTab === key ? 0 : -1} className={shownTab === key ? 'on' : undefined} onClick={() => chooseTab(key)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  e.preventDefault();
                  const next = tabKeys[(tabKeys.indexOf(key) + (e.key === 'ArrowRight' ? 1 : tabKeys.length - 1)) % tabKeys.length];
                  chooseTab(next);
                  (e.currentTarget.parentElement?.querySelector(`#detail-tab-${next}`) as HTMLElement | null)?.focus();
                }}>
                {tr(key === 'set' ? 'detail.tab.set' : 'detail.tab.brings')}
              </button>
            ))}
          </div>
        )}
        <div className="detail-cols" {...(tabs ? { role: 'tabpanel', id: 'detail-tabpanel', 'aria-labelledby': `detail-tab-${shownTab}` } : {})}>
          {showWhy && (
            <section className="detail-why">
              <div className="why-part">
                <h4>{tr('detail.brings')}</h4>
                <BringGroups items={brings} side="gain" none={tr('suggest.noDifference')} />
                {mates.length > 0 && (
                  <p className="detail-mates">
                    <Icon name="chain" />
                    <span>{tr('detail.oftenWith')}</span>
                    {mates.map(name => <span key={name} className="mon-ref"><PokemonIcon name={name} /><strong>{name}</strong></span>)}
                  </p>
                )}
              </div>
              {loses.length > 0 ? (
                <div className="why-part">
                  <h4>{tr('detail.loses')}</h4>
                  <BringGroups items={loses} side="loss" none={tr('detail.losesNothing')} />
                </div>
              ) : noneWanted && noneFits && (
                // Nessun costo: lo si dice (è un motivo per sceglierlo), dove c'è posto
                <div className="why-part why-none-part">
                  <h4>{tr('detail.loses')}</h4>
                  <p className="why-none">{tr('detail.losesNone')}</p>
                </div>
              )}
            </section>
          )}
          {/* Il set consigliato: strumento, abilità, natura, EV (e Tera), le mosse, i ruoli del set (una volta sola, con
              quelli che mancavano al team in verde). Le statistiche del set (l'esagono) stanno nel fumetto di "Stat" */}
          {showSet && (
            <section className="detail-run">
              <h4 className="visually-hidden">{tr('detail.set')}</h4>
              <MemberKit set={set} />
              <MemberMoves set={set} movesLabel={tr('editor.moves')} />
              <MemberRoles set={set} rules={rulesOf(data)} fresh={freshRoles} />
            </section>
          )}
        </div>
      </div>

      <div ref={actionsRef} className={actionsFit === 2 ? 'detail-actions' : actionsFit === 1 ? 'detail-actions short' : 'detail-actions tight'}>
        <button type="button" className={rank === 1 ? 'primary' : 'go'} onClick={onAction}>{actionLabel}</button>
        {/* Nome intero, nome breve o solo l'icona, secondo lo spazio; il nome intero per i lettori di schermo e nel fumetto */}
        <button type="button" className={copied ? 'detail-copy done' : 'detail-copy'} aria-label={tr('suggest.copySet')}
          onClick={async () => { if (await copyText(exportShowdown([set]))) setCopied(true); }} {...hint(tr('suggest.copySet'))}>
          <Icon name={copied ? 'check' : 'copy'} /> <span className="btn-label" aria-hidden="true">
            <span className="lbl-full">{tr(copied ? 'team.copied' : 'suggest.copySet')}</span><span className="lbl-short">{tr(copied ? 'team.copied' : 'suggest.copySetShort')}</span>
          </span>
        </button>
        <span className="visually-hidden" role="status">{copied ? tr('team.copied') : ''}</span>
        <SmogonLink species={item.species} format={format} presets={presetsFor(data, item.species)} short />
      </div>
    </aside>
  );
}

/** Il verso di un'area nella testata: triangolo su (verde), giù (rosso), due trattini se resta uguale. */
function AreaArrow({ way }: { way: 'up' | 'down' | 'same' }) {
  return (
    <svg className="area-arrow" viewBox="0 0 12 12" aria-hidden="true">
      {way === 'same'
        ? <><rect x="1" y="3.5" width="10" height="1.8" rx="0.9" /><rect x="1" y="6.7" width="10" height="1.8" rx="0.9" /></>
        : <path d={way === 'up' ? 'M6 2 11 10H1z' : 'M6 10 1 2h10z'} />}
    </svg>
  );
}
