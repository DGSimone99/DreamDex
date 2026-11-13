import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import type { CoachProblem } from '../../src/engine/coach';
import { FixRow, fixItems, solvable } from '../../src/ui/dashboard/FixRow';
import type { CoachStep } from '../../src/engine/coachSteps';
import { LangProvider } from '../../src/i18n/react';

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

  it("il Riassunto: un attaccante dell'eroe porta a Offesa", async () => {
    const user = await setup();
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    await user.click(within(within(summary).getByRole('group', { name: 'Attaccano' })).getAllByRole('button')[0]);
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
    // Meta spento: nel Riassunto niente Minacce
    expect(within(within(panel()).getByRole('region', { name: 'Riassunto' })).queryByText('Minacce')).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Velocità' })).toHaveTextContent(/media del tier/);
  });

  it("team di 3 senza statistiche: il Riassunto c'è, nessun crash, niente Minacce", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, stats: null, sets: null }} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Dragapult']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    expect(within(summary).getByRole('heading', { name: 'Meteo e campo' })).toBeInTheDocument();
    expect(within(summary).getByRole('heading', { name: 'Trappole' })).toBeInTheDocument();
    expect(within(summary).queryByText('Minacce')).toBeNull();
  });

  it('niente più tessera Bonus/Malus; "Vai al Coaching" solo nella riga Da sistemare', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    // Le linguette dell'Analisi hanno "Bonus/Malus": si guarda solo la Panoramica
    const overview = panel().querySelector<HTMLElement>('.overview')!;
    expect(overview).not.toHaveTextContent(/Bonus\/Malus/);
    for (const button of within(panel()).queryAllByRole('button', { name: /Vai al Coaching/ })) expect(button.closest('.fix-row')).not.toBeNull();
    expect(panel().querySelector('.summary-tile, .summary-strip')).toBeNull();
  });

  it('niente più numeri chiave, colonne Problemi/Soluzioni o blocco Bonus/Malus', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    expect(within(panel()).queryByRole('group', { name: 'Numeri chiave' })).toBeNull();
    expect(within(panel()).queryByRole('group', { name: /^Bonus\/Malus/ })).toBeNull();
    expect(panel().querySelector('.problem-group')).toBeNull();
  });

  it('niente segno con le note sul voto nella Panoramica (meta e stall)', async () => {
    await setup();
    expect(within(panel()).queryByText(/Col meta del formato/)).toBeNull();
    expect(panel().querySelector('.overview-headline .alert-mark')).toBeNull();
  });

  it('regole per prime tra i problemi del Coaching', async () => {
    const user = await setup(['Great Tusk', 'Dragapult']);
    await user.click(within(views()).getByRole('tab', { name: 'Coaching' }));
    const rows = within(within(panel()).getByRole('group', { name: /^Regole/ })).getAllByRole('listitem');
    expect(rows[0]).toHaveClass('serious');
    expect(rows[0].getAttribute('data-key')).toMatch(/^rules:/);
  });

  it('team stall: niente più la nota "valutato come stall"', async () => {
    await importTeam([
      'Dondozo @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 252 Def / 4 SpD\nImpish Nature\n- Body Press\n- Liquidation\n- Rest\n- Sleep Talk',
      'Blissey @ Leftovers\nAbility: Natural Cure\nEVs: 4 HP / 252 Def / 252 SpD\nBold Nature\n- Protect\n- Seismic Toss\n- Toxic\n- Wish',
      'Clodsire @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Amnesia\n- Poison Jab\n- Recover\n- Spikes',
      'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 168 Def / 88 SpD\nImpish Nature\n- Body Press\n- Defog\n- Iron Defense\n- Roost',
      'Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Protect\n- Stealth Rock\n- Toxic',
      'Toxapex @ Rocky Helmet\nAbility: Regenerator\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Knock Off\n- Recover\n- Scald\n- Toxic Spikes',
    ].join('\n\n'));
    expect(within(panel()).queryByText(/Valutato come stall/)).toBeNull();
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

  it('niente giudizio in cima; il tipo di team sta in cima al Riassunto', async () => {
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex']);
    expect(panel().querySelector('.overview-headline')).toBeNull();
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

describe('Panoramica: Da sistemare', () => {
  const problem = (p: Partial<CoachProblem> & Pick<CoachProblem, 'text'>): CoachProblem =>
    ({ severity: 'minor', category: 'roles', fixes: [], key: p.text, ...p });

  it('Da sistemare: i problemi coi nomi e il link al Coaching', async () => {
    const user = await setup(['Great Tusk', 'Gholdengo', 'Kingambit']);
    const row = await within(panel()).findByRole('region', { name: 'Da sistemare' }, { timeout: 5000 });
    expect(row).toHaveTextContent(/Nessuno regge/);
    // Le minacce del meta in una frase sola, coi nomi
    expect((row.textContent!.match(/del meta/g) ?? []).length).toBeLessThanOrEqual(1);
    await user.click(within(row).getByRole('button', { name: 'Vai al Coaching' }));
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
  });

  it('meta spento con 2 membri: nella riga nessuna minaccia del meta', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, ignoreMeta: true }} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Kingambit']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const row = within(panel()).queryByRole('region', { name: 'Da sistemare' });
    expect(row).not.toBeNull();
    expect(row).not.toHaveTextContent(/del meta/);
  });

  it('con 2 o più membri niente titolo in cima', async () => {
    await setup();
    expect(panel().querySelector('.overview-headline')).toBeNull();
  });

  it('senza problemi niente Da sistemare', () => {
    const { container } = render(<LangProvider lang="it"><FixRow problems={[]} steps={[]} onView={() => {}} /></LangProvider>);
    expect(container).toBeEmptyDOMElement();
  });

  it('consigli ancora da calcolare (steps null): niente riga', () => {
    const { container } = render(<LangProvider lang="it"><FixRow problems={[problem({ text: 'x', severity: 'serious' })]} steps={null} onView={() => {}} /></LangProvider>);
    expect(container).toBeEmptyDOMElement();
  });

  it('solvable: solo i problemi che una tappa del Coaching risolve (il suo, il gruppo e gli altri che copre)', () => {
    const a = problem({ text: 'a', key: 'a' }), b = problem({ text: 'b', key: 'b' }), c = problem({ text: 'c', key: 'c' }), d = problem({ text: 'd', key: 'd' });
    const steps = [{ problem: a, swap: null, move: null, group: ['a', 'b'], alsoSolves: ['c'] }] as unknown as CoachStep[];
    expect(solvable([a, b, c, d], steps).map(p => p.key)).toEqual(['a', 'b', 'c']);
    expect(solvable([a, b, c, d], [])).toEqual([]);
  });

  it('fixItems: più di 3 minacce, i primi 3 nomi e "e altri N"', () => {
    const names = ['Kingambit', 'Raging Bolt', 'Diancie-Mega', 'Tapu Koko', 'Charizard-Mega-Y', 'Charizard-Mega-X', 'Melmetal'];
    const items = fixItems(names.map(n => problem({ text: n, category: 'meta', subjects: [n] })), 'it');
    expect(items.shown).toEqual(['Nessuno regge Kingambit, Raging Bolt, Diancie-Mega e altri 4 del meta']);
  });

  it('fixItems: i gravi prima, le minacce del meta in una frase coi nomi', () => {
    const items = fixItems([
      problem({ text: 'Ruoli mancanti: Pivot' }),
      problem({ text: 'Nessuno regge Latios-Mega del meta', category: 'meta', subjects: ['Latios-Mega'] }),
      problem({ text: 'Nessuno regge Tapu Koko del meta', category: 'meta', subjects: ['Tapu Koko'] }),
      problem({ text: 'Nessuno regge Diancie-Mega del meta', category: 'meta', subjects: ['Diancie-Mega'] }),
      problem({ text: 'Nessuno regge Fire', category: 'defense', severity: 'serious' }),
    ], 'it');
    expect(items.shown).toEqual(['Nessuno regge Fire', 'Ruoli mancanti: Pivot']);
    expect(items.hidden).toEqual(['Nessuno regge Latios-Mega, Tapu Koko, Diancie-Mega del meta']);
    expect(items.more).toBe(1);
  });

  it('fixItems: con 5 voci se ne vedono 2, le altre in +3; le regole per prime', () => {
    const items = fixItems([
      problem({ text: 'a' }), problem({ text: 'b' }), problem({ text: 'c' }), problem({ text: 'd' }),
      problem({ text: 'Dragapult non è legale in National Dex OU', category: 'rules', severity: 'serious' }),
    ], 'it');
    expect(items.shown).toEqual(['Dragapult non è legale in National Dex OU', 'a']);
    expect(items.more).toBe(3);
  });
});
