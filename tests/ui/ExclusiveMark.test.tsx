import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { ExclusiveMark } from '../../src/ui/candidateParts';
import { renderIt } from '../helpers/italian';

beforeAll(() => initGames({ sv: { dex: ['larvitar', 'bagon'] } }));

describe('badge delle esclusive', () => {
  it('nel gioco: "Ottenibile solo in Scarlatto"', () => {
    renderIt(<ExclusiveMark species="Tyranitar" format={withGame(DEFAULT_FORMAT, 'sv')} />);
    expect(screen.getByRole('img', { name: 'Ottenibile solo in Scarlatto' })).toHaveTextContent('Ottenibile solo in Scarlatto');
  });

  it("sulla scheda del candidato, compatto: solo l'iniziale (il testo intero nel tooltip)", () => {
    renderIt(<ExclusiveMark compact species="Salamence" format={withGame(DEFAULT_FORMAT, 'sv')} />);
    const mark = screen.getByRole('img', { name: 'Ottenibile solo in Violetto' });
    expect(mark).toHaveTextContent(/^V$/);
    expect(mark).toHaveAttribute('title', 'Ottenibile solo in Violetto');
  });

  it('senza gioco o per chi sta in entrambe: niente', () => {
    const { container } = renderIt(<><ExclusiveMark species="Tyranitar" format={DEFAULT_FORMAT} /><ExclusiveMark species="Garchomp" format={withGame(DEFAULT_FORMAT, 'sv')} /></>);
    expect(container.querySelector('.version-mark')).toBeNull();
  });
});
