import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam, UNIFORM_TYPE_WEIGHTS } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { META_FLOOR, META_MAX_PENALTY, metaPenalty, rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { loadSession, sanitizeFormat } from '../../src/storage';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const noMeta = { ...fixtureData, ignoreMeta: true };
const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k), clear: () => map.clear(), key: () => null, get length() { return map.size; } };
};

afterEach(() => window.history.replaceState(null, '', '/'));

describe('voto col meta e senza', () => {
  it("col meta: la barra Meta mostra le minacce gestite; il voto è quello delle aree (l'Offesa contro i difensori del meta), meno la penalità del meta", () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex'].map(n => mostCommonSet(fixtureStats, n)!);
    const on = rateTeam(team, fixtureData)!;
    const off = rateTeam(team, noMeta)!;
    expect(on.areas.find(a => a.key === 'meta')!.value).toBe(on.meta!.threats);
    // Le aree sono le stesse col meta e senza, tranne l'Offesa (si misura contro i difensori del meta)
    const areas = (r: typeof on) => r.areas.filter(a => a.key !== 'meta' && a.key !== 'strength').map(a => [a.key, a.value]);
    expect(areas(on)).toEqual(areas(off));
    const points = metaPenalty(on.meta!.threats);
    const unready = on.penalty.items.find(i => i.text.startsWith('Poco preparato al meta'));
    expect(unready?.points ?? 0).toBe(points);
    expect(on.overall).toBe(Math.max(0, Math.min(100, on.base - on.penalty.total + on.bonus.total)));
  });

  it('un team incompleto non paga la penalità del meta: mentre lo costruisci gestisce per forza poche minacce', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    expect(rating.penalty.items.some(i => i.text.startsWith('Poco preparato al meta'))).toBe(false);
  });

  it('penalità del meta: niente sopra la soglia, 1 punto ogni 4% sotto, al massimo 12', () => {
    expect(metaPenalty(META_FLOOR)).toBe(0);
    expect(metaPenalty(100)).toBe(0);
    expect(metaPenalty(META_FLOOR - 1)).toBe(1);
    expect(metaPenalty(META_FLOOR - 8)).toBe(2);
    expect(metaPenalty(0)).toBe(META_MAX_PENALTY);
  });

  it('senza meta: niente area Meta, tipi tutti uguali, nessuna minaccia', () => {
    const rating = rateTeam([tusk, gholdengo], noMeta)!;
    expect(rating.meta).toBeNull();
    expect(rating.areas.map(a => a.key)).toEqual(['coverage', 'defense', 'strength', 'bulk', 'roles', 'speed']);
    const analysis = analyzeTeam([tusk, gholdengo], noMeta);
    expect(analysis.typeWeights).toEqual(UNIFORM_TYPE_WEIGHTS);
    expect(analysis.threats).toEqual([]);
  });

  it('senza statistiche il voto è sempre senza meta', () => {
    expect(rateTeam([tusk, gholdengo], { stats: null, sets: null })!.meta).toBeNull();
  });

  it('il coach non parla di minacce senza meta', () => {
    expect(coachTeam([tusk, gholdengo], DEFAULT_FORMAT, noMeta).threatFixes).toEqual({});
  });
});

describe('interruttore nella barra in alto', () => {
  it('col meta di default; passando a senza meta cambia la riga del voto e la scelta resta', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem('dreamdex.session', JSON.stringify({ team: [tusk, gholdengo], format: DEFAULT_FORMAT }));
    render(<App data={fixtureData} storage={storage} initialLang="it" />);
    const withMeta = screen.getByRole('button', { name: 'Col meta' });
    expect(withMeta).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Col meta del formato/)).toBeInTheDocument();
    expect(screen.getByText(/^Meta \d+/)).toBeInTheDocument();
    expect(screen.getByText('Minacce del meta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Senza meta' }));
    expect(screen.getByRole('button', { name: 'Senza meta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Senza meta: nessuna penalità per le minacce del mese.')).toBeInTheDocument();
    expect(screen.queryByText(/^Meta \d+/)).toBeNull();
    expect(screen.queryByText('Minacce del meta')).toBeNull();
    expect(loadSession(storage)?.format.meta).toBe(false);
  });

  it('senza statistiche i pulsanti sono disattivati', () => {
    render(<App data={{ stats: null, sets: null }} initialLang="it" />);
    expect(screen.getByRole('button', { name: 'Col meta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Senza meta' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('il link condiviso porta anche la scelta', () => {
    window.history.replaceState(null, '', `/#team=${encodeShare([emptySet('Garchomp')], { ...DEFAULT_FORMAT, meta: false })}`);
    render(<App data={fixtureData} initialLang="it" />);
    expect(screen.getByRole('button', { name: 'Senza meta' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('formati salvati prima dell\'interruttore: col meta', () => {
    expect(sanitizeFormat({ formatId: 'ou' }).meta).toBe(true);
    expect(sanitizeFormat({ formatId: 'ou', meta: false }).meta).toBe(false);
  });
});
