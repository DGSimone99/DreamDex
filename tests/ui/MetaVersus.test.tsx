import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { TeamRating } from '../../src/engine/rating';
import { MetaTab } from '../../src/ui/meta/MetaTab';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

/** Un voto finto con le sole righe della Coverage meta (Difesa: chi regge; Offesa: chi manda KO in due). */
const held = (species: string, partial = false) => ({ species, move: 'x', pct: partial ? 60 : 30, partial, band: partial ? 'two' : 'four' });
const ko = (species: string) => ({ species, move: 'x', pct: 70, partial: false, credit: 0.7 });
const fakeRating = (defense: Record<string, ReturnType<typeof held>[]>, offense: Record<string, ReturnType<typeof ko>[]>) => ({
  defense: { coverageMeta: { value: 0, unanswered: [], rows: Object.entries(defense).map(([species, heldBy]) => ({ species, heldBy })) } },
  offense: { coverageMeta: { value: 0, holes: [], rows: Object.entries(offense).map(([species, coveredBy]) => ({ species, coveredBy })) } },
}) as unknown as TeamRating;

const profile = () => screen.getByRole('complementary', { name: 'Scheda' });
const block = () => within(profile()).getByRole('region', { name: /^Contro il tuo team/ });
const rows = () => within(block()).getAllByRole('listitem');

describe('scheda Meta: Contro il tuo team', () => {
  it('gestito: chi lo regge (senza chi va KO in due) e chi lo manda KO in due, coi conti', () => {
    const rating = fakeRating(
      { 'Great Tusk': [held('Kingambit'), held('Corviknight'), held('Toxapex', true)] },
      { 'Great Tusk': [ko('Gholdengo'), ko('Kingambit'), ko('Gholdengo')] },
    );
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating} onCoverage={vi.fn()} />);
    expect(block()).toHaveAccessibleName('Contro il tuo team: gestito');
    expect(within(block()).getByText('gestito')).toHaveClass('mvs-tag', 'held');
    const [def, off] = rows();
    expect(def).toHaveTextContent('Kingambit, Corviknight, lo reggono2');
    expect(def).not.toHaveTextContent('Toxapex');
    expect(def.querySelector('.mvs-count')).toHaveClass('held');
    expect(off).toHaveTextContent('Gholdengo, Kingambit, lo mandano KO in 22');
    expect(def.querySelectorAll('img.sprite')).toHaveLength(2);
  });

  it('senza check: "Nessuno lo regge"; uno solo lo manda KO (un solo check sul conto)', () => {
    const rating = fakeRating({ 'Great Tusk': [held('Toxapex', true)] }, { 'Great Tusk': [ko('Kingambit')] });
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating} onCoverage={vi.fn()} />);
    expect(within(block()).getByText('senza check')).toHaveClass('open');
    const [def, off] = rows();
    expect(def).toHaveTextContent('Nessunolo regge0');
    expect(def.querySelector('.mvs-count')).toHaveClass('open');
    expect(off).toHaveTextContent('Kingambit, lo manda KO in 21');
    expect(off.querySelector('.mvs-count')).toHaveClass('thin');
  });

  it('un solo check: un lato con un membro solo', () => {
    const rating = fakeRating({ 'Great Tusk': [held('Kingambit')] }, { 'Great Tusk': [ko('Gholdengo'), ko('Kingambit')] });
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating} onCoverage={vi.fn()} />);
    expect(within(block()).getByText('un solo check')).toHaveClass('thin');
  });

  it('un tuo membro: "nel tuo team" e i conti del resto del team (lui tolto)', () => {
    const rating = fakeRating(
      { 'Great Tusk': [held('Great Tusk'), held('Gholdengo')] },
      { 'Great Tusk': [ko('Great Tusk')] },
    );
    renderIt(<MetaTab team={[tusk, gholdengo]} data={fixtureData} rating={rating} onCoverage={vi.fn()} />);
    expect(within(block()).getByText('nel tuo team')).toHaveClass('own');
    expect(block()).toHaveTextContent('Il resto del team contro un Great Tusk avversario');
    const [def, off] = rows();
    expect(def).toHaveTextContent('Gholdengo, lo regge1');
    expect(off).toHaveTextContent('Nessunolo manda KO in 20');
  });

  it('solo i lati che hanno la riga; nessuna riga, nessun blocco', async () => {
    const user = userEvent.setup();
    const rating = fakeRating({ 'Great Tusk': [held('Kingambit')] }, {});
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating} onCoverage={vi.fn()} />);
    expect(rows()).toHaveLength(1);
    expect(within(block()).queryByRole('button', { name: /Offesa/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^2\.\s*Gholdengo$/ }));
    expect(within(profile()).queryByRole('region', { name: /^Contro il tuo team/ })).toBeNull();
  });

  it('senza voto o col meta spento il blocco non c\'è', () => {
    const { unmount } = renderIt(<MetaTab team={[]} data={fixtureData} onCoverage={vi.fn()} />);
    expect(within(profile()).queryByText('Contro il tuo team')).toBeNull();
    unmount();
    renderIt(<MetaTab team={[]} data={{ ...fixtureData, ignoreMeta: true }} rating={fakeRating({ 'Great Tusk': [] }, {})} onCoverage={vi.fn()} />);
    expect(screen.queryByText('Contro il tuo team')).toBeNull();
  });

  it('i due link chiedono la Coverage meta del lato giusto su questo Pokémon', async () => {
    const user = userEvent.setup();
    const onCoverage = vi.fn();
    const rating = fakeRating({ 'Great Tusk': [held('Kingambit')] }, { 'Great Tusk': [ko('Kingambit')] });
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating} onCoverage={onCoverage} />);
    const def = within(block()).getByRole('button', { name: 'Apri la Coverage meta della Difesa su Great Tusk' });
    expect(def).toHaveTextContent('Coverage meta in Difesa');
    await user.click(def);
    expect(onCoverage).toHaveBeenLastCalledWith('defense', 'Great Tusk');
    const off = within(block()).getByRole('button', { name: "Apri la Coverage meta dell'Offesa su Great Tusk" });
    expect(off).toHaveTextContent('in Offesa');
    await user.click(off);
    expect(onCoverage).toHaveBeenLastCalledWith('offense', 'Great Tusk');
  });
});

