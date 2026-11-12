import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

beforeEach(() => window.localStorage.clear());

const plate = () => document.querySelector('.plate-menu > summary') as HTMLElement;

describe('la targa del team apre i team salvati', () => {
  it('dopo il salvataggio mostra il nome; cambiando il team compare il pallino, ricaricandolo sparisce', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    expect(plate().querySelector('.plate-name')).toHaveTextContent('Prova');
    expect(plate().querySelector('.plate-dot')).toBeNull();

    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gholdengo{Enter}');
    expect(plate().querySelector('.plate-dot')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Prova' }));
    expect(plate().querySelector('.plate-name')).toHaveTextContent('Prova');
    expect(plate().querySelector('.plate-dot')).toBeNull();
  });

  it('clic sulla targa apre il menu', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(plate());
    expect(plate().closest('details')).toHaveAttribute('open');
  });
});
