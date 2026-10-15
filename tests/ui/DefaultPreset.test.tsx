import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { EngineData } from '../../src/engine/data';
import { defaultSet, emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const offense = {
  ...emptySet('Great Tusk'), item: 'Booster Energy', ability: 'Protosynthesis', nature: 'Jolly',
  moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252, hp: 4 }, teraType: 'Ice',
};
const presets = { 'Great Tusk': [
  { name: 'Offensive Spinner', format: 'gen9nationaldex', set: offense },
  { name: 'Bulky', format: 'gen9nationaldex', set: { ...offense, item: 'Leftovers', moves: ['Earthquake', 'Knock Off', 'Rapid Spin', 'Stealth Rock'] } },
] };
const data: EngineData = { ...fixtureData, presets };

describe('il set iniziale è il primo preset Smogon del formato', () => {
  it('defaultSet: il primo preset del formato vince sulle statistiche', () => {
    expect(defaultSet(data, 'Great Tusk')).toEqual(offense);
  });

  it('senza preset resta il set delle statistiche', () => {
    expect(defaultSet(fixtureData, 'Great Tusk')).toEqual(defaultSet({ ...fixtureData, presets: {} }, 'Great Tusk'));
    expect(defaultSet(fixtureData, 'Great Tusk').item).not.toBe('');
  });

  it('aggiunto dal campo, l\'editor mostra il preset invece di Custom', async () => {
    const user = userEvent.setup();
    render(<App data={data} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Great Tusk', { selector: '.name' }));
    expect(within(team).getByLabelText('Preset Smogon').closest('.combobox')).toHaveTextContent('Offensive Spinner');
  });
});
