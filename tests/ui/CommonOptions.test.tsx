import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Combobox } from '../../src/ui/Combobox';
import { renderIt } from '../helpers/italian';

const options = [
  { value: 'Choice Band', label: 'Choice Band' },
  { value: 'Leftovers', label: 'Leftovers', common: '30%' },
  { value: 'Life Orb', label: 'Life Orb' },
  { value: 'Rocky Helmet', label: 'Rocky Helmet', common: '40%' },
];

describe('voci più usate in cima alla tendina', () => {
  it('prima le più usate, con la percentuale, sotto l\'intestazione "Più usati"; poi tutte le altre', async () => {
    const user = userEvent.setup();
    renderIt(<Combobox label="Strumento" value="" options={options} onChange={() => undefined} />);
    await user.click(screen.getByLabelText('Strumento'));
    const list = screen.getByRole('listbox');
    const names = within(list).getAllByRole('option').map(o => o.querySelector('strong')!.textContent);
    expect(names).toEqual(['Leftovers', 'Rocky Helmet', 'Choice Band', 'Life Orb']);
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('30%');
    expect(list).toHaveTextContent('Più usati');
    expect(list).toHaveTextContent('Tutti');
  });

  it('cercando, le più usate che corrispondono restano in cima', async () => {
    const user = userEvent.setup();
    renderIt(<Combobox label="Strumento" value="" options={options} onChange={() => undefined} />);
    await user.type(screen.getByLabelText('Strumento'), 'l');
    const names = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.querySelector('strong')!.textContent);
    // 'l': Leftovers e Life Orb iniziano così, Rocky Helmet la contiene; Choice Band no
    expect(names).toEqual(['Leftovers', 'Rocky Helmet', 'Life Orb']);
  });

  it('frecce e Invio scelgono nell\'ordine mostrato', async () => {
    const user = userEvent.setup();
    let picked = '';
    renderIt(<Combobox label="Strumento" value="" options={options} restricted onChange={v => { picked = v; }} />);
    await user.click(screen.getByLabelText('Strumento'));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(picked).toBe('Rocky Helmet');
  });
});

describe('editor del team: più usati dalle statistiche del formato', () => {
  it('mosse, strumento, abilità e natura mostrano in cima le scelte più usate con la quota', async () => {
    const { render } = await import('@testing-library/react');
    const { App } = await import('../../src/App');
    const { fixtureData, fixtureStats } = await import('../fixtures/data');
    const { commonChoices } = await import('../../src/engine/common');
    const { emptySet } = await import('../../src/engine/sets');
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Great Tusk', { selector: '.name' }));
    const common = commonChoices({ stats: fixtureStats, sets: null }, emptySet('Great Tusk'));
    for (const [field, top] of [['Mossa 1', common.moves[0]], ['Strumento', common.items[0]], ['Abilità', common.abilities[0]], ['Natura', common.natures[0]]] as const) {
      await user.click(within(team).getByLabelText(field));
      const first = within(screen.getByRole('listbox')).getAllByRole('option')[0];
      expect(first, field).toHaveTextContent(top.name);
      expect(first, field).toHaveTextContent(`${Math.round(top.share! * 100)}%`);
      await user.keyboard('{Escape}');
    }
  });
});
