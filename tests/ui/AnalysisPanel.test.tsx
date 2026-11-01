import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { MetaPanel } from '../../src/ui/AnalysisPanel';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

/** Riga di un elenco dell'analisi, cercata per nome (ruolo o Pokémon). */
const row = (name: string) => screen.getAllByRole('listitem')
  .find(li => li.querySelector('.role, .who strong')?.textContent === name)!;

/** Le minacce del meta, come nella vecchia Analisi (i ruoli sono nella scheda Ruoli: RolesDetail.test.tsx). */
const AllTables = ({ team }: { team: TeamSet[] }) => {
  const analysis = analyzeTeam(team, fixtureData);
  return (
    <section aria-label="Analisi">
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
    expect(within(panel).getByText('Minacce del meta')).toBeInTheDocument();
    expect(within(panel).getByText('4 scoperte')).toBeInTheDocument();
  });

  it('dettaglio minacce', () => {
    renderPanel();
    expect(row('Kingambit')).toHaveTextContent('20,0%');
    expect(row('Kingambit')).toHaveTextContent('Gestito da Great Tusk');
    expect(row('Dragapult')).toHaveTextContent('Nessun check');
    expect(row('Dragapult')).toHaveClass('bad');
  });
});
