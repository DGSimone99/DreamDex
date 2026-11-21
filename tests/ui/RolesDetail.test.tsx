import { MISSING_BELOW } from '../../src/engine/needs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { AreaView } from '../../src/ui/AreaView';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, importShowdown, type TeamSet } from '../../src/engine/sets';
import { GradeBadge } from '../../src/ui/RatingPanel';
import { IMPORTANT_POINTS, type TeamRoles } from '../../src/engine/rolesArea';
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
  const bar = within(rating).getByRole('button', { name: lang === 'it' ? /^Ruoli \d+\/\d+, .*punti (0|[+−]\d+), apri il dettaglio/ : /^Roles \d+\/\d+, .*points (0|[+−]\d+), open details/ });
  await user.click(bar);
  // La scheda Ruoli di Analisi, sulla pagina
  const view = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
  return { user, bar, view };
}

const tabNames = (view: HTMLElement) => within(view).getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);
/** I titoli delle fasce, in ordine. */
const bandTitles = (root: HTMLElement) => [...root.querySelectorAll('.rl-band-title')].map(el => el.textContent);
/** Le righe di una fascia (o di tutto), per nome del ruolo. */
const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.rl-row')];
const rowOf = (name: string, root: HTMLElement = screen.getByRole('tabpanel')) => rows(root).find(li => li.querySelector('.rl-name')!.textContent === name);
const namesOf = (root: HTMLElement) => rows(root).map(li => li.querySelector('.rl-name')!.textContent);
/** I punti scritti di una riga (senza la frase nascosta per lo screen reader). */
const ptsOf = (row: HTMLElement) => {
  const pts = row.querySelector<HTMLElement>('.rl-pts')!.cloneNode(true) as HTMLElement;
  pts.querySelectorAll('.visually-hidden').forEach(el => el.remove());
  return pts.textContent!.trim();
};
/** Gli Pokémon di una riga (le icone hanno il nome nascosto per lo screen reader, con la percentuale se non è pieno). */
const monsOf = (el: HTMLElement) => [...el.querySelectorAll('.rl-mon')].map(m => m.querySelector('.visually-hidden')!.textContent!.replace(/ \d+%$/, ''));

