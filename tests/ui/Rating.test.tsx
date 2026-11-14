import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { AreaView } from '../../src/ui/AreaView';
import { LangProvider } from '../../src/i18n/react';
import type { TeamRating } from '../../src/engine/rating';
import { fixtureData } from '../fixtures/data';

const band = () => document.querySelector<HTMLElement>('.band')!;

describe('Riquadro Voto', () => {
  it('voto, punteggio, etichetta e aree', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(band()).toHaveTextContent(/Voto [SABCD], \d+ su 100, \w+/);
    const areas = within(band()).getAllByRole('button', { name: /, apri il dettaglio/ }).map(b => b.getAttribute('aria-label')!.replace(/ [\d/]+, .*apri il dettaglio.*/, ''));
    expect(areas).toEqual(['Offesa', 'Difesa', 'Velocità', 'Ruoli']);
    expect(band()).not.toHaveTextContent('Sinergia');
  });

  it("Offesa, Difesa e Ruoli portano alla loro scheda; la Coverage offensiva non è una riga del voto", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(band()).queryByRole('button', { name: /^Coverage offensiva/ })).toBeNull();
    for (const area of ['Difesa', 'Offesa', 'Ruoli']) {
      const button = within(band()).getByRole('button', { name: new RegExp(`^${area} [\\d/]+, .*apri il dettaglio`) });
      expect(button).not.toHaveAttribute('aria-haspopup');
      await user.click(button);
      expect(within(document.getElementById('panel-analysis')!).getByRole('region', { name: area })).toBeInTheDocument();
    }
  });

  it('mostra la nota del meteo sotto la tabella delle debolezze', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    await user.click(within(band()).getByRole('button', { name: /^Difesa \d+, apri il dettaglio/ }));
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    expect(screen.getByText((_, el) => !!el?.classList.contains('ht-notes') && el.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('nessuna valutazione con il team vuoto', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(document.querySelector('.grade-badge.none')).not.toBeNull();
    expect(within(band()).queryByRole('button', { name: /, apri il dettaglio/ })).toBeNull();
  });

  it('senza dati Smogon la forza resta calcolata, il Meta Use avvisa', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(band()).not.toHaveTextContent('Statistiche n/d');
    expect(screen.getByRole('group', { name: 'Meta Use' })).toHaveTextContent('Statistiche Smogon assenti');
  });

  it('Meta Use sta subito prima di Minacce del meta', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const meta = screen.getByRole('group', { name: 'Meta Use' });
    const threats = screen.getByText('Minacce del meta');
    expect(meta.compareDocumentPosition(threats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Meta Use: uso nel meta di ogni membro, fuori dalla valutazione', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const meta = screen.getByRole('group', { name: 'Meta Use' });
    expect(meta).toHaveTextContent('Great Tusk 30,0%');
    expect(meta).toHaveTextContent('Gholdengo 25,0%');
    expect(meta).toHaveTextContent('Magikarp non presente nelle statistiche');
  });

  it('il "?" nel riquadro Voto apre come funziona il voto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const help = within(band()).getByRole('button', { name: 'Come funziona il voto' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Come funziona il voto' });
    // Eevee sbircia da dietro la finestra: fuori dalla finestra, solo decorazione (orecchi, collare, faccia, facce a occhi chiusi, sorridente, colpita e che ride, coda, due zampe)
    const peek = dialog.parentElement!.querySelector('.eevee-peek')!;
    expect(peek).toHaveAttribute('aria-hidden', 'true');
    expect(peek.querySelectorAll('img')).toHaveLength(11);
    expect(dialog.querySelector('.eevee-peek')).toBeNull();
    // A sinistra gli argomenti: come funziona e un tab per tipo di team
    const topics = within(dialog).getAllByRole('tab').map(tab => tab.getAttribute('id'));
    expect(topics).toEqual(['help-tab-general', 'help-tab-hyperOffense', 'help-tab-bulkyOffense', 'help-tab-balance', 'help-tab-semiStall', 'help-tab-stall']);
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Come funziona', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    // Si apre sempre su come funziona in generale
    expect(within(dialog).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    // Un team incompleto: nessun tab segnato come il tuo team (e nessuna frase "in analisi")
    const balanceTab = within(dialog).getByRole('tab', { name: 'Balance' });
    expect(balanceTab).toHaveAttribute('aria-selected', 'false');
    expect(within(dialog).getAllByRole('tab').filter(tab => tab.getAttribute('aria-current') === 'true')).toHaveLength(0);
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('in analisi');
    await user.click(balanceTab);
    const balance = within(dialog).getByRole('tabpanel');
    // Il tipo del team lo dice già "il tuo team" nella lista: niente frase ripetuta nella scheda
    expect(balance).not.toHaveTextContent('Il tuo team è giudicato come');
    expect(balance).not.toHaveTextContent('Un team incompleto');
    // I livelli vengono dalla tabella del codice, non dai testi
    expect(balance).toHaveTextContent(/Essenziali.*Muro Fisico/);
    // Stall: Difesa 65, Offesa 25, Velocità 10 (conta poco ma conta: niente nota grigia); Recupero essenziale
    await user.click(within(dialog).getByRole('tab', { name: 'Stall' }));
    const stall = within(dialog).getByRole('tabpanel');
    expect(stall).toHaveTextContent('Difesamolto');
    // I pesi sono solo barre: nessun numero né a vista né nel suggerimento
    expect(stall.querySelector('.help-weights-row')!.textContent).not.toMatch(/\d/);
    expect(stall.querySelector('.help-wbar[title]')).toBeNull();
    expect(stall).toHaveTextContent('Velocitàpoco');
    expect(stall).not.toHaveTextContent('Non conta nello Stall');
    expect(stall).toHaveTextContent(/Essenziali.*Recupero.*Importanti/);
    expect(stall).not.toHaveTextContent('Il tuo team è giudicato come');
    // Trick Room: la frase sta solo in Come funziona, in nessuna scheda dei tipi; niente frase sui livelli
    for (const name of ['Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']) {
      await user.click(within(dialog).getByRole('tab', { name }));
      const panel = within(dialog).getByRole('tabpanel');
      expect(panel).not.toHaveTextContent('Trick Room');
      expect(panel).not.toHaveTextContent('tre livelli');
      // Le voci dei Ruoli sono etichette con la spiegazione nel tooltip, non pulsanti
      expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    }
    await user.click(within(dialog).getByRole('tab', { name: 'Balance' }));
    expect(within(within(dialog).getByRole('tabpanel')).getByText('Muro Fisico')).toHaveAttribute('title', 'Regge bene i colpi fisici e resta in campo a lungo');
    // Come funziona: Bonus/Malus, lettere dalle soglie, nessun testo delle vecchie aree
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    const general = within(dialog).getByRole('tabpanel');
    expect(general).toHaveTextContent('Bonus/Malus');
    // Le lettere in cima, grandi: la frase intera per gli screen reader
    expect(within(general).getByRole('list', { name: 'Le lettere: S da 90, A da 80, B da 70, C da 60, sotto è D.' })).toHaveTextContent(/S90\+A80\+B70\+C60\+D< 60/);
    expect(general).toHaveTextContent('portarla in un team veloce è un controsenso e costa punti');
    expect(general).not.toHaveTextContent('media pesata');
    // I pesi solo come barre: la parola c'è solo per i lettori di schermo; Offesa prima di Difesa
    expect(within(general).getAllByRole('columnheader').map(th => th.textContent)).toEqual(['Tipo di team', 'Offesa', 'Difesa', 'Velocità']);
    expect(within(general).getByRole('row', { name: /^Stall/ })).toHaveTextContent('Stallabbastanzamoltopoco');
    expect(general.querySelector('.help-wword')).toBeNull();
    expect(general).not.toHaveTextContent('Pokémon più usati del mese');
    expect(general).not.toHaveTextContent('non hanno un peso proprio');
    for (const tab of within(dialog).getAllByRole('tab')) {
      await user.click(tab);
      expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Debolezze condivise');
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('nello stall la Velocità resta visibile ma grigia, con la nota, e porta alla sua scheda', async () => {
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
    const speed = within(band()).getByRole('button', { name: /^Velocità \d+, apri il dettaglio/ });
    // Dal 2026-11-03 la Velocità pesa il 10% anche nello stall: nessuna riga è grigia
    expect(speed).not.toHaveClass('inactive');
    expect(speed).not.toHaveAccessibleName(/Non conta nello Stall/);
    expect(within(band()).getByRole('button', { name: /^Difesa \d+, apri il dettaglio/ })).not.toHaveClass('inactive');
    await user.click(speed);
    expect(within(document.getElementById('panel-analysis')!).getByRole('region', { name: 'Velocità' })).toBeInTheDocument();
  });
});

/** Valutazione minima, solo con ciò che serve alla barra Bonus/Malus. */
const fakeRating = (penalty: [string, number][], bonus: [string, number][], penaltyTotal?: number): TeamRating => ({
  teamType: 'balance', trickRoom: false, grade: 'B', overall: 70, label: 'Buono', archetype: 'balance', meta: false, areas: [],
  penalty: { total: penaltyTotal ?? penalty.reduce((n, [, p]) => n + p, 0), items: penalty.map(([text, points]) => ({ text, points })) },
  bonus: { total: bonus.reduce((n, [, p]) => n + p, 0), items: bonus.map(([text, points]) => ({ text, points })) },
}) as unknown as TeamRating;
/** Valutazione con le voci del catalogo, per il modale Bonus/Malus. */
const catalogRating = () => ({
  ...fakeRating([], []),
  penalty: { total: 8, items: [
    { text: 'Due setter di Stealth Rock', points: 1, catalog: 'hazardDuplicate' },
    { text: 'Due setter di Spikes', points: 2, catalog: 'hazardDuplicate' },
    { text: 'Tre Acciaio', points: 5, catalog: 'sameType' },
  ] },
  bonus: { total: 2, items: [{ text: 'Sole aiuta', points: 2, catalog: 'weatherHelp' }] },
}) as unknown as TeamRating;

/** Un core a tre finto: tre membri col giro dei tipi parati. */
const fakeCore = (members: [string, string, string], types: [string, string, string]) => ({
  members, names: [[], [], []], strength: 3,
  sides: members.map((from, i) => ({ from, to: members[(i + 1) % 3], type: types[i], types: [types[i]] })),
});
/** (Nei test i tipi restano in inglese: niente dati italiani.) Righe della Coverage tipi: per ogni tipo chi lo regge (qui basta il conto). */
const holdRows = (held: Record<string, number>) => Object.entries(held).flatMap(([name, n]) => Array.from({ length: n }, (_, i) => ({ type: `${name}${i}`, heldBy: [name] })));
/** Valutazione con due core: il secondo (Heatran, Landorus, Toxapex) regge più tipi del primo. */
const coreRating = (cores = [fakeCore(['Pelipper', 'Ferrothorn', 'Great Tusk'], ['Fire', 'Water', 'Electric']), fakeCore(['Heatran', 'Landorus-Therian', 'Toxapex'], ['Fire', 'Ground', 'Poison'])]) => ({
  ...fakeRating([], []),
  bonus: { total: 3 * cores.length, items: cores.map(c => ({ text: `Core a tre: ${c.members.join(', ')} si parano le debolezze a giro`, points: 3, catalog: 'coreTrio' })) },
  cores,
  defense: { coverageTypes: { rows: [...holdRows({ Pelipper: 4, Heatran: 9 }), ...holdRows({ nobody: 5 })] } },
}) as unknown as TeamRating;

function renderBm(rating: TeamRating) {
  const user = userEvent.setup();
  render(<LangProvider lang="it"><AreaView rating={rating} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
  return { user, view: screen.getByRole('region', { name: 'Bonus/Malus' }) };
}
const onGrade = () => screen.getByRole('region', { name: 'Sul voto' });

describe('Bonus/Malus', () => {
  it('una scheda sola col netto sul voto (rosso se negativo), e bonus e malus in tutto', () => {
    const { view } = renderBm(catalogRating());
    expect(within(view).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Sul voto −6']);
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent('−6');
    expect(onGrade().querySelector('.bm-net')).toHaveClass('bad');
    expect(onGrade()).toHaveTextContent('Bonus +2');
    expect(onGrade()).toHaveTextContent('Malus −8');
  });

  it('solo le voci attive, prima i bonus poi i malus, coi casi e i punti in tutto; niente voci a zero né regole a punti', () => {
    renderBm(catalogRating());
    const rows = within(onGrade()).getAllByRole('listitem');
    expect(rows.map(row => row.querySelector('b')!.textContent)).toEqual(['Meteo che protegge', 'Stesso tipo', 'Hazard ripetuto']);
    expect(rows[0]).toHaveTextContent('+2');
    expect(rows[0]).toHaveClass('bonus');
    expect(rows[2]).toHaveTextContent('Due setter di Stealth Rock · Due setter di Spikes');
    expect(rows[2]).toHaveTextContent('−3');
    expect(rows[2]).toHaveClass('malus');
    expect(rows[1]).toHaveTextContent('−5');
    expect(onGrade()).not.toHaveTextContent('Tipi vari');
    expect(onGrade()).not.toHaveTextContent('per ogni');
    expect(screen.queryByText('Cosa toglie')).toBeNull();
    expect(screen.queryByText(/per ora a zero/)).toBeNull();
  });

  it('netto verde se positivo; senza voci il netto è 0 grigio con "Né bonus né malus per ora"', () => {
    const { unmount } = render(<LangProvider lang="it"><AreaView rating={coreRating()} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent('+6');
    expect(onGrade().querySelector('.bm-net')).toHaveClass('good');
    unmount();
    renderBm(fakeRating([], []));
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent(/^0$/);
    expect(onGrade().querySelector('.bm-net')).toHaveClass('zero');
    expect(onGrade()).toHaveTextContent('Né bonus né malus per ora');
    expect(within(onGrade()).queryByRole('list')).toBeNull();
  });

  it('"Tutte le voci possibili" apre il catalogo (la guida della scheda) sui bonus; all\'uscita il focus torna al link', async () => {
    const { user } = renderBm(catalogRating());
    const link = screen.getByRole('button', { name: /Tutte le voci possibili/ });
    await user.click(link);
    const dialog = screen.getByRole('dialog', { name: /Bonus\/Malus/ });
    expect(within(dialog).getByRole('tab', { name: 'Tutti i bonus' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(6);
    expect(within(panel).getByText('Core a tre').closest('li')).toHaveTextContent('Tre membri che si coprono le debolezze a vicenda');
    expect(within(panel).getByText('Core a tre').closest('li')).toHaveTextContent('+3 per ogni trio');
    await user.click(within(dialog).getByRole('tab', { name: 'Tutti i malus' }));
    expect(within(within(dialog).getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(12);
    expect(dialog).not.toHaveTextContent('Tera');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(link).toHaveFocus();
  });

  it('due core a tre: aperto quello che regge più tipi, l\'altro è un pulsante che lo apre', async () => {
    const { user } = renderBm(coreRating());
    const cores = screen.getByRole('region', { name: '2 core a tre' });
    const strong = within(cores).getByRole('button', { name: 'Core Fire / Ground / Poison' });
    const weak = within(cores).getByRole('button', { name: 'Core Fire / Water / Electric' });
    expect(strong).toHaveAttribute('aria-expanded', 'true');
    expect(weak).toHaveAttribute('aria-expanded', 'false');
    expect(within(cores).getByText('Reggono 9 tipi su 18')).toBeInTheDocument();
    expect(within(cores).getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Heatran para Landorus-Therian da Fire')).toBeInTheDocument();
    await user.click(weak);
    expect(weak).toHaveAttribute('aria-expanded', 'true');
    expect(strong).toHaveAttribute('aria-expanded', 'false');
    expect(weak.closest('li')).toHaveClass('open');
    expect(within(cores).getByText('Reggono 4 tipi su 18')).toBeInTheDocument();
    // Le medaglie del core nella lista: una per trio, coi soli nomi, prima quella del core che regge più tipi
    const rows = within(onGrade()).getAllByRole('listitem');
    expect(rows.map(row => row.textContent)).toEqual(['Core a treHeatran, Landorus-Therian, Toxapex+3', 'Core a trePelipper, Ferrothorn, Great Tusk+3']);
  });

  it('un core solo: aperto, senza pulsante; nessun core: una riga su come averne uno', () => {
    const { unmount } = render(<LangProvider lang="it"><AreaView rating={coreRating([fakeCore(['Heatran', 'Landorus-Therian', 'Toxapex'], ['Fire', 'Ground', 'Poison'])])} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    const one = screen.getByRole('region', { name: 'Core a tre' });
    expect(within(one).queryByRole('button')).toBeNull();
    expect(within(one).getByRole('heading', { name: /Fire \/ Ground \/ Poison/ })).toBeInTheDocument();
    unmount();
    renderBm(catalogRating());
    const none = screen.getByRole('region', { name: 'Core a tre' });
    expect(none).toHaveTextContent('Nessun core a tre');
    expect(none).toHaveTextContent('tre membri si coprono le debolezze a giro');
  });
});

describe('Tipo di team nel riquadro Voto', () => {
  const STALL = [
    `Dondozo @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 252 Def / 4 SpD\nImpish Nature\n- Body Press\n- Liquidation\n- Rest\n- Sleep Talk`,
    `Blissey @ Leftovers\nAbility: Natural Cure\nEVs: 4 HP / 252 Def / 252 SpD\nBold Nature\n- Protect\n- Seismic Toss\n- Toxic\n- Wish`,
    `Clodsire @ Leftovers\nAbility: Unaware\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Amnesia\n- Poison Jab\n- Recover\n- Spikes`,
    `Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 168 Def / 88 SpD\nImpish Nature\n- Body Press\n- Defog\n- Iron Defense\n- Roost`,
    `Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Protect\n- Stealth Rock\n- Toxic`,
    `Toxapex @ Rocky Helmet\nAbility: Regenerator\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Knock Off\n- Recover\n- Scald\n- Toxic Spikes`,
  ];
  const plate = () => band().querySelector<HTMLElement>('.grade-badge .grade-type');

  it('il voto mostra il tipo di team con 6 membri, con la nota al passaggio del mouse', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste(STALL.join('\n\n'));
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(plate()).toHaveTextContent(/^(Hyper Offense|Bulky Offense|Balance|Semi-stall|Stall)$/);
    expect(plate()!.title).toMatch(/muri|Muri|equilibrio|minacce|attacco|Attaccanti/);
    expect(band().querySelector('.grade-badge .visually-hidden')).toHaveTextContent(new RegExp(`${plate()!.textContent}$`));
  });

  it('col team incompleto il voto dice In costruzione', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(plate()).toHaveTextContent('In costruzione');
    expect(plate()!.title).toBe('Il tipo di team si riconosce con tutti e 6 i membri');
    expect(band().querySelector('.grade-badge .visually-hidden')).toHaveTextContent(/In costruzione$/);
  });
});
