import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import { encodeShare } from '../../src/share';
import { TOUCH_QUERY } from '../../src/ui/TouchTips';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function renderTeam() {
  window.history.replaceState(null, '', `/#t=${encodeShare([tusk, gholdengo], DEFAULT_CHOICE)}`);
  return render(<App initialLang="it" data={fixtureData} />);
}

describe('trascinamento e schermi touch', () => {
  it('col dito le carte del team e della lista non si trascinano', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === TOUCH_QUERY, media: query, addEventListener() {}, removeEventListener() {} }));
    const { container } = renderTeam();
    await waitFor(() => expect(container.querySelector('li.card')).not.toBeNull());
    expect(container.querySelector('.slot-card')).toHaveAttribute('draggable', 'false');
    expect(container.querySelector('li.card')).toHaveAttribute('draggable', 'false');
  });

  it('col mouse si trascinano come prima', async () => {
    const { container } = renderTeam();
    await waitFor(() => expect(container.querySelector('li.card')).not.toBeNull());
    expect(container.querySelector('.slot-card')).toHaveAttribute('draggable', 'true');
    expect(container.querySelector('li.card')).toHaveAttribute('draggable', 'true');
  });
});
