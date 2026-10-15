import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';

const set = { ...emptySet('Ninetales'), item: 'Heat Rock', ability: 'Drought', nature: 'Modest', moves: ['Flamethrower', 'Will-O-Wisp'] };

/** Editor con stato vero: scrivere nei campi aggiorna il set. */
function renderEditor(onChange = vi.fn()) {
  function Editor() {
    const [current, setCurrent] = useState<TeamSet>(set);
    return <SetEditor set={current} genLimit={9} onChange={next => { setCurrent(next); onChange(next); }} />;
  }
  render(<Editor />);
  return onChange;
}

describe('editor del set', () => {
  it('le nature mostrano cosa alzano e abbassano', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(screen.getByLabelText('Natura')).toHaveValue('Modest');
    await user.click(screen.getByLabelText('Natura'));
    const list = screen.getByRole('listbox', { name: 'Natura: opzioni' });
    expect(within(list).getByRole('option', { name: 'Modest (+SpA, −Atk)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByRole('option', { name: 'Hardy (neutra)' })).toBeInTheDocument();
  });

  it('Tera: menu con i chip dei tipi', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();
    await user.click(screen.getByLabelText('Tera'));
    const fairy = within(screen.getByRole('listbox', { name: 'Tera: opzioni' })).getByRole('option', { name: 'Fairy' });
    expect(fairy.querySelector('.type-chip')).toHaveTextContent('Fairy');
    await user.click(fairy);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ teraType: 'Fairy' }));
  });

  it('mosse e set sono gruppi distinti', () => {
    renderEditor();
    expect(screen.getByRole('group', { name: 'Set' })).toContainElement(screen.getByLabelText('Strumento'));
    expect(screen.getByRole('group', { name: 'Mosse' })).toContainElement(screen.getByLabelText('Mossa 1'));
  });

  it('il tooltip spiega solo l\'effetto; potenza e precisione stanno accanto alla mossa', () => {
    renderEditor();
    const field = (label: string) => screen.getByLabelText(label).closest('.field');
    expect(field('Strumento')).toHaveAttribute('data-tip', expect.stringMatching(/Sunny Day/));
    expect(field('Abilità')).toHaveAttribute('data-tip', expect.stringMatching(/Sunny Day/));
    expect(field('Mossa 1')).toHaveAttribute('data-tip', '10% chance to burn the target.');
    expect(field('Mossa 1')!.querySelector('.move-meta')).toHaveTextContent('Speciale, potenza 90precisione 100%Fire');
    expect(field('Mossa 3')).not.toHaveAttribute('data-tip');
  });

  it('il menu delle mosse: categoria, potenza, precisione, tipo e descrizione; Invio sceglie', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();
    await user.click(screen.getByLabelText('Mossa 3'));
    await user.keyboard('fire bla');
    const list = screen.getByRole('listbox', { name: 'Mossa 3: opzioni' });
    const fireBlast = within(list).getAllByRole('option').find(o => o.querySelector('strong')?.textContent === 'Fire Blast')!;
    expect(fireBlast.querySelector('.move-meta')).toHaveTextContent('Speciale, potenza 110precisione 85%Fire');
    expect(fireBlast).toHaveAttribute('title', expect.stringMatching(/burn/));
    expect(fireBlast.getAttribute('title')).not.toMatch(/Potenza|precisione/);
    expect(fireBlast.querySelector('strong')!.getAttribute('style')).toMatch(/color: rgb/);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ moves: ['Flamethrower', 'Will-O-Wisp', 'Fire Blast', ''] }));
  });
});
