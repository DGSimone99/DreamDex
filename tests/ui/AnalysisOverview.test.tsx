import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import type { CoachAdvice, CoachProblem } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { coachingOffer, FixRow, solvable } from '../../src/ui/dashboard/FixRow';
import { LangProvider } from '../../src/i18n/react';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

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


const NO_ADVICE: CoachAdvice = { fixes: [], moves: [], steps: [] };
/** I consigli del Coaching con una proposta sola che risolve `keys`. */
const adviceSolving = (...keys: string[]): CoachAdvice => ({
  fixes: [{ kind: 'swap', species: 'Rotom-Wash', set: { species: 'Rotom-Wash', item: '', ability: '', moves: [], nature: 'Serious', evs: {} }, index: 0, member: 'X', gain: 1, solves: keys, reduces: [] } as unknown as CoachFix],
  moves: [], steps: [],
});
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

  it('Copertura: Offesa e Difesa aprono la loro Coverage tipi', async () => {
    const user = await setup();
    await user.click(within(panel()).getByRole('button', { name: /^Offesa/ }));
    expect(within(panel()).getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(views()).getByRole('tab', { name: 'Panoramica' }));
    await user.click(within(panel()).getByRole('button', { name: /^Difesa/ }));
    expect(within(views()).getByRole('tab', { name: 'Difesa' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
  });

  it("Ruoli e Velocità: tutta la barra del titolo è un link (i Ruoli a Bonus/Malus, sottoscheda Ruoli)", async () => {
    const user = await setup();
    for (const [name, link, tab] of [['Ruoli', 'Apri i Ruoli nella scheda Ruoli e Bonus', 'Ruoli e Bonus'], ['Velocità', 'Apri la scheda Velocità', 'Velocità']] as const) {
      const head = within(panel()).getByRole('region', { name }).querySelector('.dash-head')!;
      expect(head).toHaveClass('is-link');
      await user.click(within(head as HTMLElement).getByRole('button', { name: link }));
      expect(within(views()).getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      if (name === 'Ruoli') expect(within(panel()).getByRole('tab', { name: 'Ruoli' })).toHaveAttribute('aria-selected', 'true');
      await user.click(within(views()).getByRole('tab', { name: 'Panoramica' }));
    }
    // Copertura ha due link: la barra non è un link
    expect(within(panel()).getByRole('region', { name: 'Copertura' }).querySelector('.dash-head')).not.toHaveClass('is-link');
  });

  it('un membro solo: niente "nessun problema", l\'invito ad aggiungerne', async () => {
    await setup(['Great Tusk']);
    // In fondo, nella striscia neutra del team incompleto (non un titolo grande in cima)
    const strip = within(panel()).getByRole('region', { name: 'Da sistemare' });
    expect(strip).toHaveClass('fix-row', 'building');
    expect(strip).toHaveTextContent(/^1 di 6 nel teamAggiungi un altro Pokémon/);
    expect(within(panel()).queryByText('Nessun problema da sistemare')).toBeNull();
    expect(within(panel()).getByText('Le sinergie arrivano col secondo Pokémon')).toBeInTheDocument();
  });

  it('team vuoto: l\'invito con un pulsante e le quattro carte della Panoramica vuote con cosa mostreranno', async () => {
    render(<App initialLang="it" data={fixtureData} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(panel()).getAllByRole('button', { name: 'Aggiungi un Pokémon' })).toHaveLength(1);
    expect([...panel().querySelectorAll('.dash.ghost > section')].map(r => r.getAttribute('aria-label'))).toEqual(['Riassunto', 'Copertura', 'Ruoli', 'Velocità']);
    expect(within(panel()).getByRole('region', { name: 'Ruoli' })).toHaveTextContent('I ruoli che servono al team e chi li copre');
  });

  it('meta spento: "Meta spento" e metà del tier', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, ignoreMeta: true }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    // Meta spento: nel Riassunto niente Minacce
    expect(within(within(panel()).getByRole('region', { name: 'Riassunto' })).queryByText('Minacce')).toBeNull();
    expect(within(panel()).getByRole('region', { name: 'Velocità' })).toHaveTextContent(/metà del formato/);
  });

  it("team di 3 senza statistiche: il Riassunto c'è, nessun crash, niente Minacce", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ ...fixtureData, stats: null, sets: null }} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Dragapult']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const summary = within(panel()).getByRole('region', { name: 'Riassunto' });
    expect(within(summary).getByRole('heading', { name: 'Meteo e campi' })).toBeInTheDocument();
    expect(within(summary).getByRole('heading', { name: 'Trappole' })).toBeInTheDocument();
    expect(within(summary).queryByText('Minacce')).toBeNull();
  });

  it('niente più tessera Bonus/Malus; "Vai al Coaching" solo nella riga Da sistemare', async () => {
    await setup(['Great Tusk', 'Dragapult']);
    // Le linguette dell'Analisi hanno "Bonus/Malus": si guarda solo la Panoramica, dove c'è solo la riga in fondo al Riassunto
    const overview = panel().querySelector<HTMLElement>('.overview')!;
    for (const el of overview.querySelectorAll('.dash-card')) if (!el.classList.contains('dash-summary')) expect(el).not.toHaveTextContent(/Bonus\/Malus/);
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

  it('Coaching: un membro fuori regola ha una proposta che lo toglie: il problema nel filtro a sinistra, la proposta lo risolve', async () => {
    const user = await setup(['Great Tusk', 'Dragapult']);
    await user.click(within(views()).getByRole('tab', { name: 'Coaching' }));
    await within(panel()).findByRole('article', {}, { timeout: 8000 });
    // Il problema della regola è fra quelli del filtro della classifica (una proposta lo risolve: non in "Restano")
    const select = within(panel()).getByRole('combobox', { name: 'Problema' }) as HTMLSelectElement;
    const rule = [...select.options].find(o => /Dragapult.*(legale|vietat)/.test(o.textContent!))!;
    expect(rule).toBeTruthy();
    expect(panel().querySelector('.coach-rank-stuck')?.textContent ?? '').not.toMatch(/Dragapult/);
    // Scelto nel filtro: la carta grande è una proposta al posto di Dragapult, e fra i problemi risolti c'è la regola
    await user.selectOptions(select, rule.value);
    expect(select).toHaveValue(rule.value);
    const hero = within(panel()).getByRole('article');
    expect(hero.querySelector('h4')).toHaveTextContent(/al posto di Dragapult, voto/);
    expect([...hero.querySelectorAll('li.coach-solved')].some(li => /Dragapult.*(legale|vietat)/.test(li.textContent!))).toBe(true);
    // La classifica filtrata: ogni riga rimasta risolve la regola (lo dice il suo testo per lo screen reader)
    const rows = [...panel().querySelectorAll<HTMLElement>('.coach-rank')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(document.getElementById(row.getAttribute('aria-describedby')!)).toHaveTextContent(/Dragapult.*(legale|vietat)/);
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
    expect(dialog).toHaveTextContent(/Meteo.*Chi lo porta.*1\+ che lo sfruttano.*Distortozona.*Chi la porta.*2\+ Pokémon lenti/);
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

describe('Panoramica: Copertura › scheda Meta', () => {
  it('clic su una minaccia: la sua Coverage meta con la colonna per prima e accesa, "Mostra tutti" la spegne', async () => {
    const user = await setup(['Great Tusk', 'Gholdengo', 'Kingambit']);
    await user.click(within(panel()).getByRole('tab', { name: /^Meta/ }));
    // La prima piastrella della scheda Meta: porta alla Coverage meta della Difesa se lì non è coperta, sennò dell'Offesa
    const first = panel().querySelector<HTMLElement>('.dash-coverage .cov-tile:not(.more)')!;
    const species = first.getAttribute('aria-label')!.split(',')[0];
    const offense = first.querySelector('.cov-side')!.classList.contains('ok');
    await user.click(first);
    expect(within(views()).getByRole('tab', { name: new RegExp(`^${offense ? 'Offesa' : 'Difesa'}`) })).toHaveAttribute('aria-selected', 'true');
    const table = within(panel()).getByRole('table', { name: `${offense ? 'Offesa' : 'Difesa'}: Coverage meta` });
    expect(table.querySelector('thead th:nth-child(2)')).toHaveAttribute('aria-label', species);
    expect(table.querySelectorAll('td.kf-hit').length).toBeGreaterThan(0);
    expect(within(panel()).getByText(`Evidenziato: ${species}`)).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Mostra tutti' }));
    expect(table.querySelectorAll('td.kf-hit, td.kf-dim').length).toBe(0);
  });
});

describe('Panoramica: la riga del Coaching', () => {
  const problem = (p: Partial<CoachProblem> & Pick<CoachProblem, 'text'>): CoachProblem =>
    ({ severity: 'minor', category: 'roles', fixes: [], key: p.text, ...p });
  /** Una proposta di sostituzione: posto `index`, voto `gain`, problemi risolti `solves`. */
  const fix = (index: number, gain: number, solves: string[], species = `Mon${index}`) =>
    ({ kind: 'swap', species, set: { species, item: '', ability: '', moves: [], nature: 'Serious', evs: {} }, index, member: `M${index}`, gain, solves, reduces: [] } as unknown as CoachFix);

  it('nel team vero: "N problemi" con le proposte del Coaching, il pulsante porta al Coaching', async () => {
    const user = await setup(['Great Tusk', 'Gholdengo', 'Kingambit']);
    const row = await within(panel()).findByRole('region', { name: 'Da sistemare' }, { timeout: 5000 });
    const go = await within(row).findByRole('button', { name: /^Vai al Coaching/ }, { timeout: 8000 });
    expect(row).toHaveTextContent(/\d+ problemi?/);
    expect(row).toHaveTextContent(/Il Coaching ha \d+ propost[ae]|Nessun cambio singolo/);
    await user.click(go);
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
  });

  it('con 2 o più membri niente titolo in cima', async () => {
    await setup();
    expect(panel().querySelector('.overview-headline')).toBeNull();
  });

  it('senza problemi la striscia resta, verde e ferma: "Nessun problema da sistemare", niente link al Coaching', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    render(<LangProvider lang="it"><FixRow problems={[]} advice={NO_ADVICE} onView={onView} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('is-clear');
    expect(row).not.toHaveClass('is-link');
    expect(row).toHaveTextContent('Nessun problema da sistemare');
    expect(within(row).queryByRole('button')).toBeNull();
    await user.click(within(row).getByText('Nessun problema da sistemare'));
    expect(onView).not.toHaveBeenCalled();
  });

  it('problemi e proposte: "N problemi · Il Coaching ha M proposte, la migliore +X", tutta la riga porta al Coaching', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const a = problem({ text: 'Debole a Fuoco', key: 'a', severity: 'serious' });
    const b = problem({ text: 'Manca Pivot', key: 'b' });
    // Due posti diversi: due righe del Coaching; la migliore +4
    const advice: CoachAdvice = { fixes: [fix(0, 2, ['a']), fix(1, 4, ['b'])], moves: [], steps: [] };
    expect(coachingOffer([a, b], advice)).toEqual({ count: 2, best: 4 });
    render(<LangProvider lang="it"><FixRow problems={[a, b]} advice={advice} onView={onView} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('is-link', 'serious');
    expect(row).toHaveTextContent('2 problemi');
    expect(row).toHaveTextContent('Il Coaching ha 2 proposte, la migliore +4');
    expect(row.querySelector('.fix-gain')).toHaveTextContent('+4');
    expect(within(row).getByRole('button', { name: 'Vai al Coaching: 2 problemi, Il Coaching ha 2 proposte, la migliore +4' })).toBeInTheDocument();
    await user.click(within(row).getByText('2 problemi'));
    expect(onView).toHaveBeenCalledWith('coaching');
  });

  it('una proposta sola: "Il Coaching ha 1 proposta: +X"; coi soli minori la riga è gialla', () => {
    const p = problem({ text: 'Manca Pivot', key: 'p' });
    render(<LangProvider lang="it"><FixRow problems={[p]} advice={adviceSolving('p')} onView={() => {}} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('minor');
    expect(row).toHaveTextContent('1 problema');
    expect(row).toHaveTextContent('Il Coaching ha 1 proposta: +1');
  });

  it('le proposte si contano come le righe del Coaching: stesso posto e stesso problema sono una riga', () => {
    const p = problem({ text: 'x', key: 'x' });
    const advice: CoachAdvice = { fixes: [fix(0, 3, ['x'], 'A'), fix(0, 2, ['x'], 'B'), fix(0, 1, ['x'], 'C')], moves: [], steps: [] };
    expect(coachingOffer([p], advice)).toEqual({ count: 1, best: 3 });
  });

  it('problemi senza proposta: "N problemi · Nessun cambio singolo li risolve", e porta comunque al Coaching', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const problems = [problem({ text: 'x', severity: 'serious' }), problem({ text: 'y' })];
    render(<LangProvider lang="it"><FixRow problems={problems} advice={NO_ADVICE} onView={onView} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('is-link', 'serious');
    expect(row).toHaveTextContent('2 problemi');
    expect(row).toHaveTextContent('Nessun cambio singolo li risolve');
    await user.click(within(row).getByRole('button', { name: /^Vai al Coaching/ }));
    expect(onView).toHaveBeenCalledWith('coaching');
  });

  it('in inglese', () => {
    const p = problem({ text: 'x', key: 'x' });
    render(<LangProvider lang="en"><FixRow problems={[p]} advice={NO_ADVICE} onView={() => {}} /></LangProvider>);
    expect(screen.getByRole('region', { name: 'To fix' })).toHaveTextContent('1 problemNo single change solves itGo to Coaching');
  });

  it('nessun problema col team incompleto: neutra "5 di 6 nel team · Nessun problema finora", verde solo a team completo', () => {
    const { unmount } = render(<LangProvider lang="it"><FixRow problems={[]} advice={NO_ADVICE} members={5} onView={() => {}} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('building');
    expect(row).not.toHaveClass('is-clear');
    expect(row).toHaveTextContent(/^5 di 6 nel teamNessun problema finora$/);
    unmount();
    render(<LangProvider lang="it"><FixRow problems={[]} advice={NO_ADVICE} members={6} onView={() => {}} /></LangProvider>);
    expect(screen.getByRole('region', { name: 'Da sistemare' })).toHaveClass('is-clear');
  });

  it('consigli ancora da calcolare (advice null): numero e colore subito, aspetta solo la parte delle proposte (senza link)', () => {
    render(<LangProvider lang="it"><FixRow problems={[problem({ text: 'x', severity: 'serious' }), problem({ text: 'y' })]} advice={null} onView={() => {}} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveAttribute('aria-live', 'polite');
    expect(row).toHaveClass('is-waiting', 'serious');
    expect(row.querySelector('.fix-label')).toHaveTextContent(/^2 problemi$/);
    expect(row.querySelector('.fix-items')).toHaveTextContent(/^Il Coaching sta calcolando…$/);
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('consigli da calcolare con il team incompleto: neutra, "4 di 6 nel team" e i problemi nel testo', () => {
    render(<LangProvider lang="it"><FixRow problems={[problem({ text: 'x', severity: 'serious' })]} advice={null} members={4} onView={() => {}} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('building');
    expect(row.querySelector('.fix-label')).toHaveTextContent(/^4 di 6 nel team$/);
    expect(row.querySelector('.fix-items')).toHaveTextContent(/^1 problema · Il Coaching sta calcolando…$/);
  });

  it('team incompleto: striscia neutra "4 di 6 nel team", i problemi nel testo, niente rosso', () => {
    const problems = [problem({ text: 'x', severity: 'serious' }), problem({ text: 'y' })];
    render(<LangProvider lang="it"><FixRow problems={problems} advice={NO_ADVICE} members={4} onView={() => {}} /></LangProvider>);
    const row = screen.getByRole('region', { name: 'Da sistemare' });
    expect(row).toHaveClass('is-link', 'building');
    expect(row).not.toHaveClass('serious');
    expect(row.querySelector('.fix-label')).toHaveTextContent(/^4 di 6 nel team$/);
    expect(row.querySelector('.fix-items')).toHaveTextContent(/^2 problemi · Nessun cambio singolo li risolve$/);
    expect(within(row).getByRole('button', { name: /^Vai al Coaching: 2 problemi/ })).toBeInTheDocument();
  });

  it('solvable: i problemi che almeno una proposta del Coaching risolve (cambi di Pokémon e di mossa, tutte)', () => {
    const a = problem({ text: 'a', key: 'a' }), b = problem({ text: 'b', key: 'b' }), c = problem({ text: 'c', key: 'c' }), d = problem({ text: 'd', key: 'd' });
    const advice = adviceSolving('a', 'b');
    const moves = [{ index: 0, member: 'X', slot: 0, from: '', to: 'Tackle', set: advice.fixes[0].set, gain: 0, solves: ['c'], reduces: [] }];
    expect(solvable([a, b, c, d], { ...advice, moves }).map(p => p.key)).toEqual(['a', 'b', 'c']);
    expect(solvable([a, b, c, d], NO_ADVICE)).toEqual([]);
  });
});
