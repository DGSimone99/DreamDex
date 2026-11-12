import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('membro non legale', () => {
  it('il triangolo dice la regola (il tier) e l\'editor offre di cercare un sostituto', async () => {
    const user = userEvent.setup();
    const kyogre = { ...emptySet('Kyogre'), ability: 'Drizzle', moves: ['Surf'] };
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk, kyogre], DEFAULT_FORMAT)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    const card = container.querySelectorAll<HTMLElement>('.slot-card')[1];
    expect(card.querySelector('.alert-mark.danger')).toHaveTextContent('Tier troppo alto per National Dex OU');
    await user.click(card);
    const slot = container.querySelector<HTMLElement>('.slot.open')!;
    const note = slot.querySelector('.member-problems')!;
    expect(note).toHaveTextContent('Tier troppo alto per National Dex OU');
    await user.click(within(note as HTMLElement).getByRole('button', { name: 'Cerca un sostituto' }));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Chi sostituire: Kyogre' })).toBeInTheDocument();
  });
});
