import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { SuggestionsPanel } from '../../src/ui/SuggestionsPanel';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

// Il corpo del dettaglio "non ci sta" mai: scende per ogni versione fino alle linguette
let overflow = true;
const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return overflow && this.classList.contains('detail-body') ? 900 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.classList.contains('detail-body') ? 200 : this.matches('aside.detail') ? 300 : 0; } });
});
afterEach(() => {
  overflow = true;
  if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scroll);
  if (client) Object.defineProperty(HTMLElement.prototype, 'clientHeight', client);
});

const detail = () => screen.getByRole('complementary', { name: /^Dettaglio di/ });
const panel = (props: Partial<Parameters<typeof SuggestionsPanel>[0]> = {}) => renderIt(
  <SuggestionsPanel team={[tusk] as never} format={DEFAULT_FORMAT} data={fixtureData} replaceIndex={null}
    onAdd={() => {}} onReplaceWith={() => {}} onCancelReplace={() => {}} {...props} />);

describe('dettaglio: la versione che ci sta', () => {
  it('quando non entra passa a due linguette (Perché · Set consigliato); il set si vede col clic su «Set consigliato»', async () => {
    const user = userEvent.setup();
    panel({ teamCollapsed: true });
    const aside = detail();
    expect(aside).toHaveClass('tabbed');
    const tabs = within(aside).getByRole('tablist');
    const why = within(tabs).getByRole('tab', { name: 'Perché' });
    const setTab = within(tabs).getByRole('tab', { name: 'Set consigliato' });
    expect(why).toHaveAttribute('aria-selected', 'true');
    expect(within(aside).getByRole('heading', { name: 'Risolve' })).toBeInTheDocument();
    expect(within(aside).queryByRole('list', { name: 'Mosse' })).toBeNull();
    // Senza ResizeObserver (jsdom) nessuno misura l'altezza: niente versione bassa
    expect(aside).not.toHaveClass('compact');
    await user.click(setTab);
    expect(setTab).toHaveAttribute('aria-selected', 'true');
    expect(within(aside).getByRole('list', { name: 'Mosse' })).toBeInTheDocument();
    expect(within(aside).queryByRole('heading', { name: 'Risolve' })).toBeNull();
  });

  it('le linguette si cambiano con le frecce, e solo quella aperta è nel giro del Tab', async () => {
    const user = userEvent.setup();
    panel();
    const aside = detail();
    const why = within(aside).getByRole('tab', { name: 'Perché' });
    const setTab = within(aside).getByRole('tab', { name: 'Set consigliato' });
    expect(why).toHaveAttribute('tabindex', '0');
    expect(setTab).toHaveAttribute('tabindex', '-1');
    why.focus();
    await user.keyboard('{ArrowRight}');
    expect(setTab).toHaveFocus();
    expect(setTab).toHaveAttribute('aria-selected', 'true');
    expect(setTab).toHaveAttribute('tabindex', '0');
    expect(within(aside).getByRole('tabpanel')).toHaveAttribute('aria-labelledby', setTab.id);
    await user.keyboard('{ArrowLeft}');
    expect(why).toHaveFocus();
    expect(why).toHaveAttribute('aria-selected', 'true');
    // Dalla prima, a sinistra si torna all'ultima
    await user.keyboard('{ArrowLeft}');
    expect(setTab).toHaveFocus();
  });

  it('dettaglio più basso di 400 px: versione bassa (compact)', () => {
    const original = globalThis.ResizeObserver;
    // Un ResizeObserver finto che misura subito (il dettaglio è alto 300)
    globalThis.ResizeObserver = class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() { this.callback([], this as never); }
      unobserve() {}
      disconnect() {}
    } as never;
    try {
      overflow = false;
      panel();
      expect(detail()).toHaveClass('compact');
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it('se ci sta: due colonne, Perché (Risolve) e poi il set (dati, mosse, ruoli); niente linguette', () => {
    overflow = false;
    panel();
    const aside = detail();
    expect(within(aside).queryByRole('tablist')).toBeNull();
    expect(aside).not.toHaveClass('tabbed');
    expect(aside).not.toHaveClass('compact');
    const cols = aside.querySelector('.detail-cols')!;
    expect([...cols.children].map(el => el.className)).toEqual(['detail-why', 'detail-run']);
    expect(within(cols.querySelector('.detail-why') as HTMLElement).getByRole('heading', { name: 'Risolve' })).toBeInTheDocument();
    const set = cols.querySelector('.detail-run')!;
    expect([...set.children].map(el => el.getAttribute('class')?.split(' ')[0])).toEqual(['visually-hidden', 'mcard-kit', 'mcard-moves', 'mcard-roles']);
    // Le vecchie sezioni non ci sono più
    expect(aside.querySelector('.effect, .detail-areas, .meta-sec, .set-sec')).toBeNull();
  });

  it('con le linguette il verso delle aree resta nella testata, visibile anche sul set', async () => {
    const user = userEvent.setup();
    // Il verso delle aree c'è quando c'è un voto di prima (la card del voto)
    panel({ rating: rateTeam([tusk] as never, fixtureData) });
    const aside = detail();
    const marks = () => within(aside).queryByRole('list', { name: 'Effetto sul team' });
    expect(marks()!.closest('.detail-hero')).not.toBeNull();
    await user.click(within(aside).getByRole('tab', { name: 'Set consigliato' }));
    expect(marks()).toBeInTheDocument();
  });

  it('in Sostituisci restano due linguette (mai una per Costa): Perché mostra Risolve e Costa, chi esce sta sotto la testata', async () => {
    const user = userEvent.setup();
    panel({ team: [tusk, gholdengo] as never, replaceIndex: 1 });
    const aside = detail();
    expect(within(aside).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Perché', 'Set consigliato']);
    expect(within(aside).getByRole('button', { name: 'Sostituisci con questo' })).toBeInTheDocument();
    // Chi esce: "Esce Gholdengo", coi ruoli che il team perde; quei ruoli non si ripetono in Costa
    const swap = aside.querySelector('.detail-swap')!;
    expect(swap).toHaveTextContent(/^EsceGholdengoperde /);
    const lost = swap.querySelector('em')!.textContent!.replace(/^perde /, '').split(' · ');
    const costa = within(aside).getByRole('heading', { name: 'Costa' }).closest('.why-part')!;
    for (const role of lost) expect(costa.textContent).not.toContain(role);
    expect(within(aside).getByRole('heading', { name: 'Risolve' })).toBeInTheDocument();
    expect(within(aside).getByRole('heading', { name: 'Costa' })).toBeInTheDocument();
    await user.click(within(aside).getByRole('tab', { name: 'Set consigliato' }));
    expect(within(aside).queryByRole('heading', { name: 'Risolve' })).toBeNull();
    expect(within(aside).queryByRole('heading', { name: 'Costa' })).toBeNull();
    // La striscia di chi esce resta, fuori dalle linguette
    expect(aside.querySelector('.detail-swap')).not.toBeNull();
  });

  it('aggiungendo restano due linguette anche quando non entra, e niente striscia di chi esce', () => {
    panel();
    expect(within(detail()).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Perché', 'Set consigliato']);
    expect(detail().querySelector('.detail-swap')).toBeNull();
  });
});
