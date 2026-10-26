import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

/** Apre un'area dal riquadro Voto: Analisi la mostra sulla pagina; si parte dalla scheda Generale come nella vecchia finestra. */
async function openArea(lang: 'it' | 'en', area: RegExp, names = ['Great Tusk', 'Gholdengo']) {
  const user = userEvent.setup();
  render(<App initialLang={lang} data={fixtureData} />);
  const add = screen.getByLabelText(lang === 'it' ? 'Aggiungi Pokémon' : 'Add Pokémon');
  for (const name of names) await user.type(add, `${name}{Enter}`);
  const bar = within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: area });
  await user.click(bar);
  const dialog = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
  const general = within(dialog).queryByRole('tab', { name: /^(Generale|General)/ });
  if (general) await user.click(general);
  return { user, bar, dialog };
}

async function openOffense(lang: 'it' | 'en') {
  return openArea(lang, lang === 'it' ? /^Offesa \d+, apri il dettaglio/ : /^Offense \d+, open details/);
}

describe("dettaglio dell'Offesa a schede", () => {
  it('quattro schede col loro valore; si parte da Generale con le sottostatistiche e i membri', async () => {
    const { dialog } = await openOffense('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Generale', 'Potenza', 'Wallbreaking', 'Coverage tipi', 'Coverage meta']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('term').map(term => term.textContent)).toEqual(['Potenza', 'Wallbreaking', 'Coverage tipi', 'Coverage meta']);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Potenza', 'Wallbreaking', 'Coverage', 'Offesa']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      // Il Wallbreaking, con tra parentesi quanto lo alza il setup nel voto (tooltip "Con il setup")
      expect(cells[1]).toHaveTextContent(/^\d+( \(\+\d+\))?$/);
      expect(cells[2]).toHaveTextContent(/^\d+%$/);
      // L'Offesa del membro, con tra parentesi quanto aggiunge Tera o mossa Z (tooltip "Con Tera…")
      expect(cells[3]).toHaveTextContent(/^\d+( \(\+\d+\))?$/);
      const once = cells[3].querySelector('.ad-once');
      if (once) expect(once.getAttribute('title')).toMatch(/^Con (Tera|la mossa Z)/);
    }
  });

  it('Generale: quanti attaccanti fisici, speciali e misti (solo informazione)', async () => {
    const { dialog } = await openOffense('it');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Attaccanti: 1 fisico · 1 speciale · 0 misti');
  });

  it('Generale in inglese: la riga degli attaccanti', async () => {
    const { dialog } = await openOffense('en');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Attackers: 1 physical · 1 special · 0 mixed');
  });

  it('Potenza: come si calcola e la Potenza di ogni membro col suo colpo migliore', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Potenza/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/3° miglior attaccante/);
    // La scala: lineare fino a 80, poi sempre più piano, e il 100 non si raggiunge
    expect(panel).toHaveTextContent(/100 non si raggiunge/);
    expect(within(panel).getAllByRole('row').length).toBe(3);
  });

  it('Wallbreaking: muro per muro, il danno di ogni membro (senza colonna delle risposte)', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Wallbreaking/ }));
    const panel = within(dialog).getByRole('tabpanel');
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      // Solo i due membri: chi sfonda il muro si vede già dalle caselle
      expect(cells).toHaveLength(2);
      for (const cell of cells) expect(cell).toHaveTextContent(/^\d+%( \(\d+%\))?$/);
    }
  });

  it('Coverage tipi: i 18 tipi, i buchi e chi li copre', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    const typesPanel = within(dialog).getByRole('tabpanel');
    expect(within(typesPanel).getAllByRole('row')).toHaveLength(19);
    expect(within(typesPanel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tipi', 'Copertura', 'Coperto da']);
  });

  it('Coverage meta: i buchi e ogni bersaglio con chi lo copre', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/Buchi:|Nessun buco/);
    // Al posto del peso, quanto è coperto ogni bersaglio
    expect(within(panel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tipi', 'Pokémon', 'Copertura', 'Coperto da']);
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    // 70/90/100 per chi manda KO in due colpi; un superefficace da 3HKO copre a metà (35, 45…)
    for (const row of rows) expect(within(row).getAllByRole('cell')[1]).toHaveTextContent(/^\d+%$/);
    // Per i lettori di schermo chi copre è scritto in testo (lo sprite da solo non dice niente)
    const firstCover = panel.querySelector('.ad-cover');
    if (firstCover?.querySelector('img')) expect(firstCover.querySelector('.visually-hidden')?.textContent).toMatch(/\d+%/);
    // Passando sul Pokémon che copre: la mossa e il danno
    const cover = panel.querySelector('.ad-cover [title]');
    if (cover) expect(cover.getAttribute('title')).toMatch(/^.+: .+ \d+%( \(.+\))?$/);
  });

  it('frecce fra le schede; nessuna finestra', async () => {
    const { user, dialog } = await openOffense('it');
    within(dialog).getAllByRole('tab')[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('tab', { name: /^Potenza/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('in inglese', async () => {
    const { dialog } = await openOffense('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['General', 'Power', 'Wallbreaking', 'Type coverage', 'Meta coverage']);
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Power', 'Wallbreaking', 'Coverage', 'Offense']);
  });
});

async function openDefense(lang: 'it' | 'en') {
  return openArea(lang, lang === 'it' ? /^Difesa \d+, apri il dettaglio/ : /^Defense \d+, open details/);
}

describe('dettaglio della Difesa a schede', () => {
  it('cinque schede col loro valore; Generale con le sottostatistiche e Fisica, Speciale, Sostenibilità di ogni membro', async () => {
    const { dialog } = await openDefense('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Generale', 'Robustezza', 'Sostenibilità', 'Coverage tipi', 'Coverage meta']);
    for (const tab of tabs) expect(tab.textContent).toMatch(/\d+$/);
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('term').map(term => term.textContent)).toEqual(['Robustezza', 'Sostenibilità', 'Coverage tipi', 'Coverage meta']);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Fisica', 'Speciale', 'Sostenibilità', 'Difesa']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveTextContent(/^\d+$/);
  });

  it('Coverage tipi: spiega i punti per tipo (immunità +2 ... ×4 −2)', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('immunità +2, ×¼ +1,5, ×½ +1, neutro 0, debolezza ×2 −1, ×4 −2');
  });

  it('Robustezza: attaccanti fisici e speciali per membro, con il danno del colpo standard e la soglia', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Robustezza/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/potenza 100/);
    expect(panel).toHaveTextContent('Attaccanti fisici');
    expect(panel).toHaveTextContent('Attaccanti speciali');
    const attackers = within(panel).getAllByRole('row').filter(r => within(r).queryAllByRole('cell').length === 2);
    expect(attackers).toHaveLength(20);
    for (const row of attackers) for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveTextContent(/^\d+% (OHKO|2HKO|3HKO|4HKO\+)$/);
    // Ogni casella dice la soglia: OHKO, 2HKO, 3HKO o 4HKO e oltre
    expect(panel.querySelectorAll('td .ad-k[title]').length).toBe(40);
    expect([...panel.querySelectorAll('td .ad-k[title]')].every(k => /^(OHKO|2HKO|3HKO|4HKO\+)$/.test(k.getAttribute('title')!))).toBe(true);
    expect(panel).toHaveTextContent(/4HKO\+/);
    // Percentuale e soglia dallo stesso tiro (il più alto): 2HKO vuol dire almeno 50%
    const LIMITS: Record<string, [number, number]> = { OHKO: [100, 100], '2HKO': [50, 99], '3HKO': [33, 49], '4HKO+': [0, 33] };
    for (const tag of panel.querySelectorAll('td .ad-k[title]')) {
      const pct = Number(tag.textContent!.match(/^(\d+)%/)![1]);
      const [lo, hi] = LIMITS[tag.getAttribute('title')!];
      expect(pct).toBeGreaterThanOrEqual(lo);
      expect(pct).toBeLessThanOrEqual(hi);
      // La soglia non sta solo nel colore: anche in testo per i lettori di schermo
      expect(tag.querySelector('.visually-hidden')?.textContent).toBe(` ${tag.getAttribute('title')}`);
    }
    // Un gruppo di righe per lato, ognuno col suo titolo
    const groups = panel.querySelectorAll('tbody');
    expect(groups).toHaveLength(2);
    expect([...groups].map(g => g.querySelector('th[scope="rowgroup"]')?.textContent)).toEqual(['Attaccanti fisici', 'Attaccanti speciali']);
  });

  it('Sostenibilità: recupero, Stealth Rock e Life Orb per membro', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Sostenibilità/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Recupero', 'Stealth Rock', 'Life Orb', 'Sostenibilità']);
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent(/^(\+\d+%.*|—)$/);
      expect(cells[1]).toHaveTextContent(/^(−\d+%|—)$/);
      expect(cells[3]).toHaveTextContent(/^\d+$/);
    }
  });

  it('Coverage tipi: i 18 tipi con sicurezza, deboli e resistenti', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    const panel = within(dialog).getByRole('tabpanel');
    // In cima la tabella completa delle debolezze (vedi AreaTables.test); qui quella della sicurezza per tipo
    const safety = within(panel).getAllByRole('table').at(-1)!;
    expect(within(safety).getAllByRole('row')).toHaveLength(19);
    expect(within(safety).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tipi', 'Sicurezza', 'Deboli', 'Resistono']);
    expect(panel).toHaveTextContent(/Più deboli che resistenti:|Nessun tipo scoperto/);
  });

  it('Coverage meta: ogni minaccia con quanto è retta e chi la regge; quelle senza risposta', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/Senza risposta:|Ogni minaccia ha una risposta/);
    expect(within(panel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Minaccia', 'Retta', 'Chi la regge']);
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(within(row).getAllByRole('cell')[0]).toHaveTextContent(/^\d+%$/);
    const holder = panel.querySelector('.ad-cover [title]');
    if (holder) {
      expect(holder.getAttribute('title')).toMatch(/^.+: .+ \d+%( \(.+\))?$/);
      expect(holder.querySelector('.visually-hidden')?.textContent).toBe(holder.getAttribute('title'));
    }
  });

  it('in inglese', async () => {
    const { dialog } = await openDefense('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['General', 'Robustness', 'Sustainability', 'Type coverage', 'Meta coverage']);
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Physical', 'Special', 'Sustainability', 'Defense']);
  });
});

