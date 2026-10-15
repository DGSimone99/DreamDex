import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboOption } from '../../src/ui/Combobox';
import { renderIt } from '../helpers/italian';

/** Campo con stato vero: ogni modifica aggiorna il valore, come nell'editor. */
function Field({ options, onChange }: { options: ComboOption[]; onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <Combobox label="Mossa 1" value={value} options={options} onChange={next => { setValue(next); onChange(next); }} />;
}

const moves: ComboOption[] = [
  { value: 'Psychic', label: 'Psychic' },
  { value: 'Psychic Fangs', label: 'Psychic Fangs' },
  { value: 'Thunder', label: 'Tuono' },
];

describe('scrivere nei menu a testo libero', () => {
  it('gli spazi dopo un nome esatto restano: "Psychic Fangs" si scrive per intero', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Psychic Fangs');
    expect(screen.getByLabelText('Mossa 1')).toHaveValue('Psychic Fangs');
    expect(onChange).toHaveBeenLastCalledWith('Psychic Fangs');
  });

  it('un nome libero da hackrom con uno spazio si salva com\'è', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Psychic Blast');
    expect(onChange).toHaveBeenLastCalledWith('Psychic Blast');
  });

  it('scrivere il nome inglese in italiano non fa saltare il testo all\'etichetta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Thunderbolt');
    expect(screen.getByLabelText('Mossa 1')).toHaveValue('Thunderbolt');
    expect(onChange).toHaveBeenLastCalledWith('Thunderbolt');
  });

  it('l\'etichetta scritta per intero salva il valore inglese', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Tuono');
    expect(onChange).toHaveBeenLastCalledWith('Thunder');
  });
});
