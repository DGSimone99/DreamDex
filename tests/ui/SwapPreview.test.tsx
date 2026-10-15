import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('anteprima del sostituto nel coaching', () => {
  it('aprire un sostituto aggiorna la raccomandazione; annullare la ripristina', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const card = () => screen.getByRole('button', { name: 'Vedi sostituti per Magikarp' }).closest('li')!;
    const proposed = within(card()).getByText((_, el) => el?.tagName === 'STRONG').textContent;

    await user.click(screen.getByRole('button', { name: 'Vedi sostituti per Magikarp' }));
    const rows = within(screen.getByRole('region', { name: 'Suggerimenti' })).getAllByRole('listitem');
    const name = (row: HTMLElement) => row.querySelector('.who strong')?.textContent?.replace(/^\d+\. /, '');
    const row = rows.find(r => name(r) && name(r) !== proposed)!;
    const other = name(row)!;
    await user.click(row.querySelector('summary')!);
    expect(within(row).getByText(/Magikarp/)).toBeInTheDocument();

    expect(within(card()).getByText(other)).toBeInTheDocument();
    expect(within(card()).getByText('Selezionato')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(within(card()).getByText(proposed!)).toBeInTheDocument();
    expect(within(card()).queryByText('Selezionato')).toBeNull();
  });
});
