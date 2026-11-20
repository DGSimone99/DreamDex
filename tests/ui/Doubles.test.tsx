import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { BonusMalusView, CatalogueList } from '../../src/ui/BonusMalusView';
import { DefenseGuideSection } from '../../src/ui/defense/DefenseGuide';
import { FillPanel } from '../../src/ui/FillPanel';
import { OffenseGuide } from '../../src/ui/offense/OffenseGuide';
import { RatingHelp } from '../../src/ui/RatingHelp';
import { RolesGeneral } from '../../src/ui/roles/RolesGeneral';
import { RolesGuideSection } from '../../src/ui/roles/RolesGuide';
import { SpeedGuideSection } from '../../src/ui/speed/SpeedGuide';
import { t } from '../../src/i18n';
import { fixtureData } from '../fixtures/data';
import { fillData } from '../fixtures/fillData';
import { chooseBattle } from '../helpers/format';
import { renderIt } from '../helpers/italian';

vi.setConfig({ testTimeout: 60000 });

const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Adamant', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const special = { spa: 252, spe: 252, spd: 4 };

// Lo stesso team di doublesRoles.test.ts: copre le nove voci del doppio
const full: TeamSet[] = [
  mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'], 'Adamant', { hp: 252, atk: 252, spd: 4 }),
  mk('Amoonguss', 'Rocky Helmet', 'Regenerator', ['Rage Powder', 'Spore', 'Pollen Puff', 'Protect'], 'Bold', bulky),
  mk('Landorus-Therian', 'Life Orb', 'Intimidate', ['Earthquake', 'Rock Slide', 'Stealth Rock', 'Protect'], 'Jolly'),
  mk('Kingambit', 'Black Glasses', 'Defiant', ['Sucker Punch', 'Kowtow Cleave', 'Iron Head', 'Swords Dance']),
  mk('Flutter Mane', 'Choice Specs', 'Protosynthesis', ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Mystical Fire'], 'Timid', special),
  mk('Cresselia', 'Leftovers', 'Levitate', ['Psychic', 'Moonlight', 'Helping Hand', 'Icy Wind'], 'Bold', bulky),
];
const oneProtect = full.map(set => (set.species === 'Landorus-Therian' ? { ...set, moves: ['Earthquake', 'Rock Slide', 'Stealth Rock', 'U-turn'] } : set));

const doublesData: EngineData = { ...fixtureData, formatId: 'natdexdoubles' };
const ouData: EngineData = { ...fixtureData, formatId: 'ou' };
const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) => t('it', key, params);
const texts = (nodes: Iterable<Element>) => [...nodes].map(n => n.textContent?.trim());

describe('doppio: la guida "Come funziona il voto"', () => {
  const open = (teamType: 'doubles' | 'balance', data: EngineData) => {
    const rating = rateTeam(full, data, 'it')!;
    renderIt(<RatingHelp teamType={teamType} weights={rating.weightTable} typeRule={rating.needs.rules.typeRule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Come funziona il voto' }));
    return screen.getByRole('dialog');
  };

  it('in doppio gli argomenti sono due: Come funziona e Doppio; la tabella dei pesi ha una riga sola', () => {
    const dialog = open('doubles', doublesData);
    expect(within(dialog).getAllByRole('tab').map(tab => tab.firstChild?.textContent)).toEqual(['Come funziona', 'Doppio']);
    const rows = within(dialog).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('Doppio');
    // Le tre aree pesano uguale: tre barre della stessa lunghezza, e la stessa parola per i lettori di schermo
    const bars = [...rows[0].querySelectorAll<HTMLElement>('.help-wbar i')].map(bar => bar.style.width);
    expect(new Set(bars).size).toBe(1);
    expect(texts(rows[0].querySelectorAll('.help-wbar .visually-hidden'))).toEqual(['abbastanza', 'abbastanza', 'abbastanza']);
    expect(dialog).not.toHaveTextContent('Hyper Offense');
    // La frase sui tipi di team del singolo non c'è
    expect(dialog).not.toHaveTextContent(tr('help.general.2'));
    expect(dialog).toHaveTextContent(tr('help.general.2.doubles'));
  });

  it("l'argomento Doppio elenca le nove voci per livello", () => {
    const dialog = open('doubles', doublesData);
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Doppio/ }));
    const lists = [...dialog.querySelectorAll('.help-points')].map(list => texts(list.querySelectorAll('li')));
    expect(lists).toEqual([
      ['Attaccante', 'Protect (2 membri)'],
      ['Muro', 'Mossa a più bersagli', 'Fake Out'],
      ['Redirector', 'Hazard', 'Pivot', 'Priorità (2 membri)'],
    ]);
  });

  it('in singolo gli argomenti restano i cinque tipi, senza Doppio', () => {
    const dialog = open('balance', ouData);
    expect(within(dialog).getAllByRole('tab').map(tab => tab.firstChild?.textContent)).toEqual(['Come funziona', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    expect(within(dialog).getAllByRole('row').slice(1)).toHaveLength(5);
    expect(dialog).toHaveTextContent(tr('help.general.2'));
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Balance/ }));
    expect(dialog).not.toHaveTextContent('Protect (2 membri)');
    expect(dialog).not.toHaveTextContent('Mossa a più bersagli');
  });
});

