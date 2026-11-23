/**
 * Foto ritagliate di ogni variante dei tooltip DreamDex (FloatTip, `.ftip.<classe>`) e un foglio unico per confrontarle.
 * Serve il server di sviluppo (APP_URL, predefinito http://localhost:5173/).
 *   npx tsx scripts/tooltip-shots.ts --out <cartella> [--scenes a,b] [--explore]
 * Per ogni scena: prepara la pagina, poi passa col mouse sugli elementi che aprono un tooltip (gestori React del mouse,
 * data-move-tip / data-item-tip / data-ability-tip) finché ogni variante voluta si è aperta; la foto è il riquadro del
 * tooltip con 16px di margine. `--explore`: niente foto, stampa quale elemento apre quale classe.
 * Alla fine 00-sheet.png (o 00-sheet-1.png, 00-sheet-2.png...): la griglia di tutte le foto con nome, classe e file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const out = resolve(arg('out') ?? 'tooltip-shots');
const explore = process.argv.includes('--explore');
const PAD = 16;
const W = 1440, H = 900;

const member = (species: string, item: string, ability: string, moves: string[], nature: string, evs: Record<string, number>) =>
  ({ species, item, ability, moves, nature, evs });
const TEAM = [
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 }),
  member('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Haze', 'Recover', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
  member('Iron Valiant', 'Choice Specs', 'Quark Drive', ['Moonblast', 'Focus Blast', 'Thunderbolt', 'Shadow Ball'], 'Timid', { def: 4, spa: 252, spe: 252 }),
  member('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'Roost', 'U-turn'], 'Impish', { hp: 248, def: 168, spd: 92 }),
];
const SIX = [...TEAM, member('Gholdengo', 'Air Balloon', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot'], 'Timid', { spa: 252, spe: 252, def: 4 })];
const RAIN = [
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Surf', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Flip Turn', 'Psychic Fangs'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
  member('Zapdos', 'Heavy-Duty Boots', 'Static', ['Thunder', 'Hurricane', 'Roost', 'Heat Wave'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  member('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Stealth Rock', 'Spikes', 'Leech Seed', 'Power Whip'], 'Relaxed', { hp: 252, def: 252, spd: 4 }),
  member('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 }),
  member('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
];
const STRESS = [
  member('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Surf', 'U-turn', 'Roost'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  member('Tapu Koko', 'Heavy-Duty Boots', 'Electric Surge', ['Dazzling Gleam', 'U-turn', 'Roost', 'Defog'], 'Timid', { hp: 248, spe: 252, spd: 8 }),
  member('Hippowdon', 'Choice Specs', 'Sand Stream', ['Trick Room', 'Calm Mind', 'Earth Power', 'Stealth Rock'], 'Quiet', { hp: 252, spa: 252, spd: 4 }),
  member('Luvdisc', 'Choice Scarf', 'Swift Swim', ['Surf', 'Ice Beam', 'Charm', 'Sweet Kiss'], 'Timid', { atk: 252, spe: 252, hp: 4 }),
  member('Excadrill', 'Leftovers', 'Sand Rush', ['Earthquake', 'Iron Head', 'Stealth Rock', 'Swords Dance'], 'Jolly', { atk: 252, spe: 252, hp: 4 }),
  member('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Flip Turn', 'Swords Dance'], 'Adamant', { atk: 252, spe: 252, hp: 4 }),
];
const SPEED_SIX = [...TEAM, member('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid', { spa: 252, spe: 252, hp: 4 })];
const FORMAT = { formatId: 'ou', genLimit: 9, minUsage: 0.01, allowMultipleMegas: false, ignoreBans: false, meta: true };
const hash = (team: unknown[]) => '#team=' + Buffer.from(JSON.stringify({ team, format: FORMAT })).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const tab = (page: Page, id: string) => page.evaluate(i => { document.getElementById(`tab-${i}`)?.click(); }, id);
async function clickText(page: Page, selector: string, text: RegExp): Promise<boolean> {
  return page.evaluate((sel, src, flags) => {
    const re = new RegExp(src, flags);
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find(e => re.test(e.getAttribute('aria-label') ?? '') || re.test(e.textContent ?? ''));
    if (!el) return false;
    el.click();
    return true;
  }, selector, text.source, text.flags);
}
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
/** Apre un'area del voto (Difesa, Offesa, Velocità, Ruoli) e, se serve, una sotto-scheda. */
const area = (row: RegExp, sub?: RegExp, collapse = false) => async (p: Page) => {
  await tab(p, 'analysis');
  await wait(400);
  if (!await gradeRow(p, row)) return 'no grade row';
  await wait(400);
  if (collapse) { await clickText(p, 'button.band-toggle', /./); await wait(900); }
  if (sub && !await clickText(p, '.area-subs [role="tab"]', sub)) return 'no sub-tab';
  await wait(700);
  return true;
};
const analysisTab = (name: RegExp) => async (p: Page) => {
  await tab(p, 'analysis');
  await wait(400);
  if (!await clickText(p, '.analysis-tabs [role="tab"]', name)) return 'no analysis tab';
  await wait(1000);
  return true;
};
const openEditor = async (p: Page) => {
  if (!await clickText(p, '.slot.filled > .slot-card', /./)) return 'no slot';
  await wait(700);
  return true;
};
const pickDuel = async (p: Page, opp = 'Gholdengo') => {
  const ok = await openEditor(p);
  if (ok !== true) return ok;
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
  if (!picked) return 'no option';
  await wait(1500);
  return true;
};

