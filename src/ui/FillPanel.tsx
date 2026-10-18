import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Archetype } from '../engine/archetype';
import type { EngineData } from '../engine/data';
import { battleName } from '../engine/dex';
import { FILL_STYLES, fillProposals, PROPOSALS_PER_ROUND, type FillChoice, type FillStyle, type Proposal } from '../engine/fillProposals';
import type { Format } from '../engine/format';
import { rateTeam } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Sprite } from './Sprite';

const ARCHETYPES: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
/** Le voci dei tipi, in ordine: "Il migliore" (nessun tipo) e i cinque archetipi. */
const TYPES: (Archetype | null)[] = [null, ...ARCHETYPES];
const typeKey = (archetype: Archetype | null) => archetype ?? 'best';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onApply: (proposal: Proposal) => void;
  onClose: () => void;
}

/** Avanza un generatore di proposte un passo per volta (setTimeout), così la pagina resta libera; si ferma con `stop`. */
function runSteps(steps: Generator<Proposal | null, void>, onProposal: (p: Proposal) => boolean, onDone: () => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const step = () => {
    if (stopped) return;
    const next = steps.next();
    if (next.done) { onDone(); return; }
    if (next.value && onProposal(next.value) === false) { onDone(); return; }
    timer = setTimeout(step, 0);
  };
  timer = setTimeout(step, 0);
  return () => { stopped = true; clearTimeout(timer); };
}

/**
 * Completa team: tipo di team (e stile meteo / Trick Room) a scelta, 5 completamenti senza Pokémon in comune.
 * Le proposte si calcolano un passo alla volta; cambiando scelta il calcolo riparte. I tipi senza proposte
 * (per lo stile scelto) si oscurano, e se quello scelto è vuoto si passa al primo che ne ha.
 */
