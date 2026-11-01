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
    const areas = within(band()).getAllByRole('button', { name: /, apri il dettaglio/ }).map(b => b.getAttribute('aria-label')!.replace(/ \d+, apri il dettaglio.*/, ''));
    expect(areas).toEqual(['Offesa', 'Difesa', 'Velocità', 'Ruoli']);
    expect(band()).not.toHaveTextContent('Sinergia');
  });

  it("Offesa, Difesa e Ruoli portano alla loro scheda; la Coverage offensiva non è una riga del voto", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(band()).queryByRole('button', { name: /^Coverage offensiva/ })).toBeNull();
    for (const area of ['Difesa', 'Offesa', 'Ruoli']) {
      const button = within(band()).getByRole('button', { name: new RegExp(`^${area} \\d+, apri il dettaglio`) });
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
    expect(screen.getByText((_, el) => el?.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
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
    // A sinistra gli argomenti: come funziona e un tab per tipo di team
    const topics = within(dialog).getAllByRole('tab').map(tab => tab.textContent);
    expect(topics).toEqual(['Come funziona', 'Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']);
    // Un team incompleto si giudica come Balance: il suo tab è aperto per primo e segnato come il tipo attuale
    const balanceTab = within(dialog).getByRole('tab', { name: 'Balance' });
    expect(balanceTab).toHaveAttribute('aria-selected', 'true');
    expect(balanceTab).toHaveAttribute('aria-current', 'true');
    expect(within(dialog).getAllByRole('tab').filter(tab => tab.getAttribute('aria-current') === 'true')).toHaveLength(1);
    const balance = within(dialog).getByRole('tabpanel');
    expect(balance).toHaveTextContent('Il tuo team è giudicato come Balance');
    expect(balance).toHaveTextContent('Un team incompleto si giudica come Balance');
    // I livelli vengono dalla tabella del codice, non dai testi
    expect(balance).toHaveTextContent(/Essenziali.*Muro Fisico/);
    // Stall: Velocità allo 0% e nota grigia; Recupero essenziale
    await user.click(within(dialog).getByRole('tab', { name: 'Stall' }));
    const stall = within(dialog).getByRole('tabpanel');
    expect(stall).toHaveTextContent('Velocità0%');
    expect(stall).toHaveTextContent('Non conta nello Stall');
    expect(stall).toHaveTextContent(/Essenziali.*Recupero.*Importanti/);
    expect(stall).not.toHaveTextContent('Il tuo team è giudicato come');
    // Trick Room: la regola intera su ogni tab di tipo
    for (const name of ['Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']) {
      await user.click(within(dialog).getByRole('tab', { name }));
      expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('un team veloce che la porta perde punti (−1 per membro veloce, al massimo −3)');
    }
    // Come funziona: Bonus/Malus, lettere dalle soglie, nessun testo delle vecchie aree
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    const general = within(dialog).getByRole('tabpanel');
    expect(general).toHaveTextContent('Bonus/Malus');
    expect(general).toHaveTextContent('S da 90, A da 80, B da 68, C da 55');
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
    expect(speed).toHaveClass('inactive');
    expect(speed).toHaveAccessibleName(/Non conta nello Stall/);
    // Le altre aree non sono grigie
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
const catalogRating = (teraCap: number) => ({
  ...fakeRating([], []),
  teraCap,
  penalty: { total: 8, items: [
    { text: 'Due setter di Stealth Rock', points: 1, catalog: 'hazardDuplicate' },
    { text: 'Due setter di Spikes', points: 2, catalog: 'hazardDuplicate' },
    { text: 'Troppi rimuovitori', points: 5, catalog: 'removers' },
  ] },
  bonus: { total: 2, items: [{ text: 'Sole aiuta', points: 2, catalog: 'weatherHelp' }] },
}) as unknown as TeamRating;

async function openCatalog(teraCap = 0) {
  const user = userEvent.setup();
  render(<LangProvider lang="it"><AreaView rating={catalogRating(teraCap)} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
  return { user, dialog: screen.getByRole('region', { name: 'Bonus/Malus' }) };
}

describe('Catalogo Bonus/Malus', () => {
  it('due schede Malus e Bonus col loro netto (il titolo col totale sta fuori, nel Coaching)', async () => {
    const { dialog } = await openCatalog();
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Malus −8', 'Bonus +2']);
  });

  it('Malus: i 12 malus con nome, quando e punti; gli attivi evidenziati col punteggio attuale', async () => {
    const { dialog } = await openCatalog();
    const rows = within(within(dialog).getByRole('tabpanel')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    const hazard = rows.find(r => within(r).queryByText('Hazard ripetuto'))!;
    expect(hazard).toHaveClass('active');
    expect(hazard).toHaveAttribute('aria-current', 'true');
    expect(within(hazard).getAllByRole('cell').at(-1)).toHaveTextContent('−3');
    const removers = rows.find(r => r.className.includes('active') && r !== hazard)!;
    expect(removers).toHaveTextContent('−5');
    // Un team di 3: il ruolo essenziale mancante non è attivo
    const essential = rows.find(r => r.textContent!.includes('essenzial'))!;
    expect(essential).not.toHaveClass('active');
    expect(essential).not.toHaveAttribute('aria-current');
    expect(rows.filter(r => r.classList.contains('active'))).toHaveLength(2);
  });

  it('niente tetti: nessuna riga "Totale massimo" né "limitato", anche con una somma alta', async () => {
    const r = { ...catalogRating(0), penalty: { total: 18, items: [{ text: 'A', points: 10, catalog: 'removers' }, { text: 'B', points: 8, catalog: 'hazardDuplicate' }] } } as unknown as TeamRating;
    render(<LangProvider lang="it"><AreaView rating={r} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    const panel = screen.getByRole('tabpanel');
    expect(panel).not.toHaveTextContent('Totale massimo');
    expect(panel).not.toHaveTextContent('limitato');
    expect(within(screen.getByRole('region', { name: 'Bonus/Malus' })).getByRole('tab', { name: /^Malus/ })).toHaveTextContent('−18');
  });

  it('Bonus: Tera non applicabile fuori dalla Gen 9, mai attivo', async () => {
    const { user, dialog } = await openCatalog(0);
    await user.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    const rows = within(within(dialog).getByRole('tabpanel')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    const weather = rows.find(r => within(r).queryByText('Meteo che protegge'))!;
    expect(weather).toHaveClass('active');
    expect(weather).toHaveTextContent('+2');
    const tera = rows.at(-1)!;
    expect(tera).toHaveClass('na');
    expect(tera).toHaveTextContent('Solo Gen 9');
    expect(tera).not.toHaveAttribute('aria-current');
    expect(rows.filter(r => r.classList.contains('active'))).toHaveLength(1);
  });

  it('Bonus con Tera applicabile: nessuna nota', async () => {
    const { user, dialog } = await openCatalog(3);
    await user.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Solo Gen 9');
  });

});