/** Una variante voluta: la classe del tooltip (selettore su .ftip), da quale elemento (facoltativo), il file sorgente. */
interface Want { id: string; tip: string; trigger?: string; src: string; where: string; not?: string }
/**
 * Una scena: la pagina preparata (`team`, `setup`), dove cercare gli elementi (`scope`) e le varianti volute. `custom`:
 * una scena fatta a mano (es. tendina aperta con le frecce), che restituisce l'elemento da fotografare.
 */
interface Scene {
  id: string; team?: unknown[]; setup?: (p: Page) => Promise<boolean | string>; scope?: string; wants: Want[];
  custom?: (p: Page) => Promise<string | true>;
  max?: number;
}

const SCENES: Scene[] = [
  { id: 'team', team: SIX, setup: async p => { await tab(p, 'pokemon'); await wait(2500); return true; }, scope: '.band, .suggestions, .detail, main', wants: [
    { id: 'member-team', tip: '.ftip.member', trigger: '.slot-card', src: 'MemberCard.tsx (useMemberTip in TeamPanel.tsx)', where: 'Team: hover a team member card' },
    { id: 'member-candidate', tip: '.ftip.member', trigger: '.suggestions li.card', src: 'MemberCard.tsx (useMemberTip in CandidateCard.tsx)', where: 'Pokémon tab: hover a candidate card' },
    { id: 'move', tip: '.ftip.move:not(.kit)', trigger: '[data-move-tip]', src: 'MoveTip.tsx (TipHost)', where: 'Pokémon tab: hover a move pill' },
    { id: 'kit-item', tip: '.ftip.move.kit', trigger: '[data-item-tip]', src: 'MoveTip.tsx KitTipBody kind=item', where: 'Pokémon tab: hover an item' },
    { id: 'kit-ability', tip: '.ftip.move.kit', trigger: '[data-ability-tip]', src: 'MoveTip.tsx KitTipBody kind=ability', where: 'Pokémon tab: hover an ability' },
  ] },
  { id: 'editor', team: SIX, setup: openEditor, scope: '.slot.open', wants: [
    { id: 'speed-line', tip: '.ftip.speed', trigger: '.speed-line-anchor', src: 'SpeedLine.tsx', where: 'Editor: hover the "Più veloce del X% del meta" line' },
  ] },
  { id: 'combo-item', team: SIX, setup: openEditor, wants: [
    { id: 'combobox-item', tip: '.ftip', src: 'Combobox.tsx optionTip (SetEditor itemTipOf)', where: 'Editor: open the Strumento dropdown, ArrowDown' },
  ], custom: async p => comboTip(p, 0) },
  { id: 'combo-move', team: SIX, setup: openEditor, wants: [
    { id: 'combobox-move', tip: '.ftip', src: 'Combobox.tsx optionTip (SetEditor moveTipOf)', where: 'Editor: open a move dropdown, ArrowDown' },
  ], custom: async p => comboTip(p, 'move') },
  { id: 'duel', team: SIX, setup: p => pickDuel(p), scope: '.slot.open', wants: [
    { id: 'duel-fx', tip: '.ftip.duel-fx-tip', src: 'DuelTips.tsx (duel-fx-tip)', where: 'Editor Sfida vs Gholdengo: open a tip card, hover the count' },
  ], custom: async p => {
    const chip = await p.$('.slot.open .duel-tip-chip:not(.out)');
    if (!chip) return 'no tip chip';
    await chip.click();
    await wait(1500);
    return true;
  } },
  { id: 'dash', team: SIX, setup: async p => { await tab(p, 'analysis'); await wait(1500); return true; }, scope: '.dash', max: 140, wants: [
    { id: 'member-summary', tip: '.ftip.member', src: 'SummarySection.tsx (member)', where: 'Analisi overview, Riassunto: hover a crew sprite' },
    { id: 'syn-more', tip: '.ftip.syn-more', src: 'SummarySection.tsx (syn-more)', where: 'Analisi overview, Riassunto: hover "+N"' },
    { id: 'core', tip: '.ftip.core', src: 'SummarySection.tsx (core)', where: 'Analisi overview, Riassunto: hover a core' },
    { id: 'role', tip: '.ftip.role', src: 'dashboard/RolesSection.tsx', where: 'Analisi overview, Ruoli: hover a role chip' },
    { id: 'speed-dash', tip: '.ftip.speed', src: 'dashboard/SpeedSection.tsx', where: 'Analisi overview, Velocità: hover a bar' },
    { id: 'coverage-off', tip: '.ftip.offense', trigger: '.dash-matrix tbody tr:nth-child(1) .dash-cell', src: 'dashboard/CoverageSection.tsx (side=offense)', where: 'Analisi overview, Coverage: hover an offense cell' },
    { id: 'coverage-def', tip: '.ftip.defense', trigger: '.dash-matrix tbody tr:nth-child(2) .dash-cell', src: 'dashboard/CoverageSection.tsx (side=defense)', where: 'Analisi overview, Coverage: hover a defense cell' },
    { id: 'thr-tip', tip: '.ftip.thr-tip', src: 'dashboard/ThreatsSection.tsx', where: 'Analisi overview, Minacce: hover a threat' },
  ] },
  { id: 'dash-rain', team: RAIN, setup: async p => { await tab(p, 'analysis'); await wait(1500); return true; }, scope: '.dash', max: 140, wants: [
    { id: 'cond-rain', tip: '.ftip.cond', src: 'SummarySection.tsx (cond)', where: 'Analisi overview (RAIN), Riassunto: hover a condition' },
  ] },
  { id: 'dash-stress', team: STRESS, setup: async p => { await tab(p, 'analysis'); await wait(1500); return true; }, scope: '.dash', max: 140, wants: [1, 2, 3, 4].map(n => (
    { id: `cond-stress-${n}`, tip: '.ftip.cond', trigger: 'button.sum-line', src: 'SummarySection.tsx (cond)', where: 'Analisi overview (STRESS: rain, terrain, sand, Trick Room), Riassunto: hover a condition' })) },
  { id: 'def-general', team: SIX, setup: area(/^(Difesa|Defense)/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'dsh-tip', tip: '.ftip.dsh-tip', trigger: '.og-share.dsh', src: 'defense/DefenseGeneral.tsx (dsh-tip)', where: 'Difesa › Generale: hover a member share (%)' },
    { id: 'kot-hold', tip: '.ftip.kot', trigger: '.kob.hb', src: 'defense/HoldBars.tsx (kot, bar piece)', where: 'Difesa › Generale: hover a hold-bar piece' },
    { id: 'kot-hold-count', tip: '.ftip.kot', trigger: '.kob-count', src: 'defense/HoldBars.tsx (kot, countTip)', where: 'Difesa › Generale: hover a hold count' },
    { id: 'area-chip', tip: '.ftip.area-chip-tip, .ftip.thr-tip', trigger: '.area-chip', src: 'ProblemPill.tsx (ProblemChip in AreaView; a threat: ThreatTip)', where: 'Difesa: hover a problem pill in the area head' },
    { id: 'kot-more-problems', tip: '.ftip.area-more-tip', trigger: '.area-chips-more', src: 'ProblemPill.tsx (MoreProblems)', where: 'Difesa: hover "+N" problems' },
    { id: 'gat-guide-ask', tip: '.ftip.gat', trigger: 'th:nth-child(2) > .guide-ask', src: 'offense/TargetsTip.tsx (Ask, gat) + defense/HoldBars.tsx TypeAttackers', where: 'Difesa › Generale: hover the Tipi head "?"' },
    { id: 'gat-def-meta', tip: '.ftip.gat', trigger: 'th:nth-child(3) > .guide-ask', src: 'offense/TargetsTip.tsx (Ask, MetaTargets shield)', where: 'Difesa › Generale: hover the Meta head "?"' },
  ] },
  { id: 'def-general-collapsed', team: SIX, setup: area(/^(Difesa|Defense)/, undefined, true), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'dht-hold', tip: '.ftip.tht.dht', trigger: '.mcs.wh .mc', src: 'defense/HoldBars.tsx (tht dht, worst hit by type)', where: 'Difesa › Generale (team collapsed): hover a worst-hit type pill' },
    { id: 'tht-hold', tip: '.ftip.tht:not(.dht)', trigger: '.mcs.wh .mc', src: 'defense/HoldBars.tsx (tht, worst hit by meta Pokémon)', where: 'Difesa › Generale (team collapsed): hover a worst-hit Pokémon pill' },
  ] },
  { id: 'def-types', team: RAIN, setup: area(/^(Difesa|Defense)/, /^Coverage tipi/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'tst-def', tip: '.ftip.tst', src: 'defense/DefenseTypes.tsx (tst)', where: 'Difesa › Coverage tipi: hover a type column head' },
    { id: 'dht-def', tip: '.ftip.tht.dht', src: 'defense/DefenseTypes.tsx (tht dht)', where: 'Difesa › Coverage tipi: hover a cell' },
    { id: 'kot-weather-notes', tip: '.ftip.weather-tip', trigger: '.ht-notes', src: 'defense/DefenseTypes.tsx (kot, NotesLine)', where: 'Difesa › Coverage tipi (RAIN): hover the weather notes' },
  ] },
  { id: 'def-meta', team: SIX, setup: area(/^(Difesa|Defense)/, /^Coverage meta/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'tht-def-meta', tip: '.ftip.tht', src: 'defense/DefenseMeta.tsx (tht)', where: 'Difesa › Coverage meta: hover a cell' },
  ] },
  { id: 'off-general', team: SIX, setup: area(/^Offe(sa|nse)/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'kot-ko', tip: '.ftip.kot', trigger: '.kob.ohko', src: 'offense/KoBadges.tsx (kot, KO band)', where: 'Offesa › Generale: hover a KO badge' },
    { id: 'kot-ko-rest', tip: '.ftip.kot', trigger: '.kob.rest', src: 'offense/KoBadges.tsx (kot, rest band)', where: 'Offesa › Generale: hover the "rest" badge' },
    { id: 'kot-offgen', tip: '.ftip.dsh-tip', trigger: '.og-share', src: 'offense/OffenseGeneral.tsx (dsh-tip, like Difesa)', where: 'Offesa › Generale: hover a member share (%)' },
    { id: 'gat-off-types', tip: '.ftip.gat', trigger: 'th:nth-child(2) > .guide-ask', src: 'offense/TargetsTip.tsx (Ask, TypeAverages)', where: 'Offesa › Generale: hover the Tipi head "?"' },
    { id: 'gat-off-meta', tip: '.ftip.gat', trigger: 'th:nth-child(3) > .guide-ask', src: 'offense/TargetsTip.tsx (Ask, MetaTargets sword)', where: 'Offesa › Generale: hover the Meta head "?"' },
  ] },
  { id: 'off-general-collapsed', team: SIX, setup: area(/^Offe(sa|nse)/, undefined, true), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'kot-chip', tip: '.ftip.kot', trigger: '.mcs .mcp', src: 'offense/MoveChips.tsx (kot)', where: 'Offesa › Generale (team collapsed): hover a move chip' },
  ] },
  { id: 'off-types', team: SIX, setup: area(/^Offe(sa|nse)/, /^Coverage tipi/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'tst-off', tip: '.ftip.tst', src: 'offense/OffenseTypes.tsx (tst)', where: 'Offesa › Coverage tipi: hover a type head' },
    { id: 'tht-off', tip: '.ftip.tht', src: 'offense/OffenseTypes.tsx (tht)', where: 'Offesa › Coverage tipi: hover a cell' },
  ] },
  { id: 'off-meta', team: SIX, setup: area(/^Offe(sa|nse)/, /^Coverage meta/), scope: '.tab-panel.active', max: 120, wants: [
    { id: 'tht-off-meta', tip: '.ftip.tht', src: 'offense/OffenseMeta.tsx (tht)', where: 'Offesa › Coverage meta: hover a cell' },
  ] },
  { id: 'speed', team: SPEED_SIX, setup: area(/^(Velocit|Speed)/), scope: '.tab-panel.active', max: 100, wants: [
    { id: 'speed-general', tip: '.ftip.speed', src: 'speed/SpeedGeneral.tsx (speed)', where: 'Velocità › Generale: hover a speed bar' },
    { id: 'sp-prio', tip: '.ftip.sp-prio-ftip', src: 'speed/SpeedGeneral.tsx (sp-prio-ftip)', where: 'Velocità › Generale: hover the priority mark' },
  ] },
  { id: 'speed-guide', team: SPEED_SIX, setup: async p => {
    const ok = await area(/^(Velocit|Speed)/)(p);
    if (ok !== true) return ok;
    if (!await clickText(p, 'button.area-help', /./)) return 'no guide button';
    await wait(600);
    return true;
  }, scope: '.help-panel', wants: [
    { id: 'gat-speed-guide', tip: '.ftip.gat', trigger: '.guide-ask', src: 'speed/SpeedGuide.tsx GainTip (via TargetsTip Ask, gat)', where: 'Velocità guide: hover a "?"' },
  ] },
  { id: 'bonus-stress', team: STRESS, setup: analysisTab(/^(Ruoli e Bonus|Roles & Bonus)/), scope: '.bm', wants: [
    { id: 'bm-row', tip: '.ftip.bm-row-tip', trigger: '.bm-row', src: 'BonusMalusView.tsx (bm-row-tip)', where: 'Ruoli e Bonus (STRESS): hover a bonus/malus row' },
    { id: 'bm-more', tip: '.ftip.bm-more-tip', trigger: '.bm-more-cell', src: 'BonusMalusView.tsx (bm-row-tip, +N more)', where: 'Ruoli e Bonus (STRESS): hover "+N altre"' },
    { id: 'bm-held', tip: '.ftip.bm-held-tip', trigger: '.bm-core-held', src: 'BonusMalusView.tsx (bm-held-tip)', where: 'Ruoli e Bonus (SIX): hover "Reggono N/18" of a core' },
  ] },
  { id: 'fill', team: TEAM.slice(0, 3), setup: async p => {
    await p.evaluate(() => (document.querySelector('[data-fill-toggle]') as HTMLElement | null)?.click());
    try { await p.waitForSelector('.fill-panel', { timeout: 10000 }); } catch { return 'no fill panel'; }
    await wait(2500);
    return true;
  }, scope: '.fill-panel', wants: [
    { id: 'fill-option', tip: '.ftip.fill-option-tip', trigger: '.fill-option', src: 'FillPanel.tsx (kot fill-option-tip)', where: 'Completa team panel: hover an option' },
  ] },
];

