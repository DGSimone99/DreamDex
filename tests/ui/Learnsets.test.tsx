import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { chooseGen } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

const team = () => screen.getByRole('region', { name: 'Team' });

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  // Mosse non imparabili: l'import chiede il Custom Skillset; qui si risponde No (si prova la levetta a mano)
  const ask = screen.queryByRole('alertdialog', { name: 'Mosse non imparabili' });
  if (ask) await user.click(within(ask).getByRole('button', { name: 'No' }));
  return user;
}

/** Apre il menu del campo e ne legge le voci (si filtra scrivendo). */
async function optionsOf(user: ReturnType<typeof userEvent.setup>, label: string, query = '') {
  const field = within(team()).getByLabelText(label);
  await user.click(field);
  if (query) {
    await user.clear(field);
    await user.type(field, query);
  }
  const names = within(screen.getByRole('listbox', { name: `${label}: opzioni` })).queryAllByRole('option')
    .map(o => o.querySelector('strong')?.textContent);
  await user.keyboard('{Escape}');
  return names;
}

describe('mosse e abilità legali nel team', () => {
  beforeEach(() => window.localStorage.clear());

  it('mosse non legali: avviso giallo, non cancellate', async () => {
    await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n- U-turn');
    expect(within(team()).getByText('Mosse non legali in questo formato: Dragon Darts')).toBeInTheDocument();
    expect(within(team()).getByText('Drakloak').closest('.slot')).toHaveClass('warn');
    expect(within(team()).getByLabelText('Mossa 1')).toHaveValue('Dragon Darts');
  });

  it('editor aperto: la mossa non legale è segnata sul suo campo e detta ai lettori di schermo', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n- U-turn');
    await user.click(team().querySelector<HTMLElement>('.slot-card .name')!);
    const bad = within(team()).getByLabelText('Mossa 1');
    expect(bad).toHaveAttribute('aria-invalid', 'true');
    expect(bad).toHaveAccessibleDescription(expect.stringContaining('Mosse non legali in questo formato: Dragon Darts'));
    expect(bad.closest('.field')).toHaveClass('flag-warn');
    expect(within(team()).getByLabelText('Mossa 2')).not.toHaveAttribute('aria-invalid');
    // L'avviso giallo sotto la testata, con la via d'uscita
    expect(team().querySelector('.member-problems.warn')).toHaveTextContent('Cambiale o attiva Custom Skillset');
  });

  it('Custom Skillset: sblocca solo quel Pokémon, con tooltip e badge', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n\nDreepy\nAbility: Infiltrator\n- Dragon Darts');
    const toggle = screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' });
    // Cosa fa: solo nel fumetto e come descrizione della levetta
    expect(toggle).toHaveAccessibleDescription(expect.stringContaining('anche non imparabili'));
    await user.click(toggle);
    expect(within(team()).queryByText('Mosse non legali in questo formato: Dragon Darts', { selector: '.slot:first-child *' })).toBeNull();
    expect(within(team()).getAllByText('Mosse non legali in questo formato: Dragon Darts')).toHaveLength(1);
    // Lucchetto blu in basso a sinistra dello sprite, solo sul membro sbloccato
    const marks = team().querySelectorAll('.slot .alert-mark.info');
    expect(marks).toHaveLength(1);
    expect(within(marks[0] as HTMLElement).getByRole('tooltip')).toHaveTextContent('Custom Skillset');
  });

  it('il menu delle mosse propone solo mosse imparabili, tranne con Custom Skillset', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- U-turn');
    expect(await optionsOf(user, 'Mossa 1', 'U-turn')).toContain('U-turn');
    expect(await optionsOf(user, 'Mossa 1', 'Dragon Darts')).not.toContain('Dragon Darts');
    await user.click(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' }));
    expect(await optionsOf(user, 'Mossa 1', 'Dragon Darts')).toContain('Dragon Darts');
  });

  it('abilità: solo quelle legali fino alla gen scelta, libere con Custom Skillset', async () => {
    const user = await importTeam('Ninetales\nAbility: Drought\n- Flamethrower');
    await chooseGen(user, '4');
    expect(within(team()).getByText('Abilità non legale in questo formato: Drought')).toBeInTheDocument();
    expect(within(team()).getByLabelText('Abilità')).toHaveAttribute('readonly');
    expect(await optionsOf(user, 'Abilità')).toEqual(['Drought', 'Flash Fire']);
    await user.click(screen.getByRole('checkbox', { name: 'Custom Skillset Ninetales' }));
    expect(within(team()).getByLabelText('Abilità')).not.toHaveAttribute('readonly');
    expect(await optionsOf(user, 'Abilità', 'Levitate')).toContain('Levitate');
    expect(within(team()).queryByText('Abilità non legale in questo formato: Drought')).toBeNull();
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
