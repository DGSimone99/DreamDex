import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('editor sul telefono: voto', () => {
  it('il chip dice il voto del team', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk], DEFAULT_CHOICE)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    await user.click(container.querySelector<HTMLElement>('.slot-card')!);
    // Il voto arriva un attimo dopo (calcolo in sottofondo)
    await screen.findByText((_, el) => !!el?.matches('.slot.open .editor-grade') && /Voto del team [SABCD]\d+/.test(el.textContent ?? ''));
  });
});