describe('Ruoli in Ruoli e Bonus: la sottoscheda Ruoli a fasce', () => {
  it('la riga Ruoli del voto apre Ruoli e Bonus sulla sottoscheda Ruoli: due fasce in ordine, niente filtri', async () => {
    const { view } = await openRoles();
    // La scheda aperta in Analisi è Ruoli e Bonus (i Ruoli non hanno più una scheda loro)
    const views = within(document.getElementById('panel-analysis')!).getByRole('tablist', { name: "Sezioni dell'Analisi" });
    expect(within(views).getByRole('tab', { name: 'Ruoli e Bonus' })).toHaveAttribute('aria-selected', 'true');
    expect(within(views).queryByRole('tab', { name: 'Ruoli' })).toBeNull();
    expect(tabNames(view)).toEqual(['Bonus/Malus', 'Ruoli']);
    const tabs = within(view).getAllByRole('tab');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    // La sottoscheda Ruoli porta i Ruoli coperti sul totale, come la riga del voto (detti ai lettori di schermo)
    expect(tabs[1]).toHaveAccessibleDescription(/^\d+ di \d+ ruoli essenziali e importanti coperti/);
    // Le fasce: Essenziali e Importanti (i minori non ci sono più); Non contano sta solo nella guida
    expect(bandTitles(view)).toEqual(['Essenziali', 'Importanti']);
    expect(within(view).queryByRole('region', { name: 'Non contano' })).toBeNull();
    expect(within(view).queryByRole('group', { name: 'Quali ruoli mostrare' })).toBeNull();
    // Il team incompleto si giudica come Balance: cinque essenziali (Sweeper o Wallbreaker è una voce sola dal 2026-11-13)
    expect(rows(within(view).getByRole('region', { name: 'Essenziali' }))).toHaveLength(5);
  });

  it("una vista 'roles' (link vecchio o stato salvato prima del cambio) apre Ruoli e Bonus sulla sottoscheda Ruoli", () => {
    const team = [tusk, gholdengo];
    const onView = vi.fn();
    renderIt(<AnalysisPanel team={team} analysis={analyzeTeam(team, fixtureData)} rating={rateTeam(team, fixtureData, 'it')} data={fixtureData} view="roles" onView={onView} />);
    expect(onView).toHaveBeenCalledWith('bonusMalus');
    const views = screen.getByRole('tablist', { name: "Sezioni dell'Analisi" });
    expect(within(views).getByRole('tab', { name: 'Ruoli e Bonus' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ruoli' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Essenziali' })).toBeInTheDocument();
  });

  it('la sottoscheda Ruoli: X/Y dei soli essenziali e importanti e i punti dei Ruoli, tutto nella descrizione (sul selettore solo il nome)', () => {
    const team = importShowdown(ROLES_TEAM).sets;
    const rating = rateTeam(team, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="bonusMalus" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    const counted = rating.roles.rows.filter(r => r.level === 'essential' || r.level === 'important');
    const missing = counted.filter(r => r.value < MISSING_BELOW);
    expect(missing.length).toBeGreaterThan(0);
    const points = -rating.roles.failures.reduce((n, f) => n + f.points, 0);
    const label = points > 0 ? `+${points}` : `−${-points}`;
    const tab = screen.getByRole('tab', { name: 'Ruoli' });
    expect(tab).toHaveTextContent(/^Ruoli$/);
    expect(tab.querySelector('.icon, svg')).toBeNull();
    // X/Y e i punti dei Ruoli sul voto (minori meno mancanze), come nella carta del voto, in Panoramica e nel Coaching
    expect(tab).toHaveAccessibleDescription([
      `${counted.length - missing.length} di ${counted.length} ruoli essenziali e importanti coperti`, `${missing.length} mancanti`,
      ...(points !== 0 ? [`punti ${label}`] : []),
    ].join(', '));
  });

  it('la sottoscheda Ruoli: mancano solo importanti; i punti dei Ruoli (le mancanze) nella descrizione', () => {
    const base = rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 2, total: 3,
      rows: [
        { key: 'hazards', level: 'essential', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] },
        { key: 'removal', level: 'important', value: 0, by: [] },
        { key: 'disruptor', level: 'minor', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Taunt' }] },
      ],
      failures: [{ text: 'Balance senza Controllo Hazard (importante)', points: IMPORTANT_POINTS }],
      members: [{ species: 'Gliscor', values: { hazards: 1, disruptor: 1 }, primary: null, reasons: [] }],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const tab = screen.getByRole('tab', { name: 'Ruoli' });
    expect(tab).toHaveAccessibleDescription(`1 di 2 ruoli essenziali e importanti coperti, 1 mancanti, punti −${IMPORTANT_POINTS}`);
  });

  it('niente che manca: la descrizione dice solo i coperti, la targhetta con la spunta', () => {
    const base = rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 1, total: 1,
      rows: [{ key: 'hazards', level: 'essential', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] }],
      failures: [],
      members: [{ species: 'Gliscor', values: { hazards: 1 }, primary: null, reasons: [] }],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const tab = screen.getByRole('tab', { name: 'Ruoli' });
    expect(tab).toHaveAccessibleDescription('1 di 1 ruoli essenziali e importanti coperti');
    const panel = screen.getByRole('tabpanel');
    expect(panel).not.toHaveTextContent('Hai tutti i ruoli');
    // Una fascia senza voci per questo tipo di team non c'è
    expect(bandTitles(panel)).toEqual(['Essenziali']);
    // Il titolo della fascia: solo il nome e il suo valore (la spunta), senza la regola
    const head = panel.querySelector('.rl-band.essential .rl-band-head')!;
    expect(head.querySelector('.rl-mark.ok svg')).not.toBeNull();
    expect(head).toHaveTextContent(/^Essenziali\s*non manca nessuno$/);
    expect(panel.querySelector('.rl-net')).toHaveTextContent('Ruoli 0');
    expect(panel.querySelector('.rl-net')).toHaveClass('zero');
  });

  it('il link "Tabella dei ruoli" apre la guida sulla pagina Ruoli per tipo di team', async () => {
    const { user, view } = await openRoles();
    await user.click(within(view).getByRole('button', { name: 'Tabella dei ruoli' }));
    const dialog = screen.getByRole('dialog', { name: /Ruoli e Bonus/ });
    expect(within(dialog).getByRole('tab', { name: 'Ruoli per tipo di team' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Non contano in nessun tipo di team/);
  });

  it('in inglese', async () => {
    const { view } = await openRoles('en');
    expect(tabNames(view)).toEqual(['Bonus/Malus', 'Roles']);
    expect(bandTitles(view)).toEqual(['Essential', 'Important']);
    expect(within(view).getByRole('button', { name: 'Roles table' })).toBeInTheDocument();
    // In testa il tipo di team sulla sua targa (team incompleto accanto) e i punti dei Ruoli; niente regole nei titoli
    expect(view.querySelector('.rl-type')).toHaveTextContent('Balance');
    expect(view.querySelector('.rl-incomplete')).toHaveTextContent('incomplete team');
    expect(view.querySelector('.rl-net')).toHaveTextContent(/^Roles (0|[+−]\d+)$/);
    expect(view.querySelector('.rl-band-head small')).toBeNull();
    expect(view).not.toHaveTextContent(/if missing|Judged as/);
  });

  it('il ? della sottoscheda Ruoli: la guida di Bonus/Malus aperta su Ruoli, poi Ruoli per tipo di team (niente pagine su come si ottiene un ruolo)', async () => {
    const { user, view } = await openRoles();
    await user.click(within(view).getByRole('button', { name: 'Come funziona Ruoli' }));
    const dialog = screen.getByRole('dialog', { name: /Ruoli e Bonus/ });
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Bonus/Malus', 'Tutti i bonus', 'Tutti i malus',
      'Ruoli', 'Ruoli per tipo di team',
    ]);
    expect(within(dialog).getByRole('tab', { name: 'Ruoli' })).toHaveAttribute('aria-selected', 'true');
    // Le voci che non contano: nella guida, non più in un filtro
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent(/filtro/i);
    await user.click(within(dialog).getByRole('tab', { name: 'Ruoli per tipo di team' }));
    const table = within(within(dialog).getByRole('tabpanel')).getByRole('table');
    // La colonna del tipo di team (Balance, team incompleto) in evidenza
    expect(within(table).getByRole('columnheader', { name: 'Balance' })).toHaveClass('now');
    const hazard = within(table).getByRole('row', { name: /^Hazard/ });
    expect([...hazard.querySelectorAll('td')].map(td => td.textContent)).toEqual(['Importante', 'Importante', 'Essenziale', 'Essenziale', 'Essenziale']);
    // Le voci che non tolgono mai punti stanno sotto la tabella, minori compresi (Sweeper e Wallbreaker fisici e speciali
    // contano dentro i gruppi degli attaccanti); il Pivot ha la sua frase
    const foot = within(dialog).getByRole('tabpanel').querySelector('.guide-foot')!;
    expect(foot).toHaveTextContent(/^Non contano in nessun tipo di team: .+\. Il Pivot ha un bonus suo quando il team lo sfrutta\.$/);
    for (const name of ['Speed Control', 'Disruptor', 'Pivot', 'Rimozione Strumenti']) expect(foot).toHaveTextContent(name);
    expect(within(dialog).queryByRole('row', { name: /^Disruptor/ })).toBeNull();
    // Nella tabella nessuna casella "Minore"
    expect(table).not.toHaveTextContent('Minore');
  });

  it('la riga Ruoli del voto: lo stesso conteggio della sottoscheda (essenziali e importanti coperte, poi i punti), senza barra', async () => {
    const { bar } = await openRoles();
    expect(bar).toHaveClass('grade-roles');
    expect(bar.querySelector('.meter')).toBeNull();
    expect(bar).toHaveTextContent(/^Ruoli\d+\/\d+(0|[+−]\d+)$/);
    expect(bar.querySelector('.grade-roles-miss')).toBeNull();
    // A parole nel nome del pulsante
    expect(bar).toHaveAccessibleName(/(\d+ mancano|1 manca)/);
  });

  it('la riga Ruoli del voto: X/Y rosso se manca un essenziale, giallo se solo importanti', () => {
    const rating = rateTeam(importShowdown(ROLES_TEAM).sets, fixtureData)!;
    renderIt(<GradeBadge rating={rating} />);
    const missing = (level: string) => rating.roles.rows.filter(r => r.level === level && r.value < MISSING_BELOW).length;
    const count = document.querySelector('.grade-roles-count');
    expect(missing('essential') + missing('important')).toBeGreaterThan(0);
    expect(count).toHaveClass(missing('essential') ? 'bad' : 'warn');
  });
});

