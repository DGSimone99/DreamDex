import { act, fireEvent, render } from '@testing-library/react';
import type { DragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { TeamPanel } from '../../src/ui/TeamPanel';
import { endSetDrag, startSetDrag } from '../../src/ui/teamDrag';
import { LangProvider } from '../../src/i18n/react';
import { fixtureData } from '../fixtures/data';

function renderPanel(species: string[]) {
  const onDropSet = vi.fn();
  const team = species.map(name => ({ ...emptySet(name), moves: ['Tackle', '', '', ''] }));
  const { container } = render(
    <LangProvider lang="it">
      <TeamPanel team={team} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => undefined} onAdd={() => undefined}
        onReplace={() => undefined} onRemove={() => undefined} onAllowMultipleMegas={() => undefined} onDropSet={onDropSet} />
    </LangProvider>,
  );
  return { onDropSet, container };
}

// Il trascinamento parte da una carta della lista Pokémon (CandidateCard): qui basta il suo inizio
const fromList = (name: string) => {
  const set = emptySet(name);
  act(() => startSetDrag({ dataTransfer: { setData: () => undefined } } as unknown as DragEvent, set));
  return set;
};

describe('Candidato trascinato dalla lista sul team', () => {
  it('sopra un membro lo sostituisce, anche se non è quello scelto in Sostituisci', () => {
    const { onDropSet, container } = renderPanel(['Garchomp', 'Gardevoir']);
    const set = fromList('Great Tusk');
    const card = container.querySelectorAll('.slot.filled > .slot-card')[1];
    fireEvent.dragOver(card);
    expect(card.parentElement).toHaveClass('drop-target');
    fireEvent.drop(card);
    expect(onDropSet).toHaveBeenCalledWith(1, set);
    expect(container.querySelector('.drop-target')).toBeNull();
  });

  it('sopra uno slot vuoto lo aggiunge', () => {
    const { onDropSet, container } = renderPanel(['Garchomp']);
    const set = fromList('Great Tusk');
    const empty = container.querySelectorAll('.slot.empty')[2];
    fireEvent.dragOver(empty);
    expect(empty).toHaveClass('drop-target');
    fireEvent.drop(empty);
    expect(onDropSet).toHaveBeenCalledWith(null, set);
  });

  it('lasciato fuori dal team non cambia niente', () => {
    const { onDropSet, container } = renderPanel(['Garchomp']);
    fromList('Great Tusk');
    fireEvent.dragOver(container.querySelector('.slot.empty')!);
    act(() => endSetDrag());
    expect(container.querySelector('.drop-target')).toBeNull();
    expect(onDropSet).not.toHaveBeenCalled();
  });
});
