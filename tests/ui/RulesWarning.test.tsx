import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { initLearnsets } from '../../src/engine/learnsets';
import { App } from '../../src/App';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

beforeAll(async () => { await initLearnsets(); });

const rating = () => screen.getByRole('group', { name: 'Valutazione team' });

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App data={fixtureData} initialLang="it" />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
}

describe('voto con membri fuori regola', () => {
  it('triangolo rosso accanto al voto, col motivo nel tooltip', async () => {
    await importTeam('Great Tusk @ Leftovers\nAbility: Protosynthesis\n- Rapid Spin\n\nMewtwo @ Life Orb\nAbility: Pressure\n- Psystrike');
    const mark = rating().querySelector('.grade .alert-mark.danger') as HTMLElement;
    expect(mark).not.toBeNull();
    const tip = within(mark).getByRole('tooltip');
    expect(tip).toHaveTextContent('Uno o più membri del team non rispettano le regole del formato');
    expect(tip).toHaveTextContent('Mewtwo non è legale in National Dex OU');
  });

  it('team in regola: nessun triangolo', async () => {
    await importTeam('Great Tusk @ Leftovers\nAbility: Protosynthesis\n- Rapid Spin');
    expect(rating().querySelector('.grade .alert-mark')).toBeNull();
  });
});

describe('coaching', () => {
  it('mosse o abilità non legali sono un problema di regole', () => {
    const team = [{ ...emptySet('Garchomp'), ability: 'Huge Power', moves: ['Earthquake', 'Spore'] }, { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Rapid Spin'] }];
    const rules = coachTeam(team, DEFAULT_FORMAT, fixtureData, 'it').problems.filter(p => p.category === 'rules').map(p => p.text);
    expect(rules).toContain('Garchomp: Mosse non legali: Spore');
    expect(rules).toContain('Garchomp: Abilità non legale: Huge Power');
  });
});
