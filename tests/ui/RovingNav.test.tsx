import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaView } from '../../src/ui/AreaView';
import { useRoving } from '../../src/ui/useRoving';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

// jsdom non disegna: ogni pezzo ha un riquadro dalla sua riga e colonna (data-r, data-c), 40×20 px
const box = (el: Element) => {
  const r = Number(el.getAttribute('data-r') ?? -1);
  const c = Number(el.getAttribute('data-c') ?? -1);
  return r < 0 ? new DOMRect(0, 0, 0, 0) : new DOMRect(c * 40, r * 20, 40, 20);
};

function Grid() {
  const nav = useRoving<HTMLTableElement>();
  // Tre righe; nella seconda manca la colonna 1 (una casella senza pezzo)
  const rows = [[0, 1, 2], [0, 2], [0, 1, 2]];
  return (
    <table ref={nav.ref} aria-label="griglia" onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
      <tbody>
        {rows.map((cols, r) => (
          <tr key={r}>{cols.map(c => <td key={c} data-nav="" data-r={r} data-c={c}>{`${r}-${c}`}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

describe('useRoving: un posto nel giro del Tab, le frecce dentro', () => {
  afterEach(() => vi.restoreAllMocks());

  it('il Tab entra sul primo pezzo; frecce, Home ed End si muovono come sullo schermo; il Tab torna sull\'ultimo toccato', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) { return box(this); });
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      return [box(this)] as unknown as DOMRectList;
    });
    const user = userEvent.setup();
    render(<><button type="button">prima</button><Grid /><button type="button">dopo</button></>);
    const cell = (text: string) => screen.getByText(text);
    // Un solo pezzo col tabindex 0
    expect(document.querySelectorAll('[data-nav][tabindex="0"]')).toHaveLength(1);
    await user.tab();
    await user.tab();
    expect(cell('0-0')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cell('0-1')).toHaveFocus();
    // Giù dalla colonna 1: nella riga sotto manca, va sulla più vicina (a parità la prima)
    await user.keyboard('{ArrowDown}');
    expect(cell('1-0')).toHaveFocus();
    await user.keyboard('{End}');
    expect(cell('1-2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cell('2-2')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(cell('2-0')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(cell('0-0')).toHaveFocus();
    // Fermo ai bordi
    await user.keyboard('{ArrowLeft}');
    expect(cell('0-0')).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(cell('2-2')).toHaveFocus();
    // Il Tab esce dalla griglia in un colpo e, tornando indietro, rientra sull'ultimo pezzo toccato
    await user.tab();
    expect(screen.getByRole('button', { name: 'dopo' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(cell('2-2')).toHaveFocus();
    expect(document.querySelectorAll('[data-nav][tabindex="0"]')).toHaveLength(1);
  });
});

/** Tab fino all'elemento (il fuoco da tastiera, come nel browser). */
async function tabTo(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
  for (let i = 0; i < 20 && document.activeElement !== el; i++) await user.tab();
  expect(el).toHaveFocus();
}

describe('tooltip DreamDex anche col fuoco da tastiera', () => {
  const team = [
    { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
    { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
  ];

  it('Offesa, Generale: i pezzi sono un posto solo nel giro del Tab; col fuoco il tooltip coi bersagli, Esc lo chiude; i bersagli anche nella descrizione', async () => {
    const user = userEvent.setup();
    const rating = rateTeam(team, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="strength" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    const table = screen.getByRole('table', { name: 'Offesa: Generale' });
    const pieces = table.querySelectorAll<HTMLElement>('.kob');
    expect(pieces.length).toBeGreaterThan(4);
    // Uno solo raggiungibile col Tab
    expect([...pieces].filter(p => p.tabIndex === 0)).toHaveLength(1);
    const first = [...pieces].find(p => p.tabIndex === 0)!;
    await tabTo(user, first);
    await waitFor(() => expect(document.querySelector('.ftip.kot')).not.toBeNull());
    // Nella descrizione per lo screen reader gli stessi bersagli del tooltip
    const desc = document.getElementById(first.getAttribute('aria-describedby')!)!;
    expect(desc.textContent!.length).toBeGreaterThan(0);
    expect(document.querySelector('.ftip.kot')).toHaveTextContent(desc.textContent!.split(/[,.] /)[0]);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.ftip.kot')).toBeNull());
    expect(first).toHaveFocus();
    // Uscendo dal pezzo il tooltip non si riapre
    act(() => first.blur());
    expect(document.querySelector('.ftip.kot')).toBeNull();
  });

  it('Difesa, Coverage tipi: la griglia è un posto solo; col fuoco su una casella il tooltip del colpo', async () => {
    const user = userEvent.setup();
    const rating = rateTeam(team, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const table = screen.getByRole('table', { name: 'Difesa: Coverage tipi' });
    const reachable = table.querySelectorAll<HTMLElement>('[tabindex="0"]');
    expect(reachable).toHaveLength(1);
    // Col Tab si entra sulla prima testata (il tooltip dell'attaccante), poi giù e a destra fino a una casella
    await tabTo(user, reachable[0]);
    await waitFor(() => expect(document.querySelector('.ftip.tst')).not.toBeNull());
    const cell = table.querySelector<HTMLElement>('tbody td.ht-cell')!;
    act(() => cell.focus());
    await waitFor(() => expect(document.querySelector('.ftip.dht')).not.toBeNull());
    // La casella toccata diventa quella del Tab
    expect(cell.tabIndex).toBe(0);
    expect(table.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });
});
