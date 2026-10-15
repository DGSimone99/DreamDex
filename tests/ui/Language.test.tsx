import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { loadLang } from '../../src/storage';
import { fixtureData } from '../fixtures/data';

describe('interruttore di lingua', () => {
  beforeEach(() => window.localStorage.clear());

  it('parte in inglese e ricorda la scelta', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} storage={window.localStorage} />);
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: 'IT' }));
    expect(screen.getByRole('group', { name: 'Lingua' })).toBeInTheDocument();
    expect(loadLang(window.localStorage)).toBe('it');
    expect(document.documentElement.lang).toBe('it');
  });

  it('lingua salvata non valida: si parte in inglese', () => {
    window.localStorage.setItem('dreamdex.lang', '"fr"');
    expect(loadLang(window.localStorage)).toBeNull();
    window.localStorage.setItem('dreamdex.lang', '{rotto');
    expect(loadLang(window.localStorage)).toBeNull();
  });
});
