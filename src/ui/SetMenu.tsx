import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { supportsPopover, useAnchoredPop } from './useAnchoredPop';
import { presetSet } from '../engine/bestPreset';
import { formatName, sameSet, STAT_IDS, type Preset, type TeamSet } from '../engine/sets';
import { toID } from '../engine/dex';
import type { Lang } from '../i18n';
import { gameName, natureName, statShort } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { MY_SETS_MAX } from '../storage';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import {
  deleteMySet, mySetByName, mySetIndex, mySetsOf, overwriteMySet, renameMySet, saveMySet, setMySets, useMySets,
} from './mySets';
import { UndoToast, type UndoAction } from './UndoToast';

/** "Capsula energetica · Allegra · 252 Att / 252 Vel": strumento, natura e i due EV più alti. */
export function setSummary(set: TeamSet, lang: Lang): string {
  const evs = STAT_IDS.filter(stat => (set.evs[stat] ?? 0) > 0)
    .sort((a, b) => (set.evs[b] ?? 0) - (set.evs[a] ?? 0))
    .slice(0, 2)
    .map(stat => `${set.evs[stat]} ${statShort(stat, lang)}`)
    .join(' / ');
  return [set.item ? gameName('item', set.item, lang) : '', set.nature ? natureName(set.nature, lang) : '', evs].filter(Boolean).join(' · ');
}

type Tab = 'smogon' | 'mine';

interface Props {
  set: TeamSet;
  /** Set con nome delle analisi Smogon (al massimo 5), già resi legali. */
  presets: Preset[];
  /** Quale preset dà al team il voto più alto (la sua posizione in `presets`), chiesto all'apertura; null se non si sa. */
  bestIndex?: () => number | null;
  /** Il preset migliore, completato e ritoccato come faceva "Preset migliore": se manca, si applica il preset così com'è. */
  onBest?: () => void;
  /** Applica un set intero (preset o set salvato), tenendo specie, preferito e Custom Skillset. */
  onChange: (set: TeamSet) => void;
  /** Apre il riquadro del testo Showdown del set (incolla o copia a mano). */
  onText?: () => void;
  /** Il link alla pagina Smogon del Pokémon, in fondo al menu. */
  smogonLink?: ReactNode;
}

