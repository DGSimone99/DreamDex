import type { ReactElement, ReactNode } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import { bonusMalusCatalog, type CatalogEntry, type TeamRating } from '../engine/rating';
import { useT } from '../i18n/react';
import type { Lang } from '../i18n';
import { defenseTabs } from './defense/defenseTabs';
import { offenseTabs } from './offense/offenseTabs';
import { rolesTabs } from './roles/rolesTabs';
import { speedTabs } from './speed/speedTabs';

/** Una scheda del dettaglio: etichetta, valore e contenuto. */
export type T = ReturnType<typeof useT>;

export interface DetailTab { key: string; label: string; value: number | string | null; panel: ReactElement; help?: ReactNode;
  /** Pagine in più della guida dopo quella della scheda (i Ruoli: tipi di team, come si ottiene un ruolo). */
  guidePages?: { key: string; label: string; content: ReactNode }[] }

/** Il contesto dell'area oltre al voto: il team e la sua analisi (lo ricevono la Difesa e l'Offesa). */
export interface AreaContext { team: TeamSet[]; analysis: TeamAnalysis; open?: (key: string) => void;
  /** Squadra chiusa: più spazio, la scheda Generale della Difesa mostra più colonne. */
  roomy?: boolean;
  /** Formato scelto (la guida dell'Offesa mostra i bersagli del suo Pokédex, e Tera / mosse Z solo dove ci sono). */
  formatId?: FormatId }

/**
 * Dettaglio di un'area (Offesa o Difesa): una scheda generale e una per sottostatistica, ognuna con come si calcola
 * e il valore di ogni membro. Stesso guscio del modale "Come funziona il voto", con le schede a sinistra.
 */
export type DetailArea = 'strength' | 'defense' | 'speed' | 'roles' | 'bonusMalus';
/** Le aree del voto che hanno una scheda in Analisi (lo stesso insieme di DetailArea). */
export type AreaKey = DetailArea;

/** Punti col segno tipografico (meno vero, non il trattino). */
export const signed = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

/** Le schede di un'area (sottostatistiche col loro valore e contenuto): le usano la finestra e la vista in Analisi. */
export function areaTabs(rating: TeamRating, area: AreaKey, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  if (area === 'bonusMalus') return catalogueTabs(rating, t, lang);
  const value = rating.areas.find(a => a.key === area)?.value ?? null;
  return area === 'strength' ? offenseTabs(rating, t, ctx)
    : area === 'defense' ? defenseTabs(rating.defense, !!rating.meta, t, ctx)
    : area === 'roles' ? rolesTabs(rating, value, t, ctx)
    : speedTabs(rating.speed, !!rating.meta, t, ctx);
}

/** Il valore di un'area per la testa: il netto per Bonus/Malus, altrimenti il valore dell'area. */
export const areaValue = (rating: TeamRating, area: AreaKey): number | string | null =>
  (area === 'bonusMalus' ? signed(rating.bonus.total - rating.penalty.total) : rating.areas.find(a => a.key === area)?.value ?? null);

/** Catalogo di bonus e malus: due schede, ogni voce con quando scatta e quanto vale; quelle attive ora sono evidenziate. */
function catalogueTabs(rating: TeamRating, t: T, lang: Lang): DetailTab[] {
  const catalog = bonusMalusCatalog(lang, rating.teraCap);
  const panelOf = (kind: CatalogEntry['kind']) => {
    const items = kind === 'malus' ? rating.penalty.items : rating.bonus.items;
    // Punti attuali di una voce del catalogo: somma delle voci del voto con la sua chiave
    const nowOf = (entry: CatalogEntry) => items.filter(i => i.catalog === entry.key).reduce((n, i) => n + i.points, 0);
    return (
      <>
        <h4>{t(`catalogue.${kind}`)}</h4>
        <div className="ad-scroll">
          <table className="ad-t ad-catalog">
            <thead>
              <tr>
                <th scope="col" className="left">{t('catalogue.col.name')}</th>
                <th scope="col" className="left">{t('catalogue.col.when')}</th>
                <th scope="col" className="left">{t('catalogue.col.points')}</th>
                <th scope="col">{t('catalogue.col.now')}</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filter(e => e.kind === kind).map(entry => {
                const now = entry.applies ? nowOf(entry) : 0;
                const active = now > 0;
                return (
                  <tr key={entry.key} className={active ? 'active' : entry.applies ? undefined : 'na'} aria-current={active ? 'true' : undefined}>
                    <th scope="row" className="left">
                      {entry.name}
                      {!entry.applies && <small className="ad-src" title={t('catalogue.naTip')}> {t('catalogue.na')}</small>}
                    </th>
                    <td className="left">{entry.when}</td>
                    <td className="left">{entry.points}</td>
                    <td className="total">{active ? (kind === 'malus' ? `−${now}` : `+${now}`) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };
  return [
    { key: 'malus', label: t('catalogue.malus'), value: signed(-rating.penalty.total), panel: panelOf('malus') },
    { key: 'bonus', label: t('catalogue.bonus'), value: signed(rating.bonus.total), panel: panelOf('bonus') },
  ];
}
