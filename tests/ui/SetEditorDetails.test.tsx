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
    expect(within(list).getByRole('option', { name: 'Timid (+Vel, −Att)' })).toBeInTheDocument();
    expect(within(list).getByRole('option', { name: 'Hardy (neutra)' })).toBeInTheDocument();
    // La natura scelta è il campo stesso (la lista ne continua il rombo): non si ripete fra le voci
    expect(within(list).queryByRole('option', { name: 'Modest (+AttSp, −Att)' })).not.toBeInTheDocument();
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
    // Sopra: l'icona della categoria (la potenza solo per i lettori di schermo) e la precisione; tipo e potenza nella pillola
    expect(field('Mossa 1')!.querySelector('.move-meta')).toHaveTextContent('Speciale, potenza 90precisione 100%');
    expect(field('Mossa 1')!.querySelector('.combobox-leading .mvp-ic img')).not.toBeNull();
    expect(field('Mossa 1')!.querySelector('.combobox-trailing')).toHaveTextContent('90');
    expect(field('Mossa 1')!.querySelector('.combobox-trailing .mvp-cat.cat-special')).not.toBeNull();
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

describe('menu Set: preset Smogon', () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /^Set:/ }));
    return screen.getByRole('dialog', { name: 'Set' });
  };
  const rowNames = (menu: HTMLElement) => [...menu.querySelectorAll('.set-menu-list > li')]
    .map(li => (li.classList.contains('set-menu-group') ? `# ${li.textContent}` : li.querySelector('strong')?.textContent));

  it('scegliere un preset sostituisce il set, tenendo preferito e Custom Skillset; ogni riga dice strumento, natura ed EV', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const presets = [
      { name: 'Sun Sweeper', format: 'gen9nationaldex', set: { ...emptySet('Ninetales'), item: 'Heat Rock', ability: 'Drought', nature: 'Timid', evs: { spa: 252, spe: 252, hp: 4 }, moves: ['Solar Beam', 'Fire Blast'] } },
      { name: 'Nasty Plot', format: 'gen8ou', set: { ...emptySet('Ninetales'), item: 'Life Orb', ability: 'Drought', moves: ['Nasty Plot', 'Fire Blast'] } },
    ];
    renderIt(<SetEditor set={{ ...set, favorite: true }} presets={presets} genLimit={9} onChange={onChange} />);
    const menu = await openMenu(user);
    const sun = within(menu).getByRole('button', { name: /^Sun Sweeper/ });
    expect(sun).toHaveTextContent('Heat Rock · Timid · 252 AttSp / 252 Vel');
    const nasty = within(menu).getByRole('button', { name: /^Nasty Plot/ });
    expect(nasty).toHaveTextContent('Gen 8 OU');
    // Due formati: le voci stanno sotto l'intestazione del loro formato, nell'ordine in cui arrivano
    expect([...menu.querySelectorAll('.set-menu-group')].map(h => h.textContent)).toEqual(['NatDex OU', 'Gen 8 OU']);
    await user.click(nasty);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ item: 'Life Orb', moves: ['Nasty Plot', 'Fire Blast'], favorite: true, species: 'Ninetales' }));
    // Scegliere chiude il menu e il fuoco torna al pulsante
    expect(screen.queryByRole('dialog', { name: 'Set' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Set:/ })).toHaveFocus();
  });

  it('senza preset la scheda Smogon lo dice', async () => {
    const user = userEvent.setup();
    renderIt(<SetEditor set={set} genLimit={9} onChange={vi.fn()} />);
    const menu = await openMenu(user);
    expect(menu).toHaveTextContent('Nessun preset Smogon');
  });

  it('il preset uguale al set attuale è segnato, finché il set non cambia', async () => {
    const user = userEvent.setup();
    const sun = { ...set, item: 'Heat Rock', ability: 'Drought', nature: 'Timid', moves: ['Solar Beam', 'Fire Blast'], evs: { spa: 252, spe: 252, hp: 4 } };
    const presets = [{ name: 'Sun Sweeper', format: 'gen9nationaldex', set: sun }];
    function Editor() {
      // Stesso set del preset, mosse in un altro ordine: risulta comunque il preset
      const [current, setCurrent] = useState<TeamSet>({ ...sun, moves: ['Fire Blast', 'Solar Beam'] });
      return <SetEditor set={current} presets={presets} genLimit={9} onChange={setCurrent} />;
    }
    renderIt(<Editor />);
    // Il pulsante dice il nome del set in uso e da dove viene
    expect(screen.getByRole('button', { name: /^Set:/ })).toHaveTextContent(/^Set:Sun Sweeper, Smogon$/);
    let menu = await openMenu(user);
    expect(within(menu).getByRole('button', { name: /^Sun Sweeper/ })).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{Escape}');

    await user.clear(screen.getByLabelText('Mossa 2'));
    await user.type(screen.getByLabelText('Mossa 2'), 'Flamethrower');
    await user.tab();
    expect(screen.getByRole('button', { name: /^Set:/ })).toHaveTextContent(/^Set:Modificato$/);
    menu = await openMenu(user);
    expect(within(menu).getByRole('button', { name: /^Sun Sweeper/ })).not.toHaveAttribute('aria-current');
  });

  it('il preset migliore per il team va in cima, segnato; sceglierlo usa il preset migliore completo', async () => {
    const user = userEvent.setup();
    const onBest = vi.fn();
    const onChange = vi.fn();
    const mk = (name: string, move: string) => ({ name, format: 'gen9nationaldex', set: { ...emptySet('Ninetales'), item: 'Life Orb', ability: 'Drought', moves: [move, 'Fire Blast'] } });
    const presets = [mk('Offensive', 'Nasty Plot'), mk('Sun Setter', 'Will-O-Wisp'), mk('Utility', 'Solar Beam')];
    renderIt(<SetEditor set={set} presets={presets} genLimit={9} bestIndex={() => 1} onBest={onBest} onChange={onChange} />);
    const menu = await openMenu(user);
    expect(rowNames(menu)).toEqual(['Sun Setter', 'Offensive', 'Utility']);
    const best = within(menu).getByRole('button', { name: /^Sun Setter/ });
    expect(best).toHaveTextContent('Migliore per il team');
    await user.click(best);
    expect(onBest).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('preset di più formati', () => {
  it('raggruppati per formato: il formato scelto in cima', async () => {
    const user = userEvent.setup();
    const mk = (name: string, format: string, move: string) =>
      ({ name, format, set: { ...emptySet('Ninetales'), item: 'Life Orb', ability: 'Drought', moves: [move, 'Fire Blast'] } });
    // Un preset di Gen 9 OU arriva in mezzo: il menu lo porta sotto la sua intestazione, dopo quelli NatDex OU
    const presets = [mk('Offensive Utility', 'gen9nationaldex', 'Nasty Plot'), mk('Offensive Utility', 'gen9ou', 'Solar Beam'), mk('Sun Setter', 'gen9nationaldex', 'Will-O-Wisp')];
    renderIt(<SetEditor set={set} presets={presets} genLimit={9} onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Set:/ }));
    const menu = screen.getByRole('dialog', { name: 'Set' });
    const rows = [...menu.querySelectorAll('.set-menu-list > li')].map(li => (li.classList.contains('set-menu-group') ? `# ${li.textContent}` : li.querySelector('strong')?.textContent));
    expect(rows).toEqual(['# NatDex OU', 'Offensive Utility', 'Sun Setter', '# Gen 9 OU', 'Offensive Utility']);
  });
});