describe('doppio: la scheda e la guida dei Ruoli', () => {
  const general = (team: TeamSet[], data: EngineData) => {
    const rating = rateTeam(team, data, 'it')!;
    return renderIt(<RolesGeneral rating={rating} ctx={{ team, analysis: analyzeTeam(team, data) }} />).container;
  };

  it('le nove voci nelle tre fasce, sotto il nome Doppio', () => {
    const view = general(full, doublesData);
    expect(view.querySelector('.rl-type')).toHaveTextContent('Doppio');
    expect(texts(view.querySelectorAll('.rl-name')).sort()).toEqual(
      ['Attaccante', 'Protect (2 membri)', 'Muro', 'Mossa a più bersagli', 'Fake Out', 'Redirector', 'Hazard', 'Pivot', 'Priorità (2 membri)'].sort());
    expect(view.querySelectorAll('.rl-row.bad, .rl-row.warn')).toHaveLength(0);
  });

  it('con un solo Protect la voce manca (−4) e mostra chi ce l\'ha, non "Nessuno"', () => {
    const view = general(oneProtect, doublesData);
    const row = [...view.querySelectorAll<HTMLElement>('.rl-row')].find(r => r.querySelector('.rl-name')?.textContent === 'Protect (2 membri)')!;
    expect(row).toHaveClass('bad');
    expect(row.querySelector('.rl-pts')).toHaveTextContent('−4');
    expect(row.querySelector('.rl-by')).toHaveTextContent('Amoonguss');
    expect(row.querySelector('.rl-by')).not.toHaveTextContent('Nessuno');
    expect(row).toHaveAttribute('title', tr('rdetail.needTwo', { name: 'Amoonguss' }));
  });

  it('in singolo "2° Attaccante" con un solo attaccante dice ancora "Nessuno" (la riga col membro solo è del doppio)', () => {
    const bulkyEvs = { hp: 248, def: 252, spd: 8 };
    const stall: TeamSet[] = [
      mk('Chansey', 'Eviolite', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Stealth Rock'], 'Bold', bulkyEvs),
      mk('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', bulkyEvs),
      mk('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', bulkyEvs),
      mk('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', bulkyEvs),
      mk('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulkyEvs),
      mk('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head']),
    ];
    const rating = rateTeam(stall, ouData, 'it', { archetype: 'stall' })!;
    const second = rating.roles.rows.find(r => r.key === 'secondAttacker')!;
    expect(second.by.filter(b => b.value >= 0.5).map(b => b.species)).toEqual(['Kingambit']);
    const view = renderIt(<RolesGeneral rating={rating} ctx={{ team: stall, analysis: analyzeTeam(stall, ouData) }} />).container;
    const row = [...view.querySelectorAll<HTMLElement>('.rl-row')].find(r => r.querySelector('.rl-name')?.textContent === '2° Attaccante')!;
    expect(row.querySelector('.rl-by')).toHaveTextContent('Nessuno');
    expect(row.getAttribute('title') ?? '').not.toContain('Ne servono due');
  });

  it('in singolo la scheda non ha nessuna voce del doppio', () => {
    const view = general(full, ouData);
    for (const name of ['Protect (2 membri)', 'Mossa a più bersagli', 'Fake Out', 'Redirector', 'Priorità (2 membri)', 'Muro']) {
      expect(texts(view.querySelectorAll('.rl-name'))).not.toContain(name);
    }
  });

  it('la tabella della guida in doppio ha una colonna sola e solo le voci del doppio', () => {
    const { container } = renderIt(<RolesGuideSection section="types" archetype="doubles" typeRule="oneType" />);
    expect(texts(container.querySelectorAll('thead th')).slice(1)).toEqual(['Doppio']);
    const names = texts(container.querySelectorAll('tbody tr:not(.rl-fam) th'));
    expect(names.sort()).toEqual(['Attaccante', 'Protect (2 membri)', 'Muro', 'Mossa a più bersagli', 'Fake Out', 'Redirector', 'Hazard', 'Pivot', 'Priorità (2 membri)'].sort());
    expect(container).not.toHaveTextContent('Controllo Hazard');
    expect(container).not.toHaveTextContent('Recupero');
    // Niente riga "Non contano in nessun tipo di team"
    expect(container.querySelector('.guide-foot')).toBeNull();
    // Come funziona: il tipo è Doppio
    const how = renderIt(<RolesGuideSection section="general" archetype="doubles" typeRule="oneType" />).container;
    expect(how).toHaveTextContent('Doppio');
  });

  it('la tabella della guida in singolo è quella di prima: cinque colonne, nessuna voce del doppio', () => {
    const { container } = renderIt(<RolesGuideSection section="types" archetype="balance" typeRule="recoverySpeed" />);
    expect(texts(container.querySelectorAll('thead th')).slice(1)).toEqual(['HO', 'BO', 'Balance', 'Semi-stall', 'Stall']);
    for (const name of ['Protect (2 membri)', 'Mossa a più bersagli', 'Fake Out', 'Redirector', 'Priorità (2 membri)']) expect(container).not.toHaveTextContent(name);
    expect(container.querySelector('.guide-foot')).not.toBeNull();
  });
});

describe('doppio: Bonus/Malus', () => {
  it('il catalogo in doppio ha "Meteo contro" e non "Clima sfruttato"; in singolo il contrario', () => {
    const malus = renderIt(<CatalogueList lang="it" kind="malus" rules={DOUBLES_RULES} />).container;
    expect(malus).toHaveTextContent('Meteo contro');
    const bonus = renderIt(<CatalogueList lang="it" kind="bonus" rules={DOUBLES_RULES} />).container;
    expect(bonus).not.toHaveTextContent('Clima sfruttato');
    expect(renderIt(<CatalogueList lang="it" kind="malus" rules={NATDEX_OU_RULES} />).container).not.toHaveTextContent('Meteo contro');
    expect(renderIt(<CatalogueList lang="it" kind="bonus" rules={NATDEX_OU_RULES} />).container).toHaveTextContent('Clima sfruttato');
    expect(renderIt(<CatalogueList lang="it" kind="malus" />).container).not.toHaveTextContent('Meteo contro');
  });

  it('la scheda mostra il sabotaggio del meteo di un team di doppio', () => {
    const team = [
      mk('Torkoal', 'Charcoal', 'Drought', ['Eruption', 'Earth Power', 'Protect'], 'Quiet', { hp: 252, spa: 252, spd: 4 }),
      mk('Basculegion', 'Choice Scarf', 'Adaptability', ['Wave Crash', 'Last Respects', 'Aqua Jet']),
      ...full.slice(2),
    ];
    const rating = rateTeam(team, doublesData, 'it')!;
    expect(rating.penalty.items.some(i => i.catalog === 'weatherSabotage')).toBe(true);
    const { container } = renderIt(<BonusMalusView rating={rating} lang="it" t={tr as never} />);
    expect(container).toHaveTextContent('Meteo contro');
  });
});

describe('doppio: le guide di Velocità, Offesa e Difesa', () => {
  it('Tailwind sta con Trick Room fra i controlli lunghi in doppio, fra i brevi in singolo', async () => {
    const order = async (doubles: boolean) => {
      const rating = rateTeam(full, doubles ? doublesData : ouData, 'it')!;
      const { container, unmount } = renderIt(<SpeedGuideSection speed={rating.speed} meta doubles={doubles} />);
      fireEvent.mouseEnter(within(container).getByRole('button', { name: 'Controllo del team' }));
      await waitFor(() => expect(document.querySelector('.ftip.gat')).not.toBeNull());
      const text = document.querySelector('.ftip.gat')!.textContent ?? '';
      const result = { tailwind: text.indexOf('Tailwind'), short: text.indexOf('Brevi'), room: text.indexOf('Trick Room') };
      unmount();
      return result;
    };
    const doubles = await order(true);
    expect(doubles.room).toBeGreaterThan(-1);
    expect(doubles.tailwind).toBeGreaterThan(doubles.room);
    expect(doubles.tailwind).toBeLessThan(doubles.short);
    const singles = await order(false);
    expect(singles.tailwind).toBeGreaterThan(singles.short);
  });

  it("la guida dell'Offesa e della Difesa in doppio dice che una mossa a più bersagli fa meno danno, senza numeri", () => {
    const rating = rateTeam(full, doublesData, 'it')!;
    const line = tr('guide.off.doubles.spread');
    expect(line).not.toMatch(/\d/);
    expect(renderIt(<OffenseGuide offense={rating.offense} formatId="natdexdoubles" />).container).toHaveTextContent(line);
    expect(renderIt(<DefenseGuideSection section="general" defense={rating.defense} meta formatId="natdexdoubles" />).container).toHaveTextContent(line);
    const ou = rateTeam(full, ouData, 'it')!;
    expect(renderIt(<OffenseGuide offense={ou.offense} formatId="ou" />).container).not.toHaveTextContent(line);
    expect(renderIt(<DefenseGuideSection section="general" defense={ou.defense} meta formatId="ou" />).container).not.toHaveTextContent(line);
  });
});

describe('doppio: Completa team', () => {
  const panel = (formatId: 'natdexdoubles' | 'ou') =>
    renderIt(<FillPanel team={full.slice(0, 3)} format={{ ...DEFAULT_FORMAT, formatId }} data={{ ...fillData, formatId }} onApply={vi.fn()} onClose={vi.fn()} onLoadTeam={vi.fn()} />);

  it('in doppio non c\'è la scelta del tipo di team; la condizione resta', () => {
    panel('natdexdoubles');
    expect(screen.queryByRole('radiogroup', { name: 'Tipo di team' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Hyper Offense' })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Condizione' })).toBeInTheDocument();
  });

  it('in singolo la scelta del tipo c\'è come prima', () => {
    panel('ou');
    expect(within(screen.getByRole('radiogroup', { name: 'Tipo di team' })).getAllByRole('radio')).toHaveLength(6);
  });
});

describe("doppio: nell'app", () => {
  const TEAM = [
    'Incineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n- Fake Out\n- Flare Blitz\n- Knock Off\n- Parting Shot',
    'Amoonguss @ Rocky Helmet\nAbility: Regenerator\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Rage Powder\n- Spore\n- Pollen Puff\n- Protect',
    'Landorus-Therian @ Life Orb\nAbility: Intimidate\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Rock Slide\n- Stealth Rock\n- Protect',
  ].join('\n\n');

  async function start(doubles: boolean) {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    if (doubles) await chooseBattle(user, 'doubles');
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste(TEAM);
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    return user;
  }

  it('in doppio la carta del voto dice Doppio (anche a team incompleto), niente finestra dei tipi né scelta del tipo fra i candidati', async () => {
    await start(true);
    const band = document.querySelector<HTMLElement>('.band')!;
    expect(band).toHaveTextContent('Doppio');
    expect(band).not.toHaveTextContent('Incompleto');
    expect(screen.queryByRole('button', { name: 'Tipi di team: come si riconoscono' })).toBeNull();
    expect(screen.queryByLabelText('Tipo di team')).toBeNull();
  });

  it('in singolo la stessa schermata è quella di prima: Incompleto, la scelta del tipo fra i candidati', async () => {
    await start(false);
    const band = document.querySelector<HTMLElement>('.band')!;
    expect(band).toHaveTextContent('Incompleto');
    expect(band).not.toHaveTextContent('Doppio');
    expect(screen.getByLabelText('Tipo di team')).toBeInTheDocument();
  });
});