async function openSpeed(lang: 'it' | 'en') {
  return openArea(lang, lang === 'it' ? /^Velocità \d+, apri il dettaglio/ : /^Speed \d+, open details/);
}

describe('dettaglio della Velocità a schede', () => {
  it('tre schede col loro valore; Generale con Velocità e Controllo velocità e i membri', async () => {
    const { dialog } = await openSpeed('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\+?\d+$/, ''))).toEqual(['Generale', 'Velocità', 'Controllo velocità']);
    for (const tab of tabs) expect(tab.textContent).toMatch(/\d+$/);
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('term').map(term => term.textContent)).toEqual(['Velocità', 'Controllo velocità']);
    // Il controllo è un plus in punti sopra la Velocità
    expect(within(panel).getAllByRole('definition')[1]).toHaveTextContent(/^\+\d+/);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Velocità', 'Superati', 'Totale']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent(/^\d+$/);
      expect(cells[1]).toHaveTextContent(/^\d+%$/);
      // Il totale coi guadagni: tra parentesi, in verde, quanto aggiungono le condizioni (il tooltip dice quali)
      expect(cells[2]).toHaveTextContent(/^\d+%( \(\+\d+\))?$/);
      const gain = cells[2].querySelector('.ad-gain');
      if (gain) expect(gain.getAttribute('title')).toMatch(/: \+\d+/);
    }
  });

  it('Velocità: la quota pura e una colonna per ogni condizione del membro (setup, meteo, Unburden, priorità)', async () => {
    const { user, dialog } = await openSpeed('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Velocità/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/25\/20\/16\/14\/13\/12/);
    const headers = within(panel).getAllByRole('columnheader').map(h => h.textContent);
    expect(headers.slice(0, 3)).toEqual(['Pokémon', 'Velocità', 'Pura']);
    for (const h of headers.slice(3, -1)) expect(['Setup', 'Meteo', 'Unburden', 'Priorità']).toContain(h);
    expect(headers[headers.length - 1]).toBe('Totale');
  });

  it('Controllo velocità senza mosse di controllo: una riga, e un plus di 0', async () => {
    const { user, dialog } = await openSpeed('it');
    expect(within(dialog).getAllByRole('tab')[2]).toHaveTextContent(/^Controllo velocità \+0$/);
    await user.click(within(dialog).getByRole('tab', { name: /^Controllo velocità/ }));
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('nessun controllo della velocità');
  });

  it('Controllo velocità: chi porta la mossa, quanti compagni aiuta e quanti punti aggiunge', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Clefable @ Leftovers\nAbility: Magic Guard\nEVs: 252 HP / 252 Def\nBold Nature\n- Thunder Wave\n- Moonblast\n\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    await user.click(within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: /^Velocità \d+, apri il dettaglio/ }));
    const dialog = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
    const controlTab = within(dialog).getByRole('tab', { name: /^Controllo velocità/ });
    expect(controlTab).toHaveTextContent(/^Controllo velocità \+\d+$/);
    await user.click(controlTab);
    const table = within(within(dialog).getByRole('tabpanel')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Mossa', 'Aiuta', 'Punti']);
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Clefable');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Thunder Wave');
    // I membri aiutati, chi porta la mossa compreso
    expect(cells[1]).toHaveTextContent(/^\d membr[oi]$/);
    expect(cells[2]).toHaveTextContent(/^\+\d+$/);
  });

  it('in inglese', async () => {
    const { dialog } = await openSpeed('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\+?\d+$/, ''))).toEqual(['General', 'Speed', 'Speed control']);
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Speed', 'Outsped', 'Total']);
  });
});
