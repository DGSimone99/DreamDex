import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { StatID } from '@pkmn/dex';
import type { DuelTip, DuelTipsResult, EvMap, MetaEffect, TipId, TipOption } from '../engine/duelTips';
import { battleSpeed, duelHits, type DuelHit } from '../engine/editorDuel';
import { gradeFor } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { gameName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Combobox } from './Combobox';
import { FloatTip, useFloatAnchor } from './FloatTip';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { typeColor } from './Sprite';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';

/** Quanti Pokémon mostra il tooltip di un effetto sul meta prima di "e altri N". */
export const META_TIP_ROWS = 8;
const STATS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const evList = (evs: EvMap) => STATS.filter(stat => evs[stat]).map(stat => [stat, evs[stat]!] as const);

export interface QuickTip { id: TipId; label: string }

/**
 * I consigli della Sfida: una riga sempre presente in fondo alla scheda con un chip per consiglio. Il clic su un chip
 * apre una scheda corta: prima → dopo, da dove si prendono gli EV (o quale mossa si toglie), cosa cambia contro il resto
 * del meta (il conto, la lista nel tooltip), il voto del team e Applica. `quick` sono i chip subito (da editorDuel);
 * `result` i consigli completi dal calcolo in sottofondo (null mentre calcola).
 */
export function DuelTips({ me, opp, quick, result, onApply }: {
  me: TeamSet; opp: TeamSet; quick: QuickTip[]; result: DuelTipsResult | null; onApply?: (next: TeamSet, change: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState<TipId | null>(null);
  // La variante scelta a mano (mossa da togliere), per consiglio; senza, la migliore
  const [picked, setPicked] = useState<Partial<Record<TipId, number>>>({});
  const [hidden, setHidden] = useState(0);
  const lineRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<TipId, HTMLButtonElement>());
  const anchor = useRef<HTMLElement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const cardId = useId();
  const chips = quick.filter(q => !result || result.tips.some(tip => tip.id === q.id));
  const key = chips.map(c => c.id).join(',');

  // Il set o l'avversario cambiano: la scelta a mano non vale più
  useEffect(() => { setPicked({}); }, [me, opp]);
  useEffect(() => { if (open && !chips.some(c => c.id === open)) setOpen(null); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // I chip che non stanno nella riga: l'ultimo che sta diventa "Altri N"
  useLayoutEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const fit = () => {
      const room = line.getBoundingClientRect().right;
      const els = [...chipRefs.current.values()];
      setHidden(0);
      if (!room || !els.length) return;
      const out = els.filter(el => el.getBoundingClientRect().right > room + 0.5).length;
      setHidden(out ? out + 1 : 0);
    };
    fit();
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    watch?.observe(line);
    return () => watch?.disconnect();
  }, [key]);

  const close = (focus = true) => {
    const was = open;
    setOpen(null);
    if (focus && was) chipRefs.current.get(was)?.focus();
  };
  useAnchoredPop(anchor, pop, open !== null, { width: 324, prefer: 'above', gap: 8, sheet: true, onDismiss: () => close(false) });
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (pop.current?.contains(target) || anchor.current?.contains(target) || target.closest?.('[role="listbox"], .ftip')) return;
      setOpen(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const toggle = (id: TipId, el: HTMLElement) => {
    anchor.current = el;
    setOpen(o => (o === id ? null : id));
  };

  const rest = hidden ? chips.slice(chips.length - hidden) : [];
  const tip = open && result ? result.tips.find(x => x.id === open) ?? null : null;
  const openQuick = open ? chips.find(c => c.id === open) ?? null : null;

  return (
    // Esc con il fuoco sul chip (o nella scheda) chiude solo la scheda: non arriva alla carta del team, che chiuderebbe l'editor
    <div className="duel-tips" ref={lineRef} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(); } }}>
      <b>{t('editor.duelTips')}</b>
      {chips.length === 0 && <span className="duel-tips-none">{t('duel.tipsNone')}, {noneReason(me, opp, t)}</span>}
      {chips.map((chip, i) => {
        const isHidden = rest.includes(chip);
        return (
          <button key={chip.id} type="button" ref={el => { if (el) chipRefs.current.set(chip.id, el); else chipRefs.current.delete(chip.id); }}
            className={`duel-tip-chip${open === chip.id ? ' on' : ''}${isHidden ? ' out' : ''}`} aria-expanded={open === chip.id} aria-controls={cardId}
            tabIndex={isHidden ? -1 : undefined} aria-hidden={isHidden || undefined} data-index={i}
            onClick={e => toggle(chip.id, e.currentTarget)}>
            {chip.label}
          </button>
        );
      })}
      {rest.length > 0 && (
        <button type="button" className={`duel-tip-chip more${rest.some(c => c.id === open) ? ' on' : ''}`} aria-expanded={rest.some(c => c.id === open)}
          aria-controls={cardId} onClick={e => toggle(rest[0].id, e.currentTarget)}>
          {t('duel.tipsMore', { n: rest.length })}
        </button>
      )}
      {open && openQuick && (
        <div className="duel-tip-card" ref={pop} id={cardId} role="dialog" aria-label={openQuick.label} popover={supportsPopover ? 'manual' : undefined}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
          <TipCard me={me} opp={opp} quick={openQuick} tip={tip} base={result?.overall ?? null} pick={tip ? picked[tip.id] ?? tip.best : 0}
            onPick={i => tip && setPicked(p => ({ ...p, [tip.id]: i }))} onClose={() => close()}
            onApply={(next, change) => { setOpen(null); onApply?.(next, change); }} />
        </div>
      )}
    </div>
  );
}