describe('le fasce dei Ruoli', () => {
  const base = () => rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
  const sixMembers = ['Toxapex', 'Corviknight', 'Dondozo'].map(species => ({ species, values: {}, primary: null, reasons: [] }));
  // Team di 6 con malus: un essenziale e un importante mancano; due minori (uno coperto, uno no) che la lista non mostra
  const sixRoles = (): TeamRoles => ({
    covered: 3, total: 6,
    rows: [
      { key: 'hazards', level: 'essential', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] },
      { key: 'anySweeper', level: 'essential', value: 0, by: [] },
      { key: 'pivot', level: 'important', value: 1, by: [{ species: 'Zapdos', value: 1, source: 'U-turn' }, { species: 'Gliscor', value: 1, source: 'U-turn' }] },
      { key: 'removal', level: 'important', value: 0, by: [] },
      { key: 'disruptor', level: 'minor', value: 0.8, by: [{ species: 'Zapdos', value: 0.8, source: 'Taunt' }] },
      { key: 'dot', level: 'minor', value: 0, by: [] },
    ],
    failures: [{ text: 'Balance senza Sweeper', points: 4 }, { text: 'Balance senza Controllo Hazard (importante)', points: IMPORTANT_POINTS }],
    members: [
      { species: 'Gliscor', values: { hazards: 1, pivot: 1 }, primary: null, reasons: [{ role: 'hazards', value: 1, source: 'Stealth Rock' }, { role: 'pivot', value: 1, source: 'U-turn' }] },
      { species: 'Zapdos', values: { disruptor: 0.8, pivot: 1 }, primary: null, reasons: [{ role: 'disruptor', value: 0.8, source: 'Taunt', share: 0.8 }, { role: 'pivot', value: 1, source: 'U-turn' }] },
      { species: 'Clefable', values: {}, primary: null, reasons: [] },
      ...sixMembers,
    ],
  });
  const renderSix = () => {
    renderIt(<AreaView rating={{ ...base(), roles: sixRoles() }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    return screen.getByRole('tabpanel');
  };

  it('due fasce in ordine (Essenziali, Importanti), in ogni fascia prima quelle che mancano; i minori non ci sono', () => {
    const panel = renderSix();
    expect(bandTitles(panel)).toEqual(['Essenziali', 'Importanti']);
    const band = (name: string) => within(panel).getByRole('region', { name });
    expect(namesOf(band('Essenziali'))).toEqual(['Sweeper', 'Hazard']);
    expect(namesOf(band('Importanti'))).toEqual(['Controllo Hazard', 'Pivot']);
    // I minori (Disruptor coperto, Danno nel Tempo no) non stanno nella lista
    expect(within(panel).queryByRole('region', { name: 'Minori' })).toBeNull();
    for (const name of ['Danno nel Tempo', 'Disruptor']) expect(rowOf(name, panel)).toBeUndefined();
    // Il titolo di ogni fascia: solo il nome e il suo valore, niente regola
    expect(panel.querySelector('.rl-band-head small')).toBeNull();
    expect(panel).not.toHaveTextContent(/se manca|se c'è/);
    expect(band('Essenziali').querySelector('.rl-band-head .rl-mark')).toHaveTextContent('−4');
    expect(band('Importanti').querySelector('.rl-band-head .rl-mark')).toHaveTextContent('−2');
  });

  it('i punti di ogni voce: ✓ verde se coperta, −4 / −2 se manca (team di 6)', () => {
    const panel = renderSix();
    const hazard = rowOf('Hazard', panel)!;
    expect(hazard.querySelector('.rl-pts')).toHaveClass('ok');
    expect(hazard.querySelector('.rl-pts svg')).not.toBeNull();
    expect(hazard.querySelector('.rl-pts')).toHaveTextContent('coperto');
    const sweeper = rowOf('Sweeper', panel)!;
    expect(sweeper).toHaveClass('bad');
    expect(ptsOf(sweeper)).toBe('−4');
    expect(sweeper.querySelector('.rl-pts')).toHaveAttribute('title', 'Manca: malus −4');
    expect(sweeper.querySelector('.rl-nobody')).toHaveTextContent('Nessuno');
    const removal = rowOf('Controllo Hazard', panel)!;
    expect(removal).toHaveClass('warn');
    expect(ptsOf(removal)).toBe(`−${IMPORTANT_POINTS}`);
    expect(removal.querySelector('.rl-pts')).toHaveClass('malus');
    // In testa i punti dei Ruoli (−4 −2 = −6), in rosso; niente più l'equazione delle fasce
    expect(panel.querySelector('.rl-net')).toHaveTextContent('Ruoli −6');
    expect(panel.querySelector('.rl-net')).toHaveClass('bad');
    expect(panel.querySelector('.rl-sum')).toBeNull();
    expect(panel.querySelector('.rl-type')).toHaveTextContent('Balance');
    expect(panel.querySelector('.rl-incomplete')).toBeNull();
  });

  it("chi copre: uno solo con icona e nome, più d'uno solo le icone; niente percentuali, né a schermo né nei tooltip", () => {
    const panel = renderSix();
    const hazard = rowOf('Hazard', panel)!;
    expect(monsOf(hazard)).toEqual(['Gliscor']);
    expect(hazard.querySelector('.rl-mon-name')).toHaveTextContent('Gliscor');
    expect(hazard.querySelector('.rl-mon')).toHaveAttribute('title', 'Gliscor · Stealth Rock');
    const pivot = rowOf('Pivot', panel)!;
    expect(monsOf(pivot)).toEqual(['Gliscor', 'Zapdos']);
    expect(pivot.querySelector('.rl-mon-name')).toBeNull();
    expect(panel).not.toHaveTextContent('%');
    expect([...panel.querySelectorAll('[title]')].some(e => e.getAttribute('title')!.includes('%'))).toBe(false);
  });

  it('team incompleto: giudicato come Balance; chi manca dice "manca", senza malus', () => {
    const team = [tusk, gholdengo];
    const rating = rateTeam(team, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="bonusMalus" picked="roles" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel.querySelector('.rl-type')).toHaveTextContent('Balance');
    expect(panel.querySelector('.rl-incomplete')).toHaveTextContent('team incompleto');
    // Mancano Muro Speciale e Hazard (essenziali): in rosso, ma senza malus (team di 2)
    for (const name of ['Muro Speciale', 'Hazard']) {
      const row = rowOf(name, panel)!;
      expect(row).toHaveClass('bad');
      expect(row.querySelector('.rl-pts')).toHaveClass('missing');
      expect(ptsOf(row)).toBe('manca');
    }
    expect([...panel.querySelectorAll('.rl-pts')].some(p => /−\d/.test(p.textContent!))).toBe(false);
    // Nel titolo della fascia quanti mancano, non un malus; il totale dei Ruoli senza malus
    expect(panel.querySelector('.rl-band.essential .rl-band-head .rl-mark.missing')).toHaveTextContent(/\d+ mancano/);
    expect(panel.querySelector('.rl-net')).not.toHaveTextContent('−');
    // Nel Balance il gruppo si chiama "Sweeper o Wallbreaker", con Great Tusk
    expect(monsOf(rowOf('Sweeper o Wallbreaker', panel)!)).toContain('Great Tusk');
    expect(screen.getByRole('tab', { name: 'Ruoli' })).toHaveAccessibleDescription(/mancanti/);
  });

  it("per uno stall i gruppi degli attaccanti sono minori e non stanno nella lista; velocità e priorità non sono ruoli", () => {
    const stall = [
      { ...tusk, species: 'Toxapex', item: 'Black Sludge', ability: 'Regenerator', moves: ['Scald', 'Toxic', 'Recover', 'Haze'] },
      { ...tusk, species: 'Blissey', item: 'Leftovers', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Wish'] },
      { ...tusk, species: 'Corviknight', item: 'Leftovers', ability: 'Pressure', moves: ['Body Press', 'Defog', 'Iron Defense', 'Roost'] },
      { ...tusk, species: 'Gliscor', item: 'Toxic Orb', ability: 'Poison Heal', moves: ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'] },
      { ...tusk, species: 'Dondozo', item: 'Leftovers', ability: 'Unaware', moves: ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'] },
      { ...tusk, species: 'Clodsire', item: 'Leftovers', ability: 'Unaware', moves: ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'] },
    ];
    const rating = rateTeam(stall, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="bonusMalus" picked="roles" team={stall} analysis={analyzeTeam(stall, fixtureData)} problems={[]} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel.querySelector('.rl-type')).toHaveTextContent('Stall');
    // Essenziali dello stall: i due muri, Recupero, Cleric, Anti-setup, Hazard e Danno nel Tempo. Il DoT nessuno lo
    // porta da solo (il meta del fixture è pieno di Acciaio e Veleno, immuni a Toxic): lo coprono insieme i tre Toxic e
    // Scald (anche dentro Toxapex, Toxic e Scald si sommano)
    const essential = within(panel).getByRole('region', { name: 'Essenziali' });
    expect(rows(essential)).toHaveLength(7);
    expect(rows(essential).filter(r => r.classList.contains('bad'))).toHaveLength(0);
    expect(rowOf('Danno nel Tempo', panel)).not.toHaveClass('bad');
    expect(within(panel).queryByRole('region', { name: 'Minori' })).toBeNull();
    expect(rowOf('Sweeper', panel)).toBeUndefined();
    for (const name of ['Velocità', 'Priorità']) expect(rowOf(name, panel)).toBeUndefined();
  });
});

describe('note e secondario nelle righe', () => {
  it('pivot: "offensivo" su un attaccante, "difensivo" su un muro; "misto" su chi attacca da entrambi i lati', () => {
    const base = rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
    const corv: TeamSet = { ...emptySet('Corviknight'), item: 'Leftovers', ability: 'Pressure', nature: 'Impish', evs: { hp: 248, def: 168, spd: 92 }, moves: ['Roost', 'Brave Bird', 'Defog', 'U-turn'] };
    const pult: TeamSet = { ...emptySet('Dragapult'), item: 'Choice Specs', ability: 'Infiltrator', nature: 'Timid', evs: { spa: 252, spe: 252 }, moves: ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'] };
    const mixed: TeamSet = { ...emptySet('Infernape'), item: 'Life Orb', ability: 'Blaze', nature: 'Naive', evs: { atk: 128, spa: 128, spe: 252 }, moves: ['Close Combat', 'Fire Blast', 'U-turn', 'Grass Knot'] };
    const roles: TeamRoles = {
      covered: 2, total: 2,
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
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    const titles = (name: string) => [...rowOf(name)!.querySelectorAll('.rl-mon')].map(m => m.getAttribute('title'));
    expect(titles('Pivot')).toEqual(['Corviknight · U-turn · difensivo', 'Dragapult · U-turn · offensivo', 'Infernape · U-turn · offensivo']);
    expect(titles('Wallbreaker')).toEqual(['Dragapult · Draco Meteor', 'Infernape · Close Combat · misto']);
  });

  it('chi ha un muro secondario: segnato e tenue, senza percentuale', () => {
    const base = rateTeam([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 1, total: 1,
      rows: [{ key: 'physicalWall', level: 'essential', value: 0.5, by: [{ species: 'Great Tusk', value: 0.5, source: 'wall', secondary: true }] }],
      failures: [],
      members: [{
        species: 'Great Tusk', primary: 'attack',
        values: { physicalBreaker: 1, physicalWall: 1 }, credited: { physicalBreaker: 1, physicalWall: 0.5 },
        reasons: [{ role: 'physicalWall', value: 1, source: 'wall', index: 111000, threshold: 100000 }],
      }],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const mon = within(screen.getByRole('tabpanel')).getByText('Great Tusk (secondario)').closest('.rl-mon')!;
    expect(mon).toHaveClass('weak');
    expect(mon.getAttribute('title')).toContain('Regge bene i colpi fisici');
    expect(mon.getAttribute('title')).not.toContain('%');
  });

  it("niente numero accanto all'icona, neanche nel tooltip", () => {
    const base = rateTeam([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 1, total: 1,
      rows: [{ key: 'physicalWall', level: 'essential', value: 1, by: [{ species: 'Great Tusk', value: 1, source: 'wall' }] }],
      failures: [],
      members: [{ species: 'Great Tusk', primary: 'attack', values: { physicalWall: 1 }, credited: { physicalWall: 1 }, reasons: [] }],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    // Il muro di un attaccante è secondario (tenue): niente numero né a schermo né nel tooltip
    const mon = within(screen.getByRole('tabpanel')).getByText('Great Tusk (secondario)').closest('.rl-mon')!;
    expect(mon.querySelector('.rl-val')).toBeNull();
    expect(mon.getAttribute('title')).toBe('Great Tusk · secondario');
  });

  it('un DoT scoperto dice "Nessuno" anche se qualcuno lo porta un po\': chi contribuisce alla somma sta nel tooltip e nel testo nascosto, senza %', () => {
    const base = rateTeam([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      covered: 0, total: 1,
      rows: [{ key: 'dot', level: 'important', value: 0.11, by: [{ species: 'Garchomp', value: 0.11, source: 'Toxic' }, { species: 'Toxapex', value: 0.05, source: 'Toxic' }] }],
      failures: [],
      members: [
        { species: 'Garchomp', primary: 'attack', values: { dot: 0.11 }, reasons: [] },
        { species: 'Toxapex', primary: 'wall', values: { dot: 0.05 }, reasons: [] },
      ],
    };
    renderIt(<AreaView rating={{ ...base, roles }} area="bonusMalus" picked="roles" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    const row = rowOf('Danno nel Tempo')!;
    expect(row).toHaveClass('warn');
    expect(row.querySelector('.rl-mon')).toBeNull();
    expect(row.querySelector('.rl-nobody')).toHaveTextContent(/^Nessuno; in parte: Garchomp \(Toxic\), Toxapex \(Toxic\)$/);
    expect(row.querySelector('.rl-nobody .visually-hidden')).toHaveTextContent('in parte: Garchomp (Toxic), Toxapex (Toxic)');
    expect(row).toHaveAttribute('title', 'in parte: Garchomp (Toxic), Toxapex (Toxic)');
    // Team incompleto: manca, ma senza malus
    expect(ptsOf(row)).toBe('manca');
  });
});

describe('Bonus/Malus senza i ruoli', () => {
  const rated = () => {
    const base = rateTeam([tusk, gholdengo], fixtureData, 'it')!;
    const penalty = [
      { text: 'Tipi doppioni: 2 membri di tipo Drago', points: 4, catalog: 'sameType' as const },
      { text: 'Balance senza Hazard (importante)', points: IMPORTANT_POINTS, catalog: 'importantRole' as const },
      { text: 'Balance senza Controllo Hazard (importante)', points: IMPORTANT_POINTS, catalog: 'importantRole' as const },
    ];
    return { ...base, cores: [], penalty: { total: 8, items: penalty }, bonus: { total: 0, items: [] } };
  };

  it('le voci dei ruoli non ci sono e i totali non le contano: netto, bonus e malus, medaglie e la sottoscheda grande', () => {
    renderIt(<AreaView rating={rated()} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    // La sottoscheda grande: −4 (solo Tipi doppioni), non −7
    expect(screen.getByRole('tab', { name: 'Bonus/Malus' })).toHaveAccessibleDescription('−4');
    expect(document.querySelector('.bm-net')).toHaveTextContent('−4');
    expect(document.querySelector('.bm-parts')).toHaveTextContent('Bonus 0·Malus −4');
    // Una medaglia sola: le voci dei ruoli non ci sono
    const cards = [...document.querySelectorAll<HTMLElement>('.bm-list > .bm-row')];
    expect(cards.map(c => c.querySelector('.bm-row-tx b')!.textContent)).toEqual(['Tipi doppioni']);
    expect(cards[0].querySelector('.bm-row-pts')).toHaveTextContent('−4');
    expect(screen.queryByRole('button', { name: /apri i Ruoli/ })).toBeNull();
  });

  it('solo malus dei ruoli: la scheda Bonus/Malus è vuota (zero, nessuna voce)', () => {
    const r = rated();
    const only = { ...r, penalty: { total: 4, items: r.penalty.items.filter(i => i.catalog === 'importantRole') }, bonus: { total: 0, items: r.bonus.items } };
    renderIt(<AreaView rating={only} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} />);
    expect(screen.getByRole('tab', { name: 'Bonus/Malus' })).toHaveAccessibleDescription('0');
    expect(document.querySelector('.bm-net')).toHaveTextContent('0');
    expect(document.querySelector('.bm')).toHaveClass('empty');
    expect(document.querySelector('.bm-list')).toBeNull();
  });

  it('la carta del voto: Bonus/Malus senza i ruoli, Ruoli coi loro punti; il voto non cambia', () => {
    const rating = rated();
    const roles = -rating.roles.failures.reduce((n, f) => n + f.points, 0);
    renderIt(<GradeBadge rating={rating} onOpen={() => {}} />);
    const bm = screen.getByRole('button', { name: /^Apri Bonus\/Malus/ });
    expect(bm.querySelector('b')).toHaveTextContent('−4');
    expect(bm).toHaveAccessibleName('Apri Bonus/Malus: −4, senza i ruoli');
    const row = screen.getByRole('button', { name: /^Ruoli \d+\/\d+/ });
    expect(row.querySelector('.grade-roles-val b')).toHaveTextContent(roles > 0 ? `+${roles}` : roles < 0 ? `−${-roles}` : '0');
    expect(row).toHaveAccessibleName(new RegExp(`punti ${roles > 0 ? `\+${roles}` : roles < 0 ? `−${-roles}` : '0'}, apri il dettaglio$`));
    expect(document.querySelector('.overall')).toHaveTextContent(`${rating.overall} / 100`);
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
