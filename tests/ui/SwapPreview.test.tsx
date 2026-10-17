import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('anteprima del sostituto nel coaching', () => {
  it('aprire un sostituto aggiorna la raccomandazione; annullare la ripristina', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const card = () => screen.getByRole('button', { name: 'Altri sostituti per Magikarp' }).closest('li')!;
    const proposed = card().querySelector('.swap-head .mon-name:not(.muted) strong')!.textContent;

    await user.click(screen.getByRole('button', { name: 'Altri sostituti per Magikarp' }));
    const rows = within(screen.getByRole('region', { name: 'Suggerimenti' })).getAllByRole('listitem');
    const name = (row: HTMLElement) => row.querySelector('.who strong')?.textContent?.replace(/^\d+\. /, '');
    const row = rows.find(r => name(r) && name(r) !== proposed)!;
    const other = name(row)!;
    await user.click(row.querySelector('.pick')!);
    expect(within(screen.getByRole('complementary', { name: `Dettaglio di ${other}` })).getByText(/Magikarp/)).toBeInTheDocument();

    expect(within(card()).getByText(other)).toBeInTheDocument();
    expect(within(card()).getByText('Selezionato')).toBeInTheDocument();

    // Tornare ad aggiungere chiude la sostituzione
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    expect(within(card()).getByText(proposed!)).toBeInTheDocument();
    expect(within(card()).queryByText('Selezionato')).toBeNull();
  });

  it('"Sostituisci" nella card mette subito nel team il sostituto mostrato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const card = screen.getByRole('button', { name: 'Altri sostituti per Magikarp' }).closest('li')!;
    const proposed = card.querySelector('.swap-head .mon-name:not(.muted) strong')!.textContent!;

    await user.click(within(card).getByRole('button', { name: `Sostituisci Magikarp con ${proposed}` }));

    const team = screen.getByRole('region', { name: 'Team' });
    expect(within(team).getByText(proposed)).toBeInTheDocument();
    expect(within(team).queryByText('Magikarp')).toBeNull();
  });

  it('"Sostituisci" usa il sostituto selezionato in "Altri sostituti"', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const card = () => screen.getByRole('button', { name: 'Altri sostituti per Magikarp' }).closest('li')!;
    const proposed = card().querySelector('.swap-head .mon-name:not(.muted) strong')!.textContent!;
    await user.click(screen.getByRole('button', { name: 'Altri sostituti per Magikarp' }));
    const rows = within(screen.getByRole('region', { name: 'Suggerimenti' })).getAllByRole('listitem');
    const name = (row: HTMLElement) => row.querySelector('.who strong')?.textContent?.replace(/^\d+\. /, '');
    const row = rows.find(r => name(r) && name(r) !== proposed)!;
    const other = name(row)!;
    await user.click(row.querySelector('.pick')!);

    await user.click(within(card()).getByRole('button', { name: `Sostituisci Magikarp con ${other}` }));

    expect(within(screen.getByRole('region', { name: 'Team' })).getByText(other)).toBeInTheDocument();
  });
});
