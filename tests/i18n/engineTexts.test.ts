import { afterEach, describe, expect, it } from 'vitest';
import { describeDiff } from '../../src/engine/coach';
import { explain } from '../../src/engine/explain';
import { initGameNames } from '../../src/i18n/game';

const none = { roles: [], covers: [], resists: [] };
afterEach(() => initGameNames(null));

describe('testi del motore', () => {
  it('vantaggi e svantaggi in entrambe le lingue, tipi tradotti', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { fire: 'Fuoco', ground: 'Terra' } });
    const diff = { gains: { roles: ['pivot' as const], covers: [], resists: ['Ground' as const] }, losses: { ...none, covers: ['Fire' as const] } };
    expect(describeDiff(diff, 'en')).toEqual({ pros: ['Pivot', 'Resists Ground'], cons: ['No longer strong against Fire'] });
    expect(describeDiff(diff, 'it')).toEqual({ pros: ['Pivot', 'Resistente a Terra'], cons: ['Non più forte contro Fuoco'] });
  });

  it('motivazioni dei suggerimenti in inglese', () => {
    const facts = {
      defense: { immune: ['Ground' as const], covered: [], sharedWeak: [] },
      threats: { checked: ['Dragapult'] },
      coverage: { types: ['Fairy' as const] },
      roles: { filled: ['pivot' as const], style: 'special' as const },
      synergy: { member: 'Great Tusk', pct: 0.3 },
      mechanical: [], clashes: [],
      strength: { usage: 0.123 },
    };
    const components = { defense: 1, threats: 1, coverage: 1, roles: 1, synergy: 1, strength: 1 };
    const texts = explain(facts, components, 'en').map(r => r.text);
    expect(texts).toContain('Immune to Ground: team weaknesses');
    expect(texts).toContain('Checks Dragapult');
    expect(texts).toContain('Hits Fairy super effectively, uncovered by the team');
    expect(texts).toContain('Brings Pivot, special attacker (missing from the team)');
    expect(texts).toContain('Used with Great Tusk in 30% of teams');
    expect(texts).toContain('Meta usage: 12.3%');
  });
});

describe('conflitto di meteo in italiano', () => {
  it('l\'abilità che porta il meteo in conflitto è tradotta', async () => {
    const { clashesWith } = await import('../../src/engine/synergy');
    const { emptySet } = await import('../../src/engine/sets');
    initGameNames({ moves: {}, abilities: { drought: { name: 'Siccità' } }, items: {}, natures: {}, types: {} });
    const ninetales = { ...emptySet('Ninetales'), ability: 'Drought' };
    const pelipper = { ...emptySet('Pelipper'), ability: 'Drizzle' };
    expect(clashesWith(pelipper, [ninetales], 'it')).toEqual(['Ninetales (Siccità)']);
    expect(clashesWith(pelipper, [ninetales], 'en')).toEqual(['Ninetales (Drought)']);
  });
});
