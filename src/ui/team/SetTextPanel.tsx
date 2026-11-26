import { useRef, useState, type ReactNode } from 'react';
import type { Format } from '../../engine/format';
import { teraAllowed } from '../../engine/formats';
import { exportShowdown, importShowdown, type TeamSet } from '../../engine/sets';
import { useLang, useT } from '../../i18n/react';
import { ImportDialog } from '../ImportDialog';
import { reviewImport, type ImportReview } from '../importReview';
import { useClickAway } from '../useClickAway';

/**
 * Testo del set (Incolla testo nel menu Set): testo Showdown di un solo membro, applicato per intero. Il riquadro si apre
 * sopra le Statistiche (Set e Mosse restano in vista) e si chiude cliccando fuori.
 * `open` apre il riquadro col testo del set di adesso; `panel` è il riquadro (null se chiuso).
 */
export function useSetText(set: TeamSet, format: Format, onPaste: (set: TeamSet, review?: ImportReview) => void): { open: () => void; panel: ReactNode } {
  const lang = useLang();
  const tr = useT();
  // `blocked`: cosa ferma l'incolla (detto in una finestra); il testo resta nel riquadro da correggere
  const [paste, setPaste] = useState<{ text: string; original: string; blocked: ImportReview | null } | null>(null);
  const pasteArea = useRef<HTMLTextAreaElement>(null);
  const pasteRef = useRef<HTMLDivElement>(null);
  const ioOpen = !!paste;
  // Un testo già modificato non si butta con un clic fuori: si chiude solo con Annulla o Esc
  useClickAway(target => !!pasteRef.current?.contains(target), () => setPaste(p => (p && p.text !== p.original ? p : null)), { active: ioOpen });
  const open = () => {
    const text = exportShowdown([set], { tera: teraAllowed(format) });
    setPaste({ text, original: text, blocked: null });
  };
  const applyPaste = () => {
    if (!paste) return;
    const result = importShowdown(paste.text, lang);
    const review = reviewImport(result, format, lang, { single: true });
    if (review.blocking.length) { setPaste({ ...paste, blocked: review }); return; }
    setPaste(null);
    onPaste({ ...result.sets[0], favorite: set.favorite }, review.skill.length || review.info.length ? review : undefined);
  };
  const panel = paste && (
    <div className="paste-panel" ref={pasteRef} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setPaste(null); } }}>
      <textarea aria-label={tr('team.pasteText')} rows={12} autoFocus ref={pasteArea} value={paste.text} placeholder={tr('team.pastePlaceholder')}
        onChange={e => setPaste({ text: e.target.value, original: paste.original, blocked: null })} />
      <p className="paste-hint">{tr('team.pasteHint')}</p>
      {paste.blocked && <ImportDialog review={paste.blocked} onYes={() => {}}
        onClose={() => { setPaste(p => (p ? { ...p, blocked: null } : p)); pasteArea.current?.focus(); }} />}
      <div className="paste-actions">
        <button type="button" className="apply" disabled={!paste.text.trim()} onClick={applyPaste}>{tr('team.pasteApply')}</button>
        <button type="button" onClick={() => setPaste(null)}>{tr('team.pasteCancel')}</button>
      </div>
    </div>
  );
  return { open, panel };
}
