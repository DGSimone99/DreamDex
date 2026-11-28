/**
 * Foto della pagina negli stati del restyle (sezioni, editor, modali, popover, tooltip), a più dimensioni.
 * Serve il server di sviluppo su http://localhost:5173 (npx vite).
 *   npm run screens -- --out <cartella> [--states a,b] [--sizes 1440x900,1366x657,1280x620,1536x730] [--palette sv] [--wait 8000]
 * Per ogni foto stampa pageScroll = quanto la pagina scorre oltre la finestra (0 = una schermata).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const out = arg('out') ?? 'shots';
const sizes = (arg('sizes') ?? '1440x900,1366x657,1280x620,1536x730').split(',').map(s => s.split('x').map(Number) as [number, number]);

const member = (species: string, item: string, ability: string, moves: string[], nature: string, evs: Record<string, number>) =>
  ({ species, item, ability, moves, nature, evs });
const TEAM = [
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 }),
  member('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Haze', 'Recover', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
  // Attaccante speciale legale in National Dex OU (Dragapult ora è Ubers: il voto sarebbe grigio in ogni foto; il team
  // fuori regola ha il suo stato, illegal)
  member('Iron Valiant', 'Choice Specs', 'Quark Drive', ['Moonblast', 'Focus Blast', 'Thunderbolt', 'Shadow Ball'], 'Timid', { def: 4, spa: 252, spe: 252 }),
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
/** Bonus/Malus sotto sforzo: un core, 3 altri bonus e 7 malus (meteo in conflitto, Trick Room in un team veloce, Choice con mosse di stato, buchi in Difesa…). */
const STRESS = [
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Surf', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Tapu Koko', 'Heavy-Duty Boots', 'Electric Surge', ['Dazzling Gleam', 'U-turn', 'Roost', 'Defog'], 'Timid', { hp: 248, spe: 252, spd: 8 }),
  member('Hippowdon', 'Choice Specs', 'Sand Stream', ['Trick Room', 'Calm Mind', 'Earth Power', 'Stealth Rock'], 'Quiet', { hp: 252, spa: 252, spd: 4 }),
  member('Luvdisc', 'Choice Scarf', 'Swift Swim', ['Surf', 'Ice Beam', 'Charm', 'Sweet Kiss'], 'Timid', { atk: 252, spe: 252, hp: 4 }),
  member('Excadrill', 'Leftovers', 'Sand Rush', ['Earthquake', 'Iron Head', 'Stealth Rock', 'Swords Dance'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Flip Turn', 'Swords Dance'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
];
/** Tanti meteo e campi (pioggia, sabbia, elettrico, erboso), chi li sfrutta e Stealth Rock: il Riassunto pieno. */
const WEATHERS = [
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Scald', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Flip Turn', 'Aqua Jet'], 'Adamant', { atk: 252, spe: 252, spd: 4 }),
  member('Tyranitar', 'Smooth Rock', 'Sand Stream', ['Stealth Rock', 'Stone Edge', 'Crunch', 'Earthquake'], 'Adamant', { hp: 248, atk: 252, spd: 8 }),
  member('Excadrill', 'Life Orb', 'Sand Rush', ['Swords Dance', 'Earthquake', 'Iron Head', 'Rapid Spin'], 'Adamant', { atk: 252, spe: 252, spd: 4 }),
  member('Tapu Koko', 'Choice Specs', 'Electric Surge', ['Rising Voltage', 'Volt Switch', 'Dazzling Gleam', 'Grass Knot'], 'Timid', { spa: 252, spe: 252, spd: 4 }),
  member('Rillaboom', 'Choice Band', 'Grassy Surge', ['Grassy Glide', 'Wood Hammer', 'Knock Off', 'U-turn'], 'Adamant', { atk: 252, spe: 252, spd: 4 }),
];
/** Cinque condizioni (pioggia, sabbia, sole, Campo Nebbioso, Campo Erboso) e due core a tre: Tyranitar/Rillaboom/Tapu Fini e Pelipper/Torkoal/Excadrill. */
const WEATHERS_CORES = [
  WEATHERS[0], WEATHERS[2], WEATHERS[3],
  member('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume', 'Rapid Spin', 'Yawn', 'Earth Power'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Tapu Fini', 'Leftovers', 'Misty Surge', ['Moonblast', 'Scald', 'Taunt', 'Defog'], 'Calm', { hp: 248, spd: 252, def: 8 }),
  member('Rillaboom', 'Leftovers', 'Grassy Surge', ['Grassy Glide', 'Swords Dance', 'Knock Off', 'U-turn'], 'Adamant', { hp: 252, atk: 252, spd: 4 }),
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
/** Team da torneo senza problemi per il Coaching (stato coaching-clear). */
const CLEAR = [{"species":"Urshifu-Rapid-Strike","item":"Choice Scarf","ability":"Unseen Fist","moves":["Surging Strikes","Close Combat","U-turn","Ice Spinner"],"nature":"Jolly","evs":{"atk":252,"def":4,"spe":252}},{"species":"Zapdos","item":"Heavy-Duty Boots","ability":"Static","moves":["Volt Switch","Defog","Heat Wave","Roost"],"nature":"Bold","evs":{"hp":248,"def":188,"spe":72},"ivs":{"atk":0}},{"species":"Slowking-Galar","item":"Heavy-Duty Boots","ability":"Regenerator","moves":["Future Sight","Sludge Bomb","Chilly Reception","Thunder Wave"],"nature":"Sassy","evs":{"hp":248,"def":8,"spd":252},"ivs":{"atk":0,"spe":0}},{"species":"Kyurem","item":"Choice Specs","ability":"Pressure","moves":["Freeze-Dry","Blizzard","Draco Meteor","Earth Power"],"nature":"Timid","evs":{"spa":252,"spd":4,"spe":252},"ivs":{"atk":0}},{"species":"Scizor","item":"Scizorite","ability":"Light Metal","moves":["Swords Dance","Bullet Punch","Knock Off","Roost"],"nature":"Impish","evs":{"hp":248,"def":112,"spd":128,"spe":20}},{"species":"Ting-Lu","item":"Leftovers","ability":"Vessel of Ruin","moves":["Earthquake","Ruination","Stealth Rock","Whirlwind"],"nature":"Careful","evs":{"hp":252,"def":4,"spd":252}}];
/** Preferiti per gli stati *-fav: Pokémon che di solito compaiono fra i primi candidati. */
const FAVS = ['Corviknight', 'Kyurem', 'Gholdengo', 'Rotom-Wash', 'Landorus-Therian', 'Iron Valiant', 'Zamazenta', 'Slowking-Galar', 'Heatran', 'Garganacl'];
const LONG = [
  member('Landorus-Therian', 'Rocky Helmet', 'Intimidate', ['Earthquake', 'U-turn', 'Stealth Rock', 'Stone Edge'], 'Impish', { hp: 252, def: 216, spe: 40 }),
  member('Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel', 'Horn Leech', 'Knock Off', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Urshifu-Rapid-Strike', 'Choice Band', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Naive', { atk: 4, spa: 252, spe: 252 }),
  member('Scizor', 'Scizorite', 'Technician', ['Bullet Punch', 'U-turn', 'Swords Dance', 'Knock Off'], 'Adamant', { hp: 248, atk: 252, spd: 8 }),
  member('Garchomp', 'Garchompite', 'Rough Skin', ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
// Sei attaccanti forti (tutti con un ruolo d'attacco sulla carta): la riga Attaccanti del Riassunto con più sprite di quanti ne stanno
const ATTACK = [
  LONG[2],
  TEAM[0],
  member('Kyurem', 'Choice Specs', 'Pressure', ['Freeze-Dry', 'Draco Meteor', 'Earth Power', 'Ice Beam'], 'Timid', { def: 4, spa: 252, spe: 252 }),
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
// Il mio team di prova: voto alto, poche tappe
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

/**
 * Come hash, con qualche impostazione del formato cambiata. Il link condiviso porta la scelta del formato (`choice`), non le
 * regole: il meta non si spegne più a mano (è automatico), quindi "meta spento" è No Format, che il meta non lo ha.
 */
const hashWith = (team: unknown[], format: Partial<typeof FORMAT>) => '#team=' + Buffer.from(JSON.stringify({ team,
  ...(format.meta === false ? { choice: { family: 'free', genLimit: format.genLimit ?? 9, multipleMegas: false } } : { format: { ...FORMAT, ...format } }) })).toString('base64')
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
/** Una riga delle aree del voto; col team ridotto le righe stanno nella tendina del voto, che si apre prima. */
async function gradeRow(page: Page, text: RegExp): Promise<boolean> {
  const opened = await page.evaluate(() => {
    const toggle = document.querySelector<HTMLElement>('.grade-pop-toggle');
    if (document.querySelector('.band button.grade-area') || !toggle) return false;
    toggle.click();
    return true;
  });
  if (opened) await wait(200);
  if (await clickText(page, '.band button.grade-area', text)) return true;
  // Senza il riquadro del voto nella fascia (tablet verticale, telefono): la scheda dell'area nella barra dell'Analisi
  await tab(page, 'analysis');
  await wait(300);
  return clickText(page, '.analysis-tabs [role="tab"]', text);
}

/**
 * Apre "Come funziona il voto": dal "?" del voto nella fascia; sul telefono (fascia senza "?") dal voto in fondo alla barra
 * delle schede di Analisi, nella sua tendina. Con `topic` sceglie anche la pagina: sul computer la scheda a sinistra, sul
 * telefono la riga della lista (la pagina generale è già quella d'apertura).
 */
async function ratingHelp(page: Page, topic?: RegExp): Promise<boolean | string> {
  if (!await page.evaluate(() => { const b = document.querySelector<HTMLElement>('.band .grade-tools button.help-button'); if (!b?.getClientRects().length) return false; b.click(); return true; })) {
    await tab(page, 'analysis');
    await wait(300);
    if (!await clickText(page, '.analysis-grade-toggle', /./)) return 'no help button';
    await wait(400);
    if (!await clickText(page, '.grade-pop .help-button', /./)) return 'no help button';
  }
  await wait(300);
  if (!topic) return true;
  if (await clickText(page, '.help-nav [role="tab"]', topic)) return true;
  if (!await page.$('.help-phone')) return 'no help topic';
  return /Come funziona|How it works/.test(topic.source) || await clickText(page, '.help-list button', topic) || 'no help topic';
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
/** Stampa se l'avviso con Annulla tocca il pulsante della scheda del candidato (overlap in px) e se esce dallo schermo. */
async function toastClear(page: Page): Promise<boolean> {
  const m = await page.evaluate(() => {
    const toast = document.querySelector('.undo-toast')?.getBoundingClientRect();
    const actions = document.querySelector('.detail-actions')?.getBoundingClientRect();
    if (!toast) return 'no toast';
    const over = actions ? Math.max(0, Math.min(toast.right, actions.right) - Math.max(toast.left, actions.left)) * Math.max(0, Math.min(toast.bottom, actions.bottom) - Math.max(toast.top, actions.top)) : -1;
    return `toast=${Math.round(toast.left)},${Math.round(toast.top)} ${Math.round(toast.width)}x${Math.round(toast.height)} actions=${actions ? `${Math.round(actions.left)},${Math.round(actions.top)}` : '-'} overlap=${over} offscreen=${toast.right > innerWidth || toast.left < 0 ? 1 : 0}`;
  });
  console.log(m);
  return true;
}
/** Stampa le righe della testata dell'editor (quanti controlli per riga), se qualcosa esce a destra e dove sta il riquadro del testo. */
async function editorHead(page: Page): Promise<boolean> {
  const m = await page.evaluate(() => {
    const head = document.querySelector('.slot.open .editor-head');
    if (!head) return 'no head';
    const hb = head.getBoundingClientRect();
    const items = [...head.querySelectorAll<HTMLElement>('button, a, input, [role="combobox"]')].filter(e => e.offsetParent && !e.closest('.paste-panel'));
    const rows = new Map<number, number>();
    for (const e of items) { const top = Math.round(e.getBoundingClientRect().top / 8) * 8; rows.set(top, (rows.get(top) ?? 0) + 1); }
    const out = items.filter(e => e.getBoundingClientRect().right > hb.right + 1).length;
    const paste = document.querySelector('.slot.open .paste-panel')?.getBoundingClientRect();
    const moves = document.querySelector('.slot.open .editor-group.moves')?.getBoundingClientRect();
    const covers = paste && moves ? Math.max(0, Math.min(paste.right, moves.right) - Math.max(paste.left, moves.left)) * Math.max(0, Math.min(paste.bottom, moves.bottom) - Math.max(paste.top, moves.top)) : -1;
    const [nameTop, closeTop] = ['.nickname', '.editor-close'].map(sel => Math.round(document.querySelector(`.slot.open ${sel}`)?.getBoundingClientRect().top ?? -1));
    return `nameTop=${nameTop} closeTop=${closeTop} head=${Math.round(hb.width)}x${Math.round(hb.height)} rows=${[...rows.values()].join('|')} out=${out}${paste ? ` paste=${Math.round(paste.left)},${Math.round(paste.top)} ${Math.round(paste.width)}x${Math.round(paste.height)} coversMoves=${Math.round(covers)}` : ''} hscroll=${document.documentElement.scrollWidth > innerWidth ? 1 : 0}`;
  });
  console.log(m);
  return true;
}
const tab = (page: Page, id: string) => page.evaluate(i => { document.getElementById(`tab-${i}`)?.click(); }, id);
/** Telefono: la scheda dell'editor (Set, Statistiche, Sfida) dove sta il controllo; sul computer non c'è e non serve. */
async function editorTab(page: Page, text: RegExp): Promise<void> {
  if (await clickText(page, '.slot.open .editor-tabs [role="tab"]', text)) await wait(400);
}

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
  only: opts.collapsed ? 'desktop' : undefined,
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await gradeRow(p, /^(Difesa|Defense)/)) return 'no defense row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const offenseState = (sub: RegExp | null, opts: { collapsed?: boolean; format?: Partial<typeof FORMAT> } = {}): State => ({
  hash: opts.format ? hashWith(SIX, opts.format) : hash(SIX),
  only: opts.collapsed ? 'desktop' : undefined,
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await gradeRow(p, /^Offe(sa|nse)/)) return 'no offense row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const OFFENSE_SUBS: Record<string, RegExp | null> = { general: /^General/, types: /^(Coverage tipi|Type coverage)/, meta: /^(Coverage meta|Meta coverage)/ };
const OFFENSE_STATES: Record<string, State> = Object.fromEntries(Object.entries(OFFENSE_SUBS).flatMap(([k, re]) => [
  [`analysis-offense-${k}`, offenseState(re)],
  [`analysis-offense-${k}-collapsed`, offenseState(re, { collapsed: true })],
]));
// Guida dell'Offesa aperta dal "?" (sulla Generale), eventualmente su un'altra sezione; e Coverage tipi senza meta
const offenseGuide = (sub: RegExp | null, section?: RegExp): State => ({ hash: hash(SIX), run: async p => {
  const ok = await offenseState(sub).run!(p);
  if (ok !== true) return ok;
  if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
  await wait(400);
  if (section && !await clickText(p, '.help-nav [role="tab"]', section)) return 'no guide section';
  await wait(300);
  return true;
} });
// Telefono: il foglio dal basso aperto toccando la carta di un membro (Generale a carte) o una tessera / una minaccia
const sheetState = (sub: RegExp | null, selector: string, index = 0): State => ({ hash: hash(SIX), only: 'small', run: async p => {
  const ok = await offenseState(sub).run!(p);
  if (ok !== true) return ok;
  const items = await p.$$(selector);
  if (!items[index]) return `no ${selector}`;
  await items[index].click();
  await wait(500);
  return true;
} });
OFFENSE_STATES['analysis-offense-card-sheet'] = sheetState(OFFENSE_SUBS.general, '.og-card-open');
OFFENSE_STATES['analysis-offense-tile-sheet'] = sheetState(OFFENSE_SUBS.types, '.ct-tile-open', 2);
OFFENSE_STATES['analysis-offense-threat-sheet'] = sheetState(OFFENSE_SUBS.meta, '.cm-card .og-card-open');
OFFENSE_STATES['analysis-offense-types-nometa'] = offenseState(OFFENSE_SUBS.types, { format: { meta: false } });
OFFENSE_STATES['analysis-offense-meta-en'] = { ...offenseState(/^Meta coverage/), lang: 'en' };
OFFENSE_STATES['analysis-offense-guide'] = offenseGuide(OFFENSE_SUBS.general);
// La pagina Coverage tipi con la freccina del Colpo aperta: le difese medie dei 18 bersagli (il modale non cambia altezza)
// La guida dal "?" di Coverage tipi, col puntatore sul "?" dei bersagli: il tooltip con le medie dei 18 tipi
OFFENSE_STATES['analysis-offense-guide-types-open'] = { hash: hash(SIX), only: 'desktop', run: async p => {
  const ok = await offenseGuide(OFFENSE_SUBS.types).run!(p);
  if (ok !== true) return ok;
  const ask = await p.$('.guide-ask');
  if (!ask) return 'no targets ?';
  await ask.hover();
  await wait(500);
  return true;
} };
OFFENSE_STATES['analysis-offense-guide-types-open-en'] = { ...OFFENSE_STATES['analysis-offense-guide-types-open'], lang: 'en' } as State;
// Velocità: lo stesso team con Ribombee (Sticky Web e Stun Spore) al posto di Gholdengo, così il controllo del team si vede
const SPEED_SIX = [...TEAM, member('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid', { spa: 252, spe: 252, hp: 4 })];
// Trick Room: lo stesso team con Hatterene (Trick Room) al posto di Ribombee
const SPEED_ROOM = [...TEAM, member('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psyshock', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet', { hp: 252, spa: 252, def: 4 })];
const speedState = (sub: RegExp | null, opts: { collapsed?: boolean; format?: Partial<typeof FORMAT> } = {}): State => ({
  hash: opts.format ? hashWith(SPEED_SIX, opts.format) : hash(SPEED_SIX),
  only: opts.collapsed ? 'desktop' : undefined,
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await gradeRow(p, /^(Velocit|Speed)/)) return 'no speed row';
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
    if (!await clickText(p, '.sp-bar-btn', /./) && !await clickText(p, '.sp-card .og-card-open', /./)) return 'no bar';
    await wait(400);
    // Sotto i 1100 px il foglio dal basso (an-sheet), sul computer la finestra: il numero in testa, la × e i check (44 px col dito)
    console.log(`speedMember=${await p.evaluate(() => {
      const box = document.querySelector('.an-sheet, .sp-dialog');
      if (!box) return 'none';
      const x = box.querySelector('.help-close')?.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const checks = [...box.querySelectorAll('.sp-check')].map(c => Math.round(c.getBoundingClientRect().height)).join(',');
      return `${box.classList.contains('an-sheet') ? 'sheet' : 'dialog'} box=${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)} close=${x ? `${Math.round(x.width)}x${Math.round(x.height)}` : '-'} checks=${checks} total="${box.querySelector('.sp-dlg-total')?.textContent}" base="${box.querySelector('.sp-dlg-base')?.textContent}" count="${box.querySelector('.sp-dlg-count')?.textContent}" overflowX=${box.scrollWidth > box.clientWidth}`;
    })}`);
    return true;
  } },
  // Trick Room: Hatterene al posto di Ribombee; l'interruttore "Trick Room · Hatterene" è acceso di base (le barre in
  // Trick Room); -off lo spegne
  'analysis-speed-trickroom': { hash: hash(SPEED_ROOM), run: async p => speedState(null).run!(p) },
  'analysis-speed-trickroom-off': { hash: hash(SPEED_ROOM), run: async p => {
    const ok = await speedState(null).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.panel-switch button[role="switch"]', /Trick Room|Distortozona/)) return 'no room switch';
    await wait(400);
    return true;
  } },
  'analysis-speed-trickroom-collapsed': { hash: hash(SPEED_ROOM), only: 'desktop', run: async p => speedState(null, { collapsed: true }).run!(p) },
  // Il tooltip della barra: la scala dei vicini (Great Tusk ha la Booster: l'icona accanto al nome)
  'analysis-speed-hover': { hash: hash(SPEED_SIX), only: 'desktop', run: async p => {
    const ok = await speedState(null).run!(p);
    if (ok !== true) return ok;
    const bar = await p.$('button.sp-bar-btn');
    if (!bar) return 'no bar';
    await bar.hover();
    await wait(500);
    return true;
  } },
};
const speedGuide = (format?: Partial<typeof FORMAT>): State => ({ hash: format ? hashWith(SPEED_SIX, format) : hash(SPEED_SIX), run: async p => {
  const ok = await speedState(null, { format }).run!(p);
  if (ok !== true) return ok;
  if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
  await wait(400);
  return true;
} });
SPEED_STATES['analysis-speed-guide'] = speedGuide();
SPEED_STATES['analysis-speed-guide-nometa'] = speedGuide({ meta: false });
// La guida col tooltip del "?" di una fonte (Boost, Priorità, Controllo del team): il dettaglio di quella fonte
for (const [key, n] of [['boost', 0], ['priority', 1], ['control', 2]] as const) {
  SPEED_STATES[`analysis-speed-guide-${key}`] = { hash: hash(SPEED_SIX), run: async p => {
    const ok = await speedGuide().run!(p);
    if (ok !== true) return ok;
    const asks = await p.$$('.help-panel .guide-ask');
    if (!asks[n]) return 'no ?';
    await asks[n].hover();
    await wait(400);
    return true;
  } };
}
for (const key of ['boost', 'priority', 'control']) SPEED_STATES[`analysis-speed-guide-${key}-en`] = { ...SPEED_STATES[`analysis-speed-guide-${key}`], lang: 'en' } as State;
SPEED_STATES['analysis-speed-guide-en'] = { ...SPEED_STATES['analysis-speed-guide'], lang: 'en' } as State;
const SUBS: Record<string, RegExp | null> = { general: null, sustain: /^(Sostenibilit|Recupero)/, types: /^Coverage tipi/, meta: /^Coverage meta/ };
const DEFENSE_STATES: Record<string, State> = {
  ...Object.fromEntries(Object.entries(SUBS).flatMap(([k, re]) => [
    [`analysis-defense-${k}`, defenseState(re)],
    [`analysis-defense-${k}-collapsed`, defenseState(re, { collapsed: true })],
  ])),
  'analysis-defense-types-nometa': defenseState(SUBS.types, { format: { meta: false } }),
  'analysis-defense-long': defenseState(null, { team: LONG }),
  // Una pillola di problema toccata nella testata (va dove parla: Coverage meta o tipi, sulle carte col foglio) e il "+N" aperto;
  // col team dei nomi lunghi (LONG), che in Difesa ha due problemi (SIX nessuno)
  'analysis-defense-chip': { hash: hash(LONG), run: async (p: Page) => {
    const ok = await defenseState(null, { team: LONG }).run!(p);
    if (ok !== true) return ok;
    const chip = await p.$('.area-head .area-chip.is-link');
    if (chip) await chip.click();
    else {
      // Telefono: le pillole stanno tutte nel "+N"; la prima si sceglie dal suo menu
      if (!await clickText(p, '.area-head .area-chips-more.is-link', /./)) return 'no chip';
      await wait(400);
      if (!await clickText(p, '.more-probs-menu [role="menuitem"]:not(:disabled)', /./)) return 'no chip';
    }
    await wait(700);
    return true;
  } },
  'analysis-defense-more': { hash: hash(LONG), run: async (p: Page) => {
    const ok = await defenseState(null, { team: LONG }).run!(p);
    if (ok !== true) return ok;
    const more = await p.$('.area-head .area-chips-more.is-link');
    if (!more) return 'no +N';
    await more.click();
    await wait(500);
    return true;
  } },
  // Generale col puntatore sul "+N" di un membro (Toxapex): il tooltip coi pezzi e il recupero in parole
  ...Object.fromEntries([['member', '.def-general tbody tr:nth-child(3) .og-share.dsh']].map(([k, sel]) => [`analysis-defense-general-share-${k}`, { hash: hash(SIX), only: 'desktop', run: async (p: Page) => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    const el = await p.$(sel);
    if (!el) return 'no share';
    await el.hover();
    await wait(500);
    return true;
  } } as State])),
  // Generale: clic sul pezzo 2HKO di Toxapex in Tipi (0) e su quello OHKO in Meta (1): si apre la sottoscheda coi bersagli accesi
  ...Object.fromEntries([[0, '.hb-2'], [1, '.hb-ohko']].map(([k, cls]) => [`analysis-defense-general-pick-${k}`, { hash: hash(SIX), only: 'desktop', run: async (p: Page) => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    const cells = await p.$$('.def-general tbody tr:nth-child(3) td');
    const piece = await cells[k as number]?.$(`.kob${cls}`);
    if (!piece) return 'no piece';
    await piece.click();
    await wait(600);
    return true;
  } } as State])),
  // Generale col puntatore sul pezzo 2HKO di Toxapex in Tipi: il tooltip coi bersagli e in fondo "Clic: vai a Coverage tipi" (TipGo)
  'analysis-defense-general-piece-hover': { hash: hash(SIX), only: 'desktop', run: async (p: Page) => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    const cells = await p.$$('.def-general tbody tr:nth-child(3) td');
    const piece = await cells[0]?.$('.kob.hb');
    if (!piece) return 'no piece';
    await piece.hover();
    await wait(500);
    return true;
  } } as State,
  // Generale a squadra chiusa col puntatore su una pastiglia dei colpi peggiori: Tipi (0) e Meta (1)
  ...Object.fromEntries([0, 1].map(k => [`analysis-defense-general-worst-${k}`, { hash: hash(SIX), only: 'desktop', run: async (p: Page) => {
    const ok = await defenseState(null, { collapsed: true }).run!(p);
    if (ok !== true) return ok;
    const pills = await p.$$('.def-general tbody tr:first-child .mcs.wh');
    const pill = await pills[k]?.$('.mc');
    if (!pill) return 'no pill';
    await pill.hover();
    await wait(500);
    return true;
  } } as State])),
  // Coverage tipi con le note del meteo (Pelipper porta la pioggia), Coverage tipi e meta in inglese: sotto la tabella resta una riga
  'analysis-defense-types-rain': defenseState(SUBS.types, { team: RAIN }),
  'analysis-defense-types-en': { ...defenseState(/^Type coverage/), lang: 'en' },
  'analysis-defense-meta-en': { ...defenseState(/^Meta coverage/), lang: 'en' },
  // La guida della Difesa aperta dal "?" di Generale (Come funziona)
  'analysis-defense-guide-meta': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.meta).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide-sus': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.sustain).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  'analysis-defense-guide-types': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.types).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
  /** La guida di Coverage tipi col puntatore sul "?" degli attaccanti: il tooltip con l'attaccante di ogni tipo. */
  'analysis-defense-guide-types-open': { hash: hash(SIX), only: 'desktop', run: async p => {
    const ok = await defenseState(SUBS.types).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    const ask = await p.$('.help-panel .guide-ask');
    if (!ask) return 'no attackers ?';
    await ask.hover();
    await wait(500);
    return true;
  } },
  'analysis-defense-guide': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    return true;
  } },
};

