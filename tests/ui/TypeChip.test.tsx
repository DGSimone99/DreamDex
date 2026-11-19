import { afterEach, describe, expect, it } from 'vitest';
import { initGameNames } from '../../src/i18n/game';
import { TypeChip } from '../../src/ui/Sprite';
import { render } from '@testing-library/react';
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

  it('ogni tipo ha il suo gruppo di larghezza (corto, medio, lungo) secondo il nome scritto', () => {
    initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { bug: 'Coleottero', fire: 'Fuoco', rock: 'Roccia' } });
    const { container } = renderIt(<><TypeChip type="Fire" /><TypeChip type="Rock" /><TypeChip type="Bug" /></>);
    const [fire, rock, bug] = container.querySelectorAll('.type-chip');
    expect(fire).toHaveClass('tw-s');
    expect(rock).toHaveClass('tw-m');
    expect(bug).toHaveClass('tw-l');
  });

  it('in inglese i gruppi seguono i nomi inglesi', () => {
    const { container } = render(<><TypeChip type="Bug" /><TypeChip type="Ground" /><TypeChip type="Fighting" /></>);
    const [bug, ground, fighting] = container.querySelectorAll('.type-chip');
    expect(bug).toHaveClass('tw-s');
    expect(ground).toHaveClass('tw-m');
    expect(fighting).toHaveClass('tw-l');
  });
});
