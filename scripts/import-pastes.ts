/**
 * Importa nel banco del voto i team da torneo pubblicati su pokepast.es (scripts/bench/pastes.json).
 *
 *   npx tsx scripts/import-pastes.ts
 *
 * Ogni voce ha l'indirizzo del paste, il formato (un torneo di un solo formato) o la famiglia (natdex, per i tornei
 * con più tier), la fonte (il torneo) e un'etichetta (settimana, semifinale…). Con la famiglia il formato si ricava
 * dai Pokémon: il tier più basso in cui il team è legale e in cui ha almeno un Pokémon di quel tier
 * (un team tutto di RU, legale anche in UU, si scarta). Si scartano anche i team non legali, incompleti,
 * monotype (tutti con un tipo in comune) e quelli già presenti; i team importati sostituiscono quelli dello stesso paste.
 * Un team legale solo nel meta di quando è stato giocato (un Pokémon poi salito di tier, UUBL; una mossa poi vietata,
 * come Tera Blast in Gen 9 UU) entra come "datato": il banco lo mostra a parte.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { battleSpecies, getSpecies, initTiers } from '../src/engine/dex';
import { DEFAULT_FORMAT, type FormatId } from '../src/engine/format';
import { bannedParts, initBans, isLegalIn, tierIn } from '../src/engine/formats';
import { importShowdown, type TeamSet } from '../src/engine/sets';

interface PasteSource {
  url: string;
  fmt?: FormatId;
  family?: 'natdex';
  source: string;
  label?: string;
  /** Fasi finali (semifinale, finale): il team ha retto fino in fondo. */
  finals?: boolean;
}

interface BenchTeam {
  name: string;
  fmt: FormatId;
  cat: string;
  paste?: string;
  finals?: boolean;
  team: TeamSet[];
}

/** Dal tier più basso al più alto, col tier dei suoi Pokémon: il primo in cui il team è legale e ne ha uno è il suo formato. */
const LADDER: Record<NonNullable<PasteSource['family']>, [FormatId, string][]> = {
  natdex: [['uu', 'UU'], ['ou', 'OU'], ['ubers', 'Uber']],
};

const read = (path: string) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);
const tiers = read(join('data', '_tiers', 'tiers.json'));
if (tiers) initTiers(tiers);
initBans(read(join('data', '_rules', 'bans.json')));

/** Tier dei Pokémon di ogni formato (AG non ne ha uno suo). */
const TIER: Partial<Record<FormatId, string>> = { uu: 'UU', ou: 'OU', ubers: 'Uber', gen9uu: 'UU', gen9ou: 'OU', gen9ubers: 'Uber' };

/** `dated`: si accettano i Pokémon saliti di poco (UUBL in UU) e le mosse, abilità e strumenti vietati dopo. */
function legalIn(team: TeamSet[], formatId: FormatId, dated = false): boolean {
  const format = { ...DEFAULT_FORMAT, formatId };
  return team.every(set => {
    // La forma in battaglia (la Mega) decide il tier: Mega Lopunny non è UU anche se Lopunny lo è
    const species = battleSpecies(set) ?? getSpecies(set.species);
    if (!species) return false;
    if (!isLegalIn(species, format) && !(dated && tierIn(species, format) === `${TIER[formatId]}BL`)) return false;
    if (dated) return true;
    const banned = bannedParts(set, format);
    return !banned.moves.length && !banned.ability && !banned.item;
  });
}

const hasTier = (team: TeamSet[], formatId: FormatId, tier: string) => team.some(set => {
  const species = battleSpecies(set) ?? getSpecies(set.species);
  return !!species && tierIn(species, { ...DEFAULT_FORMAT, formatId }) === tier;
});

const monotype = (team: TeamSet[]) => {
  const types = team.map(set => new Set<string>(getSpecies(set.species)?.types ?? []));
  return [...types[0]].some(type => types.every(t => t.has(type)));
};

const key = (team: TeamSet[]) => team.map(s => `${s.species}:${[...s.moves].sort().join(',')}`).sort().join('/');

async function main() {
  const sources = JSON.parse(readFileSync(join('scripts', 'bench', 'pastes.json'), 'utf8')) as PasteSource[];
  const file = join('scripts', 'bench', 'teams.json');
  const teams = JSON.parse(readFileSync(file, 'utf8')) as BenchTeam[];
  const urls = new Set(sources.map(s => s.url));
  const kept = teams.filter(t => !t.paste || !urls.has(t.paste));
  const known = new Set(kept.map(t => key(t.team)));
  const added: BenchTeam[] = [];
  const skipped: string[] = [];
  for (const src of sources) {
    const id = src.url.split('/').filter(Boolean).pop();
    const response = await fetch(`https://pokepast.es/${id}/json`);
    if (!response.ok) { skipped.push(`${src.url}: HTTP ${response.status}`); continue; }
    const paste = (await response.json()) as { title?: string; paste: string };
    const { sets, errors } = importShowdown(paste.paste, 'it');
    if (errors.length || sets.length !== 6) { skipped.push(`${src.url}: ${sets.length} Pokémon, ${errors.length} errori`); continue; }
    if (monotype(sets)) { skipped.push(`${src.url}: monotype`); continue; }
    const formatOf = (dated: boolean) => (src.fmt
      ? (legalIn(sets, src.fmt, dated) ? src.fmt : undefined)
      : LADDER[src.family!].find(([f, tier]) => legalIn(sets, f, dated) && hasTier(sets, f, tier))?.[0]);
    const current = formatOf(false);
    const fmt = current ?? formatOf(true);
    if (!fmt) { skipped.push(`${src.url}: non legale in ${src.fmt ?? src.family}`); continue; }
    if (known.has(key(sets))) { skipped.push(`${src.url}: già presente`); continue; }
    known.add(key(sets));
    const title = paste.title?.trim();
    added.push({
      name: `${src.source}${src.label ? ` ${src.label}` : ''}${title ? ` "${title}"` : ''}`,
      fmt, cat: current ? 'torneo' : 'datato', paste: src.url, ...(src.finals ? { finals: true } : {}), team: sets,
    });
  }
  // Un team per riga, come il resto del file
  writeFileSync(file, `[\n${[...kept, ...added].map(t => JSON.stringify(t)).join(',\n')}\n]\n`);
  const count: Record<string, number> = {};
  for (const t of added) count[`${t.fmt} ${t.cat}`] = (count[`${t.fmt} ${t.cat}`] ?? 0) + 1;
  console.log(`Importati ${added.length} team:`, count);
  if (skipped.length) console.log(`Scartati ${skipped.length}:\n  ${skipped.join('\n  ')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
