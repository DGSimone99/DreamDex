import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DuelTipsResult, MetaShift } from '../../src/engine/duelTips';
import { DuelTips } from '../../src/ui/DuelTips';
import { gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const me = { ...tusk, evs: { hp: 4, atk: 252, spe: 252 }, moves: ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'] };
const defSet = { ...me, evs: { hp: 4, atk: 220, spe: 252, spd: 32 } };
const shifts: MetaShift[] = Array.from({ length: 11 }, (_, i) => ({ species: `Mon${i}`, before: 2, after: 3 }));
const moveSet = (slot: number) => ({ ...me, moves: me.moves.map((m, i) => (i === slot ? 'Earthquake' : m)) });
const fakeResult: DuelTipsResult = {
  overall: 80,
  tips: [
    { id: 'def', row: 'theirs', add: { spd: 32 }, move: null, best: 0,
      options: [{ set: defSet, taken: { atk: 32 }, replaced: null, overall: 79, effects: [{ kind: 'dealLess', shifts }] }] },
    { id: 'move', row: 'mine', add: {}, move: 'Earthquake', best: 2,
      options: [0, 1, 2, 3].map(slot => ({ set: moveSet(slot), taken: {}, replaced: me.moves[slot], overall: slot === 2 ? 81 : 77, effects: [] })) },
  ],
};
const quick = [{ id: 'def' as const, label: '+32 DifSp' }, { id: 'move' as const, label: 'Terremoto' }];

describe('consigli della Sfida: chip e scheda', () => {
  it('senza consigli la riga resta, grigia', () => {
    renderIt(<DuelTips me={me} opp={gholdengo} quick={[]} result={{ overall: 80, tips: [] }} />);
    expect(screen.getByText(/Consigli/)).toBeInTheDocument();
    expect(screen.getByText(/nessuno/)).toBeInTheDocument();
  });

  it('un chip senza consiglio nel risultato sparisce', () => {
    renderIt(<DuelTips me={me} opp={gholdengo} quick={[...quick, { id: 'spe', label: '+12 Vel' }]} result={fakeResult} />);
    expect(screen.queryByRole('button', { name: '+12 Vel' })).toBeNull();
  });

  it('clic sul chip: scheda con voto, Applica manda il set e il cambio', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderIt(<DuelTips me={me} opp={gholdengo} quick={quick} result={fakeResult} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: '+32 DifSp' }));
    const card = screen.getByRole('dialog');
    expect(within(card).getByText('80 → 79')).toBeInTheDocument();
    expect(within(card).getByText(/Tolti da Att 252 → 220/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Applica' }));
    expect(onApply).toHaveBeenCalledWith(defSet, '+32 EV in DifSp, −32 in Att');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('il tooltip del meta mostra al massimo 8 Pokémon e "e altri N"', async () => {
    const user = userEvent.setup();
    renderIt(<DuelTips me={me} opp={gholdengo} quick={quick} result={fakeResult} />);
    await user.click(screen.getByRole('button', { name: '+32 DifSp' }));
    await user.hover(screen.getByRole('button', { name: /11 Pokémon del meta/ }));
    expect(await screen.findByText('e altri 3')).toBeInTheDocument();
    expect(screen.getAllByText(/^Mon\d+$/)).toHaveLength(8);
  });

  it('mossa: parte dalla scelta migliore, cambiare la mossa da togliere cambia voto e cambio', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderIt(<DuelTips me={me} opp={gholdengo} quick={quick} result={fakeResult} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'Terremoto' }));
    const card = screen.getByRole('dialog');
    expect(within(card).getByText('80 → 81')).toBeInTheDocument();
    await user.click(within(card).getByRole('combobox', { name: 'Al posto di' }));
    await user.click(screen.getByRole('option', { name: /Ice Spinner/ }));
    expect(within(card).getByText('80 → 77')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Applica' }));
    expect(onApply).toHaveBeenCalledWith(moveSet(1), 'Ice Spinner → Earthquake');
  });

  it('mentre calcola: Applica disabilitato', async () => {
    const user = userEvent.setup();
    renderIt(<DuelTips me={me} opp={gholdengo} quick={quick} result={null} />);
    await user.click(screen.getByRole('button', { name: '+32 DifSp' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Applica' })).toBeDisabled();
  });

  it('Esc sul chip chiude solo la scheda (non arriva a chi sta sopra, cioè all editor)', async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    renderIt(<div onKeyDown={e => { if (e.key === 'Escape') outer(); }}><DuelTips me={me} opp={gholdengo} quick={quick} result={fakeResult} /></div>);
    const chip = screen.getByRole('button', { name: '+32 DifSp' });
    await user.click(chip);
    expect(chip).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outer).not.toHaveBeenCalled();
    expect(chip).toHaveFocus();
  });

  it('Velocità: prima → dopo dice chi muove primo', async () => {
    const user = userEvent.setup();
    const slow = { ...me, item: 'Leftovers', nature: 'Brave', evs: { hp: 4, atk: 252, def: 252 } };
    const fast = { ...slow, item: 'Choice Scarf', evs: { hp: 4, atk: 252, spe: 252 } };
    const result: DuelTipsResult = { overall: 80, tips: [{ id: 'spe', row: 'speed', add: { spe: 100 }, move: null, best: 0,
      options: [{ set: fast, taken: { def: 252 }, replaced: null, overall: 80, effects: [] }] }] };
    renderIt(<DuelTips me={slow} opp={gholdengo} quick={[{ id: 'spe', label: '+100 Vel' }]} result={result} />);
    await user.click(screen.getByRole('button', { name: '+100 Vel' }));
    const card = screen.getByRole('dialog');
    expect(card).toHaveTextContent(/Secondo \d+.*Primo \d+/);
  });

  it('due righe indipendenti: sotto il suo colpo la difesa, sotto il tuo attacco, mossa e Velocità', () => {
    const all = [...quick, { id: 'spe' as const, label: '+12 Vel' }];
    const withSpe: DuelTipsResult = { ...fakeResult, tips: [...fakeResult.tips, { id: 'spe', row: 'speed', add: { spe: 12 }, move: null, best: 0, options: [] }] };
    const { unmount } = renderIt(<DuelTips side="theirs" me={me} opp={gholdengo} quick={all} result={withSpe} />);
    expect(screen.getByRole('button', { name: '+32 DifSp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terremoto' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+12 Vel' })).toBeNull();
    unmount();
    renderIt(<DuelTips side="mine" me={me} opp={gholdengo} quick={all} result={withSpe} />);
    expect(screen.getByRole('button', { name: 'Terremoto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+12 Vel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+32 DifSp' })).toBeNull();
  });

  it('una riga senza consigli dice nessuno anche se l altra ne ha', () => {
    renderIt(<DuelTips side="theirs" me={me} opp={gholdengo} quick={[{ id: 'move', label: 'Terremoto' }]} result={null} />);
    expect(screen.getByText(/nessuno/)).toBeInTheDocument();
  });

  it('scheda di una mossa: in testata la pillola della mossa (tipo e linguetta con la potenza), come nella Sfida', async () => {
    const user = userEvent.setup();
    renderIt(<DuelTips me={me} opp={gholdengo} quick={quick} result={fakeResult} />);
    await user.click(screen.getByRole('button', { name: 'Terremoto' }));
    const pill = screen.getByRole('dialog').querySelector('.duel-tip-head .mvp');
    expect(pill).not.toBeNull();
    expect(pill).toHaveTextContent('Earthquake');
    expect(pill).toHaveTextContent('100');
    expect(screen.getByRole('dialog').querySelector('.duel-tip-source')).toHaveTextContent(/^Al posto di/);
  });
});
