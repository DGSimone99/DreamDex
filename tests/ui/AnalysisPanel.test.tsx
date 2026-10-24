import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

/** Riga di un elenco dell'analisi, cercata per nome (ruolo o Pokémon). */
const row = (name: string) => screen.getAllByRole('listitem')
  .find(li => li.querySelector('.role, .who strong')?.textContent === name)!;

describe('AnalysisPanel', () => {
  const team = [tusk, gholdengo];
  const renderPanel = () => renderIt(<AnalysisPanel team={team} analysis={analyzeTeam(team, fixtureData)} />);

  it('anteprime di una riga', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Analisi' });
    // Debolezze: triangoli per gravi e minori, che insieme fanno 4
    const weakSummary = within(panel).getByText('Debolezze difensive').closest('summary')!;
    const counts = [...weakSummary.querySelectorAll('.issue [aria-hidden="true"]')].map(el => Number(el.textContent));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
    expect(weakSummary).toHaveTextContent(/mancanz/);
    expect(within(panel).getByText('15/18 tipi')).toBeInTheDocument();
    expect(within(panel).getByText('Minacce del meta')).toBeInTheDocument();
    expect(within(panel).getByText('4 scoperte')).toBeInTheDocument();
  });

  it('dettaglio debolezze: riga per tipo con moltiplicatori', () => {
    renderPanel();
    const row = screen.getByRole('row', { name: /^Water/ });
    expect(within(row).getByText('×2')).toBeInTheDocument();
  });

  it('ruoli: giudicati col tipo di team; nel riassunto gli essenziali coperti, nel dettaglio chi li copre', () => {
    renderPanel();
    // Team incompleto: giudicato come Balance (essenziali: minaccia offensiva e i due muri)
    expect(screen.getByText('Balance · 2/3 essenziali')).toBeInTheDocument();
    expect(screen.getByText(/Team incompleto/)).toBeInTheDocument();
    expect(row('Muro speciale')).toHaveTextContent('Mancante');
    expect(row('Muro speciale')).toHaveClass('bad');
    expect(row('Rimozione hazard')).toHaveTextContent('Great Tusk');
    expect(row('Minaccia offensiva')).toHaveTextContent('Great Tusk');
    expect(screen.getByText('Importanti')).toBeInTheDocument();
    expect(screen.getByText(/^Minori/)).toBeInTheDocument();
  });

  it('ruoli importanti mancanti: avviso tenue, distinto dai minori mancanti e senza croce rossa', () => {
    renderPanel();
    // Pivot è importante nel balance (prima era essenziale)
    expect(row('Pivot')).toHaveClass('warn');
    expect(row('Pivot')).not.toHaveClass('bad');
    expect(row('Pivot')).not.toHaveClass('soft');
    expect(row('Pivot')).toHaveTextContent('Da coprire');
    // Un minore mancante resta grigio con il trattino
    const minor = [...document.querySelectorAll('.role-group')].find(g => /^Minori/.test(g.querySelector('h4')!.textContent!))!;
    const missingMinor = [...minor.querySelectorAll('li')].find(li => !li.querySelector('.owner'));
    if (missingMinor) { expect(missingMinor).toHaveClass('soft'); expect(missingMinor).toHaveTextContent('—'); }
  });

  it('per uno stall i ruoli offensivi non sono richiesti', () => {
    const stall = [
      { ...tusk, species: 'Toxapex', item: 'Black Sludge', ability: 'Regenerator', moves: ['Scald', 'Toxic', 'Recover', 'Haze'] },
      { ...tusk, species: 'Blissey', item: 'Leftovers', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Wish'] },
      { ...tusk, species: 'Corviknight', item: 'Leftovers', ability: 'Pressure', moves: ['Body Press', 'Defog', 'Iron Defense', 'Roost'] },
      { ...tusk, species: 'Gliscor', item: 'Toxic Orb', ability: 'Poison Heal', moves: ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'] },
      { ...tusk, species: 'Dondozo', item: 'Leftovers', ability: 'Unaware', moves: ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'] },
      { ...tusk, species: 'Clodsire', item: 'Leftovers', ability: 'Unaware', moves: ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'] },
    ];
    renderIt(<AnalysisPanel team={stall} analysis={analyzeTeam(stall, fixtureData)} />);
    // Essenziali dello stall: i due muri (gli attaccanti sono ignorati)
    expect(screen.getByText('Stall · 2/2 essenziali')).toBeInTheDocument();
    // Fra i non richiesti, in grigio: qui un membro (con gli EV d'attacco di Great Tusk) è misurato come attaccante,
    // quindi la riga mostra chi lo copre invece di "Non richiesto"
    expect(row('Minaccia offensiva').closest('.role-group')!.querySelector('h4')).toHaveTextContent('Non richiesti');
    expect(row('Minaccia offensiva')).toHaveClass('soft');
  });

  it("velocità, controllo velocità e priorità non sono ruoli: niente righe (li misura l'area Velocità)", () => {
    const fast = [...team, { ...tusk, species: 'Dragapult', item: 'Choice Specs', ability: 'Infiltrator', moves: ['Shadow Ball', 'Draco Meteor'] }];
    renderIt(<AnalysisPanel team={fast} analysis={analyzeTeam(fast, fixtureData)} />);
    expect(row('Velocità')).toBeUndefined();
    expect(row('Controllo velocità')).toBeUndefined();
    expect(row('Priorità')).toBeUndefined();
  });

  it('dettaglio minacce', () => {
    renderPanel();
    expect(row('Kingambit')).toHaveTextContent('20,0%');
    expect(row('Kingambit')).toHaveTextContent('Gestito da Great Tusk');
    expect(row('Dragapult')).toHaveTextContent('Nessun check');
    expect(row('Dragapult')).toHaveClass('bad');
  });
});
