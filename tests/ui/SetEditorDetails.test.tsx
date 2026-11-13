import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';
import { renderIt } from '../helpers/italian';

const set = { ...emptySet('Ninetales'), item: 'Heat Rock', ability: 'Drought', nature: 'Modest', moves: ['Flamethrower', 'Will-O-Wisp'] };

/** Editor con stato vero: scrivere nei campi aggiorna il set. */
function renderEditor(onChange = vi.fn()) {
  function Editor() {
    const [current, setCurrent] = useState<TeamSet>(set);
    return <SetEditor set={current} genLimit={9} onChange={next => { setCurrent(next); onChange(next); }} />;
  }
  renderIt(<Editor />);
  return onChange;
}

describe('editor del set', () => {
  it('le nature mostrano cosa alzano e abbassano', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(screen.getByLabelText('Natura')).toHaveValue('Modest');
    await user.click(screen.getByLabelText('Natura'));
    const list = screen.getByRole('listbox', { name: 'Natura: opzioni' });
    expect(within(list).getByRole('option', { name: 'Modest (+AttSp, −Att)' })).toHaveAttribute('aria-selected', 'true');
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

describe('preset Smogon nell\'editor', () => {
  it('scegliere un preset sostituisce il set, tenendo preferito e Custom Skillset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const presets = [
      { name: 'Sun Sweeper', format: 'gen9nationaldex', set: { ...emptySet('Ninetales'), item: 'Heat Rock', ability: 'Drought', moves: ['Solar Beam', 'Fire Blast'] } },
      { name: 'Nasty Plot', format: 'gen8ou', set: { ...emptySet('Ninetales'), item: 'Life Orb', ability: 'Drought', moves: ['Nasty Plot', 'Fire Blast'] } },
    ];
    renderIt(<SetEditor set={{ ...set, favorite: true }} presets={presets} genLimit={9} onChange={onChange} />);
    await user.click(screen.getByLabelText('Preset Smogon'));
    const list = screen.getByRole('listbox', { name: 'Preset Smogon: opzioni' });
    const option = within(list).getAllByRole('option')[1];
    expect(option).toHaveTextContent('Nasty Plot');
    expect(option).toHaveTextContent('Gen 8 OU');
    // Due formati: le voci stanno sotto l'intestazione del loro formato, nell'ordine in cui arrivano
    expect([...list.querySelectorAll('.format-head')].map(h => h.textContent)).toEqual(['NatDex OU', 'Gen 8 OU']);
    await user.click(option);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ item: 'Life Orb', moves: ['Nasty Plot', 'Fire Blast'], favorite: true, species: 'Ninetales' }));
  });

  it('senza preset la tendina è disattivata', () => {
    renderIt(<SetEditor set={set} genLimit={9} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Preset Smogon')).toBeDisabled();
  });

  it('senza voce Custom: il campo resta vuoto appena il set non coincide più con un preset', async () => {
    const user = userEvent.setup();
    const sun = { ...set, item: 'Heat Rock', ability: 'Drought', nature: 'Timid', moves: ['Solar Beam', 'Fire Blast'], evs: { spa: 252, spe: 252, hp: 4 } };
    const presets = [{ name: 'Sun Sweeper', format: 'gen9nationaldex', set: sun }];
    function Editor() {
      // Stesso set del preset, mosse in un altro ordine: risulta comunque il preset
      const [current, setCurrent] = useState<TeamSet>({ ...sun, moves: ['Fire Blast', 'Solar Beam'] });
      return <SetEditor set={current} presets={presets} genLimit={9} onChange={setCurrent} />;
    }
    renderIt(<Editor />);
    const field = () => screen.getByLabelText('Preset Smogon').closest('.combobox')!;
    expect(field()).toHaveTextContent('Sun Sweeper');

    await user.click(screen.getByLabelText('Preset Smogon'));
    const options = within(screen.getByRole('listbox', { name: 'Preset Smogon: opzioni' })).getAllByRole('option');
    // Solo i preset Smogon: niente voce Custom
    expect(options).toHaveLength(1);
    await user.keyboard('{Escape}');

    await user.clear(screen.getByLabelText('Mossa 2'));
    await user.type(screen.getByLabelText('Mossa 2'), 'Flamethrower');
    await user.tab();
    // Il set non è più un preset: il campo resta vuoto
    expect(field()).not.toHaveTextContent('Sun Sweeper');
    expect(field()).not.toHaveTextContent('Custom');

    await user.clear(screen.getByLabelText('Mossa 2'));
    await user.type(screen.getByLabelText('Mossa 2'), 'Solar Beam');
    await user.tab();
    expect(field()).toHaveTextContent('Sun Sweeper');
  });
});

describe('preset di più formati', () => {
  it('raggruppati per formato: il formato scelto in cima, le frecce saltano le intestazioni', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mk = (name: string, format: string, move: string) =>
      ({ name, format, set: { ...emptySet('Ninetales'), item: 'Life Orb', ability: 'Drought', moves: [move, 'Fire Blast'] } });
    // Un preset di Gen 9 OU arriva in mezzo: il menu lo porta sotto la sua intestazione, dopo quelli NatDex OU
    const presets = [mk('Offensive Utility', 'gen9nationaldex', 'Nasty Plot'), mk('Offensive Utility', 'gen9ou', 'Solar Beam'), mk('Sun Setter', 'gen9nationaldex', 'Will-O-Wisp')];
    renderIt(<SetEditor set={set} presets={presets} genLimit={9} onChange={onChange} />);
    await user.click(screen.getByLabelText('Preset Smogon'));
    const list = screen.getByRole('listbox', { name: 'Preset Smogon: opzioni' });
    const rows = [...list.children].map(li => (li.classList.contains('format-head') ? `# ${li.textContent}` : li.querySelector('strong')?.textContent));
    expect(rows).toEqual(['# NatDex OU', 'Offensive Utility', 'Sun Setter', '# Gen 9 OU', 'Offensive Utility']);
    // Le intestazioni non sono voci: tre scelte, e due frecce dalla prima portano dritte al preset di Gen 9 OU
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ moves: ['Solar Beam', 'Fire Blast'] }));
  });
});
