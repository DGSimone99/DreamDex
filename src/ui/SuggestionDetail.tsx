import { useMemo, type CSSProperties } from 'react';
import type { EngineData } from '../engine/data';
import { rankedChanges } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import { cardRoles, type Archetype } from '../engine/archetype';
import { detectRoles, roleLabel } from '../engine/roles';
import { areaDrops, extrasDelta, withCandidate, type SwapOption, type TeamGain } from '../engine/teamGain';
import { rulesOf } from '../engine/formatRules';
import { formatPercent } from '../i18n';
import type { Replacement } from '../engine/replace';
import type { Suggestion } from '../engine/scoring';
import { exportShowdown, presetsFor, STAT_IDS, type TeamSet } from '../engine/sets';
import { SmogonLink } from './SmogonLink';
import type { Format } from '../engine/format';
import { gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { copyText } from './clipboard';
import type { ListSprite } from './theme';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { BoxIcon, bringsOf } from './candidateParts';
import { PokemonIcon, PokemonName } from './PokemonName';
import { battleAbility, battleName, toID } from '../engine/dex';
import { statsEntry } from '../engine/stats';
import { Sprite, TypeChip, typeColor } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { MoveName, Typed } from './TypeText';


/**
 * Il candidato selezionato nella lista, dall'alto per importanza: chi è e quanto sale il voto, cosa porta e cosa toglie,
 * l'effetto sul team area per area (una riga), il set consigliato, le azioni.
 */
export function SuggestionDetail({ item, rank, team, replaceIndex, data, format, rating, archetype, usage, banMark, actionLabel, onAction, listSprite = 'normal', teamCollapsed = false }: {
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
  listSprite?: ListSprite;
  /** Team chiuso: c'è altezza per la sezione Meta. */
  teamCollapsed?: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const set = item.set;
  const replacing = replaceIndex !== null;
  // Il voto vero del team, come nella card del voto (il tipo scelto decide solo chi compare)
  const after = useMemo(() => rateTeam(withCandidate(team, set, replaceIndex), data, lang), [team, replaceIndex, set, data, lang]);
  // Senza altri membri non c'è un voto da confrontare
  const before = item.teamGain ? rating : null;
  const changes = 'diff' in item && item.diff ? rankedChanges(item.diff, item.teamGain?.areaPoints, lang) : null;
  const types = getSpecies(item.species)?.types ?? [];
  const evs = STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
  const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '');
  const result = item.teamGain;

  // Porta: tutto, nello stesso ordine delle caselle della lista (che ne mostrano le prime voci)
  const brings = bringsOf(item, lang, rulesOf(data)).map(bring => bring.text);
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
  const setRoles = [...(mainRole ? [mainRole] : []), ...detectRoles(set, rulesOf(data)).filter(role => role !== mainRole)];
  // Toglie: le perdite del cambio e gli avvisi (meteo in conflitto, mosse indebolite)
  const loses = [...(changes?.cons.map(c => c.text) ?? []), ...(item.facts.clashes ?? []).map(text => text.replace(/^⚠\s*/, ''))];
  // Senza perdite da elencare ma con aree in calo, Toglie dice quali (mai "niente" accanto a pillole rosse)
  if (replacing && !loses.length && before && after) loses.push(...areaDrops(before, after).map(drop => `${drop.label} ${delta(drop.change)}`));
  // Problemi risolti o nuovi e meteo: la parte del voto che le aree non spiegano, con la sua pillola
  const extras = before && after ? extrasDelta(before, after) : 0;
  // Aggiungendo non si perde nessuno: Toglie compare solo se c'è un avviso
  const showLoses = replacing || loses.length > 0;

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}`} aria-label={tr('detail.region', { species: item.species })}>
      <header className="detail-hero">
        {/* Il candidato aperto si muove (idle animato), come il membro aperto nel team */}
        <span className="detail-sprite">
          {listSprite === 'box' ? <Sprite species={item.species} item={set.item} size={144} animated /> : <BoxIcon set={set} />}
        </span>
        <div className="detail-id">
          <h3>
            <span>{item.species}</span>
            {banMark}
            <StatsBadge species={item.species} item={set.item} compare={replacing ? team[replaceIndex] : undefined} />
          </h3>
          <span className="types">{types.map(type => <TypeChip key={type} type={type} />)}</span>
          {replacing && (
            <p className="swap-head replaces">
              <PokemonName name={battleName(team[replaceIndex])} muted />
              <Icon name="arrow" />
              <span className="visually-hidden">{tr('coach.with')}</span>
              <PokemonName name={item.species} />
            </p>
          )}
        </div>
        {result && before ? (
          <div className="detail-score">
            <strong className={result.gain < 0 ? 'worse' : result.gain === 0 ? 'same' : undefined}>{delta(result.gain) || '±0'}</strong>
            <span>{tr('detail.gradeChange', { from: `${before.grade} ${before.overall}`, to: `${result.grade} ${result.overall}` })}</span>
          </div>
        ) : usage !== null && (
          <div className="detail-score">
            <strong>{formatPercent(lang, usage)}</strong>
            <span>{tr('detail.usage')}</span>
          </div>
        )}
      </header>

      <div className="detail-body">
        <section className={`detail-sec brings${showLoses ? '' : ' wide'}`}>
          <h4>{tr('detail.brings')}</h4>
          <ul className="detail-points gain">
            {brings.length ? brings.map(text => <li key={text}><Typed text={text} /></li>) : <li className="none">{tr('suggest.noDifference')}</li>}
          </ul>
        </section>
        {showLoses && (
          <section className="detail-sec loses">
            <h4>{tr('detail.loses')}</h4>
            <ul className="detail-points loss">
              {loses.length ? loses.map(text => <li key={text}><Typed text={text} /></li>) : <li className="none">{tr('detail.losesNothing')}</li>}
            </ul>
          </section>
        )}

        {after && (
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
                      : <><dd className="value">{area.value ?? '–'}</dd><dd className="change" /></>}
                  </div>
                );
              })}
              {extras !== 0 && (
                <div className="extras" title={tr('detail.extrasNote')}>
                  <dt>{tr('detail.extras')}</dt>
                  <dd className={`change${extras < 0 ? ' worse' : ''}`}>{delta(extras)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}


        <section className="detail-sec wide set-sec">
          <h4>{tr('detail.set')}</h4>
          {/* Due righe: strumento e abilità, poi natura, EV e Tera */}
          <p className="detail-set">
            <span className="set-line">
              {set.item && <span><ItemIcon item={set.item} /> {gameName('item', set.item, lang)}</span>}
              {/* L'abilità in battaglia: con una Megapietra quella della Mega (Mega Venusaur: Grassospesso, non Clorofilla) */}
              {battleAbility(set) && <span>{gameName('ability', battleAbility(set), lang)}</span>}
            </span>
            <span className="set-line">
              {set.nature && <span>{natureName(set.nature, lang)}</span>}
              {evs && <span className="evs">{evs}</span>}
              {set.teraType && <span>{tr('editor.tera')} {typeName(set.teraType, lang)}</span>}
            </span>
          </p>
          <ul className="detail-moves" aria-label={tr('editor.moves')}>
            {set.moves.map(move => <li key={move}><MoveName move={move} /></li>)}
          </ul>
        </section>

        {/* Ruoli del set consigliato: il principale per primo ed evidenziato */}
        {setRoles.length > 0 && (
          <section className="detail-sec wide roles-sec">
            <h4>{tr('detail.rolesTitle')}</h4>
            <ul className="detail-roles" aria-label={tr('detail.roles')}>
              {setRoles.map(role => (
                <li key={role} className={role === mainRole ? 'main' : undefined}>
                  {role === 'weather' ? tr('card.weather') : roleLabel(role, lang)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Meta, solo col team chiuso (c'è l'altezza): a sinistra l'uso nel meta e il posto in classifica, a destra i 5
            compagni più frequenti come una classifica a barre (lunghe quanto la quota, rispetto al primo; colore del tipo);
            chi è già nel team in ciano con la spunta. Senza statistiche la sezione non c'è */}
        {teamCollapsed && meta && (
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

      <div className="detail-actions">
        <button type="button" className={rank === 1 ? 'primary' : 'go'} onClick={onAction}>{actionLabel}</button>
        <button type="button" onClick={() => copyText(exportShowdown([set]))}>{tr('suggest.copySet')}</button>
        <SmogonLink species={item.species} format={format} presets={presetsFor(data, item.species)} />
      </div>
    </aside>
  );
}
