import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const team = () => screen.getByRole('region', { name: 'Team' });

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return user;
}

const optionsOf = (listId: string | null) =>
  [...(document.getElementById(listId ?? '')?.querySelectorAll('option') ?? [])].map(o => o.getAttribute('value'));

describe('mosse e abilità legali nel team', () => {
  beforeEach(() => window.localStorage.clear());

  it('mosse non legali: avviso giallo, non cancellate', async () => {
    await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n- U-turn');
    expect(within(team()).getByText('Mosse non legali: Dragon Darts')).toBeInTheDocument();
    expect(within(team()).getByText('Drakloak').closest('details')).toHaveClass('warn');
    expect(within(team()).getByLabelText('Mossa 1')).toHaveValue('Dragon Darts');
  });

  it('Custom Skillset: sblocca solo quel Pokémon, con tooltip e badge', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n\nDreepy\nAbility: Infiltrator\n- Dragon Darts');
    const toggle = screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' });
    expect(toggle.closest('label')).toHaveAttribute('title', expect.stringContaining('hackrom'));
    await user.click(toggle);
    expect(within(team()).queryByText('Mosse non legali: Dragon Darts', { selector: '.slot:first-child *' })).toBeNull();
    expect(within(team()).getAllByText('Mosse non legali: Dragon Darts')).toHaveLength(1);
    expect(within(team()).getByText('Custom')).toBeInTheDocument();
  });

  it('il menu delle mosse propone solo mosse imparabili, tranne con Custom Skillset', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- U-turn');
    const move = within(team()).getByLabelText('Mossa 1');
    expect(optionsOf(move.getAttribute('list'))).toContain('U-turn');
    expect(optionsOf(move.getAttribute('list'))).not.toContain('Dragon Darts');
    await user.click(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' }));
    expect(optionsOf(within(team()).getByLabelText('Mossa 1').getAttribute('list'))).toContain('Dragon Darts');
  });

  it('abilità: solo quelle legali fino alla gen scelta, libere con Custom Skillset', async () => {
    const user = await importTeam('Ninetales\nAbility: Drought\n- Flamethrower');
    await user.selectOptions(screen.getByLabelText('Generazione massima'), '4');
    expect(within(team()).getByText('Abilità non legale: Drought')).toBeInTheDocument();
    const ability = within(team()).getByLabelText('Abilità') as HTMLSelectElement;
    expect([...ability.options].map(o => o.value)).toEqual(['Drought', 'Flash Fire']);
    await user.click(screen.getByRole('checkbox', { name: 'Custom Skillset Ninetales' }));
    expect(within(team()).getByLabelText('Abilità').tagName).toBe('INPUT');
    expect(within(team()).queryByText('Abilità non legale: Drought')).toBeNull();
  });

  it('Custom Skillset resta nei team salvati', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts');
    await user.click(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' }));
    await user.type(screen.getByLabelText('Nome team'), 'Hack');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Drakloak' }));
    await user.click(screen.getByRole('button', { name: 'Hack' }));
    expect(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' })).toBeChecked();
  });
});
