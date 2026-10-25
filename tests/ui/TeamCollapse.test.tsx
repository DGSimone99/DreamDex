import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { loadTeamCollapsed } from '../../src/storage';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    getItem: (k: string) => values[k] ?? null,
    setItem: (k: string, v: string) => { values[k] = v; },
    removeItem: (k: string) => { delete values[k]; },
  } as unknown as Storage;
};

afterEach(() => window.history.replaceState(null, '', '/'));

function renderTeam(storage?: Storage) {
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  return render(<App initialLang="it" data={fixtureData} storage={storage} />);
}

describe('team compresso', () => {
  it('la freccia comprime e riespande il team, e la scelta resta salvata', async () => {
    const user = userEvent.setup();
    const storage = memory();
    const { container, unmount } = renderTeam(storage);
    const toggle = screen.getByRole('button', { name: 'Comprimi team' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(container.querySelector('.band')).toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: 'Espandi team' })).toHaveAttribute('aria-expanded', 'false');
    expect(loadTeamCollapsed(storage)).toBe(true);
    unmount();
    const again = renderTeam(storage);
    expect(again.container.querySelector('.band')).toHaveClass('collapsed');
    await user.click(screen.getByRole('button', { name: 'Espandi team' }));
    expect(again.container.querySelector('.band')).not.toHaveClass('collapsed');
    expect(loadTeamCollapsed(storage)).toBe(false);
  });

  it('compresso, ogni membro ha la sua icona; un clic apre comunque l\'editor', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    const cards = [...container.querySelectorAll<HTMLElement>('.slot > summary')];
    expect(cards.map(card => card.querySelector('.mini-icon .mon-icon'))).not.toContain(null);
    await user.click(cards[1]);
    expect(container.querySelector('.workspace')).toHaveClass('editing');
    expect(container.querySelector('.band')).toHaveClass('collapsed');
  });

  it('compresso, un membro con un problema mostra il puntino di avviso', async () => {
    const user = userEvent.setup();
    const kyogre = { ...tusk, species: 'Kyogre', item: '', ability: 'Drizzle' };
    window.history.replaceState(null, '', `/#team=${encodeShare([tusk, kyogre], DEFAULT_FORMAT)}`);
    const { container } = render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    const cards = [...container.querySelectorAll<HTMLElement>('.slot > summary')];
    expect(cards[0].querySelector('.mini-alert')).toBeNull();
    expect(cards[1].querySelector('.mini-alert.danger')).not.toBeNull();
  });
});
