import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { RatingPanel } from '../../src/ui/RatingPanel';
import { LangProvider } from '../../src/i18n/react';
import type { TeamRating } from '../../src/engine/rating';
import { fixtureData } from '../fixtures/data';

describe('Valutazione team', () => {
  it('voto, punteggio, etichetta e aree', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    expect(rating).toHaveTextContent(/[SABCD]\s*\d+\/100 · \w+/);
    expect(rating).not.toHaveTextContent('provvisoria');
    // Il dettaglio per membro (quanto colpisce) sta nel tooltip di "Offesa"
    expect(rating).not.toHaveTextContent('Offesa: Great Tusk');
    expect(within(rating).getByText(/^Offesa \d+$/)).toHaveAttribute('data-tip', expect.stringMatching(/^(Great Tusk|Gholdengo) \d+\n(Great Tusk|Gholdengo) \d+$/));
    // La Difesa unisce coverage difensiva e robustezza: nel tooltip la Difesa di ogni membro
    expect(within(rating).getByText(/^Difesa \d+$/)).toHaveAttribute('data-tip', expect.stringMatching(/^(Great Tusk|Gholdengo) \d+\n(Great Tusk|Gholdengo) \d+$/));
    expect(rating).not.toHaveTextContent(/Robustezza \d+/);
    expect(rating).toHaveTextContent(/Velocità \d+/);
    expect(rating).not.toHaveTextContent('Sinergia');
  });

  it("Offesa, Difesa e Ruoli aprono il loro dettaglio; la Coverage offensiva è dentro l'Offesa", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    // La scheda Coverage offensiva resta nell'Analisi, ma nel voto non è più una barra
    expect(screen.getByText('Coverage offensiva', { selector: 'summary span' })).toBeInTheDocument();
    expect(within(rating).queryByRole('button', { name: /^Coverage offensiva/ })).toBeNull();
    // Offesa e Difesa aprono il loro dettaglio (vedi AreaDetail.test)
    expect(within(rating).getByRole('button', { name: /^Difesa \d+$/ })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(rating).getByRole('button', { name: /^Offesa \d+$/ })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(rating).getByRole('button', { name: /^Ruoli \d+$/ })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('mostra le ridondanze con il dettaglio', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Great Tusk\n- Stealth Rock\n\nGarchomp\n- Stealth Rock');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    expect(rating).toHaveTextContent(/Bonus\/Malus −\d+/);
    expect(rating).toHaveTextContent('2 setter di Stealth Rock (−1)');
  });

  it('mostra il bonus del meteo e la nota sotto la tabella delle debolezze', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(screen.getByRole('group', { name: 'Valutazione team' })).toHaveTextContent('Bonus/Malus +1 (−0 / +1)');
    expect(screen.getByText((_, el) => el?.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('nessuna lista di bonus e malus se non ce ne sono', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(screen.getByRole('group', { name: 'Valutazione team' })).not.toHaveTextContent(/\(−\d+\)|\(\+\d+\)/);
  });

  it('nessuna valutazione con il team vuoto', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });

  it('senza dati Smogon la forza resta calcolata, il Meta Use avvisa', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(screen.getByRole('group', { name: 'Valutazione team' })).not.toHaveTextContent('Statistiche n/d');
    expect(screen.getByRole('group', { name: 'Meta Use' })).toHaveTextContent('Statistiche Smogon assenti');
  });

  it('Meta Use sta in fondo, subito prima di Minacce del meta', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const meta = screen.getByRole('group', { name: 'Meta Use' });
    const roles = screen.getByText('Ruoli', { selector: 'summary span' });
    const threats = screen.getByText('Minacce del meta');
    expect(roles.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.compareDocumentPosition(threats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Meta Use: uso nel meta di ogni membro, fuori dalla valutazione', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const meta = screen.getByRole('group', { name: 'Meta Use' });
    expect(meta).toHaveTextContent('Great Tusk 30,0%');
    expect(meta).toHaveTextContent('Gholdengo 25,0%');
    expect(meta).toHaveTextContent('Magikarp non presente nelle statistiche');
  });

  it('il "?" accanto al titolo apre come funziona il voto, senza chiudere il pannello', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const panel = screen.getByRole('group', { name: 'Valutazione team' });
    const help = within(panel).getByRole('button', { name: 'Come funziona il voto' });
    await user.click(help);
    expect(panel).toHaveAttribute('open');
    const dialog = screen.getByRole('dialog', { name: 'Come funziona il voto' });
    // A sinistra gli argomenti: come funziona e un tab per tipo di team
    const topics = within(dialog).getAllByRole('tab').map(tab => tab.textContent);
    expect(topics).toEqual(['Come funziona', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    // Un team incompleto si giudica come Balance: il suo tab è aperto per primo e segnato come il tipo attuale
    const balanceTab = within(dialog).getByRole('tab', { name: 'Balance' });
    expect(balanceTab).toHaveAttribute('aria-selected', 'true');
    expect(balanceTab).toHaveAttribute('aria-current', 'true');
    expect(within(dialog).getAllByRole('tab').filter(tab => tab.getAttribute('aria-current') === 'true')).toHaveLength(1);
    const balance = within(dialog).getByRole('tabpanel');
    expect(balance).toHaveTextContent('Il tuo team è giudicato come Balance');
    expect(balance).toHaveTextContent('Un team incompleto si giudica come Balance');
    // I livelli vengono dalla tabella del codice, non dai testi
    expect(balance).toHaveTextContent(/Essenziali.*Muro fisico/);
    // Stall: Velocità allo 0% e nota grigia; Recupero essenziale
    await user.click(within(dialog).getByRole('tab', { name: 'Stall' }));
    const stall = within(dialog).getByRole('tabpanel');
    expect(stall).toHaveTextContent('Velocità0%');
    expect(stall).toHaveTextContent('Non conta nello Stall');
    expect(stall).toHaveTextContent(/Essenziali.*Recupero.*Importanti/);
    expect(stall).not.toHaveTextContent('Il tuo team è giudicato come');
    // Come funziona: Bonus/Malus, lettere dalle soglie, nessun testo delle vecchie aree
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    const general = within(dialog).getByRole('tabpanel');
    expect(general).toHaveTextContent('Bonus/Malus');
    expect(general).toHaveTextContent('S da 90, A da 82, B da 70, C da 60');
    for (const tab of within(dialog).getAllByRole('tab')) {
      await user.click(tab);
      expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Debolezze condivise');
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('nello stall la Velocità resta visibile ma grigia, con la nota, e apre il suo dettaglio', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste([
      `Dondozo @ Leftovers
Ability: Unaware
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Body Press
- Liquidation
- Rest
- Sleep Talk`,
      `Blissey @ Leftovers
Ability: Natural Cure
EVs: 4 HP / 252 Def / 252 SpD
Bold Nature
- Protect
- Seismic Toss
- Toxic
- Wish`,
      `Clodsire @ Leftovers
Ability: Unaware
EVs: 252 HP / 4 Def / 252 SpD
Careful Nature
- Amnesia
- Poison Jab
- Recover
- Spikes`,
      `Corviknight @ Leftovers
Ability: Pressure
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Defog
- Iron Defense
- Roost`,
      `Gliscor @ Toxic Orb
Ability: Poison Heal
EVs: 244 HP / 248 Def / 16 Spe
Impish Nature
- Earthquake
- Protect
- Stealth Rock
- Toxic`,
      `Toxapex @ Rocky Helmet
Ability: Regenerator
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Knock Off
- Recover
- Scald
- Toxic Spikes`,
    ].join('\n\n'));
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    const speed = within(rating).getByRole('button', { name: /^Velocità \d+$/ });
    expect(speed.closest('div')).toHaveClass('inactive');
    expect(speed).toHaveAttribute('data-tip', expect.stringContaining('Non conta nello Stall'));
    expect(speed).toHaveAttribute('aria-description', 'Non conta nello Stall');
    // Le altre aree non sono grigie
    expect(within(rating).getByRole('button', { name: /^Difesa \d+$/ }).closest('div')).not.toHaveClass('inactive');
    await user.click(speed);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/** Valutazione minima, solo con ciò che serve alla barra Bonus/Malus. */
const fakeRating = (penalty: [string, number][], bonus: [string, number][], penaltyTotal?: number): TeamRating => ({
  teamType: 'balance', trickRoom: false, grade: 'B', overall: 70, label: 'Buono', archetype: 'balance', meta: false, areas: [],
  penalty: { total: penaltyTotal ?? penalty.reduce((n, [, p]) => n + p, 0), items: penalty.map(([text, points]) => ({ text, points })) },
  bonus: { total: bonus.reduce((n, [, p]) => n + p, 0), items: bonus.map(([text, points]) => ({ text, points })) },
}) as unknown as TeamRating;
const renderBar = (r: TeamRating) => {
  render(<LangProvider lang="it"><RatingPanel rating={r} /></LangProvider>);
  return screen.getByRole('meter', { name: /^Bonus\/Malus/ });
};
const fillOf = (bar: HTMLElement) => bar.querySelector('.net-fill') as HTMLElement | null;

describe('Barra Bonus/Malus', () => {
  it('malus netto: testo, riempimento rosso a sinistra del centro, valori ARIA', () => {
    const bar = renderBar(fakeRating([['Troppi setter', 8]], [['Sole', 2]]));
    expect(bar).toHaveAccessibleName('Bonus/Malus −6 (−8 / +2)');
    expect(bar).toHaveAttribute('aria-valuemin', '-15');
    expect(bar).toHaveAttribute('aria-valuemax', '15');
    expect(bar).toHaveAttribute('aria-valuenow', '-6');
    const fill = fillOf(bar)!;
    expect(fill).toHaveClass('neg');
    expect(fill.style.width).toBe('20%');
  });

  it('solo bonus: riempimento blu a destra', () => {
    const bar = renderBar(fakeRating([], [['Sole', 1]]));
    expect(bar).toHaveAccessibleName('Bonus/Malus +1 (−0 / +1)');
    const fill = fillOf(bar)!;
    expect(fill).toHaveClass('pos');
    expect(parseFloat(fill.style.width)).toBeCloseTo(3.33, 1);
  });

  it('netto 0 con voci: solo la tacca, la lista le mostra entrambe', () => {
    const bar = renderBar(fakeRating([['Un malus', 1]], [['Un bonus', 1]]));
    expect(bar).toHaveAccessibleName('Bonus/Malus 0 (−1 / +1)');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(fillOf(bar)).toBeNull();
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Un malus (−1)', 'Un bonus (+1)']);
  });

  it('malus 15: riempimento esattamente al 50%, mai oltre', () => {
    const bar = renderBar(fakeRating([['Tanti', 20]], [], 15));
    expect(fillOf(bar)!.style.width).toBe('50%');
    expect(bar).toHaveAttribute('aria-valuenow', '-15');
  });

  it('lista: prima i malus (−n), poi i bonus (+n)', () => {
    renderBar(fakeRating([['Malus A', 2]], [['Bonus B', 1]]));
    const items = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual(['Malus A (−2)', 'Bonus B (+1)']);
  });

  it('totali entrambi 0: nessuna lista, solo la tacca', () => {
    const bar = renderBar(fakeRating([], []));
    expect(bar).toHaveAccessibleName('Bonus/Malus 0 (−0 / +0)');
    expect(fillOf(bar)).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

/** Valutazione con le voci del catalogo, per il modale Bonus/Malus. */
const catalogRating = (teraCap: number) => ({
  ...fakeRating([], []),
  teraCap,
  penalty: { total: 8, items: [
    { text: 'Due setter di Stealth Rock', points: 1, catalog: 'hazardDuplicate' },
    { text: 'Due setter di Spikes', points: 2, catalog: 'hazardDuplicate' },
    { text: 'Troppi rimuovitori', points: 5, catalog: 'removers' },
  ] },
  bonus: { total: 2, items: [{ text: 'Sole aiuta', points: 2, catalog: 'weatherHelp' }] },
}) as unknown as TeamRating;

async function openCatalog(teraCap = 0) {
  const user = userEvent.setup();
  render(<LangProvider lang="it"><RatingPanel rating={catalogRating(teraCap)} /></LangProvider>);
  const button = screen.getByRole('button', { name: /^Bonus\/Malus/ });
  expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  await user.click(button);
  return { user, button, dialog: screen.getByRole('dialog', { name: 'Bonus/Malus −6' }) };
}

describe('Catalogo Bonus/Malus', () => {
  it('il titolo ha il netto; due schede Malus e Bonus; il meter prende il nome dall\'etichetta', async () => {
    const { dialog } = await openCatalog();
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Malus −8', 'Bonus +2']);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('meter')).not.toHaveAttribute('aria-label');
  });

  it('Malus: i 9 malus con nome, quando e punti; gli attivi evidenziati col punteggio attuale', async () => {
    const { dialog } = await openCatalog();
    const rows = within(within(dialog).getByRole('tabpanel')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(9);
    const hazard = rows.find(r => within(r).queryByText('Hazard ripetuto'))!;
    expect(hazard).toHaveClass('active');
    expect(hazard).toHaveAttribute('aria-current', 'true');
    expect(within(hazard).getAllByRole('cell').at(-1)).toHaveTextContent('−3');
    const removers = rows.find(r => r.className.includes('active') && r !== hazard)!;
    expect(removers).toHaveTextContent('−5');
    // Un team di 3: il ruolo essenziale mancante non è attivo
    const essential = rows.find(r => r.textContent!.includes('essenzial'))!;
    expect(essential).not.toHaveClass('active');
    expect(essential).not.toHaveAttribute('aria-current');
    expect(rows.filter(r => r.classList.contains('active'))).toHaveLength(2);
  });

  it('Bonus: Tera non applicabile fuori dalla Gen 9, mai attivo', async () => {
    const { user, dialog } = await openCatalog(0);
    await user.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    const rows = within(within(dialog).getByRole('tabpanel')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('active');
    expect(rows[0]).toHaveTextContent('+2');
    expect(rows[1]).toHaveClass('na');
    expect(rows[1]).toHaveTextContent('Solo Gen 9');
    expect(rows[1]).not.toHaveAttribute('aria-current');
  });

  it('Bonus con Tera applicabile: nessuna nota', async () => {
    const { user, dialog } = await openCatalog(3);
    await user.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Solo Gen 9');
  });

  it('Escape chiude e il focus torna al bottone dell\'etichetta', async () => {
    const { user, button } = await openCatalog();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });
});
