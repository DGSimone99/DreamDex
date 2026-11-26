import type { Species } from '@pkmn/dex';
import type { CommonChoices } from '../../engine/common';
import { toID } from '../../engine/dex';
import type { Format } from '../../engine/format';
import { bannedParts, formatLabel, pokedexOf } from '../../engine/formats';
import { illegalParts } from '../../engine/learnsets';
import { missingFormeItem } from '../../engine/legalTeam';
import { lockedStatusMoves } from '../../engine/lockedMoves';
import type { TeamSet } from '../../engine/sets';
import { t, type Lang } from '../../i18n';
import { gameName } from '../../i18n/game';
import type { Alert } from '../AlertMark';
import type { FieldFlag, FieldFlags } from '../SetEditor';
import { slotProblems } from './slotProblems';

/** Problemi e avvisi di un membro: i segni sulla carta (rossi e gialli) e gli stessi problemi sui campi dell'editor. */
export interface SlotAlerts {
  fieldFlags: FieldFlags;
  /** Problemi di legalità (rossi): regole del formato, specie ripetuta, mosse o abilità che la specie non impara. */
  dangers: Alert[];
  /** Avvisi (gialli): seconda Mega, forma senza il suo strumento, Choice con mosse di stato. */
  warns: Alert[];
  warnings: string[];
}

export function slotAlerts({ set, species, format, common, megaWarning, repeated, lang }: {
  set: TeamSet;
  species: Species | null;
  format: Format;
  common: CommonChoices;
  megaWarning: string | null;
  repeated: boolean;
  lang: Lang;
}): SlotAlerts {
  const tr = (key: Parameters<typeof t>[1], values?: Record<string, string | number>) => t(lang, key, values);
  const problems = [...slotProblems(set, format, lang), ...(repeated ? [tr('team.duplicateSpecies')] : [])];
  const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
  // Choice o Assault Vest con mosse di stato: non si usano (anche un malus nel voto)
  const locked = lockedStatusMoves(set);
  const missing = missingFormeItem(set);
  const illegalMovesText = illegal.moves.length ? tr('team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') }) : null;
  const illegalAbilityText = illegal.ability ? tr('team.illegalAbility', { name: gameName('ability', illegal.ability, lang) }) : null;
  // Gli stessi problemi segnati sul campo dell'editor, in rosso (niente avvisi a tutta larghezza): la parola breve dice
  // se è vietato dal formato o se la specie non lo impara
  const banned = bannedParts(set, format);
  const where = formatLabel(format, lang);
  const bad = (text: string): FieldFlag => ({ label: tr('editor.flagBanned'), text });
  const warn = (text: string, hintText: string): FieldFlag => ({ label: tr('editor.flagIllegal'), text: `${text}. ${hintText}` });
  // Al posto di una mossa fuori regola, la più usata del Pokémon che sia legale, permessa e non già nel set (una diversa
  // per ogni mossa da cambiare); senza dati d'uso nessuna proposta
  const taken = new Set(set.moves.filter(Boolean).map(toID));
  const swapFor = () => {
    const pick = common.moves.find(({ name }) => {
      if (taken.has(toID(name))) return false;
      const probe = { ...set, moves: [name] };
      return !illegalParts(probe, format.genLimit, pokedexOf(format)).moves.length && !bannedParts(probe, format).moves.length;
    })?.name;
    if (pick) taken.add(toID(pick));
    return pick;
  };
  // Strumento e abilità: il più usato del Pokémon che sia permesso (e legale, per l'abilità) e diverso da quello di ora
  const itemSwap = () => common.items.find(({ name }) => toID(name) !== toID(set.item) && !bannedParts({ ...set, item: name }, format).item)?.name;
  // (senza dati d'uso le abilità della specie, nell'ordine del Pokédex)
  const abilitySwap = () => [...common.abilities.map(c => c.name), ...Object.values(species?.abilities ?? {})].find(name => {
    if (toID(name) === toID(set.ability)) return false;
    const probe = { ...set, ability: name };
    return !bannedParts(probe, format).ability && !illegalParts(probe, format.genLimit, pokedexOf(format)).ability;
  });
  const fieldFlags: FieldFlags = {
    item: banned.item ? { ...bad(tr('team.bannedItem', { format: where, name: gameName('item', banned.item, lang) })), label: tr('editor.flagBannedItem'), swap: itemSwap() } : undefined,
    ability: banned.ability ? { ...bad(tr('team.bannedAbility', { format: where, name: gameName('ability', banned.ability, lang) })), swap: abilitySwap() }
      : illegal.ability ? { ...warn(illegalAbilityText!, tr('team.illegalAbilityHint')), swap: abilitySwap() } : undefined,
    moves: [0, 1, 2, 3].map(i => {
      const move = set.moves[i];
      if (!move) return undefined;
      if (banned.moves.includes(move)) return { ...bad(tr('team.bannedMoves', { format: where, list: gameName('move', move, lang) })), swap: swapFor() };
      if (illegal.moves.includes(move)) return { ...warn(tr('team.illegalMoves', { list: gameName('move', move, lang) }), tr('team.illegalMovesHint')), swap: swapFor() };
      return undefined;
    }),
  };
  const warnings = [
    megaWarning,
    // Forma senza il suo strumento (Zacian-Crowned senza Rusted Sword): il voto la conta come la forma base
    missing ? tr('team.formeItem', { item: gameName('item', missing.item, lang), base: missing.base.name }) : null,
    locked.length ? tr('team.lockedStatus', { item: gameName('item', set.item, lang), moves: locked.map(m => gameName('move', m, lang)).join(', ') }) : null,
  ].filter((w): w is string => !!w);
  // Problemi di legalità in rosso, avvisi in giallo: due triangoli distinti in alto sulla carta, il dettaglio nei tooltip.
  // Mosse o abilità che la specie non impara sono rosse come nell'editor (senza Custom Skillset non sono legali); come
  // risolvere sta nel tooltip della riga, non nel testo
  const unlearnable: Alert[] = [
    ...(illegalMovesText ? [{ level: 'danger' as const, text: illegalMovesText, title: tr('team.illegalMovesHint'), plain: true }] : []),
    ...(illegalAbilityText ? [{ level: 'danger' as const, text: illegalAbilityText, title: tr('team.illegalAbilityHint'), plain: true }] : []),
  ];
  const dangers: Alert[] = [...problems.map(text => ({ level: 'danger' as const, text })), ...unlearnable];
  const warns: Alert[] = warnings.map(text => ({ level: 'warn', text }));
  return { fieldFlags, dangers, warns, warnings };
}
