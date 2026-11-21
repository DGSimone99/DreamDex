import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EngineData } from '../engine/data';
import { rankedChanges } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import { cardRoles, type Archetype } from '../engine/archetype';
import { detectRoles, roleDescription, roleLabel, shownRoles } from '../engine/roles';
import { areaDrops, extrasDelta, rolesDelta, withCandidate, type SwapOption, type TeamGain } from '../engine/teamGain';
import { rulesOf } from '../engine/formatRules';
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
import { hint } from './MoveTip';
import { BoxIcon, bringsOf, formeParts, kindOfArea, type Bring, type BringKind } from './candidateParts';
import { PokemonIcon } from './PokemonName';
import { battleName, toID } from '../engine/dex';
import { statsEntry } from '../engine/stats';
import { Sprite, typeColor } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { Typed } from './TypeText';
import { MemberKit, MemberMoves, StatHex } from './MemberCard';
import { typeIconUrl } from './typeIcons';
import type { TypeName } from '../engine/types';


/** L'ordine dei gruppi di Porta e Toglie, e il segno di ognuno (gli stessi delle carte della lista). */
const KINDS: BringKind[] = ['roles', 'defense', 'offense', 'threats', 'synergy', 'warning', 'other'];
const SHORT_KINDS = new Set<BringKind>(['defense', 'offense', 'threats']);
const KIND_ICON: Partial<Record<BringKind, 'shield' | 'sword' | 'chain' | 'warning'>> = { defense: 'shield', offense: 'sword', synergy: 'chain', warning: 'warning' };

/**
 * Porta o Toglie a gruppi, sempre nello stesso ordine: a sinistra l'etichetta col suo segno (scudo, spada, VS, catena),
 * a destra le voci; i ruoli come riquadri, come nella Panoramica (spunta verde in Porta, × rossa in Toglie).
 */
