import { useEffect, useRef, useState } from 'react';
import type { EngineData } from '../../engine/data';
import { getSpecies, toID } from '../../engine/dex';
import { metaBoard, metaProfile, META_BOARD_SIZE } from '../../engine/metaBoard';
import { metaVersus } from '../../engine/overviewDashboard';
import type { TeamRating } from '../../engine/rating';
import type { TeamSet } from '../../engine/sets';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { Icon } from '../icons';
import { hint } from '../MoveTip';
import { Sprite, typePair } from '../Sprite';
import { DETAIL_SHEET, useBackClose } from '../useBackClose';
import { useMediaQuery, reducedMotion } from '../useMediaQuery';
import { useSheet } from '../useSheet';
import { MetaCard } from './MetaCard';
import { MetaProfileCard } from './MetaProfileCard';

/** Chiudendo, la scheda esce com'è entrata (come il dettaglio della lista Pokémon), poi sparisce. */
const SHEET_OUT_MS = 220;

/**
 * Scheda Meta, solo informativa (il voto non la usa): in alto il tuo team con la posizione e l'uso di ogni membro (sei
 * caselle uguali, in colonna con le carte sotto; fuori dai più usati "#–"), sotto i più usati del meta come carte della
 * lista, in ordine di uso; a destra la scheda del Pokémon scelto (il #1 all'inizio), con in fondo "Contro il tuo team"
 * (dai dati della Coverage meta del voto) e i link alla Coverage meta (`onCoverage`).
 * Telefono e tablet: la scheda si apre toccando una carta o un membro, come il dettaglio della lista Pokémon (sale dal
 * basso a tutto schermo sul telefono, entra da destra sul tablet); "Torna al meta", Esc, il gesto indietro o un tocco
 * sul velo la chiudono.
 * `onCollapseTeam`: riduce il team, dal pulsante in fondo alla scheda quando non ci sta (solo col team aperto, sul PC).
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
  const section = useRef<HTMLElement>(null);

  // Telefono e tablet: la scheda come finestra sopra la griglia
  const small = useMediaQuery(DETAIL_SHEET);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const finishClose = () => {
    window.clearTimeout(closeTimer.current);
    const still = reducedMotion(true);
    if (still) { setSheetOpen(false); return; }
    setSheetClosing(true);
    closeTimer.current = window.setTimeout(() => { setSheetClosing(false); setSheetOpen(false); }, SHEET_OUT_MS);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const closeSheet = useBackClose(sheetOpen, finishClose, DETAIL_SHEET);
  const choose = (name: string) => {
    window.clearTimeout(closeTimer.current);
    setSheetClosing(false);
    setPicked(name);
    // Sul PC la scheda è sempre a destra: niente finestra (se no, stringendo la finestra, comparirebbe da sola)
    if (small) setSheetOpen(true);
  };

  // La scelta vale finché è nella classifica o nel team con le statistiche; se no torna al #1
  const choosable = (name: string) => board.top.some(e => toID(e.name) === toID(name)) || board.team.some(m => m.usage !== null && toID(m.name) === toID(name));
  const selected = picked && choosable(picked) ? picked : board.top[0]?.name ?? null;
  const isSelected = (name: string) => selected !== null && toID(selected) === toID(name);
  const mine = new Set(board.team.map(m => toID(m.name)));
  const max = board.top[0]?.usage ?? 1;
  const inTop = (name: string) => board.top.some(e => toID(e.name) === toID(name));
  const profile = selected ? metaProfile(data?.stats ?? null, selected) : null;
  const versus = profile && !data?.ignoreMeta ? metaVersus(rating, profile.name, team) : null;
  const sheetModal = small && sheetOpen && !!profile;
  useSheet(sheetModal, section, '.sheet-scrim, .meta-back, .meta-profile', closeSheet);
  // Dalla scheda alla Coverage meta: la finestra si chiude subito (la sezione cambia)
  const toCoverage = onCoverage && ((side: 'defense' | 'offense', species: string) => {
    if (sheetModal) { window.clearTimeout(closeTimer.current); setSheetClosing(false); setSheetOpen(false); }
    onCoverage(side, species);
  });

  // Meta spento (la sezione è disattivata nella barra): niente da mostrare
  if (data?.ignoreMeta) return <section aria-label={t('tabs.meta')} className="meta-tab"><p className="note">{t('meta.off')}</p></section>;
  if (!data?.stats) return <section aria-label={t('tabs.meta')} className="meta-tab"><p className="note">{t('meta.missingStats')}</p></section>;
  const open = sheetOpen && !!profile;
  const className = ['meta-tab', open && 'sheet-open', open && sheetClosing && 'sheet-closing'].filter(Boolean).join(' ');
  return (
    <section ref={section} aria-label={t('tabs.meta')} className={className}>
      <div className="meta-main">
        {board.team.length > 0 && (
          <div className="meta-team" role="group" aria-label={t('meta.team')}>
            <div className="meta-head">
              <h3 className="meta-plate" aria-hidden="true">{t('meta.team')}</h3>
              {/* "#–" si spiega anche senza fumetto (al tocco non c'è): una nota accanto all'uso medio */}
              <span className="meta-note">
                {board.average !== null && t('meta.average', { pct: formatPercent(lang, board.average) })}
                {board.team.some(m => m.rank === null) && (
                  <span className="meta-legend" aria-hidden="true">{board.average !== null ? ' · ' : ''}{t('meta.legendOut', { n: board.top.length })}</span>
                )}
              </span>
            </div>
            <div className="meta-members">
              {board.team.map((m, i) => {
                const types = getSpecies(m.name)?.types ?? [];
                const why = m.usage === null ? t('meta.notInStats') : m.rank === null ? t('meta.outside', { n: board.top.length }) : null;
                return (
                  <button key={`${i}-${m.name}`} type="button" className={`meta-member${m.rank === null ? ' out' : ''}`} disabled={m.usage === null}
                    aria-pressed={m.usage !== null && isSelected(m.name)} onClick={() => choose(m.name)} {...hint(why)}
                    style={typePair(types)}>
                    <Sprite species={m.name} size={40} />
                    <span className="visually-hidden">{m.name} </span>
                    <span className="meta-member-nums">
                      <b aria-hidden={m.rank === null || undefined}>{m.rank !== null ? `#${m.rank}` : '#–'}</b>
                      {m.usage !== null && <span> {formatPercent(lang, m.usage)}</span>}
                      {m.usage === null && <span aria-hidden="true">–</span>}
                      {why && <span className="visually-hidden"> {why}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="meta-head">
          <h3 className="meta-plate">{t('meta.board')}</h3>
          <span className="meta-note">{t('meta.boardNote', { n: board.top.length })}</span>
        </div>
        <ul className="meta-grid" aria-label={t('meta.board')}>
          {board.top.map(entry => (
            <MetaCard key={entry.name} entry={entry} max={max} mine={mine.has(toID(entry.name))} selected={isSelected(entry.name)}
              onSelect={() => choose(entry.name)} />
          ))}
        </ul>
      </div>
      {/* Tablet: il velo scuro sulla griglia; toccarlo chiude la scheda (il CSS lo mostra solo lì) */}
      {open && <div className="sheet-scrim" aria-hidden="true" onClick={closeSheet} />}
      {open && (
        // Solo sul telefono e sul tablet (il CSS lo nasconde altrove)
        <button type="button" className="sheet-back meta-back" onClick={closeSheet}>
          <Icon name="prev" /> {t('meta.back')}
        </button>
      )}
      {profile && <MetaProfileCard profile={profile} inTop={inTop} onSelect={choose} versus={versus} onCoverage={toCoverage}
        onMore={teamCollapsed || small ? undefined : onCollapseTeam} sheet={sheetModal} />}
    </section>
  );
}
