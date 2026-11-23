import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpeedLane } from '../../src/engine/overviewDashboard';
import { SpeedTip } from '../../src/ui/dashboard/SpeedTip';
import { dmgText } from '../../src/ui/dmgText';
import { effWord } from '../../src/ui/effTag';
import { TipHost } from '../../src/ui/MoveTip';
import { signTone, TipDmg, TipRow, TipRows, TipType } from '../../src/ui/TipHead';
import { renderIt } from '../helpers/italian';
import { it as dict } from '../../src/i18n/it';

describe('righe dei tooltip (DESIGN.md, Tooltips)', () => {
  it('il danno come il calcolatore di Showdown: la forbice dei tiri senza decimali, il numero solo se non c\'è', () => {
    expect(dmgText(86, [79, 93])).toBe('79–93');
    expect(dmgText(100, [112, 132])).toBe('112–132');
    expect(dmgText(50, [50, 50])).toBe('50');
    expect(dmgText(86, null)).toBe('86');
    expect(dmgText(86)).toBe('86');
  });

  it('una riga di danno: nome, danno in Text, la fascia in fondo a destra (il colore lo dà solo il badge)', () => {
    renderIt(<TipRows><TipRow title="Great Tusk" value={<TipDmg pct={86} range={[79, 93]} side="off" band="two" />} /></TipRows>);
    const pct = document.querySelector('.tip-dmg-pct')!;
    expect(pct).toHaveTextContent(/^79–93%$/);
    expect(pct.className).toBe('tip-dmg-pct');
    const last = document.querySelector('.tip-dmg')!.lastElementChild!;
    expect(last).toHaveClass('ko-badge', 'off', 'two');
    expect(last).toHaveTextContent('2HKO');
  });

  it('l\'efficacia a parole, sempre accanto alla mossa; i punti col colore del segno; il tipo con la tessera e il nome in Text', () => {
    const t = ((key: string, params?: Record<string, string>) => (dict[key as keyof typeof dict] as string).replace('{m}', params?.m ?? '')) as Parameters<typeof effWord>[0];
    expect(effWord(t, 2, 'defense')).toBe('debole ×2');
    expect(effWord(t, 0.5, 'defense')).toBe('resiste ×½');
    expect(effWord(t, 0, 'defense')).toBe('immune');
    expect(effWord(t, 4, 'offense')).toBe('superefficace ×4');
    expect(effWord(t, 0.25, 'offense')).toBe('poco efficace ×¼');
    expect(effWord(t, 1, 'offense')).toBeNull();
    expect([signTone(6), signTone(-2), signTone(0)]).toEqual(['good', 'bad', undefined]);
    renderIt(<TipType type="Ghost" />);
    const type = document.querySelector('.tip-type')!;
    expect(type.querySelector('img.ti-sq.tip-type-tile')).not.toBeNull();
    expect(type).toHaveTextContent(/^(Spettro|Ghost)$/);
    expect(type.getAttribute('style')).toBeNull();
  });
});

describe('scala della Velocità', () => {
  const lane: SpeedLane = {
    species: 'Lopunny-Mega', speed: 405, share: 0.9, above: true, item: undefined,
    near: {
      faster: [{ species: 'Landorus-Therian', speed: 410, scarf: true, booster: false }],
      slower: [{ species: 'Iron Valiant', speed: 364, scarf: false, booster: true }],
      ties: [{ species: 'Tapu Koko', speed: 405, scarf: false, booster: false }],
    },
  };

  it('i nomi come sulle carte, la targhetta della Sciarpa e il segno del pari; il numero in testata in Text', () => {
    renderIt(<SpeedTip lane={lane} vsMeta />);
    // Niente "Lopunny-Mega" o "Landorus-Therian": il nome base e la forma piccola o il simbolo Mega
    expect(document.body).not.toHaveTextContent('Lopunny-Mega');
    expect(document.body).not.toHaveTextContent('Landorus-Therian');
    expect(document.querySelector('.tip-title .pick-name .mega-mark')).not.toBeNull();
    expect(document.querySelector('.stip-rung.ahead .pick-forme')).toHaveTextContent('Therian');
    // La Sciarpa sulla riga di chi corre con la Sciarpa, la Capsula su chi ha la Capsula
    const marks = screen.getAllByTestId('stip-item');
    expect(marks.map(m => m.textContent)).toEqual(['Sciarpa', 'Capsula']);
    expect(marks[0].closest('.stip-rung')).toHaveClass('ahead');
    expect(marks[0].querySelector('.item-icon, img')).not.toBeNull();
    // Chi ha la tua stessa velocità: la riga gialla col segno "pari"
    const tie = screen.getByTestId('stip-tie');
    expect(tie).toHaveTextContent('pari');
    expect(tie.closest('.stip-rung')).toHaveClass('tie');
    expect(tie.closest('.stip-rung')!.querySelector('.stip-speed')).toHaveTextContent('405');
    const num = document.querySelector('.tip-head .tip-num')!;
    expect(num).toHaveTextContent(/^405$/);
    expect(num.children).toHaveLength(0);
  });
});

describe('un fumetto alla volta', () => {
  it('il fumetto piccolo (data-hint) non resta sopra un tooltip DreamDex che si apre', async () => {
    const user = userEvent.setup();
    renderIt(<><TipHost /><span data-hint="Erba / Acciaio">tessera</span></>);
    await user.hover(screen.getByText('tessera'));
    await waitFor(() => expect(document.querySelector('.ftip.hint')).not.toBeNull());
    // Si apre un tooltip ricco (come quello della pastiglia che contiene la tessera): il fumetto si chiude
    const rich = document.createElement('div');
    rich.className = 'ftip tht';
    act(() => { document.body.appendChild(rich); });
    await waitFor(() => expect(document.querySelector('.ftip.hint')).toBeNull());
    // E non si apre finché il tooltip ricco resta aperto
    await user.unhover(screen.getByText('tessera'));
    await user.hover(screen.getByText('tessera'));
    await new Promise(r => setTimeout(r, 250));
    expect(document.querySelector('.ftip.hint')).toBeNull();
    rich.remove();
  });
});
