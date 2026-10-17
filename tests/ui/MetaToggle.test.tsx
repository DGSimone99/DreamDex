import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam, UNIFORM_TYPE_WEIGHTS } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { META_FULL, META_THREATS, META_WEIGHT, rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { loadSession, sanitizeFormat } from '../../src/storage';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const noMeta = { ...fixtureData, ignoreMeta: true };
const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k), clear: () => map.clear(), key: () => null, get length() { return map.size; } };
};

afterEach(() => window.history.replaceState(null, '', '/'));

describe('voto col meta e senza', () => {
  it('col meta: area Meta, il 30% del voto, da minacce (2/3) e uso dei membri (1/3)', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    const meta = rating.areas.find(a => a.key === 'meta')!;
    expect(rating.meta).not.toBeNull();
    const expected = Math.min(1, (META_THREATS * rating.meta!.threats + (1 - META_THREATS) * rating.meta!.usage) / 100 / META_FULL);
    expect(Math.abs(meta.value! - 100 * expected)).toBeLessThanOrEqual(1);
    expect(META_WEIGHT).toBe(0.3);
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
    expect(screen.getByText(/Valutato col meta del formato/)).toBeInTheDocument();
    expect(screen.getByText(/^Meta \d+/)).toBeInTheDocument();
    expect(screen.getByText('Minacce del meta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Senza meta' }));
    expect(screen.getByRole('button', { name: 'Senza meta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Valutato senza meta: tutti i tipi pesano allo stesso modo.')).toBeInTheDocument();
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
