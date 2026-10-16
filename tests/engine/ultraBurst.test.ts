import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { battleSpecies } from '../../src/engine/dex';
import { initLearnsets } from '../../src/engine/learnsets';
import { defaultSet, emptySet, presetsFor, sameSet } from '../../src/engine/sets';

beforeAll(async () => { await initLearnsets(); });

const ultra = {
  ...emptySet('Necrozma-Ultra'), item: 'Ultranecrozium Z', ability: 'Prism Armor', nature: 'Adamant',
  moves: ['Dragon Dance', 'Photon Geyser', 'Earthquake', 'Stone Edge'], evs: { hp: 40, atk: 248, def: 80, spe: 140 },
};
const duskMane = { ...emptySet('Necrozma-Dusk-Mane'), item: 'Solganium Z', ability: 'Prism Armor', nature: 'Adamant', moves: ['Dragon Dance', 'Sunsteel Strike', 'Earthquake', 'Stone Edge'] };
const data: EngineData = { stats: null, sets: null, presets: {
  'Necrozma-Dusk-Mane': [{ name: 'Dragon Dance', format: 'gen9nationaldexubers', set: duskMane }],
  'Necrozma-Ultra': [{ name: 'Ultra Burst', format: 'gen9nationaldexubers', set: ultra }],
} };

describe('Ultraesplosione come una Mega', () => {
  it('Dusk-Mane o Dawn-Wings con l\u2019Ultranecrozium Z: in battaglia è Necrozma-Ultra', () => {
    expect(battleSpecies({ species: 'Necrozma-Dusk-Mane', item: 'Ultranecrozium Z' })?.name).toBe('Necrozma-Ultra');
    expect(battleSpecies({ species: 'Necrozma-Dawn-Wings', item: 'Ultranecrozium Z' })?.name).toBe('Necrozma-Ultra');
    expect(battleSpecies({ species: 'Necrozma-Dusk-Mane', item: 'Solganium Z' })?.name).toBe('Necrozma-Dusk-Mane');
  });

  it('il preset "Necrozma-Ultra" sta tra quelli di Dusk-Mane (set fisico), con lo Z-cristallo', () => {
    const presets = presetsFor(data, 'Necrozma-Dusk-Mane');
    expect(presets.map(p => p.name)).toEqual(['Dragon Dance', 'Ultra Burst']);
    expect(presets[1].set).toEqual(expect.objectContaining({ species: 'Necrozma-Dusk-Mane', item: 'Ultranecrozium Z', ability: 'Prism Armor' }));
  });

  it('aggiungere "Necrozma-Ultra" mette Dusk-Mane con lo Z-cristallo, riconosciuto come preset', () => {
    const set = defaultSet(data, 'Necrozma-Ultra');
    expect(set).toEqual(expect.objectContaining({ species: 'Necrozma-Dusk-Mane', item: 'Ultranecrozium Z', ability: 'Prism Armor' }));
    expect(presetsFor(data, set.species).some(p => sameSet(p.set, set))).toBe(true);
  });
});