// Ruoli (Ruoli e Bonus → Ruoli, dalla riga del voto): una vista sola, con SIX, col team di 5 (incompleto) e con un team a cui mancano ruoli (LONE)
const rolesState = (opts: { team?: unknown[]; collapsed?: boolean; lang?: 'it' | 'en' } = {}): State => ({
  hash: hash(opts.team ?? SIX),
  lang: opts.lang,
  only: opts.collapsed ? 'desktop' : undefined,
  run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (opts.collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(300);
    if (!await gradeRow(p, /^(Ruoli|Roles)/)) return 'no roles row';
    await wait(800);
    return true;
  },
});
const rolesGuide = (section?: RegExp, opts: { team?: unknown[]; lang?: 'it' | 'en' } = {}): State => ({ hash: hash(opts.team ?? SIX), lang: opts.lang, run: async p => {
  const ok = await rolesState(opts).run!(p);
  if (ok !== true) return ok;
  if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
  await wait(400);
  if (section && !await clickText(p, '.help-nav [role="tab"]', section)) return 'no guide section';
  await wait(300);
  return true;
} });
const ROLES_STATES: Record<string, State> = {
  'analysis-roles-general': rolesState(),
  'analysis-roles-general-five': rolesState({ team: TEAM }),
  'analysis-roles-general-collapsed': rolesState({ collapsed: true }),
  'analysis-roles-general-en': rolesState({ lang: 'en' }),
  'analysis-roles-general-long': rolesState({ team: LONG }),
  'analysis-roles-missing': rolesState({ team: LONE }),
  'analysis-roles-guide': rolesGuide(),
  'analysis-roles-guide-en': rolesGuide(undefined, { lang: 'en' }),
  'analysis-roles-guide-types': rolesGuide(/^(Ruoli per tipo|Roles per team)/),
  'analysis-roles-guide-types-en': rolesGuide(/^(Ruoli per tipo|Roles per team)/, { lang: 'en' }),
};

