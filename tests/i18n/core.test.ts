import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { it as itDict } from '../../src/i18n/it';
import { formatPercent, isLang, t } from '../../src/i18n';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('dizionari', () => {
  it('stesse chiavi in inglese e in italiano', () => {
    expect(Object.keys(itDict).sort()).toEqual(Object.keys(en).sort());
  });

  it('stessi segnaposti per ogni chiave', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(itDict[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('nessuna voce vuota', () => {
    for (const dict of [en, itDict]) for (const [key, value] of Object.entries(dict)) expect(value, key).not.toBe('');
  });
});

describe('t e numeri', () => {
  it('sostituisce i segnaposti e lascia intatti quelli senza valore', () => {
    expect(t('en', 'common.ofTotal', { n: 3, total: 18 })).toBe('3/18');
    expect(t('it', 'common.ofTotal', { n: 3 })).toBe('3/{total}');
  });

  it('percentuali con la virgola in italiano', () => {
    expect(formatPercent('en', 0.215)).toBe('21.5%');
    expect(formatPercent('it', 0.215)).toBe('21,5%');
  });

  it('riconosce solo le lingue supportate', () => {
    expect(isLang('it')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});
