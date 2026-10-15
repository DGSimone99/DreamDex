import type { en } from './en';

/** Testi in italiano: stesse chiavi di `en`, stessi segnaposti. */
export const it: Record<keyof typeof en, string> = {
  'common.ofTotal': '{n}/{total}',
  'stat.hp': 'PS',
  'stat.atk': 'Att',
  'stat.def': 'Dif',
  'stat.spa': 'AttSp',
  'stat.spd': 'DifSp',
  'stat.spe': 'Vel',
};
