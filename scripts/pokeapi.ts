import { toID } from '../src/engine/dex';

/** CSV con virgolette (RFC 4180): virgole e a capo ammessi dentro "…", "" è una virgoletta. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell !== ''));
}

export interface Entry { name: string; desc?: string }
export interface GameNames {
  moves: Record<string, Entry>;
  abilities: Record<string, Entry>;
  items: Record<string, Entry>;
  types: Record<string, string>;
  natures: Record<string, string>;
}
export interface PokeApiCsv {
  moves: string; abilities: string; items: string; types: string; natures: string;
  moveNames: string; abilityNames: string; itemNames: string; typeNames: string; natureNames: string;
  moveFlavor: string; abilityFlavor: string; itemFlavor: string;
}

const body = (text: string) => parseCsv(text).slice(1);
/** id PokeAPI → id Showdown ("rocky-helmet" → "rockyhelmet"). */
const identifiers = (text: string) => new Map(body(text).map(([id, identifier]) => [id, toID(identifier)]));
/** I testi dei giochi vanno a capo e sillabano: una riga sola, spazi normalizzati. */
const oneLine = (text: string) => text.replace(/­/g, '').replace(/-\n/g, '').replace(/\s+/g, ' ').trim();

function names(ids: Map<string, string>, csv: string, lang: number): Map<string, string> {
  const result = new Map<string, string>();
  for (const [id, language, name] of body(csv)) if (Number(language) === lang && ids.has(id)) result.set(ids.get(id)!, name);
  return result;
}

/** Per ogni voce, il testo del version group più recente nella lingua data. */
function flavor(ids: Map<string, string>, csv: string, lang: number): Map<string, string> {
  const best = new Map<string, { group: number; text: string }>();
  for (const [id, group, language, text] of body(csv)) {
    if (Number(language) !== lang || !ids.has(id)) continue;
    const key = ids.get(id)!;
    const current = best.get(key);
    if (!current || Number(group) > current.group) best.set(key, { group: Number(group), text: oneLine(text) });
  }
  return new Map([...best].map(([key, value]) => [key, value.text]));
}

function entries(ids: Map<string, string>, namesCsv: string, flavorCsv: string, lang: number): Record<string, Entry> {
  const descs = flavor(ids, flavorCsv, lang);
  return Object.fromEntries([...names(ids, namesCsv, lang)].map(([key, name]) =>
    [key, descs.has(key) ? { name, desc: descs.get(key)! } : { name }]));
}

/** Nomi e descrizioni nella lingua PokeAPI data (8 = italiano), indicizzati per id Showdown. */
export function buildGameNames(csv: PokeApiCsv, languageId = 8): GameNames {
  return {
    moves: entries(identifiers(csv.moves), csv.moveNames, csv.moveFlavor, languageId),
    abilities: entries(identifiers(csv.abilities), csv.abilityNames, csv.abilityFlavor, languageId),
    items: entries(identifiers(csv.items), csv.itemNames, csv.itemFlavor, languageId),
    types: Object.fromEntries(names(identifiers(csv.types), csv.typeNames, languageId)),
    natures: Object.fromEntries(names(identifiers(csv.natures), csv.natureNames, languageId)),
  };
}

const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const FILES: Record<keyof PokeApiCsv, string> = {
  moves: 'moves', abilities: 'abilities', items: 'items', types: 'types', natures: 'natures',
  moveNames: 'move_names', abilityNames: 'ability_names', itemNames: 'item_names', typeNames: 'type_names', natureNames: 'nature_names',
  moveFlavor: 'move_flavor_text', abilityFlavor: 'ability_flavor_text', itemFlavor: 'item_flavor_text',
};

/** Scarica i CSV di PokeAPI e costruisce i nomi italiani. */
export async function fetchItalianNames(): Promise<GameNames> {
  const entriesCsv = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const response = await fetch(`${BASE}${file}.csv`);
    if (!response.ok) throw new Error(`HTTP ${response.status} per ${file}.csv`);
    return [key, await response.text()] as const;
  }));
  return buildGameNames(Object.fromEntries(entriesCsv) as unknown as PokeApiCsv);
}