/** Tendina dell'editor aperta e una voce più giù con le frecce: il tooltip della voce (Combobox optionTip). */
async function comboTip(p: Page, which: number | 'move'): Promise<string | true> {
  // La tendina della mossa o quella con l'etichetta Strumento
  const found = await p.evaluate(w => {
    const all = [...document.querySelectorAll<HTMLElement>('.slot.open [role="combobox"]')];
    const box = w === 'move' ? document.querySelector('.slot.open .editor-group.moves [role="combobox"]')
      : all.find(b => /Strumento/i.test((b.getAttribute('aria-label') ?? '') + ' ' + (b.closest('.field, .set-plate, label')?.textContent ?? '')));
    if (!box) return all.map(b => b.getAttribute('aria-label')).join('|');
    box.setAttribute('data-combo', '1');
    return true;
  }, which === 'move' ? 'move' : 'item');
  if (found !== true) return `no combobox (${found})`;
  const box = (await p.$('[data-combo]'))!;
  await box.click();
  await wait(500);
  await p.keyboard.press('ArrowDown');
  await wait(250);
  await p.keyboard.press('ArrowDown');
  await wait(700);
  return true;
}

/** Il primo tooltip DreamDex visibile (non i fumetti di solo testo). */
const OPEN_TIP = `(() => { const t = [...document.querySelectorAll('.ftip:not(.hint)')].find(e => getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().width > 0); if (!t) return null; t.setAttribute('data-shot', '1'); return t.className; })()`;

