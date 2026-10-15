import { en } from './en';
import { it } from './it';

export type Lang = 'en' | 'it';
export const LANGS: Lang[] = ['en', 'it'];
export type MessageKey = keyof typeof en;

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, it };

export const isLang = (value: unknown): value is Lang => value === 'en' || value === 'it';

/** Testo della chiave nella lingua data; `{nome}` diventa `values.nome` (se manca resta com'è). */
export function t(lang: Lang, key: MessageKey, values: Record<string, string | number> = {}): string {
  return DICTS[lang][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

const LOCALES: Record<Lang, string> = { en: 'en-US', it: 'it-IT' };

export const formatNumber = (lang: Lang, value: number, digits = 1): string =>
  new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export const formatPercent = (lang: Lang, fraction: number, digits = 1): string =>
  `${formatNumber(lang, fraction * 100, digits)}%`;
