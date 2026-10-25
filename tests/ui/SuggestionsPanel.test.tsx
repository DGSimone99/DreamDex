import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const list = () => suggestions().querySelector<HTMLElement>('.suggestions')!;
const rowNames = () => [...list().querySelectorAll('.name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('SuggestionsPanel', () => {
  it('ordina i suggerimenti per il voto che darebbero al team', async () => {
    await setup('Great Tusk', 'Gholdengo');
    // Corviknight, Kingambit, Rotom-Wash, Toxapex (Dragapult è Uber in National Dex)
    expect(within(suggestions()).getAllByRole('button', { name: /^Aggiungi .+ al team$/ })).toHaveLength(4);
    const grades = within(list()).getAllByLabelText(/^Voto del team: [SABCD] \d+ \((\+\d+|−\d+|±0)\)$/)
      .map(cell => Number(/ (\d+) \(/.exec(cell.getAttribute('aria-label')!)![1]));
    expect(grades).toHaveLength(4);
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
  });

  it('il dettaglio mostra il primo candidato: quanto sale il voto del team, in tutto e per area', async () => {
    await setup('Great Tusk');
    const first = rowNames()[0];
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${first}` });
    expect(detail.querySelector('.detail-score')).toHaveTextContent(/^(\+\d+|−\d+|±0)voto del team [SABCD] \d+ → [SABCD] \d+$/);
    const areas = [...detail.querySelectorAll('.detail-areas dt')].map(dt => dt.textContent);
    expect(areas).toEqual(expect.arrayContaining(['Difesa', 'Offesa', 'Ruoli']));
    expect(within(detail).getByRole('list', { name: 'Mosse' }).children.length).toBeGreaterThan(0);
  });

  it('cliccare un altro candidato lo apre nel dettaglio', async () => {
    const user = await setup('Great Tusk');
    const second = rowNames()[1];
    const pick = () => within(list()).getByRole('button', { name: new RegExp(`${second}$`) });
    expect(pick()).toHaveAttribute('aria-pressed', 'false');
    await user.click(pick());
    expect(pick()).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${second}` });
    await user.click(within(detail).getByRole('button', { name: 'Aggiungi al team' }));
    expect(within(team()).getByText(second)).toBeInTheDocument();
  });

  it("team vuoto: niente voto da confrontare, si mostra l'uso nel meta", async () => {
    await setup();
    expect(within(suggestions()).getByText('Aggiungi un Pokémon per vedere come si adatta al team — per ora ordinati per uso nel meta')).toBeInTheDocument();
    const usages = within(list()).getAllByLabelText(/^Uso nel meta \d/).map(cell => parseFloat(cell.getAttribute('aria-label')!.replace('Uso nel meta ', '').replace(',', '.')));
    expect(usages).toEqual([...usages].sort((a, b) => b - a));
    const detail = screen.getByRole('complementary', { name: /^Dettaglio di / });
    expect(detail.querySelector('.detail-score')).toHaveTextContent(/uso nel meta$/);
    expect(within(detail).getByText('Voto con lui da solo')).toBeInTheDocument();
    expect(detail.querySelector('.detail-areas .change')!.textContent).toBe('');
  });

  it('mostra i tag sulle righe', async () => {
    await setup('Great Tusk', 'Gholdengo');
    expect(within(list()).getByText('Spesso usati insieme: Great Tusk (25%)')).toBeInTheDocument();
  });

  it('pagine da 10: la seconda continua la numerazione', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'a');
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    expect(rowNames()).toHaveLength(10);
    expect(within(pager).getByRole('button', { name: 'Pagina precedente' })).toBeDisabled();
    await user.click(within(pager).getByRole('button', { name: 'Pagina 2' }));
    expect(within(pager).getByRole('button', { name: 'Pagina 2' })).toHaveAttribute('aria-current', 'page');
    expect(list().querySelector('.rank')!.textContent).toBe('11');
  });

  it('aggiunge un suggerimento al team', async () => {
    const user = await setup('Great Tusk');
    await user.click(within(suggestions()).getAllByRole('button', { name: 'Aggiungi al team' })[0]);
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
  });

  it('team completo: raccomandazioni libere, ognuna dice chi esce', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex');
    // Niente titolo sopra la lista: la modalità scelta lo dice già
    expect(within(suggestions()).queryByRole('heading', { name: 'Migliora il team' })).toBeNull();
    expect(within(suggestions()).getByRole('button', { name: 'Migliora team' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toBeDisabled();
    expect(within(screen.getByRole('group', { name: 'Chi sostituire' })).getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'true');
    // Dal voto più alto; ogni riga dice chi esce, e il pulsante rapido fa lo scambio
    const grades = within(list()).getAllByLabelText(/^Voto del team: /).map(cell => Number(/ (\d+) \(/.exec(cell.getAttribute('aria-label')!)![1]));
    expect(grades.length).toBeGreaterThan(0);
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
    const first = list().querySelector('li')!;
    const out = within(first).getAllByText(/^Al posto di /)[0].textContent!.replace('Al posto di ', '');
    const name = rowNames()[0];
    await user.click(within(first).getByRole('button', { name: `Metti ${name} al posto di ${out}` }));
    expect(within(team()).getByText(name)).toBeInTheDocument();
    expect(within(team()).queryByText(out)).toBeNull();
  });

  it('team completo: scegliere un membro mostra solo i suoi sostituti; Tutti torna agli scambi liberi', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex');
    const targets = () => screen.getByRole('group', { name: 'Chi sostituire' });
    await user.click(within(targets()).getByRole('button', { name: 'Sostituisci Toxapex' }));
    expect(within(targets()).getByRole('button', { name: 'Sostituisci Toxapex' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(list()).queryAllByText(/^Al posto di /)).toHaveLength(0);
    await user.click(within(targets()).getByRole('button', { name: 'Tutti' }));
    expect(within(targets()).getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('team incompleto: da Aggiungi a Migliora team e ritorno', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    const mode = (name: string) => within(suggestions()).getByRole('button', { name });
    expect(mode('Aggiungi')).toHaveAttribute('aria-pressed', 'true');
    await user.click(mode('Migliora team'));
    expect(mode('Migliora team')).toHaveAttribute('aria-pressed', 'true');
    await user.click(mode('Aggiungi'));
    expect(mode('Aggiungi')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sostituzione: modalità, diff e sostituzione del membro', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    await user.click(screen.getByRole('button', { name: 'Sostituisci Great Tusk' }));
    expect(within(suggestions()).getByRole('button', { name: 'Migliora team' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(suggestions()).getAllByText(/\+Pivot/).length).toBeGreaterThan(0);
    expect(within(suggestions()).queryByRole('button', { name: 'Sostituto simile' })).toBeNull();

    await user.click(within(suggestions()).getAllByRole('button', { name: 'Sostituisci con questo' })[0]);
    expect(within(team()).queryByText('Great Tusk')).toBeNull();
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('senza dati: messaggio', () => {
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    expect(within(suggestions()).getByText('Servono i dati Smogon per i suggerimenti. Puoi comunque cercare un Pokémon per nome.')).toBeInTheDocument();
  });
});

describe('dettaglio: abilità in battaglia', () => {
  it('con la Megapietra mostra l\u2019abilità della Mega; "Stats" solo nel dettaglio', async () => {
    const { SuggestionDetail } = await import('../../src/ui/SuggestionDetail');
    const { renderIt } = await import('../helpers/italian');
    const set = { species: 'Venusaur', item: 'Venusaurite', ability: 'Chlorophyll', moves: ['Giga Drain'], nature: 'Bold', evs: { hp: 252 } };
    const item = { species: 'Venusaur-Mega', set, score: 50, components: { defense: 0, coverage: 0, roles: 0 }, facts: {}, reasons: [], tags: [], penalty: 0 } as never;
    renderIt(<SuggestionDetail item={item} rank={2} team={[]} replaceIndex={null} data={fixtureData} format={DEFAULT_FORMAT} rating={null} usage={null} banMark={null} actionLabel="Aggiungi al team" onAction={() => {}} />);
    expect(screen.getByText('Thick Fat')).toBeInTheDocument();
    expect(screen.queryByText('Chlorophyll')).toBeNull();
  });

  it('le righe della lista non hanno il badge Stats', async () => {
    await setup('Great Tusk');
    expect(list().querySelector('.stats-badge')).toBeNull();
    expect(screen.getByRole('complementary', { name: /^Dettaglio di / }).querySelector('.stats-badge')).not.toBeNull();
  });

  it('stall: la Velocità nel dettaglio è grigia, con la nota e senza variazione', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste([
      `Dondozo @ Leftovers
Ability: Unaware
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Body Press
- Liquidation
- Rest
- Sleep Talk`,
      `Blissey @ Leftovers
Ability: Natural Cure
EVs: 4 HP / 252 Def / 252 SpD
Bold Nature
- Protect
- Seismic Toss
- Toxic
- Wish`,
      `Clodsire @ Leftovers
Ability: Unaware
EVs: 252 HP / 4 Def / 252 SpD
Careful Nature
- Amnesia
- Poison Jab
- Recover
- Spikes`,
      `Corviknight @ Leftovers
Ability: Pressure
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Defog
- Iron Defense
- Roost`,
      `Gliscor @ Toxic Orb
Ability: Poison Heal
EVs: 244 HP / 248 Def / 16 Spe
Impish Nature
- Earthquake
- Protect
- Stealth Rock
- Toxic`,
      `Toxapex @ Rocky Helmet
Ability: Regenerator
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Knock Off
- Recover
- Scald
- Toxic Spikes`,
    ].join('\n\n'));
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const speed = screen.getByRole('complementary', { name: /^Dettaglio di / }).querySelector('.detail-areas .inactive')!;
    expect(speed).toHaveTextContent(/^Velocità/);
    expect(speed.querySelector('dt')).toHaveAttribute('aria-description', 'Non conta nello Stall');
    expect(speed.querySelector('.change')).toHaveTextContent(/^$/);
  });
});
