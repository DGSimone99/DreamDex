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
const out = arg('out') ?? '.impeccable/review/restyle/shots';
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
const LONG = [
  member('Landorus-Therian', 'Rocky Helmet', 'Intimidate', ['Earthquake', 'U-turn', 'Stealth Rock', 'Stone Edge'], 'Impish', { hp: 252, def: 216, spe: 40 }),
  member('Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel', 'Horn Leech', 'Knock Off', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Urshifu-Rapid-Strike', 'Choice Band', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'U-turn'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Naive', { atk: 4, spa: 252, spe: 252 }),
  member('Scizor', 'Scizorite', 'Technician', ['Bullet Punch', 'U-turn', 'Swords Dance', 'Knock Off'], 'Adamant', { hp: 248, atk: 252, spd: 8 }),
  member('Garchomp', 'Garchompite', 'Rough Skin', ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
// Team con una mossa non legale (Flamethrower su Great Tusk): il Coaching propone anche un cambio di mossa
const MOVE = [
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Flamethrower', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  ...TEAM.slice(1, 3),
  TEAM[4],
  SIX[5],
];
// Il team dell'utente (.superpowers/sdd/coaching-tweaks/user-team.txt): voto alto, poche tappe
const USER = [
  member('Scizor', 'Scizorite', 'Light Metal', ['Swords Dance', 'Bullet Punch', 'Knock Off', 'Roost'], 'Impish', { hp: 248, def: 112, spd: 128, spe: 20 }),
  member('Garchomp', 'Dragonium Z', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Outrage', 'Stealth Rock'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
  member('Victini', 'Choice Scarf', 'Victory Star', ['V-create', 'U-turn', 'Bolt Strike', 'Trick'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
  member('Zapdos', 'Heavy-Duty Boots', 'Static', ['Volt Switch', 'Hurricane', 'Heat Wave', 'Roost'], 'Bold', { hp: 248, def: 188, spe: 72 }),
  member('Iron Valiant', 'Choice Specs', 'Quark Drive', ['Moonblast', 'Focus Blast', 'Thunderbolt', 'Shadow Ball'], 'Timid', { def: 4, spa: 252, spe: 252 }),
  member('Ogerpon-Cornerstone', 'Cornerstone Mask', 'Sturdy', ['Ivy Cudgel', 'Power Whip', 'Swords Dance', 'Superpower'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
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

interface State { hash?: string; lang?: 'it' | 'en'; run?: (page: Page) => Promise<boolean | string> }
const STATES: Record<string, State> = {
  pokemon: { run: async p => { await tab(p, 'pokemon'); return true; } },
  editor: { run: async p => clickText(p, '.slot.filled > summary', /./) },
  analysis: { run: async p => { await tab(p, 'analysis'); return true; } },
  'analysis-defense': { run: async p => clickText(p, '.band button.grade-area', /^Difesa/) },
  'analysis-offense': { run: async p => clickText(p, '.band button.grade-area', /^Offesa/) },
  'analysis-roles': { run: async p => clickText(p, '.band button.grade-area', /^Ruoli/) },
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
    await p.waitForSelector('.coach-steps:not([aria-busy]) button.coach-fix', { timeout: 20000 });
    if (!await clickText(p, 'button.coach-fix', /./)) return false;
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
    if (!await clickText(p, '.team-type .help-button', /./)) return 'no help';
    await wait(300);
    return true;
  } },
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
    if (!await clickText(p, '.coach-prop.is-move button.coach-fix', /./)) return 'no move proposal';
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
    await page.evaluateOnNewDocument(l => { localStorage.clear(); localStorage.setItem('dreamdex.lang', JSON.stringify(l)); }, lang);
    await page.goto(URL + (state.hash ?? hash(TEAM)), { waitUntil: 'networkidle0' });
    await wait(1500);
    const result = state.run ? await state.run(page) : true;
    if (result !== true) { console.log(`skip ${name} @${w}x${h}: ${result === false ? 'element not found' : result}`); await page.close(); continue; }
    await wait(800);
    // pageScroll: quanto scorre la pagina; clipped: quanto della colonna principale resta tagliato (overflow nascosto)
    // dash: altezza e densità del cruscotto, fondo delle due colonne, testo tagliato nelle sezioni
    const { scroll, clipped, dash } = await page.evaluate(() => {
      const main = document.querySelector('.main');
      const box = document.querySelector<HTMLElement>('.dash');
      // Niente funzioni con nome qui dentro: tsx aggiunge __name, che nella pagina non esiste
      const [left, right] = ['.dash-left', '.dash-right'].map(sel => {
        const cards = box ? [...box.querySelectorAll<HTMLElement>(`${sel} > .dash-card, ${sel} > .dash-pair`)] : [];
        return Math.round(Math.max(0, ...cards.map(c => c.getBoundingClientRect().bottom)) * 10) / 10;
      });
      // Contenuto che sborda dalla sua sezione (oltre 1px) senza finire in un "+N"
      const over = box ? [...box.querySelectorAll<HTMLElement>('.dash-card')].filter(c => c.scrollHeight - c.clientHeight > 1)
        .map(c => c.className.split(' ').find(n => n.startsWith('dash-') && n !== 'dash-card')) : [];
      return {
        scroll: document.scrollingElement!.scrollHeight - window.innerHeight,
        clipped: main ? main.scrollHeight - main.clientHeight : 0,
        dash: box ? `dash=${box.clientHeight} density=${box.dataset.density} left=${left} right=${right} dashBottom=${Math.round(box.getBoundingClientRect().bottom)} overflow=[${over.join(',')}]` : '',
      };
    });
    // Coaching: tappe che sbordano, righe "risolve anche" o nomi tagliati in larghezza, scorrimento orizzontale
    const coach = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('.coaching');
      if (!box) return '';
      const steps = [...box.querySelectorAll<HTMLElement>('.coach-step')];
      const tall = steps.filter(s => s.scrollHeight - s.clientHeight > 1).length;
      const wide = [...box.querySelectorAll<HTMLElement>('.coach-also, .coach-fix-main strong, .coach-fix-lead')].filter(e => e.scrollWidth - e.clientWidth > 1).length;
      const row = box.querySelector('.coach-steps')?.getBoundingClientRect().height ?? 0;
      const need = Math.max(0, ...steps.map(s => [...s.querySelectorAll('.coach-step-body > *')].reduce((b, c) => Math.max(b, c.getBoundingClientRect().bottom), 0) - s.getBoundingClientRect().top));
      return `coach: stepsRow=${Math.round(row)} contentMax=${Math.round(need)} stepOverflow=${tall} clippedLines=${wide} hScroll=${box.scrollWidth - box.clientWidth} docHScroll=${document.scrollingElement!.scrollWidth - window.innerWidth}`;
    });
    const file = join(out, `${w}x${h}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${file} pageScroll=${scroll} clipped=${clipped} ${dash} ${coach}`);
    await page.close();
  }
}
await browser.close();
