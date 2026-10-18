import type { EngineData } from '../../src/engine/data';
import type { SpeciesStats } from '../../src/engine/stats';

/**
 * Meta di prova per Completa team: muri (per Stall, Semi-Stall, Balance), attaccanti, chi porta pioggia e sole
 * e chi ne approfitta, Trick Room e una Mega. Ogni specie ha un solo set (strumento, abilità, mosse, spread).
 */
const entry = (usage: number, item: string, ability: string, moves: string[], spread: string): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: { [item]: 1 }, teraTypes: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), spreads: { [spread]: 1 }, teammates: {}, checks: {},
});
const WALL = 'Bold:252/0/252/0/4/0';
const SPDEF = 'Calm:252/0/4/0/252/0';
const PHYS = 'Jolly:0/252/0/0/4/252';
const SPEC = 'Timid:0/0/0/252/4/252';
const SLOW = 'Brave:252/252/0/0/4/0';

export const fillData: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1000 },
    pokemon: {
      // Muri passivi
      'Toxapex': entry(0.20, 'blacksludge', 'regenerator', ['toxic', 'recover', 'haze', 'toxicspikes'], WALL),
      'Blissey': entry(0.18, 'heavydutyboots', 'naturalcure', ['softboiled', 'seismictoss', 'toxic', 'stealthrock'], WALL),
      'Skarmory': entry(0.16, 'rockyhelmet', 'sturdy', ['roost', 'spikes', 'whirlwind', 'bravebird'], WALL),
      'Clodsire': entry(0.15, 'heavydutyboots', 'unaware', ['recover', 'toxic', 'earthquake', 'spikes'], SPDEF),
      'Gliscor': entry(0.15, 'toxicorb', 'poisonheal', ['protect', 'toxic', 'earthquake', 'spikes'], WALL),
      'Corviknight': entry(0.17, 'leftovers', 'pressure', ['roost', 'defog', 'uturn', 'bodypress'], WALL),
      'Dondozo': entry(0.12, 'leftovers', 'unaware', ['rest', 'sleeptalk', 'wavecrash', 'curse'], WALL),
      'Alomomola': entry(0.12, 'heavydutyboots', 'regenerator', ['wish', 'protect', 'scald', 'flipturn'], WALL),
      // Attaccanti
      'Garchomp': entry(0.22, 'rockyhelmet', 'roughskin', ['earthquake', 'outrage', 'stealthrock', 'swordsdance'], PHYS),
      'Dragapult': entry(0.21, 'choicespecs', 'infiltrator', ['shadowball', 'dracometeor', 'flamethrower', 'uturn'], SPEC),
      'Iron Valiant': entry(0.19, 'boosterenergy', 'quarkdrive', ['moonblast', 'closecombat', 'knockoff', 'calmmind'], SPEC),
      'Kingambit': entry(0.23, 'blackglasses', 'supremeoverlord', ['kowtowcleave', 'suckerpunch', 'ironhead', 'swordsdance'], PHYS),
      'Gholdengo': entry(0.21, 'choicescarf', 'goodasgold', ['makeitrain', 'shadowball', 'trick', 'nastyplot'], SPEC),
      'Great Tusk': entry(0.24, 'boosterenergy', 'protosynthesis', ['headlongrush', 'closecombat', 'icespinner', 'rapidspin'], PHYS),
      'Weavile': entry(0.14, 'choiceband', 'pressure', ['tripleaxel', 'knockoff', 'iceshard', 'lowkick'], PHYS),
      'Volcarona': entry(0.14, 'heavydutyboots', 'flamebody', ['quiverdance', 'fierydance', 'gigadrain', 'roost'], SPEC),
      'Cinderace': entry(0.13, 'heavydutyboots', 'libero', ['pyroball', 'uturn', 'courtchange', 'suckerpunch'], PHYS),
      // Pioggia e sole: chi li porta e chi li sfrutta
      'Pelipper': entry(0.11, 'damprock', 'drizzle', ['hurricane', 'scald', 'uturn', 'roost'], SPDEF),
      'Barraskewda': entry(0.10, 'choiceband', 'swiftswim', ['liquidation', 'closecombat', 'aquajet', 'flipturn'], PHYS),
      'Torkoal': entry(0.10, 'heatrock', 'drought', ['lavaplume', 'stealthrock', 'rapidspin', 'yawn'], WALL),
      'Venusaur': entry(0.10, 'lifeorb', 'chlorophyll', ['growth', 'gigadrain', 'weatherball', 'sludgebomb'], SPEC),
      'Lilligant-Hisui': entry(0.09, 'lifeorb', 'chlorophyll', ['victorydance', 'closecombat', 'leafblade', 'icespinner'], PHYS),
      'Kingdra': entry(0.09, 'choicespecs', 'swiftswim', ['hydropump', 'dracometeor', 'surf', 'flipturn'], SPEC),
      // Trick Room
      'Hatterene': entry(0.09, 'lifeorb', 'magicbounce', ['trickroom', 'psychic', 'drainingkiss', 'mysticalfire'], 'Quiet:252/0/0/252/4/0'),
      'Ursaluna': entry(0.09, 'flameorb', 'guts', ['facade', 'headlongrush', 'swordsdance', 'protect'], SLOW),
      'Iron Hands': entry(0.09, 'assaultvest', 'quarkdrive', ['drainpunch', 'wildcharge', 'icepunch', 'fakeout'], SLOW),
      // Una Mega
      'Charizard-Mega-Y': entry(0.08, 'charizarditey', 'drought', ['flamethrower', 'solarbeam', 'focusblast', 'roost'], SPEC),
    },
  },
  sets: {},
};
