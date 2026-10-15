import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { t, type Lang, type MessageKey } from './index';

const LangContext = createContext<Lang>('en');

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);

/** `t` già legato alla lingua corrente. */
export function useT() {
  const lang = useLang();
  return useMemo(() => (key: MessageKey, values?: Record<string, string | number>) => t(lang, key, values), [lang]);
}
