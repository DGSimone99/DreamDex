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

const rating = () => document.querySelector<HTMLElement>('.band')!;

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App data={fixtureData} initialLang="it" />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
}

describe('voto con membri fuori regola', () => {
  it('voto grigio con il perché sotto il giudizio ("Non legale: 1 Pokémon"), formato, chi e motivo al passaggio, niente triangolo', async () => {
    await importTeam('Great Tusk @ Leftovers\nAbility: Protosynthesis\n- Rapid Spin\n\nMewtwo @ Life Orb\nAbility: Pressure\n- Psystrike');
    const note = rating().querySelector('.grade-badge .grade-rules') as HTMLElement;
    expect(note).toHaveTextContent('Non legale: 1 Pokémon');
    expect(note.title).toContain('Non legale in National Dex OU: 1 Pokémon');
    // Il voto in grigio anche nella tessera Analisi del menu
    expect(document.querySelector('#tab-analysis .grade')).toHaveClass('illegal');
    expect(note.title).toContain('Non legali: Mewtwo');
    expect(note.title).toContain('Mewtwo non è legale in National Dex OU: tier troppo alto');
    expect(rating().querySelector('.grade-badge')).toHaveClass('rules-broken');
    expect(rating().querySelector('.grade-tools .alert-mark.danger')).toBeNull();
    // Per i lettori di schermo nella frase del voto
    expect(rating().querySelector('.grade-badge .visually-hidden')).toHaveTextContent(/Non legale in National Dex OU: 1 Pokémon \(Mewtwo\): Mewtwo non è legale in National Dex OU/);
  });

  it('team in regola: niente scritta né triangolo', async () => {
    await importTeam('Great Tusk @ Leftovers\nAbility: Protosynthesis\n- Rapid Spin');
    expect(rating().querySelector('.grade-tools .alert-mark')).toBeNull();
    expect(rating().querySelector('.grade-rules')).toBeNull();
    expect(rating().querySelector('.grade-badge')).not.toHaveClass('rules-broken');
    expect(document.querySelector('#tab-analysis .grade')).not.toHaveClass('illegal');
  });
});

describe('coaching', () => {
  it('mosse o abilità non legali sono un problema di regole', () => {
    const team = [{ ...emptySet('Garchomp'), ability: 'Huge Power', moves: ['Earthquake', 'Spore'] }, { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Rapid Spin'] }];
    const rules = coachTeam(team, DEFAULT_FORMAT, fixtureData, 'it').problems.filter(p => p.category === 'rules').map(p => p.text);
    expect(rules).toContain('Garchomp: Mosse non legali in questo formato: Spore');
    expect(rules).toContain('Garchomp: Abilità non legale in questo formato: Huge Power');
  });
});
