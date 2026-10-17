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
    expect(within(rating).getByText(/^Offesa \d+$/)).toHaveAttribute('data-tip', expect.stringMatching(/^Great Tusk \d+\nGholdengo \d+$/));
    // Coverage difensiva (tipi) e Robustezza (quanto incassano i membri) sono due barre
    expect(rating).toHaveTextContent(/Coverage difensiva \d+/);
    expect(within(rating).getByText(/^Robustezza \d+$/)).toHaveAttribute('data-tip', expect.stringMatching(/^Quanto incassa ogni membro\n(Great Tusk|Gholdengo) \d+\n(Great Tusk|Gholdengo) \d+$/));
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
    // Il tooltip mostra quanti tipi colpisce ogni membro e dove porta il clic
    expect(offensive).toHaveAttribute('data-tip', expect.stringMatching(/^Tipi colpiti super efficace \(su ogni tipo: 1 membro vale 70, 2 vale 90, 3 vale 100\)\n.+\nVai a Coverage offensiva$/s));
    await user.click(offensive);
    expect(coverage).toHaveAttribute('open');
    expect(within(rating).getByRole('button', { name: /^Coverage difensiva \d+$/ }))
      .toHaveAttribute('data-tip', 'Saldo su ogni tipo: immunità +2, ×¼ +1,5, ×½ +1, ×2 −1, ×4 −2. Un tipo è al sicuro da +2 in su\nVai a Debolezze difensive');
    expect(within(rating).queryByRole('button', { name: /^Offesa/ })).toBeNull();
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
});
