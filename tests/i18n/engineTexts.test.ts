import { afterEach, describe, expect, it } from 'vitest';
import { describeDiff } from '../../src/engine/coach';
import { explain } from '../../src/engine/explain';
import { initGameNames } from '../../src/i18n/game';

const none = { roles: [], covers: [], resists: [] };
afterEach(() => initGameNames(null));

describe('testi del motore', () => {
  it('vantaggi e svantaggi in entrambe le lingue, tipi tradotti', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { fire: 'Fuoco', ground: 'Terra' } });
    const diff = { gains: { roles: ['pivot' as const], covers: [], resists: ['Ground' as const] }, losses: { ...none, covers: ['Fire' as const] }, lostResists: [] };
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
    const shorts = explain(facts, components, 'en').map(r => r.short);
    expect(shorts).toEqual(expect.arrayContaining(['Immune to Ground', 'Checks Dragapult', 'Hits Fairy', 'Brings Pivot, special attacker']));
    // "Used with": niente forma breve (nelle caselle non compare), segnata per il dettaglio
    expect(explain(facts, components, 'en').filter(r => r.usedWith).map(r => r.text)).toEqual(['Used with Great Tusk in 30% of teams']);
  });

  it('forme brevi per le caselle della lista, in italiano ("ad" davanti alla A)', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { water: 'Acqua', ground: 'Terra', fire: 'Fuoco' } });
    const facts = {
      defense: { immune: ['Ground' as const], covered: ['Water' as const], sharedWeak: [] },
      threats: { checked: ['Dragapult'] },
      coverage: { types: ['Fire' as const] },
      roles: { filled: ['pivot' as const], style: null },
      synergy: { member: 'Great Tusk', pct: 0.3 },
      mechanical: [{ text: 'Abilita Venusaur: Siccità → Clorofilla', short: 'Abilita Venusaur' }], clashes: [],
      strength: { usage: 0.1 },
    };
    const components = { defense: 1, threats: 1, coverage: 1, roles: 1, synergy: 1, strength: 1 };
    const reasons = explain(facts, components, 'it');
    const byText = Object.fromEntries(reasons.map(r => [r.text, r.short]));
    expect(byText['Immune a Terra e resiste ad Acqua: debolezze del team']).toBe('Immune a Terra e resiste ad Acqua');
    expect(byText['Abilita Venusaur: Siccità → Clorofilla']).toBe('Abilita Venusaur');
    expect(byText['Colpisce super efficace Fuoco, scoperti dal team']).toBe('Colpisce Fuoco');
    expect(byText['Porta Pivot (mancanti nel team)']).toBe('Porta Pivot');
    expect(byText['Ferma Dragapult']).toBe('Ferma Dragapult');
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
