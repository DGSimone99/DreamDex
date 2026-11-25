import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaTab } from '../../src/ui/meta/MetaTab';
import { dex } from '../../src/engine/dex';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';
import { LangProvider } from '../../src/i18n/react';

const grid = () => screen.getByRole('list', { name: 'Pokémon del meta' });

describe('scheda Meta', () => {
  it('nella griglia del meta solo la carta scelta ha la luce, ognuna ha la sua pedana', async () => {
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    const cards = () => within(grid()).getAllByRole('listitem');
    for (const card of cards()) expect(card.querySelector('.pedana-disc')).not.toBeNull();
    expect(cards().map(card => card.classList.contains('beam-on'))).toEqual(cards().map((_, i) => i === 0));
    await user.click(cards()[2]);
    expect(cards().map(card => card.classList.contains('beam-on'))).toEqual(cards().map((_, i) => i === 2));
    expect(cards()[0].style.getPropertyValue('--t2')).not.toBe('');
  });

  it('griglia in ordine di uso con posizione, podio e i tuoi', () => {
    renderIt(<MetaTab team={[tusk]} data={fixtureData} />);
    const cards = within(grid()).getAllByRole('listitem');
    // 8 validi nelle statistiche della fixture (Pikachu sotto la soglia, il nome finto scartato)
    expect(cards).toHaveLength(8);
    expect(cards[0]).toHaveTextContent('#1');
    expect(cards[0]).toHaveTextContent('Great Tusk');
    expect(cards[0]).toHaveTextContent('30,0%');
    expect(cards[0]).toHaveClass('medal-1');
    expect(cards[2]).toHaveClass('medal-3');
    expect(cards[3].className).not.toMatch(/medal/);
    expect(cards[0]).toHaveTextContent('Tuo');
    expect(cards[1]).not.toHaveTextContent('Tuo');
    expect(screen.getByText('i 8 più usati · uso = % di team che lo portano')).toBeInTheDocument();
  });

  it('il #1 è scelto all\'apertura; un clic sceglie un\'altra carta', async () => {
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    expect(screen.getByRole('button', { name: /^1\.\s*Great Tusk$/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
    expect(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^1\.\s*Great Tusk$/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un clic su tutta la carta (non solo sul nome) la sceglie', async () => {
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    await user.click(within(grid()).getAllByRole('listitem')[2]);
    expect(screen.getByRole('button', { name: /^3\.\s*Kingambit$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('riga del team: posizione e uso sempre visibili, assente non cliccabile, uso medio', () => {
    renderIt(<MetaTab team={[tusk, gholdengo, { ...tusk, species: 'Magikarp', item: '' }]} data={fixtureData} />);
    const row = screen.getByRole('group', { name: 'Il tuo team' });
    expect(row).toHaveTextContent('#1');
    expect(row).toHaveTextContent('30,0%');
    expect(within(row).getByRole('button', { name: /Magikarp/ })).toBeDisabled();
    // Senza statistiche: "#–" e "–" (la casella resta corta), il perché per lo screen reader e nel fumetto
    expect(within(row).getByRole('button', { name: /Magikarp/ })).toHaveTextContent('#––');
    expect(within(row).getByRole('button', { name: /Magikarp/ })).toHaveAccessibleName(/non presente nelle statistiche/);
    expect(row).toHaveTextContent('Uso medio 27,5%');
  });

  it('fuori dai più usati: "#–" al posto di una scritta lunga, uso visibile, il perché nel nome', () => {
    // 40 nomi veri più usati di Toxapex: Toxapex scende al 41° posto
    const filler = Object.fromEntries(dex.species.all().filter(s => s.num > 0 && !s.forme).slice(0, 40).map(s => [s.name, { ...fixtureData.stats!.pokemon['Toxapex'], usage: 0.5 }]));
    const data = { ...fixtureData, stats: { ...fixtureData.stats!, pokemon: { ...fixtureData.stats!.pokemon, ...filler } } };
    renderIt(<MetaTab team={[tusk, { ...tusk, species: 'Toxapex', item: '' }]} data={data} />);
    const apex = within(screen.getByRole('group', { name: 'Il tuo team' })).getByRole('button', { name: /Toxapex/ });
    expect(apex).toBeEnabled();
    expect(apex).toHaveTextContent(/^Toxapex #– \d/);
    expect(apex).toHaveAccessibleName(/fuori dai 40 più usati/);
  });

  it('team vuoto: niente riga del team, la griglia c\'è', () => {
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    expect(screen.queryByRole('group', { name: 'Il tuo team' })).toBeNull();
    expect(grid()).toBeInTheDocument();
  });

  it('la scheda mostra il set più usato del Pokémon scelto', () => {
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    const card = screen.getByRole('complementary', { name: 'Scheda' });
    expect(card).toHaveTextContent('Great Tusk');
    expect(card).toHaveTextContent('#1');
    expect(card).toHaveTextContent('30,0%');
    expect(card).toHaveTextContent('Strumento');
    expect(card).toHaveTextContent('Booster Energy');
    expect(card).toHaveTextContent('Protosynthesis');
    expect(card).toHaveTextContent('Mosse più usate');
    expect(card).toHaveTextContent('Headlong Rush');
    expect(card).toHaveTextContent('Spesso con');
  });

  it('clic su una targhetta del team o su un compagno apre la sua scheda', async () => {
    const user = userEvent.setup();
    renderIt(<MetaTab team={[tusk, gholdengo]} data={fixtureData} />);
    await user.click(within(screen.getByRole('group', { name: 'Il tuo team' })).getByRole('button', { name: /Gholdengo/ }));
    expect(screen.getByRole('complementary', { name: 'Scheda' })).toHaveTextContent('Good as Gold');
    await user.click(within(screen.getByRole('complementary', { name: 'Scheda' })).getByRole('button', { name: 'Kingambit' }));
    expect(screen.getByRole('complementary', { name: 'Scheda' })).toHaveTextContent('Supreme Overlord');
  });

  it('in inglese i titoli della scheda sono inglesi, il nome del Pokémon resta', () => {
    render(<LangProvider lang="en"><MetaTab team={[]} data={fixtureData} /></LangProvider>);
    const card = screen.getByRole('complementary', { name: 'Profile' });
    expect(card).toHaveTextContent('Most used moves');
    expect(card).toHaveTextContent('Great Tusk');
  });
});

describe('scheda Meta su telefono e tablet', () => {
  const narrow = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 1099px)', media: query, addEventListener() {}, removeEventListener() {} }));
  afterEach(() => vi.unstubAllGlobals());

  it('toccando una carta la scheda si apre come finestra; "Torna al meta" la chiude', async () => {
    narrow();
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Torna al meta' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
    const sheet = screen.getByRole('dialog', { name: 'Scheda' });
    expect(sheet).toHaveTextContent('Gholdengo');
    expect(sheet).toHaveFocus();
    expect(document.querySelector('.meta-tab')).toHaveClass('sheet-open');
    // La griglia sotto è inerte finché la scheda è aperta
    expect(document.querySelector('.meta-main')).toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: 'Torna al meta' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector('.meta-main')).not.toHaveAttribute('inert');
  });

  it('tablet: un clic fuori dalla scheda (sul velo) la chiude', async () => {
    narrow();
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
    const scrim = document.querySelector<HTMLElement>('.meta-tab > .sheet-scrim')!;
    expect(scrim).not.toHaveAttribute('inert');
    await user.click(scrim);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Esc chiude la scheda', async () => {
    narrow();
    const user = userEvent.setup();
    renderIt(<MetaTab team={[tusk]} data={fixtureData} />);
    await user.click(within(screen.getByRole('group', { name: 'Il tuo team' })).getByRole('button', { name: /Great Tusk/ }));
    expect(screen.getByRole('dialog', { name: 'Scheda' })).toHaveTextContent('Great Tusk');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sul PC la scheda resta a destra: niente finestra', async () => {
    const user = userEvent.setup();
    renderIt(<MetaTab team={[]} data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Scheda' })).toHaveTextContent('Gholdengo');
  });
});
