import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { CONTROL_CONDITIONS, roomShare, SHOWN_CONTROL, shownTotal } from '../../src/engine/speedArea';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const dnite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant', { atk: 252, spe: 252 });
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid', { spa: 252, spe: 252 });
const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Haze', 'Toxic'], 'Bold', { hp: 252, def: 252 });
const hatt = set('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psyshock', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet', { hp: 252, spa: 252 });
const plain = [dnite, valiant, pex];
const room = [dnite, valiant, pex, hatt];

const view = (t: TeamSet[]) => {
  const rating = rateTeam(t, fixtureData, 'it')!;
  renderIt(<AreaView rating={rating} area="speed" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
  return rating;
};
const barOf = (name: string) => screen.getByRole('button', { name: `Velocità di ${name}: apri i rivali` });
const rowOf = (name: string) => barOf(name).closest('tr')!;
const totalOf = (name: string) => Number(barOf(name).querySelector('.sp-total')!.textContent!.replace('%', ''));
const roomSwitch = () => screen.queryByRole('switch', { name: /^Distortozona/ });

describe('Velocità rifinita: muri, priorità, Speed vera', () => {
  it('sotto il nome "Speed" con la velocità vera; i muri (famiglia principale muri) grigi con "· muro"', () => {
    view(plain);
    // (MemberMon lo scrive accanto alla Velocità e, per le cornici basse senza statistiche, sulla riga del nome)
    expect(within(rowOf('Toxapex')).getAllByText(/· muro/).length).toBeGreaterThan(0);
    expect(rowOf('Toxapex').querySelector('.def-mon-speed')).toHaveTextContent(/^Speed \d+$/);
    expect(barOf('Toxapex')).toHaveClass('wall');
    expect(barOf('Toxapex')).not.toHaveClass('bad');
    // Un attaccante tiene i colori di stato, niente "muro"
    expect(barOf('Dragonite')).not.toHaveClass('wall');
    expect(barOf('Dragonite').className).toMatch(/\b(good|warn|bad)\b/);
    expect(rowOf('Dragonite')).not.toHaveTextContent(/muro/);
  });

  it('"priorità" accanto al nome con la mossa nel tooltip; senza mosse prioritarie niente', async () => {
    const user = userEvent.setup();
    view(plain);
    const tag = rowOf('Dragonite').querySelector('.sp-prio') as HTMLElement;
    expect(tag).toHaveTextContent('priorità');
    expect(tag).toHaveAttribute('aria-label', 'Priorità: Extreme Speed');
    await user.hover(tag);
    await waitFor(() => expect(document.querySelector('.sp-prio-ftip')).toHaveTextContent(/Extreme Speed/));
    expect(rowOf('Toxapex').querySelector('.sp-prio')).toBeNull();
    expect(rowOf('Iron Valiant').querySelector('.sp-prio')).toBeNull();
  });

  it('la riga tratteggiata a metà in ogni barra (anche quella del team) e la scala 0-100 sotto i membri', () => {
    view(plain);
    expect(document.querySelectorAll('.sp-stack .sp-half')).toHaveLength(plain.length + 1);
    expect([...document.querySelectorAll('.sp-scale-ticks > span')].map(s => s.textContent)).toEqual(['0', '25', '50', '75', '100']);
    expect(document.querySelector('.def-members thead')).toHaveTextContent(/^PokémonVelocità$/);
  });
});

describe('Velocità: Trick Room', () => {
  // La scelta dell'interruttore resta nella sessione del browser: ogni prova parte senza scelta (acceso)
  beforeEach(() => sessionStorage.clear());

  it('senza Trick Room nel team niente interruttore', () => {
    view(plain);
    expect(roomSwitch()).toBeNull();
  });

  it('Trick Room non è nel controllo del team (interruttore spento): niente pezzo neutro né voce nel tooltip; il voto lo conta ancora', async () => {
    const user = userEvent.setup();
    const rating = view(room);
    await user.click(roomSwitch()!);
    expect(roomSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(SHOWN_CONTROL).not.toContain('trickroom');
    expect(CONTROL_CONDITIONS).toContain('trickroom');
    const h = rating.speed.members.find(m => m.species === 'Hatterene')!;
    // Nel voto Hatterene guadagna con Trick Room (il migliore dei controlli), sulla pagina no
    expect(h.gains.some(g => g.condition === 'trickroom')).toBe(true);
    expect(h.total).toBeGreaterThan(h.own);
    expect(totalOf('Hatterene')).toBe(Math.round(100 * shownTotal(h)));
    expect(barOf('Hatterene').querySelector('.sp-seg-team')).toBeNull();
    // Spento: il veloce sopra il lento, la testata e la legenda di sempre
    expect(totalOf('Iron Valiant')).toBeGreaterThan(totalOf('Hatterene'));
    expect(document.querySelector('.def-members thead')).toHaveTextContent(/^PokémonVelocità$/);
    await user.hover(barOf('Hatterene'));
    await screen.findByText((_, el) => !!el?.classList.contains('stip-ladder'));
    expect(document.querySelector('.ftip.speed')).not.toHaveTextContent(/Trick Room|Distortozona/);
  });

  it('l\'interruttore "Trick Room · Hatterene" è acceso di base: le barre invertite (il lento in alto), senza pezzi a righe', async () => {
    const user = userEvent.setup();
    const rating = view(room);
    const sw = roomSwitch()!;
    expect(sw).toHaveTextContent('Distortozona · Hatterene');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw.closest('.panel-switch')).not.toBeNull();
    const members = rating.speed.members;
    for (const name of ['Dragonite', 'Iron Valiant', 'Toxapex', 'Hatterene']) {
      expect(totalOf(name)).toBe(Math.round(100 * roomShare(members.find(m => m.species === name)!)));
    }
    expect(totalOf('Hatterene')).toBeGreaterThan(totalOf('Iron Valiant'));
    // Le spinte non contano: niente pezzi a righe; i muri qui hanno i colori come gli altri
    expect(document.querySelectorAll('.sp-seg-own, .sp-seg-team')).toHaveLength(0);
    expect(barOf('Toxapex')).not.toHaveClass('wall');
    expect(document.querySelector('.def-members thead')).toHaveTextContent(/Muove prima di… \(i più usati\)/);
    expect(document.querySelector('.og-legend')).toHaveTextContent('Con Distortozona i più lenti muovono prima: la barra dice prima di quanti del meta muove');
    // Il tooltip nell'ordine di Trick Room: sopra il membro chi è più lento (muove prima)
    await user.hover(barOf('Iron Valiant'));
    const ladder = await screen.findByText((_, el) => !!el?.classList.contains('stip-ladder'));
    const self = Number(ladder.querySelector('.stip-rung.self .stip-speed')!.textContent);
    ladder.querySelectorAll('.stip-rung.ahead .stip-speed').forEach(s => expect(Number(s.textContent)).toBeLessThan(self));
    ladder.querySelectorAll('.stip-rung.behind .stip-speed').forEach(s => expect(Number(s.textContent)).toBeGreaterThan(self));
    expect(document.querySelector('.ftip.speed')).toHaveTextContent(/Distortozona: sopra chi muove prima di te/);
  });

  it('la scelta resta cambiando area: spento in Velocità, spento anche al ritorno', async () => {
    const user = userEvent.setup();
    const t = room;
    const rating = rateTeam(t, fixtureData, 'it')!;
    const analysis = analyzeTeam(t, fixtureData);
    const { rerender } = renderIt(<AreaView key="speed" rating={rating} area="speed" team={t} analysis={analysis} problems={[]} />);
    await user.click(roomSwitch()!);
    // Come in Analisi: la vista si rimonta a ogni area (key)
    rerender(<AreaView key="defense" rating={rating} area="defense" team={t} analysis={analysis} problems={[]} />);
    rerender(<AreaView key="speed" rating={rating} area="speed" team={t} analysis={analysis} problems={[]} />);
    expect(roomSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('con l\'interruttore acceso il modale del membro parte col check Trick Room acceso (che resta un check); spento no', async () => {
    const user = userEvent.setup();
    view(room);
    await user.click(barOf('Dragonite'));
    let dialog = screen.getByRole('dialog', { name: 'Velocità di Dragonite' });
    const check = within(dialog).getByRole('checkbox', { name: 'Trick Room' });
    expect(check).toBeChecked();
    expect(dialog).toHaveTextContent(/sotto Distortozona/);
    await user.click(check);
    expect(check).not.toBeChecked();
    await user.keyboard('{Escape}');
    await user.click(roomSwitch()!);
    await user.click(barOf('Dragonite'));
    dialog = screen.getByRole('dialog', { name: 'Velocità di Dragonite' });
    expect(within(dialog).getByRole('checkbox', { name: 'Trick Room' })).not.toBeChecked();
  });
});
