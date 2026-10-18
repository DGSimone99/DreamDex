import { useEffect, useMemo, useRef, useState } from 'react';
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

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  onApply: (proposal: Proposal) => void;
  onClose: () => void;
}

/**
 * Completa team: tipo di team (e stile meteo / Trick Room) a scelta, 5 completamenti senza Pokémon in comune.
 * Le proposte si calcolano una alla volta, così la pagina non si blocca; cambiando scelta il calcolo riparte.
 */
export function FillPanel({ team, format, data, onApply, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const [choice, setChoice] = useState<FillChoice>({ archetype: null, style: null });
  const [round, setRound] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(true);
  // Specie già mostrate per questa scelta e questo team: "Altre proposte" non le ripete
  const exclude = useRef(new Set<string>());
  const resetKey = useMemo(() => ({}), [team, format, data, choice]);
  const lastReset = useRef(resetKey);
  const before = useMemo(() => (team.length ? rateTeam(team, data, lang)?.overall ?? null : null), [team, data, lang]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      exclude.current = new Set();
    }
    let stopped = false;
    setProposals([]);
    setBusy(true);
    const steps = fillProposals(team, choice, exclude.current, format, data);
    const step = () => {
      if (stopped) return;
      const next = steps.next();
      if (next.done) { setBusy(false); return; }
      setProposals(list => [...list, next.value].sort((a, b) => b.overall - a.overall));
      setTimeout(step, 0);
    };
    const timer = setTimeout(step, 0);
    return () => { stopped = true; clearTimeout(timer); };
  }, [resetKey, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fuori dal pannello (e dal suo pulsante) si chiude
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!root.current?.contains(target) && !target.closest?.('[data-fill-toggle]')) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const pick = (next: FillChoice) => { setChoice(next); setRound(0); };
  const exhausted = !busy && proposals.length < PROPOSALS_PER_ROUND;
  const setTitle = (set: TeamSet) => [
    set.item && gameName('item', set.item, lang),
    set.ability && gameName('ability', set.ability, lang),
    set.moves.filter(Boolean).map(move => gameName('move', move, lang)).join(', '),
  ].filter(Boolean).join(' · ');
  const radio = (checked: boolean, label: string, onClick: () => void, note?: string) => (
    <button type="button" role="radio" aria-checked={checked} aria-label={label} title={note} className="fill-option" onClick={onClick}>
      <strong>{label}</strong>
      {note && <small>{note}</small>}
    </button>
  );

  return (
    <div className="fill-panel" role="dialog" aria-modal="false" aria-label={t('fill.title')} ref={root}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="fill-types" role="radiogroup" aria-label={t('fill.type')}>
        {radio(choice.archetype === null, t('fill.best'), () => pick({ ...choice, archetype: null }), t('fill.bestNote'))}
        {ARCHETYPES.map(archetype => (
          <span key={archetype}>{radio(choice.archetype === archetype, t(`archetype.${archetype}`), () => pick({ ...choice, archetype }), t(`archetype.${archetype}.note`))}</span>
        ))}
      </div>
      <div className="fill-main">
        <div className="fill-styles" role="radiogroup" aria-label={t('fill.style')}>
          <span className="fill-styles-label">{t('fill.style')}</span>
          {radio(choice.style === null, t('fill.noStyle'), () => pick({ ...choice, style: null }))}
          {FILL_STYLES.map((style: FillStyle) => (
            <span key={style}>{radio(choice.style === style, t(`teamStyle.${style}`), () => pick({ ...choice, style }))}</span>
          ))}
        </div>
        <ol className="fill-proposals">
          {proposals.map((proposal, i) => (
            <li key={proposal.added.map(s => s.species).join('|')} className="fill-proposal">
              <span className="fill-mons">
                {proposal.added.map(set => (
                  <span key={set.species} className="fill-mon" title={setTitle(set)}>
                    <Sprite species={set.species} item={set.item} size={40} />
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
        {busy && <p className="fill-status" role="status">{t('fill.busy')}</p>}
        {!busy && proposals.length === 0 && <p className="fill-status">{t(round === 0 ? 'fill.none' : 'fill.noMore')}</p>}
        {!busy && proposals.length > 0 && exhausted && <p className="fill-status">{t('fill.noMore')}</p>}
        <div className="fill-actions">
          <button type="button" disabled={busy || exhausted} onClick={() => setRound(r => r + 1)}>{t('fill.more')}</button>
        </div>
      </div>
    </div>
  );
}
