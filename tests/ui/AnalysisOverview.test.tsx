import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

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
  it('riassunti come numeri che aprono la scheda', async () => {
    const user = await setup();
    const stats = within(panel()).getByRole('group', { name: 'Numeri chiave' });
    expect(within(stats).getByRole('button', { name: /^Tipi scoperti in difesa: \d+/ })).toBeInTheDocument();
    expect(within(stats).getByRole('button', { name: /^Ruoli essenziali mancanti: \d+/ })).toBeInTheDocument();
    await user.click(within(stats).getByRole('button', { name: /^Coverage offensiva \d+\/18/ }));
    expect(within(views()).getByRole('tab', { name: 'Offesa' })).toHaveAttribute('aria-selected', 'true');
  });

  it('la nota del meta sta nella Panoramica', async () => {
    await setup();
    expect(within(panel()).getByText(/Col meta del formato \(statistiche 2026-09\)/)).toBeInTheDocument();
  });

  it('problemi a sinistra, soluzioni a destra', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    const problems = within(panel()).getByRole('region', { name: 'Problemi' });
    const solutions = within(panel()).getByRole('region', { name: 'Soluzioni' });
    expect(problems.compareDocumentPosition(solutions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(solutions).queryAllByRole('button', { name: /^Altri sostituti per / }).length).toBeGreaterThan(0);
    expect(within(problems).queryAllByRole('button', { name: /^Altri sostituti per / })).toHaveLength(0);
  });

  it('regole per prime tra i problemi', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    const problems = within(panel()).getByRole('region', { name: 'Problemi' });
    const groups = problems.querySelectorAll('.problem-group');
    expect(groups[0]).toHaveAttribute('aria-label', expect.stringMatching(/Regole/));
  });

  it('bonus e malus stanno nel Coaching, col catalogo apribile', async () => {
    const user = await importTeam('Great Tusk\n- Stealth Rock\n\nGarchomp\n- Stealth Rock');
    const block = within(panel()).getByRole('group', { name: /^Bonus\/Malus −\d+/ });
    expect(block).toHaveTextContent('2 setter di Stealth Rock (−1)');
    await user.click(within(block).getByText('Tutti i bonus e malus'));
    expect(within(block).getByRole('tab', { name: /^Malus/ })).toBeInTheDocument();
  });

  it('il bonus del meteo compare con le altre voci', async () => {
    await importTeam('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    expect(within(panel()).getByRole('group', { name: /^Bonus\/Malus/ })).toHaveTextContent(/\(\+1\)/);
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

  it('membro uno alla volta, con frecce e ritorno', async () => {
    const user = await setup();
    const members = within(panel()).getByRole('region', { name: 'Membri' });
    await user.click(within(members).getByRole('button', { name: /^Great Tusk/ }));
    const profile = within(panel()).getByRole('region', { name: 'Great Tusk' });
    await user.click(within(profile).getByRole('button', { name: 'Successivo: Gholdengo' }));
    expect(within(panel()).getByRole('region', { name: 'Gholdengo' })).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Torna alla Panoramica' }));
    expect(within(panel()).getByRole('region', { name: 'Membri' })).toBeInTheDocument();
  });

  it('membro rimosso: si torna alla Panoramica', async () => {
    const user = await setup();
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getByRole('button', { name: /^Gholdengo/ }));
    expect(within(panel()).getByRole('region', { name: 'Gholdengo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rimuovi Gholdengo' }));
    expect(within(panel()).queryByRole('region', { name: 'Gholdengo' })).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Membri' })).toBeInTheDocument();
  });

  it('team vuoto: invito ad aggiungere Pokémon', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(panel()).getByText(/Aggiungi un Pokémon per vedere/)).toBeInTheDocument();
  });
});

describe('Panoramica: rifinitura', () => {
  it('un posto libero porta a scegliere un Pokémon', async () => {
    const user = await setup();
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getAllByRole('button', { name: 'Posto libero: aggiungi un Pokémon' })[0]);
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('il cambio consigliato ha il pulsante principale con testo', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    const solutions = within(panel()).getByRole('region', { name: 'Soluzioni' });
    const primary = solutions.querySelector<HTMLButtonElement>('button.swap-now.primary');
    expect(primary).not.toBeNull();
    expect(primary!.textContent).toMatch(/Sostituisci/);
  });

  it('giudizio e tipo di team in cima, con lo stile del team leggibile', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    const headline = panel().querySelector<HTMLElement>('.overview-headline')!;
    expect(headline).toHaveTextContent(/Tipo di team/);
    expect(headline.querySelector('.team-type strong')).not.toBeNull();
  });
});

describe('Panoramica: correzioni della revisione', () => {
  it('membro aperto poi tolto: aggiungendo un altro Pokémon si torna alla Panoramica, non al suo profilo', async () => {
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
    const block = within(panel()).getByRole('group', { name: /^Bonus\/Malus/ });
    expect(block.querySelector('ul .mon-ref')).not.toBeNull();
  });
});
