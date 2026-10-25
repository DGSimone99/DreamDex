import { render, screen, within } from '@testing-library/react';
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
const types = () => screen.getByRole('group', { name: 'Tipo di team' });
const pressed = () => within(types()).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent);
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
  it('team completo: Nessuno più i 5 tipi, preselezionato quello riconosciuto', async () => {
    await importTeam(STALL);
    expect(within(types()).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Nessuno', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    expect(pressed()).toEqual(['Stall']);
  });

  it('team incompleto: Nessuno', async () => {
    const user = await importTeam(STALL.slice(0, 2));
    await user.click(within(suggestions()).getByRole('button', { name: 'Migliora team' }));
    expect(pressed()).toEqual(['Nessuno']);
  });

  it('il default segue il tipo riconosciuto', async () => {
    const user = await importTeam(STALL.slice(0, 5));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Toxapex{Enter}');
    expect(pressed()).toEqual(['Stall']);
  });

  it('una scelta a mano resta quando il team cambia', async () => {
    const user = await importTeam(STALL.slice(0, 5));
    await user.click(within(suggestions()).getByRole('button', { name: 'Migliora team' }));
    expect(pressed()).toEqual(['Nessuno']);
    await user.click(within(types()).getByRole('button', { name: 'Balance' }));
    await user.click(within(suggestions()).getByRole('button', { name: 'Aggiungi' }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Toxapex{Enter}');
    expect(pressed()).toEqual(['Balance']);
  });

  it('team già stall con Stall scelto: se nessun cambio lo mantiene, un messaggio propone Nessuno', async () => {
    const user = await importTeam(STALL);
    // Solo Kyurem fra i candidati: ogni cambio fa uscire il team dallo stall
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kyurem');
    expect(await within(suggestions()).findByText(/Nessun cambio mantiene il team Stall/)).toBeInTheDocument();
    await user.click(within(types()).getByRole('button', { name: 'Nessuno' }));
    expect(within(suggestions()).queryByText(/Nessun cambio mantiene il team Stall/)).toBeNull();
  });

  it('il dettaglio mostra lo stesso guadagno della lista', async () => {
    await importTeam(STALL);
    const first = list().querySelector('li')!;
    const label = within(first).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!;
    const listOverall = /: [SABCD] (\d+) /.exec(label)![1];
    const detail = screen.getByRole('complementary', { name: /^Dettaglio di / });
    expect(detail.querySelector('.detail-score')!.textContent).toMatch(new RegExp(`→ [SABCD] ${listOverall}$`));
  });
});

describe('dettaglio: ruolo perso che fa scendere in classifica', () => {
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

  it('mostra la voce persa e i punti in classifica', () => {
    const [item] = rankByTeamGain(improveReplacements(team, 2, DEFAULT_FORMAT, fixtureData, 5, [valiant], 'it'), team, 2, fixtureData, 'it', true, 'balance');
    expect(item.teamGain?.penalty).toBeGreaterThan(0);
    render(
      <LangProvider lang="it">
        <SuggestionDetail item={item} rank={1} team={team} replaceIndex={2} data={fixtureData} format={DEFAULT_FORMAT}
          rating={rateTeam(team, fixtureData)} archetype="balance" usage={null} banMark={null} actionLabel="Metti" onAction={() => {}} />
      </LangProvider>,
    );
    expect(screen.getByText(/Perde Hazard: −2 in classifica/)).toBeInTheDocument();
  });
});
