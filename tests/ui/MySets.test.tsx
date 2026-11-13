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

async function openEditor() {
  const user = userEvent.setup();
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  const { container } = render(<App initialLang="it" data={fixtureData} />);
  await user.click(container.querySelector<HTMLElement>('.slot-toggle')!);
  return { user, slot: container.querySelector<HTMLElement>('.slot.open')! };
}
const setMove = async (user: ReturnType<typeof userEvent.setup>, slot: HTMLElement, move: string) => {
  await user.clear(within(slot).getByLabelText('Mossa 1'));
  await user.type(within(slot).getByLabelText('Mossa 1'), `${move}{Enter}`);
};

describe('I miei set', () => {
  it('senza set salvati il pulsante dell’elenco è spento e dice perché', async () => {
    const { slot } = await openEditor();
    const toggle = within(slot).getByRole('button', { name: 'Mostra i miei set' });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('title', 'Nessun set salvato');
  });

  it('il nome scritto nel campo diventa il nome del set salvato', async () => {
    const { user, slot } = await openEditor();
    await user.type(within(slot).getByLabelText('I miei set'), 'Spinner');
    await user.click(within(slot).getByRole('button', { name: 'Salva in I miei set' }));
    expect(loadMySets()['Great Tusk'].map(s => s.name)).toEqual(['Spinner']);
  });

  it('un nome già usato trasforma il salvataggio in sovrascrittura, annullabile', async () => {
    const { user, slot } = await openEditor();
    await user.type(within(slot).getByLabelText('I miei set'), 'Spinner');
    await user.click(within(slot).getByRole('button', { name: 'Salva in I miei set' }));
    await setMove(user, slot, 'Stone Edge');
    const field = within(slot).getByLabelText('I miei set');
    await user.clear(field);
    await user.type(field, 'spinner');
    await user.click(within(slot).getByRole('button', { name: 'Sovrascrivi Spinner' }));
    expect(loadMySets()['Great Tusk'][0].set.moves[0]).toBe('Stone Edge');
    expect(screen.getByRole('status')).toHaveTextContent('Spinner sovrascritto');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Annulla' }));
    expect(loadMySets()['Great Tusk'][0].set.moves[0]).toBe(tusk.moves[0]);
  });

  it('dall\'elenco si rinomina e si elimina (annullabile)', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot).getByRole('button', { name: 'Salva in I miei set' }));
    await user.click(within(slot).getByRole('button', { name: 'Mostra i miei set' }));
    const list = () => screen.getByRole('list', { name: 'I miei set: opzioni' });
    await user.click(within(list()).getByRole('button', { name: 'Rinomina Set 1' }));
    const rename = within(list()).getByLabelText('Nuovo nome per Set 1');
    await user.clear(rename);
    await user.type(rename, 'Bulky{Enter}');
    expect(loadMySets()['Great Tusk'].map(s => s.name)).toEqual(['Bulky']);
    await user.click(within(list()).getByRole('button', { name: 'Elimina Bulky' }));
    expect(loadMySets()['Great Tusk']).toBeUndefined();
    expect(screen.getByRole('status')).toHaveTextContent('Bulky eliminato');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Annulla' }));
    expect(loadMySets()['Great Tusk'].map(s => s.name)).toEqual(['Bulky']);
  });

  it('scegliere un set dall\'elenco lo applica', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot).getByRole('button', { name: 'Salva in I miei set' }));
    await setMove(user, slot, 'Stone Edge');
    await user.click(within(slot).getByRole('button', { name: 'Mostra i miei set' }));
    await user.click(within(screen.getByRole('list', { name: 'I miei set: opzioni' })).getByRole('button', { name: /^Set 1/ }));
    expect(within(slot).getByLabelText('Mossa 1')).toHaveValue(tusk.moves[0]);
  });
});

describe('azioni del membro', () => {
  it('un solo pulsante Importa / Esporta set: il testo del set è già pronto da copiare, Applica importa', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot).getByRole('button', { name: 'Testo del set' }));
    const text = within(slot).getByLabelText('Set in testo Showdown');
    expect((text as HTMLTextAreaElement).value).toMatch(/^Great Tusk @ /);
    expect(within(slot).getByRole('button', { name: 'Copia il set' })).toBeInTheDocument();
    expect(within(slot).queryByRole('button', { name: 'Incolla set' })).toBeNull();
  });

  it('Apri su Smogon è un\'icona accanto ai preset, con il nome nel tooltip', async () => {
    const { slot } = await openEditor();
    const link = within(slot).getByRole('link', { name: 'Apri su Smogon' });
    expect(link.closest('.preset-group')).not.toBeNull();
  });

});
