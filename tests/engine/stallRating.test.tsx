import { describe, expect, it } from 'vitest';
import { AREA_WEIGHTS, rateTeam, STALL_AREA_WEIGHTS } from '../../src/engine/rating';
import { memberPower, teamPower } from '../../src/engine/power';
import { isPassive } from '../../src/engine/roles';
import { metaTypeWeights } from '../../src/engine/stats';
import { superEffectiveMove, TYPES } from '../../src/engine/types';

/** Copertura con ogni colpo super efficace a valore pieno. */
const fullCoverage = (team: TeamSet[]) => {
  const w = metaTypeWeights(fixtureData.stats);
  return Math.round(100 * TYPES.filter(type => team.some(s => superEffectiveMove(s, type))).reduce((acc, type) => acc + w[type], 0));
};
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

// "eternatus full stall" dai team campione Smogon di National Dex Ubers: muri che hanno anche statistiche offensive
const ubersStall: TeamSet[] = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Avalanche', 'Body Press', 'Curse', 'Rest'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  set('Arceus-Dark', 'Dread Plate', 'Multitype', ['Foul Play', 'Recover', 'Refresh', 'Stealth Rock'], 'Timid', { hp: 248, def: 172, spe: 88 }),
  set('Chansey', 'Eviolite', 'Natural Cure', ['Confide', 'Heal Bell', 'Seismic Toss', 'Soft-Boiled'], 'Calm', { hp: 8, def: 252, spd: 248 }),
  set('Eternatus', 'Leftovers', 'Pressure', ['Dynamax Cannon', 'Recover', 'Sludge Bomb', 'Toxic Spikes'], 'Timid', { hp: 248, spd: 40, spe: 220 }),
  set('Giratina-Origin', 'Griseous Core', 'Levitate', ['Defog', 'Hex', 'Rest', 'Toxic'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  set('Ho-Oh', 'Heavy-Duty Boots', 'Regenerator', ['Defog', 'Sacred Fire', 'Toxic', 'Whirlwind'], 'Impish', { hp: 248, def: 204, spd: 56 }),
];

describe('stall con muri dalle statistiche offensive', () => {
  it('riconosciuto: chi è un muro o ha un solo attacco non conta come attaccante', () => {
    expect(rateTeam(ubersStall, fixtureData)!.archetype).toBe('stall');
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

describe('membro passivo e riconoscimento dello stall', () => {
  // Stall con Mega Sableye: Sableye-Mega e Quagsire non sono "muri" per statistiche, ma recuperano e attaccano poco
  const sableyeStall: TeamSet[] = [
    set('Sableye', 'Sablenite', 'Prankster', ['Knock Off', 'Recover', 'Will-O-Wisp', 'Calm Mind'], 'Careful', { hp: 252, def: 4, spd: 252 }),
    set('Chansey', 'Eviolite', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Heal Bell'], 'Bold', { hp: 4, def: 252, spd: 252 }),
    set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Spikes', 'Roost', 'Brave Bird', 'Whirlwind'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    set('Quagsire', 'Leftovers', 'Unaware', ['Earthquake', 'Recover', 'Toxic', 'Scald'], 'Relaxed', { hp: 252, def: 252, spd: 4 }),
    set('Mandibuzz', 'Heavy-Duty Boots', 'Overcoat', ['Foul Play', 'Roost', 'Defog', 'Toxic'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    set('Hippowdon', 'Leftovers', 'Sand Stream', ['Stealth Rock', 'Slack Off', 'Earthquake', 'Whirlwind'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  ];
  // Muri e setup: Volcarona e Garchomp sono sweeper, non passivi
  const setupBalance: TeamSet[] = [
    set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Spikes', 'Leech Seed', 'Power Whip', 'Knock Off'], 'Relaxed', { hp: 252, def: 88, spd: 168 }),
    set('Garchomp', 'Life Orb', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Stone Edge', 'Fire Fang'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
    set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower'], 'Bold', { hp: 252, def: 252, spd: 4 }),
    set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Earth Power', 'Stealth Rock', 'Taunt'], 'Calm', { hp: 252, spd: 216, spe: 40 }),
    set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Toxic', 'Recover', 'Haze'], 'Bold', { hp: 252, def: 252, spd: 4 }),
    set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Fiery Dance', 'Giga Drain', 'Roost'], 'Timid', { hp: 252, def: 4, spe: 252 }),
  ];

  it('passivo: al massimo 2 attacchi, non sweeper veloce con setup, muro o con recupero', () => {
    expect(isPassive(sableyeStall[0])).toBe(true);
    expect(isPassive(sableyeStall[3])).toBe(true);
    expect(isPassive(setupBalance[1])).toBe(false);
    expect(isPassive(setupBalance[5])).toBe(false);
    expect(isPassive(set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Close Combat', 'Rapid Spin'], 'Jolly', {}))).toBe(false);
  });

  it('lo stall con Mega Sableye è riconosciuto', () => {
    expect(rateTeam(sableyeStall, fixtureData)!.archetype).toBe('stall');
  });

  it('muri con due sweeper in setup non sono stall', () => {
    expect(rateTeam(setupBalance, fixtureData)!.archetype).toBeNull();
  });
});

describe('voto dello stall', () => {
  const weighted = (areas: { key: string; value: number | null }[], w: Record<string, number>) =>
    Math.round(areas.reduce((acc, a) => acc + w[a.key] * a.value!, 0));

  it('forza dei passivi dalla sola robustezza', () => {
    const rating = rateTeam(stall, fixtureData)!;
    const bulk = Math.round(stall.map(s => memberPower(s)!.bulk).reduce((a, b) => a + b, 0) / stall.length);
    expect(rating.areas.find(a => a.key === 'strength')!.value).toBe(bulk);
  });

  it('pesi da stall: copertura dimezzata, il resto alla difesa', () => {
    const rating = rateTeam(stall, fixtureData)!;
    expect(Math.abs(rating.base - weighted(rating.areas, STALL_AREA_WEIGHTS))).toBeLessThanOrEqual(1);
    expect(STALL_AREA_WEIGHTS.coverage).toBe(AREA_WEIGHTS.coverage / 2);
  });

  it('un team non stall usa pesi e forza di sempre', () => {
    const team = [tusk, gholdengo];
    const rating = rateTeam(team, fixtureData)!;
    expect(Math.abs(rating.base - weighted(rating.areas, AREA_WEIGHTS))).toBeLessThanOrEqual(1);
    expect(rating.areas.find(a => a.key === 'strength')!.value).toBe(teamPower(team).value);
  });
});

describe('copertura di uno stall', () => {
  it('i colpi dei muri passivi valgono pieni: copre un tipo chi può colpirlo, non chi fa più danni', () => {
    const rating = rateTeam(stall, fixtureData)!;
    expect(rating.archetype).toBe('stall');
    // Toxapex (Scald) e Clodsire (Poison Jab) attaccano poco, ma nello stall i loro colpi contano interi
    expect(rating.areas.find(a => a.key === 'coverage')!.value).toBe(fullCoverage(stall));
  });
});
