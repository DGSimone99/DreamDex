import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

/** Parole italiane che non devono comparire con l'app in inglese. */
const ITALIAN = /\b(Suggerimenti|Analisi|Aggiungi|Sostituisci|Debole|Deboli|Resistono|Abilitato|Spesso usati|smorza|Considera|Gestito|Nessun[oa]?|Filtri|Ruoli|Mosse|Strumento|Abilità|Natura|Valutazione|Punti di forza|Problemi|Posto libero|Statistiche|Uso nel meta|immune a|resiste a|Porta|Ferma|Colpisce)\b/;

describe('app completa in inglese', () => {
  it('nessuna parola italiana con team, editor aperto, filtri aperti e sostituzione', async () => {
    const user = userEvent.setup();
    const { container } = render(<App data={fixtureData} initialLang="en" />);
    for (const name of ['Great Tusk', 'Gholdengo', 'Mewtwo-Mega-Y']) await user.type(screen.getByLabelText('Add Pokémon'), `${name}{Enter}`);
    container.querySelectorAll('details').forEach(d => { (d as HTMLDetailsElement).open = true; });
    await user.click(screen.getByRole('button', { name: 'Replace Gholdengo' }));
    const text = container.textContent ?? '';
    const match = text.match(ITALIAN);
    expect(match?.[0] ?? null).toBeNull();
  });
});
