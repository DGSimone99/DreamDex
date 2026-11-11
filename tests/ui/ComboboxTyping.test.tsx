import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboOption } from '../../src/ui/Combobox';
import { renderIt } from '../helpers/italian';

/** Campo con stato vero: ogni modifica aggiorna il valore, come nell'editor. */
function Field({ options, onChange, start = '' }: { options: ComboOption[]; onChange: (value: string) => void; start?: string }) {
  const [value, setValue] = useState(start);
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
    await user.tab();
    expect(screen.getByLabelText('Mossa 1')).toHaveValue('Psychic Fangs');
    expect(onChange).toHaveBeenLastCalledWith('Psychic Fangs');
  });

  it('un nome libero da hackrom con uno spazio si salva com\'è', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Psychic Blast');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('Psychic Blast');
  });

  it('scrivere il nome inglese in italiano non fa saltare il testo all\'etichetta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Thunderbolt');
    await user.tab();
    expect(screen.getByLabelText('Mossa 1')).toHaveValue('Thunderbolt');
    expect(onChange).toHaveBeenLastCalledWith('Thunderbolt');
  });

  it('l\'etichetta scritta per intero salva il valore inglese', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Tuono');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('Thunder');
  });

  it('mentre scrivi il set non cambia: si salva uscendo dal campo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} />);
    await user.type(screen.getByLabelText('Mossa 1'), 'Psy');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('Psy');
  });

  it('cliccando su una mossa già scelta il testo si seleziona: scrivere la sostituisce, non si aggiunge in coda', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} start="Psychic" />);
    await user.click(screen.getByLabelText('Mossa 1'));
    await user.keyboard('Tuono');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('Thunder');
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('PsychicT'));
  });

  it('Esc butta quello che hai scritto e torna la mossa di prima', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<Field options={moves} onChange={onChange} start="Psychic" />);
    await user.click(screen.getByLabelText('Mossa 1'));
    await user.keyboard('ea{Escape}');
    expect(screen.getByLabelText('Mossa 1')).toHaveValue('Psychic');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });
});
