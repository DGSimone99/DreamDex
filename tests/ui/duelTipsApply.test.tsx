import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { TeamPanel } from '../../src/ui/TeamPanel';
import { LangProvider } from '../../src/i18n/react';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('Sfida: Applica un consiglio', () => {
  it('Applica manda al team il set nuovo del membro aperto e il cambio in parole', async () => {
    const user = userEvent.setup();
    const onTipApply = vi.fn();
    // Più lento dell'avversario di poco: c'è sempre il consiglio di Velocità (EV presi da Att o Dif)
    const me = { ...tusk, item: 'Leftovers', nature: 'Brave', evs: { hp: 4, atk: 252, def: 252 } };
    render(
      <LangProvider lang="it">
        <TeamPanel team={[me, gholdengo]} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => undefined} onAdd={() => undefined}
          onReplace={() => undefined} onRemove={() => undefined} onAllowMultipleMegas={() => undefined} onTipApply={onTipApply} />
      </LangProvider>,
    );
    await user.click(screen.getAllByRole('button', { name: /Great Tusk/ })[0]);
    const duel = await screen.findByRole('group', { name: 'Sfida' });
    const chip = await vi.waitFor(() => {
      const found = duel.querySelector<HTMLButtonElement>('.duel-tip-chip:not(.out)');
      if (!found) throw new Error('nessun chip: ' + duel.textContent);
      return found;
    });
    await user.click(chip);
    const card = screen.getByRole('dialog', { name: chip.textContent ?? '' });
    const apply = within(card).getByRole('button', { name: 'Applica' });
    await vi.waitFor(() => expect(apply).toBeEnabled(), { timeout: 5000 });
    await user.click(apply);
    expect(onTipApply).toHaveBeenCalledTimes(1);
    const [index, set, change] = onTipApply.mock.calls[0];
    expect(index).toBe(0);
    expect(set.species).toBe('Great Tusk');
    expect(set).not.toEqual(me);
    expect(change).toMatch(/EV in|→/);
  });
});
