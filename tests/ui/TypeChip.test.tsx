import { afterEach, describe, expect, it } from 'vitest';
import { initGameNames } from '../../src/i18n/game';
import { TypeChip } from '../../src/ui/Sprite';
import { renderIt } from '../helpers/italian';

afterEach(() => initGameNames(null));

describe('chip dei tipi', () => {
  it('i nomi lunghi (oltre 8 lettere) usano il testo ridotto per restare nel chip', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { bug: 'Coleottero', fire: 'Fuoco' } });
    const { container } = renderIt(<><TypeChip type="Bug" /><TypeChip type="Fire" /></>);
    const [bug, fire] = container.querySelectorAll('.type-chip');
    expect(bug).toHaveTextContent('Coleottero');
    expect(bug).toHaveClass('long');
    expect(fire).not.toHaveClass('long');
  });
});
