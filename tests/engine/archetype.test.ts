import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { isPassive } from '../../src/engine/roles';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

// "TLOH IV" dai team campione Smogon di National Dex OU
const stall = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk']),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish']),
  set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes']),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost']),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic']),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes']),
];
const hyperOffense = [
  set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Stealth Rock', 'Earth Power']),
  set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head']),
  set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore']),
  set('Tapu Lele', 'Choice Specs', 'Psychic Surge', ['Psychic', 'Moonblast', 'Focus Blast', 'Psyshock']),
  set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Bulk Up', 'Headlong Rush', 'Ice Spinner', 'Rapid Spin']),
  set('Lopunny', 'Lopunnite', 'Limber', ['Fake Out', 'Return', 'High Jump Kick', 'Ice Punch']),
];
// "Be Strong and Hit Stuff - Ursaluna + Tapu Koko Balance" dai team campione Smogon
const balance = [
  set('Ursaluna', 'Flame Orb', 'Guts', ['Earthquake', 'Facade', 'Fire Punch', 'Swords Dance']),
  set('Corviknight', 'Rocky Helmet', 'Pressure', ['Brave Bird', 'Defog', 'Roost', 'U-turn']),
  set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Flamethrower', 'Sludge Bomb', 'Thunder Wave']),
  set('Tangrowth', 'Rocky Helmet', 'Regenerator', ['Hidden Power Ice', 'Knock Off', 'Power Whip', 'Sleep Powder']),
  set('Tapu Koko', 'Electrium Z', 'Electric Surge', ['Hidden Power Ice', 'Roost', 'Thunderbolt', 'U-turn']),
  set('Tyranitar', 'Tyranitarite', 'Sand Stream', ['Knock Off', 'Pursuit', 'Stealth Rock', 'Stone Edge']),
];
// "Z lele scarf shifu BO" dai team campione Smogon
const bulkyOffense = [
  set('Tapu Lele', 'Psychium Z', 'Psychic Surge', ['Focus Blast', 'Future Sight', 'Moonblast', 'Psyshock']),
  set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Dual Wingbeat', 'Earthquake', 'Roost']),
  set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Knock Off', 'Leech Seed', 'Power Whip', 'Spikes']),
  set('Landorus-Therian', 'Rocky Helmet', 'Intimidate', ['Defog', 'Earth Power', 'Stealth Rock', 'U-turn']),
  set('Urshifu-Rapid-Strike', 'Choice Scarf', 'Unseen Fist', ['Close Combat', 'Ice Spinner', 'Surging Strikes', 'U-turn']),
  set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Flamethrower', 'Giga Drain', 'Hidden Power Ground', 'Quiver Dance']),
];

describe('archetipo del team', () => {
  it('stall, hyper offense, balance e bulky offense dei team campione', () => {
    expect(teamArchetype(stall, DEFAULT_RULES)?.archetype).toBe('stall');
    expect(teamArchetype(hyperOffense, DEFAULT_RULES)?.archetype).toBe('hyperOffense');
    expect(teamArchetype(balance, DEFAULT_RULES)?.archetype).toBe('balance');
    expect(teamArchetype(bulkyOffense, DEFAULT_RULES)?.archetype).toBe('bulkyOffense');
  });

  it('4 membri passivi: semi-stall', () => {
    const team = [...stall.slice(0, 4), hyperOffense[1], hyperOffense[4]];
    expect(teamArchetype(team, DEFAULT_RULES)?.archetype).toBe('semiStall');
  });

  it('attaccanti fragili non sono "bulky": hyper offense', () => {
    const weak = ['Raticate', 'Furret', 'Linoone', 'Bibarel', 'Watchog', 'Stoutland'].map(s => set(s, 'Leftovers', '', ['Body Slam', 'Crunch', 'Quick Attack', 'Swords Dance']));
    expect(teamArchetype(weak, DEFAULT_RULES)?.archetype).toBe('hyperOffense');
  });

  it('solo con il team completo', () => {
    expect(teamArchetype(stall.slice(0, 5), DEFAULT_RULES)).toBeNull();
  });
});

describe('stili del team', () => {
  const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Scald', 'U-turn', 'Roost']);
  const swiftSwim = set('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat', 'Aqua Jet', 'Flip Turn']);

  it('meteo: chi lo porta e almeno un compagno che lo sfrutta', () => {
    expect(teamArchetype([pelipper, swiftSwim, ...bulkyOffense.slice(0, 4)], DEFAULT_RULES)?.styles).toContain('rain');
  });

  it('un meteo che serve solo a chi lo porta non è uno stile (sabbia di Tyranitar)', () => {
    expect(teamArchetype(balance, DEFAULT_RULES)?.styles).not.toContain('sand');
  });

  it('solo meteo e Trick Room: Sticky Web, Screens e tanti pivot non sono stili', () => {
    const webs = [set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn']), ...hyperOffense.slice(1)];
    const screens = [set('Grimmsnarl', 'Light Clay', 'Prankster', ['Reflect', 'Light Screen', 'Spirit Break', 'Parting Shot']), ...hyperOffense.slice(1)];
    const pivots = hyperOffense.map(s => ({ ...s, moves: [...s.moves.slice(0, 3), 'U-turn'] }));
    for (const team of [webs, screens, pivots]) expect(teamArchetype(team, DEFAULT_RULES)?.styles).toEqual([]);
  });

  it('al massimo due stili', () => {
    const many = [pelipper, swiftSwim,
      set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'U-turn', 'Stun Spore']),
      set('Grimmsnarl', 'Light Clay', 'Prankster', ['Reflect', 'Light Screen', 'Spirit Break', 'U-turn']),
      ...hyperOffense.slice(1, 3).map(s => ({ ...s, moves: [...s.moves.slice(0, 3), 'U-turn'] }))];
    expect(teamArchetype(many, DEFAULT_RULES)!.styles.length).toBeLessThanOrEqual(2);
  });
});