type Tr = ReturnType<typeof useT>;

/** Perché non ci sono consigli: "lo mandi KO in 1 colpo e muovi primo" se è così, altrimenti la frase generica. */
function noneReason(me: TeamSet, opp: TeamSet, t: Tr): string {
  const { mine } = duelHits(me, opp);
  return mine?.hitsSure === 1 && battleSpeed(me) > battleSpeed(opp) ? t('duel.tipsNoneKo') : t('duel.tipsNoneAny');
}

const hitsText = (hit: DuelHit | null) => {
  if (!hit || !Number.isFinite(hit.hitsMaybe)) return '—';
  return hit.hitsSure === hit.hitsMaybe || !Number.isFinite(hit.hitsSure) ? String(Number.isFinite(hit.hitsSure) ? hit.hitsSure : hit.hitsMaybe) : `${hit.hitsMaybe}–${hit.hitsSure}`;
};
const rangeText = (hit: DuelHit | null) => (hit && hit.max > 0 ? `${Math.round(hit.min * 100)}–${Math.round(hit.max * 100)}%` : '0%');

function TipCard({ me, opp, quick, tip, base, pick, onPick, onClose, onApply }: {
  me: TeamSet; opp: TeamSet; quick: QuickTip; tip: DuelTip | null; base: number | null; pick: number;
  onPick: (i: number) => void; onClose: () => void; onApply: (next: TeamSet, change: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const option: TipOption | null = tip ? tip.options[pick] ?? tip.options[tip.best] : null;
  const icon = quick.id === 'def' ? 'shield' : quick.id === 'spe' ? 'speed' : 'sword';
  const evsText = (add: EvMap) => evList(add)
    .map(([stat, n], i) => t(i === 0 ? 'editor.duelTipEvs' : 'editor.duelTipEvsMore', { n, stat: statShort(stat, lang) })).join(' ');
  const moveName = (move: string) => (move ? gameName('move', move, lang) : '—');
  const title = tip?.move ? moveName(tip.move) : tip ? evsText(tip.add) : quick.label;

  const change = (o: TipOption, d: DuelTip) => {
    if (d.move) return `${moveName(o.replaced ?? '')} → ${moveName(d.move)}`;
    const taken = evList(o.taken).map(([stat, n]) => t('duel.changeTaken', { n, stat: statShort(stat, lang) }));
    return [evsText(d.add), ...taken].join(', ');
  };

  let compare: ReactNode = <p className="duel-tip-busy">{t('duel.tipBusy')}</p>;
  if (tip && option) {
    if (tip.id === 'spe') {
      const theirs = battleSpeed(opp);
      const place = (n: number) => t(n > theirs ? 'editor.duelSpeedFirst' : n < theirs ? 'editor.duelSpeedSecond' : 'editor.duelSpeedEven');
      const a = battleSpeed(me);
      const b = battleSpeed(option.set);
      compare = (
        <div className="duel-tip-ba">
          <span className="duel-tip-what">{t('editor.duelSpeed')} · {opp.species} {theirs}</span>
          <span className="now big">{place(a)} {a}</span><Icon name="arrow" /><span className="new big">{place(b)} {b}</span>
        </div>
      );
    } else {
      const theirs = tip.row === 'theirs';
      const was = duelHits(me, opp);
      const now = duelHits(option.set, opp);
      const before = theirs ? was.theirs : was.mine;
      const after = theirs ? now.theirs : now.mine;
      const unit = (hit: DuelHit | null) => t(hitsText(hit) === '1' ? 'editor.duelHitUnit' : 'editor.duelHitsUnit');
      compare = (
        <div className="duel-tip-ba">
          {before && <span className="duel-tip-what">{gameName('move', before.move, lang)}</span>}
          <span className="now">{rangeText(before)}</span><Icon name="arrow" /><span className="new">{rangeText(after)}</span>
          <span className="now big">{hitsText(before)}<small>{unit(before)}</small></span><Icon name="arrow" />
          <span className="new big">{hitsText(after)}<small>{unit(after)}</small></span>
        </div>
      );
    }
  }

  let source: ReactNode = null;
  if (tip && option && tip.move) {
    source = (
      <div className="duel-tip-source">
        <Combobox label={t('duel.tipReplace')} value={String(pick)} restricted className="duel-tip-replace"
          options={tip.options.map((o, i) => ({ value: String(i), label: moveName(o.replaced ?? '') }))}
          onChange={value => onPick(Number(value))} />
      </div>
    );
  } else if (tip && option) {
    const taken = evList(option.taken);
    source = (
      <p className="duel-tip-source">
        {taken.length ? taken.map(([stat, n]) => t('duel.tipTaken', { stat: statShort(stat, lang), from: (me.evs[stat] ?? 0), to: (me.evs[stat] ?? 0) - n })).join(' · ') : t('duel.tipFree')}
      </p>
    );
  }

  const score = option?.overall ?? null;
  const letter = score !== null ? gradeFor(score, lang).grade : null;
  const diff = score !== null && base !== null ? score - base : null;
  return (
    <>
      <div className="duel-tip-head">
        <span className={`duel-tip-icon ${quick.id}`} aria-hidden="true"><Icon name={icon} /></span>
        <span className="duel-tip-title">{title}</span>
        <button type="button" className="duel-tip-close" aria-label={t('duel.tipClose')} onClick={onClose}><Icon name="close" /></button>
      </div>
      {compare}
      {source}
      {option && option.effects.length > 0 && (
        <div className="duel-tip-fx">
          <span className="duel-tip-label">{t('duel.tipMeta')}</span>
          {option.effects.map(fx => <EffectLine key={fx.kind} fx={fx} />)}
        </div>
      )}
      <div className="duel-tip-foot">
        <span className="duel-tip-grade">
          {letter && <span className={`duel-tip-letter grade-${letter}`}>{letter}</span>}
          <span className="duel-tip-score">
            <span className="duel-tip-nums">{`${base ?? '—'} → ${score ?? '—'}`}</span>
            <span className="duel-tip-label">{t('duel.tipGrade')}</span>
          </span>
          {diff !== null && <span className={`duel-tip-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'}`}>{diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '='}</span>}
        </span>
        <button type="button" className="duel-tip-apply" disabled={!tip || !option}
          onClick={() => { if (tip && option) onApply(option.set, change(option, tip)); }}>{t('duel.tipApply')}</button>
      </div>
    </>
  );
}

const UP: MetaEffect['kind'][] = ['takeMore', 'dealMore'];

/** Una riga "Fai meno danni a 7 Pokémon del meta": il conto apre il tooltip con la lista (al massimo 8, poi "e altri N"). */
function EffectLine({ fx }: { fx: MetaEffect }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<string>();
  const up = UP.includes(fx.kind);
  const count = t('duel.fxCount', { n: fx.shifts.length });
  const hits = (n: number) => (Number.isFinite(n) ? String(n) : '—');
  const words = fx.shifts.map(s => `${s.species} ${t('duel.fxHits', { a: hits(s.before), b: hits(s.after) })}`).join(', ');
  const [before, after] = t(`duel.fx.${fx.kind}`, { n: '\u0000' }).split('\u0000');
  const shown = fx.shifts.slice(0, META_TIP_ROWS);
  return (
    <div className={`duel-tip-fxline ${up ? 'up' : 'down'}`}>
      <span className="duel-tip-arrow" aria-hidden="true"><Icon name="down" /></span>
      <span>
        {before}
        <button type="button" className="duel-tip-count" aria-label={`${count}: ${words}`} {...tip.bind('list')}>{count}</button>
        {after}
        {fx.type && <span className="duel-tip-type" style={{ background: typeColor(fx.type) }}>{typeName(fx.type, lang)}</span>}
      </span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={up ? 'var(--good)' : 'var(--bad)'} side layer className="duel-fx-tip">
          <div className="duel-fx-tip-head">{t('duel.fxTipHead')}</div>
          <ul>
            {shown.map(s => (
              <li key={s.species}>
                <PokemonIcon name={s.species} /><span>{s.species}</span>
                <span className="duel-fx-hits">{hits(s.before)} → <b className={up ? 'good' : 'bad'}>{hits(s.after)}</b> {t('editor.duelHitsUnit')}</span>
              </li>
            ))}
          </ul>
          {fx.shifts.length > META_TIP_ROWS && <div className="duel-fx-more">{t('duel.fxMore', { n: fx.shifts.length - META_TIP_ROWS })}</div>}
        </FloatTip>
      )}
    </div>
  );
}
