/**
 * Cache per set: un set non si modifica mai (si sostituisce con uno nuovo), quindi un risultato calcolato
 * su di lui vale finché il set esiste. Il voto prova centinaia di team con gli stessi membri: senza cache
 * rifarebbe gli stessi calcoli per ogni membro a ogni team.
 * I risultati si congelano: chi provasse a modificarli avrebbe subito un errore invece di sporcare la cache.
 */
export function memoBySet<S extends object, K, R>(compute: (set: S, key: K) => R, keyOf: (key: K) => unknown = key => key) {
  const cache = new WeakMap<S, Map<unknown, R>>();
  return (set: S, key: K): R => {
    let bySet = cache.get(set);
    if (!bySet) {
      bySet = new Map();
      cache.set(set, bySet);
    }
    const k = keyOf(key);
    if (bySet.has(k)) return bySet.get(k)!;
    const value = compute(set, key);
    if (value && typeof value === 'object') Object.freeze(value);
    bySet.set(k, value);
    return value;
  };
}
