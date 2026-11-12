import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { improveReplacements } from '../../src/engine/replace';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain } from '../../src/engine/teamGain';
import { LangProvider } from '../../src/i18n/react';
import { SuggestionDetail } from '../../src/ui/SuggestionDetail';
import { fixtureData } from '../fixtures/data';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const types = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Tipo di team' });
const pressed = () => [...types().selectedOptions].map(o => o.textContent);
const list = () => suggestions().querySelector<HTMLElement>('.suggestions')!;

const STALL = [
  `Dondozo @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 252 Def / 4 SpD\nImpish Nature\n- Body Press\n- Liquidation\n- Rest\n- Sleep Talk`,
  `Blissey @ Leftovers\nAbility: Natural Cure\nEVs: 4 HP / 252 Def / 252 SpD\nBold Nature\n- Protect\n- Seismic Toss\n- Toxic\n- Wish`,
  `Clodsire @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Amnesia\n- Poison Jab\n- Recover\n- Spikes`,
  `Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 168 Def / 88 SpD\nImpish Nature\n- Body Press\n- Defog\n- Iron Defense\n- Roost`,
  `Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Protect\n- Stealth Rock\n- Toxic`,
  `Toxapex @ Rocky Helmet\nAbility: Regenerator\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Knock Off\n- Recover\n- Scald\n- Toxic Spikes`,
];

async function importTeam(sets: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(sets.join('\n\n'));
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return user;
}

describe('selettore del tipo di team nei suggerimenti', () => {
  it('team completo: Qualunque più i 5 tipi, preselezionato Qualunque', async () => {
    await importTeam(STALL);
    expect([...types().options].map(o => o.textContent))
      .toEqual(['Qualunque', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    expect(pressed()).toEqual(['Qualunque']);
  });

  it('team incompleto: Qualunque', async () => {
    const user = await importTeam(STALL.slice(0, 2));
    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituisci' }));
    expect(pressed()).toEqual(['Qualunque']);
  });

  it('il default resta Qualunque anche quando il team diventa di un tipo riconosciuto', async () => {
    const user = await importTeam(STALL.slice(0, 5));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Toxapex{Enter}');
    expect(pressed()).toEqual(['Qualunque']);
  });

  it('una scelta a mano resta quando il team cambia', async () => {
    const user = await importTeam(STALL.slice(0, 5));
    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituisci' }));
    expect(pressed()).toEqual(['Qualunque']);
    await user.selectOptions(types(), 'Balance');
    await user.click(within(suggestions()).getByRole('button', { name: 'Aggiungi' }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Toxapex{Enter}');
    expect(pressed()).toEqual(['Balance']);
  });

  it('team già stall con Stall scelto: se nessun cambio lo mantiene, un messaggio propone Qualunque', async () => {
    const user = await importTeam(STALL);
    await user.selectOptions(types(), 'Stall');
    // Solo Kyurem fra i candidati: ogni cambio fa uscire il team dallo stall
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kyurem');
    expect(await within(suggestions()).findByText(/Nessuno dei cambi migliori rende il team Stall/)).toBeInTheDocument();
    await user.selectOptions(types(), 'Qualunque');
    expect(within(suggestions()).queryByText(/Nessuno dei cambi migliori rende il team Stall/)).toBeNull();
  });

  it('il dettaglio mostra lo stesso guadagno della lista, e il "prima" è il voto vero della card', async () => {
    const user = await importTeam(STALL);
    await user.selectOptions(types(), 'Stall');
    const card = screen.getByRole('region', { name: 'Team' }).ownerDocument.querySelector('.grade-badge')!.textContent!;
    const row = list().querySelector('li')!;
    const name = row.querySelector('.name-line strong')!.textContent!.replace(/^\d+\. /, '');
    await user.click(within(list()).getAllByRole('button', { name: new RegExp(`${name}$`) }).find(b => b.hasAttribute('aria-pressed'))!);
    const label = within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!;
    const [, after, raw] = /: [SABCD] (\d+) \(([^)]+)\)$/.exec(label)!;
    const gain = raw === '±0' ? 0 : Number(raw.replace('−', '-').replace('+', ''));
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${name}` });
    // Prima e dopo come nella lista; il "prima" è il voto vero, lo stesso della card del voto
    expect(detail.querySelector('.detail-score')!.textContent).toMatch(new RegExp(`[SABCD] ${Number(after) - gain} → [SABCD] ${after}$`));
    expect(card).toContain(String(Number(after) - gain));
  });

  it('nessun messaggio del tipo se la lista è vuota per altri motivi (ricerca senza risultati)', async () => {
    const user = await importTeam(STALL);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Zzzzz');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
    expect(within(suggestions()).queryByText(/rende il team Stall/)).toBeNull();
  });
});

describe('tipo di team in Aggiungi', () => {
  it("la tendina c'è anche in Aggiungi e Stall propone solo Pokémon da stall", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Kingambit']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    const names = () => [...list().querySelectorAll('.name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));
    await waitFor(() => expect(names().length).toBeGreaterThan(0));
    const before = names();
    await user.selectOptions(types(), 'Stall');
    await waitFor(() => expect(names()).not.toEqual(before));
    expect(names().length).toBeGreaterThan(0);
    expect(names()).not.toContain('Dragapult');
  });

  it('la tendina ha la sua etichetta visibile', async () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(types().closest('label')).toHaveTextContent(/^Team/);
  });

  it('Aggiungi: se il tipo esclude tutti, il messaggio parla di costruire il team', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.selectOptions(types(), 'Stall');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Dragapult');
    expect(await within(suggestions()).findByText(/Nessun candidato aiuta a costruire un team Stall/)).toBeInTheDocument();
  });

  it('niente più Sostituto simile', async () => {
    await importTeam(STALL);
    expect(within(suggestions()).queryByRole('button', { name: 'Sostituto simile' })).toBeNull();
  });
});

describe('dettaglio col tipo scelto', () => {
  const s = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
    ({ ...emptySet(species), item, ability, moves, nature, evs });
  const fast = { atk: 252, spe: 252, hp: 4 };
  const team: TeamSet[] = [
    s('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off'], 'Jolly', fast),
    s('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', fast),
    s('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'], 'Jolly', fast),
    s('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
    s('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    s('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', { hp: 252, spd: 252, def: 4 }),
  ];
  const valiant = s('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Close Combat', 'Knock Off', 'Spirit Break', 'Swords Dance'], 'Jolly', fast);

  it('prima e dopo sono il voto vero del team, niente penalità in classifica', () => {
    const [item] = rankByTeamGain(improveReplacements(team, 2, DEFAULT_FORMAT, fixtureData, 5, [valiant], 'it'), team, 2, fixtureData, 'it', true);
    const before = rateTeam(team, fixtureData)!;
    const after = rateTeam(team.map((m, i) => (i === 2 ? item.set : m)), fixtureData)!;
    render(
      <LangProvider lang="it">
        <SuggestionDetail item={item} rank={1} team={team} replaceIndex={2} data={fixtureData} format={DEFAULT_FORMAT}
          rating={before} archetype="balance" usage={null} banMark={null} actionLabel="Metti" onAction={() => {}} />
      </LangProvider>,
    );
    expect(document.querySelector('.detail-score')!.textContent).toMatch(new RegExp(`${before.overall} → [SABCD] ${after.overall}$`));
    expect(screen.queryByText(/in classifica/)).toBeNull();
  });
});
