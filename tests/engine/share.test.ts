import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE, type FormatChoice } from '../../src/engine/formatChoice';
import { emptySet } from '../../src/engine/sets';
import { decodeShare, encodeShare } from '../../src/share';

const team = [
  { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Earthquake', 'Stealth Rock'], nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } },
  { ...emptySet('Flabébé'), ability: 'Flower Veil', moves: ['Moonblast'], customSkillset: true },
];
const choice: FormatChoice = { ...DEFAULT_CHOICE, tier: 'Ubers' };

describe('team nel link', () => {
  it('andata e ritorno: team (anche con accenti) e formato', () => {
    const code = encodeShare(team, choice);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(`#team=${code}`)).toEqual({ team, choice });
  });

  it('un link vecchio (col formato di prima) torna al formato di base', () => {
    const old = btoa(JSON.stringify({ team: [{ species: 'Garchomp', moves: [] }], format: { formatId: 'uu' } }));
    expect(decodeShare(`#team=${old}`)?.choice).toEqual(DEFAULT_CHOICE);
  });

  it('link rotto o assente: null', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#team=!!!')).toBeNull();
    expect(decodeShare('#altro=abc')).toBeNull();
  });
});
