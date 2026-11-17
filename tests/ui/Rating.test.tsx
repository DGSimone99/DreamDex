import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    const areas = within(band()).getAllByRole('button', { name: /, apri il dettaglio/ }).map(b => b.getAttribute('aria-label')!.replace(/ (punti )?[\d/+−]+, .*apri il dettaglio.*/, ''));
    expect(areas).toEqual(['Offesa', 'Difesa', 'Velocità', 'Ruoli']);
    expect(band()).not.toHaveTextContent('Sinergia');
  });

  it("Offesa e Difesa portano alla loro scheda, Ruoli a Bonus/Malus sulla sottoscheda Ruoli; la Coverage offensiva non è una riga del voto", async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(band()).queryByRole('button', { name: /^Coverage offensiva/ })).toBeNull();
    for (const area of ['Difesa', 'Offesa', 'Ruoli']) {
      // Ruoli porta i suoi punti ("Ruoli punti −4, 3/10, …"), le aree il valore
      const button = within(band()).getByRole('button', { name: new RegExp(`^${area} (punti )?[\\d/+−]+, .*apri il dettaglio`) });
      expect(button).not.toHaveAttribute('aria-haspopup');
      await user.click(button);
      const analysis = within(document.getElementById('panel-analysis')!);
      if (area !== 'Ruoli') { expect(analysis.getByRole('region', { name: area })).toBeInTheDocument(); continue; }
      expect(analysis.getByRole('region', { name: 'Ruoli e Bonus' })).toBeInTheDocument();
      expect(analysis.getByRole('tab', { name: 'Ruoli e Bonus' })).toHaveAttribute('aria-selected', 'true');
      expect(analysis.getByRole('tab', { name: 'Ruoli' })).toHaveAttribute('aria-selected', 'true');
      expect(analysis.getByRole('region', { name: 'Essenziali' })).toBeInTheDocument();
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

  it('senza dati Smogon la forza resta calcolata, la scheda Meta avvisa', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(band()).not.toHaveTextContent('Statistiche n/d');
    expect(screen.getByRole('region', { name: 'Meta' })).toHaveTextContent('Statistiche Smogon assenti');
  });

  it('scheda Meta: posizione e uso di ogni membro, fuori dalla valutazione', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Magikarp']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const team = screen.getByRole('group', { name: 'Il tuo team' });
    expect(team).toHaveTextContent('Great Tusk #1 30,0%');
    expect(team).toHaveTextContent('Gholdengo #2 25,0%');
    expect(team).toHaveTextContent('Magikarp non presente nelle statistiche');
  });

  it('barra a sinistra: sotto Meta l\'uso medio del team, non le minacce', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const meta = document.getElementById('tab-meta')!;
    expect(meta).toHaveTextContent('Uso medio 27,5%');
    expect(meta.textContent).not.toMatch(/minacc/);
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
  // Bonus/Malus ha anche la sottoscheda Ruoli (coperti/totale e la guida del tipo di team)
  roles: { covered: 0, total: 0, rows: [], failures: [], bonuses: [], members: [] }, needs: { archetype: 'balance', rules: {} },
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
  return { user, view: screen.getByRole('region', { name: 'Ruoli e Bonus' }) };
}
const onGrade = () => screen.getByRole('region', { name: 'Sul voto' });
/** Dentro la sottoscheda aperta (la striscia di sopra ha anche lei una scheda "Bonus/Malus"). */
const inner = () => within(document.querySelector<HTMLElement>('.area-panel')!);
/** Le medaglie delle voci (senza la casella "+N altre"). */
const medals = () => [...document.querySelectorAll<HTMLElement>('.bm-list > .bm-row')];
const medalNames = () => medals().map(row => row.querySelector('.bm-row-tx b')!.textContent);
/** Col tasto Tab fino all'elemento (il tooltip DreamDex si apre col fuoco da tastiera). */
async function tabTo(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
  for (let i = 0; i < 40 && document.activeElement !== el; i++) await user.tab();
  expect(el).toHaveFocus();
}

