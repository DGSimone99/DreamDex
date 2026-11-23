import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { fixtureData, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

// Il numero per pagina lo decide la misura: qui lo si cambia a mano, come una finestra che si rimpicciolisce
const measure = vi.hoisted(() => ({ perPage: 4, columns: 4, tileHeight: 200, reasons: 2, listWidth: 654 }));
vi.mock('../../src/ui/usePerPage', () => ({ PAGE: 6, usePerPage: () => ({ ...measure }) }));

describe('Box: cambio del numero per pagina', () => {
  it('col ridimensionamento la pagina aperta resta valida', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const user = userEvent.setup();
    const props = { team: [tusk] as never, format: DEFAULT_FORMAT, data: fixtureData, replaceIndex: null,
      onAdd: () => {}, onReplaceWith: () => {}, onCancelReplace: () => {} };
    const { rerender } = renderIt(<SuggestionsPanel {...props} />);
    const panel = screen.getByRole('region', { name: 'Suggerimenti' });
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' }, { timeout: 5000 });
    await user.click(within(pager).getByRole('button', { name: 'Pagina successiva' }));
    const cards = () => [...panel.querySelectorAll<HTMLElement>('.suggestions .card')];
    const firstName = cards()[0].textContent;
    measure.perPage = 2;
    measure.columns = 2;
    act(() => { rerender(<SuggestionsPanel {...props} />); });
    // Il primo che si vedeva (il 5°) resta in vista: ora a pagina 3
    expect(cards()[0].textContent).toBe(firstName);
    const count = within(panel).getByRole('status', { name: /Pagina/ });
    // A vista "3/5" (il testo per i lettori di schermo dice "Pagina 3 di 5")
    const [n, total] = count.querySelector('[aria-hidden]')!.textContent!.split('/').map(Number);
    expect(n).toBe(3);
    expect(n).toBeLessThanOrEqual(total);
  });
});