function BringGroups({ items, side, none }: { items: Bring[]; side: 'gain' | 'loss'; none: string }) {
  const tr = useT();
  if (!items.length) return <p className="bring-none">{none}</p>;
  return (
    <div className={`bring-groups ${side}`}>
      {KINDS.map(kind => {
        const group = items.filter(item => (item.kind ?? 'other') === kind);
        if (!group.length) return null;
        const icon = KIND_ICON[kind];
        return (
          <div key={kind} className={`bring-group ${kind}`}>
            <span className="bring-label">
              {kind === 'threats' ? <span className="sym-vs" aria-hidden="true">VS</span> : icon ? <Icon name={icon} /> : null}
              {tr(`detail.group.${kind}`)}
            </span>
            {kind === 'roles' ? (
              <ul className="bring-roles">
                {group.map(item => (
                  <li key={item.text} className="dash-role-tag">
                    <Icon name={side === 'gain' ? 'check' : 'close'} />
                    <span className="visually-hidden">{side === 'gain' ? '+' : '−'}</span><span className="dash-role-name">{item.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="bring-items">
                {group.map(item => {
                  // Difesa, Offesa e Minacce: la forma breve ("Colpisce Ghiaccio, Psico"), il gruppo dice già il resto
                  const text = SHORT_KINDS.has(kind) ? item.short : item.text;
                  return <li key={item.text} title={text !== item.text ? item.text : undefined}><Typed text={text} /></li>;
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
/** Versioni del dettaglio, dalla più ricca: 0 con aree e Meta, 1 con le aree (solo a team chiuso), 2 normale, 3 testata
 *  bassa e niente esagono, 4 testata bassa e due linguette (Porta e Toglie · Set consigliato), 5 (solo se c'è Toglie)
 *  tre linguette: Porta · Toglie · Set consigliato. */
export type DetailLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type DetailTab = 'brings' | 'loses' | 'set';
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
  /** Team chiuso: c'è altezza per la sezione Meta. */
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

  // Porta: tutto, nello stesso ordine delle caselle della lista (che ne mostrano le prime voci)
  // ("Usato con X nel N% dei team" no: è un dato del meta, sta nella sezione Meta)
  // I ruoli uno per uno (la voce "Porta Pivot, Hazard (mancanti nel team)" diventa un riquadro per ruolo), senza doppioni
  const brings = bringsOf(item, lang, rulesOf(data)).filter(bring => !bring.usedWith)
    .flatMap((bring): Bring[] => (bring.roles?.length ? bring.roles.map(text => ({ text, short: text, kind: 'roles' })) : [bring]))
    .filter((bring, i, all) => all.findIndex(other => other.text === bring.text) === i);
  // Ruoli del set consigliato: per primo il principale (lo stesso delle carte del team, evidenziato), poi gli altri
  const mainRole = cardRoles(set, rulesOf(data))[0];
  // Meta: uso nel meta e i 5 compagni più frequenti (quota dei team che lo usano), chi è già nel team riconosciuto per specie
  const statsOf = statsEntry(data.stats, item.species);
  const inTeam = new Set(team.map(member => toID(member.species)));
  const mates = statsOf ? Object.entries(statsOf.teammates).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, share]) => ({ name, share, inTeam: inTeam.has(toID(name)) })) : [];
  const meta = statsOf ? {
    usage: statsOf.usage,
    // Posto nella classifica d'uso del formato (1 = il più usato)
    place: Object.values(data.stats?.pokemon ?? {}).filter(entry => entry.usage > statsOf.usage).length + 1,
    mates,
    top: mates[0]?.share || 1,
  } : null;
  const setRoles = [...(mainRole ? [mainRole] : []), ...shownRoles(detectRoles(set, rulesOf(data)), rulesOf(data)).filter(role => role !== mainRole)];
  const roleName = (role: (typeof setRoles)[number]) => (role === 'weather' ? tr('card.weather') : roleLabel(role, lang));
  // Toglie: le perdite del cambio e gli avvisi (meteo in conflitto, mosse indebolite)
  const loses: Bring[] = [
    ...(changes?.cons.map((c): Bring => ({ text: c.text, short: c.text, kind: kindOfArea(c.area) })) ?? []),
    ...(item.facts.clashes ?? []).map((text): Bring => { const clean = text.replace(/^⚠\s*/, ''); return { text: clean, short: clean, kind: 'warning' }; }),
  ];
  // Senza perdite da elencare ma con aree in calo, Toglie dice quali (mai "niente" accanto a pillole rosse)
  if (replacing && !loses.length && before && after) loses.push(...areaDrops(before, after).map((drop): Bring => { const text = `${drop.label} ${delta(drop.change)}`; return { text, short: text, kind: 'other' }; }));
  // Problemi risolti o nuovi e meteo: la parte del voto che le aree non spiegano, con la sua pillola
  const extras = before && after ? extrasDelta(before, after) : 0;
  // I punti dei Ruoli a parte, come nella carta del voto (Bonus/Malus non li conta)
  const rolesChange = before && after ? rolesDelta(before, after) : 0;
  // Aggiungendo non si perde nessuno: Toglie compare solo se c'è un avviso
  const showLoses = replacing || loses.length > 0;

  // La versione più ricca che ci sta senza scorrere (solo su desktop: sul telefono il foglio scorre): si parte dalla più
  // ricca ammessa e, finché il corpo non entra, si scende di una. Si riparte col candidato nuovo, col team aperto o chiuso
  // e quando la finestra cambia misura
  const bodyRef = useRef<HTMLDivElement>(null);
  const start: DetailLevel = teamCollapsed ? 0 : 2;
  // Tre linguette solo se c'è un Toglie da separare
  const lastLevel: DetailLevel = showLoses ? 5 : 4;
  const [level, setLevel] = useState<DetailLevel>(start);
  const [ownTab, setOwnTab] = useState<DetailTab>('brings');
  const tab = tabProp ?? ownTab;
  const chooseTab = onTab ?? setOwnTab;
  const fitKey = `${item.species}|${replaceIndex}|${set.moves.join(',')}|${brings.length}|${loses.length}|${start}`;
  useLayoutEffect(() => setLevel(start), [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (level < lastLevel && wideScreen() && body && body.scrollHeight - body.clientHeight > 1) setLevel((level + 1) as DetailLevel);
  });
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    const reset = () => setLevel(startRef.current);
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  const showAreas = teamCollapsed && level <= 1;
  const showMeta = teamCollapsed && level === 0;
  const tabs = level >= 4;
  // Tre linguette solo quando c'è Toglie e due non bastano; con due, "Toglie" sta con Porta
  const tabKeys: DetailTab[] = level === 5 ? ['brings', 'loses', 'set'] : ['brings', 'set'];
  const shownTab: DetailTab = tabKeys.includes(tab) ? tab : 'brings';
  const showBrings = !tabs || shownTab === 'brings';
  const showLosesPart = !tabs || shownTab === 'loses' || (level === 4 && shownTab === 'brings');
  const showSet = !tabs || shownTab === 'set';

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}${level >= 3 ? ' tight compact' : ''}${tabs ? ' tabbed' : ''}`} aria-label={tr('detail.region', { species: item.species })}
      {...(sheet ? { role: 'dialog', tabIndex: -1 } : {})}>
      {/* Testata come la carta del tooltip: diagonale nei colori dei tipi, sprite grande, nome in corsivo con le icone dei
          tipi e la lastra ciano coi ruoli del set; a destra quanto sale il voto */}
      <header className="detail-hero mcard-head" style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
        {/* Il candidato aperto si muove (idle animato), come il membro aperto nel team */}
        <span className="detail-sprite">
          <BoxIcon set={set} />
        </span>
        <div className="detail-id">
          <h3>
            {/* Come sulle carte: la specie base e la forma come etichetta ("Charizard" + MEGA Y); il nome intero ufficiale
                per i lettori di schermo e nel tooltip */}
            {forme ? (
              <span className="detail-name" title={item.species}>
                <span className="visually-hidden">{item.species}</span>
                <span aria-hidden="true">{forme.base}</span>
                <i className="forme" aria-hidden="true">{forme.forme}</i>
              </span>
            ) : <span>{item.species}</span>}
            <span className="detail-types" aria-label={types.map(type => typeName(type as TypeName, lang)).join(', ')}>
              {types.map(type => <img key={type} src={typeIconUrl(type)} alt="" draggable={false} />)}
            </span>
            {banMark}
            <StatsBadge species={item.species} item={set.item} compare={replacing ? team[replaceIndex] : undefined} />
          </h3>
          {/* Il ruolo principale del set e quanti altri ("Pivot +1"); l'elenco intero con le spiegazioni nel tooltip */}
          {setRoles.length > 0 && (
            <span className="mcard-why detail-why" aria-label={`${tr('detail.roles')}: ${setRoles.map(roleName).join(', ')}`}
              title={setRoles.map(role => (role === 'weather' ? roleName(role) : `${roleLabel(role, lang)}: ${roleDescription(role, lang)}`)).join(' · ')}>
              {roleName(setRoles[0])}{setRoles.length > 1 && <span className="detail-why-more"> +{setRoles.length - 1}</span>}
            </span>
          )}
        </div>
        {/* Sostituendo: dopo nome e tipi, ⇄ e chi esce ingrigito, così si vede subito al posto di chi entra */}
        {replacing && (
          <span className="detail-out" title={tr('suggest.outFor', { member: battleName(team[replaceIndex]) })}>
            <span className="visually-hidden">{tr('suggest.outFor', { member: battleName(team[replaceIndex]) })}</span>
            <span className="detail-swap-mark" aria-hidden="true"><Icon name="swap" /></span>
            <span aria-hidden="true" className="detail-sprite out">
              <BoxIcon set={team[replaceIndex]} />
            </span>
          </span>
        )}
        {result && before ? (
          <div className="detail-score">
            <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{delta(result.gain) || '±0'}</strong>
            {/* Solo "B 78 → A 86": che è il voto del team lo dice il posto; per i lettori di schermo resta la parola */}
            <span><span className="visually-hidden">{tr('detail.gradeLabel')} </span>{tr('detail.gradeChange', { from: `${before.grade} ${before.overall}`, to: `${result.grade} ${result.overall}` })}</span>
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

      <div className="detail-body" ref={bodyRef}>
        {/* Schermo basso: Porta e Toglie da una parte, il set dall'altra, una alla volta */}
        {tabs && (
          <div className="detail-tabs" role="tablist" aria-label={tr('detail.region', { species: item.species })}>
            {tabKeys.map(key => (
              <button key={key} type="button" role="tab" id={`detail-tab-${key}`} aria-selected={shownTab === key} aria-controls="detail-tabpanel"
                className={shownTab === key ? 'on' : undefined} onClick={() => chooseTab(key)}>
                {level === 5 && key === 'brings' ? tr('detail.brings') : level === 5 && key === 'loses' ? tr('detail.loses') : tr(`detail.tab.${key === 'loses' ? 'brings' : key}`)}
              </button>
            ))}
          </div>
        )}
        <div className="detail-panel" {...(tabs ? { role: 'tabpanel', id: 'detail-tabpanel', 'aria-labelledby': `detail-tab-${shownTab}` } : {})}>
        {showBrings && (
        <section className={`detail-sec brings${showLoses ? '' : ' wide'}`}>
          <h4>{tr('detail.brings')}</h4>
          <BringGroups items={brings} side="gain" none={tr('suggest.noDifference')} />
        </section>
        )}
        {showLosesPart && showLoses && (
          <section className="detail-sec loses">
            <h4>{tr('detail.loses')}</h4>
            <BringGroups items={loses} side="loss" none={tr('detail.losesNothing')} />
          </section>
        )}

        {/* La riga per area solo nella versione estesa (team chiuso): i gruppi di Porta e Toglie dicono già dove si sale */}
        {after && showAreas && (
          <section className="detail-sec wide effect">
            {/* Sotto Porta e Toglie, senza etichetta visibile (ne è il risultato; col primo Pokémon resta "Voto con lui da
                solo"): una riga, per area la variazione (o il valore, senza un voto prima); un'area che non conta resta in grigio */}
            <h4 className={before ? 'visually-hidden' : undefined}>{tr(before ? 'detail.team' : 'detail.teamAlone')}</h4>
            <dl className="detail-areas">
              {after.areas.map(area => {
                const prev = before?.areas.find(a => a.key === area.key);
                const was = prev?.value;
                const change = area.value !== null && was != null && !area.inactive && !prev?.inactive ? area.value - was : 0;
                const note = area.inactive ? tr('rating.notCounted') : undefined;
                return (
                  <div key={area.key} className={area.inactive ? 'inactive' : undefined} title={note}>
                    <dt aria-description={note}>{area.label}</dt>
                    {before
                      ? <dd className={`change${change < 0 ? ' worse' : change === 0 ? ' same' : ''}`}>{delta(change)}</dd>
                      : <><dd className="value">{area.value || '—'}</dd><dd className="change" /></>}
                  </div>
                );
              })}
              {rolesChange !== 0 && (
                <div className="extras">
                  <dt>{tr('area.roles')}</dt>
                  <dd className={`change${rolesChange < 0 ? ' worse' : ''}`}>{delta(rolesChange)}</dd>
                </div>
              )}
              {extras !== 0 && (
                <div className="extras">
                  <dt>{tr('detail.extras')}</dt>
                  <dd className={`change${extras < 0 ? ' worse' : ''}`}>{delta(extras)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}


        {/* Il set consigliato come nella carta del tooltip: griglia (strumento, natura, abilità, EV, Tera), statistiche a
            esagono e mosse come pillole */}
        {showSet && (
        <section className="detail-sec wide set-sec">
          <h4>{tr('detail.set')}</h4>
          {/* Una fascia sola, come la schermata riassunto dei giochi: a sinistra l'esagono, a destra le mosse 2 per 2 e sotto
              di loro i dati del set (la colonna di destra alta quanto l'esagono) */}
          <div className="set-row">
            <StatHex set={set} />
            <div className="set-side">
              <MemberMoves set={set} movesLabel={tr('editor.moves')} className="set-moves" />
              <MemberKit set={set} />
            </div>
          </div>
        </section>
        )}

        {/* Meta, solo col team chiuso (c'è l'altezza): a sinistra l'uso nel meta e il posto in classifica, a destra i 5
            compagni più frequenti come una classifica a barre (lunghe quanto la quota, rispetto al primo; colore del tipo);
            chi è già nel team in ciano con la spunta. Senza statistiche la sezione non c'è */}
        {showMeta && meta && (
          <section className="detail-sec wide meta-sec">
            <h4>{tr('detail.meta')}</h4>
            <div className="detail-meta">
              <p className="meta-usage">
                <strong>{formatPercent(lang, meta.usage)}</strong>
                <span>{tr('detail.metaUsageLong')}</span>
                {meta.place > 0 && <span className="meta-place">{tr('detail.metaPlace', { n: meta.place })}</span>}
              </p>
              {meta.mates.length > 0 && (
                <div className="meta-mates-box">
                  <span className="meta-label">{tr('detail.metaWith')}</span>
                  <ol className="meta-mates" aria-label={tr('detail.metaWith')}>
                    {meta.mates.map(mate => (
                      <li key={mate.name} className={mate.inTeam ? 'in-team' : undefined}
                        style={{ '--mate-c': typeColor(getSpecies(mate.name)?.types[0] ?? ''), '--share': mate.share / meta.top } as CSSProperties}
                        title={mate.inTeam ? tr('detail.metaInTeam', { name: mate.name }) : undefined}>
                        <PokemonIcon name={mate.name} />
                        <span className="mate-name">{mate.name}</span>
                        <span className="mate-check">{mate.inTeam && <Icon name="check" />}</span>
                        <span className="mate-bar" aria-hidden="true" />
                        <strong>{formatPercent(lang, mate.share)}</strong>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}
        </div>
      </div>

      <div className="detail-actions">
        <button type="button" className={rank === 1 ? 'primary' : 'go'} onClick={onAction}>{actionLabel}</button>
        {/* Nel dettaglio stretto (tablet, mezzo schermo) resta l'icona: il nome per i lettori di schermo e nel fumetto */}
        <button type="button" className="detail-copy" onClick={() => copyText(exportShowdown([set]))} {...hint(tr('suggest.copySet'))}>
          <Icon name="copy" /> <span className="btn-label">{tr('suggest.copySet')}</span>
        </button>
        <SmogonLink species={item.species} format={format} presets={presetsFor(data, item.species)} />
      </div>
    </aside>
  );
}
