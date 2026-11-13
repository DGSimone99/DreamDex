import { MISSING_BELOW } from '../../src/engine/needs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { AreaView } from '../../src/ui/AreaView';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, importShowdown, type TeamSet } from '../../src/engine/sets';
import { GradeBadge } from '../../src/ui/RatingPanel';
import { IMPORTANT_POINTS, MINOR_POINTS, type TeamRoles } from '../../src/engine/rolesArea';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const ROLES_TEAM = [
  'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Body Press\n- Iron Defense\n- Roost\n- Defog',
  'Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Toxic\n- Protect\n- Stealth Rock',
  'Zapdos @ Heavy-Duty Boots\nAbility: Static\nEVs: 248 HP / 8 SpA / 252 Spe\nTimid Nature\n- Thunderbolt\n- Hurricane\n- Taunt\n- Roost',
].join('\n\n');

async function importRolesTeam(lang: 'it' | 'en' = 'it') {
  const user = userEvent.setup();
  render(<App initialLang={lang} data={fixtureData} />);
  await user.click(screen.getByLabelText(lang === 'it' ? 'Testo Showdown' : 'Showdown text'));
  await user.paste(ROLES_TEAM);
  await user.click(screen.getByRole('button', { name: lang === 'it' ? 'Importa' : 'Import' }));
  return { user, rating: document.querySelector<HTMLElement>('.band')! };
}

async function openRoles(lang: 'it' | 'en' = 'it') {
  const { user, rating } = await importRolesTeam(lang);
  const bar = within(rating).getByRole('button', { name: lang === 'it' ? /^Ruoli \d+\/\d+, .+, apri il dettaglio/ : /^Roles \d+\/\d+, .+, open details/ });
  await user.click(bar);
  // La scheda Ruoli di Analisi, sulla pagina
  const view = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
  return { user, bar, view };
}

const tabNames = (view: HTMLElement) => within(view).getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);
/** Le righe di una sottoscheda di livello, per nome del ruolo. */
const levelRow = (name: string, root: HTMLElement = screen.getByRole('tabpanel')) => within(root).getAllByRole('row').find(r => r.querySelector('th[scope="row"]')?.textContent === name)!;
/** Gli Pokémon di una riga (le icone hanno il nome nascosto per lo screen reader). */
const monsOf = (el: HTMLElement) => [...el.querySelectorAll('.rl-mon')].map(m => m.querySelector('.visually-hidden')!.textContent);

