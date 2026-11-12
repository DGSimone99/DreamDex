import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { TeamPanel } from '../../src/ui/TeamPanel';
import { LangProvider } from '../../src/i18n/react';
import { fixtureData } from '../fixtures/data';

function renderPanel(size = 6) {
  const onBulk = vi.fn();
  const team = Array.from({ length: size }, () => ({ ...emptySet('Great Tusk'), moves: ['Tackle', '', '', ''] }));
  render(
    <LangProvider lang="it">
      <TeamPanel team={team} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => undefined} onAdd={() => undefined}
        onReplace={() => undefined} onRemove={() => undefined} onAllowMultipleMegas={() => undefined} onBulk={onBulk} />
    </LangProvider>,
  );
  return onBulk;
}

describe('Migliora i set (team pieno): prima una conferma', () => {
  it('il pulsante apre una finestra che dice cosa cambia; Annulla non tocca il team', async () => {
    const user = userEvent.setup();
    const onBulk = renderPanel();
    const button = screen.getByRole('button', { name: 'Migliora i set' });
    await user.click(button);
    const dialog = screen.getByRole('alertdialog', { name: 'Migliora i set' });
    expect(dialog).toHaveTextContent('Può cambiare mosse, strumento, abilità, EV e natura di tutti i membri.');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('Esc chiude senza cambiare niente; Applica mette i preset', async () => {
    const user = userEvent.setup();
    const onBulk = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    // Il focus parte da Applica: Invio conferma
    expect(screen.getByRole('button', { name: 'Applica' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await vi.waitFor(() => expect(onBulk).toHaveBeenCalledWith('presets', expect.any(Array)));
  });

  it('la guida della testata: Completa team finché mancano Pokémon, Migliora i set col team pieno', () => {
    renderPanel(3);
    expect(screen.getByRole('button', { name: 'Completa team' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Migliora i set' })).toBeNull();
  });
});
