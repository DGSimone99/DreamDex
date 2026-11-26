import { useEffect, useMemo, useRef, useState } from 'react';
import type { Format } from '../engine/format';
import { DEFAULT_MEMORY, remember as rememberChoice, rulesOf, type FormatChoice } from '../engine/formatChoice';
import type { Lang } from '../i18n';
import { hasItalianNames } from '../i18n/game';
import { loadFormatMemory, loadLang, loadPalette, saveFormatMemory, saveLang, savePalette } from '../storage';
import { paletteFor, type PaletteSetting } from '../ui/theme';

/** La lingua dell'app, salvata nel browser. L'italiano aspetta i suoi nomi (430 KB): si caricano la prima volta che serve. */
export function useLang(storage: Storage | undefined, initialLang?: Lang, loadNames?: () => Promise<void>) {
  const [lang, setLang] = useState<Lang>(() => initialLang ?? (storage ? loadLang(storage) : null) ?? 'en');
  useEffect(() => {
    document.documentElement.lang = lang;
    if (storage) saveLang(lang, storage);
  }, [lang, storage]);
  const namesLoading = useRef<Promise<void> | null>(null);
  const changeLang = (next: Lang) => {
    if (next !== 'it' || !loadNames || hasItalianNames()) return setLang(next);
    namesLoading.current ??= loadNames();
    namesLoading.current.then(() => setLang('it'));
  };
  return [lang, changeLang] as const;
}

/**
 * La scelta del formato (una delle tre famiglie) e le regole che leggono motore e schede. Un gioco senza i suoi dati torna
 * già al formato di base (sanitizeChoice). `memory` è l'ultima scelta di ogni famiglia: qualunque cosa cambi il formato
 * (finestra, team salvato, link, Annulla) la aggiorna.
 */
export function useFormatChoice(storage: Storage | undefined, initial: FormatChoice) {
  const [choice, setChoice] = useState<FormatChoice>(initial);
  const format = useMemo(() => rulesOf(choice), [choice]);
  const [memory, setMemory] = useState(() => (storage ? loadFormatMemory(storage) : DEFAULT_MEMORY));
  useEffect(() => { setMemory(m => rememberChoice(m, choice)); }, [choice]);
  useEffect(() => { if (storage) saveFormatMemory(memory, storage); }, [memory, storage]);
  return { choice, setChoice, format, memory };
}

/** Colori di versione: seguono il gioco del formato (o la palette fissata nelle impostazioni). */
export function usePalette(storage: Storage | undefined, format: Format) {
  const [palette, setPalette] = useState<PaletteSetting>(() => (storage ? loadPalette(storage) : null) ?? 'auto');
  const changePalette = (next: PaletteSetting) => {
    setPalette(next);
    if (storage) savePalette(next, storage);
  };
  useEffect(() => {
    document.documentElement.dataset.palette = paletteFor(palette, format.formatId, format.game);
  }, [palette, format.formatId, format.game]);
  return [palette, changePalette] as const;
}
