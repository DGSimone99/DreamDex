import type { ReactElement, ReactNode } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { BonusMalusView, CatalogueList } from './BonusMalusView';
import type { EffSide } from './effTag';
import { useT } from '../i18n/react';
import type { Lang } from '../i18n';
import { defenseTabs } from './defense/defenseTabs';
import { offenseTabs } from './offense/offenseTabs';
import { rolesTabs } from './roles/rolesTabs';
import { speedTabs } from './speed/speedTabs';

/** Una scheda del dettaglio: etichetta, valore e contenuto. */
export type T = ReturnType<typeof useT>;

export interface DetailTab { key: string; label: string; value: number | string | null; panel: ReactElement; help?: ReactNode;
  /** Legenda dei colori della scheda: sta a destra sulla riga dei problemi, così sotto la tabella resta più spazio alle righe. */
  legend?: ReactNode;
  /** Le schede con l'etichetta di efficacia nelle caselle: a destra nella striscia l'interruttore "Solo superefficaci" / "Solo efficacia". */
  effSide?: EffSide;
  /** Pagine in più della guida dopo quella della scheda (i Ruoli: tipi di team, come si ottiene un ruolo). */
  guidePages?: { key: string; label: string; content: ReactNode }[] }

/** Il contesto dell'area oltre al voto: il team e la sua analisi (lo ricevono la Difesa e l'Offesa). */
export interface AreaContext { team: TeamSet[]; analysis: TeamAnalysis; open?: (key: string) => void;
  /** Squadra chiusa: più spazio, la scheda Generale della Difesa mostra più colonne. */
  roomy?: boolean;
  /** Formato scelto (la guida dell'Offesa mostra i bersagli del suo Pokédex, e Tera / mosse Z solo dove ci sono). */
  formatId?: FormatId;
  /**
   * Interruttore dell'efficacia ("Solo superefficaci" / "Solo efficacia", a destra nella striscia delle sottoschede)
   * acceso: le caselle senza etichetta si spengono (restano al loro posto). Uno per area.
   */
  effOnly?: boolean;
  /** Apre la guida dell'area su una sua sezione (Bonus/Malus: "Tutte le voci possibili" apre il catalogo). */
  guide?: (key: string) => void }

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
  if (area === 'bonusMalus') return catalogueTabs(rating, t, lang, ctx);
  return area === 'strength' ? offenseTabs(rating, t, ctx)
    : area === 'defense' ? defenseTabs(rating.defense, !!rating.meta, t, ctx)
    : area === 'roles' ? rolesTabs(rating, rolesValue(rating), t, ctx)
    : speedTabs(rating.speed, !!rating.meta, t, ctx);
}

/** I Ruoli non hanno un valore 0–100: voci coperte sul totale ("7/9"). */
export const rolesValue = (rating: TeamRating): string => `${rating.roles.covered}/${rating.roles.total}`;

/** Il valore di un'area per la testa: il netto per Bonus/Malus, coperti/totale per i Ruoli, altrimenti il valore dell'area. */
export const areaValue = (rating: TeamRating, area: AreaKey): number | string | null =>
  (area === 'bonusMalus' ? signed(rating.bonus.total - rating.penalty.total)
    : area === 'roles' ? rolesValue(rating) : rating.areas.find(a => a.key === area)?.value ?? null);

/**
 * Bonus e malus: una scheda sola col netto sul voto, le voci che valgono adesso e i core a tre (BonusMalusView). Il
 * catalogo con tutte le voci possibili sta nella guida della scheda (il "?" e il link "Tutte le voci possibili"): due
 * pagine, i bonus e i malus, con quando scattano e quanto valgono.
 */
function catalogueTabs(rating: TeamRating, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  return [{
    key: 'all', label: t('catalogue.onGrade'), value: signed(rating.bonus.total - rating.penalty.total),
    panel: <BonusMalusView rating={rating} lang={lang} t={t} onCatalogue={ctx.guide && (() => ctx.guide!('bonus'))} />,
    // Il "?" della scheda sta qui, nella striscia, come nelle altre aree (non più sulla scheda di Analisi, dove copriva "Malus")
    help: t('help.view.bonusMalus').split(/\n/).map(line => <p key={line}>{line}</p>),
    guidePages: [
      { key: 'bonus', label: t('catalogue.allBonus'), content: <CatalogueList lang={lang} kind="bonus" /> },
      { key: 'malus', label: t('catalogue.allMalus'), content: <CatalogueList lang={lang} kind="malus" /> },
    ],
  }];
}
