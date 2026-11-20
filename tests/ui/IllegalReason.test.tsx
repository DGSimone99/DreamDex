import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('membro non legale', () => {
  it("il triangolo dice la regola (il tier); nell'editor niente avvisi a tutta larghezza", async () => {
    const user = userEvent.setup();
    const kyogre = { ...emptySet('Kyogre'), ability: 'Drizzle', moves: ['Surf'] };
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk, kyogre], DEFAULT_FORMAT)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    const card = container.querySelectorAll<HTMLElement>('.slot-card')[1];
    expect(card.querySelector('.alert-mark.danger')).toHaveTextContent('Tier troppo alto per National Dex OU');
    await user.click(card);
    expect(container.querySelector('.slot.open [role=note]')).toBeNull();
  });
});
