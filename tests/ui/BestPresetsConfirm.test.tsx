import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { TeamPanel } from '../../src/ui/TeamPanel';
import { LangProvider } from '../../src/i18n/react';
import { fixtureData } from '../fixtures/data';

function renderPanel() {
  const onBulk = vi.fn();
  const team = [{ ...emptySet('Great Tusk'), moves: ['Tackle', '', '', ''] }];
  render(
    <LangProvider lang="it">
      <TeamPanel team={team} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => undefined} onAdd={() => undefined}
        onReplace={() => undefined} onRemove={() => undefined} onAllowMultipleMegas={() => undefined} onBulk={onBulk} />
    </LangProvider>,
  );
  return onBulk;
}

describe('Preset migliori del team: prima una conferma', () => {
  it('il pulsante apre una finestra che dice cosa cambia; Annulla non tocca il team', async () => {
    const user = userEvent.setup();
    const onBulk = renderPanel();
    const button = screen.getByRole('button', { name: 'Preset migliori' });
    await user.click(button);
    const dialog = screen.getByRole('alertdialog', { name: 'Preset migliori' });
    expect(dialog).toHaveTextContent('Può cambiare mosse, strumento, abilità, EV e natura di tutti i membri.');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('Esc chiude senza cambiare niente; Applica mette i preset', async () => {
    const user = userEvent.setup();
    const onBulk = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Preset migliori' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Preset migliori' }));
    // Il focus parte da Applica: Invio conferma
    expect(screen.getByRole('button', { name: 'Applica' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await vi.waitFor(() => expect(onBulk).toHaveBeenCalledWith('presets', expect.any(Array)));
  });
});
