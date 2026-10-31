import type { HoldBand } from '../../engine/defense';

/** Quanti colpi regge un membro: classe di colore e sigla (la sigla sta anche nel testo nascosto). */
export const HOLD_BANDS: Record<HoldBand, { cls: string; tag: string }> = {
  ohko: { cls: 'hold-ohko', tag: 'OHKO' }, two: { cls: 'hold-2', tag: '2HKO' }, three: { cls: 'hold-3', tag: '3HKO' }, four: { cls: 'hold-4', tag: '4HKO+' },
};
/** Le soglie in ordine, dalla peggiore. */
export const HOLD_ORDER: HoldBand[] = ['ohko', 'two', 'three', 'four'];
