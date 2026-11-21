import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { chooseDex, chooseTier, openFormat } from '../helpers/format';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    getItem: (k: string) => values[k] ?? null,
    setItem: (k: string, v: string) => { values[k] = v; },
    removeItem: (k: string) => { delete values[k]; },
  } as unknown as Storage;
};
const formatButton = () => screen.getByRole('button', { name: /^Formato / });
const pickFamily = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  await openFormat(user);
  await user.click(document.querySelector<HTMLInputElement>(`input[name="format-family"][value="${value}"]`)!);
};

describe('memoria del formato per famiglia', () => {
  beforeEach(() => window.localStorage.clear());

  it('da National Dex UU a No Format e ritorno: si ritrova UU, anche dopo un ricaricamento', async () => {
    const storage = memory();
    const user = userEvent.setup();
    const { unmount } = render(<App initialLang="it" data={fixtureData} storage={storage} loadSource={async () => fixtureData} />);
    await chooseTier(user, 'uu');
    await pickFamily(user, 'free');
    expect(formatButton()).toHaveAccessibleName(/No Format/);
    await user.keyboard('{Escape}');
    unmount();
    render(<App initialLang="it" data={fixtureData} storage={storage} loadSource={async () => fixtureData} />);
    await pickFamily(user, 'competitive');
    expect(formatButton()).toHaveAccessibleName(/National Dex UU/);
  });

  it('un team salvato in un altro formato e poi Annulla: torna la scelta di prima', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await chooseDex(user, 'gen9');
    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText('Nome team'), 'Gen 9');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await chooseDex(user, 'natdex');
    await chooseTier(user, 'ubers');
    await user.keyboard('{Escape}');
    expect(formatButton()).toHaveAccessibleName(/National Dex Ubers/);
    await user.click(screen.getByRole('button', { name: /^Gen 9/ }));
    expect(formatButton()).toHaveAccessibleName(/Gen 9 OU/);
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(formatButton()).toHaveAccessibleName(/National Dex Ubers/);
  });
});
