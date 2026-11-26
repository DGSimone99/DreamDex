import { bannedTexts } from '../../engine/coach';
import { battleSpecies, getSpecies, isSelectable, withinGen } from '../../engine/dex';
import { formatLabel, illegalReason } from '../../engine/formats';
import type { Format } from '../../engine/format';
import type { TeamSet } from '../../engine/sets';
import { EV_TOTAL, evTotal } from '../../engine/statCalc';
import { t, type Lang } from '../../i18n';

/** Tutti i problemi di legalità del membro (possono essere più d'uno). */
export function slotProblems(set: TeamSet, format: Format, lang: Lang): string[] {
  const species = getSpecies(set.species);
  if (!species) return [t(lang, 'team.unknown')];
  const forme = battleSpecies(set) ?? species;
  // La regola, non solo "non legale": il tier vietato, il ban per nome o il Pokédex del formato
  const reason = !isSelectable(species) ? { kind: 'notSelectable' as const } : illegalReason(forme, format);
  const where = formatLabel(format, lang);
  return [
    reason?.kind === 'tier' ? t(lang, 'team.notLegalTier', { species: forme.name, tier: reason.tier, format: where })
      : reason?.kind === 'banned' ? t(lang, 'team.notLegalBanned', { species: forme.name, format: where })
      : reason?.kind === 'notInPokedex' ? t(lang, 'team.notInPokedex', { species: forme.name, format: where })
      : reason ? t(lang, 'team.notLegal', { format: where }) : null,
    !withinGen(species, format) ? t(lang, 'team.beyondGen', { gen: format.genLimit }) : null,
    // Mosse, abilità e strumenti vietati dal formato
    ...bannedTexts(set, format, lang),
    // EV oltre il massimo: il voto è bloccato
    evTotal(set.evs) > EV_TOTAL ? t(lang, 'team.evOver', { n: evTotal(set.evs) }) : null,
  ].filter((p): p is string => !!p);
}
