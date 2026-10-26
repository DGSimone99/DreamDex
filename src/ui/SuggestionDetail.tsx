import { useMemo } from 'react';
import type { EngineData } from '../engine/data';
import { rankedChanges } from '../engine/coach';
import { getSpecies } from '../engine/dex';
import { rateTeam, type TeamRating } from '../engine/rating';
import type { Archetype } from '../engine/archetype';
import { needLabel } from '../engine/needs';
import { areaDrops, extrasDelta, withCandidate, type ScoredArea, type SwapOption, type TeamGain } from '../engine/teamGain';
import { detectRoles } from '../engine/roles';
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
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { PokemonIcon, PokemonName } from './PokemonName';
import { battleAbility, battleName } from '../engine/dex';
import { Sprite, TypeChip } from './Sprite';
import { StatsBadge } from './StatsBadge';
import { MoveName, Typed } from './TypeText';

/** Voci di Porta e Toglie al massimo: la scheda deve stare in una schermata. */
const MAX_POINTS = 3;
/** L'area del voto di cui parla una ragione, per non ripetere i guadagni del cambio. */
const REASON_AREA: Partial<Record<string, string>> = { defense: 'defense', coverage: 'strength', roles: 'roles' };

/**
 * Il candidato selezionato nella lista, dall'alto per importanza: chi è e quanto sale il voto, cosa porta e cosa toglie,
 * l'effetto sul team area per area (una riga), il set consigliato, le azioni.
 */
export function SuggestionDetail({ item, rank, team, replaceIndex, data, format, rating, archetype, usage, banMark, actionLabel, onAction }: {
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
}) {
  const tr = useT();
  const lang = useLang();
  const set = item.set;
  const replacing = replaceIndex !== null;
  const opts = useMemo(() => (archetype ? { archetype } : {}), [archetype]);
  const after = useMemo(() => rateTeam(withCandidate(team, set, replaceIndex), data, lang, opts), [team, replaceIndex, set, data, lang, opts]);
  const forcedBefore = useMemo(() => (archetype ? rateTeam(team, data, lang, opts) : rating), [archetype, team, data, lang, opts, rating]);
  // Senza altri membri non c'è un voto da confrontare
  const before = item.teamGain ? forcedBefore : null;
  const changes = 'diff' in item && item.diff ? rankedChanges(item.diff, item.teamGain?.areaPoints, lang) : null;
  const types = getSpecies(item.species)?.types ?? [];
  const evs = STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
  const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '');
  const result = item.teamGain;

  // Porta: i guadagni del cambio (dal più pesante), poi le ragioni; l'uso nel meta non dice perché sceglierlo
  // Una ragione che ripete un guadagno della stessa area ("Resiste a Volante" e "Resistente a Volante") si salta
  const covered = new Set(changes?.pros.map(p => p.area));
  const reasons = item.reasons
    // Gli avvisi (peso negativo: meteo in conflitto, mosse indebolite) vanno in Toglie, non qui
    .filter(reason => reason.weight >= 0 && reason.component !== 'strength' && !covered.has(REASON_AREA[reason.component] as ScoredArea))
    .map(reason => reason.text);
  // Col team vuoto non c'è niente da confrontare: Porta dice cosa sa fare il Pokémon (i suoi ruoli)
  const roles = !item.teamGain && !changes ? detectRoles(set, rulesOf(data)).map(role => tr(`role.${role}`)) : [];
  const brings = [...new Set([...(changes?.pros.map(p => p.text) ?? []), ...reasons, ...roles])].slice(0, MAX_POINTS);
  // Toglie: le perdite del cambio, gli avvisi (meteo in conflitto, mosse indebolite) e le voci perse col tipo di team
  const penalty = result?.penalty && result.lost?.length
    ? [tr('suggest.penaltyNote', { roles: result.lost.map(r => needLabel(r.key, lang)).join(', '), n: result.penalty })]
    : [];
  // La voce persa col tipo di team spiega l'ordine in classifica: viene prima, così il limite non la nasconde
  const loses = [...penalty, ...(changes?.cons.map(c => c.text) ?? []), ...(item.facts.clashes ?? []).map(text => text.replace(/^⚠\s*/, ''))].slice(0, MAX_POINTS);
  // Senza perdite da elencare ma con aree in calo, Toglie dice quali (mai "niente" accanto a pillole rosse)
  if (replacing && !loses.length && before && after) loses.push(...areaDrops(before, after).slice(0, 2).map(drop => `${drop.label} ${delta(drop.change)}`));
  // Problemi risolti o nuovi, meteo e Tera: la parte del voto che le aree non spiegano, con la sua pillola
  const extras = before && after ? extrasDelta(before, after) : 0;
  // Aggiungendo non si perde nessuno: Toglie compare solo se c'è un avviso
  const showLoses = replacing || loses.length > 0;

  return (
    <aside className={`detail${rank === 1 ? ' first' : ''}`} aria-label={tr('detail.region', { species: item.species })}>
      <header className="detail-hero">
        {/* Il candidato aperto si muove (idle animato), come il membro aperto nel team */}
        <span className="detail-sprite"><Sprite species={item.species} item={set.item} size={144} animated /></span>
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
            <h4>{tr(before ? 'detail.team' : 'detail.teamAlone')}</h4>
            {/* Una riga: per area la variazione (o il valore, senza un voto prima); un'area che non conta resta in grigio */}
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
            {/* Raccomandazioni libere: quanto renderebbe al posto degli altri membri */}
            {item.alternatives && item.alternatives.length > 0 && (
              <p className="detail-alts">
                <span>{tr('detail.alternatives')}</span>
                {item.alternatives.slice(0, 3).map(alt => (
                  <span key={alt.index} className="alt">
                    <PokemonIcon name={battleName(team[alt.index])} />
                    {battleName(team[alt.index])}
                    <strong className={alt.gain < 0 ? 'worse' : alt.gain === 0 ? 'same' : undefined}>{delta(alt.gain) || '±0'}</strong>
                  </span>
                ))}
              </p>
            )}
          </section>
        )}

        <section className="detail-sec wide set-sec">
          <h4>{tr('detail.set')}</h4>
          <p className="detail-set">
            {set.item && <span><ItemIcon item={set.item} /> {gameName('item', set.item, lang)}</span>}
            {/* L'abilità in battaglia: con una Megapietra quella della Mega (Mega Venusaur: Grassospesso, non Clorofilla) */}
            {battleAbility(set) && <span>{gameName('ability', battleAbility(set), lang)}</span>}
            {set.nature && <span>{natureName(set.nature, lang)}</span>}
            {evs && <span className="evs">{evs}</span>}
            {set.teraType && <span>{tr('editor.tera')} {typeName(set.teraType, lang)}</span>}
          </p>
          <ul className="detail-moves" aria-label={tr('editor.moves')}>
            {set.moves.map(move => <li key={move}><MoveName move={move} /></li>)}
          </ul>
        </section>
      </div>

      <div className="detail-actions">
        <button type="button" className={rank === 1 ? 'primary' : 'go'} onClick={onAction}>{actionLabel}</button>
        <button type="button" onClick={() => copyText(exportShowdown([set]))}>{tr('suggest.copySet')}</button>
        <SmogonLink species={item.species} format={format} presets={presetsFor(data, item.species)} />
      </div>
    </aside>
  );
}