describe('Ruoli a schede: Generale e una per livello', () => {
  it('Generale, poi Essenziali, Importanti, Minori coi coperti sul totale e Non contano col numero', async () => {
    const { view } = await openRoles();
    expect(tabNames(view)).toEqual(['Generale', 'Essenziali', 'Importanti', 'Minori', 'Non contano']);
    const tabs = within(view).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    for (const tab of tabs.slice(1, 4)) expect(tab.querySelector('b')!.textContent).toMatch(/^\d+\/\d+$/);
    expect(tabs[4].querySelector('b')!.textContent).toMatch(/^\d+$/);
    // Il team incompleto si giudica come Balance: cinque essenziali (Sweeper o Wallbreaker è una voce sola dal 2026-11-13)
    expect(tabs[1].querySelector('b')!.textContent).toMatch(/\/5$/);
    // Il Generale porta i Ruoli coperti sul totale, come la riga del voto
    expect(tabs[0].querySelector('b')!.textContent).toMatch(/^\d+\/\d+$/);
  });

  it('una sottoscheda: ruolo, valore, chi lo copre e motivo, sotto le famiglie', async () => {
    const { user, view } = await openRoles();
    await user.click(within(view).getByRole('tab', { name: /^Non contano/ }));
    const table = within(view.querySelector<HTMLElement>('.area-panel')!).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Ruolo', 'Valore', 'Chi lo copre', 'Motivo']);
    // Taunt non conta nel Balance: la quota del meta superata in velocità
    const area = view.querySelector<HTMLElement>('.area-panel')!;
    expect(levelRow('Taunt', area)).toHaveTextContent(/Taunt, più veloce del \d+% del (meta|tier)/);
    expect(monsOf(levelRow('Taunt', area))).toEqual(['Zapdos']);
    // Le righe stanno sotto le famiglie, una riga di gruppo per famiglia
    expect([...table.querySelectorAll('.rl-fam th')].map(th => th.textContent)).toContain('Utility');
    // Chi non ha nessuno lo dice
    expect(levelRow('Encore', area)).toHaveTextContent('Nessuno');
    await user.click(within(view).getByRole('tab', { name: /^Minori/ }));
    expect(view.querySelector('.area-panel')).toHaveTextContent(/Toxic: \d+% del (meta|tier) non immune/);
  });

  it('la riga Ruoli del voto: coperti/totale e le mancanze a segni (numero e triangolo), senza barra', async () => {
    const { bar } = await openRoles();
    expect(bar).toHaveClass('grade-roles');
    expect(bar.querySelector('.meter')).toBeNull();
    expect(bar).toHaveTextContent(/^Ruoli\d+\/\d+(\d+)+$/);
    expect(bar.querySelector('.grade-roles-miss svg')).not.toBeNull();
    // A parole nel nome del pulsante
    expect(bar).toHaveAccessibleName(/(\d+ mancano|1 manca)/);
  });

  it('la riga Ruoli del voto: triangolo rosso per gli essenziali che mancano, giallo per gli importanti', () => {
    const rating = rateTeam(importShowdown(ROLES_TEAM).sets, fixtureData)!;
    renderIt(<GradeBadge rating={rating} />);
    const missing = (level: string) => rating.roles.rows.filter(r => r.level === level && r.value < MISSING_BELOW).length;
    const bad = document.querySelector('.grade-roles-miss.bad');
    const warn = document.querySelector('.grade-roles-miss.warn');
    expect(missing('essential') + missing('important')).toBeGreaterThan(0);
    if (missing('essential')) expect(bad).toHaveTextContent(String(missing('essential'))); else expect(bad).toBeNull();
    if (missing('important')) expect(warn).toHaveTextContent(String(missing('important'))); else expect(warn).toBeNull();
  });

  it('in inglese', async () => {
    const { view } = await openRoles('en');
    expect(tabNames(view)).toEqual(['General', 'Essential', 'Important', 'Minor', "Don't count"]);
  });

  it('il ? sta sul Generale: Come funziona, Ruoli per tipo di team e come si ottiene un ruolo (tre pagine)', async () => {
    const { user, view } = await openRoles();
    await user.click(within(view).getByRole('button', { name: 'Come funziona Generale' }));
    const dialog = screen.getByRole('dialog', { name: /Ruoli/ });
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Come funziona', 'Ruoli per tipo di team', 'Come si ottiene: attacco e difesa', 'Come si ottiene: support', 'Come si ottiene: utility',
    ]);
    await user.click(within(dialog).getByRole('tab', { name: 'Ruoli per tipo di team' }));
    const table = within(within(dialog).getByRole('tabpanel')).getByRole('table');
    // La colonna del tipo di team (Balance, team incompleto) in evidenza
    expect(within(table).getByRole('columnheader', { name: 'Balance' })).toHaveClass('now');
    const hazard = within(table).getByRole('row', { name: /^Hazard/ });
    expect([...hazard.querySelectorAll('td')].map(td => td.textContent)).toEqual(['Importante', 'Importante', 'Essenziale', 'Essenziale', 'Essenziale']);
    // Le voci che non contano mai stanno sotto la tabella
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Non contano in nessun tipo di team: .*Taunt/);
    await user.click(within(dialog).getByRole('tab', { name: 'Come si ottiene: support' }));
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Magic Bounce0,5');
    // Le sottoschede di livello non hanno il ?
    await user.keyboard('{Escape}');
    await user.click(within(view).getByRole('tab', { name: /^Essenziali/ }));
    expect(within(view).queryByRole('button', { name: /^Come funziona/ })).toBeNull();
  });
});

