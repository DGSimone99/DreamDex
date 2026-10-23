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
    // Coverage difensiva (tipi) e Robustezza (quanto incassano i membri) sono due barre
    expect(rating).toHaveTextContent(/Coverage difensiva \d+/);
    expect(within(rating).getByText(/^Robustezza \d+$/)).toHaveAttribute('data-tip', expect.stringMatching(/^(Great Tusk|Gholdengo) \d+\n(Great Tusk|Gholdengo) \d+$/));
    expect(rating).toHaveTextContent(/Velocità \d+/);
    expect(rating).not.toHaveTextContent('Sinergia');
  });

  it('Coverage offensiva, Coverage difensiva e Ruoli portano alla loro scheda aprendola', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    const coverage = screen.getByText('Coverage offensiva', { selector: 'summary span' }).closest('details')!;
    // Nella scheda Analisi parte aperta: si chiude per vedere che il link la riapre
    expect(coverage).toHaveAttribute('open');
    await user.click(coverage.querySelector('summary')!);
    expect(coverage).not.toHaveAttribute('open');
    const offensive = within(rating).getByRole('button', { name: /^Coverage offensiva \d+$/ });
    // Il tooltip mostra solo i dati (quanti tipi colpisce ogni membro) e dove porta il clic; le regole sono nel "?"
    expect(offensive).toHaveAttribute('data-tip', expect.stringMatching(/^Tipi colpiti super efficace da ogni membro\n.+\nVai a Coverage offensiva$/s));
    await user.click(offensive);
    expect(coverage).toHaveAttribute('open');
    expect(within(rating).getByRole('button', { name: /^Coverage difensiva \d+$/ })).toHaveAttribute('title', 'Vai a Debolezze difensive');
    // L'Offesa invece apre il suo dettaglio (vedi AreaDetail.test)
    expect(within(rating).getByRole('button', { name: /^Offesa \d+$/ })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('mostra le ridondanze con il dettaglio', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Great Tusk\n- Stealth Rock\n\nGarchomp\n- Stealth Rock');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    expect(rating).toHaveTextContent(/Penalità −\d+/);
    expect(rating).toHaveTextContent('2 setter di Stealth Rock (−2)');
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
    expect(topics).toEqual(['Come funziona', 'Coverage offensiva', 'Coverage difensiva', 'Offesa', 'Robustezza', 'Ruoli', 'Velocità', 'Meta', 'Bonus e penalità']);
    // Un team incompleto si giudica come Balance: la sua riga è evidenziata
    expect(within(dialog).getByText('Il tuo team è giudicato come Balance')).toBeInTheDocument();
    expect(within(dialog).getByRole('row', { current: true })).toHaveTextContent(/^Balance/);
    await user.click(within(dialog).getByRole('tab', { name: 'Meta' }));
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Sopra il 65% non cambia niente');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });
});
