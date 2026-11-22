import { Icon } from './icons';
import { useContext, type CSSProperties, type FocusEvent, type MouseEvent } from 'react';
import { cardRoles } from '../engine/archetype';
import type { FormatRules } from '../engine/formatRules';
import { detectRoles, roleDescription, roleLabel, shownRoles } from '../engine/roles';
import { RulesContext } from './rulesContext';
import { battleAbility, battleName, battleSpecies, dex } from '../engine/dex';
import type { StatID, TeamSet } from '../engine/sets';
import { statLines } from '../engine/statCalc';
import { anyGameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { FloatTip, useFloatAnchor } from './FloatTip';
import { Sprite, typeColor } from './Sprite';
import { MovePill } from './MovePill';
import { NatureArrow } from './NatureArrow';
import { tileStyle, typeIconUrl } from './typeIcons';
import { kitTip } from './MoveTip';
import { ItemIcon } from './ItemIcon';

/** L'ordine dell'esagono, come la schermata riassunto di Spada e Scudo: dall'alto in senso orario. */
const HEX_ORDER: StatID[] = ['hp', 'atk', 'def', 'spe', 'spd', 'spa'];
/** La statistica che riempie l'esagono fino al bordo. */
const HEX_FULL = 420;
const CX = 70;
const CY = 66;
const R = 48;
const at = (i: number, r: number) => {
  const a = (-90 + 60 * i) * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};
const ring = (f: number) => HEX_ORDER.map((_, i) => at(i, R * f).map(n => n.toFixed(1)).join(',')).join(' ');

/** Le statistiche finali a esagono; quella che la natura alza in verde, quella che abbassa in rosso. */
export function StatHex({ set }: { set: TeamSet }) {
  const lang = useLang();
  const lines = statLines(set);
  const byId = new Map(lines.map(l => [l.stat, l]));
  const value = HEX_ORDER.map((stat, i) => at(i, R * Math.min(1, (byId.get(stat)?.value ?? 0) / HEX_FULL)).map(n => n.toFixed(1)).join(',')).join(' ');
  return (
    <svg className="mcard-hex" viewBox="-40 -6 220 146" aria-hidden="true">
      <polygon className="hx-ring" points={ring(1)} />
      <polygon className="hx-ring soft" points={ring(2 / 3)} />
      <polygon className="hx-ring soft" points={ring(1 / 3)} />
      {HEX_ORDER.map((stat, i) => { const [x, y] = at(i, R); return <line key={stat} className="hx-axis" x1={CX} y1={CY} x2={x} y2={y} />; })}
      <polygon className="hx-val" points={value} />
      {HEX_ORDER.map((stat, i) => {
        const [x, y] = at(i, R + 13);
        const anchor = Math.abs(x - CX) < 5 ? 'middle' : x > CX ? 'start' : 'end';
        const line = byId.get(stat);
        const mood = line?.nature ?? '';
        return (
          <g key={stat}>
            <text x={x} y={y - 3} textAnchor={anchor} className="hx-l">{statShort(stat, lang)}</text>
            <text x={x} y={y + 9} textAnchor={anchor} className={`hx-v ${mood}`}>{line?.value ?? '—'}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Una mossa come pillola: tessera del tipo, nome, potenza nella coda ("—" per le mosse di stato). */
function MovePlate({ name, fresh = false, item = false }: { name: string; fresh?: boolean; item?: boolean }) {
  return <MovePill name={name} size="sm" className={`mcard-move${fresh ? ' is-changed' : ''}`} role={item ? 'listitem' : undefined} />;
}

/** EV in breve: le statistiche con EV dalla più carica, "252 Att · 252 Vel · 4 PS". */
const evLine = (set: TeamSet, lang: ReturnType<typeof useLang>) =>
  (Object.entries(set.evs) as [StatID, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${v} ${statShort(s, lang)}`).join(' · ');

/**
 * Strumento, natura, abilità ed EV (e la Tera, se c'è) in una griglia con le etichette. `was`: il set di prima, le parti
 * diverse si accendono in azzurro. Lo stesso blocco nella carta del tooltip e nel dettaglio dei candidati.
 */
export function MemberKit({ set, was }: { set: TeamSet; was?: TeamSet }) {
  const t = useT();
  const lang = useLang();
  const nature = set.nature ? dex.natures.get(set.nature) : null;
  const evs = evLine(set, lang);
  const diff = (same: boolean) => (was && !same ? 'is-changed' : undefined);
  return (
    <div className="mcard-kit">
      <small>{t('mcard.item')}</small><span className={diff(was?.item === set.item)} {...kitTip('item', set.item)}>{set.item && <ItemIcon item={set.item} />}{set.item ? anyGameName(set.item, lang) : '—'}</span>
      {/* L'abilità in battaglia: con una Megapietra quella della Mega (Mega Venusaur: Grassospesso, non Clorofilla) */}
      <small>{t('mcard.ability')}</small><span className={diff(was?.ability === set.ability)} {...kitTip('ability', battleAbility(set) || set.ability)}>{battleAbility(set) || set.ability ? anyGameName(battleAbility(set) || set.ability, lang) : '—'}</span>
      <small>{t('mcard.nature')}</small>
      <span className={diff(was?.nature === set.nature)}>{set.nature ? natureName(set.nature, lang) : '—'}{nature?.plus && nature.minus && (
        // Le freccette di Champions; il segno resta nel testo per chi legge senza vedere
        <em className="kit-nature"> <span className="up"><NatureArrow dir="up" /><span className="visually-hidden">+</span>{statShort(nature.plus as StatID, lang)}</span>{' '}<span className="down"><NatureArrow dir="down" /><span className="visually-hidden">−</span>{statShort(nature.minus as StatID, lang)}</span></em>
      )}</span>
      <small>EV</small><span className={diff(!was || evLine(was, lang) === evs)}><em>{evs || '—'}</em></span>
      {set.teraType && <><small>{t('editor.tera')}</small><span className={diff(was?.teraType === set.teraType)}>{typeName(set.teraType, lang)}</span></>}
    </div>
  );
}

/**
 * Le statistiche finali a esagono e le quattro mosse come pillole (le mosse nuove rispetto a `was` col punto azzurro).
 * `movesLabel`: fuori dal tooltip (nel dettaglio) le mosse sono una lista con quel nome, per i lettori di schermo.
 */
export function MemberStatsMoves({ set, was, movesLabel }: { set: TeamSet; was?: TeamSet; movesLabel?: string }) {
  return (
    <div className="mcard-body">
      <StatHex set={set} />
      <MemberMoves set={set} was={was} movesLabel={movesLabel} />
    </div>
  );
}

/** Le quattro mosse come pillole (le nuove rispetto a `was` col punto azzurro); `movesLabel`: una lista con quel nome. */
export function MemberMoves({ set, was, movesLabel, className = '' }: { set: TeamSet; was?: TeamSet; movesLabel?: string; className?: string }) {
  const t = useT();
  const moves = set.moves.filter(Boolean);
  const oldMoves = new Set((was?.moves ?? []).filter(Boolean));
  return (
    <div className={`mcard-moves${className ? ` ${className}` : ''}`} {...(movesLabel ? { role: 'list', 'aria-label': movesLabel } : {})}>
      {moves.length ? moves.map((move, i) => <MovePlate key={`${move}#${i}`} name={move} fresh={!!was && !oldMoves.has(move)} item={!!movesLabel} />) : <span className="mcard-none">{t('mcard.noMoves')}</span>}
    </div>
  );
}

/**
 * La carta di un Pokémon del team, per i tooltip DreamDex: testata nei colori dei suoi tipi con la sprite grande, il
 * nome e (`why`) una lastra col perché è lì; strumento, abilità, natura ed EV; le statistiche a esagono e le quattro
 * mosse. Solo a vista: chi la apre ha già il nome in parole. `was`: il set di prima (un set cambiato da Completa team o
 * dal Coaching): le parti diverse (strumento, abilità, natura, EV, mosse nuove) si accendono in azzurro.
 */
/** Un problema del membro (rosso non legale, giallo da controllare), detto nella carta: nel team compresso non c'è il triangolo. */
export interface MemberAlert { level: 'danger' | 'warn'; text: string }

/**
 * I ruoli del set in una riga semplice, in fondo alla carta: prima il principale (lo stesso delle carte del team), poi gli
 * altri; la spiegazione di ognuno nel tooltip del nome. Le regole del formato dal contesto dell'app, o passate (il
 * dettaglio dei candidati); senza regole niente riga.
 */
export function MemberRoles({ set, rules }: { set: TeamSet; rules?: FormatRules }) {
  const t = useT();
  const lang = useLang();
  const fromApp = useContext(RulesContext);
  const used = rules ?? fromApp;
  if (!used) return null;
  const main = cardRoles(set, used)[0];
  const roles = [...(main ? [main] : []), ...shownRoles(detectRoles(set, used), used).filter(role => role !== main)];
  if (!roles.length) return null;
  return (
    <p className="mcard-roles">
      <small>{t('area.roles')}</small>
      <span>
        {roles.map((role, i) => (
          <span key={role} title={role === 'weather' ? undefined : roleDescription(role, lang)}>
            {i > 0 && ' · '}{role === 'weather' ? t('card.weather') : roleLabel(role, lang)}
          </span>
        ))}
      </span>
    </p>
  );
}

export function MemberCard({ set, was, alerts }: { set: TeamSet; was?: TeamSet; alerts?: MemberAlert[] }) {
  const species = battleSpecies(set);
  const types = (species?.types ?? []) as string[];
  return (
    <>
      <div className="mcard-head" style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
        <span className="mcard-mon"><Sprite species={battleName(set)} size={96} /></span>
        <span className="mcard-name">
          {battleName(set)}
          {types.map(type => <img key={type} className="ti-sq" style={tileStyle(type)} src={typeIconUrl(type)} alt="" draggable={false} />)}
        </span>
      </div>
      {!!alerts?.length && (
        <ul className="mcard-alerts">
          {alerts.map(alert => <li key={alert.text} className={alert.level}><Icon name="warning" />{alert.text}</li>)}
        </ul>
      )}
      <MemberKit set={set} was={was} />
      <MemberStatsMoves set={set} was={was} />
      <MemberRoles set={set} />
    </>
  );
}

/**
 * La carta del Pokémon come tooltip DreamDex dove serve (Completa team, carte del team, candidati, Coaching, minacce):
 * `bind(set)` dà i gestori da mettere sull'elemento (mouse e fuoco), `tip` è il tooltip da rendere una volta.
 * `delay`: quanto aspetta prima di aprirsi (più lungo dove il mouse passa spesso); `near`: il selettore dell'antenato
 * sotto cui aprirsi (la carta del team: sotto la carta intera, non sotto la sprite); `side`: di lato (le tabelle di
 * Analisi, così la carta non copre le righe sotto).
 */
export function useMemberTip(delay?: number, near?: string, side?: boolean | 'left') {
  const anchor = useFloatAnchor<{ set: TeamSet; was?: TeamSet; alerts?: MemberAlert[] }>(delay);
  const show = (set: TeamSet, was?: TeamSet, alerts?: MemberAlert[]) => (e: MouseEvent<Element> | FocusEvent<Element>) =>
    anchor.open({ set, was, alerts }, (near && e.currentTarget.closest(near)) || e.currentTarget);
  const bind = (set: TeamSet, was?: TeamSet, alerts?: MemberAlert[]) => ({ onMouseEnter: show(set, was, alerts), onMouseLeave: anchor.close, onFocus: show(set, was, alerts), onBlur: anchor.close });
  const current = anchor.anchor;
  const tip = current && (
    <FloatTip rect={current.rect} tone={typeColor((battleSpecies(current.key.set)?.types[0] as string | undefined) ?? '')} className="member" side={side}>
      <MemberCard set={current.key.set} was={current.key.was} alerts={current.key.alerts} />
    </FloatTip>
  );
  return { bind, tip, close: anchor.close };
}
