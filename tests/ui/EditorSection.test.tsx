import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { mostCommonSet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

const third = mostCommonSet(fixtureStats, Object.keys(fixtureStats.pokemon).find(s => s !== 'Great Tusk' && s !== 'Gholdengo')!)!;
function renderTeam() {
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo, third], DEFAULT_FORMAT)}`);
  return render(<App initialLang="it" data={fixtureData} />);
}
const workspace = (container: HTMLElement) => container.querySelector('.workspace')!;
const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.slot-toggle')];

describe("L'editor del set prende il posto della sezione", () => {
  it('aprendo una carta la sezione diventa il suo editor', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    expect(workspace(container)).not.toHaveClass('editing');
    await user.click(cards(container)[0]);
    expect(workspace(container)).toHaveClass('editing');
  });

  it('Esc chiude l\'editor, torna sulla carta e la sezione di prima è intatta', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Lat');
    await user.click(cards(container)[0]);
    await user.keyboard('{Escape}');
    expect(workspace(container)).not.toHaveClass('editing');
    expect(cards(container)[0]).toHaveFocus();
    expect(screen.getByLabelText('Aggiungi Pokémon')).toHaveValue('Lat');
  });

  it('scegliere una sezione nella barra laterale chiude l\'editor', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.click(cards(container)[0]);
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(workspace(container)).not.toHaveClass('editing');
    expect(container.querySelector('.slot.open')).toBeNull();
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('Sostituisci nell\'editor chiude l\'editor e apre i candidati per quel membro', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    await user.click(cards(container)[0]);
    await user.click(within(container.querySelector('.slot.open') as HTMLElement).getByRole('button', { name: 'Sostituisci Great Tusk' }));
    expect(workspace(container)).not.toHaveClass('editing');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Chi sostituire: Great Tusk' })).toBeInTheDocument();
    // A vista la tendina dice "al posto di" prima del membro scelto
    expect(screen.getByRole('button', { name: 'Chi sostituire: Great Tusk' }).querySelector('.target-prefix')).toHaveTextContent('al posto di');
  });

  it('cliccando un\'altra carta l\'editor passa a quel membro', async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.click(cards(container)[0]);
    await user.click(cards(container)[1]);
    expect(workspace(container)).toHaveClass('editing');
    expect(cards(container)[1].closest('.slot')).toHaveClass('open');
    expect(cards(container)[0].closest('.slot')).not.toHaveClass('open');
  });

  it("se il team si accorcia sotto il membro aperto (import), l'editor si chiude e la sezione torna", async () => {
    const user = userEvent.setup();
    const { container } = renderTeam();
    await user.click(cards(container)[2]);
    expect(workspace(container)).toHaveClass('editing');
    await user.click(document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!);
    await user.type(screen.getByLabelText('Testo Showdown'), 'Great Tusk{Enter}Ability: Protosynthesis{Enter}- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(cards(container)).toHaveLength(1);
    expect(workspace(container)).not.toHaveClass('editing');
  });
});