describe('scheda Meta che non ci sta: il pulsante in fondo riduce il team', () => {
  const rating = () => fakeRating({ 'Great Tusk': [held('Kingambit')] }, { 'Great Tusk': [ko('Kingambit')] });
  /** La scheda è alta 600: col blocco il contenuto è 700 (esce), senza 560 (sta). */
  const overflow = () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('meta-profile') ? 600 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('meta-profile') ? (this.querySelector('.meta-vs') ? 700 : 560) : 0;
    });
  };
  afterEach(() => vi.restoreAllMocks());

  it('al posto del blocco il pulsante "+ Contro il tuo team", che riduce il team', async () => {
    overflow();
    const user = userEvent.setup();
    const onCollapseTeam = vi.fn();
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating()} onCoverage={vi.fn()} onCollapseTeam={onCollapseTeam} />);
    expect(within(profile()).queryByRole('region', { name: /^Contro il tuo team/ })).toBeNull();
    expect(within(profile()).getByText('Spesso con')).toBeInTheDocument();
    const more = within(profile()).getByRole('button', { name: 'Riduci il team per vedere: Contro il tuo team' });
    expect(more).toHaveClass('sum-more-below');
    expect(more).toHaveTextContent('+ Contro il tuo team');
    await user.click(more);
    expect(onCollapseTeam).toHaveBeenCalledTimes(1);
  });

  it("col team già ridotto, o se ci sta, il blocco c'è e il pulsante no", () => {
    overflow();
    const { unmount } = renderIt(<MetaTab team={[]} data={fixtureData} rating={rating()} onCoverage={vi.fn()} onCollapseTeam={vi.fn()} teamCollapsed />);
    expect(block()).toBeInTheDocument();
    expect(within(profile()).queryByRole('button', { name: /^Riduci il team/ })).toBeNull();
    unmount();
    vi.restoreAllMocks();
    renderIt(<MetaTab team={[]} data={fixtureData} rating={rating()} onCoverage={vi.fn()} onCollapseTeam={vi.fn()} />);
    expect(block()).toBeInTheDocument();
    expect(within(profile()).queryByRole('button', { name: /^Riduci il team/ })).toBeNull();
  });
});

describe('App: fra la scheda Meta e la Coverage meta', () => {
  const setup = async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    return user;
  };

  it('il link della scheda Meta apre Analisi, l\'area e la Coverage meta con la minaccia accesa', async () => {
    const user = await setup();
    await user.click(document.getElementById('tab-meta')!);
    await user.click(within(document.getElementById('panel-meta')!).getByRole('button', { name: /^3\.\s*Kingambit$/ }));
    await user.click(within(block()).getByRole('button', { name: 'Apri la Coverage meta della Difesa su Kingambit' }));
    const analysis = within(document.getElementById('panel-analysis')!);
    expect(analysis.getByRole('region', { name: 'Difesa' })).toBeInTheDocument();
    expect(analysis.getByRole('tab', { name: /^Coverage meta/ })).toHaveAttribute('aria-selected', 'true');
    expect(analysis.getByText('Evidenziato: Kingambit')).toBeInTheDocument();
  });

  it("il link dell'Offesa apre l'Offesa sulla Coverage meta (quando il Pokémon ha la riga)", async () => {
    const user = await setup();
    await user.click(document.getElementById('tab-meta')!);
    const off = within(block()).queryByRole('button', { name: /^Apri la Coverage meta dell'Offesa su / });
    expect(off).not.toBeNull();
    if (!off) return;
    const name = off.getAttribute('aria-label')!.replace(/^Apri la Coverage meta dell'Offesa su /, '');
    await user.click(off);
    const analysis = within(document.getElementById('panel-analysis')!);
    expect(analysis.getByRole('region', { name: 'Offesa' })).toBeInTheDocument();
    expect(analysis.getByRole('tab', { name: /^Coverage meta/ })).toHaveAttribute('aria-selected', 'true');
    expect(analysis.getByText(`Evidenziato: ${name}`)).toBeInTheDocument();
  });
});
