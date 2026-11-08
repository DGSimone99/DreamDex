import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

describe('il Coaching guarda lo stesso team del voto', () => {
  it('Stealth Rock con Assault Vest non conta: niente "due Stealth Rock"; il −2 delle mosse bloccate c\'è', () => {
    const tusk: TeamSet = { ...mostCommonSet(fixtureStats, 'Great Tusk')!, item: 'Assault Vest', moves: ['Headlong Rush', 'Close Combat', 'Knock Off', 'Stealth Rock'] };
    const chomp: TeamSet = { ...mostCommonSet(fixtureStats, 'Garchomp')!, moves: ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'] };
    const team = [tusk, chomp, ...['Gholdengo', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!)];
    const rating = rateTeam(team, fixtureData)!;
    const problems = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text);
    expect(rating.penalty.items.some(i => i.catalog === 'hazardDuplicate' && i.text.includes('Stealth Rock'))).toBe(false);
    expect(problems.some(text => text.includes('Stealth Rock') && /2/.test(text))).toBe(false);
    const locked = rating.penalty.items.find(i => i.catalog === 'lockedStatus')!;
    expect(problems).toContain(locked.text);
  });
});
