import { describe, expect, it } from 'vitest';
import { Field, Generations, Move, Pokemon, calculate } from '@smogon/calc';
import { installFastClone, uninstallFastClone } from '../../src/engine/fastCalc';

const gen = Generations.get(9);

// Attaccanti e difensori scelti per le regole che toccano le copie: Parental Bond (la copia a metÃ  calcolo), Forecast,
// Protosynthesis / Quark Drive, Intimidate, Download, Disguise, Multiscale, Contrary, Simple, Tera, -ate, Supreme Overlord
const attackers: [string, ConstructorParameters<typeof Pokemon>[2]][] = [
  ['Kangaskhan-Mega', { ability: 'Parental Bond', item: 'Kangaskhanite', nature: 'Jolly', evs: { atk: 252, spe: 252 } }],
  ['Great Tusk', { ability: 'Protosynthesis', item: 'Booster Energy', nature: 'Jolly', evs: { atk: 252, spe: 252 }, boostedStat: 'auto' }],
  ['Iron Valiant', { ability: 'Quark Drive', item: 'Booster Energy', nature: 'Timid', evs: { spa: 252, spe: 252 }, boostedStat: 'auto' }],
  ['Castform', { ability: 'Forecast', item: 'Damp Rock', nature: 'Modest', evs: { spa: 252 } }],
  ['Porygon-Z', { ability: 'Download', item: 'Choice Specs', nature: 'Timid', evs: { spa: 252, spe: 252 } }],
  ['Sylveon', { ability: 'Pixilate', item: 'Choice Specs', nature: 'Modest', evs: { hp: 252, spa: 252 }, teraType: 'Normal' }],
  ['Kingambit', { ability: 'Supreme Overlord', item: 'Black Glasses', nature: 'Adamant', evs: { atk: 252 }, alliesFainted: 3, boosts: { atk: 2 } }],
  ['Cinccino', { ability: 'Skill Link', item: 'Loaded Dice', nature: 'Jolly', evs: { atk: 252, spe: 252 } }],
  ['Malamar', { ability: 'Contrary', item: 'Leftovers', nature: 'Adamant', evs: { atk: 252 }, boosts: { atk: -1 } }],
  ['Terapagos-Stellar', { ability: 'Teraform Zero', item: 'Leftovers', nature: 'Modest', evs: { spa: 252 }, teraType: 'Stellar' }],
  ['Hawlucha', { ability: 'Unburden', item: 'Grassy Seed', nature: 'Jolly', evs: { atk: 252, spe: 252 } }],
  ['Ogerpon-Wellspring', { ability: 'Water Absorb', item: 'Wellspring Mask', nature: 'Jolly', evs: { atk: 252, spe: 252 }, teraType: 'Water' }],
];
const defenders: [string, ConstructorParameters<typeof Pokemon>[2]][] = [
  ['Toxapex', { ability: 'Regenerator', item: 'Black Sludge', nature: 'Bold', evs: { hp: 252, def: 252 } }],
  ['Gyarados', { ability: 'Intimidate', item: 'Leftovers', nature: 'Impish', evs: { hp: 252, def: 252 } }],
  ['Mimikyu', { ability: 'Disguise', item: 'Life Orb', nature: 'Jolly', evs: { atk: 252, spe: 252 } }],
  ['Dragonite', { ability: 'Multiscale', item: 'Heavy-Duty Boots', nature: 'Adamant', evs: { hp: 252, atk: 252 } }],
  ['Corviknight', { ability: 'Mirror Armor', item: 'Rocky Helmet', nature: 'Impish', evs: { hp: 248, def: 168 } }],
  ['Blissey', { ability: 'Natural Cure', item: 'Heavy-Duty Boots', nature: 'Bold', evs: { hp: 252, def: 252 } }],
  ['Gholdengo', { ability: 'Good as Gold', item: 'Air Balloon', nature: 'Timid', evs: { spa: 252, spe: 252 }, teraType: 'Fairy' }],
];
const moves = ['Headlong Rush', 'Close Combat', 'Body Press', 'Foul Play', 'Moonblast', 'Hyper Voice', 'Tera Blast', 'Weather Ball',
  'Knock Off', 'Acrobatics', 'Psyshock', 'Population Bomb', 'Triple Axel', 'Facade', 'Seismic Toss', 'Meteor Beam', 'Kowtow Cleave',
  'Superpower', 'Draco Meteor', 'Ivy Cudgel', 'Tri Attack', 'Bullet Seed', 'Return', 'Earthquake', 'Thunderbolt', 'Tera Starstorm'];
const fields = [new Field(), new Field({ weather: 'Rain' }), new Field({ weather: 'Sun' }), new Field({ terrain: 'Electric' }),
  new Field({ terrain: 'Grassy' }), new Field({ weather: 'Snow' })];

/** Tutti i colpi del campione: danni, descrizione e stato finale degli oggetti passati (che non devono cambiare). */
function sample(): string[] {
  const out: string[] = [];
  for (const [aName, aOpts] of attackers) {
    for (const [dName, dOpts] of defenders) {
      const attacker = new Pokemon(gen, aName, aOpts);
      const defender = new Pokemon(gen, dName, dOpts);
      for (const name of moves) {
        const move = new Move(gen, name, { ability: attacker.ability, item: attacker.item });
        for (const field of fields) {
          try {
            const result = calculate(gen, attacker, defender, move, field);
            let desc = '';
            try { desc = result.fullDesc(); } catch { desc = 'no desc'; }
            out.push(JSON.stringify([aName, dName, name, result.damage, desc]));
          } catch (error) {
            out.push(`${aName}|${dName}|${name}|error ${String(error)}`);
          }
        }
      }
      out.push(JSON.stringify([attacker.stats, attacker.boosts, attacker.types, defender.stats, defender.boosts, defender.types]));
    }
  }
  return out;
}

describe('installFastClone', () => {
  it('dÃ  gli stessi danni e la stessa descrizione della copia della libreria', () => {
    uninstallFastClone();
    const before = sample();
    installFastClone();
    const after = sample();
    expect(after.length).toBe(before.length);
    // Il campione Ã¨ fatto di colpi veri (nomi giusti), non di errori uguali da tutte e due le parti
    expect(before.filter(line => line.includes('|error ')).length).toBe(0);
    expect(before.filter(line => /"no desc"\]$/.test(line)).length).toBeLessThan(before.length / 5); // immunitÃ  e colpi a 0: la libreria non li descrive
    for (let i = 0; i < before.length; i++) expect(after[i]).toBe(before[i]);
  });

  it('la copia non tocca gli oggetti di partenza', () => {
    installFastClone();
    const attacker = new Pokemon(gen, 'Kangaskhan-Mega', { ability: 'Parental Bond', item: 'Kangaskhanite', evs: { atk: 252 } });
    const defender = new Pokemon(gen, 'Gyarados', { ability: 'Intimidate', evs: { hp: 252, def: 252 } });
    const snapshot = JSON.stringify([attacker, defender].map(p => [p.stats, p.rawStats, p.boosts, p.types, p.species]));
    calculate(gen, attacker, defender, new Move(gen, 'Body Slam'), new Field({ weather: 'Rain' }));
    expect(JSON.stringify([attacker, defender].map(p => [p.stats, p.rawStats, p.boosts, p.types, p.species]))).toBe(snapshot);
  });
});
