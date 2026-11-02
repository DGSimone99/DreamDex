import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam, UNIFORM_TYPE_WEIGHTS } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
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
  it("col meta: niente barra Meta né penalità; le minacce stanno nella Coverage meta della Difesa", () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex'].map(n => mostCommonSet(fixtureStats, n)!);
    const on = rateTeam(team, fixtureData)!;
    const off = rateTeam(team, noMeta)!;
    expect(on.areas.some(a => a.key === 'meta')).toBe(false);
    expect(on.penalty.items.some(i => i.text.startsWith('Poco preparato al meta'))).toBe(false);
    expect(on.defense.coverageMeta).not.toBeNull();
    expect(off.defense.coverageMeta).toBeNull();
    // Anche i Ruoli si misurano contro il meta (sotto-ruoli da Offesa, Velocità e gruppo del meta), ma cambiano di poco
    expect(Math.abs(on.roles.covered - off.roles.covered)).toBeLessThanOrEqual(1);
    expect(on.overall).toBe(Math.max(0, Math.min(100, on.base - on.penalty.total + on.bonus.total)));
  });

  it('senza meta: niente area Meta, tipi tutti uguali, nessuna minaccia', () => {
    const rating = rateTeam([tusk, gholdengo], noMeta)!;
    expect(rating.meta).toBeNull();
    expect(rating.areas.map(a => a.key)).toEqual(['defense', 'strength', 'speed']);
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
  it('col meta di default; passando a senza meta spariscono le minacce e la scelta resta', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem('dreamdex.session', JSON.stringify({ team: [tusk, gholdengo], format: DEFAULT_FORMAT }));
    render(<App data={fixtureData} storage={storage} initialLang="it" />);
    const withMeta = screen.getByRole('button', { name: 'Col meta' });
    expect(withMeta).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Minacce del meta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Senza meta' }));
    expect(screen.getByRole('button', { name: 'Senza meta' })).toHaveAttribute('aria-pressed', 'true');
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
