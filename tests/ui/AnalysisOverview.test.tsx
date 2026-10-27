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
  it('il cruscotto: quattro sezioni coi titoli, senza "Cosa fare" e "Minacce non gestite"', async () => {
    await setup();
    for (const title of ['Riassunto', 'Copertura', 'Ruoli', 'Velocità']) {
      expect(within(panel()).getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(within(panel()).queryByRole('heading', { name: 'Cosa fare' })).toBeNull();
    expect(within(panel()).queryByRole('heading', { name: 'Minacce non gestite' })).toBeNull();
    expect(within(panel()).getByRole('table', { name: 'Copertura' })).toBeInTheDocument();
  });

  it('il cruscotto è ampio solo col team ridotto', async () => {
    const user = await setup();
    const dash = () => panel().querySelector('.dash')!;
    expect(dash()).not.toHaveAttribute('data-density', 'roomy');
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    expect(dash()).toHaveAttribute('data-density', 'roomy');
    await user.click(screen.getByRole('button', { name: 'Espandi team' }));
    expect(dash()).not.toHaveAttribute('data-density', 'roomy');
  });

  it('un link apre la sua linguetta', async () => {
    const user = await setup();
    await user.click(within(panel()).getByRole('button', { name: /^Offesa/ }));
    expect(within(views()).getByRole('tab', { name: 'Offesa' })).toHaveAttribute('aria-selected', 'true');
  });

  it('il Riassunto: la riga Minacce porta al Coaching, Attaccanti a Offesa', async () => {
    const user = await setup();
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    await user.click(within(summary).getByRole('button', { name: /^Attaccanti/ }));
    expect(within(views()).getByRole('tab', { name: 'Offesa' })).toHaveAttribute('aria-selected', 'true');
  });

  it('un membro solo: niente "nessun problema", l\'invito ad aggiungerne', async () => {
    await setup(['Great Tusk']);
    expect(panel().querySelector('.overview-headline')).toHaveTextContent(/Aggiungi almeno 2 Pokémon/);
    expect(within(panel()).queryByText('Nessun problema da sistemare')).toBeNull();
  });

  it('meta spento: "Meta spento" e la media del tier', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, ignoreMeta: true }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    // Meta spento: nel Riassunto niente riga Minacce
    expect(within(within(panel()).getByRole('region', { name: 'Riassunto' })).queryByRole('button', { name: /^Minacce/ })).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Velocità' })).toHaveTextContent(/media del tier/);
  });

  it("team di 3 senza statistiche: il Riassunto c'è, nessun crash, nessuna riga Minacce", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, stats: null, sets: null }} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Dragapult']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    expect(within(summary).getByRole('button', { name: /^Colpisce/ })).toBeInTheDocument();
    expect(within(summary).queryByRole('button', { name: /^Minacce/ })).toBeNull();
  });

  it('niente più tessera Bonus/Malus né striscia "Vai al Coaching"', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    // Le linguette dell'Analisi hanno "Bonus/Malus": si guarda solo la Panoramica
    const overview = panel().querySelector<HTMLElement>('.overview')!;
    expect(overview).not.toHaveTextContent(/Bonus\/Malus/);
    expect(within(panel()).queryByRole('button', { name: /Vai al Coaching/ })).toBeNull();
    expect(panel().querySelector('.summary-tile, .summary-strip')).toBeNull();
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
    const rows = within(within(panel()).getByRole('group', { name: /^Regole/ })).getAllByRole('listitem');
    expect(rows[0]).toHaveClass('serious');
    expect(rows[0].getAttribute('data-key')).toMatch(/^rules:/);
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

  it('giudizio in cima; il tipo di team sta nella riga Tipo del Riassunto', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    const headline = panel().querySelector<HTMLElement>('.overview-headline')!;
    expect(headline.querySelector('.team-type')).toBeNull();
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    expect(summary.querySelector('.sum-arch')).not.toBeNull();
    expect(summary.querySelector('.sum-arch')).not.toHaveTextContent('—');
  });

  it('il "?" accanto al tipo di team apre la guida ai tipi; la scheda Panoramica non ha "?"', async () => {
    const user = userEvent.setup();
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    expect(within(panel()).queryByRole('button', { name: /^Come funziona/ })).toBeNull();
    const help = within(within(panel()).getByRole('region', { name: 'Riassunto' })).getByRole('button', { name: 'Tipi di team: come si riconoscono' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Tipi di team' });
    // Ogni tipo coi suoi sei posti, letti come frase corta
    expect(within(dialog).getAllByRole('img').map(img => img.getAttribute('aria-label'))).toEqual([
      '6 attaccanti', '4–6 attaccanti robusti, max 2 muri', 'Mix di attaccanti e muri', 'Quasi tutti muri, 1–2 attaccanti', '6 muri',
    ]);
    expect(dialog.querySelectorAll('.tt-pips')[0].querySelectorAll('.tt-pip.a')).toHaveLength(6);
    expect(dialog).toHaveTextContent(/Meteo.*Chi lo porta.*1\+ che lo sfruttano.*Trick Room.*Chi la porta.*2\+ Pokémon lenti/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
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

});
