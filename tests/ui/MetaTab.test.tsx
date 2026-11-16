import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MetaTab } from '../../src/ui/meta/MetaTab';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';
import { LangProvider } from '../../src/i18n/react';

const grid = () => screen.getByRole('list', { name: 'Pokémon del meta' });

describe('scheda Meta', () => {
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
    expect(row).toHaveTextContent('Uso medio 27,5%');
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

describe('scheda Meta su schermo stretto', () => {
  it('scegliendo una carta la scheda del Pokémon scorre in vista (sta sotto la griglia)', async () => {
    const user = userEvent.setup();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const scrolled: Element[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    const before = proto.scrollIntoView;
    proto.scrollIntoView = function (this: Element) { scrolled.push(this); };
    try {
      renderIt(<MetaTab team={[]} data={fixtureData} />);
      expect(scrolled).toHaveLength(0);
      await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
      expect(scrolled).toEqual([screen.getByRole('complementary', { name: 'Scheda' })]);
    } finally {
      window.matchMedia = original;
      proto.scrollIntoView = before;
    }
  });
});
