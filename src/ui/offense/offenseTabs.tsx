import type { ReactElement } from 'react';
import type { TeamRating } from '../../engine/rating';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { OffenseGeneral } from './OffenseGeneral';
import { OffenseMeta } from './OffenseMeta';
import { OffenseTypes } from './OffenseTypes';
import { OffenseGuideSection, type OffenseSection } from './OffenseGuide';

/** Le schede dell'Offesa, nell'ordine della Difesa: Generale, Coverage tipi (il pacchetto dei tipi), Coverage meta. */
export function offenseTabs(rating: TeamRating, t: T, ctx: AreaContext): DetailTab[] {
  const offense = rating.offense;
  const meta = !!rating.meta;
  const coverageMeta = offense.coverageMeta;
  const value = rating.areas.find(a => a.key === 'strength')?.value ?? null;
  // Nella striscia, come nella Generale: quanti tipi e quante minacce il team manda KO in due colpi (il colpo semplice
  // del membro migliore), sul totale
  const typesKo = offense.types.rows.filter((_, i) => offense.members.some(m => (m.hits[i]?.plainPct ?? 0) >= 50)).length;
  const metaKo = coverageMeta ? coverageMeta.rows.filter(r => (r.cells ?? []).some(c => c.pct >= 50)).length : 0;
  const guide = (section: OffenseSection) => <OffenseGuideSection section={section} offense={offense} meta={meta} formatId={ctx.formatId} />;

  const tabs: { key: OffenseSection; label: string; value: number | string | null; panel: ReactElement; effSide?: 'offense' }[] = [
    { key: 'general', label: t('detail.tab.general'), value, panel: <OffenseGeneral offense={offense} meta={meta} ctx={ctx} /> },
    { key: 'types', label: t('detail.coverageTypes'), value: `${typesKo}/${offense.types.rows.length}`, panel: <OffenseTypes offense={offense} ctx={ctx} />, effSide: 'offense' },
    // La Coverage del meta c'è solo col meta: senza, una scheda in meno
    ...(coverageMeta ? [{ key: 'coverageMeta' as const, label: t('detail.coverageMeta'), value: `${metaKo}/${coverageMeta.rows.length}`, panel: <OffenseMeta offense={offense} ctx={ctx} />, effSide: 'offense' as const }] : []),
  ];
  return tabs.map(tab => ({ ...tab, help: guide(tab.key) }));
}
