import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

beforeEach(() => window.localStorage.clear());

const plate = () => document.querySelector('.team-plate') as HTMLElement;
const savedButton = () => document.querySelector('.saved-menu > summary') as HTMLElement;

describe('la targa del team e la linguetta Team salvati', () => {
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

  it('la linguetta Team salvati (nella barra, prima di Importa) apre il menu; la targa non è un menu', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    expect(plate().closest('details')).toBeNull();
    expect(savedButton()).toHaveAccessibleName('Team salvati (0)');
    expect(savedButton().closest('.team-tabs')).not.toBeNull();
    await user.click(savedButton());
    expect(savedButton().closest('details')).toHaveAttribute('open');
  });

  it('ogni riga mostra solo i Pokémon che il team ha e quanti sono (1/6), senza caselle vuote', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Corto{Enter}');
    const row = screen.getByRole('button', { name: 'Corto' });
    expect(row.querySelectorAll('.saved-sprites > *')).toHaveLength(1);
    expect(row.querySelector('.saved-gap')).toBeNull();
    expect(row.querySelector('.saved-size')).toHaveTextContent('1/6');
    expect(savedButton()).toHaveAccessibleName('Team salvati (1)');
  });
});

describe('salvare le modifiche al team caricato', () => {
  it('Salva le modifiche sovrascrive il team con lo stesso nome, senza chiedere il nome', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    expect(screen.queryByRole('button', { name: 'Salva le modifiche a Prova' })).toBeNull();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gholdengo{Enter}');
    await user.click(screen.getByRole('button', { name: 'Salva le modifiche a Prova' }));
    const { loadSavedTeams } = await import('../../src/storage');
    expect(loadSavedTeams().map(t => t.name)).toEqual(['Prova']);
    expect(loadSavedTeams()[0].text).toContain('Gholdengo');
    expect(document.querySelector('.plate-dot')).toBeNull();
  });
});
