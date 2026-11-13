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
  it('tre schede col loro valore (niente Wallbreaking né Potenza); si parte da Generale con le sottostatistiche e i membri', async () => {
    const { dialog } = await openOffense('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Generale', 'Coverage tipi', 'Coverage meta']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    // Solo la tabella dei membri: niente tessere sotto
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Coverage tipi', 'Coverage meta', 'Offesa']);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[];
    expect(rows.map(r => r.querySelector('.def-mon-name')!.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      // Tre barre col numero: voto tipi, voto meta, voto del membro (i dettagli solo a squadra chiusa)
      for (const cell of cells) expect(cell).toHaveTextContent(/^\d+%?$/);
      expect(cells[1]).toHaveTextContent(/%$/);
    }
    // La riga Totale coi voti del team
    expect(table.querySelector('tfoot tr')).toHaveTextContent(/^Team Coverage\d+\d+%\d+$/);
  });

  it('Coverage tipi: i 18 tipi, i buchi e quanto li colpisce ogni membro', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    const typesPanel = within(dialog).getByRole('tabpanel');
    // Le spiegazioni stanno nella guida, non sulla pagina
    expect(typesPanel.querySelector('.ad-how')).toBeNull();
    // Ora una tabella membri × 18 tipi: intestazione, un membro per riga, riga Copertura
    expect(within(typesPanel).getAllByRole('columnheader')).toHaveLength(19);
    expect(within(typesPanel).getAllByRole('row').at(-1)).toHaveTextContent(/^Copertura/);
  });

  it('Coverage meta: una tabella membri × bersagli, con la riga Lo coprono', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(dialog).getByRole('tabpanel');
    const rows = within(panel).getAllByRole('row');
    // Intestazione, due membri, Lo coprono
    expect(rows).toHaveLength(4);
    for (const row of rows.slice(1, 3)) {
      for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveTextContent(/^\d+%( (OHKO|2HKO|3HKO))?(setup \d+%)?$/);
    }
    expect(rows[3]).toHaveTextContent(/^Lo coprono/);
  });

  it('frecce fra le schede; nessuna finestra', async () => {
    const { user, dialog } = await openOffense('it');
    within(dialog).getAllByRole('tab')[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('in inglese', async () => {
    const { dialog } = await openOffense('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['General', 'Type coverage', 'Meta coverage']);
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Type coverage', 'Meta coverage', 'Offense']);
  });
});

async function openDefense(lang: 'it' | 'en') {
  return openArea(lang, lang === 'it' ? /^Difesa \d+, apri il dettaglio/ : /^Defense \d+, open details/);
}

describe('dettaglio della Difesa a schede', () => {
  it('quattro schede col loro valore; Generale con le sottostatistiche e Fisica, Speciale, Sostenibilità di ogni membro', async () => {
    const { dialog } = await openDefense('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Generale', 'Coverage tipi', 'Sostenibilità', 'Coverage meta']);
    for (const tab of tabs) expect(tab.textContent).toMatch(/\d+$/);
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel.querySelectorAll('.def-tile')).toHaveLength(0);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Regge i tipi', 'Regge il meta', 'Sostenibilità', 'Difesa']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').querySelector('.def-mon-name')!.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveTextContent(/^\d+%?( \(\+\d+\))?$/);
  });

  it('Coverage tipi: la regola (attaccante forte, 4HKO pieno, 3HKO a metà) sta nella guida, non sulla pagina', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent(/quarto più forte di quel tipo/);
    await user.click(within(dialog).getByRole('button', { name: 'Come funziona Coverage tipi' }));
    const guide = within(screen.getByRole('dialog')).getByRole('tabpanel');
    for (const text of [/quarto più forte di quel tipo; 252 EV, senza strumento/, "Att. e Att. Sp. dell'attaccante di ogni tipo", '4HKO', '3HKO', '2HKO', '70%']) expect(guide).toHaveTextContent(text);
    expect(guide).not.toHaveTextContent(/Il voto|uno basta|tre lo reggono/);
    expect(guide).not.toHaveTextContent('+1,5');
  });

  it('Sostenibilità: recupero, Stealth Rock e strumenti per membro', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Sostenibilità/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Perde', 'Recupera', 'Netto', 'Sostenibilità', 'Stealth Rock', 'Strumenti e mosse']);
    const rows = within(panel).getAllByRole('row').filter(r => within(r).queryAllByRole('rowheader').length);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // Stealth Rock e strumenti a parte (un valore negativo o un trattino), poi il recupero, il netto e il valore
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent(/^(−\d+%.*|—)$/);
      expect(cells[1]).toHaveTextContent(/^(−\d+%|—)$/);
      expect(cells[2]).toHaveTextContent(/^(\+\d+%.*|—)$/);
      expect(cells[3]).toHaveTextContent(/^[+−]?\d+%$/);
      expect(cells[4]).toHaveTextContent(/^\d+$/);
    }
  });

  it('Coverage tipi: una tabella membri × 18 tipi con Regge, e la Copertura del tipo nel suggerimento', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    const table = within(within(dialog).getByRole('tabpanel')).getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // testata, 2 membri, Regge
    const held = within(table).getByRole('row', { name: /^Regge/ });
    const cells = within(held).getAllByRole('cell').slice(0, 18);
    expect(cells).toHaveLength(18);
    for (const cell of cells) expect(cell.querySelector('.ct-pill')).toHaveAttribute('title', expect.stringMatching(/^Copertura \d+%$/));
  });

  it('Coverage meta: una tabella membri × minacce, con la riga Regge', async () => {
    const { user, dialog } = await openDefense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage meta/ }));
    const table = within(within(dialog).getByRole('tabpanel')).getByRole('table');
    expect(within(table).getByRole('row', { name: /^Regge/ })).toBeInTheDocument();
    for (const cell of within(within(table).getAllByRole('row')[1]).getAllByRole('cell')) expect(cell).toHaveTextContent(/^(\d+%.*|KO)$/);
  });

  it('in inglese', async () => {
    const { dialog } = await openDefense('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['General', 'Type coverage', 'Sustainability', 'Meta coverage']);
    const { user } = { user: userEvent.setup() };
    await user.click(within(dialog).getByRole('tab', { name: /^Type coverage/ }));
    expect(within(within(dialog).getByRole('tabpanel')).getByRole('rowheader', { name: 'Holds' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('tab', { name: /^General/ }));
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Holds types', 'Holds meta', 'Sustainability', 'Defense']);
  });
});

async function openSpeed(lang: 'it' | 'en') {
  return openArea(lang, lang === 'it' ? /^Velocità \d+, apri il dettaglio/ : /^Speed \d+, open details/);
}

describe('dettaglio della Velocità a schede', () => {
  it('una scheda sola col suo valore; i membri con la barra e le tessere', async () => {
    const { dialog } = await openSpeed('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\+?\d+$/, ''))).toEqual(['Generale']);
    for (const tab of tabs) expect(tab.textContent).toMatch(/\d+$/);
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'Velocità di Great Tusk: apri i rivali' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Velocità di Gholdengo: apri i rivali' })).toBeInTheDocument();
    expect(panel.querySelectorAll('.def-tile')).toHaveLength(0);
  });

  it('col controllo: la barra spiega la mossa nel suggerimento', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Clefable @ Leftovers\nAbility: Magic Guard\nEVs: 252 HP / 252 Def\nBold Nature\n- Thunder Wave\n- Moonblast\n\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    await user.click(within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: /^Velocità \d+, apri il dettaglio/ }));
    const dialog = within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;
    const bar = within(dialog).getByRole('button', { name: 'Velocità di Clefable: apri i rivali' });
    expect(bar.getAttribute('title')).toMatch(/Thunder Wave/);
  });

  it('in inglese', async () => {
    const { dialog } = await openSpeed('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\+?\d+$/, ''))).toEqual(['General']);
    expect(within(dialog).getByRole('button', { name: 'Speed of Great Tusk: open the rivals' })).toBeInTheDocument();
  });
});
