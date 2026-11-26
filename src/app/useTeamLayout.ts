import { useLayoutEffect, useState, type RefObject } from 'react';
import { loadTeamCollapsed, saveTeamCollapsed } from '../storage';
import type { TabId } from '../ui/Tabs';
import { AUTO_BAND_QUERY, FLIP_TABLES_QUERY, PHONE_QUERY, SHORT_SCREEN, TABLET_SIDE_QUERY, useMediaQuery } from '../ui/useMediaQuery';

/**
 * Quanto spazio prende il team sopra le sezioni, secondo lo schermo, la scheda aperta e l'editor.
 * - `collapsed`: il team è ridotto in una barra sottile (più spazio alla sezione sotto; la scelta resta salvata).
 * - `sectionsCollapsed`: come lo vedono le sezioni (sul telefono decide AutoBand, e le sezioni lo vedono sempre grande).
 */
export function useTeamLayout(storage: Storage | undefined, shownTab: TabId, editingOpen: boolean) {
  const [savedCollapsed, setCollapsed] = useState(() => (storage ? loadTeamCollapsed(storage) : null) ?? false);
  // Schermo basso (portatili): con l'editor aperto il team si comprime da solo, così l'editor sta in una schermata
  const short = useMediaQuery(SHORT_SCREEN);
  // Tablet in orizzontale: il team è la colonna a sinistra, sempre intera (niente fascia da ridurre)
  const tabletSide = useMediaQuery(TABLET_SIDE_QUERY);
  // Team che si riduce da solo scorrendo la pagina: telefono, tablet piccolo (fino a 767 px) e tablet in verticale (fino a
  // 1024 px), non col team in colonna
  const autoBand = useMediaQuery(AUTO_BAND_QUERY) && !tabletSide;
  const phone = useMediaQuery(PHONE_QUERY);
  // Tablet in verticale (team in fascia sopra, non in colonna): in Meta e Liste il team grande spingeva la pagina sotto
  const tabletUpright = useMediaQuery('(max-width: 1099px)') && !tabletSide && !phone;
  // Schermo basso, Analisi aperta senza editor: il team parte compresso (la Panoramica sta in una schermata); se il giocatore
  // lo riapre lì resta aperto in Analisi per tutta la sessione (solo in memoria: la scelta salvata vale per le altre schede)
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  // Lo stesso sul tablet in verticale (768-1099 px, team in alto a tutta larghezza): le tabelle partono in cima allo schermo
  const tabletTall = useMediaQuery(FLIP_TABLES_QUERY) && !autoBand && !tabletSide;
  const analysisShort = (short || tabletTall) && shownTab === 'analysis' && !editingOpen && !tabletSide;
  // Con l'editor aperto il team non si riduce e non si riapre a mano: aperto sugli schermi normali (l'editor ha la sua
  // altezza giusta), compresso su quelli bassi (se no l'editor non ci sta); chiuso l'editor torna la scelta salvata
  const collapsed = tabletSide ? false : editingOpen ? short : analysisShort ? !analysisExpanded : savedCollapsed;
  const toggleCollapsed = () => {
    if (editingOpen) return;
    if (analysisShort) { setAnalysisExpanded(e => !e); return; }
    setCollapsed(c => {
      if (storage) saveTeamCollapsed(!c, storage);
      return !c;
    });
  };
  return { collapsed, sectionsCollapsed: autoBand ? false : collapsed, toggleCollapsed, autoBand, phone, tabletSide, tabletUpright };
}

/** L'editor copre l'area della sezione: gli serve la sua altezza (`--ws-h` sulla colonna principale). */
export function useWorkspaceHeight(main: RefObject<HTMLElement | null>, workspace: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const area = workspace.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const apply = () => main.current?.style.setProperty('--ws-h', `${area.clientHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(area);
    return () => observer.disconnect();
  }, [main, workspace]);
}
