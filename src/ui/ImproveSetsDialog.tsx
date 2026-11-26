import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { family, type SetChange } from '../engine/bestPreset';
import { improveSetsLater } from './useRanking';
import type { EngineData } from '../engine/data';
import { battleAbility } from '../engine/dex';
import { gradeFor, rateTeam } from '../engine/rating';
import { STAT_IDS, type TeamSet } from '../engine/sets';
import { gameName, natureName, statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { Sprite } from './Sprite';
import { EeveeMoment } from './EeveeMoment';
import { PokemonIcon } from './PokemonName';
import { MoveName } from './TypeText';
import { kitTip } from './MoveTip';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';

const evsText = (set: TeamSet, lang: ReturnType<typeof useLang>) =>
  STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0).map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`).join(' / ');
const sameEvs = (a: TeamSet, b: TeamSet) => STAT_IDS.every(stat => (a.evs[stat] ?? 0) === (b.evs[stat] ?? 0));

/** Un pezzo del set: in verde quando nel set nuovo è diverso da adesso. */
function Part({ fresh, children }: { fresh?: boolean; children: ReactNode }) {
  return <span className={fresh ? 'is-new' : undefined}>{children}</span>;
}

/** Il set in breve: strumento, abilità · natura, EV, le mosse. `than` = il set di prima (per segnare in verde cosa cambia). */
function SetBrief({ set, than, label, className }: { set: TeamSet; than?: TeamSet; label: string; className: string }) {
  const lang = useLang();
  const t = useT();
  const ability = battleAbility(set);
  const known = new Set(than?.moves.filter(Boolean).map(family));
  return (
    <div className={`improve-set ${className}`}>
      {/* Il nome della parte (Adesso / Dopo) per i lettori di schermo: a vista lo dicono il posto e la freccia */}
      <span className="visually-hidden">{label}</span>
      <span className="improve-line"><Part fresh={!!than && than.item !== set.item}>
        {set.item ? <span {...kitTip('item', set.item)}><ItemIcon item={set.item} /> {gameName('item', set.item, lang)}</span> : t('improve.noItem')}
      </Part></span>
      <span className="improve-line">
        {ability && <Part fresh={!!than && battleAbility(than) !== ability}><span {...kitTip('ability', ability)}>{gameName('ability', ability, lang)}</span></Part>}
        {set.nature && <>{ability && ' · '}<Part fresh={!!than && than.nature !== set.nature}>{natureName(set.nature, lang)}</Part></>}
      </span>
      <span className="improve-line improve-evs"><Part fresh={!!than && !sameEvs(than, set)}>{evsText(set, lang) || '—'}</Part></span>
      {/* Sempre quattro righe (un posto vuoto è un trattino): le mosse stanno alla stessa altezza in tutte le colonne */}
      <ul className="improve-moves" aria-label={t('editor.moves')}>
        {[0, 1, 2, 3].map(i => {
          const move = set.moves[i] ?? '';
          return <li key={i} className={move && than && !known.has(family(move)) ? 'is-new' : move ? undefined : 'empty'}>{move ? <MoveName move={move} plain /> : '—'}</li>;
        })}
      </ul>
    </div>
  );
}

/** Testata di una colonna: un'etichetta (tocca e cambia la casella) se c'è un cambio, se no un riquadro semplice. */
function ColHead({ changed, children }: { changed: boolean; children: ReactNode }) {
  return changed ? <label className="improve-col-head">{children}</label> : <div className="improve-col-head">{children}</div>;
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
  const [changes, setChanges] = useState<SetChange[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  useEscape(onCancel);
  useEffect(() => {
    ok.current?.focus();
    // Il calcolo (fino a qualche secondo la prima volta) va in sottofondo: la finestra si apre subito e resta fluida
    let live = true;
    void improveSetsLater(team, data, genLimit).then(next => {
      if (!live) return;
      setChanges(next);
      setPicked(new Set(next.flatMap((c, i) => (c.changed ? [i] : []))));
    });
    return () => { live = false; };
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

  return (
    <ModalShell className={`improve-dialog${open ? ' open' : ''}`} titleId={`${id}-title`} describedBy={`${id}-text`} title={t('team.bestPresets')}
      closeLabel={t('help.close')} onClose={onCancel}>
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
                      {/* Con un cambio la testata intera è l'etichetta della casella: si tocca tutta (col dito la casella da sola
                          sarebbe 18px) */}
                      <ColHead changed={change.changed}>
                        {change.changed
                          ? <input type="checkbox" checked={on} onChange={() => toggle(i)} aria-label={t('improve.include', { name })} />
                          : <span className="improve-check-spacer" aria-hidden="true" />}
                        <span className="improve-mini" aria-hidden="true"><Sprite species={name} item={change.after.item} size={44} /></span>
                        <span className="improve-name" title={name}>{name}</span>
                        {change.changed
                          ? <span className={`improve-gain${change.gain > 0 ? ' up' : change.gain < 0 ? ' down' : ''}`}
                            title={change.gain === 0 ? t('improve.gainZero') : t('improve.gainTitle', { name, n: change.gain > 0 ? `+${change.gain}` : String(change.gain) })}>
                            {change.gain > 0 ? `+${change.gain}` : change.gain === 0 ? '±0' : change.gain}</span>
                          : <span className="improve-gain same">{t('improve.sameShort')}</span>}
                      </ColHead>
                      <SetBrief set={change.before} label={t('improve.now')} className="is-before" />
                      {change.changed ? <>
                        <span className="improve-down" aria-hidden="true"><Icon name="arrow" /> {t('improve.after')}</span>
                        <SetBrief set={change.after} than={change.before} label={t('improve.after')} className="is-after" />
                      </> : <p className="improve-same"><Icon name="check" /> {t('improve.same')}</p>}
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
    </ModalShell>
  );
}
