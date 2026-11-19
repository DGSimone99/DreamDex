import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { loadMySets } from '../../src/storage';
import { resetMySetsCache } from '../../src/ui/mySets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

beforeEach(() => { window.localStorage.clear(); resetMySetsCache(); });
afterEach(() => window.history.replaceState(null, '', '/'));

function renderTeam() {
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  return render(<App initialLang="it" data={fixtureData} />);
}
const openFirst = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement) => {
  await user.click(container.querySelector<HTMLElement>('.slot-toggle')!);
  return container.querySelector<HTMLElement>('.slot.open')!;
};

describe('editor del set', () => {
  it("con l'editor aperto la sezione accesa nella barra laterale dice chi stai modificando; chiuso, torna il suo stato", async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const status = () => container.querySelector('#tab-pokemon-status')!;
    const before = status().textContent;
    await openFirst(user, container);
    expect(status()).toHaveTextContent(`Modifica: ${tusk.species}`);
    await user.click(container.querySelector<HTMLElement>('.slot.open .editor-close')!);
    expect(status().textContent).toBe(before);
  });

  it('col Tab i cursori degli EV si saltano, e anche gli IV a 31: dal numero degli EV si passa al numero della statistica dopo', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    const sliders = slot.querySelectorAll<HTMLInputElement>('.ev-slider');
    expect(sliders).toHaveLength(6);
    sliders.forEach(slider => expect(slider).toHaveAttribute('tabindex', '-1'));
    const evs = slot.querySelectorAll<HTMLInputElement>('.ev-input');
    evs[0].focus();
    await user.tab();
    expect(document.activeElement).toBe(evs[1]);
  });

  it('la X chiude l\'editor e il focus torna sulla carta', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    await user.click(within(slot).getByRole('button', { name: 'Chiudi editor' }));
    expect(container.querySelector('.slot.open')).toBeNull();
    expect(container.querySelector('.workspace')).not.toHaveClass('editing');
    expect(container.querySelector('.slot-toggle')).toHaveFocus();
  });

  it('il riquadro delle statistiche si chiama Statistiche', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    expect(within(slot).getByRole('group', { name: 'Statistiche' })).toBeInTheDocument();
  });

  it('in fondo un riquadro elenca tutti i ruoli del membro', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    const roles = within(slot).getByRole('group', { name: 'Ruoli' });
    const items = within(roles).getAllByRole('listitem').map(li => li.textContent);
    const all = container.querySelector('.slot .roles')!.getAttribute('title')!.split(' · ').map(part => part.split(': ')[0]);
    expect(items).toEqual(all);
    // Ogni ruolo spiegato nel tooltip
    expect(within(roles).getAllByRole('listitem')[0]).toHaveAttribute('title', expect.stringMatching(/\S/));
  });

  it('testata su una riga: nome, poi Set (preset Smogon e I miei set), Copia il set e Chiudi; Custom Skillset nella fascia delle Mosse', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    expect(within(slot).queryByRole('tab', { name: /Danni/ })).toBeNull();
    const head = slot.querySelector<HTMLElement>('.editor-head')!;
    // Fuori dalla testata i vecchi campi: preset, I miei set, Preset migliore, Testo del set
    expect(within(head).queryByLabelText('Preset Smogon')).toBeNull();
    expect(within(head).queryByRole('button', { name: 'Preset migliore' })).toBeNull();
    expect(within(head).queryByRole('button', { name: 'Testo del set' })).toBeNull();
    const actions = [...head.querySelectorAll<HTMLElement>('.editor-actions button')].map(b => b.getAttribute('aria-label') ?? b.textContent);
    expect(actions).toEqual(['Set', 'Copia il set', 'Chiudi editor']);
    const custom = within(slot).getByRole('checkbox', { name: /Custom Skillset/ });
    expect(head).not.toContainElement(custom);
    expect(within(slot).getByRole('group', { name: 'Mosse' })).toContainElement(custom);
  });

  it('I miei set: salva il set attuale, lo riapplica, al massimo 5 per specie', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    // Salva come… nel menu Set: il campo del nome e il salvataggio
    const saveNow = async () => {
      if (!within(slot).queryByRole('dialog', { name: 'Set' })) await user.click(within(slot).getByRole('button', { name: 'Set' }));
      const menu = within(slot).getByRole('dialog', { name: 'Set' });
      if (!within(menu).queryByLabelText('Nome del set')) await user.click(within(menu).getByRole('button', { name: 'Salva come…' }));
      return within(menu).getByRole('button', { name: /Salva in I miei set|Set salvato/ });
    };
    await user.click(await saveNow());
    expect(loadMySets()['Great Tusk']).toHaveLength(1);
    expect(loadMySets()['Great Tusk'][0].name).toBe('Set 1');
    // Cambio un campo: il preset non è più quello, poi riapplico il set salvato
    await user.clear(within(slot).getByLabelText('Mossa 1'));
    await user.type(within(slot).getByLabelText('Mossa 1'), 'Earthquake{Enter}');
    await user.click(within(slot).getByRole('button', { name: 'Set' }));
    await user.click(within(slot).getByRole('tab', { name: /I miei set/ }));
    await user.click(within(screen.getByRole('list', { name: 'I miei set: opzioni' })).getByRole('button', { name: /^Set 1/ }));
    expect(within(slot).getByLabelText('Mossa 1')).toHaveValue(tusk.moves[0]);
    // Mosse che il set non ha già negli altri slot (quelle sono bloccate nel menu)
    const fresh = ['Earthquake', 'Stone Edge', 'Close Combat', 'Knock Off', 'Ice Spinner', 'Stealth Rock', 'Bulk Up', 'Rock Slide', 'Taunt', 'Body Press'].filter(m => !tusk.moves.includes(m));
    for (let i = 0; i < 4; i++) {
      await user.clear(within(slot).getByLabelText('Mossa 1'));
      await user.type(within(slot).getByLabelText('Mossa 1'), `${fresh[i]}{Enter}`);
      await user.click(await saveNow());
    }
    expect(loadMySets()['Great Tusk']).toHaveLength(5);
    // Pieno: un set nuovo (senza nome già usato) non si può salvare, e il menu dice perché
    await user.clear(within(slot).getByLabelText('Mossa 1'));
    await user.type(within(slot).getByLabelText('Mossa 1'), `${fresh[4]}{Enter}`);
    const save = await saveNow();
    expect(save).toBeDisabled();
    expect(within(slot).getByRole('dialog', { name: 'Set' })).toHaveTextContent('Al massimo 5 set per Pokémon');
  }, 30000);

});
