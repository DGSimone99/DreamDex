import { t, type Lang } from '../i18n';
import type { CatalogKey, Redundancy } from '../engine/rating';

/** Le voci di una medaglia coi pezzi del testo (rating.ts `parts`). */
type Parts = Record<string, string>;

/** I gruppi nell'ordine in cui arrivano: le voci con la stessa chiave insieme. */
function groupBy(list: Parts[], key: string): [string, Parts[]][] {
  const groups = new Map<string, Parts[]>();
  for (const parts of list) groups.set(parts[key], [...(groups.get(parts[key]) ?? []), parts]);
  return [...groups];
}

/** Una lista di nomi detta a voce: "A, B e C" (i nomi dentro le liste già fatte restano con le virgole). */
const spoken = (names: string[], lang: Lang) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${t(lang, 'catalogue.short.and')}${names[names.length - 1]}`;

/**
 * Il caso concreto corto di una medaglia, senza le ripetizioni del lungo ("Nessuno regge Acqua · Nessuno regge Elettro" →
 * "Nessuno regge: Acqua, Elettro"); la medaglia lo mostra solo quando il lungo verrebbe tagliato (BonusMalusView).
 * Nomi ufficiali nella lingua scelta e Pokémon in inglese come nel lungo (vengono dagli stessi pezzi).
 * `null` quando non c'è una forma corta o non è più corta del lungo (`long`: il caso lungo, " · " fra le voci).
 */
export function shortCase(key: CatalogKey, items: Redundancy[], lang: Lang, long: string): string | null {
  // Senza i pezzi (voci fatte a mano, vecchi voti) niente forma corta; "Rete di sicurezza" non ne ha bisogno
  const list = items.map(item => item.parts ?? (key === 'weakCovered' ? {} : undefined));
  const short = list.every((parts): parts is Parts => !!parts) ? build(key, list, lang) : null;
  return short && short.length < long.length ? short : null;
}

function build(key: CatalogKey, list: Parts[], lang: Lang): string | null {
  const names = (field: string) => list.map(parts => parts[field]);
  switch (key) {
    case 'defenseHole':
      return t(lang, 'catalogue.short.defenseHole', { list: names('type').join(', ') });
    case 'sharedWeak':
      // "deboli" solo sul primo: gli altri numeri si capiscono
      return t(lang, 'catalogue.short.sharedWeak', {
        list: list.map((parts, i) => t(lang, i === 0 ? 'catalogue.short.sharedWeakFirst' : 'catalogue.short.sharedWeakNext', parts)).join(', '),
      });
    case 'sameType':
      return list.map(parts => t(lang, 'catalogue.short.count', { n: parts.n, what: parts.type })).join(', ');
    case 'hazardDuplicate':
      return list.map(parts => t(lang, 'catalogue.short.count', { n: parts.n, what: parts.hazard })).join(', ');
    case 'weatherClash':
      // Senza il perché fra parentesi ("Pelipper (Piovischio)" → "Pelipper"): sta nel lungo
      return list.map(parts => t(lang, 'catalogue.short.weatherClash', { kind: parts.kind, list: parts.list.replace(/\s*\([^)]*\)/g, '') })).join(' · ');
    case 'unmetCondition':
      // Chi aspetta la stessa condizione sta insieme: "Manca la pioggia: Kingdra e Ludicolo"
      return groupBy(list, 'condition').map(([condition, group]) =>
        t(lang, 'catalogue.short.unmet', { condition, list: spoken([...new Set(group.map(p => p.member))], lang) })).join(' · ');
    case 'unusedEnabler':
      // Lo stesso membro una volta sola: "Piovischio e Danzapioggia di Pelipper"
      return groupBy(list, 'member').map(([member, group]) =>
        t(lang, 'catalogue.short.unused', { member, via: spoken([...new Set(group.map(p => p.via))], lang) })).join(', ');
    case 'weakMember':
      return t(lang, list.length === 1 ? 'catalogue.short.weakMember' : 'catalogue.short.weakMembers', { list: spoken(names('member'), lang) });
    case 'lockedStatus':
      // Con più membri solo i nomi (gli strumenti stanno nel lungo): "Hippowdon e Barraskewda con mosse di stato"
      return list.length === 1 ? t(lang, 'catalogue.short.lockedStatus', list[0]) : t(lang, 'catalogue.short.lockedStatusMany', { list: spoken(names('member'), lang) });
    case 'trickRoomFast':
      return list.map(parts => t(lang, 'catalogue.short.trickRoomFast', parts)).join(' · ');
    case 'conditionUsed':
      return list.map(parts => t(lang, 'catalogue.short.conditionUsed', parts)).join(' · ');
    case 'weatherHelp':
      return list.map(parts => t(lang, 'catalogue.short.weatherHelp', parts)).join(' · ');
    case 'weakCovered':
      return t(lang, 'catalogue.short.weakCovered');
    default:
      // Tipi vari ("11 tipi diversi nel team") è già corto; core e ruoli non sono medaglie
      return null;
  }
}
