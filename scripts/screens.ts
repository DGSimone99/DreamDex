/**
 * Foto della pagina negli stati del restyle (sezioni, editor, modali, popover, tooltip), a più dimensioni.
 * Serve il server di sviluppo su http://localhost:5173 (npx vite).
 *   npm run screens -- --out <cartella> [--states a,b] [--sizes 1440x900,1280x800,1366x768]
 * Per ogni foto stampa pageScroll = quanto la pagina scorre oltre la finestra (0 = una schermata).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const out = arg('out') ?? 'shots/restyle';
const sizes = (arg('sizes') ?? '1440x900,1280x800,1366x768').split(',').map(s => s.split('x').map(Number) as [number, number]);

const member = (species: string, item: string, ability: string, moves: string[], nature: string, evs: Record<string, number>) =>
  ({ species, item, ability, moves, nature, evs });
const TEAM = [
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 }),
  member('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Haze', 'Recover', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
  member('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'Roost', 'U-turn'], 'Impish', { hp: 248, def: 168, spd: 92 }),
];
const SIX = [...TEAM, member('Gholdengo', 'Air Balloon', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot'], 'Timid', { spa: 252, spe: 252, def: 4 })];
/** Pioggia: tutte le sezioni del Riassunto (sinergie, legami, campo, hazard). */
const RAIN = [
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Surf', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Flip Turn', 'Psychic Fangs'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
  member('Zapdos', 'Heavy-Duty Boots', 'Static', ['Thunder', 'Hurricane', 'Roost', 'Heat Wave'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Stealth Rock', 'Spikes', 'Leech Seed', 'Power Whip'], 'Relaxed', { hp: 252, def: 252, spd: 4 }),
  member('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 }),
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
/** Team senza sinergie né legami (nessun core, nessun pivot): il Riassunto ne mostra le sezioni vuote. */
const LONE = [
  member('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Stone Edge', 'Swords Dance'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Salamence', 'Choice Band', 'Intimidate', ['Dragon Claw', 'Earthquake', 'Fire Fang', 'Roost'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
  member('Haxorus', 'Choice Scarf', 'Mold Breaker', ['Dragon Claw', 'Earthquake', 'Poison Jab', 'Dragon Dance'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Extreme Speed', 'Dragon Dance', 'Earthquake', 'Roost'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
  member('Goodra', 'Assault Vest', 'Sap Sipper', ['Draco Meteor', 'Sludge Bomb', 'Fire Blast', 'Thunderbolt'], 'Modest', { spa: 252, hp: 252, spd: 4 }),
  member('Kommo-o', 'Leftovers', 'Soundproof', ['Close Combat', 'Clanging Scales', 'Dragon Dance', 'Iron Head'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
];
/** Preferiti per gli stati *-fav: Pokémon che di solito compaiono fra i primi candidati. */
const FAVS = ['Corviknight', 'Dragapult', 'Gholdengo', 'Rotom-Wash', 'Landorus-Therian', 'Iron Valiant', 'Zamazenta', 'Slowking-Galar', 'Heatran', 'Garganacl'];
const LONG = [
  member('Landorus-Therian', 'Rocky Helmet', 'Intimidate', ['Earthquake', 'U-turn', 'Stealth Rock', 'Stone Edge'], 'Impish', { hp: 252, def: 216, spe: 40 }),
  member('Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel', 'Horn Leech', 'Knock Off', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Urshifu-Rapid-Strike', 'Choice Band', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Naive', { atk: 4, spa: 252, spe: 252 }),
  member('Scizor', 'Scizorite', 'Technician', ['Bullet Punch', 'U-turn', 'Swords Dance', 'Knock Off'], 'Adamant', { hp: 248, atk: 252, spd: 8 }),
  member('Garchomp', 'Garchompite', 'Rough Skin', ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
// Sei attaccanti forti (Offesa del membro >= 85): la riga Attaccanti del Riassunto con più sprite di quanti ne stanno
const ATTACK = [
  LONG[2],
  TEAM[0],
  TEAM[3],
  member('Iron Valiant', 'Choice Specs', 'Quark Drive', ['Moonblast', 'Focus Blast', 'Thunderbolt', 'Shadow Ball'], 'Timid', { def: 4, spa: 252, spe: 252 }),
  LONG[5],
  member('Victini', 'Choice Band', 'Victory Star', ['V-create', 'U-turn', 'Bolt Strike', 'Zen Headbutt'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
];
// Team con una mossa non legale (Flamethrower su Great Tusk): il Coaching propone anche un cambio di mossa
const MOVE = [
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Flamethrower', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  ...TEAM.slice(1, 3),
  TEAM[4],
  SIX[5],
];
// Il team dell'utente: voto alto, poche tappe
const USER = [
  member('Scizor', 'Scizorite', 'Light Metal', ['Swords Dance', 'Bullet Punch', 'Knock Off', 'Roost'], 'Impish', { hp: 248, def: 112, spd: 128, spe: 20 }),
  member('Garchomp', 'Dragonium Z', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Outrage', 'Stealth Rock'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
  member('Victini', 'Choice Scarf', 'Victory Star', ['V-create', 'U-turn', 'Bolt Strike', 'Trick'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
  member('Zapdos', 'Heavy-Duty Boots', 'Static', ['Volt Switch', 'Hurricane', 'Heat Wave', 'Roost'], 'Bold', { hp: 248, def: 188, spe: 72 }),
  member('Iron Valiant', 'Choice Specs', 'Quark Drive', ['Moonblast', 'Focus Blast', 'Thunderbolt', 'Shadow Ball'], 'Timid', { def: 4, spa: 252, spe: 252 }),
  member('Ogerpon-Cornerstone', 'Cornerstone Mask', 'Sturdy', ['Ivy Cudgel', 'Power Whip', 'Swords Dance', 'Superpower'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
];
// Molti piazzatori di campo e mosse di campo: la riga Campo del Riassunto al limite
const FIELD = [
  member('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Stealth Rock', 'Spikes', 'Earthquake', 'Whirlwind'], 'Careful', { hp: 252, spd: 252, def: 4 }),
  member('Glimmora', 'Focus Sash', 'Toxic Debris', ['Toxic Spikes', 'Stealth Rock', 'Power Gem', 'Mortal Spin'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Grimmsnarl', 'Light Clay', 'Prankster', ['Reflect', 'Light Screen', 'Spirit Break', 'Parting Shot'], 'Careful', { hp: 252, spd: 252, def: 4 }),
  member('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Aurora Veil', 'Blizzard', 'Moonblast', 'Encore'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Hydro Pump', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spe: 8 }),
  SIX[0],
];
const FORMAT = { formatId: 'ou', genLimit: 9, minUsage: 0.01, allowMultipleMegas: false, ignoreBans: false, meta: true };
const hash = (team: unknown[]) => '#team=' + Buffer.from(JSON.stringify({ team, format: FORMAT })).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Come hash, con qualche impostazione del formato cambiata (es. meta spento). */
const hashWith = (team: unknown[], format: Partial<typeof FORMAT>) => '#team=' + Buffer.from(JSON.stringify({ team, format: { ...FORMAT, ...format } })).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Clic sul primo elemento visibile del selettore il cui testo o aria-label corrisponde. */
async function clickText(page: Page, selector: string, text: RegExp): Promise<boolean> {
  return page.evaluate((sel, src, flags) => {
    const re = new RegExp(src, flags);
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find(e =>
      re.test(e.getAttribute('aria-label') ?? '') || re.test(e.textContent ?? ''));
    if (!el) return false;
    el.click();
    return true;
  }, selector, text.source, text.flags);
}
async function focus(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(sel => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return false;
    el.focus();
    return true;
  }, selector);
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const tab = (page: Page, id: string) => page.evaluate(i => { document.getElementById(`tab-${i}`)?.click(); }, id);

/** Mouse sulla carta n della lista; dopo l'animazione stampa i bordi della carta inclinata rispetto all'interno della lista. */
async function hoverCard(page: Page, n: number): Promise<boolean | string> {
  await tab(page, 'pokemon');
  await wait(1500);
  const card = (await page.$$('.suggestions.cards > li.card'))[n];
  if (!card) return 'no card';
  await card.hover();
  await wait(1500);
  const m = await page.evaluate(i => {
    const list = document.querySelector<HTMLElement>('.suggestions.cards')!;
    const li = list.querySelectorAll<HTMLElement>(':scope > li.card')[i];
    const l = list.getBoundingClientRect();
    const c = li.getBoundingClientRect();
    const inner = { top: l.top + list.clientTop, left: l.left + list.clientLeft, right: l.left + list.clientLeft + list.clientWidth, bottom: l.top + list.clientTop + list.clientHeight };
    const cut = Math.max(0, inner.top - c.top, c.left - c.left + inner.left - c.left, c.right - inner.right, c.bottom - inner.bottom);
    const gif = li.querySelector<HTMLImageElement>('.sprite-ani');
    const stat = li.querySelector<HTMLImageElement>('.sprite');
    return { cut: Math.round(cut * 10) / 10, top: Math.round(c.top - inner.top), left: Math.round(c.left - inner.left), right: Math.round(inner.right - c.right), bottom: Math.round(inner.bottom - c.bottom),
      gif: gif ? `${Math.round(gif.getBoundingClientRect().height)}h (static ${stat ? Math.round(stat.getBoundingClientRect().height) : '-'})` : 'none', anis: list.querySelectorAll('.sprite-ani').length };
  }, n);
  console.log(`hover card ${n}: ${JSON.stringify(m)}`);
  return true;
}


/** Apre la Difesa e, se serve, una sotto-scheda per nome (null = Generale); col team chiuso clicca prima il pulsante della fascia. */
const defenseState = (sub: RegExp | null, opts: { team?: unknown[]; format?: Partial<typeof FORMAT>; collapsed?: boolean } = {}): State => ({
  hash: opts.format ? hashWith(opts.team ?? SIX, opts.format) : hash(opts.team ?? SIX),
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await clickText(p, '.band button.grade-area', /^Difesa/)) return 'no defense row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const offenseState = (sub: RegExp | null, opts: { collapsed?: boolean; format?: Partial<typeof FORMAT> } = {}): State => ({
  hash: opts.format ? hashWith(SIX, opts.format) : hash(SIX),
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await clickText(p, '.band button.grade-area', /^Offesa/)) return 'no offense row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const OFFENSE_SUBS: Record<string, RegExp | null> = { general: /^Generale/, power: /^Potenza/, wall: /^Wallbreaking/, types: /^Coverage tipi/, meta: /^Coverage meta/ };
const OFFENSE_STATES: Record<string, State> = Object.fromEntries(Object.entries(OFFENSE_SUBS).flatMap(([k, re]) => [
  [`analysis-offense-${k}`, offenseState(re)],
  [`analysis-offense-${k}-collapsed`, offenseState(re, { collapsed: true })],
]));
// Guida dell'Offesa aperta dal "?" (Generale, Wallbreaking) e Coverage tipi senza meta
const offenseGuide = (sub: RegExp | null): State => ({ hash: hash(SIX), run: async p => {
  const ok = await offenseState(sub).run!(p);
  if (ok !== true) return ok;
  if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
  await wait(400);
  return true;
} });
OFFENSE_STATES['analysis-offense-types-nometa'] = offenseState(OFFENSE_SUBS.types, { format: { meta: false } });
OFFENSE_STATES['analysis-offense-guide'] = offenseGuide(OFFENSE_SUBS.general);
OFFENSE_STATES['analysis-offense-guide-wall'] = offenseGuide(OFFENSE_SUBS.wall);
// Velocità: lo stesso team con Ribombee (Sticky Web e Stun Spore) al posto di Gholdengo, così il controllo del team si vede
const SPEED_SIX = [...TEAM, member('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid', { spa: 252, spe: 252, hp: 4 })];
const speedState = (sub: RegExp | null, opts: { collapsed?: boolean; format?: Partial<typeof FORMAT> } = {}): State => ({
  hash: opts.format ? hashWith(SPEED_SIX, opts.format) : hash(SPEED_SIX),
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await clickText(p, '.band button.grade-area', /^Velocit/)) return 'no speed row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const SPEED_STATES: Record<string, State> = {
  'analysis-speed-general': speedState(null),
  'analysis-speed-general-collapsed': speedState(null, { collapsed: true }),
  'analysis-speed-nometa': speedState(null, { format: { meta: false } }),
  // Il modale del membro: la barra di Great Tusk
  'analysis-speed-member': { hash: hash(SPEED_SIX), run: async p => {
    const ok = await speedState(null).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.sp-bar-btn', /./)) return 'no bar';
    await wait(400);
    return true;
  } },
};
SPEED_STATES['analysis-speed-guide'] = { hash: hash(SPEED_SIX), run: async p => {
  const ok = await speedState(null).run!(p);
  if (ok !== true) return ok;
  if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
  await wait(400);
  return true;
} };
const SUBS: Record<string, RegExp | null> = { general: null, robustness: /^Robustezza/, sustain: /^Sostenibilit/, types: /^Coverage tipi/, meta: /^Coverage meta/ };
const DEFENSE_STATES: Record<string, State> = {
  ...Object.fromEntries(Object.entries(SUBS).flatMap(([k, re]) => [
    [`analysis-defense-${k}`, defenseState(re)],
    [`analysis-defense-${k}-collapsed`, defenseState(re, { collapsed: true })],
  ])),
  'analysis-defense-types-nometa': defenseState(SUBS.types, { format: { meta: false } }),
  'analysis-defense-long': defenseState(null, { team: LONG }),
  // La guida della Difesa aperta dal "?" di Generale (Come funziona)
  'analysis-defense-guide-meta': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.meta).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide-sus': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.sustain).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide-rob': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.robustness).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide-types': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.types).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.area-help button', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
};

// storage: chiavi in più nel localStorage prima del caricamento (es. lo stile della lista)
interface State { hash?: string; lang?: 'it' | 'en'; storage?: Record<string, string>; run?: (page: Page) => Promise<boolean | string> }
const STATES: Record<string, State> = {
  pokemon: { run: async p => { await tab(p, 'pokemon'); return true; } },
  // Carta sotto il mouse (la prima è selezionata: la seconda in alto, la prima in basso, l'ultima): stampa quanto esce dalla lista (cut = px tagliati)
  'pokemon-hover': { run: async p => hoverCard(p, 1) },
  'pokemon-hover-bl': { run: async p => hoverCard(p, 3) },
  'pokemon-hover-last': { run: async p => hoverCard(p, 5) },
  // Lista candidati in stile Menu (pillole), team aperto e nascosto
  'pokemon-menu': { storage: { 'dreamdex.listStyle': '"menu"' }, run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-menu-collapsed': { storage: { 'dreamdex.listStyle': '"menu"' }, run: async p => {
    await tab(p, 'pokemon');
    await wait(300);
    return clickText(p, 'button.band-toggle', /./);
  } },
  // Icone del box al posto degli sprite normali (Carte e Menu)
  'pokemon-box': { storage: { 'dreamdex.listSprite': '"box"' }, run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-menu-hover': { storage: { 'dreamdex.listStyle': '"menu"' }, run: async p => {
    await tab(p, 'pokemon');
    await wait(1500);
    const row = (await p.$$('.suggestions.menu > li'))[4];
    if (!row) return 'no row';
    await row.hover();
    await wait(1200);
    return true;
  } },
  'pokemon-menu-box': { storage: { 'dreamdex.listStyle': '"menu"', 'dreamdex.listSprite': '"box"' }, run: async p => { await tab(p, 'pokemon'); return true; } },
  // Team nascosto (tessere/righe più alte) e nomi lunghi, in ogni stile e sprite
  'pokemon-collapsed': { run: async p => { await tab(p, 'pokemon'); await wait(300); return clickText(p, 'button.band-toggle', /./); } },
  'pokemon-collapsed-box': { storage: { 'dreamdex.listSprite': '"box"' }, run: async p => { await tab(p, 'pokemon'); await wait(300); return clickText(p, 'button.band-toggle', /./); } },
  'pokemon-menu-collapsed-box': { storage: { 'dreamdex.listStyle': '"menu"', 'dreamdex.listSprite': '"box"' }, run: async p => { await tab(p, 'pokemon'); await wait(300); return clickText(p, 'button.band-toggle', /./); } },
  // Preferiti dell'utente nella lista: il ♥ sul +N (Carte e Menu)
  'pokemon-fav': { storage: { 'dreamdex.lists': JSON.stringify({ universal: { favorites: FAVS, bans: [] }, byFormat: {} }) }, run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-menu-fav': { storage: { 'dreamdex.listStyle': '"menu"', 'dreamdex.lists': JSON.stringify({ universal: { favorites: FAVS, bans: [] }, byFormat: {} }) }, run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-long': { hash: hash(LONG), run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-menu-long': { hash: hash(LONG), storage: { 'dreamdex.listStyle': '"menu"' }, run: async p => { await tab(p, 'pokemon'); return true; } },
  editor: { run: async p => clickText(p, '.slot.filled > summary', /./) },
  analysis: { run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-defense': { run: async p => clickText(p, '.band button.grade-area', /^Difesa/) },
  'analysis-offense': { run: async p => clickText(p, '.band button.grade-area', /^Offesa/) },
  // Difesa: una scheda per sotto-scheda (SIX), con meta, senza meta, a team chiuso e con nomi lunghi
  ...DEFENSE_STATES,
  ...OFFENSE_STATES,
  ...SPEED_STATES,
  'analysis-offense-strip': { hash: hash(SIX), run: async p => clickText(p, '.band button.grade-area', /^Offesa/) },
  'analysis-roles': { run: async p => clickText(p, '.band button.grade-area', /^Ruoli/) },
  'analysis-coaching': { run: async p => { await tab(p, 'analysis'); await wait(300); const ok = await clickText(p, '.analysis-tabs [role="tab"]', /^Coaching/); await wait(900); return ok; } },
  'analysis-bonus': { run: async p => { await tab(p, 'analysis'); await wait(300); const ok = await clickText(p, '.analysis-tabs [role="tab"]', /^Bonus/); await wait(900); return ok; } },
  'analysis-overview-three': { hash: hash(TEAM.slice(0, 3)), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-meta-off': { hash: hashWith(TEAM, { meta: false }), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-one': { hash: hash(TEAM.slice(0, 2)), run: async p => { await tab(p, 'analysis'); return true; } },
  // Cruscotto con un membro solo: "Cosa fare" invita ad aggiungere, niente "nessun problema"
  'analysis-single': { hash: hash(TEAM.slice(0, 1)), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-member': { run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '.member-cards button.member-card', /./);
  } },
  'rating-help': { run: async p => clickText(p, '.band .grade-tools button.help-button', /./) },
  'analysis-help': { run: async p => {
    if (!await clickText(p, '.band button.grade-area', /^Difesa/)) return 'no row';
    await wait(300);
    return clickText(p, '.analysis-help button', /./);
  } },
  // Stampa l'altezza della riga delle tappe mentre i consigli si calcolano (scheletro) e dopo: devono coincidere
  'coaching-six': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    const rowH = (sel: string) => p.evaluate(q => document.querySelector(q)?.getBoundingClientRect().height ?? -1, sel);
    const start = Date.now();
    const skeleton = await rowH('.coach-steps[aria-busy]');
    await p.waitForSelector('.coach-steps:not([aria-busy]), .coach-steps-none', { timeout: 20000 });
    console.log(`coaching-six: tappe pronte in ${Date.now() - start} ms; steps skeleton=${skeleton} real=${await rowH('.coach-steps:not([aria-busy]), .coach-steps-none')}`);
    return true;
  } },
  // Coaching del team coi nomi lunghi (molti problemi minori di coverage)
  'coaching-long': { hash: hash(LONG), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-steps:not([aria-busy]), .coach-steps-none', { timeout: 20000 });
    return true;
  } },
  // Coaching col team chiuso: la scheda ha più altezza (versione estesa)
  'coaching-collapsed': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  // Coaching con la palette Scarlatto/Violetto (controllo dei token)
  'coaching-sv': { hash: hash(SIX), storage: { 'dreamdex.palette': '"sv"' }, run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  'coaching-three': { hash: hash(TEAM.slice(0, 3)), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  // Clic su un candidato del Coaching: scheda Pokémon su quel membro, il candidato aperto nel dettaglio
  'coaching-click': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    // I consigli arrivano dopo il calcolo: si aspetta la riga delle tappe
    await p.waitForSelector('.coach-steps:not([aria-busy]) button.coach-alt', { timeout: 20000 });
    // Il clic sulla proposta la applica: le alternative sono nell'icona accanto
    if (!await clickText(p, 'button.coach-alt', /./)) return false;
    // La lista per membro si calcola dopo il clic: si aspetta che non sia più attenuata
    const start = Date.now();
    await wait(100);
    await p.waitForSelector('.suggestions:not(.stale)', { timeout: 20000 });
    console.log(`coaching-click: lista pronta in ${Date.now() - start} ms`);
    return true;
  } },
  // Cruscotto della Panoramica col team ridotto: più spazio, più informazione
  'analysis-collapsed': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Riassunto completo: team pioggia, aperto e col team ridotto, e team senza sinergie
  'analysis-rain': { hash: hash(RAIN), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-rain-collapsed': { hash: hash(RAIN), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  'analysis-rain-en': { hash: hash(RAIN), lang: 'en', run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-rain-collapsed-en': { hash: hash(RAIN), lang: 'en', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  'analysis-lone': { hash: hash(LONE), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  // Lo stesso in inglese (etichette più lunghe nel Riassunto)
  'analysis-collapsed-en': { hash: hash(SIX), lang: 'en', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Team offensivo (molti ruoli minori) col team ridotto: la tabella dei Ruoli con tutti i livelli
  'analysis-collapsed-offense': { hash: hash(LONG), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Il "?" del tipo di team aperto
  'team-type-help': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '.dash-summary .help-button', /./)) return 'no help';
    await wait(300);
    return true;
  } },
  // Il team dell'utente in inglese sulla Panoramica
  'analysis-user': { hash: hash(USER), lang: 'en', run: async p => { await tab(p, 'analysis'); return true; } },
  // Riassunto con righe lunghe: molti attaccanti (ATTACK, sei sopra la soglia) e molti piazzatori di campo (FIELD)
  'analysis-long': { hash: hash(ATTACK), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-field': { hash: hash(FIELD), lang: 'en', run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-six': { hash: hash(SIX), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-empty': { hash: '', run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-en': { hash: hash(SIX), lang: 'en', run: async p => { await tab(p, 'analysis'); return true; } },
  'coaching-meta-off': { hash: hashWith(TEAM, { meta: false }), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  'coaching-empty': { hash: '', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  'coaching-en': { hash: hash(SIX), lang: 'en', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '#analysis-view-coaching', /./);
  } },
  // Il team dell'utente in inglese, a tappe pronte
  'coaching-user': { hash: hash(USER), lang: 'en', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-steps:not([aria-busy]), .coach-steps-none', { timeout: 20000 });
    return true;
  } },
  // Puntatore sulla prima proposta: stampa quanti problemi della mappa sono in anteprima (barrati) e quanti risolve la proposta
  'coaching-hover': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-steps:not([aria-busy]) button.coach-fix', { timeout: 20000 });
    const count = () => p.evaluate(() => document.querySelectorAll('.coach-prob.is-solved-preview').length);
    const before = await count();
    await p.hover('.coach-steps button.coach-fix');
    await wait(250);
    const during = await count();
    console.log(`coaching-hover: is-solved-preview prima=${before} durante=${during}`);
    return (before === 0 && during > 0) || `before=${before} during=${during}`;
  } },
  // Tappe con proposte di mossa (team con set poveri): stampa quante ce ne sono
  'coaching-move-steps': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-steps:not([aria-busy])', { timeout: 20000 });
    const n = await p.evaluate(() => document.querySelectorAll('.coach-steps .coach-prop.is-move').length);
    console.log(`coaching-move-steps: ${n} proposte di mossa`);
    return n > 0 || 'no move proposal';
  } },
  // Clic su una proposta di mossa: editor del membro con la mossa nuova in anteprima
  'coaching-move': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-steps:not([aria-busy])', { timeout: 20000 });
    if (!await clickText(p, '.coach-prop.is-move button.coach-alt', /./)) return 'no move proposal';
    await wait(600);
    return (await p.evaluate(() => !!document.querySelector('.move-proposal'))) || 'no preview in the editor';
  } },
  meta: { run: async p => { await tab(p, 'meta'); return true; } },
  lists: { run: async p => { await tab(p, 'lists'); return true; } },
  fill: { run: async p => clickText(p, 'button', /^\s*Completa team/) },
  saved: { run: async p => clickText(p, 'details.popover > summary', /Team salvati/) },
  import: { run: async p => clickText(p, 'details.popover > summary', /Import/) },
  rules: { run: async p => clickText(p, 'details.popover > summary', /Regole|Avanzate/) },
  filters: { run: async p => { await tab(p, 'pokemon'); return clickText(p, 'details.filters > summary', /./); } },
  combobox: { run: async p => {
    if (!await clickText(p, '.slot.filled > summary', /./)) return 'no card';
    await wait(500);
    return clickText(p, '[role="combobox"]', /.*/);
  } },
  'stats-pop': { run: async p => focus(p, '.stats-badge') },
  alert: { run: async p => focus(p, '.alert-mark') },
  'grade-delta': { run: async p => {
    if (!await clickText(p, '.slot.filled > summary', /Dragapult/)) return 'no card';
    await wait(600);
    return clickText(p, '.slot[open] button.best-preset', /./);
  } },
  'editor-alert': { run: async p => {
    if (!await clickText(p, '.slot.filled > summary', /Dragapult/)) return 'no card';
    await wait(600);
    return focus(p, '.slot[open] .alert-mark');
  } },
  undo: { run: async p => clickText(p, 'button.remove', /Rimuovi/) },
  collapsed: { hash: hash(LONG), run: async p => clickText(p, 'button.band-toggle', /./) },
  improve: { hash: hash(LONG), run: async p => { await tab(p, 'pokemon'); return true; } },
  'improve-open': { hash: hash(LONG), run: async p => { await tab(p, 'pokemon'); return clickText(p, '.target-toggle', /./); } },
  'improve-member': { hash: hash(LONG), run: async p => {
    await tab(p, 'pokemon');
    await clickText(p, '.target-toggle', /./);
    await wait(200);
    return clickText(p, '.target-pop .target-member', /Landorus/);
  } },
  'filters-chips': { run: async p => {
    await tab(p, 'pokemon');
    return p.evaluate(() => {
      const select = document.querySelector<HTMLSelectElement>('select[aria-label="Uso nel meta"]');
      if (!select) return false;
      select.value = 'common';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
  } },
  empty: { hash: '' },
  'en-compact': { lang: 'en' },
  'long-names': { hash: hash(LONG) },
  nodata: { run: async () => 'every bundled format has data; the no-data banner is covered by the App test' },
  settings: { run: async p => (await clickText(p, 'button', /^Impostazioni$/)) || 'no settings button yet' },
};
const chosen = (arg('states') ?? Object.keys(STATES).join(',')).split(',');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
mkdirSync(out, { recursive: true });
for (const [w, h] of sizes) {
  for (const name of chosen) {
    const state = STATES[name];
    if (!state) { console.log(`skip ${name}: unknown state`); continue; }
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    const lang = state.lang ?? 'it';
    await page.evaluateOnNewDocument((l, extra) => {
      localStorage.clear();
      localStorage.setItem('dreamdex.lang', JSON.stringify(l));
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
    }, lang, state.storage ?? {});
    await page.goto(URL + (state.hash ?? hash(TEAM)), { waitUntil: 'networkidle0', timeout: 90000 });
    await wait(1500);
    const result = state.run ? await state.run(page) : true;
    if (result !== true) { console.log(`skip ${name} @${w}x${h}: ${result === false ? 'element not found' : result}`); await page.close(); continue; }
    await wait(800);
    // pageScroll: quanto scorre la pagina; clipped: quanto della colonna principale resta tagliato (overflow nascosto)
    // dash: altezza e densità del cruscotto, fondo delle due colonne, testo tagliato nelle sezioni
    const { scroll, clipped, dash, panel } = await page.evaluate(() => {
      const main = document.querySelector('.main');
      const box = document.querySelector<HTMLElement>('.dash');
      // Niente funzioni con nome qui dentro: tsx aggiunge __name, che nella pagina non esiste
      const cards = box ? [...box.querySelectorAll<HTMLElement>(':scope > .dash-card')] : [];
      const bottom = box ? box.getBoundingClientRect().bottom : 0;
      const heights = cards.map(c => `${c.className.split(' ').find(n => n.startsWith('dash-') && n !== 'dash-card')?.slice(5)}:${Math.round(c.getBoundingClientRect().height)}`);
      // Sezioni tagliate dal fondo del cruscotto, o con contenuto che sborda (oltre 1px)
      const cut = cards.filter(c => c.getBoundingClientRect().bottom - bottom > 1).length;
      const over = cards.filter(c => c.scrollHeight - c.clientHeight > 1)
        .map(c => c.className.split(' ').find(n => n.startsWith('dash-') && n !== 'dash-card'));
      // Riassunto: nome del tipo, riga dell'eroe e righe delle sezioni tagliati in larghezza (anche in EN)
      const sumClip = box ? [...box.querySelectorAll<HTMLElement>('.sum-type, .sum-arch, .sum-crew, .sum-line, .sum-name')].filter(e => e.scrollWidth - e.clientWidth > 1).map(e => e.className).length : 0;
      const sumRows = box ? [...box.querySelectorAll<HTMLElement>('.sum-hero, .sum-sec')].map(li => Math.round(li.getBoundingClientRect().height)) : [];
      // Parti del Riassunto sotto il fondo della sua card (nascoste) e voci a misura mostrate ma tagliate (fuori dalla riga)
      const sumCard = box?.querySelector('.dash-summary');
      const sumBottom = sumCard ? sumCard.getBoundingClientRect().bottom : 0;
      const sumHidden = box ? [...box.querySelectorAll('.sum-hero, .sum-sec, .sum-lines > li')].filter(li => li.getBoundingClientRect().bottom - sumBottom > 1).length : 0;
      const fitCut = box ? [...box.querySelectorAll<HTMLElement>('.sum-fit')].reduce((n, fit) => {
        const r = fit.getBoundingClientRect();
        return n + [...fit.querySelectorAll('[data-fit], [data-fit-more]')].filter(i => { const b = i.getBoundingClientRect(); return b.bottom - r.bottom > 0.5 || b.right - r.right > 0.5; }).length;
      }, 0) : 0;
      // Riempimento del Riassunto: altezza delle sue parti (eroe, sezioni) sull'altezza del corpo della card
      const sumBody = box?.querySelector('.sum-body');
      const fill = sumBody ? Math.round(100 * [...sumBody.children].reduce((n, el) => n + el.getBoundingClientRect().height, 0) / sumBody.getBoundingClientRect().height) : 0;
      // Copertura: vuoto fra la testata e la tabella e fra la tabella e il fondo (padding escluso)
      const cov = box?.querySelector<HTMLElement>('.dash-coverage');
      const covHead = cov?.querySelector('.dash-head')?.getBoundingClientRect();
      const covTable = cov?.querySelector('table')?.getBoundingClientRect();
      const covBand = cov && covHead && covTable ? `${Math.round(covTable.top - covHead.bottom)}/${Math.round(cov.getBoundingClientRect().bottom - covTable.bottom)}` : '-';
      return {
        scroll: document.scrollingElement!.scrollHeight - window.innerHeight,
        clipped: main ? main.scrollHeight - main.clientHeight : 0,
        panel: (() => { const el = document.querySelector<HTMLElement>('.area-panel'); if (!el) return '';
          // Righe dei membri (cornice comune della Difesa): y e altezza della prima e dell ultima, per vedere che restano ferme
          const rows = [...el.querySelectorAll<HTMLElement>('.def-grid tbody th[scope="row"] .ad-mon')].map(r => r.closest('tr')!.getBoundingClientRect());
          const memberRows = rows.length ? ` memberRows=${Math.round(rows[0].top)}+${Math.round(rows[0].height)}..${Math.round(rows[rows.length - 1].bottom)} monX=${Math.round(el.querySelector('.def-grid tbody .ad-mon')!.getBoundingClientRect().left)} firstRowY=${Math.round(rows[0].top)}` : '';
          const label = el.querySelector<HTMLElement>('th.def-mon-h');
          const labelAt = label ? (() => { const r = document.createRange(); r.selectNodeContents(label); const b = r.getBoundingClientRect(); return ` label=${Math.round(b.left)},${Math.round(b.top)}`; })() : '';
          return ` panelOverflow=${el.scrollHeight - el.clientHeight} panelX=${el.scrollWidth - el.clientWidth}${memberRows}${labelAt}`; })(),
        dash: box ? `dash=${box.clientHeight}x${box.clientWidth} density=${box.dataset.density} cards=[${heights.join(',')}] cut=${cut} overflow=[${over.join(',')}] sumClip=${sumClip} rows=[${sumRows.join(',')}] sumHidden=${sumHidden} sumFill=${fill}% fitCut=${fitCut} covBand=${covBand} overviewScroll=${(document.querySelector('.overview')?.scrollHeight ?? 0) - (document.querySelector('.overview')?.clientHeight ?? 0)} hScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}` : '',
      };
    });
    // Coaching: tappe che sbordano, righe "risolve anche" o nomi tagliati in larghezza, scorrimento orizzontale
    const coach = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('.coaching');
      if (!box) return '';
      const steps = [...box.querySelectorAll<HTMLElement>('.coach-step')];
      const tall = steps.filter(s => s.scrollHeight - s.clientHeight > 1).length;
      const wide = [...box.querySelectorAll<HTMLElement>('.coach-also, .coach-fix-main strong, .coach-fix-lead')].filter(e => e.scrollWidth - e.clientWidth > 1).length;
      // Minacce: la percentuale d'uso deve restare intera dentro la riga (si accorcia il nome, non il numero)
      const usage = [...box.querySelectorAll<HTMLElement>('.coach-usage')];
      const usageCut = usage.filter(u => u.scrollWidth - u.clientWidth > 0 || u.getBoundingClientRect().right - u.parentElement!.getBoundingClientRect().right > 1).length;
      const row = box.querySelector('.coach-steps')?.getBoundingClientRect().height ?? 0;
      const need = Math.max(0, ...steps.map(s => [...s.querySelectorAll('.coach-step-problem, .coach-prop.is-main > .coach-fix > *, .coach-strip-extras > *')].reduce((b, c) => Math.max(b, c.getBoundingClientRect().bottom), 0) - s.getBoundingClientRect().top));
      return `coach: stepsRow=${Math.round(row)} contentMax=${Math.round(need)} stepOverflow=${tall} clippedLines=${wide} usage=${usage.length} usageCut=${usageCut} hScroll=${box.scrollWidth - box.clientWidth} coachScroll=${box.scrollHeight - box.clientHeight} coachH=${box.clientHeight} docHScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}`;
    });
    // Lista candidati: scorrimento interno, caselle tagliate dal fondo, misure delle Carte
    const list = await page.evaluate(() => {
      const ol = document.querySelector<HTMLElement>('ol.suggestions');
      if (!ol) return '';
      const bottom = ol.getBoundingClientRect().bottom;
      const items = [...ol.querySelectorAll<HTMLElement>(':scope > li')];
      const cut = items.filter(li => li.getBoundingClientRect().bottom - bottom > 0.5).length;
      const first = items[0]?.getBoundingClientRect();
      // Nome e motivi che escono dalla casella (in alto o in basso)
      const whoOver = items.filter(li => { const b = li.getBoundingClientRect(); const w = li.querySelector('.who')?.getBoundingClientRect(); return !!w && (w.bottom - b.bottom > 0.5 || b.top - w.top > 0.5); }).length;
      // Testo tagliato in larghezza oltre al nome (motivi, voto, segni)
      const wideCut = items.filter(li => [...li.querySelectorAll<HTMLElement>('.who small, .reason, .result, .pill-end, .tag')].some(e => e.scrollWidth - e.clientWidth > 1)).length;
      const nameCut = items.filter(li => { const e = li.querySelector<HTMLElement>('.pick strong'); return !!e && e.scrollWidth - e.clientWidth > 1; }).length;
      // Dettaglio: quanto scorrono il corpo (Porta/Toglie...) e la scheda; suggerimento del doppio clic tagliato; preferiti
      const body = document.querySelector<HTMLElement>('.detail .detail-body');
      const aside = document.querySelector<HTMLElement>('aside.detail');
      const hint = document.querySelector<HTMLElement>('.list-head .dbl-hint');
      const favs = ol.querySelectorAll('.result.fav').length;
      const extra = ` detailBodyScroll=${body ? body.scrollHeight - body.clientHeight : '-'} detailScroll=${aside ? aside.scrollHeight - aside.clientHeight : '-'} hintCut=${hint ? hint.scrollWidth - hint.clientWidth : '-'} hintW=${hint ? `${hint.clientWidth}/${document.querySelector<HTMLElement>('.list-head')?.clientWidth}` : '-'} dashes=${document.querySelectorAll('.pager-dash').length} favs=${favs}`;
      return `list: ${ol.className} items=${items.length} cols=${ol.style.getPropertyValue('--cols') || '-'} tileH=${ol.style.getPropertyValue('--tile-h') || '-'} reasons=${ol.style.getPropertyValue('--reasons') || '-'} rowH=${ol.style.getPropertyValue('--row-h') || '-'} first=${first ? `${Math.round(first.width)}x${Math.round(first.height)}` : '-'} listScroll=${ol.scrollHeight - ol.clientHeight} cutTiles=${cut} whoOver=${whoOver} wideCut=${wideCut} nameCut=${nameCut}${extra}`;
    });
    const file = join(out, `${w}x${h}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${file} pageScroll=${scroll} clipped=${clipped}${panel} ${dash} ${coach} ${list}`);
    await page.close();
  }
}
await browser.close();
