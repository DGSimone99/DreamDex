import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { t } from '../../src/i18n';

const mk = (species: string, ability: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(species), item, ability, moves });
const style = (team: TeamSet[]) => teamArchetype(team, DOUBLES_RULES)!.styles;

// Chi porta e chi sfrutta
const torkoal = mk('Torkoal', 'Drought', ['Eruption', 'Protect']);
const venusaur = mk('Venusaur', 'Chlorophyll', ['Sludge Bomb', 'Protect']);
const lilligant = mk('Lilligant', 'Chlorophyll', ['Leaf Storm', 'After You']);
const indeedee = mk('Indeedee-F', 'Psychic Surge', ['Follow Me', 'Helping Hand']);
const hatterene = mk('Hatterene', 'Magic Bounce', ['Expanding Force', 'Dazzling Gleam']);
const pelipper = mk('Pelipper', 'Drizzle', ['Hurricane', 'Protect']);
const kingdra = mk('Kingdra', 'Swift Swim', ['Muddy Water', 'Protect']);
const tornadus = mk('Tornadus', 'Prankster', ['Tailwind', 'Bleakwind Storm']);
const tyranitar = mk('Tyranitar', 'Sand Stream', ['Rock Slide', 'Crunch']);
const incineroar = mk('Incineroar', 'Intimidate', ['Fake Out', 'Flare Blitz']);
const garchomp = mk('Garchomp', 'Rough Skin', ['Earthquake', 'Protect']);
// Trick Room: chi la porta e due lenti
const cresselia = mk('Cresselia', 'Levitate', ['Trick Room', 'Moonblast']);
const ursaluna = mk('Rhyperior', 'Solid Rock', ['Rock Slide', 'High Horsepower', 'Ice Punch', 'Protect']);
const amoonguss = mk('Amoonguss', 'Regenerator', ['Sludge Bomb', 'Giga Drain', 'Clear Smog', 'Spore']);

describe("doppio: l'etichetta di stile", () => {
  it('una sola etichetta, quella con più membri', () => {
    // Sole: Torkoal + 2 che lo sfruttano (3); Campo Psichico: Indeedee + 1 (2)
    expect(style([torkoal, venusaur, lilligant, indeedee, hatterene, incineroar])).toEqual(['sun']);
    // Campo Psichico con più membri del sole
    const armarouge = mk('Armarouge', 'Flash Fire', ['Expanding Force', 'Heat Wave']);
    expect(style([torkoal, venusaur, indeedee, hatterene, armarouge, incineroar])).toEqual(['psychicterrain']);
  });

  it('a pari merito vince il meteo sul campo, il campo su Trick Room', () => {
    // Sole 2 (Torkoal, Venusaur), Campo Psichico 2 (Indeedee, Hatterene)
    expect(style([torkoal, venusaur, indeedee, hatterene, incineroar, garchomp])).toEqual(['sun']);
    // Pioggia 2 e sole 2: fra due meteo vince il primo dell'ordine (sole, pioggia, sabbia, neve)
    expect(style([pelipper, kingdra, torkoal, venusaur, incineroar, garchomp])).toEqual(['sun']);
    // Campo Psichico 3 (Indeedee, Alakazam, Armarouge) e Trick Room 3 (Cresselia + 2 lenti)
    const armarouge = mk('Armarouge', 'Flash Fire', ['Expanding Force', 'Heat Wave']);
    // (Alakazam e non Hatterene: Hatterene è lenta e conterebbe anche per Trick Room)
    const alakazam = mk('Alakazam', 'Magic Guard', ['Expanding Force', 'Dazzling Gleam']);
    expect(style([indeedee, alakazam, armarouge, cresselia, ursaluna, amoonguss])).toEqual(['psychicterrain']);
  });

  it('il campo psichico con chi lo sfrutta è uno stile', () => {
    expect(style([indeedee, hatterene, incineroar, garchomp])).toEqual(['psychicterrain']);
  });

  it('Trick Room con due membri lenti è uno stile, anche con Tailwind nel team', () => {
    expect(style([cresselia, ursaluna, amoonguss, tornadus, incineroar, garchomp])).toEqual(['trickroom']);
  });

  it("Tailwind compare solo se non c'è altro", () => {
    expect(style([tornadus, incineroar, garchomp])).toEqual(['tailwind']);
    // Due membri con Tailwind (2) contro un sole sfruttato (2): vince il sole
    const whimsicott = mk('Whimsicott', 'Prankster', ['Tailwind', 'Moonblast']);
    expect(style([tornadus, whimsicott, torkoal, venusaur, incineroar, garchomp])).toEqual(['sun']);
  });

  it('un meteo che nessuno sfrutta non è uno stile', () => {
    expect(style([tyranitar, incineroar, garchomp, hatterene])).toEqual([]);
    expect(style([incineroar, garchomp])).toEqual([]);
  });

  it('in singolo niente campi né Tailwind, e ancora fino a due stili', () => {
    const single = (team: TeamSet[]) => teamArchetype(team, NATDEX_OU_RULES)!.styles;
    expect(single([torkoal, venusaur, indeedee, hatterene, tornadus, garchomp])).toEqual(['sun']);
    expect(single([torkoal, venusaur, pelipper, kingdra, indeedee, hatterene])).toEqual(['rain', 'sun']);
  });

  it('i nomi dei cinque stili nuovi', () => {
    expect(['grassyterrain', 'psychicterrain', 'electricterrain', 'mistyterrain', 'tailwind'].map(s => t('it', `teamStyle.${s}` as 'teamStyle.tailwind')))
      .toEqual(['Campo Erboso', 'Campo Psichico', 'Campo Elettrico', 'Campo Nebbioso', 'Tailwind']);
    expect(['grassyterrain', 'psychicterrain', 'electricterrain', 'mistyterrain', 'tailwind'].map(s => t('en', `teamStyle.${s}` as 'teamStyle.tailwind')))
      .toEqual(['Grassy Terrain', 'Psychic Terrain', 'Electric Terrain', 'Misty Terrain', 'Tailwind']);
  });
});