/** Segna gli elementi che aprono un tooltip (gestori React del mouse o attributi del TipHost) dentro `scope`, a gruppi per classe. */
async function markCandidates(p: Page, scope: string, triggers: string[], max: number): Promise<{ id: number; sig: string }[]> {
  return p.evaluate((scopeSel, trig, cap) => {
    document.querySelectorAll('[data-tsid]').forEach(e => e.removeAttribute('data-tsid'));
    const roots = scopeSel ? [...document.querySelectorAll(scopeSel)] : [document.body];
    const seen = new Map<string, number>();
    const list: { id: number; sig: string }[] = [];
    let n = 0;
    const visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    const push = (e: Element, perSig: number, group = '') => {
      if (e.hasAttribute('data-tsid') || !visible(e) || e.closest('.ftip')) return;
      const sig = `${e.tagName.toLowerCase()}.${(typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).slice(0, 3).join('.')}`;
      const k = seen.get(group + sig) ?? 0;
      if (k >= perSig) return;
      seen.set(group + sig, k + 1);
      e.setAttribute('data-tsid', String(n));
      list.push({ id: n++, sig });
    };
    // Prima gli elementi indicati dalle varianti, poi gli altri
    for (const t of trig) for (const r of roots) { if (r.matches(t)) push(r, 4, t); r.querySelectorAll(t).forEach(e => push(e, 4, t)); }
    for (const r of roots) {
      for (const e of [r, ...r.querySelectorAll('*')]) {
        if (list.length >= cap) break;
        const key = Object.keys(e).find(k => k.startsWith('__reactProps$'));
        const props = key ? (e as unknown as Record<string, Record<string, unknown>>)[key] : null;
        const hover = props && (props.onMouseEnter || props.onPointerEnter || props.onMouseOver || props.onPointerOver);
        if (hover || e.matches('[data-move-tip], [data-item-tip], [data-ability-tip]')) push(e, 2);
      }
    }
    return list.slice(0, cap);
  }, scope, triggers, max);
}

