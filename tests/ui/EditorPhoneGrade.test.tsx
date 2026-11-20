import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('editor sul telefono: voto e Fatto', () => {
  it('il chip dice il voto del team, Fatto chiude come la ×', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk], DEFAULT_FORMAT)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    await user.click(container.querySelector<HTMLElement>('.slot-card')!);
    // Il voto arriva un attimo dopo (calcolo in sottofondo)
    await screen.findByText((_, el) => !!el?.matches('.slot.open .editor-grade') && /Voto del team [SABCD]\d+/.test(el.textContent ?? ''));
    await user.click(screen.getByRole('button', { name: 'Fatto' }));
    expect(container.querySelector('.slot.open')).toBeNull();
  });
});
