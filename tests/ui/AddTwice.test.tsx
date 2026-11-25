import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { LangProvider } from '../../src/i18n/react';
import { DoneToast } from '../../src/ui/UndoToast';

// Monta l'App intera: sotto il carico della suite completa può superare i 15 s del default
vi.setConfig({ testTimeout: 60000 });

/**
 * Due aggiunte di fila mentre la lista dei candidati è ancora quella di prima (si ricalcola in sottofondo): la seconda
 * può chiedere lo stesso Pokémon appena entrato, o arrivare col team già pieno. Prima entrava una seconda copia della
 * stessa specie e il team restava bloccato (niente voto, lista vuota); ora la seconda aggiunta non passa e lo dice.
 */
describe('aggiungere due volte di fila', () => {
  beforeEach(() => window.localStorage.clear());

  it('la stessa specie non entra due volte: resta una sola e un avviso lo dice', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    const search = screen.getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'Great Tusk{Enter}');
    await user.type(search, 'Great Tusk{Enter}');
    expect(screen.getAllByRole('button', { name: 'Rimuovi Great Tusk' })).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Great Tusk è già nel team');
  });

  it("l'avviso dice anche il team pieno (la settima aggiunta, arrivata prima che il team si aggiorni)", () => {
    render(<LangProvider lang="it"><DoneToast note={{ id: 1, kind: 'full', name: 'Garchomp' }} onClose={() => {}} /></LangProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('Il team è pieno: Garchomp non è entrato');
  });
});
