import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { MetaPanel } from '../../src/ui/AnalysisPanel';
import { NeedsTable, OffenseTable } from '../../src/ui/AnalysisTables';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

/** Riga di un elenco dell'analisi, cercata per nome (ruolo o Pokémon). */
const row = (name: string) => screen.getAllByRole('listitem')
  .find(li => li.querySelector('.role, .who strong')?.textContent === name)!;

/** Le tabelle delle schede d'area e le minacce del meta, insieme come nella vecchia Analisi. */
const AllTables = ({ team }: { team: TeamSet[] }) => {
  const analysis = analyzeTeam(team, fixtureData);
  return (
    <section aria-label="Analisi">
      <OffenseTable analysis={analysis} />
      <NeedsTable team={team} analysis={analysis} />
      <MetaPanel team={team} analysis={analysis} data={fixtureData} />
    </section>
  );
};

describe('tabelle dell\'Analisi', () => {
  const team = [tusk, gholdengo];
  const renderPanel = () => renderIt(<AllTables team={team} />);

  it('anteprime di una riga', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Analisi' });
    expect(within(panel).getByText('15/18 tipi')).toBeInTheDocument();
    expect(within(panel).getByText('Minacce del meta')).toBeInTheDocument();
    expect(within(panel).getByText('4 scoperte')).toBeInTheDocument();
  });

  it('ruoli: giudicati col tipo di team; nel riassunto gli essenziali coperti, nel dettaglio chi li copre', () => {
    renderPanel();
    // Team incompleto: giudicato come Balance (essenziali: minaccia offensiva e i due muri)
    expect(screen.getByText('Balance · 2/3 essenziali')).toBeInTheDocument();
    expect(screen.getByText(/Team incompleto/)).toBeInTheDocument();
    expect(row('Muro Speciale')).toHaveTextContent('Mancante');
    expect(row('Muro Speciale')).toHaveClass('bad');
    expect(row('Rimozione Hazard')).toHaveTextContent('Great Tusk');
    expect(row('Minaccia Offensiva')).toHaveTextContent('Great Tusk');
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
    const minor = [...document.querySelectorAll('.role-group')].find(g => /^Minori/.test(g.querySelector('h5')!.textContent!))!;
    const missingMinor = [...minor.querySelectorAll('li')].find(li => !li.querySelector('.owner'));
    // Precondizione: il team di prova ha almeno un minore mancante
    expect(missingMinor).toBeDefined();
    expect(missingMinor).toHaveClass('soft');
    expect(missingMinor).toHaveTextContent('—');
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
    renderIt(<AllTables team={stall} />);
    // Essenziali dello stall: i due muri e il Recupero (interruttore spento); gli attaccanti sono ignorati
    expect(screen.getByText('Stall · 3/3 essenziali')).toBeInTheDocument();
    // Fra i non richiesti, in grigio: qui un membro (con gli EV d'attacco di Great Tusk) è misurato come attaccante,
    // quindi la riga mostra chi lo copre invece di "Non richiesto"
    expect(row('Minaccia Offensiva').closest('.role-group')!.querySelector('h5')).toHaveTextContent('Non richiesti');
    expect(row('Minaccia Offensiva')).toHaveClass('soft');
  });

  it("velocità, controllo velocità e priorità non sono ruoli: niente righe (li misura l'area Velocità)", () => {
    const fast = [...team, { ...tusk, species: 'Dragapult', item: 'Choice Specs', ability: 'Infiltrator', moves: ['Shadow Ball', 'Draco Meteor'] }];
    renderIt(<AllTables team={fast} />);
    expect(row('Velocità')).toBeUndefined();
    expect(row('Controllo Velocità')).toBeUndefined();
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