/** Il preset da cui sembra venire un set cambiato a mano: almeno 2 mosse in comune, poi strumento, abilità, natura ed EV. */
export function nearestPreset(set: TeamSet, presets: Preset[]): number {
  const moves = new Set(set.moves.filter(Boolean).map(toID));
  const evs = (s: TeamSet) => STAT_IDS.map(stat => s.evs[stat] ?? 0).join(',');
  let best = -1;
  let bestScore = -1;
  presets.forEach((preset, i) => {
    const shared = preset.set.moves.filter(move => move && moves.has(toID(move))).length;
    if (shared < 2) return;
    const score = shared * 10 + Number(toID(preset.set.item) === toID(set.item)) + Number(toID(preset.set.ability) === toID(set.ability))
      + Number(preset.set.nature === set.nature) + Number(evs(preset.set) === evs(set));
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

/**
 * Il pulsante "Set" della testata dell'editor e il suo menu: due schede, i preset Smogon (il migliore per il team in cima,
 * segnato) e I miei set (applica, rinomina, elimina); in fondo Incolla testo, Salva come… e Apri su Smogon.
 * Esc o un clic fuori lo chiudono e il fuoco torna al pulsante; le schede si cambiano con le frecce.
 */
export function SetMenu({ set, presets, bestIndex, onBest, onChange, onText, smogonLink }: Props) {
  const t = useT();
  const lang = useLang();
  const species = set.species;
  const mine = useMySets(species);
  const current = mySetIndex(mine, set);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('smogon');
  const [best, setBest] = useState<number | null>(null);
  // Salva come…: il campo del nome compare in cima a I miei set
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  // L'avviso con Annulla vive fuori dal menu: chiudendo il menu non sparisce
  const [undo, setUndo] = useState<(UndoAction & { before: ReturnType<typeof mySetsOf> }) | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // Sotto il pulsante, allineato a destra; sopra se sotto non c'è posto, sempre dentro la finestra
  useAnchoredPop(button, pop, open, { width: 410, align: 'end', gap: 6, sheet: true, onDismiss: () => close(false) });
  const id = useId();
  const tabId = (which: Tab) => `${id}-tab-${which}`;
  const panelId = `${id}-panel`;

  const close = (focus = true) => {
    setOpen(false);
    setSaving(false);
    setRenaming(null);
    if (focus) button.current?.focus();
  };
  const show = () => {
    // Il preset migliore si calcola all'apertura (pochi voti del team, uno per preset)
    setBest(presets.length > 1 && bestIndex ? bestIndex() : null);
    setTab(presets.length === 0 && mine.length > 0 ? 'mine' : 'smogon');
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Aperto: il fuoco va sulla scheda scelta, così frecce e Tab partono da lì
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (saving) nameRef.current?.focus(); }, [saving]);

  // Il nome del prossimo salvataggio: quello del set salvato uguale a quello attuale, se c'è
  const currentName = current >= 0 ? mine[current].name : '';
  useEffect(() => { setName(currentName); }, [currentName]);
  const existing = name.trim() ? mySetByName(mine, name) : -1;
  const full = mine.length >= MY_SETS_MAX;
  const savedAlready = current >= 0 && (existing === current || !name.trim());
  const overwrite = existing >= 0 && existing !== current;
  const canSave = !savedAlready && (overwrite || !full);
  const saveLabel = savedAlready ? t('editor.setSaved') : overwrite ? t('editor.overwriteSet', { name: mine[existing].name }) : t('editor.saveSet');
  const remember = (kind: 'mySetDelete' | 'mySetOverwrite', from: string) =>
    setUndo({ id: Date.now(), kind, from, before: mySetsOf(species) });
  const save = () => {
    if (!canSave) return;
    if (overwrite) {
      remember('mySetOverwrite', mine[existing].name);
      overwriteMySet(species, existing, set);
    } else {
      saveMySet(species, set, n => t('editor.mySetName', { n }), name);
    }
    setSaving(false);
  };

  // Preset: il migliore in cima (segnato), poi gli altri raggruppati per formato nell'ordine in cui arrivano
  const formatOrder = [...new Set(presets.map(p => p.format))];
  const byFormat = formatOrder.length > 1;
  const order = presets.map((_, i) => i)
    .sort((a, b) => (a === best ? -1 : b === best ? 1 : formatOrder.indexOf(presets[a].format) - formatOrder.indexOf(presets[b].format)));
  const applied = presets.findIndex(p => sameSet(p.set, set));
  // Cambiato a mano: il preset da cui sembra venire, se ha in comune almeno 2 mosse su 4 (a parità di mosse vince chi ha
  // più cose uguali fra strumento, abilità, natura ed EV); sotto quella soglia è un altro set e resta solo "Modificato"
  const nearest = applied >= 0 || current >= 0 ? -1 : nearestPreset(set, presets);
  const currentLabel = applied >= 0 ? presets[applied].name : current >= 0 ? mine[current].name
    : nearest >= 0 ? t('editor.setEditedFrom', { name: presets[nearest].name }) : t('editor.setCustom');
  // Da dove viene il set in uso: Smogon o uno dei miei set (Custom); cambiato a mano, nessuna linguetta
  const source = applied >= 0 ? t('editor.setFromSmogon') : current >= 0 ? t('editor.setFromMine') : null;
  const apply = (i: number) => {
    if (i === best && onBest) onBest(); else onChange(presetSet(set, presets[i].set));
    close();
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: Tab = e.key === 'Home' ? 'smogon' : e.key === 'End' ? 'mine' : tab === 'smogon' ? 'mine' : 'smogon';
    setTab(next);
    root.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(next))}`)?.focus();
  };

  const presetRow = (i: number, withGroup: boolean) => {
    const preset = presets[i];
    const head = withGroup && byFormat && i !== best && (order.indexOf(i) === 0 || order[order.indexOf(i) - 1] === best
      || presets[order[order.indexOf(i) - 1]].format !== preset.format);
    return [
      head ? <li key={`h-${preset.format}`} className="set-menu-group" aria-hidden="true">{formatName(preset.format)}</li> : null,
      <li key={i}>
        <button type="button" className={`set-menu-row${i === applied ? ' current' : ''}`} aria-current={i === applied || undefined} onClick={() => apply(i)}>
          <span className="set-menu-text">
            <span className="set-menu-name">
              <strong>{preset.name}</strong>
              {i === nearest && <span className="set-menu-edited">{t('editor.setEditedTag')}</span>}
              {i === best && <span className="set-menu-best"><Icon name="star" filled />{t('editor.bestForTeam')}</span>}
              {/* Il formato: a vista solo sul migliore (fuori dai gruppi), le altre righe stanno sotto la loro intestazione */}
              {byFormat && (i === best
                ? <span className="preset-format">{formatName(preset.format)}</span>
                : <span className="visually-hidden">{formatName(preset.format)}</span>)}
            </span>
            <small>{setSummary(preset.set, lang)}</small>
          </span>
          <ItemIcon item={preset.set.item} size={22} />
          {i === applied && <Icon name="check" />}
        </button>
      </li>,
    ];
  };

  return (
    <div className="set-menu" ref={root}
      onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); e.preventDefault(); close(); } }}
      // Il fuoco esce dal menu (Tab oltre l'ultimo pulsante): si chiude
      onBlur={e => { if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) close(false); }}>
      <button type="button" className="set-menu-button" ref={button} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? panelId : undefined} title={`${currentLabel}${source ? ` (${source})` : ''} · ${t('editor.setMenuTitle')}`}
        onClick={() => (open ? close() : show())}>
        {/* Come la pillola di una mossa: testa "SET" tagliata a "/", il nome sul corpo che sfuma nel nero, la coda tagliata a "/"
            con la provenienza (Smogon o Custom, cioè uno dei miei set; niente se cambiato a mano) e la freccia del menu */}
        <span className="set-menu-label">{t('editor.setMenu')}<span className="visually-hidden">:</span></span>
        <span className="set-menu-current">{currentLabel}</span>
        <span className={`set-menu-tail${applied >= 0 ? ' smogon' : ''}`}>
          {source && <span className="set-menu-source"><span className="visually-hidden">, </span>{source}</span>}
          <Icon name="down" />
        </span>
      </button>
      {open && (
        <div className="set-menu-pop" ref={pop} popover={supportsPopover ? 'manual' : undefined} id={panelId} role="dialog" aria-label={t('editor.setMenu')}>
          <div className="set-menu-tabs" role="tablist" aria-label={t('editor.setMenu')}>
            <button type="button" role="tab" id={tabId('smogon')} aria-selected={tab === 'smogon'} aria-controls={`${panelId}-list`}
              tabIndex={tab === 'smogon' ? 0 : -1} onClick={() => setTab('smogon')} onKeyDown={onTabKey}>{t('editor.setMenuSmogon')}</button>
            <button type="button" role="tab" id={tabId('mine')} aria-selected={tab === 'mine'} aria-controls={`${panelId}-list`}
              tabIndex={tab === 'mine' ? 0 : -1} onClick={() => setTab('mine')} onKeyDown={onTabKey}>
              {t('editor.mySets')} <small aria-hidden="true">{mine.length}</small>
            </button>
          </div>
          <div className="set-menu-body" id={`${panelId}-list`} role="tabpanel" aria-labelledby={tabId(tab)}>
            {tab === 'smogon' ? (
              presets.length ? <ul className="set-menu-list">{order.flatMap(i => presetRow(i, true))}</ul>
                : <p className="set-menu-empty">{t('editor.noPresets')}</p>
            ) : (
              <>
                {saving && (
                  <div className="set-menu-save">
                    <input ref={nameRef} aria-label={t('editor.mySetNameField')} placeholder={t('editor.mySetsPlaceholder')} value={name} maxLength={40}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
                    <button type="button" className={`save-set${overwrite ? ' overwrite' : ''}${savedAlready ? ' saved' : ''}`} disabled={!canSave} onClick={save}>
                      <Icon name={savedAlready ? 'check' : overwrite ? 'overwrite' : 'save'} />{saveLabel}
                    </button>
                    {!canSave && full && !savedAlready && <p className="set-menu-note">{t('editor.saveSetFull')}</p>}
                  </div>
                )}
                {mine.length > 0 ? (
                  // Un elenco semplice: ogni riga ha tre pulsanti veri, applica, rinomina, elimina
                  <ul className="set-menu-list" aria-label={t('combobox.options', { label: t('editor.mySets') })}>
                    {mine.map((saved, i) => (
                      <li key={`${saved.name}-${i}`} className="set-menu-mine">
                        {renaming === i ? (
                          <input autoFocus aria-label={t('editor.renameInput', { name: saved.name })} value={draft} maxLength={40}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); renameMySet(species, i, draft); setRenaming(null); }
                              else if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
                            }} />
                        ) : (
                          <button type="button" className={`set-menu-row${i === current ? ' current' : ''}`} aria-current={i === current || undefined}
                            onClick={() => { onChange(presetSet(set, saved.set)); close(); }}>
                            <span className="set-menu-text">
                              <span className="set-menu-name"><strong>{saved.name}</strong></span>
                              <small>{setSummary(saved.set, lang)}</small>
                            </span>
                            <ItemIcon item={saved.set.item} size={22} />
                            {i === current && <Icon name="check" />}
                          </button>
                        )}
                        <button type="button" className="set-menu-icon" aria-label={t('editor.renameSet', { name: saved.name })}
                          onClick={() => { setRenaming(i); setDraft(saved.name); }}><Icon name="edit" /></button>
                        <button type="button" className="set-menu-icon danger" aria-label={t('editor.deleteNamed', { name: saved.name })}
                          onClick={() => { remember('mySetDelete', saved.name); deleteMySet(species, i); }}><Icon name="close" /></button>
                      </li>
                    ))}
                  </ul>
                ) : !saving && <p className="set-menu-empty">{t('editor.mySetsEmpty')}</p>}
              </>
            )}
          </div>
          <div className="set-menu-foot">
            {onText && <button type="button" onClick={() => { close(false); onText(); }}><Icon name="paste" />{t('editor.pasteText')}</button>}
            <button type="button" aria-expanded={saving} onClick={() => { setTab('mine'); setSaving(s => !s); }}><Icon name="save" />{t('editor.saveAs')}</button>
            {smogonLink}
          </div>
        </div>
      )}
      {undo && (
        <UndoToast action={undo} onClose={() => setUndo(null)}
          onUndo={() => { setMySets(species, undo.before); setUndo(null); }} />
      )}
    </div>
  );
}
