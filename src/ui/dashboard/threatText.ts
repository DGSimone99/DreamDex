import type { MetaThreat } from '../../engine/overviewDashboard';
import { battleSpecies } from '../../engine/dex';
import { useT } from '../../i18n/react';

/** Il primo tipo della minaccia: dà il colore al tooltip. */
export function firstType(species: string): string {
  return battleSpecies({ species, item: '' })?.types[0] ?? '';
}

/** Le parole di una ragione: "Nessuno lo regge bene", "Lo regge solo Kingambit", "Lo manda KO solo Iron Valiant". */
export function useReasonText() {
  const t = useT();
  return (threat: MetaThreat) => threat.reasons.map(r => (r.side === 'defense'
    ? r.by.length ? t('dash.threatDefOne', { name: r.by[0] }) : t('dash.threatDefNone')
    : r.by.length ? t('dash.threatOffOne', { name: r.by[0] }) : t('dash.threatOffNone')));
}
