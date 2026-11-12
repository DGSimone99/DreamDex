import { battleName } from '../engine/dex';
import type { Format } from '../engine/format';
import { pokedexOf } from '../engine/formats';
import { illegalParts } from '../engine/learnsets';
import type { ImportResult } from '../engine/sets';
import { t, type Lang } from '../i18n';
import { gameName } from '../i18n/game';

/** Un Pokémon importato e le sue mosse/abilità che non può avere (o che non esistono). */
export interface ImportLine {
  /** Posizione del set tra quelli importati */
  index: number;
  text: string;
}

export interface ImportReview {
  /** Problemi che fermano l'import: non si importa niente */
  blocking: string[];
  /** Mosse e abilità non imparabili o non trovate: si sbloccano col Custom Skillset */
  skill: ImportLine[];
  /** Strumenti, tipi Tera e nature non trovati: restano nel set, solo da sapere */
  info: string[];
}

/**
 * Cosa dire dopo aver letto un testo Showdown. `single`: è l'Incolla set di un membro, dove più set nel testo
 * fermano l'import. Le mosse e abilità si controllano col formato scelto (generazione e Pokédex).
 */
export function reviewImport(result: ImportResult, format: Format, lang: Lang, { single = false } = {}): ImportReview {
  const blocking = [...result.errors];
  if (single && result.sets.length > 1) blocking.push(t(lang, 'import.oneOnly', { n: result.sets.length }));
  if (!result.sets.length && !blocking.length) blocking.push(t(lang, 'team.pasteEmpty'));
  const skill: ImportLine[] = [];
  const info: string[] = [];
  if (blocking.length) return { blocking, skill, info };
  const notFound = (name: string) => t(lang, 'import.notFound', { name });
  result.sets.forEach((set, index) => {
    const missing = result.missing.filter(m => m.set === index);
    const lost = (part: 'move' | 'ability') => missing.filter(m => m.part === part).map(m => m.name);
    const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
    const moves = [...illegal.moves.map(m => gameName('move', m, lang)), ...lost('move').map(notFound)];
    const abilityMissing = lost('ability')[0];
    const ability = abilityMissing ? notFound(abilityMissing) : illegal.ability ? gameName('ability', illegal.ability, lang) : null;
    const parts = [...moves, ...(ability ? [t(lang, 'import.abilityPart', { name: ability })] : [])];
    const name = battleName(set);
    if (parts.length) skill.push({ index, text: `${name}: ${parts.join(', ')}` });
    const other = missing.flatMap(m => (m.part === 'item' ? [t(lang, 'import.itemPart', { name: m.name })]
      : m.part === 'tera' ? [t(lang, 'import.teraPart', { name: m.name })]
      : m.part === 'nature' ? [t(lang, 'import.naturePart', { name: m.name })] : []));
    if (other.length) info.push(`${name}: ${other.join(', ')}`);
  });
  return { blocking, skill, info };
}
