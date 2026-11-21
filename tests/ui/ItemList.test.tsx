import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('menu degli strumenti', () => {
  it('in ordine alfabetico italiano, senza Megapietre di altri Pokémon', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk], DEFAULT_CHOICE)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    await user.click(container.querySelector<HTMLElement>('.slot-card')!);
    await user.click(screen.getByLabelText('Strumento'));
    const options = within(screen.getByRole('listbox', { name: 'Strumento: opzioni' })).getAllByRole('option');
    const names = options.filter(o => !o.querySelector('.common-share, [class*=common]')).map(o => o.querySelector('strong')?.textContent ?? o.textContent ?? '');
    expect(names.some(n => /Charizardite/.test(n))).toBe(false);
    const plain = names.filter(n => n && !/Vietato/.test(n));
    const tail = plain.slice(-20);
    expect([...tail].sort((a, b) => a.localeCompare(b, 'it'))).toEqual(tail);
  });
});