describe('Generale dei Ruoli', () => {
  const base = () => rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
  const sixMembers = ['Toxapex', 'Corviknight', 'Dondozo'].map(species => ({ species, values: {}, primary: null, reasons: [] }));

  it('prima cosa manca (essenziali in rosso col malus, importanti in giallo), poi i coperti con le icone; niente minori', () => {
    const roles: TeamRoles = {
      covered: 3, total: 5,
      rows: [
        { key: 'anySweeper', level: 'essential', value: 0, by: [] },
        { key: 'hazards', level: 'essential', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] },
        { key: 'removal', level: 'important', value: 0, by: [] },
        { key: 'pivot', level: 'important', value: 1, by: [{ species: 'Zapdos', value: 1, source: 'U-turn' }] },
        { key: 'taunt', level: 'minor', value: 1, by: [{ species: 'Zapdos', value: 1, source: 'Taunt' }] },
      ],
      failures: [{ text: 'Balance senza Sweeper', points: 4 }, { text: 'Balance senza Controllo Hazard (importante)', points: 2 }],
      bonuses: [{ text: 'Taunt: ruolo minore coperto', points: 1 }],
      members: [
        { species: 'Gliscor', values: { hazards: 1 }, primary: null, reasons: [{ role: 'hazards', value: 1, source: 'Stealth Rock' }] },
        { species: 'Zapdos', values: { taunt: 1, pivot: 1 }, primary: null, reasons: [{ role: 'taunt', value: 1, source: 'Taunt', share: 1 }, { role: 'pivot', value: 1, source: 'U-turn' }] },
        { species: 'Clefable', values: {}, primary: null, reasons: [] },
        // Team di 6: solo allora le essenziali mancanti danno malus
        ...sixMembers,
      ],
    };
    const rating = { ...base(), roles };
    renderIt(<AreaView rating={rating} area="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const panel = screen.getByRole('tabpanel');
    // Coperti, malus (−4 essenziale, −2 importante) e bonus (+1 del minore); nei titoli le voci coi punti
    expect([...panel.querySelectorAll('.rl-score b')].map(b => b.textContent)).toEqual(['3/5', '−6', '+1']);
    const [, malus, bonus] = panel.querySelectorAll('.rl-score li');
    expect(malus.getAttribute('title')).toContain('Balance senza Sweeper (−4)');
    expect(bonus.getAttribute('title')).toContain('Taunt: ruolo minore coperto (+1)');
    const missing = within(panel).getByRole('region', { name: 'Ruoli che mancano' });
    const items = within(missing).getAllByRole('listitem');
    expect(items.map(li => li.querySelector('.rl-name')!.textContent)).toEqual(['Sweeper', 'Controllo Hazard']);
    expect(items[0]).toHaveClass('bad');
    expect(items[0]).toHaveTextContent('Essenziale−4');
    expect(items[1]).toHaveClass('warn');
    expect(items[1]).toHaveTextContent('Importante−2');
    const covered = within(panel).getByRole('region', { name: 'Ruoli che contano, coperti' });
    const row = (name: string) => within(covered).getAllByRole('listitem').find(li => li.querySelector('.rl-name')!.textContent!.startsWith(name))!;
    expect(monsOf(row('Hazard'))).toEqual(['Gliscor']);
    expect(row('Hazard').querySelector('.rl-mon')).toHaveAttribute('title', 'Gliscor · Stealth Rock · 100');
    expect(monsOf(row('Pivot'))).toEqual(['Zapdos']);
    // I minori (Taunt) non sono nel Generale
    expect(panel).not.toHaveTextContent('Taunt');
  });

  it('Minori: chi è coperto mostra +1 in verde al posto del valore; Importanti: chi manca mostra −2 (team di 6)', async () => {
    const roles: TeamRoles = {
      covered: 2, total: 4,
      rows: [
        { key: 'removal', level: 'important', value: 0, by: [] },
        { key: 'pivot', level: 'important', value: 1, by: [{ species: 'Zapdos', value: 1, source: 'U-turn' }] },
        { key: 'taunt', level: 'minor', value: 0.8, by: [{ species: 'Zapdos', value: 0.8, source: 'Taunt' }] },
        { key: 'encore', level: 'minor', value: 0, by: [] },
      ],
      failures: [{ text: 'Balance senza Controllo Hazard (importante)', points: IMPORTANT_POINTS }],
      bonuses: [{ text: 'Taunt: ruolo minore coperto', points: MINOR_POINTS }],
      members: [
        { species: 'Zapdos', values: { taunt: 0.8, pivot: 1 }, primary: null, reasons: [] },
        { species: 'Gliscor', values: {}, primary: null, reasons: [] },
        ...sixMembers, { species: 'Clefable', values: {}, primary: null, reasons: [] },
      ],
    };
    const user = userEvent.setup();
    renderIt(<AreaView rating={{ ...base(), roles }} area="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Minori/ }));
    const taunt = levelRow('Taunt').querySelector('.ct-pill')!;
    expect(taunt).toHaveTextContent(`+${MINOR_POINTS}`);
    expect(taunt).toHaveClass('good');
    expect(taunt).toHaveAttribute('title', 'Coperto (valore 80): bonus +1');
    // Un minore che manca: il suo valore, nessun bonus né malus
    expect(levelRow('Encore').querySelector('.ct-pill')).toHaveTextContent('0');
    await user.click(screen.getByRole('tab', { name: /^Importanti/ }));
    const removal = levelRow('Controllo Hazard').querySelector('.ct-pill')!;
    expect(removal).toHaveTextContent(`−${IMPORTANT_POINTS}`);
    expect(removal).toHaveAttribute('title', `Manca: malus −${IMPORTANT_POINTS}`);
  });

  it('niente che manca: una riga verde', () => {
    const roles: TeamRoles = {
      covered: 1, total: 1, bonuses: [],
      rows: [{ key: 'hazards', level: 'essential', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] }],
      failures: [],
      members: [{ species: 'Gliscor', values: { hazards: 1 }, primary: null, reasons: [] }],
    };
    renderIt(<AreaView rating={{ ...base(), roles }} area="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Hai tutti i ruoli che contano');
    // Un livello senza voci non ha la scheda
    expect(screen.getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent)).toEqual(['Generale', 'Essenziali', 'Non contano']);
  });

  it('team incompleto: giudicato come Balance, e il nome del gruppo è corto', () => {
    const team = [tusk, gholdengo];
    const rating = rateTeam(team, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="roles" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Team incompleto: ruoli giudicati come per un Balance.');
    // Mancano Muro Speciale e Hazard (essenziali): in rosso, senza malus (team di 2)
    const missing = within(panel).getByRole('region', { name: 'Ruoli che mancano' });
    const bad = within(missing).getAllByRole('listitem').filter(li => li.classList.contains('bad')).map(li => li.querySelector('.rl-name')!.textContent);
    expect(bad).toEqual(expect.arrayContaining(['Muro Speciale', 'Hazard']));
    expect(missing).not.toHaveTextContent(/−\d/);
    // Pivot e Rimozione Strumenti sono minori (2026-11-03): non stanno fra i mancanti, e qui nessuna importante manca (giallo)
    expect(within(missing).getAllByRole('listitem').find(li => li.textContent!.startsWith('Pivot'))).toBeUndefined();
    expect(within(missing).getAllByRole('listitem').some(li => li.classList.contains('warn'))).toBe(false);
    // Nel Balance il gruppo si chiama "Sweeper o Wallbreaker", con Great Tusk
    const covered = within(panel).getByRole('region', { name: 'Ruoli che contano, coperti' });
    const breaker = within(covered).getAllByRole('listitem').find(li => li.querySelector('.rl-name')!.textContent!.startsWith('Sweeper o Wallbreaker'))!;
    expect(monsOf(breaker)).toContain('Great Tusk');
    expect(screen.getByRole('tab', { name: /^Essenziali/ }).querySelector('b')).toHaveTextContent('3/5');
  });

  it("per uno stall i gruppi degli attaccanti sono minori; velocità e priorità non sono ruoli", async () => {
    const stall = [
      { ...tusk, species: 'Toxapex', item: 'Black Sludge', ability: 'Regenerator', moves: ['Scald', 'Toxic', 'Recover', 'Haze'] },
      { ...tusk, species: 'Blissey', item: 'Leftovers', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Wish'] },
      { ...tusk, species: 'Corviknight', item: 'Leftovers', ability: 'Pressure', moves: ['Body Press', 'Defog', 'Iron Defense', 'Roost'] },
      { ...tusk, species: 'Gliscor', item: 'Toxic Orb', ability: 'Poison Heal', moves: ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'] },
      { ...tusk, species: 'Dondozo', item: 'Leftovers', ability: 'Unaware', moves: ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'] },
      { ...tusk, species: 'Clodsire', item: 'Leftovers', ability: 'Unaware', moves: ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'] },
    ];
    const user = userEvent.setup();
    const rating = rateTeam(stall, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="roles" team={stall} analysis={analyzeTeam(stall, fixtureData)} problems={[]} />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Giudicati come Stall');
    // Essenziali dello stall: i due muri, Recupero, Cleric, Anti-setup, Hazard e Danno nel Tempo (qui mancante: il meta
    // del fixture è pieno di Acciaio e Veleno, immuni a Toxic)
    expect(screen.getByRole('tab', { name: /^Essenziali/ }).querySelector('b')).toHaveTextContent('6/7');
    await user.click(screen.getByRole('tab', { name: /^Minori/ }));
    expect(levelRow('Sweeper')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Non contano/ }));
    for (const name of ['Velocità', 'Priorità']) expect(levelRow(name)).toBeUndefined();
  });
});

describe('note e secondario nelle sottoschede', () => {
  it('pivot: "offensivo" su un attaccante, "difensivo" su un muro; "misto" su chi attacca da entrambi i lati', async () => {
    const base = rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
    const corv: TeamSet = { ...emptySet('Corviknight'), item: 'Leftovers', ability: 'Pressure', nature: 'Impish', evs: { hp: 248, def: 168, spd: 92 }, moves: ['Roost', 'Brave Bird', 'Defog', 'U-turn'] };
    const pult: TeamSet = { ...emptySet('Dragapult'), item: 'Choice Specs', ability: 'Infiltrator', nature: 'Timid', evs: { spa: 252, spe: 252 }, moves: ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'] };
    const mixed: TeamSet = { ...emptySet('Infernape'), item: 'Life Orb', ability: 'Blaze', nature: 'Naive', evs: { atk: 128, spa: 128, spe: 252 }, moves: ['Close Combat', 'Fire Blast', 'U-turn', 'Grass Knot'] };
    const roles: TeamRoles = {
      covered: 2, total: 2, bonuses: [],
      rows: [
        { key: 'anyBreaker', level: 'essential', value: 1, by: [{ species: 'Infernape', value: 1, source: 'Close Combat' }, { species: 'Dragapult', value: 1, source: 'Draco Meteor' }] },
        { key: 'pivot', level: 'important', value: 1, by: [{ species: 'Corviknight', value: 1, source: 'U-turn' }, { species: 'Dragapult', value: 1, source: 'U-turn' }, { species: 'Infernape', value: 1, source: 'U-turn' }] },
      ],
      failures: [],
      members: [
        { species: 'Corviknight', values: { physicalWall: 1, pivot: 1, removal: 1 }, primary: 'wall', reasons: [] },
        { species: 'Dragapult', values: { specialBreaker: 1, pivot: 1 }, primary: 'attack', reasons: [] },
        { species: 'Infernape', values: { physicalBreaker: 1, pivot: 1 }, primary: 'attack', reasons: [] },
      ],
    };
    const team = [corv, pult, mixed];
    const user = userEvent.setup();
    renderIt(<AreaView rating={{ ...base, roles }} area="roles" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Importanti/ }));
    const titles = (name: string) => [...levelRow(name).querySelectorAll('.rl-mon')].map(m => m.getAttribute('title'));
    expect(titles('Pivot')).toEqual(['Corviknight · U-turn · difensivo · 100', 'Dragapult · U-turn · offensivo · 100', 'Infernape · U-turn · offensivo · 100']);
    expect(levelRow('Pivot').querySelector('.rl-reason')).toHaveTextContent('U-turn · difensivo');
    await user.click(screen.getByRole('tab', { name: /^Essenziali/ }));
    expect(titles('Wallbreaker')).toEqual(['Dragapult · Draco Meteor · 100', 'Infernape · Close Combat · misto · 100']);
  });

  it('chi ha un muro secondario: segnato, tenue, col valore accreditato', async () => {
    const base = rateTeam([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 1, total: 1, bonuses: [],
      rows: [{ key: 'physicalWall', level: 'essential', value: 0.5, by: [{ species: 'Great Tusk', value: 0.5, source: 'wall', secondary: true }] }],
      failures: [],
      members: [{
        species: 'Great Tusk', primary: 'attack',
        values: { physicalBreaker: 1, physicalWall: 1 }, credited: { physicalBreaker: 1, physicalWall: 0.5 },
        reasons: [{ role: 'physicalWall', value: 1, source: 'wall', index: 111000, threshold: 100000 }],
      }],
    };
    const user = userEvent.setup();
    renderIt(<AreaView rating={{ ...base, roles }} area="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const mon = within(screen.getByRole('tabpanel')).getByText('Great Tusk (secondario)').closest('.rl-mon')!;
    expect(mon).toHaveClass('weak');
    expect(mon.querySelector('.rl-val')).toHaveTextContent('50');
    await user.click(screen.getByRole('tab', { name: /^Essenziali/ }));
    const row = levelRow('Muro Fisico');
    expect(row.querySelector('.rl-sec')).toHaveTextContent('sec.');
    expect(row.querySelector('.rl-reason')).toHaveTextContent('Regge bene i colpi fisici');
  });

  it('sotto l\'icona il valore compare solo quando non è pieno (sotto 100)', () => {
    const base = rateTeam([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 1, total: 1, bonuses: [],
      rows: [{ key: 'physicalWall', level: 'essential', value: 1, by: [{ species: 'Great Tusk', value: 1, source: 'wall' }] }],
      failures: [],
      members: [{ species: 'Great Tusk', primary: 'attack', values: { physicalWall: 1 }, credited: { physicalWall: 1 }, reasons: [] }],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    // Il muro di un attaccante è secondario (tenue), ma pieno: niente numero sotto, il 100 resta nel tooltip
    const mon = within(screen.getByRole('tabpanel')).getByText('Great Tusk (secondario)').closest('.rl-mon')!;
    expect(mon.querySelector('.rl-val')).toBeNull();
    expect(mon.getAttribute('title')).toMatch(/· 100$/);
  });
});

describe('setup difensivo nel dettaglio della Difesa', () => {
  it('chi ha Iron Defense: il +N (quando la danza alza il valore) ha il setup nel tooltip, mai senza danza', async () => {
    const { user, rating } = await importRolesTeam();
    await user.click(within(rating).getByRole('button', { name: /^Difesa \d+, apri il dettaglio/ }));
    const dialog = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
    await user.click(within(dialog).getByRole('tab', { name: /^Generale/ }));
    const row = within(dialog).getByRole('row', { name: /^Corviknight/ });
    // Con i colpi di tipo la danza alza il valore solo se fa salire di soglia qualche colpo: può valere zero
    for (const gain of within(dialog).getByRole('table').querySelectorAll('.ad-gain')) {
      expect(gain).toHaveTextContent(/^\(\+\d+\)$/);
      // Solo il nome della mossa
      expect(gain.getAttribute('title')).toMatch(/^\S.*\S$/);
      expect(gain.getAttribute('title')).not.toMatch(/setup/i);
    }
    expect(row).toBeInTheDocument();
  });
});
