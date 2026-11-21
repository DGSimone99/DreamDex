import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Barra laterale', () => {
  it('contiene la targa del formato (nome, famiglia e riassunto) e le sezioni; niente famiglie né pulsanti del meta', () => {
    render(<App initialLang="it" data={fixtureData} />);
    const rail = within(screen.getByRole('complementary', { name: 'Barra laterale' }));
    const format = rail.getByRole('button', { name: 'Formato National Dex OU, Competitivo, Smogon, Singolo: cambia' });
    expect(format).toHaveTextContent('National Dex OU');
    expect(format).toHaveTextContent('Competitivo');
    // Le famiglie si scelgono solo nella finestra
    expect(rail.queryByRole('button', { name: 'Giochi' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'No Format' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'Col meta' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'Senza meta' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rail.getByRole('tablist', { name: 'Sezioni' })).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('la targa apre la finestra sulla famiglia del formato attivo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: /^Formato / }));
    const dialog = screen.getByRole('dialog', { name: 'Scegli il formato' });
    expect(within(dialog).getByRole('radio', { name: 'Competitivo' })).toBeChecked();
  });

  it('le frecce su e giù scorrono le sezioni', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    screen.getByRole('tab', { name: /^Pokémon/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
  });

  it("l'avviso dei dati mancanti sta nella colonna principale, fuori dall'area della sezione", () => {
    const { container } = render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    const banner = screen.getByRole('alert');
    expect(container.querySelector('.main')).toContainElement(banner);
    expect(container.querySelector('.workspace')).not.toContainElement(banner);
  });


  it('col team incompleto il numero dei problemi è neutro (non giallo né rosso)', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Toxapex']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const count = document.querySelector('#tab-analysis .tab-count');
    expect(count).not.toBeNull();
    expect(count).toHaveClass('info');
    expect(count).not.toHaveClass('warn');
    expect(count).not.toHaveClass('serious');
  });

  it('passando sopra una sezione il fumetto dice cosa conta il numero', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Toxapex']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(document.querySelector('#tab-pokemon')).toHaveAttribute('data-hint', '2 di 6 nel team');
    expect(document.querySelector('#tab-analysis')!.getAttribute('data-hint')).toMatch(/problemi$/);
  });

  it('chiudendo la finestra del formato la tastiera torna sulla targa (anche col resto della pagina bloccato mentre è aperta)', async () => {
    // Come nel browser: un elemento dentro una parte «inert» non prende il fuoco (jsdom non lo fa da solo)
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) { if (!this.closest('[inert]')) focus.call(this, options); };
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    try {
      const user = userEvent.setup();
      const { unmount } = render(<App initialLang="it" data={fixtureData} />, { container: root });
      onTestFinished(() => unmount());
      const plate = screen.getByRole('button', { name: /^Formato / });
      plate.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog', { name: 'Scegli il formato' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Formato / })));
    } finally {
      HTMLElement.prototype.focus = focus;
      root.remove();
    }
  });

  it('il tasto F apre la finestra del formato, col cursore sul tier scelto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    // Fuori da un campo di testo (all'avvio il cursore può essere nella ricerca, dove la F si scrive)
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('f');
    expect(screen.getByRole('dialog', { name: 'Scegli il formato' })).toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector('input[name="format-tier"]:checked'));
  });

  it('anche Meta ha il fumetto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(document.querySelector('#tab-meta')!.getAttribute('data-hint')).toBeTruthy();
  });

  it('prima di confermare la finestra dice quanti Pokémon del team non sarebbero ammessi', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('button', { name: /^Formato / }));
    const dialog = screen.getByRole('dialog', { name: 'Scegli il formato' });
    expect(dialog).not.toHaveTextContent('non ammess');
    await user.click(document.querySelector<HTMLInputElement>('input[name="format-tier"][value="uu"]')!);
    expect(dialog).toHaveTextContent('1 Pokémon del team non ammesso in National Dex UU');
    // I nomi stanno nel fumetto della riga, non nella riga
    expect(dialog.querySelector('.fmt-warning')).toHaveAttribute('data-hint', 'Great Tusk');
  });
});
