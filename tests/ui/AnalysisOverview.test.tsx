import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { CoachProblem } from '../../src/engine/coach';
import type { SummaryTile } from '../../src/engine/overviewSummary';
import { OverviewSummary } from '../../src/ui/OverviewSummary';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const panel = () => document.getElementById('panel-analysis')!;
const views = () => within(panel()).getByRole('tablist', { name: 'Sezioni dell\'Analisi' });

async function setup(names: string[] = ['Great Tusk', 'Gholdengo']) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  return user;
}

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  return user;
}

describe('Panoramica di Analisi', () => {
  it('sei tessere: ognuna è un pulsante col numero e la didascalia', async () => {
    await setup();
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    const names = within(summary).getAllByRole('button').filter(b => b.classList.contains('summary-tile')).map(b => b.getAttribute('aria-label'));
    expect(names).toHaveLength(6);
    expect(names[0]).toMatch(/^Difesa: \d+\/18 tipi coperti$/);
    expect(names[1]).toMatch(/^Offesa: \d+\/18 super efficace$/);
    expect(names[2]).toMatch(/^Ruoli: \d+\/\d+ coperti$/);
    expect(names[3]).toMatch(/^Velocità: \d\/2 più veloci della media del meta$/);
    expect(names[4]).toMatch(/^Meta: \d+\/\d+ minacce gestite$/);
    expect(names[5]).toMatch(/^Bonus\/Malus: \S+ netto$/);
  });

  it('una tessera apre la sua linguetta', async () => {
    const user = await setup();
    await user.click(within(panel()).getByRole('button', { name: /^Offesa: / }));
    expect(within(views()).getByRole('tab', { name: 'Offesa' })).toHaveAttribute('aria-selected', 'true');
  });

  it('la tessera Meta apre la scheda Meta', async () => {
    const user = await setup();
    await user.click(within(panel()).getByRole('button', { name: /^Meta: / }));
    expect(screen.getByRole('tab', { name: /^Meta/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('la striscia porta al Coaching', async () => {
    const user = await setup(['Great Tusk', 'Dragapult']);
    expect(panel().querySelector('.summary-strip')).toHaveTextContent(/\d+ grav[ei]|\d+ minor[ei]/);
    await user.click(within(panel()).getByRole('button', { name: /^Vai al Coaching/ }));
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
  });

  it('un tipo scoperto compare nella tessera Difesa', async () => {
    await setup(['Great Tusk']);
    const tile = within(panel()).getByRole('button', { name: /^Difesa: / });
    expect(tile.querySelector('.summary-miss .type-name')).not.toBeNull();
    expect(tile).toHaveTextContent(/Acqua|Water/); // nomi italiani dei tipi non caricati nei test
  });

  it('Velocità: un punto per membro, tooltip al passaggio e descrizione per la tastiera', async () => {
    const user = await setup();
    const tile = within(panel()).getByRole('button', { name: /^Velocità: / });
    const dots = tile.querySelectorAll<HTMLElement>('.tsl-dot');
    expect(dots).toHaveLength(2);
    expect(within(tile).queryByRole('tooltip')).toBeNull();
    await user.hover(dots[0]);
    expect(within(tile).getByRole('tooltip')).toHaveTextContent(/^(Great Tusk|Gholdengo): Velocità \d+, supera il \d+% del meta$/);
    await user.unhover(dots[0]);
    await user.hover(tile.querySelector<HTMLElement>('.tsl-mid')!);
    expect(within(tile).getByRole('tooltip')).toHaveTextContent(/^Media del meta: \d+$/);
    expect(tile).toHaveAccessibleDescription(/supera il \d+% del meta/);
  });

  it('meta spento: la tessera Meta non è disponibile', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, ignoreMeta: true }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const tile = within(panel()).getByRole('button', { name: 'Meta: Statistiche non disponibili' });
    expect(tile).toBeDisabled();
  });

  it('niente più numeri chiave, colonne Problemi/Soluzioni o blocco Bonus/Malus', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    expect(within(panel()).queryByRole('group', { name: 'Numeri chiave' })).toBeNull();
    expect(within(panel()).queryByRole('group', { name: /^Bonus\/Malus/ })).toBeNull();
    expect(panel().querySelector('.problem-group')).toBeNull();
  });

  it('la nota del meta sta nella Panoramica', async () => {
    await setup();
    expect(within(panel()).getByText(/Col meta del formato \(statistiche 2026-09\)/)).toBeInTheDocument();
  });

  it('regole per prime tra i problemi del Coaching', async () => {
    const user = await setup(['Great Tusk', 'Dragapult']);
    await user.click(within(views()).getByRole('tab', { name: 'Coaching' }));
    const groups = panel().querySelectorAll('.problem-group');
    expect(groups[0]).toHaveAttribute('aria-label', expect.stringMatching(/Regole/));
  });

  it('bonus e malus: netto e voci principali nella tessera', async () => {
    await importTeam('Great Tusk\n- Stealth Rock\n\nGarchomp\n- Stealth Rock');
    const tile = within(panel()).getByRole('button', { name: /^Bonus\/Malus: −\d+ netto$/ });
    expect(tile.querySelector('.summary-items .loss')).toHaveTextContent(/^−\d+ \S/);
  });

  it('il bonus del meteo compare con le altre voci', async () => {
    await importTeam('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    expect(within(panel()).getByRole('button', { name: /^Bonus\/Malus: / })).toHaveTextContent(/\+1/);
  });

  it('team stall: la nota "valutato come stall"', async () => {
    await importTeam([
      'Dondozo @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 252 Def / 4 SpD\nImpish Nature\n- Body Press\n- Liquidation\n- Rest\n- Sleep Talk',
      'Blissey @ Leftovers\nAbility: Natural Cure\nEVs: 4 HP / 252 Def / 252 SpD\nBold Nature\n- Protect\n- Seismic Toss\n- Toxic\n- Wish',
      'Clodsire @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Amnesia\n- Poison Jab\n- Recover\n- Spikes',
      'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 168 Def / 88 SpD\nImpish Nature\n- Body Press\n- Defog\n- Iron Defense\n- Roost',
      'Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Protect\n- Stealth Rock\n- Toxic',
      'Toxapex @ Rocky Helmet\nAbility: Regenerator\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Knock Off\n- Recover\n- Scald\n- Toxic Spikes',
    ].join('\n\n'));
    expect(within(panel()).getByText(/Valutato come stall/)).toBeInTheDocument();
  });

  // Riga Membri messa da parte: il test torna quando trova posto
  it.skip('membro uno alla volta, con frecce e ritorno', async () => {
    const user = await setup();
    const members = within(panel()).getByRole('region', { name: 'Membri' });
    await user.click(within(members).getByRole('button', { name: /^Great Tusk/ }));
    const profile = within(panel()).getByRole('region', { name: 'Great Tusk' });
    await user.click(within(profile).getByRole('button', { name: 'Successivo: Gholdengo' }));
    expect(within(panel()).getByRole('region', { name: 'Gholdengo' })).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Torna alla Panoramica' }));
    expect(within(panel()).getByRole('region', { name: 'Membri' })).toBeInTheDocument();
  });

  // Riga Membri messa da parte: il test torna quando trova posto
  it.skip('membro rimosso: si torna alla Panoramica', async () => {
    const user = await setup();
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getByRole('button', { name: /^Gholdengo/ }));
    expect(within(panel()).getByRole('region', { name: 'Gholdengo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rimuovi Gholdengo' }));
    expect(within(panel()).queryByRole('region', { name: 'Gholdengo' })).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Membri' })).toBeInTheDocument();
  });

  it('niente riga Membri nella Panoramica', async () => {
    await setup();
    expect(within(panel()).queryByRole('region', { name: 'Membri' })).toBeNull();
  });

  it('team vuoto: invito ad aggiungere Pokémon', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(panel()).getByText(/Aggiungi un Pokémon per vedere/)).toBeInTheDocument();
  });
});

