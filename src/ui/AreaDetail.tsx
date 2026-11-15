import type { ReactElement, ReactNode } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { FormatId } from '../engine/format';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { rolesValue as rolesValueOf } from '../engine/rolesArea';
import { BonusMalusView, bonusMalusTotals, CatalogueList } from './BonusMalusView';
import type { EffSide } from './effTag';
import { useT } from '../i18n/react';
import type { Lang } from '../i18n';
import { defenseTabs } from './defense/defenseTabs';
import { offenseTabs } from './offense/offenseTabs';
import { rolesTab } from './roles/rolesTabs';
import { speedTabs } from './speed/speedTabs';

/** Una scheda del dettaglio: etichetta, valore e contenuto. */
export type T = ReturnType<typeof useT>;

export interface DetailTab { key: string; label: string; value: number | string | null; panel: ReactElement; help?: ReactNode;
  /** Le schede con l'etichetta di efficacia nelle caselle: a destra nella striscia l'interruttore "Solo superefficaci" / "Solo efficacia". */
  effSide?: EffSide;
  /** Segni dopo il valore (i Ruoli: il +N dei minori) e la frase per lo screen reader col valore detto a parole. */
  marks?: ReactNode;
  /** Il colore del valore (i Ruoli: rosso se manca un essenziale, giallo se mancano importanti). */
  valueTone?: 'bad' | 'warn';
  describe?: string;
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
  /**
   * Apre la guida dell'area su una sua sezione (Bonus/Malus: "Tutte le voci possibili" apre il catalogo; Ruoli: "Tabella
   * dei ruoli" apre la pagina Ruoli per tipo di team).
   */
  guide?: (key: string) => void }

/**
 * Dettaglio di un'area (Offesa o Difesa): una scheda generale e una per sottostatistica, ognuna con come si calcola
 * e il valore di ogni membro. Stesso guscio del modale "Come funziona il voto", con le schede a sinistra.
 */
export type AreaKey = 'strength' | 'defense' | 'speed' | 'bonusMalus';
/**
 * Le aree che si possono aprire da un link (voto accanto al team, Panoramica, Coaching): quelle con una scheda in Analisi
 * e i Ruoli, che non hanno più una scheda loro ma stanno in Bonus/Malus, nella sottoscheda Ruoli.
 */
export type DetailArea = AreaKey | 'roles';
/** La sottoscheda di Bonus/Malus coi Ruoli. */
export const ROLES_SUB = 'roles';

/** Punti col segno tipografico (meno vero, non il trattino). */
export const signed = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

/** Le schede di un'area (sottostatistiche col loro valore e contenuto): le usano la finestra e la vista in Analisi. */
export function areaTabs(rating: TeamRating, area: AreaKey, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  if (area === 'bonusMalus') return catalogueTabs(rating, t, lang, ctx);
  return area === 'strength' ? offenseTabs(rating, t, ctx)
    : area === 'defense' ? defenseTabs(rating.defense, !!rating.meta, t, ctx)
    : speedTabs(rating.speed, !!rating.meta, t, ctx);
}

/** I Ruoli non hanno un valore 0–100: essenziali e importanti coperte sul totale e i punti ("8/8 +2"), come ovunque. */
export const rolesValue = (rating: TeamRating): string => rolesValueOf(rating.roles);

/**
 * Bonus e malus: la sottoscheda Generale col netto sul voto, le voci che valgono adesso e i core a tre (BonusMalusView). Il
 * catalogo con tutte le voci possibili sta nella guida della scheda (il "?" e il link "Tutte le voci possibili"): due
 * pagine, i bonus e i malus, con quando scattano e quanto valgono. Le voci dei ruoli non ci sono (né voci né totali): il
 * catalogo le elenca, ma i loro punti stanno nella sottoscheda Ruoli.
 * Poi la sottoscheda Ruoli (coperti/totale): i Ruoli non hanno un peso nel voto, contano solo coi loro bonus e malus.
 */
function catalogueTabs(rating: TeamRating, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  return [{
    // La scheda si chiama "Ruoli e Bonus": la sottoscheda dei bonus e malus porta il loro nome, Bonus/Malus
    // Senza i punti dei ruoli, come la scheda: quelli stanno nella sottoscheda Ruoli
    key: 'all', label: t('area.bonusMalus'), value: signed(bonusMalusTotals(rating).net),
    panel: <BonusMalusView rating={rating} lang={lang} t={t} onCatalogue={ctx.guide && (() => ctx.guide!('bonus'))} />,
    // Il "?" della scheda sta qui, nella striscia, come nelle altre aree (non più sulla scheda di Analisi, dove copriva "Malus")
    help: t('help.view.bonusMalus').split(/\n/).map(line => <p key={line}>{line}</p>),
    guidePages: [
      { key: 'bonus', label: t('catalogue.allBonus'), content: <CatalogueList lang={lang} kind="bonus" /> },
      { key: 'malus', label: t('catalogue.allMalus'), content: <CatalogueList lang={lang} kind="malus" /> },
    ],
  }, rolesTab(rating, t, ctx)];
}
