import { describe, expect, it } from 'vitest';
import { MemberCard } from '../../src/ui/MemberCard';
import { RulesContext } from '../../src/ui/rulesContext';
import { formatRules } from '../../src/engine/formatRules';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { renderIt } from '../helpers/italian';

const tusk = {
  species: 'Great Tusk', item: 'Booster Energy', ability: 'Protosynthesis', nature: 'Jolly',
  moves: ['Headlong Rush', 'Ice Spinner', 'Rapid Spin', 'Bulk Up'], evs: { atk: 252, spe: 252, hp: 4 }, ivs: {},
} as never;

describe('Carta del Pokémon (tooltip DreamDex)', () => {
  it('testata coi colori dei tipi, set in breve, statistiche a esagono, le quattro mosse e i ruoli in fondo', () => {
    const { container } = renderIt(<RulesContext.Provider value={formatRules(DEFAULT_FORMAT.formatId)}><MemberCard set={tusk} /></RulesContext.Provider>);
    expect(container.querySelector('.mcard-name')).toHaveTextContent('Great Tusk');
    // Terra e Lotta: due icone di tipo nel nome
    expect(container.querySelectorAll('.mcard-name img')).toHaveLength(2);
    // Niente lastra azzurra: i ruoli sono una riga semplice in fondo, dopo le mosse
    expect(container.querySelector('.mcard-why')).toBeNull();
    expect(container.lastElementChild).toHaveClass('mcard-roles');
    expect(container.querySelector('.mcard-roles')).toHaveTextContent(/^Ruoli\S/);
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
    // Una mossa di stato: nella coda solo il simbolo della categoria, niente numero
    expect(moves[3]).toHaveTextContent(/^Bulk Up$/);
    expect(moves[3].querySelector('.mvp-cat.cat-status')).not.toBeNull();
    expect(moves[0].querySelector('.mvp-cat.cat-physical')).not.toBeNull();
  });

  it('senza le regole del formato la riga dei ruoli non c\'è', () => {
    const { container } = renderIt(<MemberCard set={tusk} />);
    expect(container.querySelector('.mcard-roles')).toBeNull();
  });
});
