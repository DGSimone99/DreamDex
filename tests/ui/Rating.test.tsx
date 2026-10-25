import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
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
    expect(rating).toHaveTextContent(/Penalità −\d+/);
    expect(rating).toHaveTextContent('2 setter di Stealth Rock (−1)');
  });

  it('mostra il bonus del meteo e la nota sotto la tabella delle debolezze', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(screen.getByRole('group', { name: 'Valutazione team' })).toHaveTextContent('Bonus +1');
    expect(screen.getByText((_, el) => el?.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('nessuna riga ridondanze se non ce ne sono', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(screen.getByRole('group', { name: 'Valutazione team' })).not.toHaveTextContent('Penalità');
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
    // A sinistra gli argomenti: come funziona, le aree, bonus e penalità
    const topics = within(dialog).getAllByRole('tab').map(tab => tab.textContent);
    expect(topics).toEqual(['Come funziona', 'Difesa', 'Offesa', 'Ruoli', 'Velocità', 'Bonus e penalità']);
    // Un team incompleto si giudica come Balance: la sua riga è evidenziata
    expect(within(dialog).getByText('Il tuo team è giudicato come Balance')).toBeInTheDocument();
    expect(within(dialog).getByRole('row', { current: true })).toHaveTextContent(/^Balance/);
    await user.click(within(dialog).getByRole('tab', { name: 'Difesa' }));
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Metà robustezza e metà coverage difensiva');
    // Ruoli: i livelli (essenziale solo malus, importante ±, minore solo extra), le quattro famiglie e il Disturbo
    await user.click(within(dialog).getByRole('tab', { name: 'Ruoli' }));
    const roles = within(dialog).getByRole('tabpanel');
    expect(roles).toHaveTextContent('Essenziale: solo malus');
    expect(roles).toHaveTextContent('Minore: solo un extra');
    expect(roles).toHaveTextContent(/Attacco.*Difesa.*Campo.*Disturbo/);
    expect(roles).toHaveTextContent('Taunt ed Encore valgono la quota del meta');
    expect(roles).not.toHaveTextContent(/interruttore|misurati anche/i);
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
    // Le altre aree non sono grigie
    expect(within(rating).getByRole('button', { name: /^Difesa \d+$/ }).closest('div')).not.toHaveClass('inactive');
    await user.click(speed);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
