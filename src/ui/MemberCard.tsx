import type { CSSProperties, FocusEvent, MouseEvent, ReactNode } from 'react';
import { battleAbility, battleName, battleSpecies, dex } from '../engine/dex';
import type { StatID, TeamSet } from '../engine/sets';
import { statLines } from '../engine/statCalc';
import { anyGameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { FloatTip, useFloatAnchor } from './FloatTip';
import { Sprite, typeColor } from './Sprite';
import { MovePill } from './MovePill';
import { typeIconUrl } from './typeIcons';

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
function StatHex({ set }: { set: TeamSet }) {
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
      <small>{t('mcard.item')}</small><span className={diff(was?.item === set.item)}>{set.item ? anyGameName(set.item, lang) : '—'}</span>
      <small>{t('mcard.nature')}</small>
      <span className={diff(was?.nature === set.nature)}>{set.nature ? natureName(set.nature, lang) : '—'}{nature?.plus && nature.minus && (
        <em> +{statShort(nature.plus as StatID, lang)} −{statShort(nature.minus as StatID, lang)}</em>
      )}</span>
      {/* L'abilità in battaglia: con una Megapietra quella della Mega (Mega Venusaur: Grassospesso, non Clorofilla) */}
      <small>{t('mcard.ability')}</small><span className={diff(was?.ability === set.ability)}>{battleAbility(set) || set.ability ? anyGameName(battleAbility(set) || set.ability, lang) : '—'}</span>
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
  const t = useT();
  const moves = set.moves.filter(Boolean);
  const oldMoves = new Set((was?.moves ?? []).filter(Boolean));
  return (
    <div className="mcard-body">
      <StatHex set={set} />
      <div className="mcard-moves" {...(movesLabel ? { role: 'list', 'aria-label': movesLabel } : {})}>
        {moves.length ? moves.map((move, i) => <MovePlate key={`${move}#${i}`} name={move} fresh={!!was && !oldMoves.has(move)} item={!!movesLabel} />) : <span className="mcard-none">{t('mcard.noMoves')}</span>}
      </div>
    </div>
  );
}

/**
 * La carta di un Pokémon del team, per i tooltip DreamDex: testata nei colori dei suoi tipi con la sprite grande, il
 * nome e (`why`) una lastra col perché è lì; strumento, abilità, natura ed EV; le statistiche a esagono e le quattro
 * mosse. Solo a vista: chi la apre ha già il nome in parole. `was`: il set di prima (un set cambiato da Completa team o
 * dal Coaching): le parti diverse (strumento, abilità, natura, EV, mosse nuove) si accendono in azzurro.
 */
export function MemberCard({ set, why, was }: { set: TeamSet; why?: ReactNode; was?: TeamSet }) {
  const species = battleSpecies(set);
  const types = (species?.types ?? []) as string[];
  return (
    <>
      <div className="mcard-head" style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? '') } as CSSProperties}>
        <span className="mcard-mon"><Sprite species={battleName(set)} size={96} /></span>
        <span className="mcard-name">
          {battleName(set)}
          {types.map(type => <img key={type} src={typeIconUrl(type)} alt="" draggable={false} />)}
        </span>
        {why && <span className="mcard-why">{why}</span>}
      </div>
      <MemberKit set={set} was={was} />
      <MemberStatsMoves set={set} was={was} />
    </>
  );
}

/**
 * La carta del Pokémon come tooltip DreamDex dove serve (Completa team, carte del team, candidati, Coaching, minacce):
 * `bind(set, why)` dà i gestori da mettere sull'elemento (mouse e fuoco), `tip` è il tooltip da rendere una volta.
 * `delay`: quanto aspetta prima di aprirsi (più lungo dove il mouse passa spesso); `near`: il selettore dell'antenato
 * sotto cui aprirsi (la carta del team: sotto la carta intera, non sotto la sprite); `side`: di lato (le tabelle di
 * Analisi, così la carta non copre le righe sotto).
 */
export function useMemberTip(delay?: number, near?: string, side?: boolean | 'left') {
  const anchor = useFloatAnchor<{ set: TeamSet; why?: ReactNode; was?: TeamSet }>(delay);
  const show = (set: TeamSet, why?: ReactNode, was?: TeamSet) => (e: MouseEvent<Element> | FocusEvent<Element>) =>
    anchor.open({ set, why, was }, (near && e.currentTarget.closest(near)) || e.currentTarget);
  const bind = (set: TeamSet, why?: ReactNode, was?: TeamSet) => ({ onMouseEnter: show(set, why, was), onMouseLeave: anchor.close, onFocus: show(set, why, was), onBlur: anchor.close });
  const current = anchor.anchor;
  const tip = current && (
    <FloatTip rect={current.rect} tone={typeColor((battleSpecies(current.key.set)?.types[0] as string | undefined) ?? '')} className="member" side={side}>
      <MemberCard set={current.key.set} why={current.key.why} was={current.key.was} />
    </FloatTip>
  );
  return { bind, tip, close: anchor.close };
}
