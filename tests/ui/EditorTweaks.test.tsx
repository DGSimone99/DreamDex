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
  await user.click(container.querySelector<HTMLElement>('.slot > summary')!);
  return container.querySelector<HTMLElement>('.slot[open]')!;
};

describe('editor del set', () => {
  it('la X chiude l\'editor e il focus torna sulla carta', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    await user.click(within(slot).getByRole('button', { name: 'Chiudi editor' }));
    expect(container.querySelector('.slot[open]')).toBeNull();
    expect(container.querySelector('.workspace')).not.toHaveClass('editing');
    expect(container.querySelector('.slot > summary')).toHaveFocus();
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
    const all = container.querySelector('.slot .roles')!.getAttribute('title')!.split(' · ');
    expect(items).toEqual(all);
  });

  it('niente linguetta Danni finché il calcolo non esiste; preset e I miei set in due gruppi; Custom Skillset fuori dai riquadri (cambia Set e Mosse)', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    expect(within(slot).queryByRole('tab', { name: /Danni/ })).toBeNull();
    expect(slot.querySelectorAll('.editor-head .head-group')).toHaveLength(2);
    const custom = within(slot).getByRole('checkbox', { name: /Custom Skillset/ });
    expect(slot.querySelector('.editor-head')).toContainElement(custom);
    expect(within(slot).getByRole('group', { name: 'Set' })).not.toContainElement(custom);
  });

  it('I miei set: salva il set attuale, lo riapplica, al massimo 5 per specie', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    const slot = await openFirst(user, container);
    const save = within(slot).getByRole('button', { name: 'Salva set' });
    await user.click(save);
    expect(loadMySets()['Great Tusk']).toHaveLength(1);
    expect(loadMySets()['Great Tusk'][0].name).toBe('Set 1');
    // Cambio un campo: il preset non è più quello, poi riapplico il set salvato
    await user.clear(within(slot).getByLabelText('Mossa 1'));
    await user.type(within(slot).getByLabelText('Mossa 1'), 'Earthquake{Enter}');
    await user.click(within(slot).getByRole('button', { name: 'Mostra i miei set' }));
    await user.click(within(screen.getByRole('list', { name: 'I miei set: opzioni' })).getByRole('button', { name: /^Set 1/ }));
    expect(within(slot).getByLabelText('Mossa 1')).toHaveValue(tusk.moves[0]);
    for (let i = 0; i < 4; i++) {
      await user.clear(within(slot).getByLabelText('Mossa 1'));
      await user.type(within(slot).getByLabelText('Mossa 1'), `${['Earthquake', 'Stone Edge', 'Close Combat', 'Knock Off'][i]}{Enter}`);
      await user.click(within(slot).getByRole('button', { name: 'Salva set' }));
    }
    expect(loadMySets()['Great Tusk']).toHaveLength(5);
    // Pieno: un set nuovo (senza nome già usato) non si può salvare
    await user.clear(within(slot).getByLabelText('Mossa 1'));
    await user.type(within(slot).getByLabelText('Mossa 1'), 'Rapid Spin{Enter}');
    expect(within(slot).getByRole('button', { name: 'Salva set' })).toBeDisabled();
  }, 30000);

});
