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
    // Eevee sbircia da dietro la finestra: fuori dalla finestra, solo decorazione (testa, coda, due zampe)
    const peek = dialog.parentElement!.querySelector('.eevee-peek')!;
    expect(peek).toHaveAttribute('aria-hidden', 'true');
    expect(peek.querySelectorAll('img')).toHaveLength(4);
    expect(dialog.querySelector('.eevee-peek')).toBeNull();
    // A sinistra gli argomenti: come funziona e un tab per tipo di team
    const topics = within(dialog).getAllByRole('tab').map(tab => tab.getAttribute('id'));
    expect(topics).toEqual(['help-tab-general', 'help-tab-hyperOffense', 'help-tab-bulkyOffense', 'help-tab-balance', 'help-tab-semiStall', 'help-tab-stall']);
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Come funziona', 'Hyper Offense', 'Bulky Offense', 'Balanceil tuo team', 'Semi-stall', 'Stall']);
    // Si apre sempre su come funziona in generale
    expect(within(dialog).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    // Un team incompleto si giudica come Balance: il suo tab è segnato come il tipo attuale, con una scritta che si legge
    const balanceTab = within(dialog).getByRole('tab', { name: 'Balance' });
    expect(balanceTab).toHaveAttribute('aria-selected', 'false');
    expect(balanceTab).toHaveAttribute('aria-current', 'true');
    expect(balanceTab).toHaveAttribute('title', 'Il tuo team è giudicato come Balance');
    expect(within(dialog).getAllByRole('tab').filter(tab => tab.getAttribute('aria-current') === 'true')).toHaveLength(1);
    await user.click(balanceTab);
    const balance = within(dialog).getByRole('tabpanel');
    expect(balance).toHaveTextContent('Il tuo team è giudicato come Balance');
    expect(balance).toHaveTextContent('Un team incompleto si giudica come Balance');
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
    // Trick Room: la regola su ogni tab di tipo, senza i punti
    for (const name of ['Hyper Offense', 'Bulky Offense', 'Balance', 'Semi-stall', 'Stall']) {
      await user.click(within(dialog).getByRole('tab', { name }));
      expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('portarla in un team veloce è un controsenso e costa punti');
    }
    // Come funziona: Bonus/Malus, lettere dalle soglie, nessun testo delle vecchie aree
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    const general = within(dialog).getByRole('tabpanel');
    expect(general).toHaveTextContent('Bonus/Malus');
    expect(general).toHaveTextContent('S da 90, A da 80, B da 70, C da 60');
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

async function openCatalog() {
  const user = userEvent.setup();
  render(<LangProvider lang="it"><AreaView rating={catalogRating()} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
  return { user, dialog: screen.getByRole('region', { name: 'Bonus/Malus' }) };
}

describe('Bonus/Malus', () => {
  it('una scheda sola col netto sul voto, e le barre di malus e bonus', async () => {
    const { dialog } = await openCatalog();
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Sul voto −6']);
    expect(within(dialog).getByText('−8')).toBeInTheDocument();
    expect(within(dialog).getAllByText('+2').length).toBeGreaterThan(0);
  });

  it('cosa toglie: una carta per voce attiva coi suoi casi e i punti in tutto; niente regole a punti', async () => {
    const { dialog } = await openCatalog();
    const takes = within(dialog).getByRole('region', { name: 'Cosa toglie' });
    const cards = within(takes).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    const hazard = cards.find(c => within(c).queryByText('Hazard ripetuto'))!;
    expect(hazard).toHaveTextContent('−3');
    expect(hazard).toHaveTextContent('Due setter di Stealth Rock · Due setter di Spikes');
    expect(cards.find(c => within(c).queryByText('Stesso tipo'))).toHaveTextContent('−5');
    expect(dialog).not.toHaveTextContent('per ogni');
  });

  it('cosa aggiunge: la sola voce attiva; le altre 15 voci come tessere spente con la frase breve; niente Tera', async () => {
    const { dialog } = await openCatalog();
    const adds = within(dialog).getByRole('region', { name: 'Cosa aggiunge' });
    expect(within(adds).getAllByRole('listitem')).toHaveLength(1);
    expect(within(adds).getByText('Meteo che protegge').closest('li')).toHaveTextContent('+2');
    const rest = within(dialog).getByRole('region', { name: 'Le altre voci, per ora a zero' });
    expect(within(rest).getAllByRole('listitem')).toHaveLength(15);
    expect(within(rest).getByText('Core a tre').closest('li')).toHaveTextContent('Tre membri che si coprono le debolezze a vicenda');
    expect(dialog).not.toHaveTextContent('Tera');
  });

  it('senza malus la colonna lo dice; niente tetti né "Totale massimo"', async () => {
    const r = { ...catalogRating(), penalty: { total: 0, items: [] } } as unknown as TeamRating;
    render(<LangProvider lang="it"><AreaView rating={r} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    expect(screen.getByRole('region', { name: 'Cosa toglie' })).toHaveTextContent('Niente: nessun malus');
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('Totale massimo');
  });
});
