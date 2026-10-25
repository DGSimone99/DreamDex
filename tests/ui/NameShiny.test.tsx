import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { exportShowdown, importShowdown } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { resetMySetsCache } from '../../src/ui/mySets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

beforeEach(() => { window.localStorage.clear(); resetMySetsCache(); });
afterEach(() => window.history.replaceState(null, '', '/'));

async function openEditor() {
  const user = userEvent.setup();
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  const { container } = render(<App initialLang="it" data={fixtureData} />);
  await user.click(container.querySelector<HTMLElement>('.slot > summary')!);
  return { user, container, slot: () => container.querySelector<HTMLElement>('.slot[open]')! };
}

describe('soprannome e shiny nel testo Showdown', () => {
  it('esporta e reimporta soprannome e Shiny', () => {
    const text = exportShowdown([{ ...tusk, name: 'Tusky', shiny: true }]);
    expect(text).toMatch(/^Tusky \(Great Tusk\) @ /);
    expect(text).toContain('Shiny: Yes');
    const back = importShowdown(text).sets[0];
    expect(back.name).toBe('Tusky');
    expect(back.shiny).toBe(true);
    expect(importShowdown(exportShowdown([tusk])).sets[0].name).toBeUndefined();
  });
});

describe('testata dell\'editor', () => {
  it('cliccando il nome si scrive un soprannome; resta nel set e nell\'esportazione', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot()).getByRole('button', { name: 'Soprannome di Great Tusk' }));
    const input = within(slot()).getByLabelText('Soprannome di Great Tusk');
    await user.type(input, 'Tusky{Enter}');
    expect(within(slot()).getByRole('button', { name: 'Soprannome di Great Tusk' }).querySelector('[data-name]')).toHaveAttribute('data-name', 'Tusky');
    // Sulla carta il soprannome, con la specie nel tooltip
    expect(slot().querySelector('summary .name')).toHaveTextContent('Tusky');
    expect(slot().querySelector('summary .name')).toHaveAttribute('title', 'Great Tusk');
    await user.click(within(slot()).getByRole('button', { name: 'Importa / Esporta set' }));
    expect((within(slot()).getByLabelText('Set da incollare (testo Showdown)') as HTMLTextAreaElement).value).toMatch(/^Tusky \(Great Tusk\)/);
  });

  it('il pulsante Shiny cambia lo sprite della carta', async () => {
    const { user, slot } = await openEditor();
    const shiny = within(slot()).getByRole('button', { name: 'Shiny' });
    expect(shiny).toHaveAttribute('aria-pressed', 'false');
    await user.click(shiny);
    expect(within(slot()).getByRole('button', { name: 'Shiny' })).toHaveAttribute('aria-pressed', 'true');
    expect(slot().querySelector('summary .sprite')!.getAttribute('src')).toContain('gen5-shiny/');
  });

  it('Sostituisci sta in basso a destra, nella riga dei ruoli', async () => {
    const { slot } = await openEditor();
    expect(within(slot()).getByRole('button', { name: 'Sostituisci Great Tusk' }).closest('.editor-roles')).not.toBeNull();
  });

  it('Importa / Esporta si apre sotto il suo pulsante e si chiude cliccando fuori', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot()).getByRole('button', { name: 'Importa / Esporta set' }));
    expect(within(slot()).getByLabelText('Set da incollare (testo Showdown)').closest('.io-anchor')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(within(slot()).queryByLabelText('Set da incollare (testo Showdown)')).toBeNull();
  });

  it('Custom Skillset: la casella viene dopo il testo', async () => {
    const { slot } = await openEditor();
    const label = slot().querySelector('.custom-toggle')!;
    expect(label.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(label.lastChild).toBe(label.querySelector('input'));
  });
});
