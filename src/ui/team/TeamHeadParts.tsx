import { useId, useRef, useState, type RefObject } from 'react';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { supportsPopover, useAnchoredPop } from '../useAnchoredPop';

/**
 * Telefono e tablet: Team salvati, Importa, Esporta, link e Svuota in un solo menu (sul telefono "…", sul tablet "Team ▾"),
 * ognuna col suo nome; dal basso col tablet in verticale e sul telefono, a tendina col tablet in orizzontale.
 * Le voci premono i pulsanti veri della testata (`headRef`: nascosti a vista ma vivi), così i loro pannelli si aprono come sempre.
 */
export function TeamMoreMenu({ headRef, saved, io, canClear }: {
  headRef: RefObject<HTMLDivElement | null>;
  saved: boolean;
  io: boolean;
  canClear: boolean;
}) {
  const tr = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const moreSheet = useRef<HTMLDivElement>(null);
  useAnchoredPop(moreButton, moreSheet, moreOpen, { sheet: true, width: 260, align: 'end', gap: 6, onDismiss: () => setMoreOpen(false) });
  const pressReal = (selector: string) => {
    setMoreOpen(false);
    requestAnimationFrame(() => headRef.current?.querySelector<HTMLElement>(selector)?.click());
  };
  return (
    <div className="team-more">
      <button type="button" className="team-more-button" ref={moreButton} aria-label={tr('team.more')} aria-haspopup="menu"
        aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)}><Icon name="dots" /><span className="team-more-label" aria-hidden="true">Team</span></button>
      {moreOpen && (
        <div className="team-more-sheet" ref={moreSheet} popover={supportsPopover ? 'manual' : undefined} role="menu" aria-label={tr('team.more')}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setMoreOpen(false); moreButton.current?.focus(); } }}>
          <p className="team-more-title" aria-hidden="true">Team</p>
          {saved && <button type="button" role="menuitem" data-saved onClick={() => pressReal('.team-saved .popover > summary')}><Icon name="box" />{tr('saved.label')}</button>}
          {io && <button type="button" role="menuitem" onClick={() => pressReal('.team-io .popover > summary')}><Icon name="paste" />{tr('showdown.import')}</button>}
          {io && <button type="button" role="menuitem" onClick={() => pressReal('.team-io .export-main')}><Icon name="copy" />{tr('showdown.quickCopy')}</button>}
          {io && <button type="button" role="menuitem" onClick={() => pressReal('.team-io .export-link')}><Icon name="link" />{tr('showdown.copyLink')}</button>}
          {canClear && <button type="button" role="menuitem" className="danger" onClick={() => pressReal('.clear-team')}><Icon name="trash" />{tr('team.clear')}</button>}
        </div>
      )}
    </div>
  );
}

/** Svuota: il cestino, staccato da Importa ed Esporta da una barretta; sotto il mouse o col fuoco un fumetto dice cosa fa. */
export function ClearTeamButton({ onClear }: { onClear: () => void }) {
  const tr = useT();
  const [clearHint, setClearHint] = useState(false);
  const clearNote = useId();
  return (
    <span className="clear-wrap">
      <button type="button" className="team-action clear-team" aria-describedby={clearHint ? clearNote : undefined}
        onPointerEnter={() => setClearHint(true)} onPointerLeave={() => setClearHint(false)}
        onFocus={() => setClearHint(true)} onBlur={() => setClearHint(false)}
        onClick={event => {
          setClearHint(false);
          onClear();
          // Da tastiera (clic senza puntatore) il pulsante sparisce: il fuoco va su Annulla dell'avviso, così si annulla subito
          if (event.detail === 0) requestAnimationFrame(() => document.querySelector<HTMLElement>('.undo-toast .undo-button')?.focus());
        }}><Icon name="trash" /> <span className="btn-label">{tr('team.clear')}</span></button>
      {clearHint && <span id={clearNote} className="export-note">{tr('team.clearTitle')}</span>}
    </span>
  );
}
