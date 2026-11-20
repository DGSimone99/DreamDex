import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  await user.click(container.querySelector<HTMLElement>('.slot-toggle')!);
  return { user, container, slot: () => container.querySelector<HTMLElement>('.slot.open')! };
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
    expect(slot().querySelector('.editor-title .species-tag')).toBeNull();
    const input = within(slot()).getByLabelText('Soprannome di Great Tusk');
    await user.type(input, 'Tusky{Enter}');
    expect(within(slot()).getByRole('button', { name: 'Soprannome di Great Tusk' }).querySelector('[data-name]')).toHaveAttribute('data-name', 'Tusky');
    // Nell'editor, sopra il soprannome, la specie come piccola etichetta (solo se c'è un soprannome)
    expect(slot().querySelector('.editor-title .species-tag')).toHaveTextContent('Great Tusk');
    // Sulla carta il soprannome, con la specie nel tooltip
    expect(slot().querySelector('.slot-card .name')).toHaveTextContent('Tusky');
    expect(slot().querySelector('.slot-card .name')).toHaveAttribute('title', 'Tusky (Great Tusk)');
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: 'Incolla testo' }));
    expect((within(slot()).getByLabelText('Set in testo Showdown') as HTMLTextAreaElement).value).toMatch(/^Tusky \(Great Tusk\)/);
  });

  it('il pulsante Shiny cambia lo sprite della carta', async () => {
    const { user, slot } = await openEditor();
    const shiny = within(slot()).getByRole('button', { name: 'Shiny' });
    expect(shiny).toHaveAttribute('aria-pressed', 'false');
    await user.click(shiny);
    expect(within(slot()).getByRole('button', { name: 'Shiny' })).toHaveAttribute('aria-pressed', 'true');
    expect(slot().querySelector('.slot-card .sprite')!.getAttribute('src')).toContain('gen5-shiny/');
  });

  it('Sostituisci sta in basso a destra, accanto al riquadro dei ruoli ma fuori', async () => {
    const { slot } = await openEditor();
    const replace = within(slot()).getByRole('button', { name: 'Sostituisci Great Tusk' });
    expect(replace.closest('.editor-foot')).not.toBeNull();
    expect(replace.closest('.editor-roles')).toBeNull();
  });

  it('Testo del set si apre sopra le Statistiche (Set e Mosse restano in vista) e si chiude cliccando fuori', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: 'Incolla testo' }));
    const text = within(slot()).getByLabelText('Set in testo Showdown');
    expect(text.closest('.stats-cell')).not.toBeNull();
    // Un clic dentro il riquadro non lo chiude
    fireEvent.pointerDown(text);
    expect(within(slot()).getByLabelText('Set in testo Showdown')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(within(slot()).queryByLabelText('Set in testo Showdown')).toBeNull();
  });

  it('Importa / Esporta: se il testo è stato modificato, un clic fuori non lo butta', async () => {
    const { user, slot } = await openEditor();
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    await user.click(within(slot()).getByRole('button', { name: 'Incolla testo' }));
    const text = within(slot()).getByLabelText('Set in testo Showdown');
    await user.clear(text);
    await user.type(text, 'Garchomp');
    fireEvent.pointerDown(document.body);
    expect(within(slot()).getByLabelText('Set in testo Showdown')).toHaveValue('Garchomp');
  });

  it('le icone della testata hanno un fumetto col nome, col mouse e col fuoco', async () => {
    const { user, slot } = await openEditor();
    const bubbleOf = (el: HTMLElement) => el.closest('.hint-wrap')!.querySelector('.hint-bubble')!;
    const copy = within(slot()).getByRole('button', { name: 'Copia il set' });
    expect(bubbleOf(copy)).not.toBeVisible();
    await user.hover(copy);
    expect(bubbleOf(copy)).toBeVisible();
    expect(bubbleOf(copy)).toHaveTextContent('Copia il set');
    await user.unhover(copy);
    expect(bubbleOf(copy)).not.toBeVisible();
    const shiny = within(slot()).getByRole('button', { name: 'Shiny' });
    act(() => shiny.focus());
    expect(bubbleOf(shiny)).toBeVisible();
    // Il link a Smogon (in fondo al menu Set): il nome resta, dove porta è la sua descrizione
    await user.click(within(slot()).getByRole('button', { name: /^Set:/ }));
    const smogon = within(slot()).getByRole('link', { name: 'Apri su Smogon' });
    expect(smogon).toHaveAccessibleDescription(/Analisi Smogon per|nessuna analisi/);
    expect(within(slot()).getByRole('button', { name: 'Chiudi editor' }).closest('.hint-wrap')).not.toBeNull();
  });

  it('il nome ha una matita (il soprannome si cambia cliccandolo)', async () => {
    const { slot } = await openEditor();
    const name = within(slot()).getByRole('button', { name: 'Soprannome di Great Tusk' });
    expect(name.querySelector('.nickname-pencil')).not.toBeNull();
  });

  it('Copia il set è a un clic, accanto al pulsante Set, senza aprire il riquadro', async () => {
    const { slot } = await openEditor();
    const copy = within(slot()).getByRole('button', { name: 'Copia il set' });
    expect(copy.closest('.editor-actions')).toContainElement(within(slot()).getByRole('button', { name: /^Set:/ }));
    expect(within(slot()).queryByLabelText('Set in testo Showdown')).toBeNull();
  });

  it('Custom Skillset sta nella fascia del Set: a vista solo il nome, cosa fa nel fumetto e nella descrizione', async () => {
    const { user, slot } = await openEditor();
    const toggle = within(slot()).getByRole('checkbox', { name: 'Custom Skillset Great Tusk' });
    expect(toggle.closest('fieldset')).toBe(within(slot()).getByRole('group', { name: 'Set' }));
    const label = toggle.closest('label')!;
    expect(label.querySelector('.custom-text')).toHaveTextContent(/^Custom Skillset$/);
    expect(toggle).toHaveAccessibleDescription('Ogni mossa e abilità, anche non imparabili');
    const bubble = label.querySelector('.hint-bubble')!;
    expect(bubble).not.toBeVisible();
    await user.hover(label);
    expect(bubble).toBeVisible();
  });
});