describe('Panoramica: rifinitura', () => {
  // Riga Membri messa da parte: il test torna quando trova posto
  it.skip('un posto libero porta a scegliere un Pokémon', async () => {
    const user = await setup();
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getAllByRole('button', { name: 'Posto libero: aggiungi un Pokémon' })[0]);
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('giudizio e tipo di team in cima, con lo stile del team leggibile', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    const headline = panel().querySelector<HTMLElement>('.overview-headline')!;
    expect(headline).toHaveTextContent(/Tipo di team/);
    expect(headline.querySelector('.team-type strong')).not.toBeNull();
  });
});

describe('Panoramica: correzioni della revisione', () => {
  // Riga Membri messa da parte: il test torna quando trova posto
  it.skip('membro aperto poi tolto: aggiungendo un altro Pokémon si torna alla Panoramica, non al suo profilo', async () => {
    const user = await setup();
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getByRole('button', { name: /^Gholdengo/ }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Gholdengo' }));
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kingambit{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(panel()).queryByRole('region', { name: 'Kingambit' })).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Membri' })).toBeInTheDocument();
  });

  it('team vuoto: le schede d\'area non si aprono a vuoto e poi non saltano', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const defense = within(views()).getByRole('tab', { name: 'Difesa' });
    expect(defense).toHaveAttribute('aria-disabled', 'true');
    await user.click(defense);
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('le voci di bonus e malus mantengono nomi e tipi evidenziati', async () => {
    await importTeam('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    const tile = within(panel()).getByRole('button', { name: /^Bonus\/Malus: / });
    expect(tile.querySelector('.summary-items .mon-ref')).not.toBeNull();
  });
});

describe('Riassunto: striscia e righe positive', () => {
  const tile = (key: SummaryTile['key'], value: string, missing: SummaryTile['missing'] = []): SummaryTile => ({ key, status: 'good', value, missing });
  const tiles: SummaryTile[] = [
    tile('defense', '18/18'), tile('strength', '18/18'), tile('roles', '5/5'),
    { ...tile('speed', '0/0'), speed: { points: [], median: null, control: [] } },
    tile('meta', '9/9'), { ...tile('bonusMalus', '±0'), items: [] },
  ];

  it('senza problemi una riga verde; nulla manca: "Tutti coperti" e "Tutte gestite"', () => {
    renderIt(<OverviewSummary tiles={tiles} problems={[]} onView={() => {}} />);
    expect(screen.getByText('Nessun problema da sistemare')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Vai al Coaching/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Difesa: / })).toHaveTextContent('Tutti coperti');
    expect(screen.getByRole('button', { name: /^Meta: / })).toHaveTextContent('Tutte gestite');
  });

  it('con problemi: conteggi e testo del primo grave', () => {
    const problems: CoachProblem[] = [
      { severity: 'minor', category: 'coverage', text: 'Problema minore', fixes: [], key: 'a' },
      { severity: 'serious', category: 'roles', text: 'Nessuno rimuove gli hazard', fixes: [], key: 'b' },
    ];
    renderIt(<OverviewSummary tiles={tiles} problems={problems} onView={() => {}} />);
    const strip = document.querySelector<HTMLElement>('.summary-strip')!;
    expect(strip).toHaveTextContent('1 grave');
    expect(strip).toHaveTextContent('1 minore');
    expect(strip).toHaveTextContent('Nessuno rimuove gli hazard');
  });

  it('ruoli mancanti e controllo della velocità', () => {
    const custom = tiles.map(t => t.key === 'roles' ? tile('roles', '3/5', [{ kind: 'role', need: 'removal' }])
      : t.key === 'speed' ? { ...t, speed: { points: [], median: 300, control: ['Trick Room'] } } : t);
    renderIt(<OverviewSummary tiles={custom} problems={[]} onView={() => {}} />);
    expect(screen.getByRole('button', { name: /^Ruoli: / })).toHaveTextContent(/Rimozione/);
    expect(screen.getByRole('button', { name: /^Velocità: / })).toHaveTextContent(/Controllo:\s*Trick Room/);
  });
});
