import { describe, expect, it } from 'vitest';
import { MemberCard } from '../../src/ui/MemberCard';
import { renderIt } from '../helpers/italian';

const tusk = {
  species: 'Great Tusk', item: 'Booster Energy', ability: 'Protosynthesis', nature: 'Jolly',
  moves: ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], evs: { atk: 252, spe: 252, hp: 4 }, ivs: {},
} as never;

describe('Carta del Pokémon (tooltip DreamDex)', () => {
  it('testata coi colori dei tipi, il perché, set in breve, statistiche a esagono e le quattro mosse', () => {
    const { container } = renderIt(<MemberCard set={tusk} why="Attaccante · 82 in Offesa" />);
    expect(container.querySelector('.mcard-name')).toHaveTextContent('Great Tusk');
    // Terra e Lotta: due icone di tipo nel nome
    expect(container.querySelectorAll('.mcard-name img')).toHaveLength(2);
    expect(container.querySelector('.mcard-why')).toHaveTextContent('Attaccante · 82 in Offesa');
    const kit = container.querySelector('.mcard-kit')!;
    expect(kit).toHaveTextContent(/Strumento\s*Booster Energy/);
    expect(kit).toHaveTextContent(/Natura\s*Jolly\s*\+Vel −AttSp/);
    expect(kit).toHaveTextContent('252 Att · 252 Vel · 4 PS');
    // Esagono: le statistiche finali; Velocità alzata dalla natura in verde, Attacco Speciale abbassato in rosso
    const values = [...container.querySelectorAll('.hx-v')];
    expect(values.map(v => v.textContent)).toEqual(['372', '361', '298', '300', '142', '127']);
    expect(values[3]).toHaveClass('up');
    expect(values[5]).toHaveClass('down');
    const moves = [...container.querySelectorAll('.mcard-move')];
    expect(moves).toHaveLength(4);
    expect(moves[0]).toHaveTextContent(/Headlong Rush\s*120/);
    // Una mossa di stato: niente potenza, "stato"
    expect(moves[3]).toHaveTextContent(/Bulk Up\s*stato/);
  });

  it('senza il perché la lastra non c\'è', () => {
    const { container } = renderIt(<MemberCard set={tusk} />);
    expect(container.querySelector('.mcard-why')).toBeNull();
  });
});
