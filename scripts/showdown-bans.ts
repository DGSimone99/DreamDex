import { dex } from '../src/engine/dex';
import type { FormatBans } from '../src/engine/formats';

/**
 * Ban di mosse, abilità, strumenti e Pokémon dei formati, da Showdown (`config/formats.ts` e `data/rulesets.ts`).
 * I ban per tier (Uber, OU…) li gestisce già il formato; qui servono quelli per nome (Shed Tail, Moody, King's Rock…).
 */
export const FORMATS_URL = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts';
export const RULESETS_URL = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/rulesets.ts';

export interface Rule {
  name: string;
  ruleset: string[];
  banlist: string[];
  unbanlist: string[];
}

/** Le stringhe di un array letterale (`ruleset: ['A', "B"]`), anche su più righe. */
function strings(block: string, key: string): string[] {
  // L'array finisce con "]," a fine riga: i nomi dei formati ("[Gen 9] OU") contengono anche loro delle parentesi
  const match = new RegExp(`\\b${key}: \\[([\\s\\S]*?)\\],?[ \\t]*$`, 'm').exec(block);
  if (!match) return [];
  return [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map(m => (m[1] ?? m[2]).replace(/\\'/g, "'"));
}

/** Regole di rulesets.ts (`standard: { name: 'Standard', ruleset: [...], banlist: [...] }`). */
export function parseRulesets(source: string): Rule[] {
  return [...source.matchAll(/^\t[a-z0-9]+: \{([\s\S]*?)^\t\},/gm)]
    .map(m => ({ block: m[1], name: /\bname: '((?:[^'\\]|\\.)*)'/.exec(m[1])?.[1].replace(/\\'/g, "'") }))
    .filter((x): x is { block: string; name: string } => !!x.name)
    .map(({ block, name }) => ({ name, ruleset: strings(block, 'ruleset'), banlist: strings(block, 'banlist'), unbanlist: strings(block, 'unbanlist') }));
}

/** Formati di formats.ts (`{ name: "[Gen 9] OU", ruleset: [...], banlist: [...] }`). */
export function parseFormats(source: string): Rule[] {
  return [...source.matchAll(/\{\s*name: "([^"]+)",([\s\S]*?)\n\t\},/g)]
    .map(m => ({ name: m[1], ruleset: strings(m[2], 'ruleset'), banlist: strings(m[2], 'banlist'), unbanlist: strings(m[2], 'unbanlist') }));
}

/**
 * Tutti i nomi vietati da un formato: la sua banlist e quelle delle regole e dei formati da cui eredita
 * (una regola preceduta da "!" è tolta), meno le unbanlist. Le regole che vietano con del codice
 * (OHKO Clause, Sleep Moves Clause) tornano come nomi di regola in `clauses`.
 */
export function resolveBans(name: string, rules: Rule[]): { names: string[]; clauses: string[] } {
  const byName = new Map(rules.map(rule => [rule.name.toLowerCase(), rule]));
  const banned = new Set<string>();
  const unbanned = new Set<string>();
  const clauses = new Set<string>();
  const seen = new Set<string>();
  const removed = new Set<string>();
  const visit = (ruleName: string) => {
    const key = ruleName.toLowerCase();
    if (seen.has(key) || removed.has(key)) return;
    seen.add(key);
    const rule = byName.get(key);
    if (!rule) return;
    // Prima le esclusioni ("!Sleep Clause Mod"), poi le regole ereditate
    for (const entry of rule.ruleset) if (entry.startsWith('!')) removed.add(entry.slice(1).toLowerCase());
    if (['ohko clause', 'sleep moves clause'].includes(key)) clauses.add(rule.name);
    for (const entry of rule.ruleset) if (!entry.startsWith('!')) visit(entry);
    for (const entry of rule.banlist) banned.add(entry);
    for (const entry of rule.unbanlist) unbanned.add(entry);
  };
  visit(name);
  return { names: [...banned].filter(entry => !unbanned.has(entry)), clauses: [...clauses] };
}

/** I nostri formati e il loro nome su Showdown ("Senza limiti" non ha ban). */
export const SHOWDOWN_FORMATS: Record<string, string> = {
  ou: '[Gen 9] National Dex', ubers: '[Gen 9] National Dex Ubers', uu: '[Gen 9] National Dex UU',
  gen9ou: '[Gen 9] OU', gen9ubers: '[Gen 9] Ubers', gen9uu: '[Gen 9] UU', gen9ag: '[Gen 9] Anything Goes',
};

/**
 * I ban di ogni nostro formato, divisi per tipo. Si saltano i tier (Uber, OU…), che il formato gestisce già,
 * le combinazioni ("Hypnosis + Gengarite") e i nomi che non sono mosse, abilità, strumenti o Pokémon.
 * OHKO Clause e Sleep Moves Clause diventano le mosse che vietano.
 */
export function buildBans(rules: Rule[]): Record<string, FormatBans> {
  const ohko = dex.moves.all().filter(m => m.exists && m.ohko).map(m => m.name);
  const sleep = dex.moves.all().filter(m => m.exists && m.status === 'slp').map(m => m.name);
  return Object.fromEntries(Object.entries(SHOWDOWN_FORMATS).map(([id, name]) => {
    const { names, clauses } = resolveBans(name, rules);
    const bans: FormatBans = { moves: [], abilities: [], items: [], species: [] };
    for (const entry of names) {
      if (entry.includes('+')) continue;
      const move = dex.moves.get(entry), ability = dex.abilities.get(entry), item = dex.items.get(entry), species = dex.species.get(entry);
      if (move.exists) bans.moves.push(move.name);
      else if (ability.exists) bans.abilities.push(ability.name);
      else if (item.exists) bans.items.push(item.name);
      else if (species.exists) bans.species.push(species.name);
    }
    if (clauses.includes('OHKO Clause')) bans.moves.push(...ohko);
    if (clauses.includes('Sleep Moves Clause')) bans.moves.push(...sleep);
    bans.moves = [...new Set(bans.moves)].sort();
    return [id, bans];
  }));
}
