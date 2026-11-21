import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { resetMySetsCache } from '../../src/ui/mySets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const bulky = {
  ...emptySet('Great Tusk'), item: 'Leftovers', ability: 'Protosynthesis', nature: 'Impish',
  moves: ['Earthquake', 'Knock Off', 'Rapid Spin', 'Stealth Rock'], evs: { hp: 252, def: 252, spe: 4 },
};
const data: EngineData = { ...fixtureData, presets: { 'Great Tusk': [{ name: 'Bulky', format: 'gen9nationaldex', set: bulky }] } };

beforeEach(() => { window.localStorage.clear(); resetMySetsCache(); });
afterEach(() => window.history.replaceState(null, '', '/'));

async function openFirst(engine: EngineData = data) {
  const user = userEvent.setup();
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_CHOICE)}`);
  const { container } = render(<App initialLang="it" data={engine} />);
  await user.click(container.querySelector<HTMLElement>('.slot-toggle')!);
  const slot = () => container.querySelector<HTMLElement>('.slot.open')!;
  return { user, container, slot };
}

/** Quello che l'editor mostra del set: strumento, abilità, natura, mosse ed EV. */
function shown(slot: HTMLElement) {
  const s = within(slot);
  return [
    ...['Strumento', 'Abilità', 'Natura', 'Mossa 1', 'Mossa 2', 'Mossa 3', 'Mossa 4'].map(label => (s.getByLabelText(label) as HTMLInputElement).value),
    ...[...slot.querySelectorAll<HTMLInputElement>('.ev-input')].map(input => input.value),
  ];
}

const toast = () => screen.queryAllByRole('status').find(el => el.classList.contains('undo-toast') && /set (cambiato|incollato)/.test(el.textContent ?? ''));

describe('Annulla dopo aver cambiato il set intero', () => {
  it('preset Smogon applicato: l\'avviso dice "set cambiato" e Annulla riporta il set di prima', async () => {
    const { user, slot } = await openFirst();
    const before = shown(slot());
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: /^Bulky/ }));
    expect(shown(slot())).not.toEqual(before);
    const note = toast()!;
    expect(note).toHaveTextContent('Great Tusk set cambiato');
    await user.click(within(note).getByRole('button', { name: 'Annulla' }));
    expect(shown(slot())).toEqual(before);
    expect(toast()).toBeUndefined();
  });

  it('due cambi di fila (preset, poi spread): Annulla torna al set di prima dell\'ultimo', async () => {
    const { user, slot } = await openFirst();
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: /^Bulky/ }));
    const afterPreset = shown(slot());
    const spreads = slot().querySelector<HTMLElement>('.spread-panel summary');
    expect(spreads).not.toBeNull();
    await user.click(spreads!);
    const choice = [...slot().querySelectorAll<HTMLButtonElement>('.spread-presets button')].find(b => b.getAttribute('aria-pressed') !== 'true');
    expect(choice).toBeDefined();
    await user.click(choice!);
    expect(shown(slot())).not.toEqual(afterPreset);
    await user.click(within(toast()!).getByRole('button', { name: 'Annulla' }));
    expect(shown(slot())).toEqual(afterPreset);
  });

  it('set incollato come testo: Annulla riporta il set di prima', async () => {
    const { user, slot } = await openFirst();
    const before = shown(slot());
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: 'Incolla testo' }));
    const area = within(slot()).getByLabelText('Set in testo Showdown');
    await user.clear(area);
    await user.click(area);
    await user.paste('Great Tusk @ Leftovers\nAbility: Protosynthesis\nEVs: 252 HP / 252 Def / 4 Spe\nImpish Nature\n- Earthquake\n- Knock Off\n- Rapid Spin\n- Stealth Rock');
    await user.click(within(slot()).getByRole('button', { name: 'Applica' }));
    expect(shown(slot())).not.toEqual(before);
    await user.click(within(toast()!).getByRole('button', { name: 'Annulla' }));
    expect(shown(slot())).toEqual(before);
  });
});

describe('tasti 1-6 con l\'editor aperto', () => {
  it('il tasto 2 apre il secondo membro e porta il fuoco sulla sua carta', async () => {
    const { user, container, slot } = await openFirst();
    const toggles = () => container.querySelectorAll<HTMLElement>('.slot-toggle');
    expect(toggles()[0]).toHaveAttribute('aria-keyshortcuts', expect.stringMatching(/^1 /));
    expect(toggles()[1].getAttribute('data-hint')).toContain('Tasto 2');
    await user.keyboard('2');
    expect(slot()).toContainElement(toggles()[1]);
    expect(toggles()[1]).toHaveFocus();
    // Uno slot vuoto non fa niente
    await user.keyboard('5');
    expect(slot()).toContainElement(toggles()[1]);
    await user.keyboard('1');
    expect(slot()).toContainElement(toggles()[0]);
  });

  it('scrivere numeri negli EV non cambia membro', async () => {
    const { user, container, slot } = await openFirst();
    const ev = slot().querySelector<HTMLInputElement>('.ev-input')!;
    await user.click(ev);
    await user.keyboard('{Control>}a{/Control}24');
    expect(slot()).toContainElement(container.querySelectorAll<HTMLElement>('.slot-toggle')[0]);
    expect(ev).toHaveFocus();
  });

  it('con il menu Set aperto i numeri non cambiano membro', async () => {
    const { user, container, slot } = await openFirst();
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.keyboard('2');
    expect(slot()).toContainElement(container.querySelectorAll<HTMLElement>('.slot-toggle')[0]);
  });
});
