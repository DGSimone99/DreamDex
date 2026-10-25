import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('scheda dei membri', () => {
  it('compare col team, chiusa di default, con una riga per membro', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.queryByRole('group', { name: 'Scheda dei membri' })).toBeNull();
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const sheet = screen.getByRole('group', { name: 'Scheda dei membri' });
    expect(sheet).not.toHaveAttribute('open');
    const rows = within(sheet).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getAllByRole('cell')[0].textContent)).toEqual([expect.stringContaining('Great Tusk'), expect.stringContaining('Gholdengo')]);
    // Voto e ruolo nella seconda colonna
    expect(within(rows[0]).getAllByRole('cell')[1]).toHaveTextContent(/^\d+(Sweeper|Wallbreaker|Muro|Pivot|Supporto)$/);
    // I sotto-ruoli misurati (gli stessi del voto e delle carte), coi nomi brevi e quelli completi nel tooltip
    expect(within(sheet).getAllByRole('columnheader')[2]).toHaveTextContent('Ruoli');
    const tags = [...within(rows[0]).getAllByRole('cell')[2].querySelectorAll('.sheet-tag')];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag.getAttribute('title')).toBeTruthy();
  });

  it("sta in fondo alla colonna destra dell'Analisi", async () => {
    const user = userEvent.setup();
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(container.querySelector('.analysis-detail')).toContainElement(screen.getByRole('group', { name: 'Scheda dei membri' }));
  });
});
