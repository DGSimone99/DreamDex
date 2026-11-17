import { useEffect, useRef, useState } from 'react';
import type { EngineData } from '../../engine/data';
import { toID } from '../../engine/dex';
import { metaBoard, metaProfile, META_BOARD_SIZE } from '../../engine/metaBoard';
import { metaVersus } from '../../engine/overviewDashboard';
import type { TeamRating } from '../../engine/rating';
import type { TeamSet } from '../../engine/sets';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { MetaCard } from './MetaCard';
import { MetaProfileCard } from './MetaProfileCard';

/**
 * Scheda Meta, solo informativa (il voto non la usa): in alto il tuo team con la posizione e l'uso di ogni membro, sotto i
 * più usati del meta come carte della lista, in ordine di uso; a destra la scheda del Pokémon scelto (il #1 all'inizio),
 * con in fondo "Contro il tuo team" (dai dati della Coverage meta del voto) e i link alla Coverage meta (`onCoverage`).
 * `onCollapseTeam`: riduce il team, dal pulsante in fondo alla scheda quando non ci sta (solo col team aperto).
 */
export function MetaTab({ team, data, rating = null, onCoverage, onCollapseTeam, teamCollapsed = false }: {
  team: TeamSet[];
  data?: EngineData;
  rating?: TeamRating | null;
  onCoverage?: (side: 'defense' | 'offense', species: string) => void;
  onCollapseTeam?: () => void;
  teamCollapsed?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const board = metaBoard(data?.stats ?? null, team, META_BOARD_SIZE);
  const [picked, setPicked] = useState<string | null>(null);
  // Su schermo stretto la scheda sta sotto la griglia: dopo una scelta la si porta in vista (se no il tocco sembra a vuoto)
  const section = useRef<HTMLElement>(null);
  const [reveal, setReveal] = useState(0);
  const choose = (name: string) => { setPicked(name); setReveal(n => n + 1); };
  useEffect(() => {
    if (!reveal || !window.matchMedia?.('(max-width: 1099px)').matches) return;
    section.current?.querySelector('.meta-profile')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [reveal]);
  // La scelta vale finché è nella classifica o nel team con le statistiche; se no torna al #1
  const choosable = (name: string) => board.top.some(e => toID(e.name) === toID(name)) || board.team.some(m => m.usage !== null && toID(m.name) === toID(name));
  const selected = picked && choosable(picked) ? picked : board.top[0]?.name ?? null;
  const isSelected = (name: string) => selected !== null && toID(selected) === toID(name);
  const mine = new Set(board.team.map(m => toID(m.name)));
  const max = board.top[0]?.usage ?? 1;
  const inTop = (name: string) => board.top.some(e => toID(e.name) === toID(name));
  const profile = selected ? metaProfile(data?.stats ?? null, selected) : null;
  const versus = profile && !data?.ignoreMeta ? metaVersus(rating, profile.name, team) : null;
  // Meta spento (la sezione è disattivata nella barra): niente da mostrare
  if (data?.ignoreMeta) return <section aria-label={t('tabs.meta')} className="meta-tab" />;
  if (!data?.stats) return <section aria-label={t('tabs.meta')} className="meta-tab"><p className="note">{t('meta.missingStats')}</p></section>;
  return (
    <section ref={section} aria-label={t('tabs.meta')} className="meta-tab">
      <div className="meta-main">
        {board.team.length > 0 && (
          <div className="meta-team" role="group" aria-label={t('meta.team')}>
            <h3 className="meta-plate" aria-hidden="true">{t('meta.team')}</h3>
            {board.team.map((m, i) => (
              <button key={`${i}-${m.name}`} type="button" className="meta-member" disabled={m.usage === null}
                aria-pressed={m.usage !== null && isSelected(m.name)} onClick={() => choose(m.name)}>
                <Sprite species={m.name} size={40} />
                <span className="visually-hidden">{m.name} </span>
                {m.usage === null ? <small>{t('meta.notInStats')}</small> : (
                  <span className="meta-member-nums">
                    <b>{m.rank !== null ? `#${m.rank}` : t('meta.outside', { n: board.top.length })}</b>
                    <span> {formatPercent(lang, m.usage)}</span>
                  </span>
                )}
              </button>
            ))}
            {board.average !== null && <span className="meta-average">{t('meta.average', { pct: formatPercent(lang, board.average) })}</span>}
          </div>
        )}
        <div className="meta-board-head">
          <h3 className="meta-plate">{t('meta.board')}</h3>
          <span>{t('meta.boardNote', { n: board.top.length })}</span>
        </div>
        <ul className="meta-grid" aria-label={t('meta.board')}>
          {board.top.map(entry => (
            <MetaCard key={entry.name} entry={entry} max={max} mine={mine.has(toID(entry.name))} selected={isSelected(entry.name)}
              onSelect={() => choose(entry.name)} />
          ))}
        </ul>
      </div>
      {profile && <MetaProfileCard profile={profile} inTop={inTop} onSelect={choose} versus={versus} onCoverage={onCoverage}
        onMore={teamCollapsed ? undefined : onCollapseTeam} />}
    </section>
  );
}
