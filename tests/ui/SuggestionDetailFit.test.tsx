import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { SuggestionsPanel } from '../../src/ui/SuggestionsPanel';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

// Il corpo del dettaglio "non ci sta" mai: scende per ogni versione fino alle linguette
let overflow = true;
const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return overflow && this.classList.contains('detail-body') ? 900 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.classList.contains('detail-body') ? 200 : 0; } });
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
  it('quando non entra scende fino alle linguette; il set si vede col clic su «Set consigliato»', async () => {
    const user = userEvent.setup();
    panel({ teamCollapsed: true });
    const aside = detail();
    const tabs = within(aside).getByRole('tablist');
    const brings = within(tabs).getByRole('tab', { name: 'Porta e Toglie' });
    const setTab = within(tabs).getByRole('tab', { name: 'Set consigliato' });
    expect(brings).toHaveAttribute('aria-selected', 'true');
    expect(within(aside).queryByRole('list', { name: 'Mosse' })).toBeNull();
    expect(aside.querySelector('.meta-sec')).toBeNull();
    expect(aside.classList.contains('compact')).toBe(true);
    await user.click(setTab);
    expect(setTab).toHaveAttribute('aria-selected', 'true');
    expect(within(aside).getByRole('list', { name: 'Mosse' })).toBeInTheDocument();
    expect(within(aside).queryByRole('heading', { name: 'Porta' })).toBeNull();
  });

  it('col team esteso, se ci sta: aree in cima, poi Porta, poi il set in una riga, poi il Meta; niente linguette', () => {
    overflow = false;
    panel();
    const aside = detail();
    expect(within(aside).queryByRole('tablist')).toBeNull();
    const order = [...aside.querySelectorAll('.detail-sec')].map(sec => sec.classList.contains('effect') ? 'aree' : sec.classList.contains('brings') ? 'porta' : sec.classList.contains('set-sec') ? 'set' : sec.classList.contains('meta-sec') ? 'meta' : '?');
    expect(order).toEqual(['aree', 'porta', 'set', 'meta']);
    // Il set in una riga: esagono, mosse, dati del set
    expect([...aside.querySelector('.set-sec .set-line')!.children].map(el => el.getAttribute('class')?.split(' ')[0])).toEqual(['mcard-hex', 'mcard-moves', 'mcard-kit']);
    expect(aside.classList.contains('compact')).toBe(false);
  });

  it('con le linguette le aree stanno nella prima (Porta e Toglie), non nel set', async () => {
    const user = userEvent.setup();
    panel();
    const aside = detail();
    expect(aside.querySelector('.effect')).not.toBeNull();
    await user.click(within(aside).getByRole('tab', { name: 'Set consigliato' }));
    expect(aside.querySelector('.effect')).toBeNull();
  });

  it('in Sostituisci, se due linguette non bastano, Porta, Toglie e Set hanno una linguetta ciascuno', async () => {
    const user = userEvent.setup();
    panel({ team: [tusk, gholdengo] as never, replaceIndex: 1 });
    const aside = detail();
    const tabs = within(aside).getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toEqual(['Porta', 'Toglie', 'Set consigliato']);
    expect(within(aside).getByText(/al posto di Gholdengo/i)).toBeInTheDocument();
    expect(within(aside).queryByRole('heading', { name: 'Toglie' })).toBeNull();
    await user.click(within(aside).getByRole('tab', { name: 'Toglie' }));
    expect(within(aside).getByRole('heading', { name: 'Toglie' })).toBeInTheDocument();
    expect(within(aside).queryByRole('heading', { name: 'Porta' })).toBeNull();
  });

  it('aggiungendo (niente Toglie) restano due linguette anche quando non entra', () => {
    panel();
    expect(within(detail()).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Porta e Toglie', 'Set consigliato']);
  });
});
