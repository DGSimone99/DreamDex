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

/** Un formattatore per lingua e cifre, creato una volta: crearne uno a ogni numero costava (liste e tabelle ne scrivono tanti). */
const formatters = new Map<string, Intl.NumberFormat>();
export const formatNumber = (lang: Lang, value: number, digits = 1): string => {
  const key = `${lang}|${digits}`;
  let format = formatters.get(key);
  if (!format) formatters.set(key, (format = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return format.format(value);
};

/** Un numero col segno: "+3", "−2" (il meno tipografico); lo zero come `zero` ("0", o "±0" dove conta che non cambia niente). */
export const signed = (n: number, zero = '0'): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : zero);

export const formatPercent = (lang: Lang, fraction: number, digits = 1): string =>
  `${formatNumber(lang, fraction * 100, digits)}%`;
