/**
 * Foto della pagina negli stati del restyle (sezioni, editor, modali, popover, tooltip), a più dimensioni.
 * Serve il server di sviluppo su http://localhost:5173 (npx vite).
 *   npm run screens -- --out <cartella> [--states a,b] [--sizes 1440x900,1366x657,1280x620,1536x730]
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
/** Una riga delle aree del voto; col team ridotto le righe stanno nella tendina del voto, che si apre prima. */
async function gradeRow(page: Page, text: RegExp): Promise<boolean> {
  const opened = await page.evaluate(() => {
    const toggle = document.querySelector<HTMLElement>('.grade-pop-toggle');
    if (document.querySelector('.band button.grade-area') || !toggle) return false;
    toggle.click();
    return true;
  });
  if (opened) await wait(200);
  return clickText(page, '.band button.grade-area', text);
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
    if (!await gradeRow(p, /^(Difesa|Defense)/)) return 'no defense row';
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
    if (!await gradeRow(p, /^Offe(sa|nse)/)) return 'no offense row';
    await wait(300);
    if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
    await wait(500);
    return true;
  },
});
const OFFENSE_SUBS: Record<string, RegExp | null> = { general: /^General/, types: /^Coverage tipi/, meta: /^Coverage meta/ };
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
OFFENSE_STATES['analysis-offense-types-nometa'] = offenseState(OFFENSE_SUBS.types, { format: { meta: false } });
OFFENSE_STATES['analysis-offense-meta-en'] = { ...offenseState(/^Meta coverage/), lang: 'en' };
OFFENSE_STATES['analysis-offense-guide'] = offenseGuide(OFFENSE_SUBS.general);
// La pagina Coverage tipi con la freccina del Colpo aperta: le difese medie dei 18 bersagli (il modale non cambia altezza)
// La guida dal "?" di Coverage tipi, col puntatore sul "?" dei bersagli: il tooltip con le medie dei 18 tipi
OFFENSE_STATES['analysis-offense-guide-types-open'] = { hash: hash(SIX), run: async p => {
  const ok = await offenseGuide(OFFENSE_SUBS.types).run!(p);
  if (ok !== true) return ok;
  const ask = await p.$('.guide-ask');
  if (!ask) return 'no targets ?';
  await ask.hover();
  await wait(500);
  return true;
} };
OFFENSE_STATES['analysis-offense-guide-types-open-en'] = { ...OFFENSE_STATES['analysis-offense-guide-types-open'], lang: 'en' } as State;
OFFENSE_STATES['analysis-offense-guide-types'] = offenseGuide(OFFENSE_SUBS.general, /^Coverage tipi/);
OFFENSE_STATES['analysis-offense-guide-meta'] = offenseGuide(OFFENSE_SUBS.general, /^Coverage meta/);
// Velocità: lo stesso team con Ribombee (Sticky Web e Stun Spore) al posto di Gholdengo, così il controllo del team si vede
const SPEED_SIX = [...TEAM, member('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid', { spa: 252, spe: 252, hp: 4 })];
// Trick Room: lo stesso team con Hatterene (Trick Room) al posto di Ribombee
const SPEED_ROOM = [...TEAM, member('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psyshock', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet', { hp: 252, spa: 252, def: 4 })];
const speedState = (sub: RegExp | null, opts: { collapsed?: boolean; format?: Partial<typeof FORMAT> } = {}): State => ({
  hash: opts.format ? hashWith(SPEED_SIX, opts.format) : hash(SPEED_SIX),
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
    if (!await clickText(p, '.sp-bar-btn', /./)) return 'no bar';
    await wait(400);
    return true;
  } },
  // Trick Room: Hatterene al posto di Ribombee; l'interruttore "Trick Room · Hatterene" è acceso di base (le barre in
  // Trick Room); -off lo spegne
  'analysis-speed-trickroom': { hash: hash(SPEED_ROOM), run: async p => speedState(null).run!(p) },
  'analysis-speed-trickroom-off': { hash: hash(SPEED_ROOM), run: async p => {
    const ok = await speedState(null).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, '.panel-switch button[role="switch"]', /Trick Room/)) return 'no room switch';
    await wait(400);
    return true;
  } },
  'analysis-speed-trickroom-collapsed': { hash: hash(SPEED_ROOM), run: async p => speedState(null, { collapsed: true }).run!(p) },
  // Il tooltip della barra: la scala dei vicini (Great Tusk ha la Booster: l'icona accanto al nome)
  'analysis-speed-hover': { hash: hash(SPEED_SIX), run: async p => {
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
const SUBS: Record<string, RegExp | null> = { general: null, robustness: /^Robustezza/, sustain: /^(Sostenibilit|Recupero)/, types: /^Coverage tipi/, meta: /^Coverage meta/ };
const DEFENSE_STATES: Record<string, State> = {
  ...Object.fromEntries(Object.entries(SUBS).flatMap(([k, re]) => [
    [`analysis-defense-${k}`, defenseState(re)],
    [`analysis-defense-${k}-collapsed`, defenseState(re, { collapsed: true })],
  ])),
  'analysis-defense-types-nometa': defenseState(SUBS.types, { format: { meta: false } }),
  'analysis-defense-long': defenseState(null, { team: LONG }),
  // Generale col puntatore sul "+N" di un membro (Toxapex): il tooltip coi pezzi e il recupero in parole
  ...Object.fromEntries([['member', '.def-general tbody tr:nth-child(3) .og-share.dsh']].map(([k, sel]) => [`analysis-defense-general-share-${k}`, { hash: hash(SIX), run: async (p: Page) => {
    const ok = await defenseState(null).run!(p);
    if (ok !== true) return ok;
    const el = await p.$(sel);
    if (!el) return 'no share';
    await el.hover();
    await wait(500);
    return true;
  } } as State])),
  // Generale: clic sul pezzo 2HKO di Toxapex in Tipi (0) e su quello OHKO in Meta (1): si apre la sottoscheda coi bersagli accesi
  ...Object.fromEntries([[0, '.hb-2'], [1, '.hb-ohko']].map(([k, cls]) => [`analysis-defense-general-pick-${k}`, { hash: hash(SIX), run: async (p: Page) => {
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
  'analysis-defense-general-piece-hover': { hash: hash(SIX), run: async (p: Page) => {
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
  ...Object.fromEntries([0, 1].map(k => [`analysis-defense-general-worst-${k}`, { hash: hash(SIX), run: async (p: Page) => {
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
  'analysis-defense-guide-rob': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.robustness).run!(p);
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
  /** La guida di Coverage tipi con la tabella dell'attaccante di ogni tipo aperta. */
  'analysis-defense-guide-types-open': { hash: hash(SIX), run: async p => {
    const ok = await defenseState(SUBS.types).run!(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(400);
    if (!await clickText(p, '.guide-more > summary', /./)) return 'no attackers toggle';
    await wait(300);
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
interface State { hash?: string; lang?: 'it' | 'en'; storage?: Record<string, string>; run?: (page: Page) => Promise<boolean | string> }
const openFill = async (p: Page) => { await p.evaluate(() => (document.querySelector('[data-fill-toggle]') as HTMLElement | null)?.click()); await p.waitForSelector('.fill-panel', { timeout: 10000 }); };
// Coverage tipi / meta di Offesa e Difesa con l'interruttore dell'efficacia acceso, e col puntatore su una colonna
const effOn = (base: State, hover = false): State => ({ ...base, run: async p => {
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
    // Allineamento: per ogni gruppo, la base della scritta dell'etichetta e quella della prima riga delle voci (stessa = 0)
    // (codice come stringa: tsx aggiunge __name alle funzioni con nome, che nella pagina non esiste)
    console.log(`bringAlign=${await p.evaluate(`[...document.querySelectorAll('.detail .bring-group')].map(g => {
      const textOf = el => { if (!el) return null; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim() ? 1 : 3 }); return walker.nextNode(); };
      const bottom = el => { const n = textOf(el); if (!n) return NaN; const r = document.createRange(); r.selectNodeContents(n); const b = r.getClientRects()[0]; return b ? b.bottom : NaN; };
      return g.classList[1] + ':' + (bottom(g.querySelector('.bring-label')) - bottom(g.querySelector('li'))).toFixed(1);
    }).join(' ')`)}`);
    return (await p.evaluate(() => !!document.querySelector('.detail .bring-groups.loss, .detail .loses'))) || 'no Toglie';
  } },
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
  'pokemon-long-en': { hash: hash(LONG), lang: 'en', run: async p => { await tab(p, 'pokemon'); return true; } },
  'pokemon-menu-long': { hash: hash(LONG), storage: { 'dreamdex.listStyle': '"menu"' }, run: async p => { await tab(p, 'pokemon'); return true; } },
  editor: { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return false;
    await wait(400);
    // L'editor sta nel cassetto senza scorrere: quanto supera (0 = ci sta tutto)
    console.log(`drawerOver=${await p.evaluate(() => { const d = document.querySelector('.drawer'); return d ? d.scrollHeight - d.clientHeight : -1; })} drawerFree=${await p.evaluate(() => { const d = document.querySelector('.drawer'); const e = d?.querySelector('.set-editor'); if (!d || !e) return -1; const cs = getComputedStyle(d); return Math.round(d.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom) - e.getBoundingClientRect().bottom); })} statRow=${await p.evaluate(() => Math.round(document.querySelectorAll('.stat-row:not(.stat-head)')[0]?.getBoundingClientRect().height ?? 0))} rows=${await p.evaluate(() => { const e = document.querySelector('.drawer .set-editor') as HTMLElement | null; if (!e) return ''; return getComputedStyle(e).gridTemplateRows + ' | ' + [...e.children].map(c => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().height)}`).join(',') + ' | ' + ['.stats-cell > *', '.editor-side > *', '.evs > *'].map(q => [...e.querySelectorAll(q)].map(c => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().height)}`).join(',')).join(' / '); })}`);
    return true;
  } },
  // EV oltre il massimo: il totale in alto dice quanti di troppo e che il voto è bloccato, senza l'avviso rosso nell'editor
  'editor-ev-over': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    const hp = await p.$('.drawer .ev-input');
    if (!hp) return 'no ev input';
    await hp.click({ count: 3 });
    await hp.type('252');
    await p.keyboard.press('Tab');
    await wait(400);
    console.log(`evOver=${await p.evaluate(() => { const e = document.querySelector('.ev-total.over'); const t = document.querySelector('.stats-toolbar'); return e ? `${e.textContent} toolbarH=${Math.round(t!.getBoundingClientRect().height)} cut=${(e.querySelector('.ev-left') as HTMLElement).scrollWidth > (e.querySelector('.ev-left') as HTMLElement).clientWidth} note=${!!document.querySelector('.drawer .member-problems')}` : 'none'; })}`);
    return true;
  } },
  // Velocità finale col mouse sopra: il tooltip col posto nel meta e i vicini (si apre verso sinistra)
  'editor-speed-tip': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no card';
    await wait(500);
    const fin = await p.$('[data-testid="final-spe"]');
    if (!fin) return 'no speed';
    await fin.hover();
    await wait(400);
    console.log(`speedTip=${await p.evaluate(() => { const t = document.querySelector('.speed-pop')?.getBoundingClientRect(); return t ? `${Math.round(t.left)},${Math.round(t.top)},${Math.round(t.right)},${Math.round(t.bottom)} vw=${innerWidth} vh=${innerHeight}` : 'none'; })}`);
    return true;
  } },
  // Riga delle statistiche col mouse sopra: targhetta col bordo ciano, triangolino, tacca della barra EV
  'editor-stat-hover': { run: async p => {
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
      const toggle = document.querySelector('.band-toggle')!.getBoundingClientRect();
      const top = document.elementFromPoint(toggle.left + toggle.width / 2, toggle.top + toggle.height / 2);
      const tails = [...document.querySelectorAll('.move-combo .mvp-tail')].map(t => `${t.textContent}:${Math.round(t.getBoundingClientRect().width)}`).join(',');
      return `tails=${tails} menuOpen=${!!document.querySelector('.editor-group.moves .combobox.open [role=listbox]')} cursor=${getComputedStyle(tail).cursor} overToggle=${top?.closest('[role=listbox]') ? 'menu' : top?.className}`;
    }));
    return true;
  } },
  analysis: { run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-defense': { run: async p => gradeRow(p, /^Difesa/) },
  'analysis-offense': { run: async p => gradeRow(p, /^Offesa/) },
  // Carta del membro (tooltip) passando sul primo Pokémon della tabella dell'Offesa: le mosse come pillole piccole
  'card-tip': { run: async p => {
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
  'analysis-member': { run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    return clickText(p, '.member-cards button.member-card', /./);
  } },
  'rating-help': { run: async p => clickText(p, '.band .grade-tools button.help-button', /./) },
  // Come funziona il voto, pagina generale: la tabella dei pesi e la riga dei Ruoli sotto
  'rating-help-general': { run: async p => {
    if (!await clickText(p, '.band .grade-tools button.help-button', /./)) return 'no help button';
    await wait(300);
    return clickText(p, '.help-nav [role="tab"]', /^(Come funziona|How it works)$/);
  } },
  'rating-help-general-en': { lang: 'en', run: async p => {
    if (!await clickText(p, '.band .grade-tools button.help-button', /./)) return 'no help button';
    await wait(300);
    return clickText(p, '.help-nav [role="tab"]', /^How it works$/);
  } },
  // Hyper Offense: la frase su Trick Room e le voci dei Ruoli come etichette piatte
  'rating-help-ho': { hash: hash(SIX), run: async p => {
    if (!await clickText(p, '.band .grade-tools button.help-button', /./)) return 'no help button';
    await wait(300);
    return clickText(p, '.help-nav [role="tab"]', /^Hyper Offense/);
  } },
  'rating-help-balance': { hash: hash(SIX), run: async p => {
    if (!await clickText(p, '.band .grade-tools button.help-button', /./)) return 'no help button';
    await wait(300);
    return clickText(p, '.help-nav [role="tab"]', /^Balance/);
  } },
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
    const skeleton = await rowH('.coach-rows[aria-busy] > li');
    await p.waitForSelector('.coach-rows:not([aria-busy]), .coach-empty', { timeout: 20000 });
    console.log(`coaching-six: proposte pronte in ${Date.now() - start} ms; row skeleton=${skeleton} real=${await rowH('.coach-rows:not([aria-busy]) > li')}`);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.coach-rows > li')].map(li => { const r = li.getBoundingClientRect(); return `${Math.round(r.top)}-${Math.round(r.bottom)}`; }).join(' '));
    const box = await p.evaluate(() => { const r = document.querySelector('.coaching')?.getBoundingClientRect(); const ol = document.querySelector('.coach-rows'); return r ? `${Math.round(r.top)}-${Math.round(r.bottom)} rows=${ol ? getComputedStyle(ol).gridAutoRows : '-'}` : '-'; });
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
  // La tendina delle alternative aperta sulla prima riga che ne ha
  'coaching-menu': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-rows:not([aria-busy]), .coach-empty', { timeout: 20000 });
    if (!await clickText(p, 'button.coach-alt', /./)) return 'no alternatives';
    await wait(300);
    return true;
  } },
  // Coaching del team coi nomi lunghi (molti problemi minori di coverage)
  'coaching-long': { hash: hash(LONG), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return false;
    await p.waitForSelector('.coach-rows:not([aria-busy]), .coach-empty', { timeout: 20000 });
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
    // I consigli arrivano dopo il calcolo: si aspettano le righe delle proposte
    await p.waitForSelector('.coach-rows:not([aria-busy]) button.coach-see', { timeout: 20000 });
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
  'grade-pop': { hash: hash(SIX), run: async p => {
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
  // Il "+N" verde delle Sinergie col puntatore sopra (team aperto: il pulsante in fondo; chiuso: accanto al titolo)
  ...Object.fromEntries([false, true].map(collapsed => [`analysis-rain-syn-more${collapsed ? '-collapsed' : ''}`, { hash: hash(RAIN), run: async (p: Page) => {
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
  // Offesa › Generale col team chiuso: le pillole delle mosse sotto le barre, la prima col mouse sopra (si apre, coda in diagonale)
  'offense-chips-hover': { hash: hash(SIX), run: async p => {
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
  'team-type-help': { hash: hash(SIX), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '.dash-summary .help-button', /./)) return 'no help';
    await wait(300);
    return true;
  } },
  'team-type-help-en': { hash: hash(SIX), lang: 'en', run: async p => {
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
    await p.waitForSelector('.coach-rows:not([aria-busy]), .coach-empty', { timeout: 20000 });
    return true;
  } },
  // Proposte di mossa (team con set poveri): stampa quante righe di mossa ci sono nella prima pagina
  'coaching-move-steps': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-rows:not([aria-busy])', { timeout: 20000 });
    const n = await p.evaluate(() => document.querySelectorAll('.coach-rows .coach-row.is-move').length);
    console.log(`coaching-move-steps: ${n} proposte di mossa`);
    return n > 0 || 'no move proposal';
  } },
  // Clic su una proposta di mossa: editor del membro con la mossa nuova in anteprima
  'coaching-move': { hash: hash(MOVE), run: async p => {
    await tab(p, 'analysis');
    await wait(300);
    if (!await clickText(p, '#analysis-view-coaching', /./)) return 'no coaching tab';
    await p.waitForSelector('.coach-rows:not([aria-busy])', { timeout: 20000 });
    if (!await clickText(p, '.coach-row.is-move button.coach-see', /./)) return 'no move proposal';
    await wait(600);
    return (await p.evaluate(() => !!document.querySelector('.move-proposal'))) || 'no preview in the editor';
  } },
  meta: { run: async p => { await tab(p, 'meta'); return true; } },
  lists: { run: async p => { await tab(p, 'lists'); return true; } },
  // Scheda Meta (sopra: team di 5): team di 6, in inglese, col mouse sulla carta #4
  'meta-six': { hash: hash(SIX), run: async p => { await tab(p, 'meta'); return true; } },
  'meta-en': { lang: 'en', run: async p => { await tab(p, 'meta'); return true; } },
  'meta-hover': { run: async p => { await tab(p, 'meta'); await wait(800); const box = await p.evaluate(() => { const r = document.querySelectorAll('.meta-card')[3]?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + 40] : null; }); if (!box) return false; await p.mouse.move(box[0], box[1]); await wait(400); return true; } },
  fill: { run: async p => clickText(p, 'button', /^\s*Completa team/) },
  saved: { run: async p => clickText(p, 'details.popover > summary', /Team salvati/) },
  import: { run: async p => clickText(p, 'details.popover > summary', /Import/) },
  rules: { run: async p => { await p.click('.format-card > summary'); return true; } },
  filters: { run: async p => { await tab(p, 'pokemon'); return clickText(p, 'details.filters > summary', /./); } },
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
    return clickText(p, '.slot.open button.best-preset', /./);
  } },
  'editor-alert': { hash: hash(MOVE), run: async p => {
    // La prima carta con un avviso (Great Tusk con una mossa che non impara)
    if (!await clickText(p, '.slot.filled:has(.alert-mark) > .slot-card', /./)) return 'no card';
    await wait(600);
    return focus(p, '.slot.open .alert-mark');
  } },
  // Nomi lunghi con l'editor aperto: la carta aperta tiene il nome; nella barra compressa i nomi vanno su due righe
  'editor-long': { hash: hash(LONG), run: async p => { if (!await clickText(p, '.slot.filled > .slot-card', /Urshifu/)) return 'no card'; await wait(600); return true; } },
  // Testata dell'editor (Great Tusk: preset sia NatDex OU sia Gen 9 OU), il menu dei preset aperto e il riquadro Testo del set
  'editor-head': { run: async p => { if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card'; await wait(600); return editorHead(p); } },
  'editor-presets': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    return clickText(p, '.slot.open .preset-field [role="combobox"]', /./);
  } },
  // Fumetti delle icone della testata col fuoco (dove cadono, se escono dalla finestra), matita del nome, contrasto di "N liberi"
  'editor-hints': { run: async p => {
    if (!await clickText(p, '.slot.filled > .slot-card', /Great Tusk/)) return 'no card';
    await wait(600);
    for (const sel of ['.shiny-toggle', '.smogon-link', '.save-set', '.member-copy', '.editor-close', '.nickname']) {
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
    if (!await clickText(p, '.slot.open button.member-io', /./)) return 'no set text button';
    await wait(300);
    return editorHead(p);
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
  'filters-open': { run: async p => { await tab(p, 'pokemon'); await p.evaluate(() => (document.querySelector('.toolbar .filters > summary') as HTMLElement | null)?.click()); await wait(400); return true; } },
  'format-menu': { run: async p => { await p.click('.format-card > summary'); await wait(400); return true; } },
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
  illegal: { hash: hash([...TEAM, member('Mewtwo', 'Life Orb', 'Pressure', ['Psystrike', 'Ice Beam', 'Aura Sphere', 'Recover'], 'Timid', { spa: 252, spe: 252, hp: 4 })]) },
};
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
        dash: box ? `dash=${box.clientHeight}x${box.clientWidth} density=${box.dataset.density} cards=[${heights.join(',')}] cut=${cut} overflow=[${over.join(',')}] sumClip=${sumClip} rows=[${sumRows.join(',')}] sumHidden=${sumHidden} sumFill=${fill}% fitCut=${fitCut} covBand=${covBand} overviewScroll=${(document.querySelector('.overview')?.scrollHeight ?? 0) - (document.querySelector('.overview')?.clientHeight ?? 0)} hScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}` : '',
      };
    });
    // Coaching: righe che sbordano, nomi o pillole tagliati in larghezza, scorrimento orizzontale
    const coach = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('.coaching');
      if (!box) return '';
      const rows = [...box.querySelectorAll<HTMLElement>('.coach-row:not(.skeleton)')];
      const tall = rows.filter(r => r.scrollHeight - r.clientHeight > 1).length;
      const wide = [...box.querySelectorAll<HTMLElement>('.coach-art-name, .coach-art-moves, .coach-ar-who')].filter(e => e.scrollWidth - e.clientWidth > 1).length;
      const row = rows[0]?.getBoundingClientRect().height ?? 0;
      const last = rows.at(-1)?.getBoundingClientRect().bottom ?? 0;
      return `coach: rows=${rows.length} rowH=${Math.round(row)} rowOverflow=${tall} clipped=${wide} lastBottom=${Math.round(last)} coachBottom=${Math.round(box.getBoundingClientRect().bottom)} hScroll=${box.scrollWidth - box.clientWidth} coachScroll=${box.scrollHeight - box.clientHeight} coachH=${box.clientHeight} docHScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}`;
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
      const extra = ` detailBodyScroll=${body ? body.scrollHeight - body.clientHeight : '-'} detailScroll=${aside ? aside.scrollHeight - aside.clientHeight : '-'} hintCut=${hint ? hint.scrollWidth - hint.clientWidth : '-'} hintW=${hint ? `${hint.clientWidth}/${document.querySelector<HTMLElement>('.list-head')?.clientWidth}` : '-'} dashes=${document.querySelectorAll('.pager-dash').length} favs=${favs}`;
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
    if (clipEl) await clipEl.screenshot({ path: file }); else await page.screenshot({ path: file });
    console.log(`${file} pageScroll=${scroll} clipped=${clipped}${fixStrip}${panel}${ratingHelp} ${dash} ${coach} ${list} ${listMore} ${band}`);
    await page.close();
  }
}
await browser.close();
