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

/** Apre il menu Set; con `save` anche il campo di Salva come… (nella scheda I miei set). */
async function openSetMenu(user: ReturnType<typeof userEvent.setup>, slot: HTMLElement, save = false) {
  if (!within(slot).queryByRole('dialog', { name: 'Set' })) await user.click(within(slot).getByRole('button', { name: /^Set:/ }));
  const menu = within(slot).getByRole('dialog', { name: 'Set' });
  if (save && !within(menu).queryByLabelText('Nome del set')) await user.click(within(menu).getByRole('button', { name: 'Salva come…' }));
  return menu;
}

describe('I miei set', () => {
  it('senza set salvati la scheda I miei set lo dice', async () => {
    const { user, slot } = await openEditor();
    const menu = await openSetMenu(user, slot);
    await user.click(within(menu).getByRole('tab', { name: /I miei set/ }));
    expect(menu).toHaveTextContent('Nessun set salvato');
  });

  it('il nome scritto nel campo diventa il nome del set salvato', async () => {
    const { user, slot } = await openEditor();
    const menu = await openSetMenu(user, slot, true);
    await user.type(within(menu).getByLabelText('Nome del set'), 'Spinner');
    await user.click(within(menu).getByRole('button', { name: 'Salva in I miei set' }));
    expect(loadMySets()['Great Tusk'].map(s => s.name)).toEqual(['Spinner']);
    // Il pulsante Set ora dice il nome del set salvato, segnato Mio
    expect(within(slot).getByRole('button', { name: /^Set:/ })).toHaveTextContent(/^Set:Spinner, Mio$/);
  });

  it('un nome già usato trasforma il salvataggio in sovrascrittura, annullabile', async () => {
    const { user, slot } = await openEditor();
    let menu = await openSetMenu(user, slot, true);
    await user.type(within(menu).getByLabelText('Nome del set'), 'Spinner');
    await user.click(within(menu).getByRole('button', { name: 'Salva in I miei set' }));
    await setMove(user, slot, 'Stone Edge');
    menu = await openSetMenu(user, slot, true);
    const field = within(menu).getByLabelText('Nome del set');
    await user.clear(field);
    await user.type(field, 'spinner');
    await user.click(within(menu).getByRole('button', { name: 'Sovrascrivi Spinner' }));
    expect(loadMySets()['Great Tusk'][0].set.moves[0]).toBe('Stone Edge');
    expect(screen.getByRole('status')).toHaveTextContent('Spinner sovrascritto');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Annulla' }));
    expect(loadMySets()['Great Tusk'][0].set.moves[0]).toBe(tusk.moves[0]);
  });

  it('dall\'elenco si rinomina e si elimina (annullabile)', async () => {
    const { user, slot } = await openEditor();
    const menu = await openSetMenu(user, slot, true);
    await user.click(within(menu).getByRole('button', { name: 'Salva in I miei set' }));
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

  it('scegliere un set dall\'elenco lo applica e chiude il menu', async () => {
    const { user, slot } = await openEditor();
    let menu = await openSetMenu(user, slot, true);
    await user.click(within(menu).getByRole('button', { name: 'Salva in I miei set' }));
    await setMove(user, slot, 'Stone Edge');
    menu = await openSetMenu(user, slot);
    await user.click(within(menu).getByRole('tab', { name: /I miei set/ }));
    await user.click(within(screen.getByRole('list', { name: 'I miei set: opzioni' })).getByRole('button', { name: /^Set 1/ }));
    expect(within(slot).getByLabelText('Mossa 1')).toHaveValue(tusk.moves[0]);
    expect(within(slot).queryByRole('dialog', { name: 'Set' })).toBeNull();
  });
});

describe('menu Set', () => {
  it('Esc chiude il menu e il fuoco torna al pulsante; le schede si cambiano con le frecce', async () => {
    const { user, slot } = await openEditor();
    const button = within(slot).getByRole('button', { name: /^Set:/ });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const smogon = within(slot).getByRole('tab', { name: 'Smogon' });
    expect(smogon).toHaveFocus();
    expect(smogon).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(within(slot).getByRole('tab', { name: /I miei set/ })).toHaveFocus();
    expect(within(slot).getByRole('tab', { name: /I miei set/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(within(slot).queryByRole('dialog', { name: 'Set' })).toBeNull();
    expect(button).toHaveFocus();
    // Esc chiude solo il menu, non l'editor
    expect(slot).toHaveClass('open');
  });
});

describe('azioni del membro', () => {
  it('Incolla testo (nel menu Set) apre il testo del set già pronto da copiare; Copia il set resta a un clic', async () => {
    const { user, slot } = await openEditor();
    const menu = await openSetMenu(user, slot);
    await user.click(within(menu).getByRole('button', { name: 'Incolla testo' }));
    const text = within(slot).getByLabelText('Set in testo Showdown');
    expect((text as HTMLTextAreaElement).value).toMatch(/^Great Tusk @ /);
    expect(within(slot).getByRole('button', { name: 'Copia il set' })).toBeInTheDocument();
    expect(within(slot).queryByRole('button', { name: 'Incolla set' })).toBeNull();
  });

  it('Apri su Smogon è un link in fondo al menu Set', async () => {
    const { user, slot } = await openEditor();
    const menu = await openSetMenu(user, slot);
    const link = within(menu).getByRole('link', { name: /Apri su Smogon/ });
    expect(link.closest('.set-menu-foot')).not.toBeNull();
  });
});
