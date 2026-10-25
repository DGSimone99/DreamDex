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
const LONG = [
  member('Landorus-Therian', 'Rocky Helmet', 'Intimidate', ['Earthquake', 'U-turn', 'Stealth Rock', 'Stone Edge'], 'Impish', { hp: 252, def: 216, spe: 40 }),
  member('Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel', 'Horn Leech', 'Knock Off', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Urshifu-Rapid-Strike', 'Choice Band', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Naive', { atk: 4, spa: 252, spe: 252 }),
  member('Scizor', 'Scizorite', 'Technician', ['Bullet Punch', 'U-turn', 'Swords Dance', 'Knock Off'], 'Adamant', { hp: 248, atk: 252, spd: 8 }),
  member('Garchomp', 'Garchompite', 'Rough Skin', ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
const FORMAT = { formatId: 'ou', genLimit: 9, minUsage: 0.01, allowMultipleMegas: false, ignoreBans: false, meta: true };
const hash = (team: unknown[]) => '#team=' + Buffer.from(JSON.stringify({ team, format: FORMAT })).toString('base64')
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

interface State { hash?: string; lang?: 'it' | 'en'; run?: (page: Page) => Promise<boolean | string> }
const STATES: Record<string, State> = {
  pokemon: { run: async p => { await tab(p, 'pokemon'); return true; } },
  editor: { run: async p => clickText(p, '.slot.filled > summary', /./) },
  analysis: { run: async p => { await tab(p, 'analysis'); return true; } },
  meta: { run: async p => { await tab(p, 'meta'); return true; } },
  lists: { run: async p => { await tab(p, 'lists'); return true; } },
  'area-offense': { run: async p => { await tab(p, 'analysis'); await wait(300); return clickText(p, 'button', /^Offesa/); } },
  'rating-help': { run: async p => { await tab(p, 'analysis'); await wait(300); return clickText(p, 'button.help-button', /./); } },
  bonus: { run: async p => { await tab(p, 'analysis'); await wait(300); return clickText(p, 'button, a', /Bonus\/Malus/); } },
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
  'editor-alert': { run: async p => {
    if (!await clickText(p, '.slot.filled > summary', /Dragapult/)) return 'no card';
    await wait(600);
    return focus(p, '.slot[open] .alert-mark');
  } },
  undo: { run: async p => clickText(p, 'button.remove', /Rimuovi/) },
  collapsed: { hash: hash(LONG), run: async p => clickText(p, 'button.band-toggle', /./) },
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
    await page.evaluateOnNewDocument(l => { localStorage.clear(); localStorage.setItem('dreamdex.lang', JSON.stringify(l)); }, lang);
    await page.goto(URL + (state.hash ?? hash(TEAM)), { waitUntil: 'networkidle0' });
    await wait(1500);
    const result = state.run ? await state.run(page) : true;
    if (result !== true) { console.log(`skip ${name} @${w}x${h}: ${result === false ? 'element not found' : result}`); await page.close(); continue; }
    await wait(800);
    // pageScroll: quanto scorre la pagina; clipped: quanto della colonna principale resta tagliato (overflow nascosto)
    const { scroll, clipped } = await page.evaluate(() => {
      const main = document.querySelector('.main');
      return {
        scroll: document.scrollingElement!.scrollHeight - window.innerHeight,
        clipped: main ? main.scrollHeight - main.clientHeight : 0,
      };
    });
    const file = join(out, `${w}x${h}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${file} pageScroll=${scroll} clipped=${clipped}`);
    await page.close();
  }
}
await browser.close();
