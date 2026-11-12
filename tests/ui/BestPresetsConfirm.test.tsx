import { render, screen, within } from '@testing-library/react';
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
  return { onBulk, team };
}

const dialog = () => screen.getByRole('dialog', { name: 'Migliora i set' });
// Il calcolo parte poco dopo l'apertura: si aspetta che il risultato sia pronto
const ready = () => vi.waitFor(() => expect(within(dialog()).queryByText('Calcolo…')).toBeNull());

describe('Migliora i set (team pieno): prima una conferma', () => {
  it('il pulsante apre una finestra che dice cosa fa; Annulla non tocca il team', async () => {
    const user = userEvent.setup();
    const { onBulk } = renderPanel();
    const button = screen.getByRole('button', { name: 'Migliora i set' });
    await user.click(button);
    expect(dialog()).toHaveTextContent("Sceglie per ogni Pokémon le mosse, l'abilità, lo strumento e gli EV migliori per il tuo team.");
    await ready();
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('Esc chiude senza cambiare niente; Applica mette i set nuovi', async () => {
    const user = userEvent.setup();
    const { onBulk } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBulk).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    await ready();
    const apply = within(dialog()).getAllByRole('button').at(-1)!;
    // Il focus parte da Applica: Invio conferma
    expect(apply).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onBulk).toHaveBeenCalledWith('presets', expect.any(Array));
  });

  it('Controlla cambiamenti allarga la finestra: una colonna per Pokémon; togliendo una spunta quel membro resta com’è', async () => {
    const user = userEvent.setup();
    const { onBulk, team } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    await ready();
    const toggle = within(dialog()).getByRole('button', { name: 'Controlla cambiamenti' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Nascondi cambiamenti');
    // Ogni colonna: il set di adesso, la freccia "Dopo" e il set nuovo
    expect(within(dialog()).getAllByText('Dopo', { selector: '.improve-down' }).length).toBeGreaterThan(0);
    const boxes = within(dialog()).getAllByRole('checkbox', { name: /^Includi / });
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach(box => expect(box).toBeChecked());
    await user.click(boxes[0]);
    expect(boxes[0]).not.toBeChecked();
    const apply = within(dialog()).getAllByRole('button').at(-1)!;
    expect(boxes).toHaveLength(6);
    expect(apply).toHaveTextContent('Applica 5 cambi');
    await user.click(apply);
    const applied = onBulk.mock.calls[0][1];
    expect(applied[0]).toEqual(team[0]);
  });

  it('la guida della testata: Completa team finché mancano Pokémon, Migliora i set col team pieno', () => {
    renderPanel(3);
    expect(screen.getByRole('button', { name: 'Completa team' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Migliora i set' })).toBeNull();
  });
});
