import { useMemo, type CSSProperties } from 'react';
import type { EngineData } from '../engine/data';
import { rankedChanges } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import { cardRoles, type Archetype } from '../engine/archetype';
import { detectRoles, roleDescription, roleLabel } from '../engine/roles';
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
import type { ListSprite } from './theme';
import { Icon } from './icons';
import { BoxIcon, bringsOf, formeParts } from './candidateParts';
import { PokemonIcon } from './PokemonName';
import { battleName, toID } from '../engine/dex';
import { statsEntry } from '../engine/stats';
import { Sprite, typeColor } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { Typed } from './TypeText';
import { MemberKit, MemberStatsMoves } from './MemberCard';
import { typeIconUrl } from './typeIcons';
import type { TypeName } from '../engine/types';


/**
 * Il candidato selezionato nella lista, disegnato come la carta del tooltip: testata nei colori dei tipi coi ruoli e quanto
 * sale il voto, cosa porta e cosa toglie, l'effetto sul team area per area (una riga), il set consigliato (griglia,
 * esagono, pillole delle mosse), le azioni.
 */
export function SuggestionDetail({ item, rank, team, replaceIndex, data, format, rating, archetype, usage, banMark, actionLabel, onAction, listSprite = 'normal', teamCollapsed = false, sheet = false }: {
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
  const roleName = (role: (typeof setRoles)[number]) => (role === 'weather' ? tr('card.weather') : roleLabel(role, lang));
  // Toglie: le perdite del cambio e gli avvisi (meteo in conflitto, mosse indebolite)
  const loses = [...(changes?.cons.map(c => c.text) ?? []), ...(item.facts.clashes ?? []).map(text => text.replace(/^⚠\s*/, ''))];
  // Senza perdite da elencare ma con aree in calo, Toglie dice quali (mai "niente" accanto a pillole rosse)
  if (replacing && !loses.length && before && after) loses.push(...areaDrops(before, after).map(drop => `${drop.label} ${delta(drop.change)}`));
  // Problemi risolti o nuovi e meteo: la parte del voto che le aree non spiegano, con la sua pillola
  const extras = before && after ? extrasDelta(before, after) : 0;
  // I punti dei Ruoli a parte, come nella carta del voto (Bonus/Malus non li conta)
  const rolesChange = before && after ? rolesDelta(before, after) : 0;
  // Aggiungendo non si perde nessuno: Toglie compare solo se c'è un avviso
  const showLoses = replacing || loses.length > 0;

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}`} aria-label={tr('detail.region', { species: item.species })}
      {...(sheet ? { role: 'dialog', tabIndex: -1 } : {})}>
      {/* Testata come la carta del tooltip: diagonale nei colori dei tipi, sprite grande, nome in corsivo con le icone dei
          tipi e la lastra ciano coi ruoli del set; a destra quanto sale il voto */}
      <header className="detail-hero mcard-head" style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
        {/* Il candidato aperto si muove (idle animato), come il membro aperto nel team */}
        <span className="detail-sprite">
          {listSprite === 'box' ? <Sprite species={item.species} item={set.item} size={144} animated /> : <BoxIcon set={set} />}
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
          {/* I ruoli del set, il principale per primo (era la sezione Ruoli) */}
          {setRoles.length > 0 && (
            <span className="mcard-why detail-why" aria-label={`${tr('detail.roles')}: ${setRoles.map(roleName).join(', ')}`}
              title={setRoles.filter(role => role !== 'weather').map(role => `${roleLabel(role, lang)}: ${roleDescription(role, lang)}`).join(' · ')}>
              {setRoles.map(roleName).join(' · ')}
            </span>
          )}
        </div>
        {/* Sostituendo: dopo nome e tipi, ⇄ e chi esce ingrigito, così si vede subito al posto di chi entra */}
        {replacing && (
          <span className="detail-out" title={tr('suggest.outFor', { member: battleName(team[replaceIndex]) })}>
            <span className="visually-hidden">{tr('suggest.outFor', { member: battleName(team[replaceIndex]) })}</span>
            <span className="detail-swap-mark" aria-hidden="true"><Icon name="swap" /></span>
            <span aria-hidden="true" className="detail-sprite out">
              {listSprite === 'box' ? <Sprite species={team[replaceIndex].species} item={team[replaceIndex].item} size={144} /> : <BoxIcon set={team[replaceIndex]} />}
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
        <section className="detail-sec wide set-sec">
          <h4>{tr('detail.set')}</h4>
          <MemberKit set={set} />
          <MemberStatsMoves set={set} movesLabel={tr('editor.moves')} />
        </section>

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