describe('archetipi di Ubers', () => {
  // "Deo-Speed Hyper Offense" dai team campione Smogon di National Dex Ubers: robusti, ma quasi tutti veloci o con Dragon Dance
  const deoSpeed = [
    set('Deoxys-Speed', 'Focus Sash', 'Pressure', ['Stealth Rock', 'Spikes', 'Taunt', 'Psycho Boost']),
    set('Arceus', 'Silk Scarf', 'Multitype', ['Swords Dance', 'Extreme Speed', 'Shadow Claw', 'Recover']),
    set('Groudon', 'Red Orb', 'Drought', ['Swords Dance', 'Precipice Blades', 'Stone Edge', 'Rock Polish']),
    set('Necrozma-Dusk-Mane', 'Weakness Policy', 'Prism Armor', ['Dragon Dance', 'Sunsteel Strike', 'Earthquake', 'Morning Sun']),
    set('Yveltal', 'Life Orb', 'Dark Aura', ['Sucker Punch', 'Knock Off', 'Oblivion Wing', 'Sky Attack']),
    set('Zacian', 'Rusted Sword', 'Intrepid Sword', ['Swords Dance', 'Behemoth Blade', 'Close Combat', 'Play Rough']),
  ];

  it('un wallbreaker con setup offensivo non è un muro passivo (Necrozma con Dragon Dance)', () => {
    expect(isPassive(deoSpeed[3], DEFAULT_RULES)).toBe(false);
    // Dondozo con Curse resta un muro: Curse alza l'Attacco, ma Dondozo non ha statistiche da wallbreaker
    expect(isPassive(set('Dondozo', 'Leftovers', 'Unaware', ['Curse', 'Body Press', 'Liquidation', 'Rest']), DEFAULT_RULES)).toBe(true);
  });

  it('senza muri passivi e con almeno 5 membri veloci o con setup di velocità è Hyper Offense anche se robusto', () => {
    expect(teamArchetype(deoSpeed, DEFAULT_RULES)?.archetype).toBe('hyperOffense');
  });
});

describe('riconoscimento: muri senza recupero e Webs (test dei pesi, 2026-11-03)', () => {
  it('un muro senza recupero che attacca pochissimo è passivo (Lanturn); un attaccante no', () => {
    expect(isPassive(set('Lanturn', 'Heavy-Duty Boots', 'Volt Absorb', ['Scald', 'Toxic', 'Volt Switch', 'Protect']), DEFAULT_RULES)).toBe(true);
    expect(isPassive(set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Dragon Tail', 'Stealth Rock', 'Spikes']), DEFAULT_RULES)).toBe(false);
  });

  it('uno stall con Lanturn al posto di un muro col recupero resta stall', () => {
    const team = [
      set('Clefable', 'Heavy-Duty Boots', 'Unaware', ['Moonblast', 'Calm Mind', 'Soft-Boiled', 'Aromatherapy']),
      set('Skarmory', 'Shed Shell', 'Sturdy', ['Defog', 'Spikes', 'Body Press', 'Roost']),
      set('Lanturn', 'Heavy-Duty Boots', 'Volt Absorb', ['Scald', 'Toxic', 'Volt Switch', 'Protect']),
      set('Sableye-Mega', 'Sablenite', 'Prankster', ['Knock Off', 'Will-O-Wisp', 'Recover', 'Protect']),
      set('Alomomola', 'Rocky Helmet', 'Regenerator', ['Wish', 'Protect', 'Scald', 'Mirror Coat']),
      set('Chansey', 'Eviolite', 'Natural Cure', ['Sing', 'Soft-Boiled', 'Stealth Rock', 'Seismic Toss']),
    ];
    expect(teamArchetype(team, DEFAULT_RULES)?.archetype).toBe('stall');
  });

  it('un team Webs con un solo passivo è Hyper Offense anche se gli attaccanti sono robusti', () => {
    const team = [
      set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn']),
      set('Gholdengo', 'Leftovers', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Recover', 'Thunder Wave']),
      set('Glimmora', 'Power Herb', 'Toxic Debris', ['Meteor Beam', 'Earth Power', 'Sludge Wave', 'Power Gem']),
      set('Manaphy', 'Leftovers', 'Hydration', ['Tail Glow', 'Surf', 'Ice Beam', 'Energy Ball']),
      set('Roaring Moon', 'Booster Energy', 'Protosynthesis', ['Dragon Dance', 'Acrobatics', 'Knock Off', 'Earthquake']),
      set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Iron Defense', 'Body Press', 'Crunch', 'Rest']),
    ];
    expect(teamArchetype(team, DEFAULT_RULES)?.archetype).toBe('hyperOffense');
  });
});
