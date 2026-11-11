import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { emptySet, importShowdown, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';
import { renderIt } from '../helpers/italian';

let latest: TeamSet | null = null;
function Editor({ initial }: { initial: TeamSet }) {
  const [set, setSet] = useState(initial);
  latest = set;
  return <SetEditor set={set} genLimit={9} onChange={setSet} />;
}
const chomp: TeamSet = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252 } };

describe('editor: valori scritti a mano', () => {
  it('EV con la virgola, negativi, oltre 252 o non numerici: sempre interi tra 0 e 252', () => {
    renderIt(<Editor initial={chomp} />);
    const hp = screen.getByLabelText('PS', { selector: 'input.ev-input' });
    fireEvent.change(hp, { target: { value: '12.7' } });
    expect(latest?.evs.hp).toBe(12);
    fireEvent.change(hp, { target: { value: '999' } });
    expect(latest?.evs.hp).toBe(252);
    fireEvent.change(hp, { target: { value: '-5' } });
    expect(latest?.evs.hp).toBe(0);
    fireEvent.change(hp, { target: { value: '' } });
    expect(latest?.evs.hp).toBe(0);
  });

  it('EV oltre il totale: il valore resta e il totale lo dice (avvisa, non blocca)', () => {
    renderIt(<Editor initial={chomp} />);
    fireEvent.change(screen.getByLabelText('PS', { selector: 'input.ev-input' }), { target: { value: '252' } });
    expect(latest?.evs).toEqual({ atk: 252, spe: 252, hp: 252 });
    expect(document.querySelector('.ev-total')).toHaveClass('over');
  });

  it('IV fuori scala: resta tra 0 e 31', () => {
    renderIt(<Editor initial={chomp} />);
    const iv = screen.getByLabelText('IV VEL');
    fireEvent.change(iv, { target: { value: '40' } });
    expect(latest?.ivs).toBeUndefined();
    fireEvent.change(iv, { target: { value: '-3' } });
    expect(latest?.ivs).toEqual({ spe: 0 });
    fireEvent.change(iv, { target: { value: '' } });
    fireEvent.blur(iv);
    expect(latest?.ivs).toBeUndefined();
  });
});

describe('import Showdown: testo sporco', () => {
  it('a capo di Windows e spazi in più: si legge tutto', () => {
    const { sets, errors } = importShowdown('Garchomp @ Choice Scarf  \r\nAbility:   Rough Skin\r\nJolly Nature\r\n- Earthquake\r\n-   Outrage  \r\n\r\n\r\nGreat Tusk\r\n- Rapid Spin', 'it');
    expect(errors).toEqual([]);
    expect(sets.map(s => s.species)).toEqual(['Garchomp', 'Great Tusk']);
    expect(sets[0]).toMatchObject({ item: 'Choice Scarf', ability: 'Rough Skin', moves: ['Earthquake', 'Outrage'] });
  });

  it('più di 4 mosse: tenute le prime 4, con l’avviso', () => {
    const { sets, errors } = importShowdown('Garchomp\n- Earthquake\n- Outrage\n- Swords Dance\n- Scale Shot\n- Fire Fang', 'it');
    expect(sets[0].moves).toEqual(['Earthquake', 'Outrage', 'Swords Dance', 'Scale Shot']);
    expect(errors).toEqual(['Garchomp: più di 4 mosse, tenute le prime 4']);
  });

  it('mossa, abilità e tipo Tera sconosciuti (hackrom): restano nel set, segnalati', () => {
    const { sets, errors } = importShowdown('Garchomp\nAbility: Sand Lord\nTera Type: Cosmic\n- Laser Blast\n- Earthquake', 'it');
    expect(sets[0]).toMatchObject({ ability: 'Sand Lord', teraType: 'Cosmic', moves: ['Laser Blast', 'Earthquake'] });
    expect(errors).toEqual([
      'Garchomp: mossa sconosciuta "Laser Blast", non conta',
      'Garchomp: abilità sconosciuta "Sand Lord", non conta',
      'Garchomp: tipo Tera sconosciuto "Cosmic", non conta',
    ]);
  });

  it('tipo Tera scritto in minuscolo: preso col nome giusto', () => {
    expect(importShowdown('Garchomp\nTera Type: fire\n- Earthquake', 'it').sets[0].teraType).toBe('Fire');
  });

  it('testo vuoto o solo spazi: nessun membro e nessun errore', () => {
    expect(importShowdown('   \n\n \t ', 'it')).toEqual({ sets: [], errors: [] });
  });
});