export function FillPanel({ team, format, data, onApply, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const statusId = useId();
  const [choice, setChoice] = useState<FillChoice>({ archetype: null, style: null });
  const [round, setRound] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(true);
  // Tipi con almeno una proposta per lo stile scelto (undefined: ancora da verificare)
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  // Il tipo l'ha scelto il giocatore: il pannello non lo cambia più da solo
  const chosenByHand = useRef(false);
  // Pokémon già mostrati per questa scelta e questo team: "Altre proposte" non li ripete
  const exclude = useRef(new Set<string>());
  const resetKey = useMemo(() => ({}), [team, format, data, choice]);
  const lastReset = useRef(resetKey);
  const before = useMemo(() => (team.length ? rateTeam(team, data, lang)?.overall ?? null : null), [team, data, lang]);
  const root = useRef<HTMLDivElement>(null);

  // Le proposte del giro: arrivano una alla volta, in fondo; a giro finito si ordinano per voto
  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      exclude.current = new Set();
    }
    setProposals([]);
    setBusy(true);
    let found = 0;
    return runSteps(fillProposals(team, choice, exclude.current, format, data),
      proposal => { found++; setProposals(list => [...list, proposal]); return true; },
      () => {
        setBusy(false);
        setProposals(list => [...list].sort((a, b) => b.overall - a.overall));
        if (round === 0) setAvailable(known => ({ ...known, [typeKey(choice.archetype)]: found > 0 }));
      });
  }, [resetKey, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verifica in sottofondo quali tipi hanno proposte con questo stile (una sola basta)
  useEffect(() => {
    setAvailable({});
    let stop: (() => void) | null = null;
    let index = 0;
    const next = () => {
      const archetype = TYPES[index++];
      if (archetype === undefined) return;
      let found = false;
      stop = runSteps(fillProposals(team, { archetype, style: choice.style }, new Set(), format, data),
        () => { found = true; return false; },
        () => { setAvailable(known => ({ ...known, [typeKey(archetype)]: found })); next(); });
    };
    next();
    return () => stop?.();
  }, [team, format, data, choice.style]);

  // Tipo scelto vuoto: si passa al primo che ha proposte (finché il giocatore non sceglie da sé)
  useEffect(() => {
    if (chosenByHand.current || available[typeKey(choice.archetype)] !== false) return;
    const first = TYPES.find(archetype => available[typeKey(archetype)] === true);
    if (first !== undefined) { setChoice(c => ({ ...c, archetype: first })); setRound(0); }
  }, [available, choice.archetype]);

  // Esc chiude anche col focus fuori dal pannello; clic fuori (pannello e pulsante esclusi) chiude
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!root.current?.contains(target) && !target.closest?.('[data-fill-toggle]')) onClose();
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('pointerdown', away);
    // In cattura: Esc chiude il pannello e non arriva all'editor aperto sotto
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape, true); };
  }, [onClose]);
  // All'apertura il focus va sul tipo scelto
  useEffect(() => { root.current?.querySelector<HTMLElement>('.fill-types [aria-checked="true"]')?.focus(); }, []);

  const pick = (next: FillChoice) => {
    if (next.archetype === choice.archetype && next.style === choice.style) return;
    if (next.archetype !== choice.archetype) chosenByHand.current = true;
    if (next.style !== choice.style) chosenByHand.current = false;
    setChoice(next);
    setRound(0);
  };
  const exhausted = !busy && proposals.length < PROPOSALS_PER_ROUND;
  const setTitle = (set: TeamSet) => [
    battleName(set),
    set.item && gameName('item', set.item, lang),
    set.ability && gameName('ability', set.ability, lang),
    set.moves.filter(Boolean).map(move => gameName('move', move, lang)).join(', '),
  ].filter(Boolean).join(' · ');
  const radio = (key: string, checked: boolean, label: string, onClick: () => void, note?: string, disabled = false) => (
    <button key={key} type="button" role="radio" aria-checked={checked} disabled={disabled} aria-label={label}
      aria-describedby={note ? `${statusId}-${key}` : undefined}
      className={`fill-option${disabled ? ' empty' : ''}`} onClick={onClick}>
      <strong>{label}</strong>
      {note && <small id={`${statusId}-${key}`}>{note}</small>}
    </button>
  );
  const status = busy ? t('fill.busy')
    : proposals.length === 0 ? t(round === 0 ? 'fill.none' : 'fill.noMore')
    : exhausted ? t('fill.noMore') : '';

  return (
    <div className="fill-panel" role="dialog" aria-modal="false" aria-label={t('fill.title')} ref={root}>
      <div className="fill-types" role="radiogroup" aria-label={t('fill.type')}>
        {TYPES.map(archetype => radio(typeKey(archetype), choice.archetype === archetype,
          archetype ? t(`archetype.${archetype}`) : t('fill.best'),
          () => pick({ ...choice, archetype }),
          archetype ? t(`archetype.${archetype}.note`) : t('fill.bestNote'),
          available[typeKey(archetype)] === false && choice.archetype !== archetype))}
      </div>
      <div className="fill-main">
        <div className="fill-styles" role="radiogroup" aria-label={t('fill.style')}>
          <span className="fill-styles-label" aria-hidden="true">{t('fill.style')}</span>
          {radio('none', choice.style === null, t('fill.noStyle'), () => pick({ ...choice, style: null }))}
          {FILL_STYLES.map((style: FillStyle) => radio(style, choice.style === style, t(`teamStyle.${style}`), () => pick({ ...choice, style })))}
        </div>
        <ol className="fill-proposals">
          {proposals.map((proposal, i) => (
            <li key={proposal.added.map(s => `${s.species}@${s.item}`).join('|')} className="fill-proposal">
              <span className="fill-mons">
                {proposal.added.map(set => (
                  <span key={`${set.species}@${set.item}`} className="fill-mon" title={setTitle(set)}>
                    <Sprite species={set.species} item={set.item} size={48} />
                    <span className="fill-mon-name">{battleName(set)}</span>
                  </span>
                ))}
              </span>
              <span className="fill-result">
                <span className="fill-grade"><strong>{proposal.grade}</strong> {proposal.overall}</span>
                {before !== null && proposal.overall !== before && (
                  <span className={`fill-delta ${proposal.overall > before ? 'up' : 'down'}`}>
                    {proposal.overall > before ? '+' : '−'}{Math.abs(proposal.overall - before)}
                  </span>
                )}
                <small className="fill-kind">
                  {[t(`archetype.${proposal.archetype}`), ...proposal.styles.map(style => t(`teamStyle.${style}`))].join(' · ')}
                </small>
              </span>
              <button type="button" className="fill-add" aria-label={t('fill.addN', { n: i + 1 })} onClick={() => onApply(proposal)}>
                {t('fill.add')}
              </button>
            </li>
          ))}
        </ol>
        <p className="fill-status" role="status" aria-live="polite">{status}</p>
        <div className="fill-actions">
          <button type="button" disabled={busy || exhausted} onClick={() => setRound(r => r + 1)}>{t('fill.more')}</button>
        </div>
      </div>
    </div>
  );
}
