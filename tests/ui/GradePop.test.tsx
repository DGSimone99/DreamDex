import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { importShowdown } from '../../src/engine/sets';
import { rolesTally } from '../../src/engine/rolesArea';
import { GradeBadge } from '../../src/ui/RatingPanel';
import { bonusMalusTotals } from '../../src/ui/BonusMalusView';
import { signed } from '../../src/ui/AreaDetail';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const TEAM = [
  'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Body Press\n- Iron Defense\n- Roost\n- Defog',
  'Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Toxic\n- Protect\n- Stealth Rock',
  'Zapdos @ Heavy-Duty Boots\nAbility: Static\nEVs: 248 HP / 8 SpA / 252 Spe\nTimid Nature\n- Thunderbolt\n- Hurricane\n- Taunt\n- Roost',
].join('\n\n');

const rated = () => rateTeam(importShowdown(TEAM).sets, fixtureData)!;

/** Il voto col team ridotto, con una zona "fuori" per i clic fuori dalla tendina. */
function setup(collapsed = true) {
  const onOpen = vi.fn();
  const rating = rated();
  renderIt(<div><button type="button">fuori</button><GradeBadge rating={rating} collapsed={collapsed} onOpen={onOpen} /></div>);
  return { user: userEvent.setup(), onOpen, rating };
}
const toggle = () => screen.getByRole('button', { expanded: false, name: /^Voto [SABCD], \d+ su 100/ });

describe('voto del team ridotto: la tendina delle aree', () => {
  it('il pulsante c\'è solo col team ridotto; col team aperto le righe restano nella carta', () => {
    setup(false);
    expect(document.querySelector('.grade-pop-toggle')).toBeNull();
    expect(screen.getByRole('button', { name: /^Offesa \d+, apri il dettaglio/ })).toBeInTheDocument();
  });

  it('chiuso: le tre aree restano a vista come barrette (solo disegno), col numero di ognuna', () => {
    const { rating } = setup();
    const mini = document.querySelector('.grade-pop-toggle .grade-mini')!;
    expect(mini).toHaveAttribute('aria-hidden', 'true');
    const rows = [...mini.querySelectorAll('.grade-mini-row')];
    expect(rows.map(r => r.querySelector('.grade-mini-label')?.textContent)).toEqual(['Off', 'Dif', 'Vel']);
    const value = (key: string) => String(rating.areas.find(a => a.key === key)!.value);
    expect(rows.map(r => r.querySelector('b')?.textContent)).toEqual([value('strength'), value('defense'), value('speed')]);
    expect(toggle()).toBeInTheDocument();
  });

  it('chiuso: niente righe; il pulsante dice cosa apre', () => {
    setup();
    const button = toggle();
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).not.toHaveAttribute('aria-controls');
    expect(document.querySelector('button.grade-area')).toBeNull();
  });

  it('si apre con le stesse righe e gli stessi numeri della carta, il focus sulla prima', async () => {
    const { user, rating } = setup();
    await user.click(toggle());
    const pop = screen.getByRole('dialog', { name: 'Voto delle aree' });
    const button = screen.getByRole('button', { expanded: true, name: /^Voto / });
    expect(button).toHaveAttribute('aria-controls', pop.id);
    const rows = within(pop).getAllByRole('button', { name: /apri il dettaglio|^Apri Bonus/ });
    expect(rows.map(r => r.querySelector('span')?.textContent)).toEqual(['Offesa', 'Difesa', 'Velocità', 'Ruoli', 'Bonus/Malus']);
    const value = (key: string) => rating.areas.find(a => a.key === key)!.value;
    expect(rows[0].querySelector('b')).toHaveTextContent(String(value('strength')));
    expect(rows[1].querySelector('b')).toHaveTextContent(String(value('defense')));
    expect(rows[2].querySelector('b')).toHaveTextContent(String(value('speed')));
    const { covered, total, points } = rolesTally(rating.roles);
    expect(rows[3]).toHaveTextContent(`${covered}/${total}${signed(points)}`);
    const { net } = bonusMalusTotals(rating);
    expect(rows[4].querySelector('b')).toHaveTextContent(net === 0 ? '±0' : signed(net));
    expect(rows[0]).toHaveFocus();
    // Il "?" del voto sta nella tendina
    expect(within(pop).getByRole('button', { name: 'Come funziona il voto' })).toBeInTheDocument();
  });

  it('frecce fra le righe; il clic su una riga apre l\'area, chiude e torna al voto', async () => {
    const { user, onOpen } = setup();
    await user.click(toggle());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^Difesa \d+/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /^Apri Bonus\/Malus/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^Offesa \d+/ })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /^Velocità \d+/ }));
    expect(onOpen).toHaveBeenCalledWith('speed');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('Esc chiude e il focus torna al voto; Invio riapre', async () => {
    const { user } = setup();
    await user.click(toggle());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Voto delle aree' })).toBeInTheDocument();
  });

  it('un clic fuori chiude; un secondo clic sul voto chiude', async () => {
    const { user } = setup();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'fuori' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { expanded: true, name: /^Voto / }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('il "?" apre la guida del voto senza chiudere la tendina', async () => {
    const { user } = setup();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Come funziona il voto' }));
    expect(screen.getByRole('dialog', { name: 'Voto delle aree' })).toBeInTheDocument();
    expect(document.querySelector('.help-dialog')).not.toBeNull();
  });
});

describe('voto bloccato', () => {
  it('EV oltre il massimo: il voto vecchio non compare nemmeno per un istante (niente lettera né avviso delle regole)', () => {
    // Il voto nuovo arriva un attimo dopo il team: qui la carta riceve ancora il voto vecchio insieme al blocco
    renderIt(<GradeBadge rating={rated()} blocked="ev" ruleIssues={['Corviknight: 760 EV, più del massimo di 510']} illegalCount={1} />);
    const card = document.querySelector('.grade-badge')!;
    expect(card).toHaveClass('none');
    expect(card.querySelector('.letter')).toBeNull();
    expect(card.querySelector('.grade-rules')).toBeNull();
    expect(card.querySelector('.label')).toHaveTextContent(/EV/);
  });
});
