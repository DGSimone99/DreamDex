import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { family, type SetChange } from '../engine/bestPreset';
import { improveSetsLater } from './useRanking';
import type { EngineData } from '../engine/data';
import { battleAbility } from '../engine/dex';
import { gradeFor, rateTeam } from '../engine/rating';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { gameName, natureName, statShort, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { ModalLock } from './ModalLock';
import { Sprite } from './Sprite';
import { EeveeMoment } from './EeveeMoment';
import { PokemonIcon } from './PokemonName';
import { MoveName } from './TypeText';

const evsText = (set: TeamSet, lang: ReturnType<typeof useLang>) =>
  STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
const sameEvs = (a: TeamSet, b: TeamSet) => STAT_IDS.every(stat => (a.evs[stat] ?? 0) === (b.evs[stat] ?? 0));

/** Un cambio: cosa (Strumento, Mossa…), com'è adesso e com'è dopo. */
interface Diff { label: string; from: ReactNode; to: ReactNode }

/** Solo ciò che cambia fra i due set, nell'ordine del set: strumento, abilità, natura, EV, poi le mosse posto per posto. */
function diffsOf(before: TeamSet, after: TeamSet, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): Diff[] {
  const none = <span className="improve-none-value">—</span>;
  const item = (name: string) => (name ? <><ItemIcon item={name} /> {gameName('item', name, lang)}</> : t('improve.noItem'));
  const out: Diff[] = [];
  if (before.item !== after.item) out.push({ label: t('improve.item'), from: item(before.item), to: item(after.item) });
  const [a, b] = [battleAbility(before), battleAbility(after)];
  if (a !== b) out.push({ label: t('improve.ability'), from: a ? gameName('ability', a, lang) : none, to: b ? gameName('ability', b, lang) : none });
  if (before.nature !== after.nature) out.push({ label: t('improve.nature'), from: before.nature ? natureName(before.nature, lang) : none, to: after.nature ? natureName(after.nature, lang) : none });
  if (!sameEvs(before, after)) out.push({ label: t('improve.evs'), from: evsText(before, lang) || none, to: evsText(after, lang) || none });
  if (before.teraType !== after.teraType) out.push({ label: t('editor.tera'), from: before.teraType ? typeName(before.teraType, lang) : none, to: after.teraType ? typeName(after.teraType, lang) : none });
  // Le mosse posto per posto (alignMoves: chi resta tiene il suo posto), così ogni riga dice chi lascia il posto a chi
  const slots = Math.max(before.moves.length, after.moves.length);
  for (let i = 0; i < slots; i++) {
    const [from, to] = [before.moves[i] ?? '', after.moves[i] ?? ''];
    if ((from && to && family(from) === family(to)) || (!from && !to)) continue;
    out.push({ label: t('improve.move'), from: from ? <MoveName move={from} plain /> : none, to: to ? <MoveName move={to} plain /> : none });
  }
  return out;
}

/** La colonna di un membro: solo i cambi, "prima" spento e "→ dopo" in verde; in fondo che il resto non cambia. */
function ChangeList({ change }: { change: SetChange }) {
  const t = useT();
  const lang = useLang();
  const diffs = diffsOf(change.before, change.after, t, lang);
  return (
    <div className="improve-diffs">
      <dl>
        {diffs.map((d, i) => (
          <div key={i} className="improve-diff">
            <dt>{d.label}</dt>
            <dd className="from"><span className="visually-hidden">{t('improve.now')}: </span>{d.from}</dd>
            <dd className="to"><span aria-hidden="true">→ </span><span className="visually-hidden">{t('improve.after')}: </span>{d.to}</dd>
          </div>
        ))}
      </dl>
      <p className="improve-rest">{t('improve.rest')}</p>
    </div>
  );
}

/**
 * Migliora i set: prima una conferma rapida col risultato (voto prima → dopo); "Controlla cambiamenti" allarga la
 * finestra e mostra un Pokémon per colonna, il set di adesso, la freccia e il set nuovo (in verde ciò che cambia), quanto
 * sale il voto con solo quel cambio e una casella per tenerlo o no. Applica cambia solo i membri spuntati.
 * Esc, Annulla o un clic fuori chiudono senza cambiare niente; il focus parte da Applica.
 */
export function ImproveSetsDialog({ team, data, genLimit, onApply, onCancel }: {
  team: TeamSet[];
  data: EngineData;
  genLimit: number;
  onApply: (team: TeamSet[]) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const ok = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const [changes, setChanges] = useState<SetChange[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel.current(); };
    document.addEventListener('keydown', onKey);
    // Il calcolo (fino a qualche secondo la prima volta) va in sottofondo: la finestra si apre subito e resta fluida
    let live = true;
    void improveSetsLater(team, data, genLimit).then(next => {
      if (!live) return;
      setChanges(next);
      setPicked(new Set(next.flatMap((c, i) => (c.changed ? [i] : []))));
    });
    return () => { live = false; document.removeEventListener('keydown', onKey); };
  }, []);
  // Dopo il calcolo il focus resta su Applica (era spento mentre calcolava)
  useEffect(() => { if (changes) ok.current?.focus(); }, [changes]);

  const changedCount = changes?.filter(c => c.changed).length ?? 0;
  const result = useMemo(() => {
    if (!changes) return null;
    const next = team.map((s, i) => (picked.has(i) ? changes[i].after : s));
    return { next, before: rateTeam(team, data, lang)?.overall ?? null, after: rateTeam(next, data, lang)?.overall ?? null };
  }, [changes, picked, team, data, lang]);
  const toggle = (i: number) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  const grade = (score: number | null) => score === null ? null : gradeFor(score, lang).grade;
  const delta = result && result.before !== null && result.after !== null ? result.after - result.before : null;
  const apply = changes ? (picked.size === changedCount ? t('team.bestPresetsApply') : t(picked.size === 1 ? 'improve.applyOne' : 'improve.applyMany', { n: picked.size })) : t('team.bestPresetsBusy');

  return createPortal(
    <div className="help-backdrop" onClick={onCancel}>
      <ModalLock />
      <div className={`help-dialog improve-dialog${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}
        onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}>{t('team.bestPresets')}</h3>
          <button type="button" className="help-close" aria-label={t('help.close')} onClick={onCancel}><Icon name="close" /></button>
        </header>
        <div className="improve-body">
          {!open && <p id={`${id}-text`} className="improve-text">{t('team.bestPresetsConfirm')}</p>}
          {/* Il risultato: voto di adesso → con i cambi scelti; si aggiorna con le caselle */}
          <div className="improve-total" role="status" aria-live="polite">
            {!changes ? <span className="improve-busy"><EeveeMoment pose="thinking" /> {t('team.bestPresetsBusy')}</span>
              : changedCount === 0 ? <span className="improve-none">{t('improve.none')}</span>
              : <>
                {result?.before !== null && result?.after !== null && <>
                  <span className={`improve-grade grade-${grade(result!.before)}`}>{grade(result!.before)} {result!.before}</span>
                  <span className="improve-arrow" aria-hidden="true">→</span>
                  <span className={`improve-grade to grade-${grade(result!.after)}`}>{grade(result!.after)} {result!.after}</span>
                </>}
                <span className="improve-count">
                  {open ? t('improve.picked', { n: picked.size, total: changedCount })
                    : t(changedCount === 1 ? 'improve.countOne' : 'improve.countMany', { n: changedCount })}
                </span>
                {!open && (
                  // Chi cambia set, a colpo d'occhio: le icone del team, accese quelle che cambiano
                  <span className="improve-who" aria-hidden="true">
                    {changes.map((c, i) => <span key={i} className={c.changed ? 'on' : undefined}><PokemonIcon name={c.before.species} /></span>)}
                  </span>
                )}
                {delta !== null && <span className={`improve-delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}`}>{delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}</span>}
              </>}
          </div>
          {open && changes && (
            <>
              <ol className="improve-cols" style={{ '--cols': team.length } as CSSProperties}>
                {changes.map((change, i) => {
                  const name = change.before.species;
                  const on = picked.has(i);
                  return (
                    <li key={i} className={`improve-col${!change.changed ? ' same' : on ? '' : ' off'}`}>
                      <div className="improve-col-head">
                        {change.changed
                          ? <input type="checkbox" checked={on} onChange={() => toggle(i)} aria-label={t('improve.include', { name })} />
                          : <span className="improve-check-spacer" aria-hidden="true" />}
                        <span className="improve-mini" aria-hidden="true"><Sprite species={name} item={change.after.item} size={44} /></span>
                        <span className="improve-name" title={name}>{name}</span>
                        {change.changed
                          ? <span className={`improve-gain${change.gain > 0 ? ' up' : change.gain < 0 ? ' down' : ''}`}
                            title={t('improve.gainTitle', { name, n: change.gain > 0 ? `+${change.gain}` : String(change.gain) })}>
                            {change.gain > 0 ? `+${change.gain}` : change.gain === 0 ? '±0' : change.gain}</span>
                          : <span className="improve-gain same">{t('improve.sameShort')}</span>}
                      </div>
                      {change.changed ? <ChangeList change={change} /> : <p className="improve-same"><Icon name="check" /> {t('improve.same')}</p>}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
        <div className="improve-actions">
          {changes && changedCount > 0 && (
            <button type="button" className="improve-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
              <span className="improve-chevron" aria-hidden="true" /> {t(open ? 'improve.hide' : 'improve.check')}
            </button>
          )}
          {/* Accanto a Nascondi: i +N dei singoli e il totale (in alto) possono non tornare */}
          {open && changes && <p className="improve-note">{t('improve.note')}</p>}
          <span className="improve-grow" />
          <button type="button" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button type="button" className="apply primary" ref={ok} disabled={!changes || picked.size === 0}
            onClick={() => result && onApply(result.next)}>{apply}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
