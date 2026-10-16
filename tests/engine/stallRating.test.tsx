import { describe, expect, it } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });

// "TLOH IV" dai team campione Smogon di National Dex OU
const stall: TeamSet[] = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', { hp: 4, def: 252, spd: 252 }),
  set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', { hp: 252, def: 4, spd: 252 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 168, spd: 88 }),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', { hp: 244, def: 248, spe: 16 }),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
];

describe('team stall', () => {
  it('riconosciuto: ruoli a metà tra la valutazione normale e quella da stall', () => {
    const rating = rateTeam(stall, fixtureData)!;
    expect(rating.archetype).toBe('stall');
    // normale: 2 essenziali su 5 + 2 desiderabili su 5 (a metà peso) → 40; da stall: tutti → 100; a metà → 70
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(70);
  });

  it('un team normale non è stall e non cambia', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    expect(rating.archetype).toBeNull();
  });
});

describe('pannello del voto', () => {
  it('dice che il team è valutato come stall', async () => {
    const { screen } = await import('@testing-library/react');
    const { RatingPanel } = await import('../../src/ui/RatingPanel');
    const { renderIt } = await import('../helpers/italian');
    renderIt(<RatingPanel rating={rateTeam(stall, fixtureData)!} />);
    expect(screen.getByText(/Valutato come stall/)).toBeInTheDocument();
  });
});

describe('coaching di uno stall', () => {
  it('non chiede pivot, priorità o velocità', async () => {
    const { coachTeam } = await import('../../src/engine/coach');
    const { DEFAULT_FORMAT } = await import('../../src/engine/format');
    const texts = coachTeam(stall, DEFAULT_FORMAT, fixtureData, 'it').problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Pivot|Priorità|Controllo velocità/);
  });

  it('chiede invece i ruoli da stall che mancano', async () => {
    const { coachTeam } = await import('../../src/engine/coach');
    const { DEFAULT_FORMAT } = await import('../../src/engine/format');
    const noRemoval = stall.map(s => (s.species === 'Corviknight' ? { ...s, moves: ['Body Press', 'Iron Defense', 'Roost', 'Brave Bird'] } : s));
    const texts = coachTeam(noRemoval, DEFAULT_FORMAT, fixtureData, 'it').problems.map(p => p.text);
    expect(texts).toContainEqual(expect.stringMatching(/Ruoli mancanti: Rimozione hazard$/));
  });
});
