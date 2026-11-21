import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { CARD_WAKE_MS } from '../../src/ui/CandidateCard';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const list = () => suggestions().querySelector<HTMLElement>('.suggestions')!;
/** Il posto in classifica, letto dal nome (per gli screen reader: "11. Nome"). */
const rankOf = (row: Element) => parseInt(row.querySelector('.pick strong')!.textContent!, 10);
const rowNames = () => [...list().querySelectorAll('.name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('SuggestionsPanel', () => {
  it('"/" fuori da un campo porta il cursore nella ricerca; dentro un campo si scrive e basta', async () => {
    const user = await setup();
    const search = screen.getByLabelText('Aggiungi Pokémon');
    expect(search).toHaveAttribute('placeholder', 'Cerca un Pokémon… ( / )');
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('/');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
    await user.keyboard('/');
    expect(search).toHaveValue('/');
  });

  it('ordina i suggerimenti per il voto che darebbero al team', async () => {
    await setup('Great Tusk', 'Gholdengo');
    // Corviknight, Kingambit, Rotom-Wash, Toxapex (Dragapult è Uber in National Dex)
    expect(list().querySelectorAll('li')).toHaveLength(4);
    const grades = within(list()).getAllByLabelText(/^Voto del team: [SABCD] \d+ \((\+\d+|−\d+|±0)\)$/)
      .map(cell => Number(/ (\d+) \(/.exec(cell.getAttribute('aria-label')!)![1]));
    expect(grades).toHaveLength(4);
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
  });

  it('il dettaglio mostra il primo candidato: quanto sale il voto del team, in tutto e per area', async () => {
    const user = await setup('Great Tusk');
    // La riga per area c'è solo nella versione estesa (team chiuso)
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));

    const first = rowNames()[0];
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${first}` });
    expect(detail.querySelector('.detail-score')).toHaveTextContent(/^(\+\d+|−\d+|±0)voto del team [SABCD] \d+ → [SABCD] \d+$/);
    const areas = [...detail.querySelectorAll('.detail-areas dt')].map(dt => dt.textContent);
    expect(areas).toEqual(expect.arrayContaining(['Difesa', 'Offesa']));
    expect(within(detail).getByRole('list', { name: 'Mosse' }).children.length).toBeGreaterThan(0);
  });

  it('cliccare un altro candidato lo apre nel dettaglio', async () => {
    const user = await setup('Great Tusk');
    const second = rowNames()[1];
    const pick = () => within(list()).getByRole('button', { name: new RegExp(`${second}$`) });
    expect(pick()).toHaveAttribute('aria-pressed', 'false');
    await user.click(pick());
    expect(pick()).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${second}` });
    await user.click(within(detail).getByRole('button', { name: 'Aggiungi al team' }));
    expect(within(team()).getByText(second)).toBeInTheDocument();
  });

  it('la scelta fatta resta; quando sparisce dalla lista nuova il dettaglio torna al n°1, senza spostare il fuoco', async () => {
    const user = await setup('Great Tusk');
    const second = rowNames()[1];
    await user.click(within(list()).getByRole('button', { name: new RegExp(`${second}$`) }));
    expect(screen.getByRole('complementary', { name: `Dettaglio di ${second}` })).toBeInTheDocument();
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${second}` });
    await user.click(within(detail).getByRole('button', { name: 'Aggiungi al team' }));
    // Il candidato aggiunto non è più nella lista: il dettaglio mostra il nuovo n°1, mai il riquadro vuoto
    expect(rowNames()).not.toContain(second);
    expect(screen.getByRole('complementary', { name: `Dettaglio di ${rowNames()[0]}` })).toBeInTheDocument();
    expect(document.querySelector('.detail-empty')).toBeNull();
    expect(document.activeElement?.closest('.detail')).toBeNull();
  });

  it("team vuoto: niente voto da confrontare, si mostra l'uso nel meta", async () => {
    const user = await setup();
    // La riga per area c'è solo nella versione estesa (team chiuso)
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));

    // Nessuna nota sopra la lista: si parte dalla lista stessa
    expect(within(suggestions()).queryByText(/come si adatta al team/)).toBeNull();
    const usages = within(list()).getAllByLabelText(/^Uso nel meta \d/).map(cell => parseFloat(cell.getAttribute('aria-label')!.replace('Uso nel meta ', '').replace(',', '.')));
    expect(usages).toEqual([...usages].sort((a, b) => b - a));
    const detail = screen.getByRole('complementary', { name: /^Dettaglio di / });
    expect(detail.querySelector('.detail-score')).toHaveTextContent(/uso nel meta$/);
    expect(within(detail).getByText('Voto con lui da solo')).toBeInTheDocument();
    expect(detail.querySelector('.detail-areas .change')!.textContent).toBe('');
    // Un'area a zero col team vuoto non sembra un errore: si legge "—"
    expect([...detail.querySelectorAll('.detail-areas .value')].map(v => v.textContent)).not.toContain('0');
    // I ruoli del set nella lastra della testata, con la spiegazione nel tooltip
    const slab = detail.querySelector('.detail-why')!;
    expect(slab.getAttribute('aria-label')).toMatch(/^Ruoli del set: /);
    expect(slab.getAttribute('title')).toBeTruthy();
  });

  it('sulle carte niente segno "Spesso usati insieme" (i compagni del meta stanno nel dettaglio)', async () => {
    await setup('Great Tusk', 'Gholdengo');
    expect(within(list()).queryByText(/Spesso usati insieme/)).toBeNull();
    expect(list().querySelector('.alert-mark .icon-spark, [data-icon="spark"]')).toBeNull();
  });

  it('Carte: pagine da 6, la seconda continua la numerazione', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'a');
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    expect(rowNames()).toHaveLength(6);
    expect(within(pager).getByRole('button', { name: 'Pagina precedente' })).toBeDisabled();
    await user.click(within(pager).getByRole('button', { name: 'Pagina successiva' }));
    expect(within(pager).getByRole('status', { name: 'Pagina 2' })).toBeInTheDocument();
    expect(rankOf(list().querySelector('li')!)).toBe(7);
  });

  it('aggiunge un suggerimento al team', async () => {
    const user = await setup('Great Tusk');
    await user.click(within(suggestions()).getAllByRole('button', { name: 'Aggiungi al team' })[0]);
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
  });

  it('team completo: raccomandazioni libere, ognuna dice chi esce', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex');
    // Niente titolo sopra la lista: la modalità scelta lo dice già
    expect(within(suggestions()).queryByRole('heading', { name: 'Migliora il team' })).toBeNull();
    expect(within(suggestions()).getByRole('button', { name: 'Sostituisci' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toBeDisabled();
    // Chi esce: la tendina attaccata a Sostituisci dice Tutti; aperta, Tutti è scelto
    const toggle = within(suggestions()).getByRole('button', { name: 'Chi sostituire: Tutti' });
    expect(toggle).toHaveTextContent('Tutti');
    await user.click(toggle);
    expect(within(screen.getByRole('group', { name: 'Chi sostituire' })).getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    // Dal voto più alto; ogni riga dice chi esce, e il doppio clic fa lo scambio
    const grades = within(list()).getAllByLabelText(/^Voto del team: /).map(cell => Number(/ (\d+) \(/.exec(cell.getAttribute('aria-label')!)![1]));
    expect(grades.length).toBeGreaterThan(0);
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
    const first = list().querySelector('li')!;
    const out = within(first).getAllByText(/^Al posto di /)[0].textContent!.replace('Al posto di ', '');
    // Chi esce sta nella targhetta del +N, subito dopo il numero: ⇄ e la mini icona, senza nome ("Esce X" nel tooltip,
    // "Al posto di X" agli screen reader); sotto il nome la riga "vs" come nelle altre modalità
    const cards = [...list().querySelectorAll(':scope > li')];
    for (const card of cards) {
      const mark = card.querySelector('.tag > .out')!;
      expect(mark).not.toBeNull();
      expect(mark.previousElementSibling!.tagName).toBe('STRONG');
      const member = mark.querySelector('.visually-hidden')!.textContent!.replace('Al posto di ', '');
      expect(mark).toHaveAttribute('title', `Esce ${member}`);
      expect(mark.querySelector('.icon')).not.toBeNull();
      expect(mark.querySelector('.out-mon .mon-icon')).not.toBeNull();
      expect(mark.querySelector('.out-mon')).toHaveAttribute('aria-hidden', 'true');
      expect(card.querySelector('.out-row')).toBeNull();
    }
    // I motivi tornano come nelle altre modalità: tutte le righe che entrano (--reasons), nessuna presa da chi esce
    const rows = Number(list().style.getPropertyValue('--reasons'));
    expect(rows).toBeGreaterThan(1);
    expect(first.querySelectorAll('.who small > .reason')).toHaveLength(rows);
    expect(first.querySelector('.tag .out')).toHaveAttribute('title', `Esce ${out}`);
    const name = rowNames()[0];
    await user.dblClick(first.querySelector<HTMLElement>('.result')!);
    expect(within(team()).getByText(name)).toBeInTheDocument();
    expect(within(team()).queryByText(out)).toBeNull();
    // Sei Pokémon scritti a mano più il calcolo degli scambi: sotto il carico di tutta la suite servono più dei 15 s di base
  }, 60000);

  it('team completo: scegliere un membro mostra solo i suoi sostituti; Tutti torna agli scambi liberi', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex');
    const targets = () => screen.getByRole('group', { name: 'Chi sostituire' });
    const toggle = () => within(suggestions()).getByRole('button', { name: /^Chi sostituire: / });
    await user.click(toggle());
    await user.click(within(targets()).getByRole('button', { name: 'Sostituisci Toxapex' }));
    // Scelto un membro la tendina si chiude e mostra la sua icona al posto di "Tutti"
    expect(screen.queryByRole('group', { name: 'Chi sostituire' })).toBeNull();
    expect(toggle()).toHaveAccessibleName('Chi sostituire: Toxapex');
    expect(toggle()).not.toHaveTextContent('Tutti');
    expect(within(list()).queryAllByText(/^Al posto di /)).toHaveLength(0);
    await user.click(toggle());
    expect(within(targets()).getByRole('button', { name: 'Sostituisci Toxapex' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(targets()).getByRole('button', { name: 'Tutti' }));
    expect(toggle()).toHaveAccessibleName('Chi sostituire: Tutti');
  }, 60000);

  it('team incompleto: da Aggiungi a Sostituisci e ritorno', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    const mode = (name: string) => within(suggestions()).getByRole('button', { name });
    expect(mode('Aggiungi')).toHaveAttribute('aria-pressed', 'true');
    await user.click(mode('Sostituisci'));
    expect(mode('Sostituisci')).toHaveAttribute('aria-pressed', 'true');
    await user.click(mode('Aggiungi'));
    expect(mode('Aggiungi')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sostituzione: modalità, diff e sostituzione del membro', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    await user.click(screen.getByRole('button', { name: 'Sostituisci Great Tusk' }));
    expect(within(suggestions()).getByRole('button', { name: 'Sostituisci' })).toHaveAttribute('aria-pressed', 'true');
    // Ogni riga dice il guadagno principale (e la perdita principale) del cambio
    expect([...list().querySelectorAll('.who small')].some(el => /^[+−]/.test(el.textContent!))).toBe(true);
    expect(within(suggestions()).queryByRole('button', { name: 'Sostituto simile' })).toBeNull();

    await user.click(within(suggestions()).getAllByRole('button', { name: 'Sostituisci con questo' })[0]);
    expect(within(team()).queryByText('Great Tusk')).toBeNull();
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('il pager sta nella fascia Candidati', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'a');
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    const head = within(suggestions()).getByRole('heading', { name: /^Candidati \(\d+\)$/ }).parentElement!;
    expect(head).toContainElement(pager);
    // In fondo alla lista non c'è più un altro pager
    expect(within(suggestions()).getAllByRole('navigation')).toHaveLength(1);
    expect(list().nextElementSibling?.tagName).not.toBe('NAV');
    expect(within(head).getByText('doppio clic: aggiungi')).toBeInTheDocument();
    // Una riga sola: niente più "BOX n/N", solo ‹ trattini ›
    expect(head.textContent).not.toMatch(/BOX/);
    const buttons = within(pager).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Pagina precedente');
    expect(buttons[buttons.length - 1]).toHaveAccessibleName('Pagina successiva');
    await user.click(within(pager).getByRole('button', { name: 'Pagina successiva' }));
    expect(within(pager).getByRole('status', { name: 'Pagina 2' })).toBeInTheDocument();
  });

  it('chi esce è una tendina attaccata a Sostituisci, nella barra comandi', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituisci' }));
    const toggle = within(suggestions()).getByRole('button', { name: 'Chi sostituire: Tutti' });
    // Terzo pezzo dello stesso pulsante di Aggiungi / Sostituisci
    expect(toggle.closest('[role="group"]')).toHaveAccessibleName('Aggiungi o sostituisci');
    expect(screen.queryByRole('group', { name: 'Chi sostituire' })).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: 'Chi sostituire' });
    expect(group.closest('.toolbar')).not.toBeNull();
    expect(suggestions().querySelector('.subbar')).toBeNull();
    // Nella tendina i membri con icona e nome
    const member = within(group).getByRole('button', { name: 'Sostituisci Great Tusk' });
    expect(member).toHaveTextContent('Great Tusk');
    expect(within(group).getByText('Esce')).toBeInTheDocument();
    // Esc chiude e il focus torna al pulsante
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Chi sostituire' })).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('Carte col team aperto: al massimo due motivi sotto il nome, senza malus', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex');
    const first = list().querySelector<HTMLElement>('li')!;
    expect(first.querySelectorAll('.reason').length).toBeGreaterThanOrEqual(1);
    expect(first.querySelectorAll('.reason').length).toBeLessThanOrEqual(2);
    expect(first.querySelector('.reason')!.textContent).toMatch(/\S/);
    expect(first.querySelector('.loss')).toBeNull();
  }, 60000);

  it('frecce oltre la pagina: si passa alla successiva', async () => {
    const user = await setup('Great Tusk');
    const search = screen.getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'a');
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    for (let i = 0; i < 6; i++) await user.keyboard('{ArrowDown}');
    expect(within(pager).getByRole('status', { name: 'Pagina 2' })).toBeInTheDocument();
    expect(rankOf(list().querySelector('.picked')!)).toBe(7);
    // E indietro, prima della prima, alla precedente
    await user.keyboard('{ArrowUp}');
    expect(within(pager).getByRole('status', { name: 'Pagina 1' })).toBeInTheDocument();
    expect(rankOf(list().querySelector('.picked')!)).toBe(6);
  });

  it('un cambio senza bonus: "nessuna differenza", mai un malus come motivo', async () => {
    const { reasonsOf } = await import('../../src/ui/candidateParts');
    const none = { roles: [], covers: [], resists: [] };
    const item = {
      species: 'Pelipper', set: { species: 'Pelipper', moves: [] }, score: 0, components: {}, tags: [], penalty: 0, facts: {},
      diff: { gains: none, losses: none, lostResists: [] },
      reasons: [{ component: 'synergy', weight: -1, text: 'La pioggia si scontra con il sole' }],
    } as never;
    expect(reasonsOf(item, 2, null, DEFAULT_FORMAT, 'it')).toEqual({ pros: false, items: [{ text: 'Nessuna differenza rilevante', short: 'Nessuna differenza rilevante' }] });
  });

  it('il voto sale senza un motivo da mostrare: l\'area che sale di più, non "nessuna differenza"', async () => {
    const { reasonsOf } = await import('../../src/ui/candidateParts');
    const none = { roles: [], covers: [], resists: [] };
    const base = {
      species: 'Pelipper', set: { species: 'Pelipper', moves: [] }, score: 0, components: {}, tags: [], penalty: 0, facts: {},
      diff: { gains: none, losses: none, lostResists: [] }, reasons: [],
    };
    const shorts = (teamGain: object) => reasonsOf({ ...base, teamGain } as never, 2, null, DEFAULT_FORMAT, 'it').items.map(b => b.short);
    expect(shorts({ gain: 9, grade: 'B', overall: 70, areaGains: [{ label: 'Offesa', change: 13 }, { label: 'Difesa', change: 2 }], extras: 0 })).toEqual(['Offesa +13']);
    expect(shorts({ gain: 3, grade: 'B', overall: 70, areaGains: [], extras: 3 })).toEqual(['Bonus/Malus +3']);
    expect(shorts({ gain: 0, grade: 'B', overall: 70, areaGains: [{ label: 'Offesa', change: 4 }], extras: -4 })).toEqual(['Nessuna differenza rilevante']);
  });

  it('caselle a segni: icone al posto delle parole, la frase intera per screen reader e tooltip', async () => {
    const { Reasons } = await import('../../src/ui/candidateParts');
    const { renderIt } = await import('../helpers/italian');
    const items = [
      { text: 'Colpisce super efficace Acqua, Erba, scoperti dal team', short: 'Colpisce Acqua, Erba', symbol: { kind: 'coverage', types: ['Water', 'Grass'] } },
      { text: 'Immune a Terra e resiste a Volante: debolezze del team', short: 'Immune a Terra e resiste a Volante', symbol: { kind: 'defense', immune: ['Ground'], resists: ['Flying'] } },
      { text: 'Ferma Zapdos', short: 'Ferma Zapdos', symbol: { kind: 'threats', species: ['Zapdos'] } },
      { text: 'Ferma Zapdos, Kingambit', short: 'Ferma Zapdos, Kingambit', symbol: { kind: 'threats', species: ['Zapdos', 'Kingambit'] } },
      { text: 'Abilita Venusaur: Siccità → Clorofilla', short: 'Abilita Venusaur', symbol: { kind: 'link', species: 'Venusaur' } },
      { text: 'Pivot', short: 'Pivot' },
    ] as never[];
    const { container } = renderIt(<Reasons reasons={{ pros: true, items }} />);
    const reasons = [...container.querySelectorAll<HTMLElement>('.reason')];
    // Testo letto: "+" e la frase intera (le icone sono decorative)
    const spoken = (el: HTMLElement) => [...el.querySelectorAll('.visually-hidden')].map(e => e.textContent).join(' ');
    expect(spoken(reasons[0])).toBe('+ Colpisce super efficace Acqua, Erba, scoperti dal team');
    expect(reasons[0]).toHaveAttribute('title', 'Colpisce super efficace Acqua, Erba, scoperti dal team');
    expect(reasons[0].querySelector('.sym')).toHaveAttribute('aria-hidden', 'true');
    // La spada + i chip dei due tipi
    expect(reasons[0].querySelector('.sym-icon .icon')).not.toBeNull();
    expect(reasons[0].querySelectorAll('.sym .type-chip')).toHaveLength(2);
    // Lo scudo, poi l'immune (per primo, senza segni in più: a parole nel tooltip) e la resistenza
    expect(reasons[1].querySelector('.sym-icon .icon')).not.toBeNull();
    const chips = [...reasons[1].querySelectorAll('.sym-chip')];
    expect(chips.map(c => c.querySelectorAll('.icon').length)).toEqual([0, 0]);
    expect(chips[0]).toHaveAttribute('title', expect.stringMatching(/^Immune a /));
    expect(chips[1]).not.toHaveAttribute('title');
    expect(reasons[1].querySelectorAll('.sym .type-chip')).toHaveLength(2);
    // vs: il primo col pallino del tipo e il nome, come nel dettaglio; gli altri "+N" (niente mini sprite)
    expect(reasons[2].querySelector('.sym')!.textContent).toBe('VSZapdos');
    expect(reasons[3].querySelector('.sym')!.textContent).toBe('VSZapdos+1');
    expect(reasons[3].querySelectorAll('.sym .mon-icon')).toHaveLength(0);
    expect(reasons[3].querySelectorAll('.sym .type-dot')).toHaveLength(1);
    expect(reasons[4].querySelector('.sym')!.textContent).toBe('Venusaur');
    expect(reasons[4].querySelector('.sym-icon .icon')).not.toBeNull();
    // I ruoli restano parole, senza tooltip
    expect(reasons[5].textContent).toBe('++Pivot');
    expect(reasons[5]).not.toHaveAttribute('title');
  });

  it("Aggiungi: le ragioni che pesano di più in forma breve, quante ne entrano (senza l'uso nel meta)", async () => {
    const { reasonsOf } = await import('../../src/ui/candidateParts');
    const reason = (component: string, weight: number, text: string, short: string) => ({ component, weight, text, short });
    const item = {
      species: 'Rotom-Wash', set: { species: 'Rotom-Wash', moves: [], ability: 'Levitate', item: 'Leftovers', nature: 'Bold', evs: {}, ivs: {} }, score: 0, components: {}, tags: [], penalty: 0, facts: {},
      reasons: [
        reason('strength', 9, 'Uso nel meta: 20%', 'Uso nel meta: 20%'),
        reason('defense', 5, 'Resiste ad Acqua: debolezze del team', 'Resiste ad Acqua'),
        { ...reason('synergy', 4.5, 'Usato con Great Tusk nel 30% dei team', 'Usato con Great Tusk nel 30% dei team'), usedWith: true },
        reason('synergy', 3, 'Abilita Venusaur: Siccità → Clorofilla', 'Abilita Venusaur'),
        reason('roles', 4, 'Porta Pivot (mancanti nel team)', 'Pivot'),
        reason('coverage', 1, 'Colpisce super efficace Fuoco, scoperti dal team', 'Colpisce Fuoco'),
      ],
    } as never;
    const shorts = (n: number) => reasonsOf(item, n, null, DEFAULT_FORMAT, 'it');
    expect(shorts(1).pros).toBe(true);
    expect(shorts(1).items.map(b => b.short)).toEqual(['Resiste ad Acqua']);
    // "Usato con" mai nelle caselle (lo dice il segno ciano), "Abilita" sì
    expect(shorts(3).items.map(b => b.short)).toEqual(['Resiste ad Acqua', 'Pivot', 'Abilita Venusaur']);
    // Col team vuoto i ruoli, uno per riga col "+" verde come i bonus (quanti ne entrano)
    const roles = reasonsOf({ ...(item as object), set: { species: 'Rotom-Wash', moves: ['Volt Switch'], ability: 'Levitate', item: 'Leftovers', nature: 'Bold', evs: {}, ivs: {} } } as never, 1, 0.2, DEFAULT_FORMAT, 'it');
    expect(roles.pros).toBe(true);
    expect(roles.items).toHaveLength(1);
    expect(roles.items[0].short).not.toContain(',');
  });

  it('Porta: il dettaglio raggruppa le voci per tipo (ruoli, difesa, offesa, minacce, sinergie) senza "Usato con"; le caselle le prime voci in ordine di peso', async () => {
    const { bringsOf, reasonsOf } = await import('../../src/ui/candidateParts');
    const { SuggestionDetail } = await import('../../src/ui/SuggestionDetail');
    const { formatRules } = await import('../../src/engine/formatRules');
    const { renderIt } = await import('../helpers/italian');
    const reason = (component: string, weight: number, text: string, short: string) => ({ component, weight, text, short });
    const set = { species: 'Rotom-Wash', item: 'Leftovers', ability: 'Levitate', moves: ['Hydro Pump'], nature: 'Bold', evs: { hp: 252 } };
    const item = {
      species: 'Rotom-Wash', set, score: 50, components: {}, tags: [], penalty: 0, facts: { clashes: [] },
      reasons: [
        { ...reason('synergy', 9, 'Usato con Great Tusk nel 30% dei team', 'Usato con Great Tusk (30%)'), usedWith: true },
        reason('coverage', 1, 'Colpisce super efficace Fuoco, scoperti dal team', 'Colpisce Fuoco'),
        reason('defense', 5, 'Resiste ad Acqua: debolezze del team', 'Resiste ad Acqua'),
        reason('synergy', 3, 'Abilita Venusaur: Siccità → Clorofilla', 'Abilita Venusaur'),
        reason('roles', 4, 'Porta Pivot (mancanti nel team)', 'Pivot'),
        reason('threats', 2, 'Ferma Kingambit', 'Ferma Kingambit'),
      ],
    } as never;
    renderIt(<SuggestionDetail item={item} rank={2} team={[]} replaceIndex={null} data={fixtureData} format={DEFAULT_FORMAT} rating={null} usage={null} banMark={null} actionLabel="Aggiungi al team" onAction={() => {}} />);
    const porta = screen.getByRole('heading', { name: 'Porta' }).closest('section')!;
    // I gruppi sempre nello stesso ordine, ognuno con le sue voci; "Usato con" no (è un dato del meta)
    const groups = [...porta.querySelectorAll('.bring-group')];
    expect(groups.map(g => [...g.classList].find(c => c !== 'bring-group'))).toEqual(['roles', 'defense', 'offense', 'threats', 'synergy']);
    const texts = (kind: string) => [...porta.querySelectorAll(`.bring-group.${kind} li`)].map(li => li.textContent);
    // Difesa, Offesa e Minacce nella forma breve (il gruppo dice già il resto), la frase intera nel tooltip
    expect(texts('defense')).toEqual(['Resiste ad Acqua']);
    expect(texts('offense')).toEqual(['Colpisce Fuoco']);
    expect(texts('threats')).toEqual(['Ferma Kingambit']);
    expect(porta.querySelector('.bring-group.offense li')).toHaveAttribute('title', 'Colpisce super efficace Fuoco, scoperti dal team');
    expect(texts('synergy')).toEqual(['Abilita Venusaur: Siccità → Clorofilla']);
    expect(porta.textContent).not.toMatch(/Usato con/);
    // Le caselle: le prime voci in ordine di peso, in forma breve, senza "Usato con"
    const brings = bringsOf(item, 'it', formatRules(DEFAULT_FORMAT.formatId)).filter(b => !b.usedWith);
    expect(brings.map(b => b.text)).toEqual(['Resiste ad Acqua: debolezze del team', 'Porta Pivot (mancanti nel team)', 'Abilita Venusaur: Siccità → Clorofilla', 'Ferma Kingambit', 'Colpisce super efficace Fuoco, scoperti dal team']);
    for (const n of [1, 2, 3]) {
      const { items } = reasonsOf(item, n, null, DEFAULT_FORMAT, 'it');
      expect(items.map(b => b.short)).toEqual(brings.slice(0, n).map(b => b.short));
    }
  });

  it('niente pulsante rapido nelle caselle: si aggiunge col doppio clic o dal dettaglio', async () => {
    await setup('Great Tusk');
    expect(list().querySelector('li button.quick')).toBeNull();
    // Nella casella l'unico pulsante è il nome (apre il dettaglio)
    expect([...list().querySelector('li')!.querySelectorAll('button')].map(b => b.className)).toEqual(['pick']);
  });

  it('senza dati: messaggio', () => {
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    expect(within(suggestions()).getByText('Servono i dati Smogon per i suggerimenti. Puoi comunque cercare un Pokémon per nome.')).toBeInTheDocument();
  });
});

describe('dettaglio: abilità in battaglia', () => {
  it('gli avvisi (meteo in conflitto) non finiscono in Porta: aggiungendo compaiono in Toglie', async () => {
    const { SuggestionDetail } = await import('../../src/ui/SuggestionDetail');
    const { renderIt } = await import('../helpers/italian');
    const set = { species: 'Pelipper', item: 'Damp Rock', ability: 'Drizzle', moves: ['Hurricane'], nature: 'Bold', evs: { hp: 252 } };
    const clash = '⚠ La pioggia si scontra con il sole di Torkoal';
    const item = {
      species: 'Pelipper', set, score: 50, components: {}, tags: [], penalty: 5,
      facts: { clashes: [clash] },
      reasons: [{ component: 'roles', weight: 2, text: 'Porta Pivot' }, { component: 'synergy', weight: -1, text: clash }],
    } as never;
    renderIt(<SuggestionDetail item={item} rank={2} team={[]} replaceIndex={null} data={fixtureData} format={DEFAULT_FORMAT} rating={null} usage={null} banMark={null} actionLabel="Aggiungi al team" onAction={() => {}} />);
    const porta = screen.getByRole('heading', { name: 'Porta' }).closest('section')!;
    expect(porta.textContent).not.toMatch(/pioggia/);
    const toglie = screen.getByRole('heading', { name: 'Toglie' }).closest('section')!;
    expect(toglie.textContent).toMatch(/La pioggia si scontra/);
  });

  it('Porta: niente "Usato con" nel dettaglio (è un dato del meta), le altre voci nei loro gruppi', async () => {
    const { SuggestionDetail } = await import('../../src/ui/SuggestionDetail');
    const { renderIt } = await import('../helpers/italian');
    const set = { species: 'Rotom-Wash', item: 'Leftovers', ability: 'Levitate', moves: ['Hydro Pump'], nature: 'Bold', evs: { hp: 252 } };
    const item = {
      species: 'Rotom-Wash', set, score: 50, components: {}, tags: [], penalty: 0, facts: { clashes: [] },
      reasons: [
        { component: 'synergy', weight: 9, text: 'Usato con Great Tusk nel 30% dei team', short: '', usedWith: true },
        { component: 'defense', weight: 5, text: 'Resiste ad Acqua: debolezze del team', short: '' },
        { component: 'roles', weight: 2, text: 'Porta Pivot (mancanti nel team)', short: '' },
      ],
    } as never;
    renderIt(<SuggestionDetail item={item} rank={2} team={[]} replaceIndex={null} data={fixtureData} format={DEFAULT_FORMAT} rating={null} usage={null} banMark={null} actionLabel="Aggiungi al team" onAction={() => {}} />);
    const porta = screen.getByRole('heading', { name: 'Porta' }).closest('section')!;
    expect(porta.textContent).not.toMatch(/Usato con/);
    expect([...porta.querySelectorAll('.bring-group')].map(g => [...g.classList].find(c => c !== 'bring-group'))).toEqual(['roles', 'defense']);
  });

  it('con la Megapietra mostra l\u2019abilità della Mega; "Stats" solo nel dettaglio', async () => {
    const { SuggestionDetail } = await import('../../src/ui/SuggestionDetail');
    const { renderIt } = await import('../helpers/italian');
    const set = { species: 'Venusaur', item: 'Venusaurite', ability: 'Chlorophyll', moves: ['Giga Drain'], nature: 'Bold', evs: { hp: 252 } };
    const item = { species: 'Venusaur-Mega', set, score: 50, components: { defense: 0, coverage: 0, roles: 0 }, facts: {}, reasons: [], tags: [], penalty: 0 } as never;
    renderIt(<SuggestionDetail item={item} rank={2} team={[]} replaceIndex={null} data={fixtureData} format={DEFAULT_FORMAT} rating={null} usage={null} banMark={null} actionLabel="Aggiungi al team" onAction={() => {}} />);
    expect(screen.getByText('Thick Fat')).toBeInTheDocument();
    expect(screen.queryByText('Chlorophyll')).toBeNull();
  });

  it('le righe della lista non hanno il badge Stats', async () => {
    await setup('Great Tusk');
    expect(list().querySelector('.stats-badge')).toBeNull();
    expect(screen.getByRole('complementary', { name: /^Dettaglio di / }).querySelector('.stats-badge')).not.toBeNull();
  });

  it('stall: la Velocità nel dettaglio conta (10%), quindi non è grigia e non ha la nota', async () => {
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
    // La riga per area c'è solo nella versione estesa (team chiuso)
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    const areas = screen.getByRole('complementary', { name: /^Dettaglio di / }).querySelector('.detail-areas')!;
    // Dal 2026-11-03 nessuna area è inattiva nello stall: niente grigio, niente nota
    expect(areas.querySelector('.inactive')).toBeNull();
    const speed = [...areas.querySelectorAll('div')].find(d => d.querySelector('dt')?.textContent === 'Velocità')!;
    expect(speed).toBeDefined();
    expect(speed.querySelector('dt')).not.toHaveAttribute('aria-description');
    expect(speed.querySelector('.change')).not.toBeNull();
  });
});

describe('riga della lista', () => {
  const FULL = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex'];

  it('Migliora: chi esce col nome, un bonus e al massimo un malus, niente voto sotto il +N', async () => {
    await setup(...FULL);
    const first = list().querySelector<HTMLElement>('li')!;
    const out = first.querySelector<HTMLElement>('.tag .out')!;
    expect(FULL.some(name => out.textContent!.includes(name))).toBe(true);
    const summary = first.querySelector('.who small')!.textContent!;
    expect(summary.match(/(^|· )\+/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(summary.match(/(^|· )−/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(first.querySelector('.result small')).toBeNull();
    expect(first.querySelector('.tags')).toBeNull();
  }, 60000);

  it('doppio clic sulla riga fa lo scambio', async () => {
    const user = await setup(...FULL);
    const first = list().querySelector<HTMLElement>('li')!;
    const name = rowNames()[0];
    await user.dblClick(first.querySelector<HTMLElement>('.result')!);
    expect(within(team()).getByText(name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
  }, 60000);

  it('doppio clic sulla casella: aggiunge una volta sola; sul nome solo lo apre', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { emptySet } = await import('../../src/engine/sets');
    const added: string[] = [];
    const user = userEvent.setup();
    renderIt(<SuggestionsPanel team={[{ ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush'] }]} format={DEFAULT_FORMAT} data={fixtureData}
      replaceIndex={null} onAdd={set => added.push(set.species)} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    await user.dblClick(list().querySelector<HTMLElement>('li button.pick')!);
    expect(added).toHaveLength(0);
    await user.dblClick(list().querySelector<HTMLElement>('li .result')!);
    expect(added).toHaveLength(1);
  });

  it("focus su un candidato all'11° posto: pagina 2, lui nel dettaglio, ricerca azzerata", async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { fixtureStats, tusk } = await import('../fixtures/data');
    // Più di 10 candidati senza filtri: statistiche di prova allargate
    const base = fixtureStats.pokemon['Corviknight'];
    const extra = ['Skarmory', 'Heatran', 'Clefable', 'Garchomp', 'Ferrothorn', 'Tyranitar', 'Slowbro', 'Zapdos', 'Hippowdon', 'Blissey', 'Excadrill', 'Weavile'];
    const pokemon = { ...fixtureStats.pokemon, ...Object.fromEntries(extra.map((n, i) => [n, { ...base, usage: 0.05 - i * 0.002, moves: {}, abilities: {}, items: {}, teammates: {}, checks: {} }])) };
    const data = { stats: { ...fixtureStats, pokemon }, sets: {} };
    const user = userEvent.setup();
    const props = { team: [tusk], format: DEFAULT_FORMAT, data, replaceIndex: null, onAdd: () => {}, onReplaceWith: () => {}, onCancelReplace: () => {} };
    const { rerender } = renderIt(<SuggestionsPanel {...props} />);
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    await user.click(within(pager).getByRole('button', { name: 'Pagina successiva' }));
    const eleventh = rowNames()[0];
    await user.click(within(pager).getByRole('button', { name: 'Pagina precedente' }));
    expect(rowNames()).not.toContain(eleventh);
    // Una ricerca rimasta nel campo non deve nascondere il candidato
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gho');
    rerender(<SuggestionsPanel {...props} focus={{ species: eleventh, mode: 'add', nonce: 1 }} />);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${eleventh}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(within(screen.getByRole('navigation', { name: 'Pagine dei suggerimenti' })).getByRole('status', { name: 'Pagina 2' })).toBeInTheDocument();
    expect(rowNames()).toContain(eleventh);
  });

  it('Aggiungi: niente "chi esce"', async () => {
    await setup('Great Tusk');
    expect(list().querySelector('.out')).toBeNull();
    expect(list().querySelector('li .who small')!.textContent).toMatch(/\S/);
  });
});

describe('scheda del candidato', () => {
  const FULL = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex'];
  const detail = () => screen.getByRole('complementary', { name: /^Dettaglio di / });
  const section = (name: string) => within(detail()).getByRole('heading', { name }).closest('section')!;

  it('Migliora: prima cosa porta e cosa toglie, niente più Perché', async () => {
    const user = await setup(...FULL);
    expect(within(detail()).getByRole('heading', { name: 'Porta' })).toBeInTheDocument();
    expect(within(detail()).getByRole('heading', { name: 'Toglie' })).toBeInTheDocument();
    expect(within(detail()).queryByRole('heading', { name: 'Perché' })).toBeNull();
    expect(section('Porta').textContent).not.toMatch(/Uso nel meta/);
    // Senza la versione estesa niente riga per area; col team chiuso c'è
    expect(detail().querySelector('.detail-areas')).toBeNull();
    // La riga per area c'è solo nella versione estesa (team chiuso)
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    expect(section('Effetto sul team').querySelector('.detail-areas')).toHaveTextContent(/Difesa/);
  }, 60000);

  it("team vuoto: la riga dice i ruoli, non ripete l'uso già a destra", async () => {
    await setup();
    expect(list().querySelector('li .who small')!.textContent).not.toMatch(/Uso nel meta/);
  });

  it('team vuoto: Porta dice cosa sa fare il Pokémon, non "nessuna differenza"', async () => {
    await setup();
    expect(section('Porta').textContent).not.toMatch(/Nessuna differenza/);
    expect(section('Porta').querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('Aggiungi: solo Porta, senza uso nel meta', async () => {
    await setup('Great Tusk');
    expect(within(detail()).getByRole('heading', { name: 'Porta' })).toBeInTheDocument();
    expect(within(detail()).queryByRole('heading', { name: 'Toglie' })).toBeNull();
    expect(section('Porta').textContent).not.toMatch(/Uso nel meta/);
  });
});

describe('stile Carte', () => {
  async function renderCards(team: unknown[]) {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    renderIt(<SuggestionsPanel team={team as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
  }

  it('Carte: tipi come icone e +N sulla targhetta', async () => {
    const { tusk } = await import('../fixtures/data');
    const { getSpecies } = await import('../../src/engine/dex');
    const { typeName } = await import('../../src/i18n/game');
    await renderCards([tusk]);
    expect(list()).toHaveClass('cards');
    const first = list().querySelector<HTMLElement>('li')!;
    expect(first).toHaveClass('card');
    // Tipi come icone tonde (decorative), il nome dei tipi nel tooltip; nessun chip
    const types = getSpecies(rowNames()[0])!.types;
    const icons = first.querySelector('.type-icons')!;
    expect(icons.querySelectorAll('img')).toHaveLength(types.length);
    expect(icons).toHaveAttribute('title', types.map(type => typeName(type, 'it')).join(' / '));
    expect([...first.querySelectorAll('.type-chip')].filter(c => !c.closest('.reason'))).toHaveLength(0);
    // Quanto sale il voto, sulla targhetta in alto a sinistra
    expect(first.querySelector('.tag')!.textContent).toMatch(/^(\+\d+|−\d+|±0)$/);
  });

  it('Carte col team vuoto: uso nel meta al posto di +N', async () => {
    await renderCards([]);
    const tag = list().querySelector<HTMLElement>('li .tag')!;
    expect(tag).toHaveAttribute('aria-label', expect.stringMatching(/^Uso nel meta \d/));
    expect(tag.textContent).toMatch(/^\d+(,\d+)?\s?%/);
    expect(tag.textContent).not.toMatch(/^[+−±]/);
  });

  it('Carte: il #1 che peggiora o resta pari non è magenta (−N .worse, ±0 .same)', async () => {
    const { CandidateCard } = await import('../../src/ui/CandidateCard');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const card = (gain: number) => {
      const item = { species: 'Great Tusk', set: tusk, score: 0, components: {}, tags: [], penalty: 0, reasons: [],
        facts: { clashes: [] }, teamGain: { gain, grade: 'B', overall: 70 } } as never;
      const { container, unmount } = renderIt(
        <ol><CandidateCard rank={1} item={item} reasons={{ pros: false, items: [{ text: 'x', short: 'x' }] }} sprite={() => null} usage={null} actionLabel="a"
          selected={false} onSelect={() => {}} onAction={() => {}} format={DEFAULT_FORMAT} /></ol>);
      const li = container.querySelector('li.card')!;
      const result = { first: li.classList.contains('first'), strong: li.querySelector('.tag strong')!.className, text: li.querySelector('.tag')!.textContent };
      unmount();
      return result;
    };
    expect(card(-2)).toEqual({ first: false, strong: 'worse', text: '−2' });
    expect(card(0)).toEqual({ first: false, strong: 'same', text: '±0' });
    expect(card(5)).toEqual({ first: true, strong: '', text: '+5' });
  });
});

describe('sprite animato delle carte', () => {
  it('Carte: solo la carta sotto il mouse e la selezionata chiedono lo sprite animato', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const { fireEvent } = await import('@testing-library/react');
    {
      const { unmount } = renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
        onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
      const cards = [...list().querySelectorAll<HTMLElement>('.card')];
      expect(cards.length).toBeGreaterThan(1);
      const animated = () => [...list().querySelectorAll('.card')].filter(card => card.querySelector('.sprite-ani'));
      // A riposo solo la selezionata (la prima)
      expect(cards[0].classList.contains('selected')).toBe(true);
      expect(animated()).toEqual([cards[0]]);
      vi.useFakeTimers();
      try {
        // Sotto il mouse lo sprite esce (e parte la GIF) solo dopo CARD_WAKE_MS fermi sulla carta
        fireEvent.mouseEnter(cards[1]);
        expect(animated()).toEqual([cards[0]]);
        expect(cards[1].querySelector('.card-sprite.popped')).toBeNull();
        act(() => { vi.advanceTimersByTime(CARD_WAKE_MS); });
        expect(animated()).toEqual([cards[0], cards[1]]);
        expect(cards[1].querySelector('.card-sprite.popped')).not.toBeNull();
        fireEvent.mouseLeave(cards[1]);
        expect(animated()).toEqual([cards[0]]);
        expect(cards[1].querySelector('.card-sprite.popped')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
      unmount();
    }
  });

  it('Carte: passando di corsa sopra una carta lo sprite non esce e la GIF non si chiede', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const { fireEvent } = await import('@testing-library/react');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    const cards = [...list().querySelectorAll<HTMLElement>('.card')];
    vi.useFakeTimers();
    try {
      fireEvent.mouseEnter(cards[1]);
      act(() => { vi.advanceTimersByTime(CARD_WAKE_MS - 20); });
      fireEvent.mouseLeave(cards[1]);
      fireEvent.mouseEnter(cards[2]);
      act(() => { vi.advanceTimersByTime(CARD_WAKE_MS - 20); });
      fireEvent.mouseLeave(cards[2]);
      act(() => { vi.advanceTimersByTime(1000); });
      for (const card of cards.slice(1)) {
        expect(card.querySelector('.sprite-ani')).toBeNull();
        expect(card.querySelector('.card-sprite.popped')).toBeNull();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('Carte: un tocco sul telefono non sveglia la carta (niente sprite fuori, niente GIF); il mouse sì', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const { fireEvent } = await import('@testing-library/react');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    const cards = [...list().querySelectorAll<HTMLElement>('.card')];
    vi.useFakeTimers();
    try {
      // Il tocco: prima il puntatore (touch), poi il finto mouseenter del browser
      fireEvent.pointerEnter(cards[1], { pointerType: 'touch' });
      fireEvent.mouseEnter(cards[1]);
      act(() => { vi.advanceTimersByTime(CARD_WAKE_MS + 50); });
      expect(cards[1].querySelector('.card-sprite.popped')).toBeNull();
      expect(cards[1].querySelector('.sprite-ani')).toBeNull();
      fireEvent.mouseLeave(cards[1]);
      // Lo stesso con il mouse: la carta si sveglia
      fireEvent.pointerEnter(cards[1], { pointerType: 'mouse' });
      fireEvent.mouseEnter(cards[1]);
      act(() => { vi.advanceTimersByTime(CARD_WAKE_MS); });
      expect(cards[1].querySelector('.card-sprite.popped')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
    // Il ritardo del CSS arriva dallo stesso numero
    expect(cards[1].style.getPropertyValue('--wake')).toBe(`${CARD_WAKE_MS}ms`);
  });

  it("la lastra della testata: il ruolo principale e quanti altri, l'elenco intero per i lettori di schermo e nel tooltip", async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    const detail = screen.getByRole('complementary', { name: /^Dettaglio di / });
    const slab = detail.querySelector('.detail-hero .detail-why')!;
    const roles = slab.getAttribute('aria-label')!.replace('Ruoli del set: ', '').split(', ');
    expect(roles.length).toBeGreaterThan(0);
    expect(new Set(roles).size).toBe(roles.length);
    // A vista il principale (il primo dell'elenco) e "+N" per gli altri
    expect(slab.textContent).toBe(roles.length > 1 ? `${roles[0]} +${roles.length - 1}` : roles[0]);
    expect(slab.getAttribute('title')).toBeTruthy();
  });

  it('Meta nel dettaglio solo col team chiuso: uso e compagni più frequenti', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const props = { team: [tusk] as never, format: DEFAULT_FORMAT, data: fixtureData, replaceIndex: null,
      onAdd: () => {}, onReplaceWith: () => {}, onCancelReplace: () => {} };
    const { rerender } = renderIt(<SuggestionsPanel {...props} />);
    const detail = () => screen.getByRole('complementary', { name: /^Dettaglio di / });
    expect(within(detail()).queryByRole('heading', { name: 'Meta' })).toBeNull();
    rerender(<SuggestionsPanel {...props} teamCollapsed />);
    const meta = within(detail()).getByRole('heading', { name: 'Meta' }).closest('section')!;
    expect(meta).toHaveTextContent(/\d.*uso nel meta/);
    expect(meta.querySelectorAll('.meta-mates li').length).toBeLessThanOrEqual(5);
  });

  it('Icona box: la forma da battaglia (Mega con la pietra), non la specie base', async () => {
    const { BoxIcon } = await import('../../src/ui/candidateParts');
    const { Icons } = await import('@pkmn/img');
    // jsdom scarta la posizione nel foglio delle icone: si guarda quale icona viene chiesta
    const getPokemon = vi.spyOn(Icons, 'getPokemon');
    try {
      render(<BoxIcon set={{ species: 'Metagross', item: 'Metagrossite', moves: [] } as never} />);
      expect(getPokemon.mock.calls.map(([name]) => name)).toEqual(['Metagross-Mega']);
    } finally {
      getPokemon.mockRestore();
    }
  });
});

describe('tipi del candidato per gli screen reader', () => {
  it('Carte: i nomi dei tipi come testo nascosto, le icone restano decorative', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const { typeName } = await import('../../src/i18n/game');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    const corviknight = [...list().children].find(li => li.querySelector('.name-line strong')!.textContent!.endsWith('Corviknight'))!;
    expect(corviknight.querySelector('.type-icons')).toHaveAttribute('aria-hidden', 'true');
    const names = ['Flying', 'Steel'].map(type => typeName(type, 'it')).join(' / ');
    expect(corviknight.querySelector('.type-icons + .visually-hidden')?.textContent).toBe(names);
  });
});

describe('nome dei candidati con la forma', () => {
  it('la specie base e la forma come etichetta; il nome intero resta per i lettori di schermo', async () => {
    const { formeParts } = await import('../../src/ui/candidateParts');
    expect(formeParts('Charizard-Mega-Y')).toEqual({ base: 'Charizard', forme: 'Mega Y' });
    expect(formeParts('Ogerpon-Wellspring')).toEqual({ base: 'Ogerpon', forme: 'Wellspring' });
    expect(formeParts('Urshifu-Rapid-Strike')).toEqual({ base: 'Urshifu', forme: 'Rapid Strike' });
    expect(formeParts('Great Tusk')).toBeNull();
  });
});

describe('carta Pedana', () => {
  it('solo la carta selezionata ha la luce dall’alto, non quella sotto il mouse', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    const { fireEvent } = await import('@testing-library/react');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    const cards = [...list().querySelectorAll<HTMLElement>('.card')];
    expect(cards.length).toBeGreaterThan(2);
    expect(cards[0].classList.contains('beam-on')).toBe(true);
    expect(cards.slice(1).some(card => card.classList.contains('beam-on'))).toBe(false);
    vi.useFakeTimers();
    try {
      fireEvent.mouseEnter(cards[2]);
      act(() => { vi.advanceTimersByTime(CARD_WAKE_MS + 50); });
      expect(cards[2].classList.contains('beam-on')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
    // Ogni carta ha la pedana e la luce (spenta) nel suo palco
    for (const card of cards) {
      expect(card.querySelector('.pedana-stage .pedana-disc')).not.toBeNull();
      expect(card.querySelector('.pedana-beam')).not.toBeNull();
    }
  });

  it('ogni carta ha i colori dei due tipi per la riga in cima', async () => {
    const { SuggestionsPanel } = await import('../../src/ui/SuggestionsPanel');
    const { renderIt } = await import('../helpers/italian');
    const { tusk } = await import('../fixtures/data');
    renderIt(<SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
      onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} />);
    for (const card of list().querySelectorAll<HTMLElement>('.card')) {
      expect(card.style.getPropertyValue('--t1')).not.toBe('');
      expect(card.style.getPropertyValue('--t2')).not.toBe('');
    }
  });
});

describe('motivi delle carte', () => {
  it('i motivi partono da sinistra, con 2 px fra una riga e l’altra; una riga troppo larga finisce coi puntini', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/suggestions.css'), 'utf8');
    const rule = css.match(/\.reason\.has-sym \{[^}]*\}/)![0];
    expect(rule).toContain('justify-content: flex-start');
    const box = css.match(/\.card \.who small \{[^}]*\}/)![0];
    expect(box).toContain('align-items: stretch');
    expect(box).toContain('gap: calc(2px + var(--foot-air) / 4)');
    expect(css).toMatch(/\.card \.reason \{[^}]*max-width: 100%/);
    expect(css).toMatch(/\.card \.reason \{[^}]*text-align: left/);
  });

  it('chi esce (Sostituisci): l’icona del box a grandezza vera, nitida', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/suggestions.css'), 'utf8');
    const icon = css.match(/\.card \.tag \.out-mon \.mon-icon \{[^}]*\}/)![0];
    expect(icon).not.toContain('scale(');
    expect(icon).toContain('image-rendering: pixelated');
  });
});
