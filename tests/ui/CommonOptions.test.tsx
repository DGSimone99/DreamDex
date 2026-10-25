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

describe('spread pronti sopra gli EV', () => {
  it('un clic imposta natura ed EV; lo spread attuale risulta premuto', async () => {
    const { useState } = await import('react');
    const { SetEditor } = await import('../../src/ui/SetEditor');
    const { emptySet } = await import('../../src/engine/sets');
    type TeamSet = import('../../src/engine/sets').TeamSet;
    const common = { source: null, items: [], abilities: [], natures: [], moves: [], teraTypes: [], spreads: [
      { nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 }, share: 0.32 },
      { nature: 'Impish', evs: { hp: 252, def: 164, spe: 92 }, share: null },
    ] };
    function Editor() {
      const [set, setSet] = useState<TeamSet>({ ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } });
      return <SetEditor set={set} common={common} genLimit={9} onChange={setSet} />;
    }
    const user = userEvent.setup();
    renderIt(<Editor />);
    // Chiuso di norma; il titolo dice quale spread noto stai usando
    const panel = screen.getByText('Spread più usati').closest('details')!;
    expect(panel).not.toHaveAttribute('open');
    // Da chiuso solo il titolo, senza lo spread scelto
    expect(panel.querySelector('summary')).toHaveTextContent(/^Spread più usati$/);
    await user.click(panel.querySelector('summary')!);
    expect(panel).toHaveAttribute('open');
    const group = screen.getByRole('group', { name: 'Spread più usati' });
    const [jolly, impish] = within(group).getAllByRole('button');
    expect(jolly).toHaveTextContent('Jolly');
    expect(jolly).toHaveTextContent('252 Att / 252 Vel / 4 PS');
    expect(jolly).toHaveTextContent('32%');
    expect(jolly).toHaveAttribute('aria-pressed', 'true');
    expect(impish).toHaveTextContent('Alt');
    await user.click(impish);
    expect(screen.getByLabelText('Natura')).toHaveValue('Impish');
    const evs = screen.getByRole('group', { name: 'Statistiche' });
    expect(within(evs).getByLabelText('PS')).toHaveValue(252);
    expect(within(evs).getByLabelText('DIF')).toHaveValue(164);
    expect(within(evs).getByLabelText('ATT')).toHaveValue(0);
    expect(impish).toHaveAttribute('aria-pressed', 'true');
    expect(jolly).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tera più usati in cima alla tendina', async () => {
    const { SetEditor } = await import('../../src/ui/SetEditor');
    const { emptySet } = await import('../../src/engine/sets');
    const common = { source: null, items: [], abilities: [], natures: [], moves: [], spreads: [], teraTypes: [{ name: 'Ground', share: 0.45 }] };
    const user = userEvent.setup();
    renderIt(<SetEditor set={emptySet('Garchomp')} common={common} genLimit={9} onChange={() => undefined} />);
    await user.click(screen.getByLabelText('Tera'));
    const first = within(screen.getByRole('listbox')).getAllByRole('option')[0];
    expect(first).toHaveAccessibleName('Ground');
    expect(first).toHaveTextContent('45%');
  });
});

describe('più usati da un altro formato', () => {
  it('l\u2019intestazione dice da dove vengono le quote', async () => {
    const { SetEditor } = await import('../../src/ui/SetEditor');
    const { emptySet } = await import('../../src/engine/sets');
    const common = { source: 'gen9nationaldexubers', items: [{ name: 'Life Orb', share: 0.6 }], abilities: [], natures: [], moves: [], spreads: [], teraTypes: [] };
    const user = userEvent.setup();
    renderIt(<SetEditor set={emptySet('Mewtwo')} common={common} genLimit={9} onChange={() => undefined} />);
    await user.click(screen.getByLabelText('Strumento'));
    expect(screen.getByRole('listbox')).toHaveTextContent('Più usati · NatDex Ubers');
  });
});