describe('Bonus/Malus', () => {
  it('una scheda sola col netto sul voto (rosso se negativo), e bonus e malus in tutto, scritti', () => {
    const { view } = renderBm(catalogRating());
    expect(within(view).getAllByRole('tab')[0].textContent).toBe('Bonus/Malus');
    expect(within(view).getAllByRole('tab')[0]).toHaveAccessibleDescription('−6');
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent('−6');
    expect(onGrade().querySelector('.bm-net')).toHaveClass('bad');
    expect(onGrade().querySelector('.bm-parts')).toHaveTextContent('Bonus +2·Malus −8');
    // Niente più barre: i numeri bastano
    expect(document.querySelector('.bm-bars')).toBeNull();
    expect(within(onGrade()).getByRole('button', { name: /Tutte le voci possibili/ })).toBeInTheDocument();
  });

  it('tutte le voci insieme come medaglie, senza schede Bonus e Malus: prima i malus, ognuno dal più pesante, poi i bonus', () => {
    renderBm(catalogRating());
    expect(inner().queryByRole('tablist')).toBeNull();
    expect(inner().queryByRole('tab', { name: /^(bonus|malus)/i })).toBeNull();
    expect(inner().getByRole('region', { name: 'Le altre voci · prima i malus' })).toBeInTheDocument();
    expect(medalNames()).toEqual(['Tipi doppioni', 'Hazard doppio', 'Scudo del clima']);
    const [same, hazard, sun] = medals();
    expect(same).toHaveClass('malus');
    expect(same.querySelector('.bm-row-pts')).toHaveTextContent('−5');
    // Il caso intero nel testo (tagliato coi puntini solo a vista)
    expect(hazard).toHaveTextContent('Due setter di Stealth Rock · Due setter di Spikes');
    expect(hazard.querySelector('.bm-row-pts')).toHaveTextContent('−3');
    expect(sun).toHaveClass('bonus');
    expect(sun.querySelector('.bm-row-pts')).toHaveTextContent('+2');
    expect(document.querySelector('.bm-more-cell')).toBeNull();
    expect(screen.queryByRole('button', { name: /Mostra tutto il testo/ })).toBeNull();
  });

  it('col fuoco una medaglia mostra nome, punti e il caso intero nel tooltip DreamDex', async () => {
    const { user } = renderBm(catalogRating());
    await tabTo(user, medals()[1]);
    await waitFor(() => expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Hazard doppio−3'));
    expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Due setter di Stealth Rock');
    expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Due setter di Spikes');
  });

  it('se le medaglie non stanno nell\'altezza, l\'ultima casella è "+N altre" con le voci nascoste nel tooltip e per i lettori di schermo', async () => {
    // Misura finta: ogni casella della griglia è alta 50, la griglia 110 (ci stanno due caselle)
    const height = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('bm-list') ? this.children.length * 50 : 0;
    });
    const client = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('bm-list') ? 110 : 0;
    });
    try {
      const { user } = renderBm(catalogRating());
      // Una medaglia e la casella "+2 altre": due caselle
      expect(medalNames()).toEqual(['Tipi doppioni']);
      const more = document.querySelector<HTMLElement>('.bm-more-cell')!;
      expect(more).toHaveTextContent(/^\+2 altre/);
      expect(more.querySelector('.visually-hidden')).toHaveTextContent('Altre 2 voci: Hazard doppio −3: Due setter di Stealth Rock · Due setter di Spikes; Scudo del clima +2: Sole aiuta');
      await tabTo(user, more);
      await waitFor(() => expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Hazard doppio −3Due setter di Stealth Rock'));
      expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Scudo del clima +2Sole aiuta');
    } finally {
      height.mockRestore();
      client.mockRestore();
    }
  });

  it('il caso corto solo quando il lungo verrebbe tagliato; tooltip e lettori di schermo sempre col lungo', async () => {
    // Misura finta: la riga del caso è larga 260, il testo 7 per carattere
    const client = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('bm-row-case') ? 260 : 0;
    });
    const scroll = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('bm-row-case') ? 7 * (this.textContent ?? '').length : 0;
    });
    const hole = (type: string) => ({ text: `Nessuno regge ${type}`, points: 2, catalog: 'defenseHole', parts: { type } });
    const rating = {
      ...fakeRating([], []),
      penalty: { total: 7, items: [hole('Water'), hole('Electric'), hole('Grass'), { text: '3 membri di tipo Steel', points: 1, catalog: 'sameType', parts: { n: '3', type: 'Steel' } }] },
    } as unknown as TeamRating;
    try {
      const { user } = renderBm(rating);
      const [holes, same] = medals();
      // Lungo: 59 caratteri (413 > 260) → il corto, che sta (32 caratteri)
      const cut = holes.querySelector('.bm-row-case')!;
      expect(cut).toHaveClass('short');
      expect(cut).toHaveTextContent(/^Nessuno regge: Water, Electric, Grass$/);
      expect(cut).toHaveAttribute('aria-hidden', 'true');
      expect(holes.querySelector('.visually-hidden')).toHaveTextContent('Nessuno regge Water · Nessuno regge Electric · Nessuno regge Grass');
      // Il lungo sta (22 caratteri): resta il lungo anche se ha un corto
      expect(same.querySelector('.bm-row-case')).not.toHaveClass('short');
      expect(same.querySelector('.bm-row-case')).toHaveTextContent(/^3 membri di tipo Steel$/);
      expect(same.querySelector('.visually-hidden')).toBeNull();
      await tabTo(user, holes);
      await waitFor(() => expect(document.querySelector('.ftip.bm-row-tip')).toHaveTextContent('Nessuno regge WaterNessuno regge ElectricNessuno regge Grass'));
    } finally {
      client.mockRestore();
      scroll.mockRestore();
    }
  });

  it('senza bonus solo le medaglie dei malus; i problemi nella testata come nelle altre aree', () => {
    renderBm({ ...catalogRating(), bonus: { total: 0, items: [] } } as unknown as TeamRating);
    expect(medalNames()).toEqual(['Tipi doppioni', 'Hazard doppio']);
    expect(onGrade().querySelector('.bm-parts')).toHaveTextContent('Bonus 0·Malus −8');
    expect(document.querySelector('.area-tools-row')).toBeNull();
    expect(document.querySelector('.area-head .area-chip.good')).toHaveTextContent('Nessun problema');
  });

  it('netto verde se positivo; senza voci il netto è 0 grigio con "Né bonus né malus per ora" e nessuna griglia', () => {
    const { unmount } = render(<LangProvider lang="it"><AreaView rating={coreRating()} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent('+6');
    expect(onGrade().querySelector('.bm-net')).toHaveClass('good');
    unmount();
    renderBm(fakeRating([], []));
    expect(onGrade().querySelector('.bm-net')).toHaveTextContent(/^0$/);
    expect(onGrade().querySelector('.bm-net')).toHaveClass('zero');
    expect(onGrade()).toHaveTextContent('Né bonus né malus per ora');
    expect(document.querySelector('.bm-list')).toBeNull();
    expect(document.querySelector('.bm')).toHaveClass('empty');
  });

  it('"Tutte le voci possibili" apre il catalogo (la guida della scheda) sui bonus; all\'uscita il focus torna al link', async () => {
    const { user } = renderBm(catalogRating());
    const link = screen.getByRole('button', { name: /Tutte le voci possibili/ });
    await user.click(link);
    const dialog = screen.getByRole('dialog', { name: /Ruoli e Bonus/ });
    expect(within(dialog).getByRole('tab', { name: 'Tutti i bonus' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(6);
    expect(within(panel).getByText('Core', { selector: 'b' }).closest('li')).toHaveTextContent('Tre membri che si coprono le debolezze a vicenda');
    expect(within(panel).getByText('Core', { selector: 'b' }).closest('li')).toHaveTextContent('+3 per ogni core');
    await user.click(within(dialog).getByRole('tab', { name: 'Tutti i malus' }));
    expect(within(within(dialog).getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(12);
    expect(dialog).not.toHaveTextContent('Tera');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(link).toHaveFocus();
  });

  it('due core a tre: senza posto per due (qui, senza misure) aperto quello che regge più tipi, l\'altro è un pulsante che lo apre', async () => {
    const { user } = renderBm(coreRating());
    // Nel titolo quanti sono e quanto valgono, con la medaglia accesa
    const cores = screen.getByRole('region', { name: '2 Core +6' });
    expect(cores.querySelector('.bm-head-medal')).not.toHaveClass('off');
    const strong = within(cores).getByRole('button', { name: 'Core Fire / Ground / Poison' });
    const weak = within(cores).getByRole('button', { name: 'Core Fire / Water / Electric' });
    expect(strong).toHaveAttribute('aria-expanded', 'true');
    expect(weak).toHaveAttribute('aria-expanded', 'false');
    expect(within(cores).getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Heatran para Landorus-Therian da Fire')).toBeInTheDocument();
    await user.click(weak);
    expect(weak).toHaveAttribute('aria-expanded', 'true');
    expect(strong).toHaveAttribute('aria-expanded', 'false');
    expect(weak.closest('li')).toHaveClass('open');
    expect(within(weak.closest('li')!).getByText('Reggono 4/18')).toBeInTheDocument();
    // I core stanno solo nella carta in alto: nessuna medaglia sotto (contano però nel netto e in "Bonus +6")
    expect(document.querySelector('.bm-list')).toBeNull();
    expect(onGrade()).toHaveTextContent('Bonus +6');
  });

  it('i tipi retti da un core solo nel tooltip di "Reggono N/18" (col fuoco), per i lettori di schermo nella descrizione', async () => {
    const { user } = renderBm(coreRating());
    const cores = screen.getByRole('region', { name: '2 Core +6' });
    // Nella carta niente icone dei tipi retti
    expect(cores.querySelector('.bm-core-types')).toBeNull();
    const held = within(cores).getByText('Reggono 9/18');
    expect(held).toHaveAttribute('tabindex', '0');
    expect(held).toHaveAccessibleDescription(/^Reggono 9 tipi su 18\. Reggono: Heatran0, .*\. Passano: Pelipper0, /);
    await tabTo(user, held);
    await waitFor(() => expect(document.querySelector('.ftip.bm-held-tip')).toHaveTextContent('Reggono 9 tipi su 18'));
    const tip = document.querySelector<HTMLElement>('.ftip.bm-held-tip')!;
    expect(tip.querySelectorAll('.bm-core-types img.on')).toHaveLength(9);
    expect(tip.querySelectorAll('.bm-core-types img.off')).toHaveLength(9);
  });

  it('un core solo con posto per due: accanto il posto tratteggiato del secondo e quanto varrebbe', () => {
    // Misure finte: la carta è larga 900 e ne bastano 785 per due posti affiancati
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, bottom: 100, right: 900, width: 900, height: 100, toJSON: () => ({}) } as DOMRect);
    const original = window.getComputedStyle.bind(window);
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const css = original(el);
      const get = css.getPropertyValue.bind(css);
      css.getPropertyValue = (name: string) => (name === '--pair-min' ? '785px' : get(name));
      return css;
    });
    try {
      render(<LangProvider lang="it"><AreaView rating={coreRating([fakeCore(['Heatran', 'Landorus-Therian', 'Toxapex'], ['Fire', 'Ground', 'Poison'])])} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
      const one = screen.getByRole('region', { name: '1 Core +3' });
      expect(within(one).queryByRole('button')).toBeNull();
      expect(within(one).getByRole('heading', { name: /Fire \/ Ground \/ Poison/ })).toBeInTheDocument();
      const ghost = one.querySelector<HTMLElement>('.bm-core-ghost')!;
      expect(ghost.querySelector('svg.bm-cores-ghost')).not.toBeNull();
      expect(ghost).toHaveTextContent('Un secondo core vale altri +3');
      expect(ghost).toHaveTextContent('Tre membri che si coprono a vicenda: ognuno regge un tipo che fa male al successivo.');
      // Niente più colonna dei tipi retti accanto al core
      expect(one.querySelector('.bm-core-side, .bm-core-types')).toBeNull();
    } finally {
      rect.mockRestore();
      style.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('un core solo senza posto per due: prende tutta la carta; nessun core: il triangolo tratteggiato e come averne uno', () => {
    const { unmount } = render(<LangProvider lang="it"><AreaView rating={coreRating([fakeCore(['Heatran', 'Landorus-Therian', 'Toxapex'], ['Fire', 'Ground', 'Poison'])])} area="bonusMalus" team={[]} analysis={analyzeTeam([], fixtureData)} problems={[]} /></LangProvider>);
    const one = screen.getByRole('region', { name: '1 Core +3' });
    expect(one.querySelector('.bm-core-ghost')).toBeNull();
    expect(within(one).getByText('Reggono 9/18')).toBeInTheDocument();
    unmount();
    renderBm(catalogRating());
    const none = screen.getByRole('region', { name: 'Core' });
    expect(none).toHaveTextContent('Nessun core a tre');
    // Senza core la medaglia del titolo è spenta
    expect(none.querySelector('.bm-head-medal')).toHaveClass('off');
    expect(none.querySelector('svg.bm-cores-ghost')).not.toBeNull();
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

  it('col team incompleto il voto dice Incompleto · 2/6', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(plate()).toHaveTextContent('Incompleto · 2/6');
    expect(plate()!.title).toBe('Il tipo di team si riconosce con tutti e 6 i membri');
    expect(band().querySelector('.grade-badge .visually-hidden')).toHaveTextContent(/Incompleto · 2\/6$/);
  });
});
