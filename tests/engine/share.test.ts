import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { decodeShare, encodeShare } from '../../src/share';

const team = [
  { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Earthquake', 'Stealth Rock'], nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } },
  { ...emptySet('Flabébé'), ability: 'Flower Veil', moves: ['Moonblast'], customSkillset: true },
];
const format = { ...DEFAULT_FORMAT, formatId: 'ubers' as const };

describe('team nel link', () => {
  it('andata e ritorno: team (anche con accenti) e formato', () => {
    const code = encodeShare(team, format);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(`#team=${code}`)).toEqual({ team, format });
  });

  it('link rotto o assente: null', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#team=!!!')).toBeNull();
    expect(decodeShare('#altro=abc')).toBeNull();
  });
});