// storage: chiavi in più nel localStorage prima del caricamento (es. lo stile della lista)
// only: 'desktop' = solo da 1100 px e col mouse (fascia del team comprimibile, puntatore sopra, tabelle); 'small' = solo
// sotto i 1100 px (fogli dal basso, voto nella barra delle schede). Alle altre misure lo stato non si fa (niente skip)
interface State { hash?: string; lang?: 'it' | 'en'; storage?: Record<string, string>; only?: 'desktop' | 'small'; run?: (page: Page) => Promise<boolean | string> }
const openFill = async (p: Page) => { await p.evaluate(() => (document.querySelector('[data-fill-toggle]') as HTMLElement | null)?.click()); await p.waitForSelector('.fill-panel', { timeout: 10000 }); };
// Coverage tipi / meta di Offesa e Difesa con l'interruttore dell'efficacia acceso, e col puntatore su una colonna
const effOn = (base: State, hover = false): State => ({ ...base, ...(hover ? { only: 'desktop' as const } : {}), run: async p => {
  const ok = await base.run!(p);
  if (ok !== true) return ok;
  if (!hover) {
    if (!await clickText(p, 'button.eff-switch', /./)) return 'no eff switch';
    await wait(300);
    return true;
  }
  const head = await p.$('.ct-table thead th:nth-child(4)');
  if (!head) return 'no column head';
  await head.hover();
  await wait(250);
  return true;
} });
// Telefono e tablet, Difesa: il foglio dal basso di una carta, di una tessera o di una minaccia
const dsheetState = (sub: RegExp | null, selector: string, index = 0): State => ({ hash: hash(SIX), only: 'small', run: async p => {
  const ok = await defenseState(sub).run!(p);
  if (ok !== true) return ok;
  const items = await p.$$(selector);
  if (!items[index]) return `no ${selector}`;
  await items[index].click();
  await wait(500);
  return true;
} });
DEFENSE_STATES['analysis-defense-card-sheet'] = dsheetState(SUBS.general, '.og-card-open');
DEFENSE_STATES['analysis-defense-tile-sheet'] = dsheetState(SUBS.types, '.ct-tile-open', 2);
DEFENSE_STATES['analysis-defense-threat-sheet'] = dsheetState(SUBS.meta, '.cm-card .og-card-open');
for (const [k, re] of [['types', OFFENSE_SUBS.types], ['meta', OFFENSE_SUBS.meta]] as const) {
  OFFENSE_STATES[`analysis-offense-${k}-eff`] = effOn(offenseState(re));
  OFFENSE_STATES[`analysis-offense-${k}-hover`] = effOn(offenseState(re), true);
  DEFENSE_STATES[`analysis-defense-${k}-eff`] = effOn(defenseState(SUBS[k]));
  DEFENSE_STATES[`analysis-defense-${k}-hover`] = effOn(defenseState(SUBS[k]), true);
}
const bonusState = (team: typeof SIX, then?: (p: Page) => Promise<boolean>): State => ({ hash: hash(team), run: async p => {
  await tab(p, 'analysis');
  await wait(300);
  const ok = await clickText(p, '.analysis-tabs [role="tab"]', /^(Ruoli e Bonus|Roles & Bonus)/);
  await wait(900);
  return ok && (!then || then(p));
} });
const STATES: Record<string, State> = {
  pokemon: { run: async p => { await tab(p, 'pokemon'); return true; } },
  // Telefono: tocca il secondo candidato, la scheda sale sopra la lista
  'pokemon-sheet': { run: async p => { await tab(p, 'pokemon'); await wait(1500); const picks = await p.$$('.suggestions .pick'); await picks[1]?.evaluate(el => (el as HTMLElement).click()); await wait(500); return picks.length > 1; } },
  // Carta sotto il mouse (la prima è selezionata: la seconda in alto, la prima in basso, l'ultima): stampa quanto esce dalla lista (cut = px tagliati)
  'pokemon-hover': { run: async p => hoverCard(p, 1) },
  // Modo Sostituisci: il dettaglio con Porta e Toglie a gruppi (ruoli a riquadri, scudo, spada, VS)
  'pokemon-replace': { run: async p => {
    await tab(p, 'pokemon');
    await wait(400);
    if (!await clickText(p, '.mode-switch button, .toolbar button', /^Sostituisci$/)) return 'no replace button';
    await wait(1500);
    return (await p.evaluate(() => !!document.querySelector('.detail .bring-groups.loss, .detail .loses, .detail #detail-tab-loses'))) || 'no Toglie';
  } },
  'pokemon-hover-bl': { run: async p => hoverCard(p, 3) },
  'pokemon-hover-last': { run: async p => hoverCard(p, 5) },
  // Team nascosto (carte più alte)
  'pokemon-collapsed': { only: 'desktop', run: async p => { await tab(p, 'pokemon'); await wait(300); return clickText(p, 'button.band-toggle', /./); } },
  // Preferiti dell'utente nella lista: il ♥ sul +N
  'pokemon-fav': { storage: { 'dreamdex.lists': JSON.stringify({ universal: { favorites: FAVS, bans: [] }, byFormat: {} }) }, run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-long': { hash: hash(LONG), run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-long-en': { hash: hash(LONG), lang: 'en', run: async p => { await tab(p, 'pokemon'); return true; } },
  // Gen 9: il set del candidato ha anche la Tera (cinque dati del set nel dettaglio)
  'pokemon-gen9': { hash: hashWith(TEAM, { formatId: 'gen9ou' }), run: async p => { await tab(p, 'pokemon'); return true; } },
  editor: { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(400);
    // L'editor sta nel cassetto senza scorrere: quanto supera (0 = ci sta tutto)
    // Punta magenta sotto la carta aperta (centro carta vs punta), lastre del Set tagliate, Custom Skillset sopra la fascia
    // Mosse, la riga della Velocità e le colonne EV (intestazione sopra barra + numero)
    console.log(await p.evaluate(() => {
      const [card, ptr, drawer, tog, leg, head, slider, evIn, speed, roles] = ['.slot.open > .slot-card', '.slot-pointer', '.slot.open .drawer',
        '.slot.open .set-box > .custom-toggle', '.slot.open .set-box > legend', '.slot.open .stat-head-ev', '.slot.open .stat-row:not(.stat-head) .ev-slider',
        '.slot.open .stat-row:not(.stat-head) .ev-input', '.slot.open .speed-line', '.slot.open .editor-foot'].map(q => document.querySelector(q)?.getBoundingClientRect());
      const cut = [...document.querySelectorAll<HTMLElement>('.slot.open .set-plate')].map(pl => {
        const label = pl.querySelector('.field-label')?.textContent;
        const disp = pl.querySelector<HTMLElement>('.combobox-display') ?? pl.querySelector<HTMLInputElement>('input');
        const over = disp ? disp.scrollWidth - disp.clientWidth : -1;
        return `${label}:${Math.round(pl.getBoundingClientRect().width)}w${over > 0 ? ` CUT${over}` : ''}`;
      }).join(',');
      return `pointer=${ptr && card ? Math.round(ptr.left + ptr.width / 2 - (card.left + card.width / 2)) : 'none'} ptrBottom-drawerTop=${ptr && drawer ? Math.round(ptr.bottom - drawer.top) : '-'} plates=${cut} custom=${tog ? `${Math.round(tog.left)}-${Math.round(tog.right)} top=${Math.round(tog.top)} legendTop=${leg ? Math.round(leg.top) : '-'}` : 'none'} evHead=${head ? `${Math.round(head.left)}-${Math.round(head.right)}` : '-'} evCtl=${slider && evIn ? `${Math.round(slider.left)}-${Math.round(evIn.right)}` : '-'} speedLine=${speed ? Math.round(speed.height) : 'none'} foot=${roles ? Math.round(roles.height) : '-'} roles=${[...document.querySelectorAll('.slot.open .editor-roles li')].map(li => { const b = li.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(li); const t = rg.getBoundingClientRect(); return `y${Math.round(b.top)}h${Math.round(b.height)}t${Math.round(t.top - b.top)}-${Math.round(b.bottom - t.bottom)}`; }).join(',')} chipX=${(() => { const c = document.querySelector('.band.collapsed .slot.open > .slot-card')?.getBoundingClientRect(); const x = document.querySelector('.band.collapsed .slot.open .remove')?.getBoundingClientRect(); return c && x ? `top${Math.round(x.top - c.top)} right${Math.round(c.right - x.right)} bottom${Math.round(c.bottom - x.bottom)}` : '-'; })()}`;
    }));
    console.log(`drawerOver=${await p.evaluate(() => { const d = document.querySelector('.drawer'); return d ? d.scrollHeight - d.clientHeight : -1; })} drawerFree=${await p.evaluate(() => { const d = document.querySelector('.drawer'); const e = d?.querySelector('.set-editor'); if (!d || !e) return -1; const cs = getComputedStyle(d); return Math.round(d.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom) - e.getBoundingClientRect().bottom); })} statRow=${await p.evaluate(() => Math.round(document.querySelectorAll('.stat-row:not(.stat-head)')[0]?.getBoundingClientRect().height ?? 0))} rows=${await p.evaluate(() => { const e = document.querySelector('.drawer .set-editor') as HTMLElement | null; if (!e) return ''; return getComputedStyle(e).gridTemplateRows + ' | ' + [...e.children].map(c => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().height)}`).join(',') + ' | ' + ['.stats-cell > *', '.editor-side > *', '.evs > *'].map(q => [...e.querySelectorAll(q)].map(c => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().height)}`).join(',')).join(' / '); })}`);
    return true;
  } },
  // Annulla dopo un preset applicato dal menu Set: l'avviso non deve coprire i comandi dell'editor (stampa le sovrapposizioni)
  // La Sfida contro Gholdengo (col set più usato c'è un consiglio di EV piccolo)
  // Gen 9 OU: la Tera nella testata dell'editor, accanto a nome e tipi
  'editor-gen9': { hash: hashWith(TEAM, { formatId: 'gen9ou' }), run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(500);
    console.log(await p.evaluate(() => {
      const [tera, title, acts] = ['.slot.open .editor-tera', '.slot.open .editor-title', '.slot.open .editor-actions'].map(q => document.querySelector(q)?.getBoundingClientRect());
      const drawer = document.querySelector('.slot.open .drawer');
      return `tera=${tera ? `${Math.round(tera.left)}-${Math.round(tera.right)} h${Math.round(tera.height)}` : 'none'} titleR=${Math.round(title?.right ?? 0)} actsL=${Math.round(acts?.left ?? 0)} drawerOver=${drawer ? drawer.scrollHeight - drawer.clientHeight : -1}`;
    }));
    return true;
  } },
  'editor-duel': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(500);
    await editorTab(p, /^(Sfida|Matchup)$/);
    const input = await p.$('.slot.open .duel-species input');
    if (!input) return 'no duel';
    await input.click({ count: 3 });
    const opp = process.env.DUEL_OPP ?? 'Gholdengo';
    await input.type(opp);
    await wait(600);
    const picked = await p.evaluate((name: string) => {
      const option = [...document.querySelectorAll<HTMLElement>('.slot.open .duel-species [role="option"]')].find(o => (o.textContent ?? '').includes(name));
      option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option?.click();
      return !!option;
    }, opp);
    if (!picked) return 'no option';
    await wait(1200);
    console.log(await p.evaluate(() => `duel=${[...document.querySelectorAll('.slot.open .duel-row')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ')}`));
    return true;
  } },
  'editor-duel-tip': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(500);
    await editorTab(p, /^(Sfida|Matchup)$/);
    const input = await p.$('.slot.open .duel-species input');
    if (!input) return 'no duel';
    await input.click({ count: 3 });
    const opp = process.env.DUEL_OPP ?? 'Gholdengo';
    await input.type(opp);
    await wait(600);
    const picked = await p.evaluate((name: string) => {
      const option = [...document.querySelectorAll<HTMLElement>('.slot.open .duel-species [role="option"]')].find(o => (o.textContent ?? '').includes(name));
      option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option?.click();
      return !!option;
    }, opp);
    if (!picked) return 'no option';
    await wait(1200);
    // Il primo consiglio aperto, coi voti arrivati (Applica attivo)
    const chip = await p.$('.slot.open .duel-tip-chip:not(.out)');
    if (!chip) return 'no tip';
    await chip.click();
    await wait(1500);
    console.log(await p.evaluate(() => {
      const card = document.querySelector('.duel-tip-card');
      const r = card?.getBoundingClientRect();
      return `tipCard=${r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} vh=${innerHeight} vw=${innerWidth}` : 'none'} apply=${(card?.querySelector('.duel-tip-apply') as HTMLButtonElement | null)?.disabled === false} text=${(card?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 160)}`;
    }));
    return true;
  } },
  'editor-undo': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(400);
    if (!await clickText(p, '.slot.open .set-menu-button', /./)) return false;
    await wait(300);
    if (!await p.evaluate(() => { const row = document.querySelector<HTMLElement>('.slot.open .set-menu-row:not(.current)'); row?.click(); return !!row; })) return false;
    await wait(500);
    console.log(await p.evaluate(() => {
      const box = document.querySelector('.undo-toast')?.getBoundingClientRect();
      if (!box) return 'toast=none';
      const hits = [...document.querySelectorAll<HTMLElement>('.slot.open .drawer :is(button, input, [role="combobox"], summary, a)')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom; })
        .map(el => el.getAttribute('aria-label') || el.className || el.tagName);
      return `toast=${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)} covers=${hits.length ? hits.join('|') : 'nothing'}`;
    }));
    return true;
  } },
  // La punta magenta segue la carta aperta: apre una carta dopo l'altra e stampa quanto la punta è lontana dal centro della carta
  'editor-pointer': { run: async p => {
    const offs: string[] = [];
    for (let i = 0; i < 5; i++) {
      await p.evaluate(n => document.querySelectorAll<HTMLElement>('.slot.filled > .slot-card')[n]?.click(), i);
      await wait(500);
      offs.push(await p.evaluate(() => {
        const [card, ptr] = ['.slot.open > .slot-card', '.slot-pointer'].map(q => document.querySelector(q)?.getBoundingClientRect());
        return card && ptr && ptr.width ? String(Math.round(ptr.left + ptr.width / 2 - (card.left + card.width / 2))) : 'hidden';
      }));
    }
    console.log(`pointerOffsets=${offs.join(',')}`);
    return true;
  } },
  // EV oltre il massimo: il totale in alto dice quanti di troppo e che il voto è bloccato, senza l'avviso rosso nell'editor
  'editor-ev-over': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    await editorTab(p, /^(Statistiche|Stats)$/);
    const hp = await p.$('.drawer .ev-input');
    if (!hp) return 'no ev input';
    await hp.click({ count: 3 });
    await hp.type('252');
    await p.keyboard.press('Tab');
    await wait(400);
    console.log(`evOver=${await p.evaluate(() => { const e = document.querySelector('.ev-total.over'); const t = document.querySelector('.stat-head'); return e ? `${e.textContent} toolbarH=${Math.round(t!.getBoundingClientRect().height)} cut=${(e.querySelector('.ev-left') as HTMLElement).scrollWidth > (e.querySelector('.ev-left') as HTMLElement).clientWidth} note=${!!document.querySelector('.drawer .member-problems')}` : 'none'; })}`);
    return true;
  } },
  // La riga "Più veloce del X% del meta" sotto le statistiche col mouse sopra: il tooltip di Analisi › Velocità
  'editor-speed-tip': { only: 'desktop', run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    const line = await p.$('.speed-line-anchor');
    if (!line) return 'no speed line';
    await line.hover();
    await wait(500);
    console.log(`speedTip=${await p.evaluate(() => { const t = document.querySelector('.ftip.speed')?.getBoundingClientRect(); return t ? `${Math.round(t.left)},${Math.round(t.top)},${Math.round(t.right)},${Math.round(t.bottom)} vw=${innerWidth} vh=${innerHeight}` : 'none'; })}`);
    return true;
  } },
  // Riga delle statistiche col mouse sopra: targhetta col bordo ciano, triangolino, tacca della barra EV
  'editor-stat-hover': { only: 'desktop', run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    const row = (await p.$$('.stat-row:not(.stat-head)'))[1];
    if (!row) return 'no stat row';
    await row.hover();
    await wait(300);
    return true;
  } },
  // Menu di una mossa aperto dalla freccia: la mano sulla freccia, il menu sopra il pulsante che riduce il team
  'editor-move-menu': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    const arrow = await p.$('.editor-group.moves .field:nth-of-type(1) .combobox-trailing');
    if (!arrow) return 'no move tail';
    await arrow.click();
    await wait(400);
    console.log(await p.evaluate(() => {
      const tail = document.querySelector('.editor-group.moves .combobox-trailing')!;
      // La freccia che riduce il team c'è solo a editor chiuso: senza, niente da coprire
      const toggle = document.querySelector('.band-toggle')?.getBoundingClientRect();
      const top = toggle ? document.elementFromPoint(toggle.left + toggle.width / 2, toggle.top + toggle.height / 2) : null;
      const tails = [...document.querySelectorAll('.move-combo .mvp-tail')].map(t => `${t.textContent}:${Math.round(t.getBoundingClientRect().width)}`).join(',');
      return `tails=${tails} menuOpen=${!!document.querySelector('.editor-group.moves .combobox.open [role=listbox]')} cursor=${getComputedStyle(tail).cursor} overToggle=${!top ? 'no toggle' : top.closest('[role=listbox]') ? 'menu' : top.className}`;
    }));
    return true;
  } },
  analysis: { run: async p => { await tab(p, 'analysis'); return true; } },
  // Telefono: il voto in fondo alla barra delle schede, toccato: la tendina Voto delle aree
  'analysis-phone-grade': { only: 'small', run: async p => { await tab(p, 'analysis'); await wait(400); const b = await p.$('.analysis-grade-toggle'); if (!b) return 'no grade'; await b.click(); await wait(500); return (await p.evaluate(() => !!document.querySelector('.analysis-grade .grade-pop'))) || 'no pop'; } },
  'analysis-phone-grade-six': { hash: hash(SIX), only: 'small', run: async p => { await tab(p, 'analysis'); await wait(400); const b = await p.$('.analysis-grade-toggle'); if (!b) return 'no grade'; await b.click(); await wait(500); return (await p.evaluate(() => !!document.querySelector('.analysis-grade .grade-pop'))) || 'no pop'; } },
  'analysis-defense': { run: async p => gradeRow(p, /^Difesa/) },
  'analysis-offense': { run: async p => gradeRow(p, /^Offesa/) },
  // Carta del membro (tooltip) passando sul primo Pokémon della tabella dell'Offesa: le mosse come pillole piccole
  'card-tip': { only: 'desktop', run: async p => {
    if (await gradeRow(p, /^Offesa/) !== true) return 'no offense';
    await wait(500);
    const mon = await p.$('.def-mon-name');
    if (!mon) return 'no member';
    await mon.hover();
    await wait(1200);
    return (await p.evaluate(() => !!document.querySelector('.ftip .mcard-move'))) || 'no card tip';
  } },
  // Difesa: una scheda per sotto-scheda (SIX), con meta, senza meta, a team chiuso e con nomi lunghi
  ...DEFENSE_STATES,
  ...OFFENSE_STATES,
  ...SPEED_STATES,
  ...ROLES_STATES,
  'analysis-offense-strip': { hash: hash(SIX), run: async p => gradeRow(p, /^Offesa/) },
  'analysis-roles': { run: async p => gradeRow(p, /^Ruoli/) },
  'analysis-coaching': { run: async p => { await tab(p, 'analysis'); await wait(300); const ok = await clickText(p, '.analysis-tabs [role="tab"]', /^Coaching/); await wait(900); return ok; } },
  'analysis-bonus': { run: async p => { await tab(p, 'analysis'); await wait(300); const ok = await clickText(p, '.analysis-tabs [role="tab"]', /^(Ruoli e Bonus|Roles & Bonus)/); await wait(900); return ok; } },
  // Bonus/Malus con altri team: SIX (due core a tre), LONE (nessun core, malus), RAIN, STRESS (un core e tante voci); il secondo core aperto; il catalogo
  'analysis-bonus-six': bonusState(SIX),
  'analysis-bonus-lone': bonusState(LONE),
  'analysis-bonus-rain': bonusState(RAIN),
  // Due core: affiancati se c'è posto (niente da cliccare), a fisarmonica solo su carte strette
  'analysis-bonus-swap': bonusState(SIX, async p => { if (!await p.$('.bm-core.shut')) return true; const ok = await clickText(p, '.bm-core.shut .bm-core-art', /./); await wait(400); return ok; }),
  // Telefono: la scheda portata in alto (le voci, poi i core) e il secondo core aperto
  'analysis-bonus-six-scrolled': bonusState(SIX, async p => { await p.evaluate(() => document.querySelector('.bm')?.scrollIntoView()); await wait(300); return true; }),
  'analysis-bonus-six-cores': bonusState(SIX, async p => { await p.evaluate(() => document.querySelector('.bm-cores')?.scrollIntoView()); await wait(300); if (!await p.$('.bm-core.shut')) return true; const ok = await clickText(p, '.bm-core.shut .bm-core-art', /./); await wait(400); return ok; }),
  'analysis-bonus-stress': bonusState(STRESS),
  // Il tooltip coi tipi retti di un core (su "Reggono N/18"), quello di una medaglia e quello di "+N altre"
  'analysis-bonus-six-held': bonusState(SIX, async p => { const el = await p.$('.bm-core.open .bm-core-held'); if (!el) return false; await el.hover(); await wait(500); return true; }),
  'analysis-bonus-stress-medal': bonusState(STRESS, async p => { const el = await p.$('.bm-row'); if (!el) return false; await el.hover(); await wait(500); return true; }),
  'analysis-bonus-stress-more': bonusState(STRESS, async p => { const el = await p.$('.bm-more-cell'); if (!el) return true; await el.hover(); await wait(500); return true; }),
  'analysis-bonus-guide': bonusState(SIX, async p => { const ok = await clickText(p, '.bm-more', /./); await wait(400); return ok; }),
  'analysis-overview-three': { hash: hash(TEAM.slice(0, 3)), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-meta-off': { hash: hashWith(TEAM, { meta: false }), run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-one': { hash: hash(TEAM.slice(0, 2)), run: async p => { await tab(p, 'analysis'); return true; } },
  // Cruscotto con un membro solo: "Cosa fare" invita ad aggiungere, niente "nessun problema"
  'analysis-single': { hash: hash(TEAM.slice(0, 1)), run: async p => { await tab(p, 'analysis'); return true; } },
  'rating-help': { run: async p => ratingHelp(p) },
  // Come funziona il voto, pagina generale: la tabella dei pesi e la riga dei Ruoli sotto
  'rating-help-general': { run: async p => ratingHelp(p, /^(Come funziona|How it works)$/) },
  'rating-help-general-en': { lang: 'en', run: async p => ratingHelp(p, /^How it works$/) },
  // Hyper Offense: la frase su Trick Room e le voci dei Ruoli come etichette piatte
  'rating-help-ho': { hash: hash(SIX), run: async p => ratingHelp(p, /^Hyper Offense/) },
  'rating-help-balance': { hash: hash(SIX), run: async p => ratingHelp(p, /^Balance/) },
  'analysis-help': { run: async p => {
    if (!await gradeRow(p, /^Difesa/)) return 'no row';
    await wait(300);
    return clickText(p, 'button.area-help', /./);
  } },
  // Stampa l'altezza delle righe delle proposte mentre i consigli si calcolano (scheletro) e dopo: devono coincidere
  'coaching-six': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    const rowH = (sel: string) => p.evaluate(q => document.querySelector(q)?.getBoundingClientRect().height ?? -1, sel);
    const start = Date.now();
    const skeleton = await rowH('.coach-diag-list[aria-busy] > li');
    await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
    console.log(`coaching-six: proposte pronte in ${Date.now() - start} ms; row skeleton=${skeleton} real=${await rowH('.coach-diag-list:not([aria-busy]) > li')}`);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.coach-diag-list > li')].map(li => { const r = li.getBoundingClientRect(); return `${Math.round(r.top)}-${Math.round(r.bottom)}`; }).join(' '));
    const box = await p.evaluate(() => { const r = document.querySelector('.coaching')?.getBoundingClientRect(); const ol = document.querySelector('.coach-diag-list'); return r ? `${Math.round(r.top)}-${Math.round(r.bottom)} rows=${ol ? getComputedStyle(ol).gridAutoRows : '-'}` : '-'; });
    console.log(`coaching-six: righe ${rows}; coaching ${box}`);
    return true;
  } },
  // Team senza problemi (un team da torneo di National Dex OU): Eevee contento, "Il team è a posto"
  'coaching-clear': { hash: hash(CLEAR), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await wait(600);
    return (await p.evaluate(() => !!document.querySelector('.coach-empty.is-clear'))) || 'team con problemi';
  } },
  // Un'alternativa ("Oppure") messa nella carta grande
  'coaching-menu': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
    if (!await clickText(p, 'button.coach-alt-tile', /./)) return 'no alternatives';
    await wait(300);
    return true;
  } },
  // Un problema scelto nella diagnosi (la lista filtrata) e una proposta della lista aperta nella carta grande
  'coaching-filter': { hash: hash(LONG), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-diag-list:not([aria-busy])', { timeout: 20000 });
    if (!await p.evaluate(() => { const sel = document.querySelector<HTMLSelectElement>('.coach-filter select'); if (!sel || sel.options.length < 2) return false; sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })) return 'no problem';
    await wait(300);
    await clickText(p, '.coach-rank:not(.is-open)', /./);
    await wait(300);
    return true;
  } },
  // Il "?" del Coaching aperto
  'coaching-help': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
    if (!await clickText(p, '.coach-diag-top .help-button', /./)) return 'no help';
    await wait(300);
    return true;
  } },
  // Coaching del team coi nomi lunghi (molti problemi minori di coverage)
  'coaching-long': { hash: hash(LONG), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
    return true;
  } },
  // Coaching col team chiuso: la scheda ha più altezza (versione estesa)
  'coaching-collapsed': { hash: hash(SIX), only: 'desktop', run: async p => {
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
    // I consigli arrivano dopo il calcolo: si aspettano le righe delle proposte
    await p.waitForSelector('.coach-hero button.coach-see', { timeout: 20000 });
    // Applica applica la proposta: "Vedi nella scheda Pokémon" apre le alternative nella scheda Pokémon
    if (!await clickText(p, 'button.coach-see', /./)) return false;
    // La lista per membro si calcola dopo il clic: si aspetta che non sia più attenuata
    const start = Date.now();
    await wait(100);
    await p.waitForSelector('.suggestions:not(.stale)', { timeout: 20000 });
    console.log(`coaching-click: lista pronta in ${Date.now() - start} ms`);
    return true;
  } },
  // Cruscotto della Panoramica col team ridotto: più spazio, più informazione
  // Team ridotto: la tendina "Voto delle aree" aperta sotto il voto (voce 3.1)
  'grade-pop': { hash: hash(SIX), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(500);
    if (!await clickText(p, '.grade-pop-toggle', /./)) return 'no grade button';
    await wait(300);
    const m = await p.evaluate(() => {
      const pop = document.querySelector('.grade-pop')?.getBoundingClientRect();
      const btn = document.querySelector('.grade-pop-toggle')?.getBoundingClientRect();
      if (!pop || !btn) return null;
      const rows = [...document.querySelectorAll<HTMLElement>('.grade-pop button.grade-area')];
      const over = rows.filter(r => r.scrollWidth - r.clientWidth > 1).length;
      return { pop: [Math.round(pop.left), Math.round(pop.top), Math.round(pop.width), Math.round(pop.height)], btn: [Math.round(btn.left), Math.round(btn.bottom), Math.round(btn.right)], rows: rows.length, over, inWindow: pop.right <= innerWidth && pop.bottom <= innerHeight };
    });
    console.log(`grade-pop: ${JSON.stringify(m)}`);
    return !!m;
  } },
  'analysis-collapsed': { hash: hash(SIX), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Riassunto completo: team pioggia, aperto e col team ridotto, e team senza sinergie
  'analysis-weathers': { hash: hash(WEATHERS), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-weathers-cores': { hash: hash(WEATHERS_CORES), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-rain': { hash: hash(RAIN), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-rain-collapsed': { hash: hash(RAIN), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Il "+N" verde delle Sinergie col puntatore sopra (team aperto: il pulsante in fondo; chiuso: accanto al titolo); col team
  // dei campi (FIELD): con la pioggia ora le sinergie ci stanno tutte
  ...Object.fromEntries([false, true].map(collapsed => [`analysis-rain-syn-more${collapsed ? '-collapsed' : ''}`, { hash: hash(FIELD), only: 'desktop', run: async (p: Page) => {
    await tab(p, 'analysis');
    await wait(300);
    if (collapsed && !await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    const more = await p.$('.sum-syn-sec .tipped');
    if (!more) return 'no more';
    await more.hover();
    await wait(600);
    return true;
  } } as State])),
  'analysis-rain-en': { hash: hash(RAIN), lang: 'en', run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  'analysis-rain-collapsed-en': { hash: hash(RAIN), lang: 'en', only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  'analysis-lone': { hash: hash(LONE), run: async p => { await tab(p, 'analysis'); await wait(300); return true; } },
  // Lo stesso in inglese (etichette più lunghe nel Riassunto)
  'analysis-collapsed-en': { hash: hash(SIX), lang: 'en', only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Team offensivo (molti ruoli minori) col team ridotto: la tabella dei Ruoli con tutti i livelli
  'analysis-collapsed-offense': { hash: hash(LONG), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(800);
    return true;
  } },
  // Offesa › Generale col team chiuso: le pillole delle mosse sotto le barre, la prima col mouse sopra (si apre, coda in diagonale)
  'offense-chips-hover': { hash: hash(SIX), only: 'desktop', run: async p => {
    if (await gradeRow(p, /^Offesa/) !== true) return 'no offense';
    await wait(300);
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no toggle';
    await wait(900);
    const size = () => p.evaluate(() => { const c = document.querySelector('.mcs .mcp:not(.z)'); return c ? `${Math.round(c.getBoundingClientRect().width)}/${getComputedStyle(c.querySelector('.mvp-tail')!).clipPath.slice(0, 18)}` : 'none'; });
    const before = await size();
    const chip = await p.$('.mcs .mcp:not(.z)');
    if (!chip) return 'no chips';
    await chip.hover();
    await wait(600);
    console.log(`chip closed=${before} open=${await size()} symbols=${await p.evaluate(() => document.querySelectorAll('.mcs .mvp-cat').length)}`);
    return true;
  } },
  // Il "?" del tipo di team aperto
  'team-type-help': { hash: hash(SIX), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '.dash-summary .help-button', /./)) return 'no help';
    await wait(300);
    return true;
  } },
  'team-type-help-en': { hash: hash(SIX), lang: 'en', only: 'desktop', run: async p => {
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
  // Sul telefono, a team vuoto, l'Analisi non ha schede (la pagina vuota è analysis-empty)
  'coaching-empty': { hash: '', only: 'desktop', run: async p => {
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
    await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
    return true;
  } },
  // Proposte di mossa (team con set poveri): stampa quante righe di mossa ci sono nella prima pagina
  'coaching-move-steps': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-diag-list:not([aria-busy])', { timeout: 20000 });
    const count = () => p.evaluate(() => document.querySelectorAll('.coach-rank.is-move, .coach-hero.is-move').length);
    const n = await count();
    // Se nella prima pagina non ce ne sono, le pagine dopo (come coaching-move): la foto sulla prima che ne ha
    let page = 1;
    for (; page <= 8 && !await count(); page++) {
      const next = await p.$('.coach-diag .coach-pages .cm-step:last-child:not(:disabled)');
      if (!next) break;
      await next.click();
      await wait(300);
    }
    const found = await count();
    console.log(`coaching-move-steps: ${n} proposte di mossa nella prima pagina${n ? '' : `, ${found} a pagina ${page}`}`);
    return found > 0 || 'no move proposal';
  } },
  // Clic su una proposta di mossa: editor del membro con la mossa nuova in anteprima
  'coaching-move': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-diag-list:not([aria-busy])', { timeout: 20000 });
    // La prima proposta di mossa: nella carta grande, o nella lista (pagina dopo pagina) e da lì nella carta
    for (let i = 0; i < 8 && !await p.evaluate(() => !!document.querySelector('.coach-hero.is-move, .coach-rank.is-move')); i++) {
      const next = await p.$('.coach-diag .coach-pages .cm-step:last-child:not(:disabled)');
      if (!next) break;
      await next.click();
      await wait(300);
    }
    if (!await p.evaluate(() => !!document.querySelector('.coach-hero.is-move')) && !await clickText(p, '.coach-rank.is-move', /./)) return 'no move proposal';
    await wait(300);
    if (!await clickText(p, '.coach-hero.is-move button.coach-see', /./)) return 'no move proposal';
    await wait(600);
    return (await p.evaluate(() => !!document.querySelector('.move-proposal'))) || 'no preview in the editor';
  } },
  meta: { run: async p => { await tab(p, 'meta'); return true; } },
  lists: { run: async p => { await tab(p, 'lists'); return true; } },
  // Telefono e tablet: tocca il pulsante dei Preferiti, la lista si apre nel foglio
  'lists-sheet': { only: 'small', storage: { 'dreamdex.lists': JSON.stringify({ byFormat: { ou: { favorites: ['Great Tusk', 'Kingambit', 'Gholdengo', 'Dragapult', 'Corviknight', 'Toxapex', 'Iron Valiant', 'Garchomp', 'Zamazenta', 'Landorus-Therian', 'Rotom-Wash', 'Ferrothorn', 'Heatran', 'Slowking-Galar', 'Clefable'], bans: ['Magikarp'] } } }) }, run: async p => { await tab(p, 'lists'); await wait(500); const b = await p.$('.lists-tab.favorites'); await b?.evaluate(el => (el as HTMLElement).click()); await wait(600); return !!b; } },
  // Scorrendo il Pokédex i due pulsanti restano in alto
  'lists-scrolled': { storage: { 'dreamdex.lists': JSON.stringify({ byFormat: { ou: { favorites: ['Great Tusk', 'Kingambit', 'Gholdengo'], bans: ['Magikarp'] } } }) }, run: async p => { await tab(p, 'lists'); await wait(500); await p.evaluate(() => window.scrollTo(0, 500)); await wait(300); return true; } },
  // Preferiti e bannati pieni (anche oltre una pagina): la forma su telefono e tablet
  'lists-full': { storage: { 'dreamdex.lists': JSON.stringify({ byFormat: { ou: { favorites: ['Great Tusk', 'Kingambit', 'Gholdengo', 'Dragapult', 'Corviknight', 'Toxapex', 'Iron Valiant', 'Garchomp', 'Zamazenta', 'Landorus-Therian', 'Rotom-Wash', 'Ferrothorn', 'Heatran', 'Slowking-Galar', 'Clefable'], bans: ['Magikarp', 'Pikachu', 'Ditto', 'Smeargle'] } } }) }, run: async p => { await tab(p, 'lists'); return true; } },
  // Scheda Meta (sopra: team di 5): team di 6, in inglese, col mouse sulla carta #4
  'meta-six': { hash: hash(SIX), run: async p => { await tab(p, 'meta'); return true; } },
  // Il tuo team con chi è fuori dai 40 (#–) e chi non è nelle statistiche
  'meta-out': { hash: hash([TEAM[0], member('Magikarp', '', 'Swift Swim', ['Splash'], 'Jolly', {}), member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane'], 'Bold', {}), member('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', {})]), run: async p => { await tab(p, 'meta'); return true; } },
  // Telefono e tablet: tocca la quarta carta, la scheda entra (da destra sul tablet, dal basso sul telefono)
  'meta-sheet': { hash: hash(SIX), run: async p => { await tab(p, 'meta'); await wait(800); const cards = await p.$$('.meta-card'); await cards[3]?.evaluate(el => (el as HTMLElement).click()); await wait(600); return cards.length > 3; } },
  'meta-en': { lang: 'en', run: async p => { await tab(p, 'meta'); return true; } },
  'meta-hover': { run: async p => { await tab(p, 'meta'); await wait(800); const box = await p.evaluate(() => { const r = document.querySelectorAll('.meta-card')[3]?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + 40] : null; }); if (!box) return false; await p.mouse.move(box[0], box[1]); await wait(400); return true; } },
  fill: { run: async p => clickText(p, 'button', /^\s*Completa team/) },
  saved: { run: async p => clickText(p, 'details.popover > summary', /Team salvati/) },
  import: { run: async p => clickText(p, 'details.popover > summary', /Import/) },
  rules: { run: async p => { await p.click('.format-card > summary'); return true; } },
  filters: { run: async p => { await tab(p, 'pokemon'); return clickText(p, '.toolbar .filters-trigger', /./); } },
  combobox: { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    return clickText(p, '[role="combobox"]', /.*/);
  } },
  'stats-pop': { run: async p => focus(p, '.stats-badge') },
  alert: { run: async p => focus(p, '.alert-mark') },
  'grade-delta': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Iron Valiant/)) return 'no card';
    await wait(600);
    if (!await clickText(p, '.slot.open button.set-menu-button', /./)) return 'no set button';
    await wait(300);
    return clickText(p, '.slot.open .set-menu-row', /./);
  } },
  'editor-alert': { hash: hash(MOVE), run: async p => {
    // La prima carta con un avviso (Great Tusk con una mossa che non impara)
    if (!await clickText(p, '.slot.filled:has(.alert-mark) > .slot-card', /./)) return 'no card';
    await wait(600);
    return focus(p, '.slot.open .alert-mark');
  } },
  // Nomi lunghi con l'editor aperto: la carta aperta tiene il nome; nella barra compressa i nomi vanno su due righe
  'editor-long': { hash: hash(LONG), run: async p => { if (!await clickText(p, '.slot.filled > .slot-card', /Urshifu/)) return 'no card'; await wait(600); return true; } },
  // Testata dell'editor (Great Tusk: preset sia NatDex OU sia Gen 9 OU), il menu Set aperto e il riquadro del testo del set
  'editor-head': { run: async p => { if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card'; await wait(600); return editorHead(p); } },
  // Il pulsante Set dopo aver scelto il primo preset Smogon: "SET  <nome>  SMOGON"
  'editor-preset-applied': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    if (!await clickText(p, '.slot.open button.set-menu-button', /./)) return 'no set button';
    await wait(300);
    if (!await clickText(p, '.slot.open .set-menu-row', /./)) return 'no preset';
    await wait(500);
    console.log(await p.evaluate(() => {
      const b = document.querySelector<HTMLElement>('.slot.open .set-menu-button');
      const cur = b?.querySelector<HTMLElement>('.set-menu-current');
      return `setButton="${b?.textContent}" w=${Math.round(b?.getBoundingClientRect().width ?? 0)} nameCut=${cur ? cur.scrollWidth - cur.clientWidth : -1}`;
    }));
    return true;
  } },
  'editor-presets': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    if (!await clickText(p, '.slot.open button.set-menu-button', /./)) return 'no set button';
    await wait(300);
    console.log(await p.evaluate(() => {
      const pop = document.querySelector('.slot.open .set-menu-pop')?.getBoundingClientRect();
      const drawer = document.querySelector('.slot.open .drawer');
      if (!pop || !drawer) return 'no menu';
      const d = drawer.getBoundingClientRect();
      const rows = [...document.querySelectorAll('.slot.open .set-menu-row')].map(r => r.querySelector('strong')?.textContent + (r.querySelector('.set-menu-best') ? '*' : '')).join(',');
      return `setMenu=${Math.round(pop.left)},${Math.round(pop.top)} ${Math.round(pop.width)}x${Math.round(pop.height)} inDrawer=${pop.bottom <= d.bottom && pop.left >= d.left ? 1 : 0} drawerOver=${drawer.scrollHeight - drawer.clientHeight} rows=${rows}`;
    }));
    return true;
  } },
  // Fumetti delle icone della testata col fuoco (dove cadono, se escono dalla finestra), matita del nome, contrasto di "N liberi"
  'editor-hints': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    for (const sel of ['.shiny-toggle', '.member-copy', '.editor-close', '.nickname']) {
      await focus(p, `.slot.open ${sel}`);
      await wait(200);
      console.log(await p.evaluate(s => {
        const el = document.querySelector<HTMLElement>(`.slot.open ${s}`);
        if (!el) return `${s}: missing`;
        const pencil = el.querySelector<HTMLElement>('.nickname-pencil');
        if (pencil) return `${s}: pencil opacity=${getComputedStyle(pencil).opacity}`;
        const bubble = el.closest('.hint-wrap')?.querySelector<HTMLElement>('.hint-bubble');
        if (!bubble) return `${s}: no bubble`;
        const r = bubble.getBoundingClientRect();
        return `${s}: "${bubble.textContent}" ${Math.round(r.left)}..${Math.round(r.right)} shown=${!bubble.hidden} off=${r.right > innerWidth || r.left < 0 ? 1 : 0} desc=${el.getAttribute('aria-describedby') ? 1 : 0}`;
      }, sel));
    }
    console.log(await p.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.slot.open .ev-left');
      if (!el) return 'no ev-left';
      let bg = ''; let n: HTMLElement | null = el;
      while (n && !bg) { const c = getComputedStyle(n).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') bg = c; n = n.parentElement; }
      return `ev-left "${el.textContent}" color=${getComputedStyle(el).color} bg=${bg} size=${getComputedStyle(el).fontSize}`;
    }));
    return true;
  } },
  'editor-paste': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    if (!await clickText(p, '.slot.open button.set-menu-button', /./)) return 'no set button';
    await wait(300);
    if (!await clickText(p, '.slot.open .set-menu-foot button', /Incolla|Paste/)) return 'no paste button';
    await wait(300);
    return editorHead(p);
  } },
  // Barra del team (striscia unica): altezza, alto e basso di ogni pezzo, distanze, se esce o va a capo; la freccia che riduce il team
  'team-bar': { run: async p => {
    await tab(p, 'pokemon');
    await wait(300);
    console.log(await p.evaluate(() => {
      const head = document.querySelector('.team-head')!.getBoundingClientRect();
      const parts = [...document.querySelectorAll<HTMLElement>('.team-plate, .team-saved summary, .team-guide, .team-io, .clear-team')].map(e => {
        const b = e.getBoundingClientRect();
        return `${(e.className || e.tagName).toString().split(' ')[0]}:${Math.round(b.left)}-${Math.round(b.right)} y${Math.round(b.top)}h${Math.round(b.height)}`;
      });
      const tog = document.querySelector('.band-toggle')?.getBoundingClientRect();
      const band = document.querySelector('.band')?.getBoundingClientRect();
      return `teamBar head=${Math.round(head.left)}-${Math.round(head.right)} ${parts.join(' ')} out=${head.right > innerWidth ? 1 : 0} toggle=${tog ? `${Math.round(tog.top)}-${Math.round(tog.bottom)} bandBottom=${Math.round(band!.bottom)}` : 'none'}`;
    }));
    return true;
  } },
  undo: { run: async p => clickText(p, 'button.remove', /Rimuovi/) },
  collapsed: { hash: hash(LONG), only: 'desktop', run: async p => clickText(p, 'button.band-toggle', /./) },
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
    await p.evaluate(() => (document.querySelector('.toolbar .filters-trigger') as HTMLElement | null)?.click());
    await wait(300);
    const ok = await p.evaluate(() => {
      const group = document.querySelector('.filters-dialog [role="group"][aria-label="Ruolo"]');
      const button = [...(group?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').trim() === 'Hazard') as HTMLElement | undefined;
      button?.click();
      return !!button;
    });
    await p.keyboard.press('Escape');
    await wait(300);
    return ok;
  } },
  empty: { hash: '' },
  // Team con 1, 3 o 5 Pokémon: solo il primo slot libero ha la scritta, gli altri sono cornici tenui
  'team-1': { hash: hash(TEAM.slice(0, 1)) },
  'team-3': { hash: hash(TEAM.slice(0, 3)) },
  'team-5': { hash: hash(TEAM) },
  'en-compact': { lang: 'en' },
  'long-names': { hash: hash(LONG) },
  nodata: { run: async () => 'every bundled format has data; the no-data banner is covered by the App test' },
  settings: { run: async p => { await p.click('.rail-settings'); return true; } },
  'fill-open': { hash: hash(TEAM.slice(0, 3)), run: async p => { await openFill(p); await wait(2500); return true; } },
  'fill-tournament': { hash: hash(TEAM.slice(0, 3)), run: async p => { await openFill(p); await clickText(p, '[role="tab"]', /Team da torneo/); await wait(800); return true; } },
  'fill-unlocked': { hash: hash(TEAM.slice(0, 3)), run: async p => { await openFill(p); await p.evaluate(() => (document.querySelector('.fill-panel input[type="checkbox"]') as HTMLElement | null)?.click()); await wait(3500); return true; } },
  'filters-open': { run: async p => { await tab(p, 'pokemon'); await p.evaluate(() => (document.querySelector('.toolbar .filters-trigger') as HTMLElement | null)?.click()); await wait(400); return true; } },
  // Finestra dei filtri con qualche scelta accesa (in un evaluate solo l'ultima resta: basta per vedere una tessera accesa)
  'filters-busy': { run: async p => {
    await tab(p, 'pokemon');
    await p.evaluate(() => (document.querySelector('.toolbar .filters-trigger') as HTMLElement | null)?.click());
    await wait(300);
    // Niente funzioni con nome dentro evaluate: tsx ci aggiunge __name, che nella pagina non esiste
    await p.evaluate(() => {
      for (const [group, text] of [['Resiste a', 'Terra'], ['Ruolo', 'Muro Fisico'], ['Ruolo', 'Hazard']]) {
        const g = document.querySelector(`.filters-dialog [role="group"][aria-label="${group}"]`);
        ([...(g?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').trim() === text) as HTMLElement | undefined)?.click();
      }
    });
    // La casella Tipo 1 aperta: si vede la tendina dei tipi
    await p.evaluate(() => (document.querySelector('.filters-dialog .type-slot-btn') as HTMLElement | null)?.click());
    await wait(500);
    return true;
  } },
  'format-menu': { run: async p => { await p.click('.rail-format'); await wait(500); return true; } },
  'saved-menu': { storage: { 'dreamdex.savedTeams': JSON.stringify([{ name: 'Pioggia NatDex', text: 'Pelipper' }, { name: 'Un nome di team davvero molto lungo per vedere se va a capo', text: 'Garchomp' }]) }, run: async p => { await p.evaluate(() => (document.querySelector('.team-head > details.popover > summary') as HTMLElement | null)?.click()); await wait(400); return true; } },
  'saved-empty': { hash: '', run: async p => { await p.evaluate(() => (document.querySelector('.team-head > details.popover > summary') as HTMLElement | null)?.click()); await wait(400); return true; } },
  'team-three': { hash: hash(TEAM.slice(0, 3)) },
  'improve-small': { hash: hash(SIX), run: async p => { await p.evaluate(() => (document.querySelector('.team-guide') as HTMLElement | null)?.click()); await p.waitForSelector('.improve-toggle', { timeout: 20000 }); await wait(300); return true; } },
  'improve-wide': { hash: hash(SIX), run: async p => { await p.evaluate(() => (document.querySelector('.team-guide') as HTMLElement | null)?.click()); await p.waitForSelector('.improve-toggle', { timeout: 20000 }); await p.click('.improve-toggle'); await wait(700); return true; } },
  'improve-wide-en': { hash: hash(SIX), lang: 'en', run: async p => { await p.evaluate(() => (document.querySelector('.team-guide') as HTMLElement | null)?.click()); await p.waitForSelector('.improve-toggle', { timeout: 20000 }); await p.click('.improve-toggle'); await wait(700); return true; } },
  'team-empty': { hash: '' },
  // Team fuori regola (Mewtwo è Ubers in National Dex OU): voto grigio con il motivo sotto
  // Svuota: il cestino con il fumetto sotto il mouse; poi svuotato, con l'avviso che non copre il pulsante della scheda
  'clear-hover': { run: async p => { await p.hover('.team-head .clear-team'); await wait(300); return true; } },
  cleared: { run: async p => { await p.click('.team-head .clear-team'); await wait(1200); return toastClear(p); } },
  'removed-toast': { run: async p => { if (!await clickText(p, 'button.remove', /Rimuovi/)) return false; await wait(1200); return toastClear(p); } },
  // Triangolo rosso della carta del voto (team fuori regola) col mouse sopra: il tooltip resta dentro lo schermo
  'grade-alert-hover': { hash: hash([...TEAM, member('Mewtwo', 'Life Orb', 'Pressure', ['Psystrike', 'Ice Beam', 'Aura Sphere', 'Recover'], 'Timid', { spa: 252, spe: 252, hp: 4 })]), run: async p => {
    await wait(800);
    const mark = await p.$('.grade-tools .alert-mark');
    if (!mark) return 'no alert mark';
    await mark.hover();
    await wait(400);
    console.log(`gradeAlert=${await p.evaluate(`(() => { const t = document.querySelector('.alert-pop.alert-float'); if (!t) return 'none'; const r = t.getBoundingClientRect(); return Math.round(r.left) + '..' + Math.round(r.right) + ' vw=' + innerWidth + ' out=' + (r.right > innerWidth || r.left < 0); })()`)}`);
    return true;
  } },
  illegal: { hash: hash([...TEAM, member('Mewtwo', 'Life Orb', 'Pressure', ['Psystrike', 'Ice Beam', 'Aura Sphere', 'Recover'], 'Timid', { spa: 252, spe: 252, hp: 4 })]) },
};
// Le stesse viste in inglese (testi più lunghi): editor, guida del voto e finestra del formato
STATES['editor-en'] = { ...STATES.editor, lang: 'en' };
STATES['rating-help-en'] = { ...STATES['rating-help'], lang: 'en' };
STATES['format-menu-en'] = { ...STATES['format-menu'], lang: 'en' };
// Tablet e telefono: le schede dell'editor (Statistiche, Sfida) e la tendina dello Strumento (foglio dal basso in verticale)
const editorThen = (then: (p: Page) => Promise<boolean | string>): State => ({ run: async p => { const ok = await STATES.editor.run!(p); if (ok !== true) return ok; await wait(300); return then(p); } });
STATES['editor-tab-stats'] = editorThen(p => clickText(p, '.editor-tabs [role="tab"]', /^(Statistiche|Stats)$/));
STATES['editor-tab-duel'] = editorThen(p => clickText(p, '.editor-tabs [role="tab"]', /^(Sfida|Matchup)$/));
STATES['fill-settings'] = { hash: hash(TEAM.slice(0, 3)), run: async p => { await openFill(p); await wait(800); const el = await p.$('.fill-settings-button'); if (!el) return false; await el.click(); await wait(600); return true; } };
STATES['team-menu'] = { run: async p => { const el = await p.$('.team-more-button'); if (!el) return false; await el.click(); await wait(500); return true; } };
STATES['editor-item-menu'] = editorThen(async p => { const el = await p.$('.slot.open .drawer .set-box .set-plates .set-plate'); if (!el) return false; const b = await el.boundingBox(); if (!b) return 'no box'; await p.mouse.click(b.x + b.width * 0.6, b.y + b.height / 2); await wait(600); return true; });

// --- Momenti rari (per la copertura del CSS: classi che compaiono solo per un attimo o dopo un'azione) ---
/** Come hash, con una scelta del formato intera (es. il gioco Scarlatto/Violetto) al posto delle regole. */
const hashChoice = (team: unknown[], choice: Record<string, unknown>) => '#team=' + Buffer.from(JSON.stringify({ team, choice })).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const COMPETITIVE = { family: 'competitive', source: 'smogon', gen: 'natdex', battle: 'singles', tier: 'OU', ignoreBans: false, multipleMegas: false };
const SV = { family: 'game', game: 'sv', allPokedex: false, legendaries: false };
/**
 * Il tempo quasi fermo: i timer da 100 ms in su durano mille volte di più (una chiusura animata, un'uscita di Eevee, un
 * avviso restano a metà). Come stringa: dentro evaluate niente funzioni con nome (tsx aggiunge __name).
 */
const slowTime = (p: Page) => p.evaluate(`(() => { const st = window.setTimeout.bind(window); window.setTimeout = (fn, ms, ...a) => st(fn, ms >= 100 ? ms * 1000 : ms, ...a); })()`);
/** Le animazioni CSS ferme dove sono ora (per la foto a metà di una chiusura). */
const pauseAnims = (p: Page) => p.evaluate(`(() => { for (const a of document.getAnimations()) a.pause(); })()`);
/** Math.random fisso: le scelte a caso (dove riappare Eevee) diventano sempre le stesse. */
const fixRandom = (p: Page, value: number) => p.evaluate(`(() => { Math.random = () => ${value}; })()`);
/** Copia negli appunti finta (senza permessi la vera fallisce): Esporta e Copia riescono. */
const fakeClipboard = (p: Page) => p.evaluate(`(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {}, readText: async () => '' } }); })()`);
/** Scrive nel campo (clic, testo) e lascia a React il tempo di aggiornare. */
async function typeInto(p: Page, selector: string, text: string, enter = false): Promise<boolean> {
  const el = await p.$(selector);
  if (!el) return false;
  await el.click({ count: 3 });
  await el.type(text);
  if (enter) await p.keyboard.press('Enter');
  await wait(500);
  return true;
}
/**
 * Trascinamento finto (eventi drag del browser, il mouse vero di puppeteer non li fa): parte da `from`, entra e resta sopra
 * l'elemento n di `to`. Il rilascio non c'è: la foto è a metà, con la carta fantasma e il posto evidenziato.
 */
async function dragOver(p: Page, from: string, to: string, n = 0): Promise<boolean> {
  const ok = await p.evaluate((f, t, i) => {
    const src = document.querySelector<HTMLElement>(f);
    const dst = document.querySelectorAll<HTMLElement>(t)[i];
    if (!src || !dst) return false;
    const dt = new DataTransfer();
    const a = src.getBoundingClientRect();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: a.x + a.width / 2, clientY: a.y + a.height / 2 }));
    return true;
  }, from, to, n);
  if (!ok) return false;
  await wait(200);
  await p.evaluate((t, i) => {
    const dst = document.querySelectorAll<HTMLElement>(t)[i];
    const b = dst.getBoundingClientRect();
    for (const type of ['dragenter', 'dragover', 'dragover']) dst.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: b.x + b.width / 3, clientY: b.y + b.height / 2 }));
    document.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: b.x + b.width / 3, clientY: b.y + b.height / 2 }));
  }, to, n);
  await wait(400);
  return true;
}
/** Telefono e tablet: tocco lungo (oltre i 450 ms del menu del membro) al centro dell'elemento. */
async function longPress(p: Page, selector: string): Promise<boolean> {
  const el = await p.$(selector);
  const b = await el?.boundingBox();
  if (!b) return false;
  await p.touchscreen.touchStart(b.x + b.width / 2, b.y + b.height / 3);
  await wait(700);
  await p.touchscreen.touchEnd();
  await wait(400);
  return true;
}
/** Apre la finestra con un Eevee che sbircia (Come funziona il voto) e clicca Eevee dov'è ora. */
async function eeveeClick(p: Page, selector = '.eevee-peek .peek-head'): Promise<boolean | string> {
  if (!await p.$('.help-frame.with-peek')) { const ok = await ratingHelp(p); if (ok !== true) return ok; await wait(900); }
  const el = await p.$(selector);
  if (!el) return `no ${selector}`;
  await el.click();
  return true;
}
const editorOf = async (p: Page, name: RegExp) => { if (!await clickText(p, '.slot.filled > .slot-card', name)) return false; await wait(600); return true; };
const openSetMenu = async (p: Page) => { if (!await editorOf(p, /Great Tusk/)) return 'no card'; if (!await clickText(p, '.slot.open button.set-menu-button', /./)) return 'no set button'; await wait(300); return true; };
// I miei set di Great Tusk (memoria del browser): uno uguale al set del team, gli altri con una mossa diversa
const MY_SET = (name: string, move: string) => ({ name, set: { ...TEAM[0], moves: [...TEAM[0].moves.slice(0, 3), move] } });
const LISTS = (lists: unknown) => ({ 'dreamdex.lists': JSON.stringify(lists) });
const SAVED = { 'dreamdex.savedTeams': JSON.stringify([{ name: 'Pioggia NatDex', text: 'Pelipper', choice: COMPETITIVE }, { name: 'Sole', text: 'Torkoal' }]),
  'dreamdex.currentSaved': JSON.stringify({ name: 'Pioggia NatDex', text: 'Pelipper' }) };
const openSaved = async (p: Page) => { await p.evaluate(() => (document.querySelector('.team-head details.saved-menu > summary') as HTMLElement | null)?.click()); await wait(400); return !!await p.$('details.saved-menu[open]') || 'no saved menu'; };
const openFormat = async (p: Page) => { await p.click('.rail-format'); await wait(500); };
const pickFamily = (p: Page, family: string) => p.evaluate(f => { const el = document.querySelector<HTMLInputElement>(`input[name="format-family"][value="${f}"]`); el?.click(); return !!el; }, family);

// Campo Psichico (Tapu Lele) con chi lo sfrutta: il tooltip di quella condizione
const PSYCHIC = [
  member('Tapu Lele', 'Choice Specs', 'Psychic Surge', ['Psychic', 'Moonblast', 'Focus Blast', 'Psyshock'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Indeedee', 'Life Orb', 'Psychic Surge', ['Expanding Force', 'Dazzling Gleam', 'Shadow Ball', 'Calm Mind'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  ...TEAM.slice(0, 3),
];
const RARE_STATES: Record<string, State> = {
  // Finestre della barra a sinistra: Crediti e Segnala o suggerisci (senza la chiave di Web3Forms nella build solo GitHub)
  credits: { only: 'desktop', run: async p => { const ok = await clickText(p, '.rail-links .rail-credits', /^(Crediti|Credits)$/); await wait(600); return ok; } },
  feedback: { only: 'desktop', run: async p => { const ok = await clickText(p, '.rail-links .rail-credits', /Segnala|Report/); await wait(600); return ok; } },
  // Il modulo pieno e l'invio: serve una build con VITE_WEB3FORMS_KEY (qualsiasi valore); la risposta del servizio è finta
  ...Object.fromEntries(([['feedback-sent', true], ['feedback-error', false]] as const).map(([key, success]) => [key, { only: 'desktop', run: async (p: Page) => {
    await p.setRequestInterception(true);
    p.on('request', r => { if (r.url().includes('web3forms')) void r.respond({ status: success ? 200 : 500, contentType: 'application/json', body: JSON.stringify({ success }) }); else void r.continue(); });
    if (!await clickText(p, '.rail-links .rail-credits', /Segnala|Report/)) return 'no feedback button';
    await wait(500);
    if (!await p.$('.feedback-kinds')) return 'build without VITE_WEB3FORMS_KEY: no form';
    await typeInto(p, '.feedback-dialog textarea', 'Il voto di questo team mi sembra basso.');
    if (!await clickText(p, '.feedback-actions button[type="submit"]', /./)) return 'no send';
    await wait(800);
    return true;
  } } as State])),
  'feedback-form': { only: 'desktop', run: async p => {
    if (!await clickText(p, '.rail-links .rail-credits', /Segnala|Report/)) return 'no feedback button';
    await wait(500);
    return (!!await p.$('.feedback-kinds')) || 'build without VITE_WEB3FORMS_KEY: no form';
  } },
  // Avvisi senza Annulla: team copiato per Showdown (col voto) e un Pokémon già nel team cercato e aggiunto con Invio
  'toast-done': { only: 'desktop', run: async p => {
    await fakeClipboard(p);
    if (!await clickText(p, '.team-head .export-main', /./)) return 'no export';
    await wait(500);
    return (!!await p.$('.done-toast')) || 'no toast';
  } },
  'toast-already': { run: async p => {
    await tab(p, 'pokemon');
    await wait(800);
    if (!await typeInto(p, '.suggestions-panel .search input', 'Kingambit', true)) return 'no search';
    return (!!await p.$('.done-toast')) || 'no toast';
  } },
  // Ricerca nella lista: il suggerimento di Invio dentro il campo, e una ricerca che non trova niente (Eevee pensieroso)
  'search-hint': { run: async p => { await tab(p, 'pokemon'); await wait(800); return typeInto(p, '.suggestions-panel .search input', 'Garch'); } },
  'search-empty': { run: async p => { await tab(p, 'pokemon'); await wait(800); return typeInto(p, '.suggestions-panel .search input', 'zzzz'); } },
  // Bannati nascosti dalla lista: il pulsante ⊘ N nella fascia "Candidati"; premuto, i bannati tornano col segno ⊘
  'pokemon-bans': { storage: LISTS({ byFormat: { ou: { favorites: [], bans: ['Victini', 'Latios', 'Latias', 'Cresselia', 'Ting-Lu'] } } }), run: async p => { await tab(p, 'pokemon'); await wait(1500); return (!!await p.$('.ban-pill')) || 'no ban pill'; } },
  'pokemon-bans-shown': { storage: LISTS({ byFormat: { ou: { favorites: [], bans: ['Victini', 'Latios', 'Latias', 'Cresselia', 'Ting-Lu'] } } }), run: async p => { await tab(p, 'pokemon'); await wait(1500); const ok = await clickText(p, '.ban-pill', /./); await wait(1200); return ok; } },
  // Legenda dei segni delle carte (il "?" accanto a Candidati) e il menu Tipo di team aperto
  'sym-legend': { run: async p => { await tab(p, 'pokemon'); await wait(800); const ok = await clickText(p, '.sym-legend .help-button', /./); await wait(300); return ok; } },
  'team-type-menu': { run: async p => { await tab(p, 'pokemon'); await wait(800); const ok = await clickText(p, '.tt-trigger', /./); await wait(400); return ok || 'no team type'; } },
  // Gioco Scarlatto/Violetto: il segno delle esclusive sulle carte e nel dettaglio
  'pokemon-game': { hash: hashChoice(TEAM.slice(0, 3), SV), run: async p => { await tab(p, 'pokemon'); await wait(1500); return true; } },
  // Team salvati: il team caricato è cambiato (pallino sulla targa, riga "non salvato" e Aggiorna nel menu); salva con un
  // nome che c'è già (la finestra di conferma)
  'saved-changed': { storage: SAVED, run: async p => openSaved(p) },
  'saved-plate': { storage: SAVED },
  'saved-overwrite': { storage: SAVED, run: async p => {
    if (await openSaved(p) !== true) return 'no saved menu';
    if (!await typeInto(p, '.saved-new input', 'Sole')) return 'no name field';
    if (!await clickText(p, '.saved-new button', /./)) return 'no save';
    await wait(500);
    return (!!await p.$('.confirm-dialog')) || 'no confirm';
  } },
  // Importa un set con una mossa che non impara: la domanda su Custom Skillset
  'import-review': { run: async p => {
    if (!await clickText(p, 'details.popover > summary', /Import/)) return 'no import';
    await wait(300);
    const area = await p.$('.import-panel textarea');
    if (!area) return 'no text box';
    await area.type('Great Tusk @ Booster Energy\nAbility: Protosynthesis\n- Flamethrower\n- Headlong Rush\n');
    if (!await clickText(p, '.import-panel button.apply', /./)) return 'no import button';
    await wait(600);
    return (!!await p.$('.import-dialog')) || 'no review';
  } },
  // Finestra del formato: Libero con la Gen 1 (nota, generazioni, scheda cambiata, membri non ammessi) e il gioco
  'format-free': { run: async p => {
    await openFormat(p);
    if (!await pickFamily(p, 'free')) return 'no free family';
    await wait(300);
    if (!await p.evaluate(() => { const el = document.querySelector<HTMLInputElement>('.format-gens input[value="1"]'); el?.click(); return !!el; })) return 'no gens';
    await wait(400);
    return true;
  } },
  'format-game': { hash: hash(USER), run: async p => { await openFormat(p); const ok = await pickFamily(p, 'game'); await wait(400); return ok || 'no game family'; } },
  // Il logo della fonte che non si carica: al suo posto il nome
  'format-logo-missing': { run: async p => {
    await p.setRequestInterception(true);
    p.on('request', r => { if (/formats\/[^/]+\.(svg|png|webp)/.test(r.url())) void r.abort(); else void r.continue(); });
    await openFormat(p);
    await wait(500);
    return true;
  } },
  // Cambio di formato coi dati che non arrivano ancora (richieste ferme): la riga "Caricamento…" in cima
  'format-loading': { run: async p => {
    await p.setRequestInterception(true);
    p.on('request', r => { if (/(stats|sets|presets|meta|teams)[-.]/.test(r.url())) return; void r.continue(); });
    await openFormat(p);
    if (!await p.evaluate(() => { const el = document.querySelector<HTMLInputElement>('input[name="format-gen"][value="9"]'); el?.click(); return !!el; })) return 'no gen 9';
    await wait(300);
    await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('.fmt-actions button')].at(-1); b?.click(); });
    await wait(800);
    return (!!await p.$('.banner')) || 'no banner';
  } },
  // Menu Set: "Salva come…" aperto (nome e Salva), I miei set con righe (rinomina, elimina), vuoti, pieni (5: la nota)
  'set-menu-save': { storage: { 'dreamdex.mySets': JSON.stringify({ 'Great Tusk': [MY_SET('Mio', 'Bulk Up'), MY_SET('Veloce', 'Rapid Spin')] }) }, run: async p => {
    const ok = await openSetMenu(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.slot.open .set-menu-foot button', /Salva come|Save as/)) return 'no save as';
    await wait(400);
    return true;
  } },
  'set-menu-mine-empty': { run: async p => {
    const ok = await openSetMenu(p);
    if (ok !== true) return ok;
    const done = await clickText(p, '.slot.open .set-menu-tabs [role="tab"]', /I miei set|My sets/);
    await wait(300);
    return done;
  } },
  'set-menu-full': { storage: { 'dreamdex.mySets': JSON.stringify({ 'Great Tusk': ['Close Combat', 'Stone Edge', 'Earthquake', 'Knock Off', 'Ice Spinner'].map((m, i) => MY_SET(`Set ${i + 1}`, m)) }) }, run: async p => {
    const ok = await openSetMenu(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.slot.open .set-menu-foot button', /Salva come|Save as/)) return 'no save as';
    await wait(400);
    return true;
  } },
  // Eevee che sbircia (Come funziona il voto): cliccato in alto fa il saltello (fermato a metà); poi riappare di lato
  // (Math.random fisso: la faccia), cliccato rientra (fermato a metà); o solo la coda da un lato
  'eevee-hop': { only: 'desktop', run: async p => { const ok = await ratingHelp(p); if (ok !== true) return ok; await wait(900); await slowTime(p); const c = await eeveeClick(p); await wait(200); await pauseAnims(p); return c; } },
  'eevee-side': { only: 'desktop', run: async p => {
    await fixRandom(p, 0.1);
    const c = await eeveeClick(p);
    if (c !== true) return c;
    await wait(4500);
    return (!!await p.$('.eevee-peek.at-side')) || 'no side peek';
  } },
  'eevee-retreat': { only: 'desktop', run: async p => {
    await fixRandom(p, 0.1);
    const c = await eeveeClick(p);
    if (c !== true) return c;
    await wait(4500);
    await slowTime(p);
    const r = await eeveeClick(p, '.eevee-peek.at-side .peek-head');
    await wait(150);
    await pauseAnims(p);
    return r;
  } },
  'eevee-tail': { only: 'desktop', run: async p => {
    await fixRandom(p, 0.9);
    const c = await eeveeClick(p);
    if (c !== true) return c;
    await wait(4500);
    return (!!await p.$('.eevee-tail-peek')) || 'no tail';
  } },
  // Chiusura animata di una finestra (la copia che si spegne), fermata a metà
  'modal-closing': { run: async p => {
    const ok = await ratingHelp(p);
    if (ok !== true) return ok;
    await wait(900);
    await slowTime(p);
    if (!await clickText(p, '.help-dialog .help-close', /./)) return 'no close';
    await wait(250);
    await pauseAnims(p);
    return (!!await p.$('.help-backdrop.closing')) || 'no closing copy';
  } },
  // Liste: menu Ordine, scelta della lista, lista nuova (il campo del nome), menu ⋯, liste espanse, ricerca col suggerimento
  'lists-order': { run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.dex-order-pick', /./); await wait(300); return ok; } },
  'lists-pick': { run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.lists-pick', /./); await wait(300); return ok; } },
  'lists-new': { run: async p => {
    await tab(p, 'lists');
    await wait(500);
    if (!await clickText(p, '.lists-pick', /./)) return 'no picker';
    await wait(300);
    const ok = await clickText(p, '.lists-menu-item.new', /./);
    await wait(300);
    return ok;
  } },
  'lists-more': { run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.lists-more', /./); await wait(300); return ok; } },
  'lists-expanded': { only: 'desktop', run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.lists-expand', /./); await wait(500); return ok; } },
  'lists-expanded-full': { only: 'desktop', storage: LISTS({ universal: { favorites: ['Garchomp', 'Toxapex'], bans: [] }, byFormat: { ou: { favorites: ['Great Tusk', 'Kingambit'], bans: ['Toxapex', 'Magikarp'] } } }), run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.lists-expand', /./); await wait(500); return ok; } },
  'lists-search': { run: async p => { await tab(p, 'lists'); await wait(500); return typeInto(p, '.lists-bar .search-field input', 'Garch'); } },
  // Preferito per tutti i formati e bannato in questo: il segno del globo (e della lista che vince) sull'icona
  'lists-universal': { storage: LISTS({ universal: { favorites: ['Garchomp', 'Toxapex'], bans: [] }, byFormat: { ou: { favorites: ['Great Tusk'], bans: ['Toxapex'] } } }), run: async p => { await tab(p, 'lists'); await wait(500); return true; } },
  // Trascinamento di un Preferito verso i Bannati: la lista di partenza col posto sollevato, l'altra che accoglie
  'lists-drag': { only: 'desktop', storage: LISTS({ byFormat: { ou: { favorites: ['Great Tusk', 'Kingambit', 'Gholdengo'], bans: ['Magikarp'] } } }), run: async p => {
    await tab(p, 'lists');
    await wait(500);
    return dragOver(p, '.lbox.favorites .lslot-mon', '.lbox.bans');
  } },
  // Telefono e tablet: il foglio di una lista vuota, e il foglio che si chiude (fermato a metà)
  'lists-sheet-empty': { only: 'small', run: async p => { await tab(p, 'lists'); await wait(500); const ok = await clickText(p, '.lists-tab.favorites', /./); await wait(600); return ok; } },
  'lists-sheet-closing': { only: 'small', run: async p => {
    await tab(p, 'lists');
    await wait(500);
    if (!await clickText(p, '.lists-tab.favorites', /./)) return 'no list button';
    await wait(700);
    await slowTime(p);
    if (!await clickText(p, '.lists-sheet-back', /./)) return 'no back';
    await wait(150);
    await pauseAnims(p);
    return (!!await p.$('.lists-sheet.closing')) || 'no closing';
  } },
  // Telefono e tablet: il foglio del candidato e quello della Meta che si chiudono (fermati a metà)
  'pokemon-sheet-closing': { only: 'small', run: async p => {
    await tab(p, 'pokemon');
    await wait(1500);
    const picks = await p.$$('.suggestions .pick');
    await picks[1]?.evaluate(el => (el as HTMLElement).click());
    await wait(700);
    await slowTime(p);
    if (!await clickText(p, '.sheet-back', /./) && !await clickText(p, '.sheet-scrim', /./)) return 'no back';
    await wait(150);
    await pauseAnims(p);
    return (!!await p.$('.picker.sheet-closing')) || 'no closing';
  } },
  'meta-sheet-closing': { only: 'small', hash: hash(SIX), run: async p => {
    await tab(p, 'meta');
    await wait(800);
    const cards = await p.$$('.meta-card');
    await cards[3]?.evaluate(el => (el as HTMLElement).click());
    await wait(700);
    await slowTime(p);
    await p.keyboard.press('Escape');
    await wait(150);
    await pauseAnims(p);
    return (!!await p.$('.meta-tab.sheet-closing')) || 'no closing';
  } },
  // Telefono e tablet: tocco lungo su una carta del team, il menu del membro
  'member-menu': { only: 'small', run: async p => { await tab(p, 'pokemon'); await wait(500); const ok = await longPress(p, '.slot.filled > .slot-card'); return ok && ((!!await p.$('.member-menu')) || 'no menu'); } },
  // Computer: una carta del team trascinata su un'altra (la carta fantasma, il posto vuoto, quella che si fa da parte) e un
  // candidato trascinato dalla lista sul posto libero
  'team-drag': { only: 'desktop', run: async p => { await tab(p, 'pokemon'); await wait(500); return dragOver(p, '.slot.filled > .slot-card', '.slot.filled > .slot-card', 2); } },
  'team-drag-candidate': { only: 'desktop', run: async p => { await tab(p, 'pokemon'); await wait(1500); return dragOver(p, '.suggestions.cards > li.card [draggable="true"], .suggestions.cards > li.card', '.slot.empty'); } },
  // Voto mentre si modifica un membro (un altro set dal menu Set): "da N ±M" sotto il voto; chiuso l'editor resta un attimo
  // (fermato)
  'grade-delta-live': { run: async p => changeSet(p) },
  'grade-delta-flash': { run: async p => {
    const ok = await changeSet(p);
    if (ok !== true) return ok;
    await slowTime(p);
    if (!await clickText(p, '.slot.open .editor-close', /./)) return 'no close';
    await wait(600);
    return (!!await p.$('.grade-delta.flash')) || 'no flash';
  } },
  // Schermo basso (1366x657): con l'editor aperto il team si riduce da solo, il cambio sta nella striscia del voto
  'grade-delta-short': { only: 'desktop', run: async p => changeSet(p) },
  // Tablet: la freccetta della carta del voto aperta (le righe delle aree sotto)
  'grade-areas-open': { only: 'small', run: async p => { await tab(p, 'pokemon'); await wait(400); const ok = await clickText(p, '.grade-fold', /./); await wait(400); return ok || 'no fold'; } },
  // Tooltip DreamDex: una mossa dell'editor, una condizione del Riassunto (pioggia, poi altri meteo e campi), una minaccia
  'move-tip': { only: 'desktop', run: async p => {
    if (!await editorOf(p, /Great Tusk/)) return 'no card';
    const el = await p.$('.slot.open [data-move-tip]');
    if (!el) return 'no move';
    await el.hover();
    await wait(700);
    return (!!await p.$('.mtip-stats')) || 'no move tip';
  } },
  ...Object.fromEntries(([['rain', RAIN, /Pioggia/], ['sand', WEATHERS, /Sabbia/], ['electric', WEATHERS, /Elettrico/], ['grassy', WEATHERS, /Erboso/],
    ['sun', WEATHERS_CORES, /Sole/], ['misty', WEATHERS_CORES, /Nebbioso/], ['snow', FIELD, /Neve/], ['psychic', PSYCHIC, /Psichico/]] as const).map(([key, team, re]) => [`cond-tip-${key}`, { hash: hash([...team]), only: 'desktop', run: async (p: Page) => {
    await tab(p, 'analysis');
    await wait(800);
    // La riga della condizione dal suo nome (aria-label: chi la porta, la condizione, chi ne approfitta)
    let line = null;
    for (const el of await p.$$('.dash-summary .sum-line')) if (re.test(await el.evaluate(e => e.getAttribute('aria-label') ?? ''))) { line = el; break; }
    if (!line) return `no condition ${re.source}`;
    await line.hover();
    await wait(600);
    return (!!await p.$('.ctip-cells')) || 'no condition tip';
  } } as State])),
  'threat-tip': { hash: hash(SIX), only: 'desktop', run: async p => {
    await tab(p, 'analysis');
    await wait(800);
    await clickText(p, '.dash-coverage [role="tab"]', /^Meta$/);
    await wait(400);
    const tile = await p.$('.dash-coverage .cov-tile:not(.more)');
    if (!tile) return 'no threat tile';
    await tile.hover();
    await wait(600);
    return (!!await p.$('.thr-tip-why')) || 'no threat tip';
  } },
  // Sfida: le impostazioni dell'avversario aperte (set, strumento, EV) con un EV cambiato (Torna al set)
  'duel-settings': { only: 'desktop', run: async p => {
    const ok = await STATES['editor-duel'].run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.slot.open .duel-settings', /./)) return 'no settings';
    await wait(400);
    const ev = await p.$('.duel-settings-pop .duel-ev input');
    if (!ev) return 'no ev';
    await ev.click({ count: 3 });
    await ev.type('100');
    await wait(500);
    return true;
  } },
  // Sfida: i consigli che si calcolano (il calcolo fermato), e la riga del meta di un consiglio col suo elenco (tooltip col
  // mouse, sotto la riga col dito)
  'duel-tip-busy': { run: async p => {
    await holdWorker(p, 'duelTips');
    const ok = await STATES['editor-duel'].run!(p);
    if (ok !== true) return ok;
    const chip = await p.$('.slot.open .duel-tip-chip:not(.out)');
    if (!chip) return 'no tip';
    await chip.click();
    await wait(500);
    return (!!await p.$('.duel-tip-busy')) || 'no busy';
  } },
  'duel-tip-fx': { run: async p => {
    const ok = await STATES['editor-duel-tip'].run!(p);
    if (ok !== true) return ok;
    const count = await p.$('.duel-tip-card .duel-tip-count');
    if (!count) return 'no meta line';
    if (await p.evaluate(() => matchMedia('(hover: hover)').matches)) await count.hover(); else await count.click();
    await wait(600);
    return true;
  } },
  // Migliora i set: la finestra mentre calcola (il calcolo fermato) e quella di un team da torneo, dove non cambia niente
  'improve-busy': { hash: hash(SIX), run: async p => {
    await holdWorker(p, 'improve');
    await p.evaluate(() => (document.querySelector('.team-guide') as HTMLElement | null)?.click());
    // La finestra arriva quando la pagina finisce di preparare la lista dei candidati
    return p.waitForSelector('.improve-busy', { timeout: 10000 }).then(() => true, () => 'no busy');
  } },
  // (applicati i cambi proposti, riaperta: non c'è più niente da cambiare)
  'improve-none': { hash: hash(CLEAR), run: async p => {
    for (let round = 0; round < 3; round++) {
      await p.evaluate(() => (document.querySelector('.team-guide') as HTMLElement | null)?.click());
      await p.waitForSelector('.improve-none, .apply.primary:not([disabled])', { timeout: 20000 });
      await wait(300);
      if (await p.$('.improve-none')) return true;
      await p.click('.apply.primary');
      await wait(1500);
    }
    return 'some set changes';
  } },
  // Filtri: una ricerca che non trova niente, poi la finestra dei filtri (zero risultati); un filtro acceso (Azzera)
  'filters-none': { run: async p => {
    await tab(p, 'pokemon');
    await wait(800);
    if (!await typeInto(p, '.suggestions-panel .search input', 'zzzz')) return 'no search';
    const ok = await clickText(p, '.toolbar .filters-trigger', /./);
    await wait(500);
    return ok;
  } },
  // Liste: un filtro acceso, chiusa la finestra resta Azzera accanto a Filtri
  'filters-reset': { run: async p => {
    await tab(p, 'lists');
    await wait(500);
    if (!await clickText(p, '.lists-panel .filters-trigger', /./)) return 'no filters';
    await wait(400);
    await p.evaluate(() => (document.querySelector('.filters-dialog [role="group"] button') as HTMLElement | null)?.click());
    await wait(300);
    await p.keyboard.press('Escape');
    await wait(500);
    return (!!await p.$('.filters-reset')) || 'no reset';
  } },
  // Completa team coi Preferiti e i Bannati dell'utente (♥ sui Pokémon proposti, la nota dei bannati esclusi)
  'fill-lists': { hash: hash(TEAM.slice(0, 3)), storage: LISTS({ byFormat: { ou: { favorites: FAVS, bans: ['Victini', 'Latios', 'Latias'] } } }), run: async p => { await openFill(p); await wait(6000); return true; } },
  // La carta del membro (tooltip) col team ridotto, sul membro con una mossa che non impara (gli avvisi in cima) e su un
  // membro senza mosse
  'card-tip-alert': { hash: hash(MOVE), only: 'desktop', run: async p => {
    await tab(p, 'pokemon');
    if (!await clickText(p, 'button.band-toggle', /./)) return 'no band toggle';
    await wait(600);
    const card = await p.$('.slot.filled > .slot-card');
    if (!card) return 'no card';
    await card.hover();
    await wait(1200);
    return (!!await p.$('.mcard-alerts')) || 'no alerts';
  } },
  'card-tip-nomoves': { hash: hash([{ ...TEAM[0], moves: [] }, ...TEAM.slice(1)]), only: 'desktop', run: async p => {
    await tab(p, 'pokemon');
    const sprite = await p.$('.slot.filled .sprite-wrap');
    if (!sprite) return 'no sprite';
    await sprite.hover();
    await wait(1200);
    return (!!await p.$('.mcard-none')) || 'no card tip';
  } },
  // Editor di un membro col soprannome (la specie piccola sopra) e col nome in modifica
  'editor-nickname': { hash: hash([{ ...TEAM[0], name: 'Zannone' }, ...TEAM.slice(1)]), run: async p => editorOf(p, /Zannone/) },
  'editor-naming': { run: async p => {
    if (!await editorOf(p, /Great Tusk/)) return 'no card';
    const ok = await clickText(p, '.slot.open .nickname', /./);
    await wait(300);
    return ok;
  } },
  // Telefono: l'editor scorso in giù (la testata si accorcia) e un dito che lo trascina di lato (cambio di scheda a metà)
  'editor-shrunk': { only: 'small', run: async p => {
    if (!await editorOf(p, /Great Tusk/)) return 'no card';
    await editorTab(p, /^(Statistiche|Stats)$/);
    await p.evaluate(() => { const d = document.querySelector('.slot.open .drawer'); if (d) d.scrollTop = 400; d?.dispatchEvent(new Event('scroll')); });
    await wait(500);
    return (!!await p.$('.drawer.shrunk')) || 'no shrink';
  } },
  'editor-swiping': { only: 'small', run: async p => {
    if (!await editorOf(p, /Great Tusk/)) return 'no card';
    const box = await (await p.$('.slot.open .drawer'))?.boundingBox();
    if (!box) return 'no drawer';
    const y = box.y + Math.min(box.height / 2, 300);
    await p.touchscreen.touchStart(box.x + box.width / 2, y);
    await p.touchscreen.touchMove(box.x + box.width / 2 - 30, y + 2);
    await p.touchscreen.touchMove(box.x + box.width / 2 - 80, y + 4);
    await wait(300);
    return (!!await p.$('.swiping')) || 'no swipe';
  } },
  // Col dito: tocco lungo su un pulsante con la spiegazione, la spiegazione in un foglio
  'touch-tip': { only: 'small', run: async p => {
    await tab(p, 'pokemon');
    await wait(800);
    const sel = await p.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>('[data-hint]')].find(e => e.dataset.hint && e.getClientRects().length && !e.closest('[data-own-hold], input') && e.getBoundingClientRect().top > 0 && e.getBoundingClientRect().bottom < innerHeight);
      if (!el) return null;
      el.setAttribute('data-touch-probe', '');
      return '[data-touch-probe]';
    });
    if (!sel || !await longPress(p, sel)) return 'no hint';
    return (!!await p.$('.tip-sheet, .ftip[data-tip-sheet]')) || 'no tip sheet';
  } },
  // Coaching: il set copiato dalla carta grande, le alternative scorse a destra, l'elenco di chi resta senza risposta
  'coaching-copy': { hash: hash(SIX), run: async p => {
    if (!await coachingReady(p)) return 'no coaching';
    await fakeClipboard(p);
    const ok = await clickText(p, '.coach-hero .coach-copy', /./);
    await wait(300);
    return ok || 'no copy';
  } },
  'coaching-alts-scrolled': { hash: hash(SIX), run: async p => {
    if (!await coachingReady(p)) return 'no coaching';
    const ok = await p.evaluate(() => { const el = document.querySelector<HTMLElement>('.coach-alts'); if (!el || el.scrollWidth <= el.clientWidth) return false; el.scrollLeft = el.scrollWidth; el.dispatchEvent(new Event('scroll')); return true; });
    await wait(400);
    return ok || 'alternatives fit';
  } },
  // (LONE: dei problemi restano senza proposta, il pulsante sotto la classifica ne apre l'elenco)
  'coaching-stuck': { hash: hash(LONE), run: async p => {
    if (!await coachingReady(p)) return 'no coaching';
    const ok = await clickText(p, '.coach-rank-stuck', /./);
    await wait(300);
    return ok || 'nothing stuck';
  } },
  // Menu Set › Salva come… col nome di un altro dei miei set: il pulsante diventa Sovrascrivi
  'set-menu-overwrite': { storage: { 'dreamdex.mySets': JSON.stringify({ 'Great Tusk': [MY_SET('Mio', 'Bulk Up'), MY_SET('Veloce', 'Rapid Spin')] }) }, run: async p => {
    const ok = await openSetMenu(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.slot.open .set-menu-foot button', /Salva come|Save as/)) return 'no save as';
    await wait(300);
    await typeInto(p, '.slot.open .set-menu-save input', 'Veloce');
    return (!!await p.$('.save-set.overwrite')) || 'no overwrite';
  } },
  // La coda di Eevee cliccata (si ritira di scatto, fermata a metà)
  'eevee-found': { only: 'desktop', run: async p => {
    await fixRandom(p, 0.9);
    const c = await eeveeClick(p);
    if (c !== true) return c;
    await wait(4500);
    await slowTime(p);
    const r = await eeveeClick(p, '.eevee-tail-peek img');
    await wait(100);
    await pauseAnims(p);
    return r;
  } },
  // Un membro con Custom Skillset (il lucchetto aperto nell'angolo della carta) e il tooltip di una mossa con priorità
  'slot-custom': { hash: hash([{ ...MOVE[0], customSkillset: true }, ...TEAM.slice(1)]) },
  'move-tip-priority': { only: 'desktop', run: async p => {
    if (!await editorOf(p, /Kingambit/)) return 'no card';
    let pill = null;
    for (const el of await p.$$('.slot.open [data-move-tip]')) if (/Sucker Punch|Sbigoattacco/.test(await el.evaluate(e => `${e.getAttribute('data-move-tip')} ${e.textContent}`))) { pill = el; break; }
    if (!pill) return 'no Sucker Punch';
    await pill.hover();
    await wait(700);
    return (!!await p.$('.mtip-prio')) || 'no priority';
  } },
  // Team salvati: il salvataggio che non riesce (memoria del browser piena: setItem fallisce)
  'saved-failed': { storage: SAVED, run: async p => {
    await p.evaluate(`(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'dreamdex.savedTeams') throw new Error('QuotaExceededError'); return set.call(this, k, v); }; })()`);
    if (await openSaved(p) !== true) return 'no saved menu';
    if (!await typeInto(p, '.saved-new input', 'Nuovo', true)) return 'no name field';
    return (!!await p.$('.saved-panel .errors')) || 'no error';
  } },
  // Sfida: l'elenco degli avversari aperto (le minacce del meta col giudizio), un avversario femmina (il simbolo), e Toxapex
  // con sole mosse di stato (nessuna mossa che fa danno)
  'duel-species-menu': { run: async p => {
    if (!await editorOf(p, /Great Tusk/)) return 'no card';
    await editorTab(p, /^(Sfida|Matchup)$/);
    const input = await p.$('.slot.open .duel-species input');
    if (!input) return 'no duel';
    await input.click();
    await wait(600);
    return (!!await p.$('.duel-verdict-chip')) || 'no menu';
  } },
  'duel-female': { run: async p => duelWith(p, /Great Tusk/, 'Hatterene') },
  'duel-none': { hash: hash([TEAM[0], TEAM[1], { ...TEAM[2], moves: ['Haze', 'Recover', 'Toxic Spikes', 'Protect'] }]), run: async p => duelWith(p, /Toxapex/, 'Gholdengo') },
  // Analisi con altri team: Coverage tipi dell'Offesa coi tipi che nessuno colpisce (team di soli draghi), Recupero col
  // recupero dimezzato di chi regge poco (Salamence e Dragonite con Roost)
  'analysis-offense-types-lone': { ...offenseState(OFFENSE_SUBS.types), hash: hash(LONE) },
  'analysis-defense-sustain-lone': defenseState(SUBS.sustain, { team: LONE }),
  // Meta, la scheda di un Pokémon: il primo che nessuno regge o manda KO (team di soli draghi), il primo con un compagno
  // fuori dai 40 (senza link)
  'meta-nobody': { hash: hash(LONE), run: async p => metaCardWith(p, '.mvs-none') },
  'meta-mate-off': { hash: hash(SIX), run: async p => metaCardWith(p, '.meta-mate-off') },
  // Coaching di un team debole (due membri): minacce del meta scoperte da tutti e due i lati, le pillole col Pokémon
  'coaching-threats': { hash: hash([STRESS[3], STRESS[2]]), run: async p => {
    if (!await coachingReady(p)) return 'no coaching';
    return (!!await p.$('.coach-prob-text.is-threat')) || 'no threat problem';
  } },
  // Coaching: il piano intero applicato (l'avviso con Annulla del piano)
  'coaching-plan': { hash: hash(LONG), run: async p => {
    if (!await coachingReady(p)) return 'no coaching';
    if (!await clickText(p, '.coach-plan-apply', /./)) return 'no plan';
    await wait(800);
    return (!!await p.$('.undo-toast.is-plan')) || 'no plan toast';
  } },
};
/** Il calcolo del worker di quel tipo non parte mai (es. 'improve', 'duelTips'): la finestra resta su "sto calcolando". */
const holdWorker = (p: Page, kind: string) => p.evaluate(`(() => { const post = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, ...rest) { if (m && m.kind === '${kind}') return; return post.call(this, m, ...rest); }; })()`);
/** Meta: apre una carta dopo l'altra finché nella scheda compare `selector` (sul telefono e sul tablet la scheda sale sopra). */
async function metaCardWith(p: Page, selector: string): Promise<boolean | string> {
  await tab(p, 'meta');
  await wait(800);
  const count = (await p.$$('.meta-card')).length;
  for (let i = 0; i < count; i++) {
    if (await p.$(selector)) return true;
    await p.evaluate(n => { document.querySelectorAll<HTMLElement>('.meta-card')[n]?.click(); }, i);
    await wait(250);
    if (await p.$(selector)) return true;
    // Telefono e tablet: la scheda è un foglio, si chiude prima della carta dopo
    if (await p.$('.meta-tab.sheet-open')) { await p.keyboard.press('Escape'); await wait(400); }
  }
  return `no ${selector}`;
}
/** Editor del membro, scheda Sfida, l'avversario scelto per nome. */
async function duelWith(p: Page, who: RegExp, opp: string): Promise<boolean | string> {
  if (!await editorOf(p, who)) return 'no card';
  await editorTab(p, /^(Sfida|Matchup)$/);
  const input = await p.$('.slot.open .duel-species input');
  if (!input) return 'no duel';
  await input.click({ count: 3 });
  await input.type(opp);
  await wait(600);
  const picked = await p.evaluate((name: string) => {
    const option = [...document.querySelectorAll<HTMLElement>('.slot.open .duel-species [role="option"]')].find(o => (o.textContent ?? '').includes(name));
    option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option?.click();
    return !!option;
  }, opp);
  await wait(1200);
  return picked || 'no option';
}
/** Analisi › Coaching coi consigli pronti. */
async function coachingReady(p: Page): Promise<boolean> {
  await tab(p, 'analysis');
  await wait(300);
  if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
  await p.waitForSelector('.coach-diag-list:not([aria-busy]), .coach-empty', { timeout: 20000 });
  await wait(300);
  return true;
}
/** Editor del primo membro, un altro set dal menu Set: il voto cambia mentre l'editor è aperto. */
async function changeSet(p: Page): Promise<boolean | string> {
  for (const name of [/Iron Valiant/, /Kingambit/, /Great Tusk/]) {
    if (!await editorOf(p, name)) return 'no card';
    if (!await clickText(p, '.slot.open .set-menu-button', /./)) return 'no set button';
    await wait(300);
    const rows = await p.$$('.slot.open .set-menu-row:not(.current)');
    if (!rows.length) return 'no other set';
    await rows[rows.length - 1].click();
    await wait(1500);
    if (await p.$('.grade-delta')) return true;
  }
  return 'grade did not change';
}
Object.assign(STATES, RARE_STATES);
// Il controllo del testo (--scan) come stringa: dentro page.evaluate niente funzioni con nome (tsx aggiunge __name)
const SCAN_TEXT = `(() => {
  const parse = s => { const n = (s.match(/[\\d.]+/g) || []).map(Number); if (s.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1]; return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const blend = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } } let base = [16, 18, 25, 1]; for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base); return base; };
  const out = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || el.closest('.visually-hidden, script, style')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.02) continue;
    const fs = parseFloat(cs.fontSize);
    const bg = bgOf(el); let fg = parse(cs.color); fg = blend([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = fs >= 18.66 || (fs >= 14 && Number(cs.fontWeight) >= 700);
    if (fs < 11 || op < 0.99 || cr < (big ? 3 : 4.5)) {
      const name = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
      const key = name(el) + (el.parentElement ? ' < ' + name(el.parentElement) : '');
      if (!out.has(key)) out.set(key, 'fs=' + fs + ' op=' + op.toFixed(2) + ' cr=' + cr.toFixed(2) + ' "' + n.textContent.trim().slice(0, 18) + '"');
    }
  }
  return [...out].map(([k, v]) => '  ' + k + '  ' + v).join('\\n') || '  (none)';
})()`;
const chosen = (arg('states')?? Object.keys(STATES).join(',')).split(',');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
mkdirSync(out, { recursive: true });
for (const [w, h] of sizes) {
  for (const name of chosen) {
    const state = STATES[name];
    if (!state) { console.log(`skip ${name}: unknown state`); continue; }
    const touch = process.argv.includes('--touch');
    if (state.only === 'desktop' ? w < 1100 || touch : state.only === 'small' ? w >= 1100 : false) continue;
    const page = await browser.newPage();
    // --touch: telefono o tablet col dito (pointer: coarse, hover: none), per le regole dei tocchi da 44
    await page.setViewport({ width: w, height: h, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
    const lang = state.lang ?? 'it';
    await page.evaluateOnNewDocument((l, extra) => {
      localStorage.clear();
      localStorage.setItem('dreamdex.lang', JSON.stringify(l));
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
    }, lang, state.storage ?? {});
    await page.goto(URL + (state.hash ?? hash(TEAM)), { waitUntil: 'networkidle0', timeout: 90000 });
    await wait(1500);
    // Un clic che fallisce (es. elemento fuori schermo col dito) salta lo stato invece di fermare tutto
    const result = state.run ? await state.run(page).catch((e: Error) => e.message) : true;
    if (result !== true) { console.log(`skip ${name} @${w}x${h}: ${result === false ? 'element not found' : result}`); await page.close(); continue; }
    // --wait <ms>: aspetta di più prima della foto (es. finché il Coaching ha finito di calcolare)
    await wait(Number(arg('wait') ?? 800));
    // --palette sv: la palette di Scarlatto/Violetto (accento arancione) sulla pagina, per controllare i colori
    const palette = arg('palette');
    if (palette) { await page.evaluate(p => { document.documentElement.dataset.palette = p; }, palette); await wait(300); }
    // --add-class "sel:classe": aggiunge una classe prima della foto (per provare una variante non attiva nell'app)
    const addClass = arg('add-class');
    if (addClass) { const [sel, cls] = addClass.split(':'); await page.evaluate((s, c) => { document.querySelectorAll(s).forEach(e => e.classList.add(c)); }, sel, cls); await wait(300); }
    // --hover "sel": porta il puntatore sul primo elemento (per i tooltip)
    const hoverSel = arg('hover');
    if (hoverSel) { const el = await page.$(hoverSel); if (el) { await el.hover(); await wait(500); } else console.log(`hover ${hoverSel}: not found`); }
    // --focus "sel": porta il fuoco sul primo elemento; --keys "Tab,ArrowRight,…": tasti premuti dopo (per il giro del Tab, le frecce e i tooltip col fuoco)
    const focusSel = arg('focus');
    if (focusSel) { if (!await page.evaluate(s => { const el = document.querySelector<HTMLElement>(s); el?.focus(); return !!el; }, focusSel)) console.log(`focus ${focusSel}: not found`); }
    const keys = arg('keys');
    if (keys) { for (const k of keys.split(',')) { await page.keyboard.press(k as Parameters<Page['keyboard']['press']>[0]); await wait(60); } await wait(500); }
    // --scan: testo visibile sotto 11px, attenuato con l'opacità o con contrasto sotto 4,5:1 (sul fondo pieno più vicino)
    if (process.argv.includes('--scan')) console.log(`scan ${name} @${w}x${h}:\n` + (await page.evaluate(SCAN_TEXT) as string));
    // --eval <file.js>: un'espressione JS (stringa) valutata nella pagina, il risultato stampato
    const evalFile = arg('eval');
    if (evalFile) console.log(`eval ${name} @${w}x${h}: ${String(await page.evaluate(readFileSync(evalFile, 'utf8')))}`);
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
      // Pezzi visibili tagliati dal fondo del contenitore che li nasconde (la card o una sua parte con overflow non
      // visibile: overflow e cut non lo vedono), oltre 1px
      const inCut = cards.flatMap(c => {
        return [...c.querySelectorAll<HTMLElement>('.dash-role-tag, .more-n, .sum-line, .cov-tile, .dash-cell, .dash-lane-sprite, .sum-bm')]
          .filter(e => {
            const r = e.getBoundingClientRect();
            if (r.height <= 0) return false;
            let clip = c.getBoundingClientRect().bottom;
            for (let a = e.parentElement; a && a !== c.parentElement; a = a.parentElement) {
              if (getComputedStyle(a).overflowY !== 'visible') clip = Math.min(clip, a.getBoundingClientRect().bottom);
            }
            return r.bottom - clip > 1;
          })
          .map(e => `${c.className.split(' ').find(n => n.startsWith('dash-') && n !== 'dash-card')?.slice(5)}:${e.className.split(' ')[0]}`);
      });
      // Riassunto: nome del tipo, riga dell'eroe e righe delle sezioni tagliati in larghezza (anche in EN)
      // (la riga degli sprite si misura dai suoi figli: la luce del passaggio dell'ultimo sprite sborda apposta di 6px)
      const sumClip = box ? [...box.querySelectorAll<HTMLElement>('.sum-type, .sum-arch, .sum-line, .sum-name')].filter(e => e.scrollWidth - e.clientWidth > 1).length
        + [...box.querySelectorAll<HTMLElement>('.sum-crew')].filter(e => { const r = e.getBoundingClientRect(); return [...e.children].some(c => c.getBoundingClientRect().right - r.right > 1); }).length : 0;
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
          const memberRows = rows.length ? ` memberRows=${Math.round(rows[0].top)}+${Math.round(rows[0].height)}..${Math.round(rows[rows.length - 1].bottom)} monX=${Math.round(el.querySelector('.def-grid tbody .ad-mon')!.getBoundingClientRect().left)} head=[${[...el.querySelectorAll('.def-grid thead tr')].map(r => Math.round(r.getBoundingClientRect().height)).join(',')}]@${Math.round(el.querySelector('.def-grid thead')!.getBoundingClientRect().top)} th=[${[...el.querySelectorAll('.def-grid thead th')].map(h => { const r = h.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}:${h.scrollHeight}`; }).join(',')}] firstRowY=${Math.round(rows[0].top)} cols=[${[...el.querySelectorAll('.def-members thead th')].map(h => { const r = h.getBoundingClientRect(); return `${Math.round(r.left)}+${Math.round(r.width)}`; }).join(',')}] bars=[${[...el.querySelectorAll('.def-members tbody tr:first-child .kob-line')].map(b => { const r = b.getBoundingClientRect(); return `${Math.round(r.left)}+${Math.round(r.width)}`; }).join(',')}]` : '';
          // Sotto le righe: quanto occupa il resto (riga di riepilogo, legenda, pagine) e quanto spazio c'è fino al fondo della cornice
          const frame = el.querySelector<HTMLElement>('.def-frame');
          const last = rows[rows.length - 1]?.bottom ?? 0;
          const scroller = frame?.querySelector<HTMLElement>(':scope > .ad-scroll');
          // Il margine in alto della legenda è "auto" (spinge in fondo): non è spazio che serve
          let need = scroller ? scroller.getBoundingClientRect().bottom - last + (parseFloat(getComputedStyle(scroller).marginBottom) || 0) : 0;
          for (const c of scroller ? [...frame!.children] : []) {
            if (c === scroller) continue;
            const cs = getComputedStyle(c);
            need += c.getBoundingClientRect().height + (c.classList.contains('rob-legend') ? 0 : parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
          }
          // Le parti sotto le righe dei membri: righe di riepilogo della tabella, poi gli elementi dopo la tabella (legenda, note)
          const tail = scroller ? [...scroller.querySelectorAll<HTMLElement>('tbody tr:not(:has(.ad-mon))')].map(r => Math.round(r.getBoundingClientRect().height))
            .concat([...frame!.children].filter(c => c !== scroller).map(c => Math.round(c.getBoundingClientRect().height))) : [];
          const below = frame && rows.length ? ` below=${Math.round(need)}/${Math.round(frame.getBoundingClientRect().bottom - last)} belowParts=[${tail.join(',')}]` : '';
          const label = el.querySelector<HTMLElement>('th.def-mon-h');
          const labelAt = label ? (() => { const r = document.createRange(); r.selectNodeContents(label); const b = r.getBoundingClientRect(); return ` label=${Math.round(b.left)},${Math.round(b.top)}`; })() : '';
          const gp = document.querySelector<HTMLElement>('.help-dialog .help-panel');
          const gs = gp?.closest<HTMLElement>('.guide-stack');
          // La guida a sezioni scorre nella pila (.guide-stack), non nel pannello: conta il più alto dei due
          // Altezza del contenuto di ogni pagina della pila (le pagine si allungano tutte alla più alta) sull'altezza della pila
          const pages = gs ? [...gs.querySelectorAll<HTMLElement>(':scope > .help-panel')].map(sec => { const last = sec.lastElementChild?.getBoundingClientRect(); return last ? Math.round(last.bottom - sec.getBoundingClientRect().top + (parseFloat(getComputedStyle(sec).paddingBottom) || 0)) : 0; }) : [];
          const guide = gp ? ` guideScroll=${Math.max(gp.scrollHeight - gp.clientHeight, gs ? gs.scrollHeight - gs.clientHeight : 0)} guideH=${Math.round(gp.closest('.help-dialog')!.getBoundingClientRect().height)}${gs ? ` guidePages=[${pages.join(',')}]/${gs.clientHeight}` : ''}` : '';
          const rl = el.querySelector<HTMLElement>('.rl-frame');
          // Ruoli: righe, bande, mancanti, quanto scorrono le fasce (deve essere 0), spazio sotto l'ultima riga, nomi tagliati
          const rlScroll = rl?.querySelector<HTMLElement>('.rl-bands');
          const rlRows = rl ? rl.querySelectorAll('.rl-row').length : 0;
          const rlLast = rl ? [...rl.querySelectorAll<HTMLElement>('.rl-row')].reduce((b, li) => Math.max(b, li.getBoundingClientRect().bottom), 0) : 0;
          const rlRowH = rl?.querySelector<HTMLElement>('.rl-row')?.getBoundingClientRect().height ?? 0;
          // Allineamento tra le fasce: per fascia x sinistra di ogni colonna, x della pista "chi la copre", bordo destro dei punti
          // (righe e somma del titolo); su ogni fascia devono essere uguali
          const rlAlign = rl ? ` align=[${[...rl.querySelectorAll<HTMLElement>('.rl-band')].map(band => {
            const rws = [...band.querySelectorAll<HTMLElement>('.rl-row')];
            const cols = [...new Set(rws.map(r => Math.round(r.getBoundingClientRect().left)))].join('/');
            const by = [...new Set(rws.map(r => Math.round(r.querySelector('.rl-by')!.getBoundingClientRect().left)))].join('/');
            const pts = [...new Set(rws.map(r => Math.round(r.querySelector('.rl-pts')!.getBoundingClientRect().right)))].join('/');
            const sum = Math.round(band.querySelector('.rl-band-head .rl-mark')?.getBoundingClientRect().left ?? 0);
            return `${band.classList[1]}:cols=${cols} by=${by} pts=${pts} headMarkX=${sum}`;
          }).join(' | ')}] rowHs=[${[...new Set([...rl.querySelectorAll<HTMLElement>('.rl-row')].map(r => Math.round(r.getBoundingClientRect().height)))].join(',')}] three=${rl.classList.contains('three') ? 1 : 0} bandsR=${Math.round(rlScroll?.getBoundingClientRect().right ?? 0)} headR=${Math.round(rl.querySelector('.rl-more')?.getBoundingClientRect().right ?? 0)}` : '';
          const roles = rl ? ` roles: rows=${rlRows} bands=${rl.querySelectorAll('.rl-band').length} missing=${rl.querySelectorAll('.rl-row.bad, .rl-row.warn').length} rowH=${Math.round(rlRowH)} listScroll=${rlScroll ? rlScroll.scrollHeight - rlScroll.clientHeight : '-'} lastRowGap=${rlLast ? Math.round(rl.getBoundingClientRect().bottom - rlLast) : '-'} frameH=${Math.round(rl.getBoundingClientRect().height)} headH=${Math.round(rl.querySelector('.rl-head')?.getBoundingClientRect().height ?? 0)} nameCut=${[...rl.querySelectorAll<HTMLElement>('.rl-mon-name, .rl-name')].filter(e => e.scrollWidth - e.clientWidth > 1).length}${rlAlign}` : '';
          // Legenda nella riga in fondo alla tabella: larghezza, quanto sborda dalla riga (0 = intera; footCut = la riga intera
          // sborda) e problemi mostrati / nel "+N" della testata dell'area; panelTop = dove parte il pannello (uguale in ogni area)
          const lg = document.querySelector<HTMLElement>('.area-panel .area-legend');
          const lgRow = lg?.parentElement?.getBoundingClientRect();
          const shownP = document.querySelectorAll('.area-chips > li:not(.area-chips-more)').length;
          const moreP = document.querySelector('.area-chips-more')?.textContent?.match(/\+(\d+)/)?.[1] ?? '0';
          const legendAt = lg && lgRow ? ` legend=${Math.round(lg.getBoundingClientRect().width)} legendCut=${Math.max(0, Math.round(lg.getBoundingClientRect().right - lgRow.right), lg.scrollWidth - lg.clientWidth)} footCut=${lg.parentElement!.scrollWidth - lg.parentElement!.clientWidth} footGap=${Math.round(el.getBoundingClientRect().bottom - lgRow.bottom)} problems=${shownP}+${moreP} footH=${Math.round(lgRow.height)}` : '';
          const pr = document.querySelector<HTMLElement>('.area-head');
          const prAt = pr ? ` panelTop=${Math.round(el.getBoundingClientRect().top)} headH=${Math.round(pr.getBoundingClientRect().height)} chips=${document.querySelectorAll('.area-chips > li:not(.area-chips-more)').length}+${document.querySelector('.area-chips-more')?.textContent?.match(/\+(\d+)/)?.[1] ?? '0'} chipsCut=${(() => { const c = pr.querySelector<HTMLElement>('.area-chips'); return c ? c.scrollWidth - c.clientWidth : '-'; })()} headX=${pr.scrollWidth - pr.clientWidth}` : '';
          return `${guide}${prAt}${roles}${legendAt} panelOverflow=${el.scrollHeight - el.clientHeight} panelX=${el.scrollWidth - el.clientWidth}${(() => { const l = el.querySelector<HTMLElement>('.bm-entries'); return l ? ` bmListScroll=${l.scrollHeight - l.clientHeight} bmBars=${el.querySelector('.bm.no-bars') ? 0 : 1} bmCompact=${el.querySelector('.bm-entries.compact') ? 1 : 0} bmCols=${el.querySelector<HTMLElement>('.bm-list')?.style.getPropertyValue('--cols') ?? '-'} bmButtons=${el.querySelectorAll('button.bm-row-toggle').length} bmCores=[${[...el.querySelectorAll('.bm-core, .bm-core-body')].map(c => `${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`).join(',')}]` : ''; })()}${memberRows}${below}${labelAt}`; })(),
        dash: box ? `dash=${box.clientHeight}x${box.clientWidth} density=${box.dataset.density} cards=[${heights.join(',')}] cut=${cut} inCut=[${[...new Set(inCut)].join(',')}] overflow=[${over.join(',')}] sumClip=${sumClip} rows=[${sumRows.join(',')}] sumHidden=${sumHidden} sumFill=${fill}% fitCut=${fitCut} covBand=${covBand} overviewScroll=${(document.querySelector('.overview')?.scrollHeight ?? 0) - (document.querySelector('.overview')?.clientHeight ?? 0)} hScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}` : '',
      };
    });
    // Coaching (Diagnosi → Cura): la carta grande, le righe della lista e della diagnosi che sbordano, i nomi tagliati,
    // le righe oltre il fondo del loro riquadro, gli scorrimenti
    const coach = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('.coaching');
      if (!box) return '';
      const hero = box.querySelector<HTMLElement>('.coach-hero:not(.skeleton)');
      const rows = [...box.querySelectorAll<HTMLElement>('.coach-rank')];
      const rail = [...box.querySelectorAll<HTMLElement>('.coach-diag-list > li')];
      // (niente funzioni con nome qui dentro: tsx aggiunge __name, che nella pagina non c'è)
      const listB = box.querySelector('.coach-diag-box')?.getBoundingClientRect().bottom ?? Infinity;
      const railB = box.querySelector('.coach-diag-box')?.getBoundingClientRect().bottom ?? Infinity;
      const wide = [...box.querySelectorAll<HTMLElement>('.coach-hero-name, .coach-plate-value, .coach-rank-who b')].filter(e => e.scrollWidth - e.clientWidth > 1).length;
      const sc = hero?.querySelector<HTMLElement>('.coach-hero-scroll'); const foot = hero?.querySelector('.coach-hero-foot')?.getBoundingClientRect(); const heroOver = hero ? Math.max(hero.scrollHeight - hero.clientHeight, foot && foot.bottom > hero.getBoundingClientRect().bottom + 1 ? 1 : 0) : 0; const heroScroll = sc ? sc.scrollHeight - sc.clientHeight : 0;
      const last = rows.at(-1)?.getBoundingClientRect().bottom ?? 0;
      return `coach: hero=${hero ? Math.round(hero.getBoundingClientRect().height) : 0} heroOverflow=${heroOver} heroScroll=${heroScroll} rows=${rows.length} rowOverflow=${rows.filter(r => r.scrollHeight - r.clientHeight > 1).length} rowsBelow=${rows.filter(r => r.getBoundingClientRect().bottom > listB + 1).length} rail=${rail.length} railOverflow=${rail.filter(r => r.scrollHeight - r.clientHeight > 1).length} railBelow=${rail.filter(r => r.getBoundingClientRect().bottom > railB + 1).length} clipped=${wide} lastBottom=${Math.round(last)} coachBottom=${Math.round(box.getBoundingClientRect().bottom)} hScroll=${box.scrollWidth - box.clientWidth} coachScroll=${box.scrollHeight - box.clientHeight} docHScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}`;
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
      const nameCut = items.filter(li => { const e = li.querySelector<HTMLElement>('.pick strong:not(.visually-hidden), .pick-name b, .pick-name .forme'); return !!e && e.scrollWidth - e.clientWidth > 1; }).length;
      // Dettaglio: quanto scorrono il corpo (Porta/Toglie...) e la scheda; suggerimento del doppio clic tagliato; preferiti
      const body = document.querySelector<HTMLElement>('.detail .detail-body');
      const aside = document.querySelector<HTMLElement>('aside.detail');
      const hint = document.querySelector<HTMLElement>('.list-head .dbl-hint');
      const favs = ol.querySelectorAll('.result.fav').length;
      const extra = ` detailBodyScroll=${body ? body.scrollHeight - body.clientHeight : '-'} detailScroll=${aside ? aside.scrollHeight - aside.clientHeight : '-'} hintCut=${hint ? hint.scrollWidth - hint.clientWidth : '-'} hintW=${hint ? `${hint.clientWidth}/${document.querySelector<HTMLElement>('.list-head')?.clientWidth}` : '-'} dashes=${document.querySelectorAll('.pager-dash').length} favs=${favs} detailLv=${aside ? (aside.classList.contains('tabbed') ? 'tabs' : aside.classList.contains('why-2col') ? (aside.classList.contains('compact') ? 'low2col' : '2col') : aside.classList.contains('compact') ? 'low' : 'full') : '-'} detailParts=${aside ? [...aside.querySelectorAll(':scope > *, .detail-panel > *')].map(el => `${String(el.getAttribute("class") ?? "").split(' ').at(-1)}:${Math.round(el.getBoundingClientRect().height)}`).join(',') : '-'} detailFree=${body ? body.clientHeight - [...body.querySelectorAll('.detail-panel > *')].reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) : '-'}`;
      return `list: ${ol.className} items=${items.length} cols=${ol.style.getPropertyValue('--cols') || '-'} tileH=${ol.style.getPropertyValue('--tile-h') || '-'} reasons=${ol.style.getPropertyValue('--reasons') || '-'} rowH=${ol.style.getPropertyValue('--row-h') || '-'} first=${first ? `${Math.round(first.width)}x${Math.round(first.height)}` : '-'} listScroll=${ol.scrollHeight - ol.clientHeight} cutTiles=${cut} whoOver=${whoOver} wideCut=${wideCut} nameCut=${nameCut}${extra}`;
    });
    // Fascia del team: altezza, carte, chip dei tipi fuori dalla carta, nomi spezzati a metà parola, pulsanti della testata
    // su più righe, righe del voto che sbordano; lista: carte oltre il bordo della lista, testata della lista sovrapposta
    const band = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.band');
      if (!el) return '';
      const slots = [...el.querySelectorAll<HTMLElement>('.slot > .slot-card, .slot.empty')];
      const slotH = slots.length ? Math.round(slots[0].getBoundingClientRect().height) : 0;
      const chipOver = slots.filter(s => { const r = s.getBoundingClientRect(); return [...s.querySelectorAll<HTMLElement>('.type-chip')].some(c => { const b = c.getBoundingClientRect(); return b.width > 0 && (b.right - r.right > 0.5 || c.scrollWidth - c.clientWidth > 1); }); }).length;
      // Nome su due righe: la riga si spezza dove non c'è uno spazio o un trattino
      const midBreak = [...el.querySelectorAll<HTMLElement>('.slot .name')].filter(n => {
        const text = n.textContent ?? '';
        const node = [...n.childNodes].find(c => c.nodeType === 3 && (c.textContent ?? '').length > 0);
        if (!node || n.getClientRects().length === 0) return false;
        const range = document.createRange();
        let prevTop: number | null = null;
        const t = node.textContent ?? '';
        for (let i = 0; i < t.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          if (r.height === 0) continue;
          if (prevTop !== null && r.top - prevTop > 4) return i > 0 && !/[\s-]/.test(t[i - 1]) && !/\s/.test(t[i]);
          prevTop = r.top;
        }
        return text.length < 0;
      }).length;
      const nameCut = [...el.querySelectorAll<HTMLElement>('.slot .name')].filter(n => n.getClientRects().length && n.scrollWidth - n.clientWidth > 1).length;
      // Pulsanti visibili della testata col testo su due righe (altezza del testo oltre una riga)
      const headBtns = [...el.querySelectorAll<HTMLElement>('.team-head > button, .team-head > * > button, .team-head summary')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height > 0);
      const headWrap = headBtns.filter(b => {
        const lab = b.querySelector<HTMLElement>('.btn-label') ?? b;
        if (lab.getBoundingClientRect().width <= 1) return false;
        const r = document.createRange(); r.selectNodeContents(lab);
        return r.getBoundingClientRect().height > 24;
      }).length;
      const grade = el.querySelector<HTMLElement>('.grade-badge');
      const gradeOver = grade ? [...grade.querySelectorAll<HTMLElement>('.grade-area')].filter(a => a.scrollWidth - a.clientWidth > 1 || a.getBoundingClientRect().right - grade.getBoundingClientRect().right > 0.5).length : 0;
      const gradeScroll = grade ? grade.scrollHeight - grade.clientHeight : 0;
      const sprite = el.querySelector<HTMLElement>('.slot > .slot-card .sprite');
      return `band: bandH=${Math.round(el.getBoundingClientRect().height)} slotH=${slotH} sprite=${sprite ? Math.round(sprite.getBoundingClientRect().height) : '-'} chipOver=${chipOver} midBreak=${midBreak} teamNameCut=${nameCut} headWrap=${headWrap} gradeOver=${gradeOver} gradeScroll=${gradeScroll}`;
    });
    const listMore = await page.evaluate(() => {
      const ol = document.querySelector<HTMLElement>('ol.suggestions');
      if (!ol) return '';
      const r = ol.getBoundingClientRect();
      const right = r.left + ol.clientLeft + ol.clientWidth;
      const cardOver = Math.max(0, ...[...ol.querySelectorAll<HTMLElement>(':scope > li')].map(li => Math.round(li.getBoundingClientRect().right - right)));
      // Testata: pager e pulsanti della vista sovrapposti (px), suggerimento nascosto
      const head = document.querySelector<HTMLElement>('.list-head');
      const pager = head?.querySelector<HTMLElement>('.pager');
      const view = head?.querySelector<HTMLElement>('.list-view');
      const hint = head?.querySelector<HTMLElement>('.dbl-hint');
      const dashes = head ? [...head.querySelectorAll<HTMLElement>('.pager > *')] : [];
      let headCollide = 0;
      for (let i = 1; i < dashes.length; i++) headCollide = Math.max(headCollide, Math.round(dashes[i - 1].getBoundingClientRect().right - dashes[i].getBoundingClientRect().left));
      if (pager && view) headCollide = Math.max(headCollide, Math.round(pager.getBoundingClientRect().right - view.getBoundingClientRect().left));
      if (pager && hint && hint.getClientRects().length) headCollide = Math.max(headCollide, Math.round(hint.getBoundingClientRect().right - pager.getBoundingClientRect().left));
      const headOver = head ? head.scrollWidth - head.clientWidth : 0;
      const dashBox = head?.querySelector<HTMLElement>('.pager-dashes');
      if (dashBox) headCollide = Math.max(headCollide, dashBox.scrollWidth - dashBox.clientWidth);
      // Sprite delle carte coperto dalla targhetta o dalla pillola di chi esce
      const covered = [...ol.querySelectorAll<HTMLElement>(':scope > li')].filter(li => {
        const b = li.querySelector<HTMLElement>('.card-sprite, .pill-sprite')?.getBoundingClientRect();
        const out = li.querySelector<HTMLElement>('.out')?.getBoundingClientRect();
        if (!b || !out) return false;
        // Il riquadro dello sprite ha i bordi vuoti: conta il 70% centrale, dove sta il Pokémon
        const s = { left: b.left + b.width * 0.15, right: b.right - b.width * 0.15, top: b.top + b.height * 0.15, bottom: b.bottom - b.height * 0.15 };
        return Math.min(s.right, out.right) - Math.max(s.left, out.left) > 2 && Math.min(s.bottom, out.bottom) - Math.max(s.top, out.top) > 2;
      }).length;
      const spr = ol.querySelector<HTMLElement>('.card-sprite, .pill-sprite');
      return `list2: cardOver=${cardOver} headCollide=${headCollide} headOver=${headOver} hint=${hint && hint.getClientRects().length ? 'shown' : 'hidden'} outOverSprite=${covered} listSprite=${spr ? Math.round(spr.getBoundingClientRect().width) : '-'} listH=${Math.round(r.height)}`;
    });
    // Come funziona il voto: quanto scorre il pannello a destra (0 = sta tutto) e l'altezza della finestra
    const ratingHelp = await page.evaluate(() => {
      const gp = document.querySelector<HTMLElement>('.rating-help .help-panel');
      const help = gp ? ` helpScroll=${gp.scrollHeight - gp.clientHeight} helpH=${Math.round(gp.closest('.help-dialog')!.getBoundingClientRect().height)}` : '';
      // Tipo di team nella barra dei candidati: spazio del testo della tendina contro il nome più lungo (negativo = tagliato) e se la barra sborda
      const tt = document.querySelector<HTMLElement>('.toolbar .team-type');
      const sel = tt?.querySelector('select');
      if (!tt || !sel) return help;
      const cs = getComputedStyle(sel);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const longest = Math.max(...[...sel.options].map(o => ctx.measureText(o.text).width));
      const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const bar = tt.parentElement!;
      return `${help} teamType=w${Math.round(tt.getBoundingClientRect().width)} room${Math.round(room - longest)} barOver=${bar.scrollWidth - bar.clientWidth}`;
    });
    // fixStrip: x, larghezza, altezza e fondo della striscia in fondo (Da sistemare o problemi dell'area), uguale ovunque
    const fixStrip = await page.evaluate(() => { const r = document.querySelector('.fix-row')?.getBoundingClientRect(); return r ? ` fixStrip=x${Math.round(r.left)},w${Math.round(r.width)},h${Math.round(r.height)},bottom${Math.round(r.bottom)}` : ''; });
    const file = join(out, `${w}x${h}-${name}.png`);
    // --clip "sel": la foto solo di quell'elemento (se c'è)
    const clipEl = arg('clip') ? await page.$(arg('clip')!) : null;
    // --full: la foto di tutta la pagina (anche la parte sotto lo schermo, per il telefono)
    if (clipEl) await clipEl.screenshot({ path: file }); else await page.screenshot({ path: file, fullPage: process.argv.includes('--full') });
    console.log(`${file} pageScroll=${scroll} clipped=${clipped}${fixStrip}${panel}${ratingHelp} ${dash} ${coach} ${list} ${listMore} ${band}`);
    await page.close();
  }
}
await browser.close();
