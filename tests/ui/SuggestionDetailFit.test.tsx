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

  it('col team esteso, se ci sta, niente Meta né aree e niente linguette', () => {
    overflow = false;
    panel();
    const aside = detail();
    expect(within(aside).queryByRole('tablist')).toBeNull();
    expect(aside.querySelector('.meta-sec')).toBeNull();
    expect(aside.querySelector('.effect')).toBeNull();
    expect(aside.classList.contains('compact')).toBe(false);
  });

  it('a linguette, in Sostituisci, Porta e Toglie mostra Toglie e chi esce', () => {
    panel({ team: [tusk, gholdengo] as never, replaceIndex: 1 });
    const aside = detail();
    expect(within(aside).getByRole('tab', { name: 'Porta e Toglie' })).toHaveAttribute('aria-selected', 'true');
    expect(within(aside).getByRole('heading', { name: 'Toglie' })).toBeInTheDocument();
    expect(within(aside).getByText(/al posto di Gholdengo/i)).toBeInTheDocument();
  });
});
