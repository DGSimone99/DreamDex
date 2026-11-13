import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam, ratingThreats } from '../../src/engine/rating';
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

  it('anteprime di una riga: le minacce che nessuno regge nella Coverage meta della Difesa', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Analisi' });
    const rating = rateTeam(team, fixtureData)!;
    const open = ratingThreats(rating, fixtureData).filter(t => !t.handledBy.length);
    expect(open.map(t => t.name)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(within(panel).getByText('Minacce del meta')).toBeInTheDocument();
    expect(within(panel).getByText('2 scoperte')).toBeInTheDocument();
    // Il numero è quello del voto, non una quota pesata a parte
    const n = rating.defense.coverageMeta!.rows.length;
    expect(panel).toHaveTextContent(`Coverage meta della Difesa (le ${n} minacce più usate): ${rating.defense.coverageMeta!.value}%`);
  });

  it('dettaglio minacce', () => {
    renderPanel();
    expect(row('Kingambit')).toHaveTextContent('20,0%');
    expect(row('Kingambit')).toHaveTextContent('Coperto da Great Tusk');
    expect(row('Kingambit')).not.toHaveClass('bad');
    // Dragapult lo regge Great Tusk (prima, coi check Smogon, era scoperto)
    expect(row('Dragapult')).toHaveTextContent('Coperto da Great Tusk');
    // Gholdengo è anche nell'uso dei membri: la riga è quella delle minacce
    const threatList = screen.getByText('Minacce del meta').closest('details')!;
    const gholdengoThreat = within(threatList).getAllByRole('listitem').find(li => li.querySelector('.who strong')?.textContent === 'Gholdengo')!;
    expect(gholdengoThreat).toHaveTextContent('Scoperto');
    expect(gholdengoThreat).toHaveClass('bad');
  });
});