async function awayAndClosed(p: Page) {
  await p.mouse.move(W - 3, H - 3);
  for (let i = 0; i < 8; i++) {
    if (!await p.evaluate(OPEN_TIP)) return;
    await wait(60);
  }
}

interface Shot { file: string; cls: string; src: string; where: string; w: number; h: number }
const shots: Shot[] = [];
const missing: string[] = [];
let counter = 1;

async function shoot(p: Page, want: Want, cls: string) {
  // Aspetta la fine della dissolvenza d'entrata (ftip-in, 0,16s): con la pagina occupata a calcolare può durare di più,
  // e una foto a metà sembra un tooltip trasparente
  const fade = await p.evaluate(async () => {
    const t = document.querySelector('[data-shot]');
    if (!t) return null;
    const anims = t.getAnimations({ subtree: true }).filter(a => a.playState !== 'finished' && a.effect?.getTiming().iterations !== Infinity);
    await Promise.race([Promise.all(anims.map(a => a.finished.catch(() => null))), new Promise(res => setTimeout(res, 3000))]);
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    let op = 1;
    for (let e: Element | null = t; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    return { waited: anims.length, opacity: Math.round(op * 1000) / 1000 };
  });
  if (fade && fade.opacity < 1) console.log(`  warning ${want.id}: tooltip opacity ${fade.opacity} at shot time`);
  const r = await p.evaluate(() => {
    const t = document.querySelector('[data-shot]');
    if (!t) return null;
    const b = t.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  await p.evaluate(() => document.querySelectorAll('[data-shot]').forEach(e => e.removeAttribute('data-shot')));
  if (!r || r.w <= 0 || r.h <= 0) { missing.push(`${want.id}: tooltip found but empty box`); return; }
  const x = Math.max(0, r.x - PAD), y = Math.max(0, r.y - PAD);
  const clip = { x, y, width: Math.min(W, r.x + r.w + PAD) - x, height: Math.min(H, r.y + r.h + PAD) - y };
  const file = `${String(counter++).padStart(2, '0')}-${want.id}.png`;
  await p.screenshot({ path: join(out, file), clip, captureBeyondViewport: false });
  shots.push({ file, cls: cls.replace(/\bftip\b|\bat-\w+\b/g, '').trim().replace(/\s+/g, ' '), src: want.src, where: want.where, w: Math.round(r.w), h: Math.round(r.h) });
  console.log(`  shot ${file} class="${cls}" ${Math.round(r.w)}x${Math.round(r.h)}`);
}

async function runScene(browser: Browser, scene: Scene) {
  console.log(`scene ${scene.id}`);
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H });
  // tsx adds __name around named functions inside evaluate: define it in the page
  await p.evaluateOnNewDocument('window.__name = (f) => f;');
  await p.evaluateOnNewDocument(() => { localStorage.clear(); localStorage.setItem('dreamdex.lang', JSON.stringify('it')); });
  await p.goto(URL + hash(scene.team ?? SIX), { waitUntil: 'networkidle0', timeout: 90000 });
  await wait(1500);
  const ready = scene.setup ? await scene.setup(p) : true;
  if (ready !== true) { for (const w of scene.wants) missing.push(`${w.id}: setup failed (${ready === false ? 'element not found' : ready})`); await p.close(); return; }
  const todo = [...scene.wants];
  if (scene.custom) {
    const ok = await scene.custom(p);
    if (ok !== true) { for (const w of todo) missing.push(`${w.id}: ${ok}`); await p.close(); return; }
    // Tendine: il tooltip è già aperto
    if (scene.id.startsWith('combo')) {
      const cls = await p.evaluate(OPEN_TIP) as string | null;
      if (cls && !explore) await shoot(p, todo[0], cls); else if (!cls) missing.push(`${todo[0].id}: no option tooltip after ArrowDown`);
      else console.log(`  explore: combo -> ${cls}`);
      await p.close();
      return;
    }
    // La Sfida: la carta del consiglio (popover, non FloatTip) prima del suo tooltip
    if (scene.id === 'duel' && !explore) {
      // Aspetta che il consiglio sia calcolato (niente "Calcolo…")
      try { await p.waitForFunction(() => !document.querySelector('.duel-tip-card .duel-tip-busy'), { timeout: 20000 }); } catch { /* foto com'è */ }
      const card = await p.evaluate(() => { const c = document.querySelector('.duel-tip-card'); if (!c) return null; c.setAttribute('data-shot', '1'); return c.className; });
      if (card) await shoot(p, { id: 'duel-tip-card', tip: '.duel-tip-card', src: 'DuelTips.tsx (.duel-tip-card popover, not FloatTip)', where: 'Editor Sfida vs Gholdengo: click a tip chip' }, `popover ${card}`);
      else missing.push('duel-tip-card: card did not open');
    }
  }
  await wait(2000);
  const triggers = todo.map(w => w.trigger).filter((t): t is string => !!t);
  const cands = await markCandidates(p, scene.scope ?? '', triggers, scene.max ?? 80);
  console.log(`  ${cands.length} candidates`);
  if (explore) console.log(`  sigs: ${cands.map(c => c.sig).join(' ')}\n  dash cards: ${await p.evaluate(() => [...document.querySelectorAll('.dash-card')].map(c => c.className).join(' | '))}`);
  const started = Date.now();
  for (const c of cands) {
    if (!todo.length && !explore) break;
    if (Date.now() - started > 150000) { console.log('  time budget hit'); break; }
    const el = await p.$(`[data-tsid="${c.id}"]`);
    if (!el) continue;
    await awayAndClosed(p);
    try { await el.hover(); } catch { continue; }
    let cls: string | null = null;
    for (let i = 0; i < 9 && !cls; i++) { await wait(110); cls = await p.evaluate(OPEN_TIP) as string | null; }
    if (!cls) continue;
    await wait(250);
    if (explore) { console.log(`  ${c.sig} -> ${cls}`); continue; }
    const i = await p.evaluate((wants: { tip: string; trigger?: string; not?: string }[], id: number) => {
      const t = document.querySelector('[data-shot]');
      const src = document.querySelector(`[data-tsid="${id}"]`);
      if (!t || !src) return -1;
      return wants.findIndex(w => t.matches(w.tip) && (!w.trigger || !!src.closest(w.trigger) || src.matches(w.trigger)));
    }, todo.map(w => ({ tip: w.tip, trigger: w.trigger })), c.id);
    if (process.argv.includes('--verbose')) console.log(`  ${c.sig} -> ${cls} ${i < 0 ? '(no want)' : ''}`);
    if (i < 0) continue;
    const [want] = todo.splice(i, 1);
    await shoot(p, want, cls);
  }
  for (const w of todo) missing.push(`${w.id}: not opened by any of ${cands.length} hovered elements in ${scene.scope ?? 'page'}`);
  await p.close();
}

async function sheet(browser: Browser) {
  const PER = 12;
  const pages = Math.ceil(shots.length / PER);
  for (let k = 0; k < pages; k++) {
    const part = shots.slice(k * PER, (k + 1) * PER);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d0f14;color:#dfe3ea;font:13px/1.35 system-ui,Segoe UI,sans-serif;padding:24px}
      h1{font-size:18px;margin:0 0 16px;color:#fff}
      .grid{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
      figure{margin:0;background:#161a22;border:1px solid #2a3040;border-radius:10px;padding:12px;width:440px;box-sizing:border-box}
      .img{display:flex;justify-content:center;align-items:center;background:#0d0f14;border-radius:6px;min-height:80px}
      img{max-width:414px;height:auto;display:block}
      figcaption{margin-top:8px} b{color:#fff} code{color:#f0a8d0;font:12px Consolas,monospace} small{color:#8a93a6;display:block}
    </style><h1>DreamDex tooltips${pages > 1 ? ` (${k + 1}/${pages})` : ''}</h1><div class="grid">${part.map(s => `<figure><div class="img"><img src="${pathToFileURL(join(out, s.file)).href}"></div>
      <figcaption><b>${esc(s.file)}</b> <code>.${esc(s.cls.replace(/ /g, '.'))}</code><small>${esc(s.src)}</small><small>${esc(s.where)} · ${s.w}x${s.h}</small></figcaption></figure>`).join('')}</div>`;
    const file = join(out, `00-sheet${pages > 1 ? `-${k + 1}` : ''}.html`);
    writeFileSync(file, html);
    const p = await browser.newPage();
    await p.setViewport({ width: 24 * 2 + 440 * 3 + 20 * 2, height: 800 });
    await p.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await p.screenshot({ path: file.replace(/\.html$/, '.png'), fullPage: true });
    await p.close();
    console.log(`sheet ${file.replace(/\.html$/, '.png')}`);
  }
}

const chosen = arg('scenes')?.split(',');
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
try {
  for (const scene of SCENES) if (!chosen || chosen.includes(scene.id)) await runScene(browser, scene);
  if (!explore && shots.length) {
    writeFileSync(join(out, 'shots.json'), JSON.stringify({ shots, missing }, null, 2));
    if (!chosen) await sheet(browser);
  }
} finally {
  await browser.close();
}
console.log(`\n${shots.length} shots`);
if (missing.length) console.log(`missing:\n  ${missing.join('\n  ')}`);
