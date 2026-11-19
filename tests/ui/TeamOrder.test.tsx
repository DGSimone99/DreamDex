import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

async function importTeam(user: ReturnType<typeof userEvent.setup>, text: string) {
  render(<App data={fixtureData} initialLang="it" />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return screen.getByRole('region', { name: 'Team' });
}

const names = (team: HTMLElement) => [...team.querySelectorAll('.slot .name')].map(n => n.textContent);

describe('ordine del team e editor', () => {
  it('Alt + freccia sposta il membro; quello aperto resta aperto', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost\n\nGreninja\n- Surf');
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const card = within(team).getByText('Garchomp', { selector: '.name' }).closest('.slot')!.querySelector('.slot-toggle') as HTMLElement;
    fireEvent.keyDown(card, { key: 'ArrowRight', altKey: true });
    expect(names(team)).toEqual(['Corviknight', 'Garchomp', 'Greninja']);
    expect(team.querySelector('.slot.open .name')).toHaveTextContent('Garchomp');
    fireEvent.keyDown(team.querySelector('.slot.open input') as HTMLElement, { key: 'Escape' });
    expect(team.querySelector('.slot.open')).toBeNull();
  });

  it('Alt + freccia: la carta dice la posizione e lo spostamento si annuncia', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost\n\nGreninja\n- Surf');
    const card = within(team).getByText('Garchomp', { selector: '.name' }).closest('.slot')!.querySelector('.slot-toggle') as HTMLElement;
    expect(card.getAttribute('aria-label')).toMatch(/, posizione 1 di 3$/);
    expect(card).toHaveAttribute('aria-keyshortcuts', '1 Alt+ArrowLeft Alt+ArrowRight');
    fireEvent.keyDown(card, { key: 'ArrowRight', altKey: true });
    expect(team.querySelector('[aria-live="polite"]')).toHaveTextContent('Garchomp spostato in posizione 2 di 3');
    const moved = within(team).getByText('Garchomp', { selector: '.name' }).closest('.slot')!.querySelector('.slot-toggle') as HTMLElement;
    expect(moved.getAttribute('aria-label')).toMatch(/, posizione 2 di 3$/);
  });

  it('gli EV vanno di 2 in 2 e il totale lo dice (510 / 510)', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp @ Rocky Helmet\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const evs = within(team).getByRole('group', { name: 'Statistiche' });
    const hp = within(evs).getByLabelText('PS');
    expect(hp).toHaveAttribute('step', '2');
    await user.clear(hp);
    await user.type(hp, '6');
    expect(evs.querySelector('.ev-used')).toHaveTextContent('510/ 510');
  });

  it('Importa / Esporta set: incollare un set cambia il membro intero e si può annullare', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost');
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const open = () => team.querySelector('.slot.open') as HTMLElement;
    await user.click(within(open()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(open()).getByRole('button', { name: 'Incolla testo' }));
    // Il campo parte col set attuale (da copiare): si sostituisce con quello da incollare
    await user.clear(within(open()).getByLabelText('Set in testo Showdown'));
    await user.paste('Great Tusk @ Booster Energy\nJolly Nature\n- Rapid Spin');
    await user.click(within(open()).getByRole('button', { name: 'Applica' }));
    expect(names(team)).toEqual(['Great Tusk', 'Corviknight']);
    expect(team.querySelector('.slot.open .name')).toHaveTextContent('Great Tusk');
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(names(team)).toEqual(['Garchomp', 'Corviknight']);
  });

  it('Svuota team toglie tutti i membri e si può annullare', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost');
    await user.click(within(team).getByRole('button', { name: 'Svuota team' }));
    expect(names(team)).toEqual([]);
    expect(screen.getByText('Team svuotato')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(names(team)).toEqual(['Garchomp', 'Corviknight']);
  });

  it('lucchetto e × non aprono l’editor (togliendo un membro non si apre quello dopo)', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost\n\nGreninja\n- Surf');
    await user.click(within(team).getByRole('button', { name: /Corviknight/, pressed: false }));
    expect(team.querySelector('.slot.open')).toBeNull();
    await user.click(within(team).getByRole('button', { name: 'Rimuovi Corviknight' }));
    expect(names(team)).toEqual(['Garchomp', 'Greninja']);
    expect(team.querySelector('.slot.open')).toBeNull();
  });

  it('a team vuoto c’è Completa team; una proposta crea il team e si annulla', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByRole('button', { name: 'Completa team' }));
    await user.click((await screen.findAllByRole('button', { name: 'Usa la proposta 1' }, { timeout: 5000 }))[0]);
    expect(names(team)).toHaveLength(6);
    expect(screen.getByText(/^Team creato: \d+$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(names(team)).toEqual([]);
  });

  it('con Completa team aperto il magenta della pagina si spegne (resta solo nel pannello); chiuso torna', async () => {
    const user = userEvent.setup();
    const { container } = render(<App data={fixtureData} initialLang="it" />);
    const team = screen.getByRole('region', { name: 'Team' });
    const workspace = () => container.querySelector('.workspace')!;
    expect(workspace()).not.toHaveClass('fill-open');
    await user.click(within(team).getByRole('button', { name: 'Completa team' }));
    expect(workspace()).toHaveClass('fill-open');
    // Il pannello sta nella fascia del team, fuori dalla pagina spenta: la sua azione migliore resta magenta
    expect(document.querySelector('.fill-panel')!.closest('.workspace')).toBeNull();
    await user.keyboard('{Escape}');
    expect(workspace()).not.toHaveClass('fill-open');
  });

  it('un team da torneo caricato prende il posto del team e si annulla', async () => {
    const user = userEvent.setup();
    const tournamentTeams = [{ name: 'Rain Offense', author: 'Lameflame', team: ['Pelipper', 'Greninja'].map(species => ({ ...emptySet(species), moves: ['Protect'] })) }];
    render(<App data={{ ...fixtureData, tournamentTeams }} initialLang="it" />);
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByRole('button', { name: 'Completa team' }));
    await user.click(screen.getByRole('tab', { name: /Team da torneo/ }));
    await user.click(screen.getByRole('button', { name: 'Carica Rain Offense' }));
    expect(names(team)).toEqual(['Pelipper', 'Greninja']);
    expect(screen.getByText('Team da torneo caricato')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(names(team)).toEqual([]);
  });

  it('con un team incompleto la proposta aggiunge in fondo, i membri restano', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake');
    await user.click(within(team).getByRole('button', { name: 'Completa team' }));
    await user.click((await screen.findAllByRole('button', { name: 'Usa la proposta 1' }, { timeout: 5000 }))[0]);
    expect(names(team)[0]).toBe('Garchomp');
    expect(names(team)).toHaveLength(6);
  });

  it('svuotare un team pieno non rompe i suggerimenti', async () => {
    const user = userEvent.setup();
    const six = ['Garchomp', 'Corviknight', 'Greninja', 'Heatran', 'Clefable', 'Kingambit'].map(name => `${name}\n- Protect`).join('\n\n');
    const team = await importTeam(user, six);
    expect(names(team)).toHaveLength(6);
    await user.click(within(team).getByRole('button', { name: 'Svuota team' }));
    expect(names(team)).toEqual([]);
    expect(screen.getByRole('region', { name: 'Suggerimenti' })).toBeInTheDocument();
  });
});
